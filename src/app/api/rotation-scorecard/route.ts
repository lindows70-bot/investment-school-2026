// ⏱️ 로테이션 시계 성적표 API — 전향 적립된 사분면 이력을 4규칙(A/B/C/D)으로 채점(공개·6h 캐시)
//   소급 백필 없음(오늘부터의 기록만) · 채점 프록시는 lib SSOT(SECTOR_PROXY) · 자세한 설계: docs/rotation-scorecard
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles } from '@/lib/techChartData'
import { ROT_QUAD_HIST_KEY, SECTOR_PROXY, ensureTodaySnapshot, computeScorecard, type QuadSnapshot, type ScorecardResult } from '@/lib/rotationScorecard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface RotScorecardApi extends ScorecardResult { asOf: string }

export async function GET() {
  const cacheKey = `rot-scorecard-v1:${kstDate()}`
  const cached = await getCache<RotScorecardApi>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  await ensureTodaySnapshot()   // 오늘 로테이션 캐시가 있으면 오늘 몫을 적립(self-heal — 워밍 경로 누락 대비)
  const hist = (await getCache<QuadSnapshot[]>(ROT_QUAD_HIST_KEY, 3650 * 86400_000)) ?? []
  if (!hist.length) {
    return NextResponse.json(
      { error: 'no_history', note: '아직 적립된 스냅샷이 없습니다 — 로테이션 시계가 오늘 계산을 마치면 1일차가 쌓입니다.' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },   // 실패가 아니라 '적립 전' 상태 — 200 으로 구분
    )
  }

  // 채점 프록시 시세(기존 공유 캔들 캐시 재사용 — 신규 수집 0)
  const closes: Record<string, { dates: string[]; closes: number[] }> = {}
  await Promise.all(Object.values(SECTOR_PROXY).map(async ({ sym }) => {
    try {
      const d = await getTechCandles(sym, 'US', 'D')
      if (d?.length) closes[sym] = { dates: d.map(x => x.date), closes: d.map(x => x.close) }
    } catch { /* 해당 프록시만 제외 — computeScorecard 가 결측을 건너뛴다 */ }
  }))

  const sc = computeScorecard(hist, closes)
  if (!sc) return NextResponse.json({ error: 'compute_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  const out: RotScorecardApi = { ...sc, asOf: new Date().toISOString() }
  await setCache(cacheKey, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
