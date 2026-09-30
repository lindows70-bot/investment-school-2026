// 저울 보조 재료(FRED) — ① 물가 뺀 국채 이자(DFII10)의 지난 10년 월평균: 채권·금 ② 칩의 비교 기준 · ② M2 전년동월비(units=pc1): 코인 ③ 문장
//   2026-09-30 실측: DFII10 은 2003-01 부터 월평균 285개 · 10년(2016-09~2026-08) 평균 0.77% vs 지금 2.83% · M2SL pc1 최신 2026-08 = 5.66%(월간, 약 4주 늦게).
//   기간은 인덱스 산술이 아니라 날짜로 자른다(CPI 13개월 차분 사고의 교훈) · 진행 중인 달은 평균에서 뺀다(부분 달 금지) · 둘 다 하루 캐시(날짜 없는 키)
import { getCache, setCache } from './appCache'

const FRED = 'https://api.stlouisfed.org/fred/series/observations'
const DAY_MS = 86_400_000
export const DFII10_AVG10_KEY = 'dfii10-avg10-v1'
export const M2_YOY_KEY = 'm2-yoy-v1'

export interface Avg10 { v: number; from: string; to: string; n: number }   // 'YYYY-MM' 월 범위 · n = 평균에 든 달 수
export interface M2Yoy { yoy: number; month: string }                        // 전년동월비 % · 기준월 'YYYY-MM'

/** 지난 10년(완결된 120개월) DFII10 월평균의 평균. 100개월 미만이면 null(반쪽 평균을 비교 기준으로 쓰지 않는다) */
export async function fetchDfii10Avg10(): Promise<Avg10 | null> {
  const cached = await getCache<Avg10>(DFII10_AVG10_KEY, 24 * 3600_000)
  if (cached) return cached
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const start = new Date(Date.now() - (10 * 365 + 60) * DAY_MS).toISOString().slice(0, 10)
    const r = await fetch(`${FRED}?series_id=DFII10&api_key=${key}&file_type=json&frequency=m&aggregation_method=avg&observation_start=${start}`,
      { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return null
    const j = await r.json()
    const thisMonth = new Date().toISOString().slice(0, 7)
    const rows = ((j?.observations ?? []) as { date: string; value: string }[])
      .map(o => ({ m: o.date.slice(0, 7), v: parseFloat(o.value) }))
      .filter(o => Number.isFinite(o.v) && o.m < thisMonth)   // 진행 중인 달 제외
      .slice(-120)
    if (rows.length < 100) return null
    const out: Avg10 = { v: Math.round(rows.reduce((a, o) => a + o.v, 0) / rows.length * 100) / 100, from: rows[0].m, to: rows[rows.length - 1].m, n: rows.length }
    await setCache(DFII10_AVG10_KEY, out)
    return out
  } catch { return null }
}

/** M2 전년동월비 — FRED 가 계산한 pc1 의 최신 한 점(기준월 병기) */
export async function fetchM2Yoy(): Promise<M2Yoy | null> {
  const cached = await getCache<M2Yoy>(M2_YOY_KEY, 24 * 3600_000)
  if (cached) return cached
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const r = await fetch(`${FRED}?series_id=M2SL&api_key=${key}&file_type=json&sort_order=desc&limit=3&units=pc1`,
      { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return null
    const j = await r.json()
    const o = ((j?.observations ?? []) as { date: string; value: string }[]).map(x => ({ month: x.date.slice(0, 7), yoy: parseFloat(x.value) })).find(x => Number.isFinite(x.yoy))
    if (!o) return null
    const out: M2Yoy = { yoy: Math.round(o.yoy * 100) / 100, month: o.month }
    await setCache(M2_YOY_KEY, out)
    return out
  } catch { return null }
}
