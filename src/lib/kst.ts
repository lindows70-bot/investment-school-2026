// 🕒 한국 달력일(KST) SSOT — `new Date(Date.now() + 9h).toISOString().slice(0, 10)` 한 줄이 64개 파일에 똑같이, 변형이 76개 파일에 복제돼 있었다(2026-10-19 8차 점검).
//   서버는 UTC 라 '오늘'을 그냥 new Date() 로 재면 KST 자정~09시 사이에 전날이 된다 — 그래서 모두 +9h 시프트 뒤 UTC 게터로 읽는다(앱 관례).
//   ⚠️ 렌더 중에 쓰지 마라(서버 UTC vs 학생 KST 하이드레이션 불일치 — TopHeader 사고). 서버 라우트·캐시 키·크론 판정용이다.
export const KST_MS = 9 * 3600_000

/** 지금(또는 d)의 한국 달력일 'YYYY-MM-DD' */
export function kstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_MS).toISOString().slice(0, 10)
}

/** KST 시프트 Date — UTC 게터(getUTCHours 등)로 읽으면 한국 시각이 나온다 */
export function kstNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + KST_MS)
}

/** 한국 달력월 'YYYY-MM' */
export function kstMonth(d: Date = new Date()): string {
  return kstDate(d).slice(0, 7)
}
