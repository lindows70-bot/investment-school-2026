// 🏦 COFIX API — 계산·파싱은 lib/cofix.ts SSOT.
//    월 1회 공시(익월 15일 전후)라 하루 한 번이면 충분하다.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildCofix, COFIX_KEY, type CofixResult } from '@/lib/cofix'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const key = COFIX_KEY
  const cached = await getCache<CofixResult>(key, 12 * 3600_000, { sameKstDay: true })   // KST 기준일 — 날짜가 바뀌면 새로
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const r = await buildCofix().catch(() => null)
  // 스크래핑 실패(페이지 구조 변경 등)를 캐시하면 하루짜리 빈 카드가 된다 — 실패는 캐시하지 않는다
  if (!r) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  await setCache(key, r)
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
