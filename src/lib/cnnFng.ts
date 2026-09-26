// CNN 공포·탐욕 지수 1년 — 지금·1년 전(원천 previous_1_year)·연간 최고/최저(값·날짜)를 graphdata 응답에서 읽는 서버 lib
//   원천: production.dataviz.cnn.io/index/fearandgreed/graphdata(/api/cocktail-party 가 받는 것과 같은 응답 — 완전 브라우저 헤더 필수, 418 봇차단)
//   실측(2026-09-27): historical.data 251개(x = epoch ms, UTC 자정 = 미국 날짜), 마지막 두 점이 같은 날(자정·23:59:59)로 겹친다 → 날짜별 마지막 값.
//   ⚠️ 실패하면 숫자를 지어내지 않는다(cocktail-party 는 실패 시 계산값·중립 50 을 준다 — 여기는 그러지 않는다).
import { type Part, okPart, failPart, num, getJson, highLow, addDaysYmd } from './marketBoardShared'

export interface CnnFngYear {
  now: number
  rating: string | null
  yearAgo: number | null                        // 원천 previous_1_year
  yearHigh: { v: number; date: string } | null  // 기록 기간(range) 최고(같은 값이면 가장 최근 날짜) — 지금 값 포함
  yearLow: { v: number; date: string } | null
  points: number                                // 고저 계산에 쓴 날 수
  /** 고저를 잰 실제 기간. fullYear=false 면 원천 기록이 1년에 못 미친다 — 화면은 '연간' 대신 from~to 를 적는다 */
  range: { from: string; to: string; fullYear: boolean } | null
  asOf: string | null                           // 원천 fear_and_greed.timestamp
}

/** graphdata → 1년 요약. 연간 고저는 최신 날짜에서 365일 안의 일별 값(날짜별 마지막)으로 */
export function parseCnnFngYear(json: unknown): CnnFngYear | null {
  const j = json as { fear_and_greed?: Record<string, unknown>; fear_and_greed_historical?: { data?: unknown } } | null
  const f = j?.fear_and_greed
  const now = num(f?.score)
  if (!f || now == null) return null
  const byDate = new Map<string, number>()
  const data = j?.fear_and_greed_historical?.data
  if (Array.isArray(data)) {
    const rows = (data as { x?: unknown; y?: unknown }[])
      .map(p => ({ x: num(p?.x), y: num(p?.y) }))
      .filter((p): p is { x: number; y: number } => p.x != null && p.y != null)
      .sort((a, b) => a.x - b.x)
    for (const p of rows) byDate.set(new Date(p.x).toISOString().slice(0, 10), p.y)   // 같은 날이면 뒤 값이 덮는다
  }
  // 지금 값(score)을 그날(원천 timestamp 의 UTC 날짜)의 값으로 넣는다 — 이력이 하루 늦게 따라와도
  // '지금이 연간 최고'인 날에 고저가 지금 값을 빠뜨리지 않게(규칙: 지금 값이 이력 같은 날 값을 덮는다)
  const nowDate = typeof f.timestamp === 'string' && Number.isFinite(Date.parse(f.timestamp)) ? new Date(Date.parse(f.timestamp)).toISOString().slice(0, 10) : null
  if (nowDate) byDate.set(nowDate, now)
  const dates = Array.from(byDate.keys()).sort()
  const last = dates[dates.length - 1]
  const from = last ? addDaysYmd(last, -365) : null
  const series = dates.filter(d => from != null && d >= from).map(d => ({ date: d, v: byDate.get(d) as number }))
  const hl = highLow(series)
  // 창의 첫날보다 7일 넘게 늦게 기록이 시작되면 1년치가 아니다(원천이 짧게 줄 때)
  const range = series.length && from
    ? { from: series[0].date, to: series[series.length - 1].date, fullYear: series[0].date <= addDaysYmd(from, 7) }
    : null
  // 정수로 반올림 — /api/cocktail-party(홈 공포·탐욕 카드)가 score 를 Math.round 로 보여준다(같은 값이 화면마다 달라지지 않게)
  const roundI = (v: number) => Math.round(v)
  const ya = num(f.previous_1_year)
  return {
    now: roundI(now), rating: typeof f.rating === 'string' ? f.rating : null,
    yearAgo: ya != null ? roundI(ya) : null,
    yearHigh: hl ? { v: roundI(hl.high.v), date: hl.high.date } : null,
    yearLow: hl ? { v: roundI(hl.low.v), date: hl.low.date } : null,
    points: series.length,
    range,
    asOf: typeof f.timestamp === 'string' ? f.timestamp : null,
  }
}

const CNN_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://edition.cnn.com',
  Referer: 'https://edition.cnn.com/',
}
const SRC = 'cnn fearandgreed graphdata'

export async function fetchCnnFngYear(): Promise<Part<CnnFngYear>> {
  const r = await getJson('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', { headers: CNN_H, timeoutMs: 10000 })
  if (!r.ok) return failPart(r.reason, SRC)
  const p = parseCnnFngYear(r.json)
  if (!p) return failPart('점수 없음', SRC)
  return okPart(p, p.asOf, SRC)
}
