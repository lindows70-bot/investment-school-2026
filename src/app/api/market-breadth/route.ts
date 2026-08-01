// 📊 시장 폭 API — 유니버스 breadth 시계열(일별 캐시·크론 09:35 워밍·검색기 캔들 편승)
//    ⛔ 점수·추천 미반영(관측 전용). 유효 종목 60% 미만이면 캐시 박제 금지.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { computeMarketBreadth, BREADTH_KEY, type BreadthResult } from '@/lib/marketBreadth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const key = BREADTH_KEY(kstDate())

  if (!refresh) {
    const cached = await getCache<BreadthResult>(key, 24 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
    // 오늘 캐시가 없으면 최근 3일 폴백(장 시작 전 등) — 재계산은 백그라운드 크론 담당
    for (let back = 1; back <= 3; back++) {
      const d = new Date(Date.now() + 9 * 3600_000 - back * 86_400_000).toISOString().slice(0, 10)
      const prev = await getCache<BreadthResult>(BREADTH_KEY(d), 4 * 86_400_000)
      if (prev) return NextResponse.json(prev, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  const result = await computeMarketBreadth()
  if (!result) return NextResponse.json({ error: 'universe cold' }, { status: 503 })

  // 부분실패 박제 금지 — 유효 60% 이상일 때만 캐시
  if (result.okCount >= result.scanned * 0.6) await setCache(key, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
