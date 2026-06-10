'use server'

/**
 * 📊 글로벌 동종 섹터 페어-트레이딩 시그널 (Cross-Border Pair-Trading Signal)
 *
 * "글로벌 1등(US 앵커) 대비 이 종목이 통계적으로 얼마나 과도하게 저평가/고평가됐나"를
 * 하나의 z-score로. 프롭 트레이딩 데스크의 상대가치(롱숏) 로직을 교육용으로 구현.
 *
 * ── 방법 ──
 *  · 멀티플 = P/S(Price-to-Sales). ⭐P/E는 적자(EPS<0) 구간에서 깨짐 → 반도체 등 사이클주에
 *    안정적인 P/S를 주지표로(매출은 항상 양수). P/E는 참고로 현재값만 병기.
 *  · P/S(t) = 종가(t) × 발행주식수 / '직전 보고 연매출'(trailing, lookahead 없음)
 *  · 비율 = P/S(target) / P/S(anchor) — 통화·절대수준 무관(둘 다 비율). 일봉 ~3년(~700+ 관측)
 *  · baseline = 비율의 역사적 평균·표준편차(σ) → 현재 비율의 z-score
 *  · 시그널: z ≤ −2 저평가 괴리 / z ≥ +2 고평가 프리미엄 / 그 외 정상범위
 *
 * ⚠️ 정직성: 평균회귀는 보장되지 않음(밸류 트랩 가능) · EPS 이력 ~4년이라 '수년' 수준 ·
 *           통계적 참고이며 투자 추천 아님.
 *
 * Lazy Caching: 종목별 in-memory 6h.
 */

export interface PairSide {
  ticker: string
  label:  string
  ps:     number | null    // 현재 P/S
  pe:     number | null    // 현재 P/E (참고)
}
export interface PairSignalResult {
  status:   'ok' | 'no_anchor' | 'is_anchor' | 'insufficient' | 'unsupported' | 'error'
  sector:   string | null
  target:   PairSide
  anchor:   PairSide
  obs:      number          // 관측 일수
  years:    number          // 데이터 연수
  baseline: number          // 역사적 평균 P/S 비율(target/anchor)
  sigma:    number
  current:  number          // 현재 P/S 비율
  z:        number
  signal:   'undervalued' | 'overvalued' | 'neutral'
  comment:  string
  message?: string
  asOf:     string
}

// ── 섹터별 글로벌 앵커(헤게모니 1등) — Yahoo industry 문자열 기준 ────────────────
const ANCHOR_MAP: Record<string, { ticker: string; label: string }> = {
  'Semiconductors':                { ticker: 'NVDA', label: 'NVIDIA' },
  'Consumer Electronics':          { ticker: 'AAPL', label: 'Apple' },
  'Auto Manufacturers':            { ticker: 'TSLA', label: 'Tesla' },
  'Software - Infrastructure':     { ticker: 'MSFT', label: 'Microsoft' },
  'Software - Application':        { ticker: 'CRM',  label: 'Salesforce' },
  'Internet Content & Information':{ ticker: 'GOOG', label: 'Alphabet' },
  'Internet Retail':               { ticker: 'AMZN', label: 'Amazon' },
  'Banks - Diversified':           { ticker: 'JPM',  label: 'JPMorgan' },
  'Aerospace & Defense':           { ticker: 'RTX',  label: 'RTX' },
  'Drug Manufacturers - General':  { ticker: 'LLY',  label: 'Eli Lilly' },
  'Biotechnology':                 { ticker: 'AMGN', label: 'Amgen' },
  'Beverages - Non-Alcoholic':     { ticker: 'KO',   label: 'Coca-Cola' },
  'Entertainment':                 { ticker: 'NFLX', label: 'Netflix' },
  'Credit Services':               { ticker: 'V',    label: 'Visa' },
  'Steel':                         { ticker: 'NUE',  label: 'Nucor' },
  'Electronic Components':         { ticker: 'APH',  label: 'Amphenol' },
  'Oil & Gas Integrated':          { ticker: 'XOM',  label: 'ExxonMobil' },
  'Oil & Gas E&P':                 { ticker: 'COP',  label: 'ConocoPhillips' },
  'Household & Personal Products':  { ticker: 'PG',   label: 'P&G' },
  'Packaged Foods':                { ticker: 'MDLZ', label: 'Mondelez' },
  'Specialty Chemicals':           { ticker: 'LIN',  label: 'Linde' },
  'Chemicals':                     { ticker: 'LIN',  label: 'Linde' },
  'Communication Equipment':       { ticker: 'CSCO', label: 'Cisco' },
  'Footwear & Accessories':        { ticker: 'NKE',  label: 'Nike' },
  'Restaurants':                   { ticker: 'MCD',  label: "McDonald's" },
  'Telecom Services':              { ticker: 'VZ',   label: 'Verizon' },
  'Discount Stores':               { ticker: 'WMT',  label: 'Walmart' },
  'Specialty Industrial Machinery':{ ticker: 'GE',   label: 'GE Aerospace' },
  'Electrical Equipment & Parts':  { ticker: 'ETN',  label: 'Eaton' },
}

