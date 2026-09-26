// 미국 CPI·고용보고서·PCE 다음 발표일(FRED 공식 일정) → 한국 시각 — 공개 데이터만, 부분 실패는 캐시하지 않는다
import { NextResponse } from 'next/server'
import { MACRO_RELEASES, parseReleaseDates, releaseKstTime, type MacroKind } from '@/lib/macroReleases'

export const dynamic = 'force-dynamic'

export interface MacroReleaseEvent { kind: MacroKind; label: string; dateUs: string; kstDate: string; kstTime: '21:30' | '22:30' }
export interface MacroReleasesResp { events: MacroReleaseEvent[]; failed: MacroKind[]; asOf: string }

const TTL_MS = 12 * 3600_000
let memo: { at: number; body: MacroReleasesResp } | null = null

/** 한 발표의 앞으로 날짜들. 실패·빈 목록 = null — 이 세 지표는 매달 나오므로 빈 목록은 '일정 없음'이 아니라 못 읽은 것이다 */
async function fetchDates(id: number, key: string, fromUs: string): Promise<string[] | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${id}&api_key=${key}&file_type=json`
      + `&include_release_dates_with_no_data=true&realtime_start=${fromUs}&sort_order=asc&limit=6`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return null
    const dates = parseReleaseDates(await r.json())
    return dates && dates.length > 0 ? dates : null
  } catch { return null }
}

export async function GET() {
  if (memo && Date.now() - memo.at < TTL_MS) return NextResponse.json(memo.body)

  const key = process.env.FRED_API_KEY
  // 한국 날짜가 미국 날짜보다 하루 앞설 수 있다 — 하루 전 UTC 날짜부터 받고, 지난 것은 화면이 오늘(KST)로 거른다
  const fromUs = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10)
  const results = await Promise.all(MACRO_RELEASES.map(r => key ? fetchDates(r.id, key, fromUs) : Promise.resolve(null)))

  const events: MacroReleaseEvent[] = []
  const failed: MacroKind[] = []
  MACRO_RELEASES.forEach((rel, i) => {
    const dates = results[i]
    if (dates == null) { failed.push(rel.kind); return }
    for (const d of dates) events.push({ kind: rel.kind, label: rel.label, dateUs: d, ...releaseKstTime(d) })
  })
  events.sort((a, b) => a.kstDate < b.kstDate ? -1 : a.kstDate > b.kstDate ? 1 : 0)

  const body: MacroReleasesResp = { events, failed, asOf: new Date().toISOString() }
  if (failed.length === 0) memo = { at: Date.now(), body }   // 부분 실패를 12시간 박제하지 않는다 — 다음 요청이 다시 시도
  return NextResponse.json(body)
}
