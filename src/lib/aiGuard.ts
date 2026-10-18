// 무인증 Gemini 라우트 보호(2026-10-18 6차 점검) — ①같은 인스턴스 안 동시 요청은 한 번만 부른다(single-flight) ②실패하면 10분 음성 캐시(app_cache · 인스턴스 공유)
//   전엔 성공만 캐시해서 Gemini 가 흔들리는 동안 요청마다(모델 4회 시도) 다시 불렀고, 동시 요청은 각자 불렀다.
//   키에 날짜가 없다(덮어쓰기) — 정리 규칙 불필요.
import { getCache, setCache } from './appCache'

const inflight = new Map<string, Promise<unknown>>()

/** 같은 key 의 작업이 진행 중이면 그 Promise 를 돌려준다(끝나면 비운다) */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cur = inflight.get(key) as Promise<T> | undefined
  if (cur) return cur
  const p = fn().finally(() => { inflight.delete(key) })
  inflight.set(key, p)
  return p
}

export const AI_FAIL_COOLDOWN_MS = 10 * 60_000
const failKey = (route: string) => `ai-fail-v1:${route}`

/** 최근 10분 안에 이 라우트의 Gemini 호출이 실패했나 — 참이면 호출하지 말고 바로 돌아간다 */
export async function aiRecentlyFailed(route: string): Promise<boolean> {
  return (await getCache<{ at: string }>(failKey(route), AI_FAIL_COOLDOWN_MS)) != null
}

export async function markAiFailed(route: string): Promise<void> {
  try { await setCache(failKey(route), { at: new Date().toISOString() }) } catch { /* 표식 실패는 무시 */ }
}
