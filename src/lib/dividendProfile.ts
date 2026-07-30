// 💰 배당 프로필 계산 SSOT — 배당 익스플로러·배당 포트폴리오가 공유하는 단일 엔진(제2원칙)
//   시가배당률·연배당금·배당성향·연속 인상·5년 CAGR·안전성·바벨 스타일·YoC·리츠 AFFO·지급월.
//   Yahoo quoteSummary + 배당 지급 이력(chart events=div). 캐싱은 호출부(라우트)에서.

// ── 배당 주기 판정 ────────────────────────────────────────────────────────────
const MONTHLY_TICKERS = new Set(['O', 'MAIN', 'STAG', 'AGNC', 'NLY', 'GLAD', 'HTGC', 'GOOD',
  'MSTY', 'JEPI', 'JEPQ', 'TSLY', 'NVDY', 'GOOGY', 'AMZY', 'PLTY', 'SCHD'])
const ANNUAL_TICKERS = new Set(['BRK.B', 'BRK-B'])
// ── 합성 파생 ETF (Covered Call / Options Premium 재원) ───────────────────────
export const DERIVATIVE_ETFS = new Set(['MSTY', 'TSLY', 'NVDY', 'AMZY', 'GOOGY', 'PLTY', 'CONY',
  'MSTR', 'YMAX', 'YMAG', 'ULTY', 'QYLD', 'RYLD', 'XYLD', 'JEPI', 'JEPQ'])
// ── 배당 귀족주 연속 성장 연수 (공식 자료 기반 정적 조회) ────────────────────
const ARISTOCRAT_YEARS: Record<string, number> = {
  O: 30, KO: 62, PEP: 52, JNJ: 62, MMM: 65, ABBV: 52, ABT: 52, ADP: 49, AFL: 42, ALB: 29,
  APD: 41, ATO: 39, BDX: 52, BEN: 43, CAT: 30, CB: 15, CTAS: 20, CL: 61, CLX: 46, COLO: 52,
  ECL: 31, EMR: 47, ESS: 29, EXPD: 29, FAST: 25, FRT: 56, GD: 32, GPC: 68, GWW: 52,
  HSIC: 22, HRL: 57, IBM: 28, ITW: 61, J: 3, JKHY: 33, KMB: 51, LOW: 61, MCD: 49,
  MDT: 47, MKC: 37, MSA: 50, NEE: 28, NDSN: 59, NUE: 50, PG: 68, PNR: 47, PPG: 52,
  ROST: 29, SHW: 45, SJM: 26, SWK: 56, SYY: 54, T: 0, TGT: 52, TROW: 37, UDR: 33,
  VFC: 50, VNO: 3, WMT: 51, XOM: 42,
  // 리포트 반영 배당 킹/귀족 보강 (이력 창 밖 장기 기록 — 공식 자료)
  PH: 69, SPGI: 52, MDLZ: 11, DUK: 18, MO: 55, V: 16, MA: 14, TXN: 21, COST: 20, MSFT: 20,
}
// ── 배당 함정 위험 종목 (수동 플래그 — 합성 구조 또는 지속 불가 수준) ─────────
const TRAP_TICKERS = new Set(Array.from(DERIVATIVE_ETFS).concat(['NLY', 'AGNC', 'T', 'VNO']))
// ── 리츠 감지 (배당성향을 AFFO/FFO 기준으로 봐야 함 — 리포트 강조) ──────────────
export const REIT_TICKERS = new Set(['O', 'STAG', 'VNO', 'FRT', 'ESS', 'UDR', 'WPC', 'SPG', 'PLD', 'AMT', 'CCI', 'PSA',
  'EQIX', 'DLR', 'ARE', 'AVB', 'EQR', 'INVH', 'SBAC', 'WELL', 'VICI', 'MAA', 'KIM', 'REG', 'HST', 'BXP', 'DOC'])
// ── 커버드콜·우량 배당 ETF 정적 수익률 폴백 (Yahoo가 0 반환 시) ────────────────
const STATIC_YIELD: Record<string, number> = {
  MSTY: 0.82, TSLY: 0.56, NVDY: 0.68, AMZY: 0.48, GOOGY: 0.42, PLTY: 0.72,
  JEPI: 0.072, JEPQ: 0.095, QYLD: 0.108, RYLD: 0.098, XYLD: 0.099,
  SCHD: 0.035, VYM: 0.028, DVY: 0.033, SDY: 0.025,
}

