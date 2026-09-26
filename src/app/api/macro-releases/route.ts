// 미국 CPI·고용보고서·PCE 다음 발표일(FRED 공식 일정) → 한국 시각 — 공개 데이터만, 부분 실패는 캐시하지 않는다
import { NextResponse } from 'next/server'
import { MACRO_RELEASES, classifyRelease, parseReleaseDates, releaseKstTime, type MacroKind } from '@/lib/macroReleases'

export const dynamic = 'force-dynamic'

export interface MacroReleaseEvent { kind: MacroKind; label: string; dateUs: string; kstDate: string; kstTime: '21:30' | '22:30' }
/** failed = 요청·해석 실패(못 가져옴) · unscheduled = 잘 읽었지만 FRED 에 앞으로 날짜가 아직 없음(연말에 다음 해 일정이 늦게 올라온다) */
export interface MacroReleasesResp { events: MacroReleaseEvent[]; failed: MacroKind[]; unscheduled: MacroKind[]; asOf: string }

const TTL_CLEAN_MS = 12 * 3600_000
const TTL_UNSCHEDULED_MS = 6 * 3600_000   // 다음 일정이 곧 올라올 수 있어 짧게
let memo: { at: number; ttl: number; body: MacroReleasesResp } | null = null

/** 한 발표의 날짜들. 요청·해석 실패 = null. 빈 목록은 실패가 아니다(분류는 classifyRelease) */
async function fetchDates(id: number, key: string, fromUtc: string): Promise<string[] | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${id}&api_key=${key}&file_type=json`
      + `&include_release_dates_with_no_data=true&realtime_start=${fromUtc}&sort_order=asc&limit=6`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return null
    return parseReleaseDates(await r.json())
  } catch { return null }
}

export async function GET() {
  if (memo && Date.now() - memo.at < memo.ttl) return NextResponse.json(memo.body)

  const key = process.env.FRED_API_KEY
  // UTC 오늘부터 — 한국 오늘 ≥ UTC 오늘이라 한국 날짜로 오늘인 발표를 놓치지 않는다(지난 것은 화면이 한국 오늘로 거른다)
  const todayUtc = new Date().toISOString().slice(0, 10)
  const results = await Promise.all(MACRO_RELEASES.map(r => key ? fetchDates(r.id, key, todayUtc) : Promise.resolve(null)))

  const events: MacroReleaseEvent[] = []
  const failed: MacroKind[] = []
  const unscheduled: MacroKind[] = []
  MACRO_RELEASES.forEach((rel, i) => {
    const dates = results[i]
    if (dates == null) { failed.push(rel.kind); return }
    const c = classifyRelease(dates, todayUtc)
    if (c.kind === 'unscheduled') { unscheduled.push(rel.kind); return }
    for (const d of c.dates) events.push({ kind: rel.kind, label: rel.label, dateUs: d, ...releaseKstTime(d) })
  })
  events.sort((a, b) => a.kstDate < b.kstDate ? -1 : a.kstDate > b.kstDate ? 1 : 0)

  const body: MacroReleasesResp = { events, failed, unscheduled, asOf: new Date().toISOString() }
  // 실패가 섞이면 캐시하지 않는다(다음 요청이 다시 시도) · 일정 미게시만 있으면 짧게
  if (failed.length === 0) memo = { at: Date.now(), ttl: unscheduled.length > 0 ? TTL_UNSCHEDULED_MS : TTL_CLEAN_MS, body }
  return NextResponse.json(body)
}
