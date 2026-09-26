// 미국 주요 지표(CPI·고용보고서·PCE) 발표일을 FRED 공식 일정에서 읽어 한국 시각(밤 9:30/10:30)으로 바꾸는 순수 함수 — 시계를 안 본다

/** FRED release_id — 2026-09-26 실측: 10 "Consumer Price Index" · 50 "Employment Situation" · 54 "Personal Income and Outlays"(PCE 가 여기 실린다) */
export const MACRO_RELEASES = [
  { id: 10, kind: 'CPI', label: '미국 CPI(소비자물가)' },
  { id: 50, kind: 'JOBS', label: '미국 고용보고서' },
  { id: 54, kind: 'PCE', label: '미국 PCE 물가' },
] as const

export type MacroKind = (typeof MACRO_RELEASES)[number]['kind']

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' 가 실제 달력 날짜인지(2026-02-30 같은 값 거름) */
function isYmd(s: unknown): s is string {
  if (typeof s !== 'string' || !YMD.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === s
}

/** 그 해 month(1~12)의 n번째 일요일 — 일(day of month) */
function nthSunday(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()   // 0 = 일요일
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7
}

/** 그 미국 날짜 아침 8:30(동부)에 서머타임인가 — 미국 규칙: 3월 둘째 일요일 02:00 시작 ~ 11월 첫째 일요일 02:00 종료.
 *  8:30 은 02:00 뒤이므로 시작일 당일은 서머타임, 종료일 당일은 표준시다 */
export function usEasternIsDst(dateUs: string): boolean {
  const [y, m, d] = dateUs.split('-').map(Number)
  const start = nthSunday(y, 3, 2)
  const end = nthSunday(y, 11, 1)
  if (m < 3 || m > 11) return false
  if (m > 3 && m < 11) return true
  if (m === 3) return d >= start
  return d < end   // 11월
}

/** 미국 동부 8:30 발표 → 한국 시각. 8:30 EDT(UTC−4) = 12:30 UTC = 21:30 KST, 8:30 EST(UTC−5) = 13:30 UTC = 22:30 KST — 둘 다 같은 날짜 */
export function releaseKstTime(dateUs: string): { kstDate: string; kstTime: '21:30' | '22:30' } {
  return { kstDate: dateUs, kstTime: usEasternIsDst(dateUs) ? '21:30' : '22:30' }
}

/** FRED /fred/release/dates 응답 → 날짜 목록(오름차순·중복 없음). 모양이 틀리거나 날짜가 하나라도 이상하면 null(못 읽음) */
export function parseReleaseDates(json: unknown): string[] | null {
  if (json == null || typeof json !== 'object') return null
  const rows = (json as { release_dates?: unknown }).release_dates
  if (!Array.isArray(rows)) return null
  const out: string[] = []
  for (const r of rows) {
    const d = r != null && typeof r === 'object' ? (r as { date?: unknown }).date : undefined
    if (!isYmd(d)) return null
    out.push(d)
  }
  return Array.from(new Set(out)).sort()
}

export type ReleaseClass = { kind: 'ok'; dates: string[] } | { kind: 'unscheduled' }

/** 읽어낸 날짜 → 오늘(UTC) 이후가 있으면 ok, 없으면 unscheduled(FRED 에 다음 일정이 아직 안 올라온 것 — 못 읽은 것과 다르다).
 *  UTC 오늘로 자르는 이유: 한국 오늘 ≥ UTC 오늘이라 한국 날짜 기준 오늘 발표를 놓치지 않는다. 지난 것은 화면이 한국 오늘로 한 번 더 거른다 */
export function classifyRelease(dates: string[], todayUtc: string): ReleaseClass {
  const next = dates.filter(d => d >= todayUtc)
  return next.length > 0 ? { kind: 'ok', dates: next } : { kind: 'unscheduled' }
}