export interface DividendProfile {
  ticker: string
  name: string
  market: string
  currency: 'USD' | 'KRW' | 'EUR' | string
  price: number | null
  dividendYield: number | null    // 소수(0.05 = 5%)
  annualDividend: number | null   // USD or KRW per share
  payoutRatio: number | null      // 소수(0.65 = 65%)
  fcf: number | null
  consecutiveYears: number | null
  frequency: 'monthly' | 'quarterly' | 'annual' | 'unknown'
  paymentMonths: number[]         // 배당 지급 월(1~12) — 월배당 캘린더용(ex-date 기준 근사)
  isDerivativeEtf: boolean
  isTrapWarning: boolean
  trapReasons: string[]
  dividendGrowth5y: number | null // 5년 CAGR(소수)
  dividendGrowth1y: number | null
  dividendGrade: 'king' | 'aristocrat' | 'achiever' | 'challenger' | null
  streakEstimated: boolean
  safetyScore: number | null      // 0~100
  safetyGrade: string | null
  style: 'high_yield' | 'growth' | 'balanced' | null
  yocProjRate: number | null
  yoc5y: number | null
  yoc10y: number | null
  fcfCover: number | null
  isReit: boolean
  affoNote: boolean
  asOf: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(v: any): number | null { if (v == null) return null; const n = typeof v === 'object' && 'raw' in v ? v.raw : v; const f = typeof n === 'number' ? n : parseFloat(n); return isFinite(f) ? f : null }

function inferFrequency(ticker: string, monthsCount: number): 'monthly' | 'quarterly' | 'annual' | 'unknown' {
  const tk = ticker.toUpperCase().replace(/-/g, '.')
  if (MONTHLY_TICKERS.has(tk)) return 'monthly'
  if (ANNUAL_TICKERS.has(tk)) return 'annual'
  // 지급월 수로 추론(월배당 이력이 확실하면 우선), 없으면 분기 기본
  if (monthsCount >= 10) return 'monthly'
  if (monthsCount >= 3) return 'quarterly'
  if (monthsCount === 1 || monthsCount === 2) return 'annual'   // 한국 대부분 연 1회
  return 'quarterly'
}

export function gradeOf(years: number | null): DividendProfile['dividendGrade'] {
  if (years == null) return null
  if (years >= 50) return 'king'
  if (years >= 25) return 'aristocrat'
  if (years >= 10) return 'achiever'
  if (years >= 5) return 'challenger'
  return null
}

function detectReit(ticker: string, industry: string | null, sector: string | null): boolean {
  const i = (industry ?? '').toUpperCase(), s = (sector ?? '').toUpperCase()
  return REIT_TICKERS.has(ticker) || i.includes('REIT') || s.includes('REAL ESTATE')
}

function buildTrapReasons(
  ticker: string, payoutRatio: number | null, fcf: number | null, isDerivative: boolean, isReit: boolean, isGrower: boolean
): string[] {
  const reasons: string[] = []
  const tk = ticker.toUpperCase()
  if (isDerivative) reasons.push('파생 옵션 프리미엄 재원 ETF — 주가 하락 시 원금 잠식')
  if (!isReit && !isGrower && payoutRatio != null && payoutRatio > 0.8) reasons.push(`배당성향 ${Math.round(payoutRatio * 100)}% — 지속 가능성 낮음`)
  if (!isReit && fcf != null && fcf < 0) reasons.push('잉여현금흐름(FCF) 적자 — 현금 창출력 부족')
  if (TRAP_TICKERS.has(tk) && reasons.length === 0) reasons.push('구조적 고위험 배당 종목')
  return reasons
}

// ── 배당 지급 이력 → 5년 CAGR·1년·연속 인상·지급월 ──────────────────────────
async function getDivHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yf: any, sym: string
): Promise<{ cagr5: number | null; g1: number | null; streak: number | null; months: number[] }> {
  try {
    const p1 = new Date(); p1.setFullYear(p1.getFullYear() - 16)
    const ch = await yf.chart(sym, { period1: p1, period2: new Date(), interval: '1mo', events: 'div' }, { validateResult: false })
    const raw = ch?.events?.dividends
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divs: any[] = Array.isArray(raw) ? raw : raw ? Object.values(raw) : []
    const sumYear = new Map<number, number>()
    const cntYear = new Map<number, number>()
    const recentMonths = new Set<number>()
    const curY = new Date().getUTCFullYear()
    for (const dv of divs) {
      const ms = dv?.date instanceof Date ? dv.date.getTime() : typeof dv?.date === 'number' ? dv.date * (dv.date < 1e12 ? 1000 : 1) : NaN
      const amt = typeof dv?.amount === 'number' ? dv.amount : NaN
      if (!isFinite(ms) || !isFinite(amt) || amt <= 0) continue
      const d = new Date(ms), y = d.getUTCFullYear()
      sumYear.set(y, (sumYear.get(y) ?? 0) + amt)
      cntYear.set(y, (cntYear.get(y) ?? 0) + 1)
      if (y >= curY - 3) recentMonths.add(d.getUTCMonth() + 1)   // 최근 3년 지급 월(1~12)
    }
    const months = Array.from(recentMonths).sort((a, b) => a - b)
    const years = Array.from(sumYear.keys()).filter(y => y < curY).sort((a, b) => a - b)
    if (years.length < 2) return { cagr5: null, g1: null, streak: null, months }
    // 지급당 평균(연간합÷횟수) — 월배당주 달력연도 지급횟수 노이즈 방어
    const pp = (y: number) => sumYear.get(y)! / (cntYear.get(y)! || 1)
    const last = years[years.length - 1]
    const span = Math.min(5, last - years[0])
    const baseY = last - span
    const cagr5 = (span >= 2 && sumYear.has(baseY) && pp(baseY) > 0) ? Math.pow(pp(last) / pp(baseY), 1 / span) - 1 : null
    const g1 = (sumYear.has(last - 1) && pp(last - 1) > 0) ? pp(last) / pp(last - 1) - 1 : null
    let streak = 0
    for (let i = years.length - 1; i > 0; i--) {
      if (years[i] - years[i - 1] !== 1) break
      if (pp(years[i]) >= pp(years[i - 1]) * 0.98) streak++
      else break
    }
    return { cagr5, g1, streak: streak >= 2 ? streak : null, months }
  } catch { return { cagr5: null, g1: null, streak: null, months: [] } }
}

