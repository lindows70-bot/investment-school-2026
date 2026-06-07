// 국내 시장 수급 랭킹 일별 사전계산 — 장 마감 후 1회 풀 전체 수집해 캐시 워밍
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { computeMarketFlowKr } from '@/lib/marketFlowKr'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret)
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const t0 = Date.now()
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const result = await computeMarketFlowKr(base)
  const key = `market-flow-kr-v4:${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`
  if (result.poolSize > 0) await setCache(key, result)
  const top = [...result.entries].sort((a, b) => b.foreign.d1 - a.foreign.d1).slice(0, 3).map(e => e.name)
  return NextResponse.json(
    { ok: true, poolSize: result.poolSize, foreignTop: top, ms: Date.now() - t0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
