/**
 * GET /api/dividend-explorer?ticker=O&market=US
 *
 * 💰 글로벌 배당 익스플로러 — 모든 티커(포트폴리오 미보유 포함) 배당 프로필 조회
 *
 * 수집 데이터:
 *  · 시가배당률(%), 연간 주당 배당금, 배당 주기(월/분기/연)
 *  · 배당성향(Payout Ratio, %), 연속 배당성장 연수
 *  · 잉여현금흐름(FCF), 배당 함정(Dividend Trap) 플래그
 *  · 파생/합성 ETF 여부 (MSTY·JEPI·TSLY 등 covered call — 다른 리스크 구조)
 *
 * 인증 불필요 — 교육용 탐색 기능(포트폴리오 무관)
 * 캐싱: app_cache 48h (배당 데이터는 변동성 낮음)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

// ── 배당 주기 판정 ────────────────────────────────────────────────────────────
const MONTHLY_TICKERS = new Set(['O','MAIN','STAG','AGNC','NLY','GLAD','HTGC','GOOD',
  'MSTY','JEPI','JEPQ','TSLY','NVDY','GOOGY','AMZY','PLTY','SCHD'])
const ANNUAL_TICKERS  = new Set(['BRK.B','BRK-B'])
// ── 합성 파생 ETF (Covered Call / Options Premium 재원) ───────────────────────
const DERIVATIVE_ETFS = new Set(['MSTY','TSLY','NVDY','AMZY','GOOGY','PLTY','CONY',
  'MSTR','YMAX','YMAG','ULTY','QYLD','RYLD','XYLD','JEPI','JEPQ'])
// ── 배당 귀족주 연속 성장 연수 (공식 자료 기반 정적 조회) ────────────────────
const ARISTOCRAT_YEARS: Record<string, number> = {
  O:3,KO:62,PEP:52,JNJ:62,MMM:65,ABBV:52,ABT:52,ADP:49,AFL:42,ALB:29,
  APD:41,ATO:39,BDX:52,BEN:43,CAT:30,CB:15,CTAS:20,CL:61,CLX:46,COLO:52,
  ECL:31,EMR:47,ESS:29,EXPD:29,FAST:25,FRT:56,GD:32,GPC:68,GWW:52,
  HSIC:22,HRL:57,IBM:28,ITW:61,J:3,JKHY:33,KMB:51,LOW:61,MCD:49,
  MDT:47,MKC:37,MSA:50,NEE:28,NDSN:59,NUE:50,PG:68,PNR:47,PPG:52,
  ROST:29,SHW:45,SJM:26,SWK:56,SYY:54,T:0,TGT:52,TROW:37,UDR:33,
  VFC:50,VNO:3,WMT:51,XOM:42,
}
// ── 배당 함정 위험 종목 (수동 플래그 — 합성 구조 또는 지속 불가 수준) ─────────
const TRAP_TICKERS = new Set(Array.from(DERIVATIVE_ETFS).concat(['NLY','AGNC','T','VNO']))

export interface DividendProfile {
  ticker:          string
  name:            string
  market:          string
  currency:        'USD' | 'KRW' | 'EUR' | string
  price:           number | null
  dividendYield:   number | null   // 소수(0.05 = 5%)
  annualDividend:  number | null   // USD or KRW per share
  payoutRatio:     number | null   // 소수(0.65 = 65%)
  fcf:             number | null   // 원화/달러 raw
  consecutiveYears:number | null   // 연속 배당성장 연수
  frequency:       'monthly' | 'quarterly' | 'annual' | 'unknown'
  isDerivativeEtf: boolean         // 합성 파생 ETF (covered call 등)
  isTrapWarning:   boolean         // 배당 함정 경고 플래그
  trapReasons:     string[]        // 경고 근거 목록
  asOf:            string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(v: any): number | null { if (v == null) return null; const n = typeof v === 'object' && 'raw' in v ? v.raw : v; const f = typeof n === 'number' ? n : parseFloat(n); return isFinite(f) ? f : null }

function inferFrequency(ticker: string): 'monthly' | 'quarterly' | 'annual' | 'unknown' {
  const tk = ticker.toUpperCase().replace(/-/g, '.')
  if (MONTHLY_TICKERS.has(tk)) return 'monthly'
  if (ANNUAL_TICKERS.has(tk)) return 'annual'
  return 'quarterly'
}

function buildTrapReasons(
  ticker: string, payoutRatio: number | null, fcf: number | null, isDerivative: boolean
): string[] {
  const reasons: string[] = []
  const tk = ticker.toUpperCase()
  if (isDerivative) reasons.push('파생 옵션 프리미엄 재원 ETF — 주가 하락 시 원금 잠식')
  if (payoutRatio != null && payoutRatio > 0.8) reasons.push(`배당성향 ${Math.round(payoutRatio * 100)}% — 지속 가능성 낮음`)
  if (fcf != null && fcf < 0) reasons.push('잉여현금흐름(FCF) 적자 — 현금 창출력 부족')
  if (TRAP_TICKERS.has(tk) && reasons.length === 0) reasons.push('구조적 고위험 배당 종목')
  return reasons
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || '').trim().toUpperCase()
  const market = (searchParams.get('market') || 'US').trim().toUpperCase()
  if (!ticker) return NextResponse.json({ error: '티커가 필요합니다.' }, { status: 400 })

  const cacheKey = `div-explorer:${ticker}:${market}`
  const cached = await getCache<DividendProfile>(cacheKey, 48 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const empty: DividendProfile = {
    ticker, name: ticker, market, currency: market === 'KR' ? 'KRW' : 'USD', price: null,
    dividendYield: null, annualDividend: null, payoutRatio: null, fcf: null,
    consecutiveYears: ARISTOCRAT_YEARS[ticker] ?? null,
    frequency: inferFrequency(ticker),
    isDerivativeEtf: DERIVATIVE_ETFS.has(ticker),
    isTrapWarning: TRAP_TICKERS.has(ticker),
    trapReasons: [], asOf: new Date().toISOString(),
  }

  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })

    // KR: .KS(코스피) 우선, 배당 데이터 없으면 .KQ(코스닥) 폴백
    const code = ticker.replace(/\D/g, '')
    let q = null
    if (market === 'KR') {
      for (const suf of ['.KS', '.KQ']) {
        try {
          const r = await yf.quoteSummary(code + suf, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'price'] })
          if (r) { q = r; break }
        } catch { /* 다음 시도 */ }
      }
    } else {
      q = await yf.quoteSummary(ticker, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'price'] })
    }
    if (!q) throw new Error('Yahoo 데이터 없음')

    const sd = q?.summaryDetail ?? {}, pr = q?.price ?? {}, fd = q?.financialData ?? {}
    const name = String(pr.shortName || pr.longName || ticker).replace(/\.(KS|KQ)$/i, '')
    const price = pick(pr.regularMarketPrice) ?? pick(sd.regularMarketPrice) ?? pick(sd.previousClose)
    const currency = String(pr.currency || (market === 'KR' ? 'KRW' : 'USD'))

    // ── 시가배당률 ──────────────────────────────────────────────────────────────
    let dy = pick(sd.dividendYield) ?? pick(sd.trailingAnnualDividendYield)
    if (dy != null && dy > 1) dy = dy / 100   // Yahoo가 % 단위(e.g. 3.8)로 줄 때 소수로 변환

    // ── 연배당금 ────────────────────────────────────────────────────────────────
    let dr = pick(sd.dividendRate) ?? pick(sd.trailingAnnualDividendRate)

    // ── 배당성향: Yahoo는 항상 소수 (0.52=52%, 1.2=120%) → 그대로 사용 ──────
    // ⚠️ 이전 코드 `>1 ? /100` 로직 제거 — CVX=1.2(=120%)를 0.012(=1.2%)로 잘못 변환하던 버그 수정
    const payoutRatioRaw = pick(sd.payoutRatio)
    const payoutRatio = payoutRatioRaw   // 소수 그대로 (0.52=52%, 1.2=120%)

    // ── 파생/합성 ETF + data-empty ETF 정적 수익률 폴백 (2026-06 기준) ────────
    // Yahoo가 커버드콜 ETF의 분배금 수익률을 0으로 잘못 반환하는 경우
    const STATIC_YIELD: Record<string, number> = {
      MSTY:0.82, TSLY:0.56, NVDY:0.68, AMZY:0.48, GOOGY:0.42, PLTY:0.72,
      JEPI:0.072, JEPQ:0.095, QYLD:0.108, RYLD:0.098, XYLD:0.099,
      SCHD:0.035, VYM:0.028, DVY:0.033, SDY:0.025,  // 우량 배당 ETF
    }
    const isDerivative = DERIVATIVE_ETFS.has(ticker)
    // 정적 yield 폴백: Yahoo가 0 또는 null을 줄 때 (SCHD·JEPI 등)
    // dr == null || dr <= 0 : Yahoo가 dividendRate=0(not null)으로 줘도 역산 처리
    if ((dy == null || dy <= 0) && STATIC_YIELD[ticker] != null) {
      dy = STATIC_YIELD[ticker]
      if ((dr == null || dr <= 0) && price != null && price > 0)
        dr = Math.round(price * dy * 100) / 100
    }
    // KR ETF: Yahoo에 배당 데이터 없는 경우 Naver etfAnalysis API로 폴백
    // Naver /api/stock/{code}/etfAnalysis → dividendYieldTtm(%), dividendPerShareTtm(원/주)
    const isKrNoDiv = market === 'KR' && (dy == null || dy <= 0)
    if (isKrNoDiv) {
      try {
        const code = ticker.replace(/\D/g, '')
        const nr = await fetch(`https://m.stock.naver.com/api/stock/${code}/etfAnalysis`, {
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' },
          signal: AbortSignal.timeout(8000),
        })
        if (nr.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nd: any = await nr.json()
          const yv = nd?.dividend?.dividendYieldTtm      // % 단위 (e.g. 3.7)
          const dv = nd?.dividend?.dividendPerShareTtm   // 원/주 (e.g. 904)
          if (yv != null && isFinite(yv) && yv > 0) {
            dy = yv / 100
            if (dv != null && isFinite(dv) && dv > 0) dr = dv
            else if (price && price > 0) dr = Math.round(price * dy * 100) / 100
          }
        }
      } catch { /* Naver ETF 폴백 실패 → graceful */ }
    }

    // ── FCF: KR은 원화 raw → B 표시 시 단위 구분 ─────────────────────────────
    const fcfRaw = pick(fd.freeCashflow)
    // 원화는 1B(10억원) 단위로, USD는 1B($) 단위로 표시
    // 컴포넌트에서 currency를 보고 단위를 판단
    const fcf = fcfRaw

    const consecutiveYears = ARISTOCRAT_YEARS[ticker] ?? null
    const frequency = inferFrequency(ticker)
    const trapReasons = buildTrapReasons(ticker, payoutRatio, fcf, isDerivative)
    const isTrapWarning = trapReasons.length > 0

    const profile: DividendProfile = {
      ticker, name, market, currency, price,
      dividendYield: dy != null ? Math.round(dy * 10000) / 10000 : null,
      annualDividend: dr != null ? Math.round(dr * 100) / 100 : null,
      payoutRatio,     // 소수 그대로 (0.52=52%, 1.2=120%)
      fcf, consecutiveYears, frequency, isDerivativeEtf: isDerivative,
      isTrapWarning, trapReasons, asOf: new Date().toISOString(),
    }

    await setCache(cacheKey, profile)
    return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.warn('[dividend-explorer]', (e as Error).message?.slice(0, 60))
    empty.trapReasons = buildTrapReasons(ticker, null, null, DERIVATIVE_ETFS.has(ticker))
    empty.isTrapWarning = empty.trapReasons.length > 0
    return NextResponse.json(empty)
  }
}
