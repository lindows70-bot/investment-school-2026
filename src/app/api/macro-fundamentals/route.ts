/**
 * GET /api/macro-fundamentals
 * ?tickers=NVDA,ETN,000660&markets=US,US,KR
 *
 * Phase 2 DynamicCategorySwitcher용 실제 재무 기초 데이터 배치 조회
 *
 * 데이터 소스 (100% 실데이터, mock 없음):
 *   epsGrowth     : /api/financials → YoY EPS 증감률 (실제 연간 EPS 비교)
 *   revenueGrowth : /api/financials → YoY 매출 증감률
 *   debtRatio     : /api/stock-info → totalDebt/totalEquity (US: FMP, KR: Naver)
 *   divYield      : /api/stock-info → dividendYield
 *   netCashRatio  : /api/stock-info → netCash/marketCap 추정
 *   correlation   : 섹터·시장 기반 기본값 (공개 API 없음 → 허용 추정)
 */

import { NextRequest, NextResponse } from 'next/server'

function baseUrl(req: NextRequest) {
  const { protocol, host } = new URL(req.url)
  return `${protocol}//${host}`
}

// YoY 성장률 계산 (두 연도의 값 비교)
function yoyGrowth(current: number, prev: number): number {
  if (!prev || prev === 0) return 0
  return Math.round(((current - prev) / Math.abs(prev)) * 100)
}

// 섹터/시장 기반 매크로 상관계수 (공개 실시간 API 없음 → 근사값)
// 반도체·철강·화학=0.85, 에너지·인프라=0.65, IT플랫폼=0.45, 바이오·소프트=0.3
function estimateCorrelation(market: string, category: string | null): number {
  if (market === 'KR') {
    if (category === 'cyclical') return 0.85
    return 0.70
  }
  if (category === 'cyclical') return 0.60
  if (category === 'turnaround') return 0.50
  if (category === 'stalwart') return 0.45
  return 0.35
}

interface FundamentalResult {
  ticker:        string
  name:          string
  // ⚠️ null = 조회 실패 = '데이터 없음'. 지어낸 기본값으로 채우지 마라(2026-08-30 감사).
  epsGrowth:     number | null   // % — /api/financials YoY 실제값
  revenueGrowth: number | null   // % — /api/financials YoY 실제값
  debtRatio:     number | null   // % — /api/stock-info 실제값
  divYield:      number          // % — /api/stock-info 실제값 (없으면 0 = 무배당)
  netCashRatio:  number | null   // % — 실측 실패 시 null
  correlation:   number          // 0-1 — ⚠️ 실측 아님, estimateCorrelation 앱 추정 테이블
  dataQuality:   'real' | 'partial' | 'estimated'  // 데이터 품질 표시
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url     = new URL(req.url)
  const base    = baseUrl(req)

  const tickersRaw   = url.searchParams.get('tickers')    ?? ''
  const marketsRaw   = url.searchParams.get('markets')    ?? ''
  const namesRaw     = url.searchParams.get('names')      ?? ''
  const catsRaw      = url.searchParams.get('categories') ?? ''

  const tickers    = tickersRaw.split(',').filter(Boolean)
  const markets    = marketsRaw.split(',')
  const names      = namesRaw.split(',').map(n => { try { return decodeURIComponent(n) } catch { return n } })
  const categories = catsRaw.split(',')

  if (!tickers.length) return NextResponse.json({}, { status: 400 })

