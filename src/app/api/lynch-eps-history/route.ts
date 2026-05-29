/**
 * GET /api/lynch-eps-history
 * ?tickers=NVDA,ETN,000660&markets=US,US,KR&currentPrices=135,402,233000
 *
 * 역할: Phase 3 린치 라인 터미널용 EPS 분기 이력 배치 조회
 *
 * 데이터 소스:
 *   US: /api/financials (Yahoo Finance + FMP 이중 폴백)
 *   KR: /api/financials (Naver + DART 이중 폴백)
 *
 * 반환 포맷: LynchTerminalData 호환
 *   { NVDA: { history: [{date, price, eps},...] }, ... }
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeEpsMode, type EpsMode } from '@/lib/lynchAnalysis'

interface HistoryPoint { date: string; price: number; eps: number }
interface StockResult  {
  name:          string
  multiple:      number
  isKrw:         boolean
  history:       HistoryPoint[]
  // ── EPS 모드 정보 (LynchLineTerminal에서 배지/설명 표시용)
  epsMode:       EpsMode
  badgeText:     string
  badgeColor:    string
  description:   string
  forwardEps:    number   // forwardEPS (없으면 0)
  revenueGrowth: number   // YoY 매출 성장률 %
  currentPs:     number   // 현재 P/S 비율
  error?:        string
}

// 기저 URL (서버 내부 self-call)
function baseUrl(req: NextRequest) {
  const { protocol, host } = new URL(req.url)
  return `${protocol}//${host}`
}

// 분기 레이블 목록 (최근 6분기)
function buildQuarterLabels(): string[] {
  const now  = new Date()
  const year = now.getFullYear()
  const q    = Math.ceil((now.getMonth() + 1) / 3)
  const labels: string[] = []
  for (let i = 5; i >= 0; i--) {
    let qn = q - i
    let yn = year
    while (qn <= 0) { qn += 4; yn-- }
    labels.push(`${String(yn).slice(2)}-Q${qn}`)
  }
  return labels
}

// 분기별 연간(TTM) EPS 배열 생성
// Lynch 공식: fair value = 연간EPS × PER (분기EPS 아님)
// 각 분기 포인트에 "해당 연도의 연간 EPS"를 매핑하여 일관성 유지
function mapAnnualEpsToQuarters(
  annualEps: Record<string, number>,
  quarters:  string[],
): number[] {
  return quarters.map(q => {
    const year       = 2000 + parseInt(q.slice(0, 2))
    const yearStr    = String(year)
    const yearEstStr = `${year}E`
    // 해당 연도 연간 EPS 우선, 없으면 전년도, 없으면 0
    const annual =
      annualEps[yearStr] ??
      annualEps[yearEstStr] ??
      annualEps[String(year - 1)] ??
      0
    return parseFloat(annual.toFixed(4))   // ÷4 하지 않음 — 연간 EPS 그대로 반환
  })
}

// 분기별 가격 추정: 현재가 기준 역산
function estimatePrices(
  currentPrice: number,
  quarters: string[],
): number[] {
  const n = quarters.length
  return quarters.map((_, i) => {
    if (i === n - 1) return currentPrice  // 마지막 = 현재가
    // 과거일수록 낮은 가격 (선형 보간, 마지막에서 최대 25% 할인)
    const factor = 0.75 + (i / (n - 1)) * 0.25
    const estimated = Math.round(currentPrice * factor)
    return estimated
  })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url    = new URL(req.url)
  const base   = baseUrl(req)

  const tickersRaw  = url.searchParams.get('tickers')      ?? ''
  const marketsRaw  = url.searchParams.get('markets')      ?? ''
  const pricesRaw   = url.searchParams.get('currentPrices') ?? ''
  const namesRaw    = url.searchParams.get('names')         ?? ''
  const catsRaw     = url.searchParams.get('categories')    ?? ''
  const pesRaw      = url.searchParams.get('pes')           ?? ''  // dividendMap PE

  const tickers    = tickersRaw.split(',').filter(Boolean)
  const markets    = marketsRaw.split(',')
  const prices     = pricesRaw.split(',').map(Number)
  const names      = namesRaw.split(',')
  const categories = catsRaw.split(',')
  const pes        = pesRaw.split(',').map(Number)  // 종목별 실제 PE

  if (tickers.length === 0) {
    return NextResponse.json({}, { status: 400 })
  }

  const quarters = buildQuarterLabels()

  // 병렬 fetch (모든 종목 동시 조회)
  const results = await Promise.all(
    tickers.map(async (ticker, i): Promise<[string, StockResult]> => {
      const market      = (markets[i] ?? 'US') as 'US' | 'KR'
      const currentPrice = prices[i] ?? 0
      const name        = names[i]    ?? ticker
      const category    = categories[i] ?? ''
      const isKrw       = market === 'KR'

      // 카테고리별 멀티플 (기본값)
      const multipleMap: Record<string, number> = {
        fast_grower: 25, stalwart: 15, slow_grower: 10,
        cyclical: 12, turnaround: 20, asset_play: 12,
      }
      const baseMultiple = multipleMap[category] ?? (isKrw ? 12 : 15)

      try {
        const finRes = await fetch(
          `${base}/api/financials?ticker=${encodeURIComponent(ticker)}&market=${market}`,
          { cache: 'no-store' }
        )
        if (!finRes.ok) throw new Error(`financials ${finRes.status}`)
        const finData = await finRes.json()

        // 연간 EPS 추출 (확정 실적만, 추정치 제외)
        // financials 응답: { financials: { '2023': {eps, ...}, '2024': {eps, ...}, '2025E': {...} } }
        const fin = finData?.financials ?? {}
        const annualEps: Record<string, number> = {}
        Object.entries(fin).forEach(([year, val]) => {
          const eps = (val as { eps?: number })?.eps ?? 0
          if (eps !== 0) annualEps[year] = eps
        })

        // 멀티플 보정: PE/PEG 활용 (EPS 방어 이전에 선언 필요)
        // PE: 클라이언트 dividendMap 우선 → API 응답 → 시장별 기본값
        const clientPe   = pes[i] && pes[i] > 0 ? pes[i] : 0
        const currentPe  = clientPe || finData?.per || (market === 'KR' ? 10 : 20)
        const currentPeg = (finData?.peg ?? finData?.pegRatio ?? 0)

        // ── EPS 이상값 방어 ────────────────────────────────────────────
        // 카테고리별 "주가가 이 EPS일 때 최소 적정 PE"를 기준으로 상한 클램핑
        // 예) cyclical SK하이닉스: PE 최소 4배 → maxEps = 233000/4 = 58,250
        //     fast_grower NVDA:    PE 최소 12배 → maxEps = 135/12 = 11.25
        //     → 58,250보다 큰 EPS(₩298,495)는 데이터 오류로 간주
        const MIN_PE_FLOOR: Record<string, number> = {
          fast_grower: 12, stalwart: 8, slow_grower: 5,
          cyclical: 4,     turnaround: 8, asset_play: 5, na: 8,
        }
        const minPe    = MIN_PE_FLOOR[category] ?? (market === 'KR' ? 4 : 10)
        const maxEps   = currentPrice > 0 ? currentPrice / minPe : Infinity

        Object.keys(annualEps).forEach(yr => {
          const raw = annualEps[yr]
          if (raw < 0) {
            annualEps[yr] = 0         // 적자 → 0 (음수 Lynch Line 방지)
          } else if (raw > maxEps) {
            annualEps[yr] = maxEps    // 이상값 클램핑 (PE < minPe 방지)
          }
        })

        // 연간 EPS를 분기 포인트에 매핑 (Lynch 공식: fair value = 연간EPS × PER)
        const epsArr    = mapAnnualEpsToQuarters(annualEps, quarters)
        const priceArr  = estimatePrices(currentPrice, quarters)
        let finalMultiple = baseMultiple
        if (currentPe > 0 && currentPeg > 0 && currentPeg <= 6) {
          const implied = Math.round(currentPe / currentPeg)
          const cap     = multipleMap[category] ? Math.round(multipleMap[category] * 1.6) : 40
          finalMultiple = Math.max(8, Math.min(cap, implied))
        }

        // ── forwardEPS + 매출 성장률 + P/S 추출 (IonQ·TEM 류 혁신성장 지원)
        const forwardEps    = finData?.forwardEps ?? finData?.nextYearEps ?? 0
        // 매출 성장률: financials YoY 비교
        let revenueGrowth = 0
        const actualRevYears = Object.keys(fin)
          .filter(k => !k.endsWith('E'))
          .sort()
        if (actualRevYears.length >= 2) {
          const latY  = fin[actualRevYears[actualRevYears.length - 1]]?.revenue ?? 0
          const prevY = fin[actualRevYears[actualRevYears.length - 2]]?.revenue ?? 0
          if (prevY > 0 && latY > 0) revenueGrowth = Math.round(((latY - prevY) / prevY) * 100)
        }
        // P/S 비율: marketCap / annualRevenue 추정
        const latestRevenue = fin[actualRevYears[actualRevYears.length - 1]]?.revenue ?? 0
        // latestRevenue는 US=백만달러, KR=억원 단위
        let currentPs = 0
        if (latestRevenue > 0 && currentPrice > 0) {
          // stock-info 에서 marketCap이 없으므로 P/S는 폴백값으로 제공
          currentPs = finData?.priceToSalesRatio ?? finData?.ps ?? 0
        }

        // ── EPS 모드 판정 (SSOT: lynchAnalysis)
        const latestEps = epsArr[epsArr.length - 1]
        const epsAnalysis = analyzeEpsMode(
          latestEps,
          forwardEps,
          revenueGrowth,
          currentPrice,
          category,
          market,
          currentPs,
        )

        // forwardEPS 기반 턴어라운드 모드면 히스토리 EPS를 forward로 보정
        let finalEpsArr = epsArr
        if (epsAnalysis.mode === 'forward' && epsAnalysis.eps > 0) {
          // 마지막 분기만 forwardEPS로 교체 (이전 분기는 그대로)
          finalEpsArr = [...epsArr.slice(0, -1), epsAnalysis.eps]
        }

        const history: HistoryPoint[] = quarters.map((date, j) => ({
          date,
          price: priceArr[j],
          eps:   finalEpsArr[j],
        }))

        history.push({
          date:  '현재',
          price: currentPrice,
          eps:   finalEpsArr[finalEpsArr.length - 1],
        })

        return [ticker, {
          name,
          multiple:      epsAnalysis.multiple || finalMultiple,
          isKrw,
          history,
          epsMode:       epsAnalysis.mode,
          badgeText:     epsAnalysis.badgeText,
          badgeColor:    epsAnalysis.badgeColor,
          description:   epsAnalysis.description,
          forwardEps,
          revenueGrowth,
          currentPs,
        }]

      } catch (err) {
        return [ticker, {
          name,
          multiple: baseMultiple,
          isKrw,
          history:       [],
          epsMode:       'loss' as EpsMode,
          badgeText:     '데이터 오류',
          badgeColor:    'text-zinc-400 bg-zinc-800 border-zinc-700',
          description:   '재무 데이터를 가져오는 중 오류가 발생했습니다.',
          forwardEps:    0,
          revenueGrowth: 0,
          currentPs:     0,
          error: (err as Error).message,
        }]
      }
    })
  )

  const response: Record<string, StockResult> = Object.fromEntries(results)
  return NextResponse.json(response)
}
