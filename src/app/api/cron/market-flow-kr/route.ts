// 국내 시장 수급 랭킹 일별 사전계산 — 장 마감 후 1회 풀 전체 수집해 캐시 워밍
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { MARKET_FLOW_KR_KEY, computeMarketFlowKr } from '@/lib/marketFlowKr'
import { cronUnauthorized } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const denied = cronUnauthorized(req); if (denied) return denied   // fail-closed(비밀값이 비면 통과였다 · ?secret= 은 로그에 남아 폐지)
  const t0 = Date.now()
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const result = await computeMarketFlowKr(base)
  const key = MARKET_FLOW_KR_KEY(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10))
  if (result.poolSize > 0) await setCache(key, result)
  const top = [...result.entries].sort((a, b) => b.foreign.d1 - a.foreign.d1).slice(0, 3).map(e => e.name)
  return NextResponse.json(
    { ok: true, poolSize: result.poolSize, foreignTop: top, ms: Date.now() - t0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
