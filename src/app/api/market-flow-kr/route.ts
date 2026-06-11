// 🌐 국내 시장 수급 랭킹 API — 외국인/기관 순매수 상위 + 쌍끌이. 일별 캐시(크론 워밍, 콜드는 직접 계산)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { computeMarketFlowKr, latestTradeDate, type MarketFlowKrResult } from '@/lib/marketFlowKr'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const CACHE_KEY = () => `market-flow-kr-v5:${kstDate()}`   // v5: pegSuspect(기저효과) 필드 추가

export async function GET(req: Request) {
  const cached = await getCache<MarketFlowKrResult>(CACHE_KEY(), 24 * 3600_000)
  // 🩹 셀프힐: 네이버 투자자동향 발행 지연으로 크론이 묵은 스냅샷을 잡으면 종일 동결되던 버그.
  //    대표종목(삼성전자) 최신 거래일을 1회 프로브 → 캐시의 dataDate가 그보다 뒤처졌으면 재계산.
  const live = await latestTradeDate()
  if (cached && cached.dataDate && (!live || cached.dataDate >= live))
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'HIT' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const result = await computeMarketFlowKr(base)
  if (result.poolSize > 0) await setCache(CACHE_KEY(), result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store', 'X-Cache': cached ? 'STALE-REFRESH' : 'MISS' } })
}
