// 📋 미국 스마트머니 성적표 API — 적립된 목록을 20·60거래일로 채점(시장 SPY 초과분 포함). 12h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { gradeUsm, USM_GRADE_KEY } from '@/lib/usSmartHistory'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const key = USM_GRADE_KEY(kstDate())
  if (!refresh) { const c = await getCache<Awaited<ReturnType<typeof gradeUsm>>>(key, 12 * 3600_000); if (c) return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store' } }) }
  const out = await gradeUsm()
  await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
