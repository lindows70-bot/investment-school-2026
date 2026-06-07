// 🌐 국내 시장 수급 랭킹 API — 외국인/기관 순매수 상위 + 쌍끌이. 일별 캐시(크론 워밍, 콜드는 직접 계산)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { computeMarketFlowKr, type MarketFlowKrResult } from '@/lib/marketFlowKr'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const CACHE_KEY = () => `market-flow-kr-v2:${kstDate()}`

export async function GET(req: Request) {
  const cached = await getCache<MarketFlowKrResult>(CACHE_KEY(), 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const result = await computeMarketFlowKr(base)
  if (result.poolSize > 0) await setCache(CACHE_KEY(), result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