// ── 배당 안전성 종합 점수 (0~100, 결정론) ─────────────────────────────────────
function computeSafety(o: {
  payout: number | null; fcfCover: number | null; streak: number | null
  cagr: number | null; isDerivative: boolean; isReit: boolean
}): { score: number; grade: string } {
  let s = 50
  if (o.isDerivative) s -= 25
  if (!o.isReit && o.payout != null) {
    if (o.payout < 0.4) s += 20
    else if (o.payout < 0.6) s += 12
    else if (o.payout < 0.8) s += 4
    else if (o.payout <= 1.0) s -= 8
    else s -= 20
  }
  if (!o.isReit && o.fcfCover != null) {
    if (o.fcfCover >= 2) s += 18
    else if (o.fcfCover >= 1) s += 8
    else if (o.fcfCover >= 0) s -= 8
    else s -= 22
  }
  if (o.streak != null) {
    if (o.streak >= 50) s += 14
    else if (o.streak >= 25) s += 10
    else if (o.streak >= 10) s += 6
    else if (o.streak >= 5) s += 3
  }
  if (o.cagr != null) {
    if (o.cagr >= 0.08) s += 8
    else if (o.cagr >= 0.03) s += 4
    else if (o.cagr < 0) s -= 20
  }
  s = Math.max(0, Math.min(100, Math.round(s)))
  const grade = s >= 75 ? '매우 안전' : s >= 60 ? '안전' : s >= 45 ? '보통' : s >= 30 ? '주의' : '위험'
  return { score: s, grade }
}

