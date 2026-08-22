// 🏆 전세계 자산 시가총액 순위 API — 계산은 lib/assetRanking.ts SSOT.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildAssetRanking, ASSET_RANK_KEY, type AssetRankingResult } from '@/lib/assetRanking'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  // 시총은 장중 계속 바뀌므로 하루 단위가 아니라 시간 단위로 캐시한다
  const hourKey = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 13)
  const key = ASSET_RANK_KEY(hourKey)
  const cached = await getCache<AssetRankingResult>(key, 3 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const r = await buildAssetRanking().catch(() => null)
  if (!r) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  await setCache(key, r)
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
