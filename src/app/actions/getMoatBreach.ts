'use server'

/**
 * 🏰 해자 붕괴 경보기 (Moat Breach Detector) — 비밀병기 11단계 (마지막)
 *
 * 워런 버핏: "경제적 해자(moat)는 가격을 올려도 고객이 떠나지 않는 힘이다."
 * 피터 린치: "마진이 무너지기 시작하면, 스토리가 끝나간다는 첫 신호다."
 *
 *  해자의 본질 = '가격결정력' = 총마진(Gross Margin)의 높이와 지속성.
 *  해자가 무너지면 → 경쟁 심화/원가 압박으로 총마진이 수년에 걸쳐 침식된다.
 *  이 경보기는 4개년 총마진·영업이익률 추세를 보고, 최신 총마진이 4년 최고점 대비
 *  얼마나 깎였는지(erosion)로 '견고 / 균열 / 붕괴'를 판정한다.
 *  ※ 경기순환 일시 하락(예: 반도체 메모리 불황)은 '회복'하면 최신값이 다시 고점에 붙어
 *    자동으로 견고로 처리된다 — 구조적 붕괴(예: 만년 점유율 하락)만 경보.
 *
 * ── 설계 원칙 ──
 *  ① Zero Cost   : Yahoo fundamentalsTimeSeries(무료) — US·KR 동일 규격 4개년 손익.
 *  ② Lazy Caching: 종목별 6h 인메모리 캐시.
 *  ③ Zero Input  : 종목 상세 진입 시 컴포넌트가 자동 호출.
 *
 * ⚠️ 교훈: Yahoo quoteSummary.incomeStatementHistory는 2024.11부터 grossProfit/OI를
 *    안 줌(매출만) → fundamentalsTimeSeries(module:'financials')가 정답.
 *    비율(마진·ROE)은 통화무관 → KR↔US 환율 변환 불필요.
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface MoatYear {
  year:        number
  grossMargin: number | null   // %
  opMargin:    number | null   // %
  revenue:     number          // raw (통화단위, 표시용 성장률 계산에만 사용)
}
export interface MoatResult {
  status:       'ok' | 'insufficient' | 'unsupported' | 'error'
  ticker:       string
  name:         string
  market:       'US' | 'KR'
  years:        MoatYear[]               // 과거→최신
  grossNow:     number | null
  grossPeak:    number | null
  opNow:        number | null
  roe:          number | null            // % (TTM)
  revGrowthYoY: number | null            // % (최신 YoY)
  erosionPct:   number | null            // (peak-now)/peak ×100
  moatWidth:    'wide' | 'moderate' | 'narrow' | 'none'
  verdict:      'intact' | 'hairline' | 'breach' | 'early'
  lynchComment: string
  isFinancial?: boolean   // 🏦 금융주(총마진·순부채 기반 지표 무의미) — 다운스트림(자본배분 등) 가드용
  message?:     string
}

// ── Yahoo 인스턴스 ───────────────────────────────────────────────────────────
async function getYF() {
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
}

// ── 6h 인메모리 캐시 ─────────────────────────────────────────────────────────
const CACHE = new Map<string, { data: MoatResult; exp: number }>()
const TTL = 6 * 3600_000

// KR 6자리 → Yahoo 심볼 후보(.KS 코스피 / .KQ 코스닥)
function krCandidates(ticker: string): string[] {
  const code = ticker.replace(/\.(KS|KQ)$/i, '')
  if (/\.(KS|KQ)$/i.test(ticker)) return [ticker]
  return [`${code}.KS`, `${code}.KQ`]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | null {
  if (v == null) return null
  const n = typeof v === 'object' && 'raw' in v ? v.raw : v
  const f = typeof n === 'number' ? n : parseFloat(String(n))
  return isFinite(f) ? f : null
}

// ── 연도별 손익 시계열 수집 ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSeries(yf: any, sym: string): Promise<MoatYear[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = []
  try {
    const r = await yf.fundamentalsTimeSeries(sym, { period1: '2019-01-01', type: 'annual', module: 'financials' })
    rows = Array.isArray(r) ? r : (r?.timeSeries ?? [])
  } catch { return [] }
  const out: MoatYear[] = []
  for (const row of rows) {
    const rev = num(row.totalRevenue)
    if (!rev || rev <= 0) continue
    const gp = num(row.grossProfit)
    const oi = num(row.operatingIncome)
    const yr = row.date instanceof Date ? row.date.getFullYear() : parseInt(String(row.date).slice(0, 4), 10)
    if (!yr || yr < 2000) continue
    out.push({
      year: yr,
      grossMargin: gp != null ? Math.round((gp / rev) * 1000) / 10 : null,
      opMargin:    oi != null ? Math.round((oi / rev) * 1000) / 10 : null,
      revenue:     rev,
    })
  }
  // 연도 오름차순 + 최근 5개
  out.sort((a, b) => a.year - b.year)
  return out.slice(-5)
}

// ── 린치/버핏 코멘트 (결정론적) ───────────────────────────────────────────────
function comment(v: MoatResult): string {
  const w = v.moatWidth === 'wide' ? '넓고 강력한' : v.moatWidth === 'moderate' ? '보통 수준의' : v.moatWidth === 'narrow' ? '얕은' : '뚜렷하지 않은'
  if (v.verdict === 'early') {
    if (v.grossNow == null) return `🌱 4개년 마진 추세를 계산할 데이터가 부족해(상장 초기거나 공시 이력이 짧음). 해자를 논하기보다 매출 성장과 흑자 전환 시점을 먼저 지켜봐.`
    return `🌱 지금은 해자를 논하기 이른 단계야. 영업적자이거나 총마진이 너무 얇아(현재 ${v.grossNow.toFixed(1)}%) 가격결정력을 가늠하기 어려워. 흑자 전환과 마진 안착을 먼저 확인해.`
  }
  if (v.verdict === 'breach') {
    return `🚨 경보! ${v.name}의 총마진이 4년 전 정점(${v.grossPeak?.toFixed(1)}%) 대비 ${v.erosionPct?.toFixed(0)}%나 깎여 지금 ${v.grossNow?.toFixed(1)}%야. ` +
      `가격결정력(=해자)이 구조적으로 약해지는 신호 — 경쟁 심화나 원가 압박일 수 있어. ` +
      `${v.revGrowthYoY != null && v.revGrowthYoY < 0 ? '매출까지 역성장 중이라 더 조심해야 해. ' : ''}` +
      `"마진이 무너지면 스토리가 끝나간다"는 린치의 경고를 떠올려, 왜 마진이 깎이는지 반드시 확인해.`
  }
  if (v.verdict === 'hairline') {
    return `⚠️ ${v.name}의 총마진이 정점 대비 ${v.erosionPct?.toFixed(0)}% 정도 눌렸어(현재 ${v.grossNow?.toFixed(1)}%). ` +
      `아직 ${w} 해자는 유지되지만 균열의 조짐 — 경기순환의 일시적 눌림인지, 경쟁이 본격화된 건지 다음 분기 마진을 주시해.`
  }
  // intact
  return `🏰 ${v.name}은(는) ${w} 해자를 지키고 있어. 총마진 ${v.grossNow?.toFixed(1)}%로 4년 정점(${v.grossPeak?.toFixed(1)}%)에 바짝 붙어 있고` +
    `${v.roe != null && v.roe >= 15 ? `, ROE도 ${v.roe.toFixed(0)}%로 자본을 잘 굴리고 있지` : ''}. ` +
    `가격을 올려도 고객이 떠나지 않는 힘이 살아있다는 뜻 — 거시 소음에 흔들리지 말고 이 해자가 유지되는 한 동행할 만해.`
}

// ── 메인 서버 액션 ───────────────────────────────────────────────────────────
export async function getMoatBreach(input: { ticker: string; name: string; market: string }): Promise<MoatResult> {
  const ticker = input.ticker.trim().toUpperCase()
  const name = input.name || ticker
  const market = (input.market || '').toUpperCase()
  const isKR = market === 'KR' || /\.(KS|KQ)$/i.test(ticker) || /^\d{6}$/.test(ticker.replace(/\.(KS|KQ)$/i, ''))
  const base: MoatResult = {
    status: 'error', ticker, name, market: isKR ? 'KR' : 'US',
    years: [], grossNow: null, grossPeak: null, opNow: null, roe: null, revGrowthYoY: null,
    erosionPct: null, moatWidth: 'none', verdict: 'early', lynchComment: '',
  }

  // 개별 주식만 (ETF·코인·원자재 차단)
  try {
    const { getAssetType } = await import('@/lib/assetClassifier')
    if (getAssetType(ticker, name, market) !== 'STOCK') {
      return { ...base, status: 'unsupported', message: '개별 주식만 지원합니다 (ETF·코인·원자재 제외).' }
    }
  } catch { /* 진행 */ }

  const cacheKey = `${ticker}|${market}`
  const hit = CACHE.get(cacheKey)
  if (hit && Date.now() < hit.exp) return hit.data

  try {
    const yf = await getYF()
    const syms = isKR ? krCandidates(ticker) : [ticker]

    let years: MoatYear[] = []
    let usedSym = syms[0]
    for (const s of syms) {
      years = await fetchSeries(yf, s)
      if (years.length >= 2) { usedSym = s; break }
    }

    // 현재 ROE·마진(TTM) — 보조 스냅샷
    let roe: number | null = null
    let ttmGross: number | null = null
    let ttmOp: number | null = null
    let isFinancial = false
    try {
      const q = await yf.quoteSummary(usedSym, { modules: ['financialData', 'assetProfile'] })
      const fd = q?.financialData ?? {}
      roe = num(fd.returnOnEquity); if (roe != null) roe = Math.round(roe * 1000) / 10
      ttmGross = num(fd.grossMargins); if (ttmGross != null) ttmGross = Math.round(ttmGross * 1000) / 10
      ttmOp = num(fd.operatingMargins); if (ttmOp != null) ttmOp = Math.round(ttmOp * 1000) / 10
      isFinancial = /financ|bank|insurance|capital market|asset manage/i.test(String(q?.assetProfile?.sector ?? '') + ' ' + String(q?.assetProfile?.industry ?? ''))
    } catch { /* 마진 스냅샷 없어도 진행 */ }

    // 🏦 금융주(은행·보험)는 '총마진'으로 해자를 잴 수 없음(예금 이자=원가 구조) → ROE 기반 프록시로 평가.
    //    예금 기반·전환비용·규제 라이선스가 실질 해자. '해자 없음' 오판(본부장 리스크 체크·모닝스타) 방지.
    if (isFinancial) {
      const mw: MoatResult['moatWidth'] = roe == null ? 'narrow' : roe >= 15 ? 'wide' : roe >= 8 ? 'moderate' : roe >= 4 ? 'narrow' : 'none'
      const vd: MoatResult['verdict'] = roe != null && roe < 0 ? 'breach' : roe != null && roe < 4 ? 'hairline' : 'intact'
      const res: MoatResult = {
        ...base, status: 'ok', years, grossNow: ttmGross, grossPeak: ttmGross, opNow: ttmOp, roe,
        revGrowthYoY: null, erosionPct: 0, moatWidth: mw, verdict: vd, isFinancial: true,
        lynchComment: `🏦 금융주(은행·보험)는 총마진으로 해자를 재기 어렵습니다 — 대신 ROE${roe != null ? ` ${roe}%` : ''}로 평가했습니다. 예금 기반·전환비용·규제 라이선스가 실질 해자라, 자기자본을 꾸준히 굴리는 ROE가 해자의 척도입니다.`,
      }
      CACHE.set(cacheKey, { data: res, exp: Date.now() + TTL })
      return res
    }

    const gmYears = years.filter(y => y.grossMargin != null)
    if (gmYears.length < 2) {
      // 총마진 추세 불가 → 초기/데이터부족
      const res: MoatResult = {
        ...base, status: years.length ? 'insufficient' : 'insufficient',
        years, roe, grossNow: ttmGross, opNow: ttmOp, verdict: 'early',
        lynchComment: comment({ ...base, verdict: 'early', name }),
        message: '총마진 추세를 계산할 4개년 데이터가 부족합니다.',
      }
      CACHE.set(cacheKey, { data: res, exp: Date.now() + TTL })
      return res
    }

    const gms = gmYears.map(y => y.grossMargin as number)
    const grossNow = gms[gms.length - 1]
    const grossPeak = Math.max(...gms)
    const opNow = years[years.length - 1]?.opMargin ?? ttmOp
    const erosionPct = grossPeak > 0 ? Math.round(((grossPeak - grossNow) / grossPeak) * 1000) / 10 : 0

    // 매출 YoY (최신)
    let revGrowthYoY: number | null = null
    if (years.length >= 2) {
      const a = years[years.length - 2].revenue, b = years[years.length - 1].revenue
      if (a > 0) revGrowthYoY = Math.round(((b - a) / a) * 1000) / 10
    }

    // 해자 폭(절대 총마진 수준)
    const moatWidth: MoatResult['moatWidth'] =
      grossNow >= 40 ? 'wide' : grossNow >= 25 ? 'moderate' : grossNow >= 12 ? 'narrow' : 'none'

    // 적자(영업)·마진 미미 → 초기/부실
    const unprofitable = (opNow != null && opNow < -5)
    // 판정: 최신 총마진의 정점 대비 침식률 (경기순환 회복은 최신값이 고점에 붙어 자동 견고)
    // 붕괴: 정점比 20%+ 침식 / 또는 마진 침식(12%+)에 자본파괴(적자 ROE)가 겹칠 때(예: 인텔)
    let verdict: MoatResult['verdict']
    if (unprofitable && grossNow < 12) verdict = 'early'
    else if (erosionPct >= 20 || (roe != null && roe < 0 && erosionPct >= 12)) verdict = 'breach'
    else if (erosionPct >= 8) verdict = 'hairline'
    else verdict = 'intact'

    const result: MoatResult = {
      ...base, status: 'ok', years, grossNow, grossPeak, opNow, roe, revGrowthYoY,
      erosionPct, moatWidth, verdict, lynchComment: '',
    }
    result.lynchComment = comment(result)
    CACHE.set(cacheKey, { data: result, exp: Date.now() + TTL })
    return result
  } catch (e) {
    console.warn('[moat-breach]', (e as Error).message)
    return { ...base, status: 'error', message: '해자 데이터 수집 중 오류가 발생했습니다.' }
  }
}
