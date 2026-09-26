// 원·달러 환율 추이 — 하나은행 매매기준율(네이버 FX_USDKRW 일별 고시)로 1달·3달·1년 시계열과 기간 고점·저점(값·날짜)을 만드는 서버 lib
//   원천: stock.naver.com/api/securityService/marketindex/exchange/FX_USDKRW/prices?page=N&pageSize=60(최대 60 — 넘기면 400)
//   실측(2026-09-27): 한 쪽 60행 = 영업일 60일(주말·휴일 없음), 5쪽이면 2025-07 까지 → 1년치를 덮는다.
//   ⚠️ 이 lib 는 추이 표시용이다. 앱 환율 SSOT(/api/exchange-rate)는 바꾸지 않는다(4단계에서 전환).
//   ⚠️ 기간은 줄 수가 아니라 **날짜**로 자른다(인덱스 산술 금지 — CPI 13개월 차분 사고).
import { type Part, okPart, failPart, num, getJson, highLow, addMonthsYmd } from './marketBoardShared'

export interface FxDay { date: string; v: number }
export interface FxRange {
  from: string; to: string
  points: FxDay[]                                       // 날짜 오름차순
  high: { v: number; date: string } | null              // 같은 값이면 가장 최근 날짜
  low: { v: number; date: string } | null
}
export interface FxTrend {
  latest: { date: string; v: number; change: number | null; changePct: number | null }   // 고시일 = latest.date
  m1: FxRange; m3: FxRange; y1: FxRange
}

/** 쪽별 응답(배열들) → 날짜 오름차순·중복 제거 일별 종가 */
export function parseFxPages(pages: unknown[]): FxDay[] {
  const byDate = new Map<string, number>()
  for (const pg of pages) {
    if (!Array.isArray(pg)) continue
    for (const r of pg as Record<string, unknown>[]) {
      const d = typeof r?.localTradedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.localTradedAt) ? r.localTradedAt : null
      const v = num(r?.closePrice)
      if (d && v != null && !byDate.has(d)) byDate.set(d, v)
    }
  }
  return Array.from(byDate.entries()).map(([date, v]) => ({ date, v })).sort((a, b) => (a.date < b.date ? -1 : 1))
}

function rangeOf(rows: FxDay[], latest: string, months: number): FxRange {
  const from = addMonthsYmd(latest, -months)
  const points = rows.filter(r => r.date > from && r.date <= latest)   // (from, latest] — 1달 전 그날은 빼고 다음 날부터
  const hl = highLow(points)
  return { from, to: latest, points, high: hl?.high ?? null, low: hl?.low ?? null }
}

/** 일별 → 최신값·전일 대비·1달·3달·1년. 1년 구간의 첫 날이 원천 범위 안에 없으면(쪽을 덜 받음) null — 짧은 기간을 1년이라 부르지 않는다 */
export function buildFxTrend(rows: FxDay[]): FxTrend | null {
  if (!rows.length) return null
  const last = rows[rows.length - 1]
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null
  const y1 = rangeOf(rows, last.date, 12)
  if (rows[0].date > y1.from) return null
  const change = prev ? Math.round((last.v - prev.v) * 100) / 100 : null
  return {
    latest: { date: last.date, v: last.v, change, changePct: prev && prev.v ? Math.round((last.v - prev.v) / prev.v * 10000) / 100 : null },
    m1: rangeOf(rows, last.date, 1), m3: rangeOf(rows, last.date, 3), y1,
  }
}

const SRC = 'naver FX_USDKRW prices(하나은행 매매기준율)'
export async function fetchFxTrend(): Promise<Part<FxTrend>> {
  const pages = await Promise.all([1, 2, 3, 4, 5].map(p =>
    getJson(`https://stock.naver.com/api/securityService/marketindex/exchange/FX_USDKRW/prices?page=${p}&pageSize=60`)))
  const bad = pages.find(p => !p.ok)
  if (bad && !bad.ok) return failPart(bad.reason, SRC)   // 한 쪽이라도 빠지면 1년 고저가 틀린다 — 부분 결과를 내지 않는다
  const rows = parseFxPages(pages.map(p => (p.ok ? p.json : null)))
  const t = buildFxTrend(rows)
  if (!t) return failPart(rows.length ? '1년치가 모자람' : '환율 행 없음', SRC)
  return okPart(t, t.latest.date, SRC)
}
