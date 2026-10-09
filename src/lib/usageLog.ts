// 화면 열람 집계(월별 1행) — 어느 화면·어느 탭이 실제로 쓰이는지. 대시보드 탭 50개 가지치기(전체 검토 3-1)의 근거를 2~4주 쌓는다
//   student_visits 는 하루 첫 경로만 남겨 '무엇을 보는가'를 모른다. 여기는 경로·탭 단위 횟수(세션당 1회)와 사용자별 총횟수만 — 개인 식별 정보는 user id 뿐
//   ⛔ 추정 금지: 기록이 없는 화면은 '안 쓴 화면'이 아니라 '아직 집계 전'이다(집계 시작일을 함께 본다)
import { getCache, setCache } from '@/lib/appCache'

/** 월 키(KST 'YYYY-MM') — PURGE_RULES 에 400일 보존으로 등록(1월 1행 · 캐시날짜예외: 월별 집계는 날짜가 뜻을 가진다) */
export const USAGE_KEY = (ymKst: string) => `usage-v1:${ymKst}`
export const ymKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)

export type UsageKind = 'page' | 'tab'
export interface UsageDoc {
  since: string                          // 이 달 첫 기록 시각(ISO)
  page: Record<string, number>           // 경로 → 세션당 1회 집계 횟수
  tab: Record<string, number>            // 대시보드 탭 key → 횟수
  byUser: Record<string, number>         // user id → 총 횟수(선생님/학생 구분은 읽는 쪽이 profiles 로)
}

const EMPTY = (): UsageDoc => ({ since: new Date().toISOString(), page: {}, tab: {}, byUser: {} })

/** 한 건 더하기 — 읽고 더해 쓴다(동시 요청이 겹치면 한두 건 잃을 수 있다 · 경향 파악용이라 감수) */
export async function recordUsage(kind: UsageKind, key: string, userId: string): Promise<void> {
  const k = USAGE_KEY(ymKst())
  const doc = (await getCache<UsageDoc>(k, 60 * 86_400_000)) ?? EMPTY()
  doc[kind][key] = (doc[kind][key] ?? 0) + 1
  doc.byUser[userId] = (doc.byUser[userId] ?? 0) + 1
  await setCache(k, doc)
}
