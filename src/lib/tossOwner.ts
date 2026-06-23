// 🔒 토스 개인계좌(잔고·보유종목·주문내역) 접근 게이트 — 소유자(선생님) 단 한 명만 통과.
//    학생에게 선생님 개인 투자정보가 절대 노출되지 않도록, 모든 개인계좌 라우트는 이 게이트를 필수로 거친다.
//    ⚠️ 시세·종목 조회(개인정보 아님)는 이 게이트를 쓰지 않는다(학생 공용 허용).
import { createClient } from '@/lib/supabase/server'

export type TossOwnerCheck = { ok: true; userId: string; email: string } | { ok: false; reason: string }

/** 현재 로그인 사용자가 토스 계좌 '소유자'인지 검증. TOSS_OWNER_EMAIL(env)과 정확히 일치할 때만 ok. */
export async function assertTossOwner(): Promise<TossOwnerCheck> {
  const ownerEmail = (process.env.TOSS_OWNER_EMAIL ?? '').trim().toLowerCase()
  // 소유자 이메일이 설정 안 됐으면 '아무도 통과 못 함'(fail-closed) — 실수로 전체 공개되는 일 방지
  if (!ownerEmail) return { ok: false, reason: 'TOSS_OWNER_EMAIL 미설정(fail-closed)' }

  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user?.email) return { ok: false, reason: '미인증' }
  if (user.email.trim().toLowerCase() !== ownerEmail) return { ok: false, reason: '소유자 아님' }
  return { ok: true, userId: user.id, email: user.email }
}
