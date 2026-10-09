// 화면 열람 집계(월별 1행) — 어느 화면·어느 탭이 실제로 쓰이는지. 대시보드 탭 50개 가지치기(전체 검토 3-1)의 근거를 2~4주 쌓는다
//   student_visits 는 하루 첫 경로만 남겨 '무엇을 보는가'를 모른다. 여기는 경로·탭 단위 횟수(세션당 1회)와 사용자별 총횟수만 — 개인 식별 정보는 user id 뿐
//   ⛔ 추정 금지: 기록이 없는 화면은 '안 쓴 화면'이 아니라 '아직 집계 전'이다(집계 시작일을 함께 본다)
import { createClient } from '@supabase/supabase-js'

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
const bump = (doc: UsageDoc, kind: UsageKind, key: string, userId: string) => {
  doc[kind][key] = (doc[kind][key] ?? 0) + 1
  doc.byUser[userId] = (doc.byUser[userId] ?? 0) + 1
}

/** 한 건 더하기 — 낙관적 동시성(updated_at 일치 조건 update · 최대 4회 재시도).
 *  대시보드를 열면 '화면'과 '탭' 기록이 **동시에** 날아오는데, 읽고-더해-쓰기(upsert)로는 둘 중 하나가 매번 사라졌다(2026-10-09 실측 — /dashboard 1건 유실). */
export async function recordUsage(kind: UsageKind, key: string, userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svc) return
  const db = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (u, o) => fetch(u as RequestInfo, { ...o, cache: 'no-store' }) } })
  const k = USAGE_KEY(ymKst())
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data } = await db.from('app_cache').select('payload, updated_at').eq('key', k).maybeSingle()
    if (!data) {
      const doc = EMPTY(); bump(doc, kind, key, userId)
      const { error } = await db.from('app_cache').insert({ key: k, payload: doc, updated_at: new Date().toISOString() })
      if (!error) return
      if (error.code !== '23505') return   // 23505 = 누가 먼저 만들었다 → 다시 읽어 더한다. 그 밖의 오류는 포기(집계는 화면보다 중요하지 않다)
      continue
    }
    const doc = (data.payload as UsageDoc) ?? EMPTY(); bump(doc, kind, key, userId)
    const { data: upd } = await db.from('app_cache')
      .update({ payload: doc, updated_at: new Date().toISOString() })
      .eq('key', k).eq('updated_at', data.updated_at as string)   // 내가 읽은 뒤 아무도 안 썼을 때만
      .select('key')
    if (upd && upd.length > 0) return
    await new Promise(r => setTimeout(r, 60 + attempt * 120))
  }
}
