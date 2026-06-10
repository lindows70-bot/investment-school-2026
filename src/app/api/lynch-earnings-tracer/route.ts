/**
 * GET /api/lynch-earnings-tracer?ticker=NVDA&market=US
 *
 * 📈 린치 이익선 트레이서 (Lynch Earnings Line Tracer)
 *
 * 피터 린치: "주가는 결국 이익의 그림자다. 이익이 오르면 주가는 따라온다."
 *
 * 역사적 연간 EPS + 연간 평균 주가를 조합해:
 *  ① 린치 기본 이익선 = EPS × 15 (린치의 "성장 없는 적정가" 기준)
 *  ② 역사적 중앙값 이익선 = EPS × 5년 중앙 PER
 *  ③ 연도별 이격도(Gap%) = (주가 − 이익선) / 이익선 × 100
 *  ④ 적자(EPS ≤ 0) 구간 표시
 *
 * ── 데이터 소스 ──
 *  · EPS(5개년 확정): 자체 `/api/financials` 재사용 (US=FMP/Yahoo, KR=DART/Naver)
 *  · 연간 평균 주가: Yahoo Finance chart (5yr, 월봉 → 연평균)
 *
 * ── 캐싱 ──
 *  · app_cache 48h (EPS 역사적 데이터는 자주 바뀌지 않음)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface TracerPoint {
  year:       number
  price:      number | null   // 연간 평균 실제 주가
  eps:        number | null   // 연간 확정 EPS
  lynch15:    number | null   // EPS × 15 (린치 기본선)
  medianLine: number | null   // EPS × 역사적 중앙 PER
  actualPer:  number | null   // 실제 PER (price / eps)
  gap15:      number | null   // 이격도 %  vs 린치15선
  gapMedian:  number | null   // 이격도 %  vs 중앙선
  isDeficit:  boolean         // EPS ≤ 0 적자 구간
}
export interface TracerResult {
  ticker:        string
  name:          string
  market:        string
  currency:      'KRW' | 'USD'
  points:        TracerPoint[]
  medianPer:     number | null   // 역사적 5년 중앙 PER
  currentPrice:  number | null
  currentEps:    number | null
  currentGap15:  number | null   // 현재 이격도 vs 린치15
  deficitMode:   boolean         // 최신 EPS가 적자
  hasData:       boolean
  asOf:          string
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function median(arr: number[]): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function round2(n: number): number { return Math.round(n * 100) / 100 }

// ── 연간 평균 주가 (Yahoo 월봉 5yr) ─────────────────────────────────────────
async function fetchAnnualAvgPrices(ticker: string, market: string): Promise<Record<number, number>> {
  try {
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1mo&events=none`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    )
    if (!r.ok) return {}
    const j = await r.json()
    const ts: number[] = j?.chart?.result?.[0]?.timestamp ?? []
    const closes: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const byYear: Record<number, number[]> = {}
    ts.forEach((t, i) => {
      const c = closes[i]; if (!c || c <= 0) return
      const yr = new Date(t * 1000).getFullYear()
      ;(byYear[yr] ??= []).push(c)
    })
    const result: Record<number, number> = {}
    for (const [yr, cs] of Object.entries(byYear))
      result[+yr] = round2(cs.reduce((s, x) => s + x, 0) / cs.length)
    return result
  } catch { return {} }
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url)
  const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase()
  const market = (url.searchParams.get('market') || 'US').trim().toUpperCase()

  if (!ticker)
    return NextResponse.json({ error: '티커가 필요합니다.' }, { status: 400 })

  if (getAssetType(ticker, '', market) !== 'STOCK')
    return NextResponse.json({ error: '개별 주식만 지원합니다 (ETF·코인·원자재 제외).' }, { status: 400 })

  // 48h 캐시 (역사적 EPS는 자주 바뀌지 않음)
  const cacheKey = `lynch-tracer:${ticker}:${market}`
  const cached = await getCache<TracerResult>(cacheKey, 48 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const empty: TracerResult = {
    ticker, name: ticker, market, currency: market === 'KR' ? 'KRW' : 'USD',
    points: [], medianPer: null, currentPrice: null, currentEps: null,
    currentGap15: null, deficitMode: false, hasData: false,
    asOf: new Date().toISOString(),
  }

  try {
    // ① 연간 EPS + 현재 지표
    // 1순위: /api/financials (US=FMP/Yahoo, KR=DART/Naver) — 제1·2원칙 준수
    // 2순위: fundamentalsTimeSeries 직접 폴백 — quoteSummary schema 실패(IONQ 등) 시 우회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fin: any = null
    let financials: Record<string, { eps: number; operatingProfit: number; revenue: number }> = {}
    let yearKeys: string[] = []

    try {
      const finRes = await fetch(`${selfBase}/api/financials?ticker=${encodeURIComponent(ticker)}&market=${market}`, {
        signal: AbortSignal.timeout(30_000),
      })
      if (finRes.ok) {
        const f = await finRes.json()
        if (f.success) { fin = f; financials = f.financials ?? {}; yearKeys = f.yearKeys ?? [] }
      }
    } catch { /* 폴백으로 진행 */ }

    // /api/financials 실패 → Yahoo fundamentalsTimeSeries 직접 호출 (US only)
    if (!fin && market === 'US') {
      const { default: YahooFinance } = await import('yahoo-finance2')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
      const fts = await yf.fundamentalsTimeSeries(ticker, { period1: '2019-01-01', type: 'annual', module: 'financials' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(fts) ? fts : (fts?.timeSeries ?? [])
      const qs = await yf.quoteSummary(ticker, { modules: ['summaryDetail', 'price', 'defaultKeyStatistics'] }).catch(() => null)
      const curP = qs?.summaryDetail?.regularMarketPrice ?? qs?.summaryDetail?.previousClose ?? null
      const curName = String(qs?.price?.shortName || qs?.price?.longName || ticker)
      fin = { companyName: curName, currentPrice: curP, currency: 'USD' }
      const cy = new Date().getFullYear()
      const allYears: Set<number> = new Set()
      arr.forEach(r => {
        const yr = (r.date instanceof Date ? r.date : new Date(r.date)).getFullYear()
        const e = r.dilutedEPS ?? r.basicEPS ?? null
        const rev = r.totalRevenue ?? null
        if (e !== null) { financials[String(yr)] = { eps: Math.round(e * 100) / 100, operatingProfit: 0, revenue: rev ?? 0 }; allYears.add(yr) }
      })
      yearKeys = Array.from(allYears).sort().map(y => y < cy ? String(y) : String(y))
    }

    if (!fin) return NextResponse.json({ ...empty, error: '재무 데이터를 불러오지 못했습니다.' })

    // 확정 실적 연도만 (E 제외)
    const actualYears = yearKeys.filter(k => !k.endsWith('E'))

    // ② 연간 평균 주가 (Yahoo 월봉)
    const priceByYear = await fetchAnnualAvgPrices(ticker, market)
    // 현재가 추가 (가장 최근 년도 보완)
    const currentYear = new Date().getFullYear()
    if (!priceByYear[currentYear] && fin.currentPrice > 0) priceByYear[currentYear] = fin.currentPrice

    // ③ 역사적 PER 계산 → 5년 중앙값
    const actualPers: number[] = []
    for (const yk of actualYears) {
      const yr = parseInt(yk, 10)
      const eps = financials[yk]?.eps
      const price = priceByYear[yr]
      if (eps && eps > 0 && price && price > 0) {
        const pe = round2(price / eps)
        if (pe > 0 && pe < 500) actualPers.push(pe)   // 이상값 제거
      }
    }
    const medianPer = median(actualPers)

    // ④ TracerPoint 배열 조립 (EPS=0은 미집계 연도 → 건너뜀)
    const points: TracerPoint[] = []
    for (const yk of actualYears) {
      const yr = parseInt(yk, 10)
      const eps = financials[yk]?.eps ?? null
      const price = priceByYear[yr] ?? null
      // EPS가 null이거나 0(미집계)이고 주가도 없으면 해당 연도 제외
      if (eps === null && price === null) continue
      if (eps === 0 && price === null) continue
      const isDeficit = eps !== null && eps < 0
      const lynch15 = (eps !== null && eps > 0) ? round2(eps * 15) : null
      const medianLine = (eps !== null && eps > 0 && medianPer !== null) ? round2(eps * medianPer) : null
      const actualPer = (eps !== null && eps > 0 && price !== null) ? round2(price / eps) : null
      const gap15 = (price !== null && lynch15 !== null) ? round2((price - lynch15) / lynch15 * 100) : null
      const gapMedian = (price !== null && medianLine !== null) ? round2((price - medianLine) / medianLine * 100) : null
      points.push({ year: yr, price, eps: eps === 0 ? null : eps, lynch15, medianLine, actualPer, gap15, gapMedian, isDeficit })
    }
    if (points.length < 2) return NextResponse.json({ ...empty, error: '역사적 데이터가 부족합니다 (최소 2개년 필요).' })

    // ⑤ 현재 지표
    const lastPoint = [...points].filter(p => p.eps !== null).at(-1) ?? null
    const currentPrice = fin.currentPrice ?? null
    const currentEps = lastPoint?.eps ?? null
    const deficitMode = currentEps !== null && currentEps <= 0
    const currentGap15 = (currentPrice && currentEps && currentEps > 0)
      ? round2((currentPrice - currentEps * 15) / (currentEps * 15) * 100) : null

    const result: TracerResult = {
      ticker, name: fin.companyName || ticker, market,
      currency: fin.currency ?? (market === 'KR' ? 'KRW' : 'USD'),
      points, medianPer: medianPer ? round2(medianPer) : null,
      currentPrice, currentEps, currentGap15, deficitMode, hasData: true,
      asOf: new Date().toISOString(),
    }
    await setCache(cacheKey, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.warn('[lynch-earnings-tracer]', (e as Error).message)
    return NextResponse.json({ ...empty, error: '데이터 수집 중 오류가 발생했습니다.' })
  }
}
