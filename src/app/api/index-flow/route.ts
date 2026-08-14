// 🌐 코스피 × 외국인 누적 순매수 API — 수급 레이더 상단 오버레이 차트용(일별 캐시)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildIndexFlow, type IndexFlowResult } from '@/lib/indexFlow'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET() {
  const key = `index-flow-v1:${kstDate()}`
  const cached = await getCache<IndexFlowResult>(key, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  const out = await buildIndexFlow()
  if (!out) return NextResponse.json({ error: 'unavailable', note: '외국인 매매동향을 불러오지 못했습니다.' }, { status: 200 })
  await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
