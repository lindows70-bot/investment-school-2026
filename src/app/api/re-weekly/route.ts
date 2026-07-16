// ⚡ 주간 아파트 매매가격지수 API — 부동산원 R-ONE(T244183132827305, WK·YYYYWW). 월별 벌집(거래량×가격)보다 빠른 전환점 감지용.
//    2026-06 재기준=100이라 절대 레벨은 신·구 비교 불가 — 변화율(주간·4주·13주)로만 읽음(기준 무관). CLS 맵은 lib/rone 실측.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { roneSeries, RONE_WEEKLY_TBL, RONE_WEEKLY_CLS } from '@/lib/rone'

export interface WeeklyRegion {
  name: string
  latest: number                    // 최신 지수(2026-06=100 재기준)
  w1: number | null                 // 1주 변화율 %
  w4: number | null                 // 4주(≈1개월) 변화율 %
  w13: number | null                // 13주(≈3개월) 변화율 %
  spark: number[]                   // 최근 26주 지수(미니차트)
}
export interface ReWeeklyApi {
  regions: WeeklyRegion[]           // 전국·수도권+17시도, 1주 변화율 내림차순
  series: { t: string; 전국: number | null; 서울: number | null; 수도권: number | null }[]   // ~104주 지수 추이
  asOfWeek: string                  // 'YYYY-WW'
  asOf: string
}

const CACHE_KEY = 're-weekly-v1'
const pc = (a: number, b: number) => Math.round((a / b - 1) * 1000) / 10   // 변화율 소수1
const REGION_ORDER = Object.keys(RONE_WEEKLY_CLS)

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  if (!refresh) {
    const hit = await getCache<ReWeeklyApi>(CACHE_KEY, 24 * 3600_000)
    if (hit) return NextResponse.json(hit, { headers: { 'Cache-Control': 'no-store' } })
  }

  // WRTTIME=YYYYWW — 2년 전 1주차부터(≈104주). 동시성 4로 19계열 수집
  const now = new Date(Date.now() + 9 * 3600_000)
  const start = `${now.getUTCFullYear() - 2}01`
  const end = `${now.getUTCFullYear()}53`
  const names = [...REGION_ORDER]
  const bySeries = new Map<string, { time: string; value: number }[]>()
  const queue = [...names]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const name = queue.shift()
      if (!name) break
      const rows = await roneSeries(RONE_WEEKLY_TBL, RONE_WEEKLY_CLS[name], start, end, '10001', 300, 'WK')
      if (rows.length) bySeries.set(name, rows)
    }
  }))

  const kor = bySeries.get('전국')
  if (!kor || kor.length < 14)
    return NextResponse.json({ error: '주간지수 수집 실패 — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const regions: WeeklyRegion[] = []
  for (const name of names) {
    const rows = bySeries.get(name)
    if (!rows || rows.length < 2) continue
    const v = rows.map(r => r.value)
    const n = v.length
    regions.push({
      name,
      latest: Math.round(v[n - 1] * 100) / 100,
      w1: n >= 2 ? pc(v[n - 1], v[n - 2]) : null,
      w4: n >= 5 ? pc(v[n - 1], v[n - 5]) : null,
      w13: n >= 14 ? pc(v[n - 1], v[n - 14]) : null,
      spark: v.slice(-26).map(x => Math.round(x * 100) / 100),
    })
  }
  regions.sort((a, b) => (b.w1 ?? -999) - (a.w1 ?? -999))

  // 전국·서울·수도권 지수 추이(같은 재기준이라 레벨 비교 가능)
  const chartNames = ['전국', '서울', '수도권'] as const
  const maps = chartNames.map(nm => new Map((bySeries.get(nm) ?? []).map(r => [r.time, r.value])))
  const weeks = Array.from(new Set(chartNames.flatMap(nm => (bySeries.get(nm) ?? []).map(r => r.time)))).sort()
  const series = weeks.map(t => {
    const row: { t: string; 전국: number | null; 서울: number | null; 수도권: number | null } =
      { t: `${t.slice(0, 4)}-${t.slice(4)}`, 전국: null, 서울: null, 수도권: null }
    chartNames.forEach((nm, i) => { const x = maps[i].get(t); if (x != null) row[nm] = Math.round(x * 100) / 100 })
    return row
  })

  const lastT = kor[kor.length - 1].time
  const result: ReWeeklyApi = {
    regions, series,
    asOfWeek: `${lastT.slice(0, 4)}-${lastT.slice(4)}`,
    asOf: new Date().toISOString(),
  }
  // 과반(10개+) 지역 성공 시에만 캐시(부분 실패 박제 방지)
  if (regions.length >= 10) await setCache(CACHE_KEY, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
