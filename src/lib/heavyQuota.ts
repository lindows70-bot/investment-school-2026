// 무거운 분석(AI 요약·공시 수집) 사용자별 하루 호출 한도 — 가입이 누구에게나 열려 있어 '로그인 필수'만으로는 반복 호출을 못 막는다
//
//   왜(2026-10-05 보안 점검): 로그인한 계정 하나가 스크립트로 종목 분석을 반복하면 Gemini 무료 한도·SEC/DART 호출을 다 쓸 수 있다.
//   학생이 하루에 종목 상세를 아무리 많이 열어도 닿지 않을 넉넉한 값으로 두고, 넘으면 '오늘은 다 썼다'고 정직하게 말한다.
//   ⛔ 날짜는 키가 아니라 값에 둔다 — 사용자당 1행(날짜 키는 지우는 장치 없이 영구 누적 · 2026-09-26 DB 한도 사고).
import { getCache, setCache } from '@/lib/appCache'

export const HEAVY_DAILY_LIMIT = 200

const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 한도 안이면 1회 차감하고 true, 오늘 몫을 다 썼으면 false */
export async function takeHeavyQuota(uid: string): Promise<boolean> {
  const key = `heavy-quota-v1:${uid}`
  const today = kstDay()
  const cur = await getCache<{ day: string; n: number }>(key, 2 * 86400_000)
  const n = cur && cur.day === today ? cur.n : 0
  if (n >= HEAVY_DAILY_LIMIT) return false
  await setCache(key, { day: today, n: n + 1 })
  return true
}
