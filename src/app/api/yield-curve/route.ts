// 📐 수익률곡선·역전 경보 API — **가볍게** 유지한다(대시보드·브리핑 배너가 매번 호출).
//   계산은 lib/yieldCurve.ts SSOT. 채권 페이지의 무거운 것(상관·인하사이클)은 /api/bonds 로 분리.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildYieldCurve, YIELD_CURVE_KEY, type YieldCurveResult } from '@/lib/yieldCurve'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const dateKey = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)   // KST 기준일
  const key = YIELD_CURVE_KEY(dateKey)
  const cached = await getCache<YieldCurveResult>(key, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const r = await buildYieldCurve().catch(() => null)
  // 부분실패(FRED 미응답)를 캐시하면 하루짜리 빈 배너가 된다 — 실패는 캐시하지 않는다
  if (!r) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  await setCache(key, r)
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