// ── 고수익 ↔ 성장 배당 바벨 분류 ──────────────────────────────────────────────
export function styleOf(yld: number | null, cagr: number | null): DividendProfile['style'] {
  if (yld == null) return null
  if (yld >= 0.04 && (cagr == null || cagr < 0.05)) return 'high_yield'
  if ((yld < 0.03 && cagr != null && cagr >= 0.08) || (yld < 0.02 && cagr != null && cagr >= 0.05)) return 'growth'
  return 'balanced'
}

// ── 빈 프로필 (에러·데이터 없음 graceful) ────────────────────────────────────
export function emptyProfile(ticker: string, market: string): DividendProfile {
  return {
    ticker, name: ticker, market, currency: market === 'KR' ? 'KRW' : 'USD', price: null,
    dividendYield: null, annualDividend: null, payoutRatio: null, fcf: null,
    consecutiveYears: ARISTOCRAT_YEARS[ticker] ?? null,
    frequency: inferFrequency(ticker, 0), paymentMonths: [],
    isDerivativeEtf: DERIVATIVE_ETFS.has(ticker),
    isTrapWarning: TRAP_TICKERS.has(ticker),
    trapReasons: buildTrapReasons(ticker, null, null, DERIVATIVE_ETFS.has(ticker), REIT_TICKERS.has(ticker), false),
    dividendGrowth5y: null, dividendGrowth1y: null,
    dividendGrade: gradeOf(ARISTOCRAT_YEARS[ticker] ?? null), streakEstimated: false,
    safetyScore: null, safetyGrade: null, style: null,
    yocProjRate: null, yoc5y: null, yoc10y: null, fcfCover: null,
    isReit: REIT_TICKERS.has(ticker), affoNote: REIT_TICKERS.has(ticker),
    asOf: new Date().toISOString(),
  }
}