  const results = await Promise.all(
    tickers.map(async (ticker, i): Promise<[string, FundamentalResult]> => {
      const market   = markets[i] ?? 'US'
      const name     = decodeURIComponent(names[i] ?? ticker)
      const category = categories[i] ?? null

      // ⚠️ 2026-08-30 감사 — 예전엔 15·12·60/50·10 같은 **지어낸 기본값**이 조회 실패 시 그대로 발동해
      //    화면에 실측처럼 렌더됐다(⛔ 출처 없는 수치 금지). 없으면 null 로 두고 화면이 '데이터 없음'을 그린다.
      let epsGrowth: number | null      = null
      let revenueGrowth: number | null  = null
      let debtRatio: number | null      = null
      let divYield                      = 0
      let netCashRatio: number | null   = null
      let dataQuality: FundamentalResult['dataQuality'] = 'estimated'

      try {
        // ── 1. /api/financials → EPS·매출 YoY 성장률 (실데이터)
        const finRes = await fetch(
          `${base}/api/financials?ticker=${encodeURIComponent(ticker)}&market=${market}`,
          { cache: 'no-store' }
        )
        if (finRes.ok) {
          const finData = await finRes.json()
          const fin: Record<string, { eps: number; revenue: number }> = finData?.financials ?? {}

          // 확정 연도만 (추정치 'E' 제외) → 최근 2개년 비교
          const actualYears = Object.keys(fin)
            .filter(k => !k.endsWith('E') && fin[k].eps !== 0)
            .sort()

          if (actualYears.length >= 2) {
            const latest = actualYears[actualYears.length - 1]
            const prev   = actualYears[actualYears.length - 2]
            const epsYoY = yoyGrowth(fin[latest].eps,     fin[prev].eps)
            const revYoY = yoyGrowth(fin[latest].revenue, fin[prev].revenue)
            if (Math.abs(epsYoY) <= 500) epsGrowth     = epsYoY     // 500% 초과 이상값 제외
            if (Math.abs(revYoY) <= 300) revenueGrowth = revYoY
            dataQuality = 'real'
          }
        }
      } catch { /* silent */ }

      try {
        // ── 2. /api/stock-info → earningsGrowth(실제 YoY) + 배당수익률 (실데이터)
        const infoRes = await fetch(
          `${base}/api/stock-info?ticker=${encodeURIComponent(ticker)}&market=${market}`,
          { cache: 'no-store' }
        )
        if (infoRes.ok) {
          const info = await infoRes.json()
          const f = info?.fundamentals ?? info

          // ★ earningsGrowth: Yahoo Finance 실제 YoY EPS 증가율 (소수점 → %)
          //   financials API 값과 교차 검증하여 더 합리적인 값 채택
          if (typeof f?.earningsGrowth === 'number' && isFinite(f.earningsGrowth)) {
            const stockInfoEps = Math.round(Math.abs(f.earningsGrowth) * 100)
            // 두 소스 중 절대값이 더 작은 값을 우선 (이상값 방어)
            if (epsGrowth == null || stockInfoEps < Math.abs(epsGrowth) || dataQuality !== 'real') {
              epsGrowth   = f.earningsGrowth >= 0 ? stockInfoEps : -stockInfoEps
              dataQuality = 'real'
            }
          }

          // 배당수익률 (실데이터)
          if (typeof f?.dividendYield === 'number' && f.dividendYield > 0) {
            divYield = parseFloat((f.dividendYield < 1 ? f.dividendYield * 100 : f.dividendYield).toFixed(2))
          }

          // 부채비율: debtToEquity 또는 PBR 기반 추정
          const dte = f?.debtToEquity ?? f?.debtEquityRatio
          if (typeof dte === 'number' && dte > 0 && dte < 2000) {
            debtRatio = Math.round(dte > 10 ? dte : dte * 100)
            dataQuality = dataQuality === 'real' ? 'real' : 'partial'
          }

          // 순현금비율: 현금/시총
          const cash      = f?.totalCash ?? f?.cashAndEquivalents ?? 0
          const marketCap = f?.marketCap ?? 0
          if (cash > 0 && marketCap > 0) {
            netCashRatio = Math.round((cash / marketCap) * 100)
          }
        }
      } catch { /* silent */ }

      return [ticker, {
        ticker,
        name,
        epsGrowth,
        revenueGrowth,
        debtRatio,
        divYield,
        netCashRatio,
        correlation: estimateCorrelation(market, category),
        dataQuality,
      }]
    })
  )

  return NextResponse.json(Object.fromEntries(results))
}
