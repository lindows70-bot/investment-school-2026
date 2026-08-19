// 📅 시장 휴장일 SSOT — KRX(특일 API+거래소 규칙) · NYSE(결정론 규칙). MARKET HOURS 배지가 쓴다.
//
// ⚠️ 왜 필요한가(2026-08-19): 대시보드 MARKET HOURS 가 요일·시각만 봐서 설날·추석·삼일절에도
//    KRX 를 OPEN 으로 표시했다. 학생이 "오늘 왜 호가가 안 움직이지"를 앱이 설명하지 못했다.
//
// · KRX = 공공데이터포털 특일정보(천문연구원 getRestDeInfo) + 근로자의날(5/1) + 연말휴장(12/31,
//   주말이면 직전 평일) — 거래소 휴장 규정. 특일 API 는 대체공휴일·임시공휴일까지 준다(7일 캐시로 반영).
//   🔐 키 미등록(활용신청 전)이면 **fail-open**: null 을 돌려주고 호출부는 기존 요일 판정을 유지한다.
// · NYSE = 고정 규칙 10종(NYSE 규정집 — 정적 참조 데이터 예외, 제1원칙 각주): 신정·MLK(1월 3째월)·
//   대통령의날(2월 3째월)·성금요일(부활절-2일, 그레고리력 계산)·메모리얼(5월 마지막월)·준틴스(6/19)·
//   독립기념일(7/4)·노동절(9월 첫월)·추수감사절(11월 4째목)·성탄절(12/25). 토→금 관측, 일→월 관측
//   (단 1/1 이 토요일이면 전년 12/31 은 열린다 — NYSE 규정).
// · 한계: 조기폐장(반일장) 미반영 — 배지는 개장/휴장만 판정한다. TSE(일본)는 미지원(요일 판정 유지).
import { getCache, setCache } from '@/lib/appCache'

const p2 = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`
/** y-m-d 의 요일(0=일). Date.UTC 라 타임존 무관 */
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()
/** n번째 X요일(1-base) */
function nthDow(y: number, m: number, wd: number, nth: number): string {
  const first = dow(y, m, 1)
  return ymd(y, m, 1 + ((wd - first + 7) % 7) + (nth - 1) * 7)
}
function lastDow(y: number, m: number, wd: number): string {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const last = dow(y, m, lastDay)
  return ymd(y, m, lastDay - ((last - wd + 7) % 7))
}
/** 토→전날(금), 일→다음날(월) 관측. 1/1 토요일은 관측 없음(NYSE 규정) */
function observed(y: number, m: number, d: number): string | null {
  const w = dow(y, m, d)
  if (w === 6) return m === 1 && d === 1 ? null : ymd(y, m, d - 1 >= 1 ? d - 1 : d) // 1/1 토 → 미관측
  if (w === 0) return ymd(y, m, d + 1)
  return ymd(y, m, d)
}
/** 부활절(그레고리력, Anonymous Gregorian algorithm) → 'YYYY-MM-DD' */
function easter(y: number): { m: number; d: number } {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { m: month, d: day }
}

/** NYSE 휴장일(완전 결정론·외부 호출 0) — Set<'YYYY-MM-DD'> */
export function nyseHolidays(year: number): Set<string> {
  const out = new Set<string>()
  const add = (v: string | null) => { if (v) out.add(v) }
  add(observed(year, 1, 1))                       // New Year's Day
  add(nthDow(year, 1, 1, 3))                      // MLK — 1월 3째 월요일
  add(nthDow(year, 2, 1, 3))                      // Washington's Birthday
  const e = easter(year)                           // Good Friday = 부활절 −2일
  const gf = new Date(Date.UTC(year, e.m - 1, e.d) - 2 * 86400_000)
  add(ymd(gf.getUTCFullYear(), gf.getUTCMonth() + 1, gf.getUTCDate()))
  add(lastDow(year, 5, 1))                        // Memorial Day
  add(observed(year, 6, 19))                      // Juneteenth
  add(observed(year, 7, 4))                       // Independence Day
  add(nthDow(year, 9, 1, 1))                      // Labor Day
  add(nthDow(year, 11, 4, 4))                     // Thanksgiving
  add(observed(year, 12, 25))                     // Christmas
  return out
}

export interface KrHolidayInfo { dates: string[]; names: Record<string, string> }

/** KRX 휴장일 — 특일 API(7일 캐시) + 근로자의날 + 연말휴장. 키 미등록·API 실패 시 null(fail-open) */
export async function krxHolidays(year: number): Promise<KrHolidayInfo | null> {
  const cacheKey = `krx-holidays-v1:${year}`
  const cached = await getCache<KrHolidayInfo>(cacheKey, 7 * 24 * 3600_000)
  if (cached) return cached
  const key = process.env.DATA_GO_KR_SERVICE_KEY
  if (!key) return null
  try {
    const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
      `?serviceKey=${encodeURIComponent(key)}&solYear=${year}&numOfRows=50&_type=json`
    const r = await fetch(url, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    const raw = j?.response?.body?.items?.item
    const items: { locdate?: number; dateName?: string; isHoliday?: string }[] =
      Array.isArray(raw) ? raw : raw ? [raw] : []
    if (!items.length) return null                 // 활용신청 전(403 XML)·빈 응답 → 판정 보류
    const names: Record<string, string> = {}
    for (const it of items) {
      if (it.isHoliday !== 'Y' || !it.locdate) continue
      const s = String(it.locdate)
      names[`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`] = it.dateName ?? '공휴일'
    }
    names[ymd(year, 5, 1)] = '근로자의날(휴장)'    // 공휴일 아님·KRX 휴장
    let d = 31                                     // 연말휴장 — 12/31, 주말·공휴일이면 직전 평일
    while (dow(year, 12, d) === 0 || dow(year, 12, d) === 6 || names[ymd(year, 12, d)]) d--
    names[ymd(year, 12, d)] = '연말 휴장'
    const info: KrHolidayInfo = { dates: Object.keys(names).sort(), names }
    await setCache(cacheKey, info)
    return info
  } catch { return null }
}