// ── 메인: 종목 배당 프로필 계산 (캐시 없음 — 호출부에서 래핑) ──────────────────
export async function getDividendProfile(ticker: string, market: string): Promise<DividendProfile> {
  const tk = ticker.trim().toUpperCase()
  const mkt = (market || 'US').trim().toUpperCase()
  const empty = emptyProfile(tk, mkt)
  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })

    const code = tk.replace(/\D/g, '')
    const MODULES = ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'price', 'assetProfile']
    let q = null, yahooSym = tk
    if (mkt === 'KR') {
      for (const suf of ['.KS', '.KQ']) {
        try { const r = await yf.quoteSummary(code + suf, { modules: MODULES }); if (r) { q = r; yahooSym = code + suf; break } } catch { /* 다음 */ }
      }
    } else {
      q = await yf.quoteSummary(tk, { modules: MODULES })
    }
    if (!q) throw new Error('Yahoo 데이터 없음')

    const sd = q?.summaryDetail ?? {}, pr = q?.price ?? {}, fd = q?.financialData ?? {}
    const ks = q?.defaultKeyStatistics ?? {}, ap = q?.assetProfile ?? {}
    const name = String(pr.shortName || pr.longName || tk).replace(/\.(KS|KQ)$/i, '')
    const price = pick(pr.regularMarketPrice) ?? pick(sd.regularMarketPrice) ?? pick(sd.previousClose)
    const currency = String(pr.currency || (mkt === 'KR' ? 'KRW' : 'USD'))

    let dy = pick(sd.dividendYield) ?? pick(sd.trailingAnnualDividendYield)
    if (dy != null && dy > 1) dy = dy / 100
    let dr = pick(sd.dividendRate) ?? pick(sd.trailingAnnualDividendRate)
    const payoutRatio = pick(sd.payoutRatio)

    const isDerivative = DERIVATIVE_ETFS.has(tk)
    if ((dy == null || dy <= 0) && STATIC_YIELD[tk] != null) {
      dy = STATIC_YIELD[tk]
      if ((dr == null || dr <= 0) && price != null && price > 0) dr = Math.round(price * dy * 100) / 100
    }
    // KR ETF: Yahoo에 배당 없으면 Naver etfAnalysis 폴백
    if (mkt === 'KR' && (dy == null || dy <= 0)) {
      try {
        const nr = await fetch(`https://m.stock.naver.com/api/stock/${code}/etfAnalysis`, {
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(8000),
        })
        if (nr.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nd: any = await nr.json()
          const yv = nd?.dividend?.dividendYieldTtm, dv = nd?.dividend?.dividendPerShareTtm
          if (yv != null && isFinite(yv) && yv > 0) {
            dy = yv / 100
            if (dv != null && isFinite(dv) && dv > 0) dr = dv
            else if (price && price > 0) dr = Math.round(price * dy * 100) / 100
          }
        }
      } catch { /* graceful */ }
    }

    const fcf = pick(fd.freeCashflow)
    const hist = await getDivHistory(yf, mkt === 'KR' ? yahooSym : tk)

    const staticStreak = ARISTOCRAT_YEARS[tk] ?? null
    const computedStreak = (hist.streak != null && hist.streak >= 3) ? hist.streak : null
    let consecutiveYears: number | null, streakEstimated: boolean
    if (staticStreak != null && (computedStreak == null || staticStreak >= computedStreak)) { consecutiveYears = staticStreak; streakEstimated = false }
    else if (computedStreak != null) { consecutiveYears = computedStreak; streakEstimated = true }
    else { consecutiveYears = staticStreak; streakEstimated = false }
    const dividendGrade = gradeOf(consecutiveYears)
    const isGrower = dividendGrade != null && hist.cagr5 != null && hist.cagr5 >= 0.03

    const isReit = detectReit(tk, ap?.industry ?? null, ap?.sector ?? null)
    const shares = pick(ks.sharesOutstanding)
    const annualDivTotal = (dr != null && shares != null && shares > 0) ? dr * shares : null
    const fcfCover = (!isReit && fcf != null && annualDivTotal != null && annualDivTotal > 0) ? Math.round((fcf / annualDivTotal) * 100) / 100 : null

    const { score: safetyScore, grade: safetyGrade } = computeSafety({ payout: payoutRatio, fcfCover, streak: consecutiveYears, cagr: hist.cagr5, isDerivative, isReit })
    const style = styleOf(dy, hist.cagr5)
    const yocRate = hist.cagr5 != null ? Math.max(0, Math.min(hist.cagr5, 0.15)) : 0
    const yoc5y = dy != null ? Math.round(dy * Math.pow(1 + yocRate, 5) * 10000) / 10000 : null
    const yoc10y = dy != null ? Math.round(dy * Math.pow(1 + yocRate, 10) * 10000) / 10000 : null

    // 지급월: 이력 우선, 없으면 주기로 근사(월배당=전체, 분기=대표 사이클, 연=[12])
    const paymentMonths = hist.months.length ? hist.months
      : (MONTHLY_TICKERS.has(tk) ? [1,2,3,4,5,6,7,8,9,10,11,12] : mkt === 'KR' ? [12] : [3,6,9,12])
    const frequency = inferFrequency(tk, hist.months.length)
    const trapReasons = buildTrapReasons(tk, payoutRatio, fcf, isDerivative, isReit, isGrower)

    return {
      ticker: tk, name, market: mkt, currency, price,
      dividendYield: dy != null ? Math.round(dy * 10000) / 10000 : null,
      annualDividend: dr != null ? Math.round(dr * 100) / 100 : null,
      payoutRatio, fcf, consecutiveYears, frequency, paymentMonths,
      isDerivativeEtf: isDerivative, isTrapWarning: trapReasons.length > 0, trapReasons,
      dividendGrowth5y: hist.cagr5 != null ? Math.round(hist.cagr5 * 10000) / 10000 : null,
      dividendGrowth1y: hist.g1 != null ? Math.round(hist.g1 * 10000) / 10000 : null,
      dividendGrade, streakEstimated,
      safetyScore: dy != null || payoutRatio != null ? safetyScore : null,
      safetyGrade: dy != null || payoutRatio != null ? safetyGrade : null,
      style, yocProjRate: hist.cagr5 != null ? yocRate : null, yoc5y, yoc10y, fcfCover,
      isReit, affoNote: isReit, asOf: new Date().toISOString(),
    }
  } catch (e) {
    console.warn('[dividendProfile]', tk, (e as Error).message?.slice(0, 50))
    return empty
  }
}