const CACHE = new Map<string, { data: PairSignalResult; exp: number }>()
const TTL = 6 * 3600_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function n(v: any): number | null { if (v == null) return null; const x = typeof v === 'object' && 'raw' in v ? v.raw : v; const f = typeof x === 'number' ? x : parseFloat(x); return isFinite(f) ? f : null }
const round2 = (v: number | null) => v == null ? null : Math.round(v * 100) / 100
const round3 = (v: number) => Math.round(v * 1000) / 1000
async function getYF() {
  const { default: YF } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YF as any)({ suppressNotices: ['yahooSurvey'] })
}

interface StockData { prices: { t: number; c: number }[]; rev: { t: number; v: number }[]; shares: number; ps: number | null; pe: number | null; name: string; industry: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStock(yf: any, sym: string, since: string): Promise<StockData | null> {
  try {
    const [chart, fts, q] = await Promise.all([
      yf.chart(sym, { period1: since, interval: '1d' }),
      yf.fundamentalsTimeSeries(sym, { period1: '2019-01-01', type: 'annual', module: 'financials' }),
      yf.quoteSummary(sym, { modules: ['defaultKeyStatistics', 'summaryDetail', 'price', 'assetProfile'] }),
    ])
    const prices = (chart?.quotes ?? []).filter((x: { close: number }) => x.close > 0)
      .map((x: { date: Date; close: number }) => ({ t: new Date(x.date).getTime(), c: x.close }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ftsArr: any[] = Array.isArray(fts) ? fts : (fts?.timeSeries ?? [])
    const rev = ftsArr.map(r => ({ t: (r.date instanceof Date ? r.date : new Date(r.date)).getTime(), v: n(r.totalRevenue) }))
      .filter(r => r.v != null && (r.v as number) > 0).map(r => ({ t: r.t, v: r.v as number })).sort((a, b) => a.t - b.t)
    const ks = q?.defaultKeyStatistics ?? {}, sd = q?.summaryDetail ?? {}, pr = q?.price ?? {}, ap = q?.assetProfile ?? {}
    const shares = n(ks.sharesOutstanding) ?? n(ks.impliedSharesOutstanding) ?? 0
    if (!prices.length || !rev.length || !shares) return null
    // P/E: Yahoo trailingPE 우선 → 없으면(국내 .KS/.KQ 다수) 최근 연간 EPS로 추정(현재가÷최근 흑자 EPS)
    let pe = n(sd.trailingPE)
    if (pe == null) {
      const lastPrice = prices[prices.length - 1].c
      const epsArr = ftsArr.map(r => ({ t: (r.date instanceof Date ? r.date : new Date(r.date)).getTime(), e: n(r.dilutedEPS) ?? n(r.basicEPS) }))
        .filter(r => r.e != null).sort((a, b) => a.t - b.t)
      const lastEps = epsArr.length ? epsArr[epsArr.length - 1].e as number : null
      // 흑자전환 직후 등 EPS가 미미하면 P/E가 폭발(예: 800x)해 무의미 → 합리적 범위(≤150x)만 표시
      if (lastEps != null && lastEps > 0) { const p = lastPrice / lastEps; if (p > 0 && p <= 150) pe = Math.round(p * 100) / 100 }
    }
    return {
      prices, rev, shares,
      ps: n(sd.priceToSalesTrailing12Months),
      pe,
      name: String(pr.shortName || pr.longName || sym).replace(/\.(KS|KQ)$/i, ''),
      industry: ap.industry ? String(ap.industry) : null,
    }
  } catch { return null }
}

// 일봉 P/S 시계열: ps(t) = 가격 × 주식수 / 직전 보고 연매출
function psSeries(s: StockData): Map<string, number> {
  const m = new Map<string, number>()
  let ri = 0
  for (const p of s.prices) {
    while (ri + 1 < s.rev.length && s.rev[ri + 1].t <= p.t) ri++
    const rev = s.rev[ri] && s.rev[ri].t <= p.t ? s.rev[ri].v : null
    if (!rev) continue
    const ps = (p.c * s.shares) / rev
    if (isFinite(ps) && ps > 0) m.set(new Date(p.t).toISOString().slice(0, 10), ps)
  }
  return m
}

// 한글 조사 자동 선택 (받침 유무) — 영문 등 비한글은 안전 표기 유지
function josa(w: string, kind: 'iga' | 'gwawa'): string {
  const c = (w || ' ').charCodeAt(w.length - 1)
  const hangul = c >= 0xAC00 && c <= 0xD7A3
  if (!hangul) return kind === 'iga' ? '이(가)' : '과(와)'
  const batchim = (c - 0xAC00) % 28 !== 0
  return kind === 'iga' ? (batchim ? '이' : '가') : (batchim ? '과' : '와')
}

function comment(sig: PairSignalResult['signal'], z: number, t: string, a: string): string {
  const za = Math.abs(z).toFixed(1)
  const iga = josa(t, 'iga')
  // |z|>3 = 정상 통계범위를 크게 벗어난 '레짐 전환' 구간 (단순 과열/소외를 넘어 구조적 재평가 시사)
  const regime = Math.abs(z) > 3
  if (sig === 'undervalued')
    return `⚠️ ${t}${iga} 글로벌 1등 ${a} 대비 P/S 멀티플이 역사적 평균보다 ${za}σ 낮습니다. 대장주가 달리는 동안 통계적 하한선(−2σ)을 이탈해 과도하게 소외된 상태 — 평균회귀(따라잡기) 기회일 수도, 구조적 약점(밸류 트랩)일 수도 있어요.${regime ? ' (※ −3σ 이상은 정상범위를 크게 벗어난 레짐 전환 신호일 수 있으니 단순 저평가로 단정 금물.)' : ''} "왜 이만큼 벌어졌는가"를 반드시 확인하세요.`
  if (sig === 'overvalued')
    return `🔺 ${t}${iga} ${a} 대비 통계적 상단(+${za}σ)을 이탈했습니다. 글로벌 1등보다 상대적으로 비싸진 구간 — 단기 과열이거나 펀더멘털 재평가(예: 사이클 슈퍼호황)일 수 있어요.${regime ? ' (※ +3σ 이상은 단순 과열을 넘어 업황 자체가 재평가된 레짐 전환 구간일 수 있어 "비싸니 매도"로 단정하면 위험.)' : ''} 추격매수에는 신중이 필요합니다.`
  return `● ${t}${josa(t, 'gwawa')} ${a}의 상대 밸류에이션이 역사적 정상범위(±2σ) 안(현재 ${z >= 0 ? '+' : ''}${z.toFixed(1)}σ)에 있습니다. 통계적으로 특별한 괴리는 없는 상태입니다.`
}

export async function getPairSignal(input: { ticker: string; name: string; market: string }): Promise<PairSignalResult> {
  const ticker = input.ticker.trim().toUpperCase()
  const asOf = new Date().toISOString()
  const base: PairSignalResult = {
    status: 'error', sector: null,
    target: { ticker, label: input.name || ticker, ps: null, pe: null },
    anchor: { ticker: '', label: '', ps: null, pe: null },
    obs: 0, years: 0, baseline: 0, sigma: 0, current: 0, z: 0, signal: 'neutral', comment: '', asOf,
  }

  const { getAssetType } = await import('@/lib/assetClassifier')
  if (getAssetType(ticker, input.name ?? '', input.market) !== 'STOCK')
    return { ...base, status: 'unsupported', message: '개별 주식만 지원합니다 (ETF·코인·원자재 제외).' }

  const key = `${ticker}|${input.market}`
  const hit = CACHE.get(key)
  if (hit && Date.now() < hit.exp) return hit.data

  try {
    const yf = await getYF()
    const since = new Date(Date.now() - 3 * 365 * 86400_000).toISOString().slice(0, 10)
    // KR은 .KS(코스피)→.KQ(코스닥) 폴백 — 코스닥 종목(예: 파두 440110.KQ)이 .KS로만 시도하면 실패
    const code = ticker.replace(/\D/g, '')
    const tries = input.market === 'KR' ? [`${code}.KS`, `${code}.KQ`] : [ticker]
    let target: StockData | null = null
    for (const sym of tries) { const t = await fetchStock(yf, sym, since); if (t) { target = t; if (t.industry) break } }
    if (!target) return finish({ ...base, status: 'insufficient', message: '대상 종목의 가격·재무 시계열을 불러오지 못했습니다.' })

    const sector = target.industry
    const anchorDef = sector ? ANCHOR_MAP[sector] : null
    base.sector = sector
    // KR은 Yahoo 영문 shortName(SamsungElec) 대신 전달받은 한글명(삼성전자)을 우선 — 학생 가독성
    const targetLabel = (input.market === 'KR' && input.name?.trim()) ? input.name.trim() : target.name
    base.target = { ticker, label: targetLabel, ps: round2(target.ps), pe: round2(target.pe) }

    if (!anchorDef) return finish({ ...base, status: 'no_anchor', message: `'${sector || '미상'}' 업종은 글로벌 앵커 종목이 지정돼 있지 않아 페어 분석을 제공하지 않습니다.` })
    if (anchorDef.ticker === ticker) return finish({ ...base, status: 'is_anchor', anchor: { ...anchorDef, ps: round2(target.ps), pe: round2(target.pe) }, message: '이 종목이 해당 섹터의 글로벌 앵커(1등)입니다.' })

    const anchor = await fetchStock(yf, anchorDef.ticker, since)
    if (!anchor) return finish({ ...base, status: 'insufficient', anchor: { ...anchorDef, ps: null, pe: null }, message: '앵커 종목 데이터를 불러오지 못했습니다.' })
    base.anchor = { ticker: anchorDef.ticker, label: anchorDef.label, ps: round2(anchor.ps), pe: round2(anchor.pe) }

    // 일봉 P/S 비율 시계열(target/anchor) — 같은 날짜만 정렬
    const tPS = psSeries(target), aPS = psSeries(anchor)
    const ratios: number[] = []
    for (const [d, tv] of Array.from(tPS)) { const av = aPS.get(d); if (av && av > 0) ratios.push(tv / av) }
    if (ratios.length < 120) return finish({ ...base, status: 'insufficient', message: '통계 계산에 필요한 공통 거래일(120일+)이 부족합니다.' })

    const mean = ratios.reduce((s, x) => s + x, 0) / ratios.length
    const sigma = Math.sqrt(ratios.reduce((s, x) => s + (x - mean) ** 2, 0) / ratios.length)
    const current = ratios[ratios.length - 1]
    const z = sigma > 0 ? (current - mean) / sigma : 0
    const signal: PairSignalResult['signal'] = z <= -2 ? 'undervalued' : z >= 2 ? 'overvalued' : 'neutral'

    const result: PairSignalResult = {
      ...base, status: 'ok',
      obs: ratios.length, years: Math.round((ratios.length / 252) * 10) / 10,
      baseline: round3(mean), sigma: round3(sigma), current: round3(current), z: Math.round(z * 100) / 100,
      signal, comment: comment(signal, z, targetLabel, anchorDef.label),
    }
    return finish(result)
  } catch (e) {
    console.warn('[pair-signal]', (e as Error).message)
    return { ...base, status: 'error', message: '페어 시그널 계산 중 오류가 발생했습니다.' }
  }

  function finish(r: PairSignalResult): PairSignalResult { CACHE.set(key, { data: r, exp: Date.now() + TTL }); return r }
}
