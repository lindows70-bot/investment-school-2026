// 🏛️ CME 비트코인 선물 기관 포지셔닝 API — 계산은 lib/cmeCot.ts SSOT.
//    CFTC 주간 데이터라 하루 한 번이면 충분(공표는 매주 금요일).
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildCmeCot, CME_COT_KEY, type CmeCotResult } from '@/lib/cmeCot'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const dateKey = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)   // KST 기준일
  const key = CME_COT_KEY(dateKey)
  const cached = await getCache<CmeCotResult>(key, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const r = await buildCmeCot().catch(() => null)
  // 부분실패를 캐시하면 하루짜리 빈 카드가 된다 — 실패는 캐시하지 않는다(다음 요청이 스스로 낫는다)
  if (!r) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  await setCache(key, r)
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
