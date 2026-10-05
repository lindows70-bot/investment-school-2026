// 크론·강제 재계산 권한 검사 SSOT — CRON_SECRET 이 비어 있으면 아무도 통과하지 못한다(fail-closed)
//
//   왜(2026-10-05 보안 점검): 프로덕션에 CRON_SECRET 이 등록돼 있지 않았고, 크론 10개 중 5개는 검사가 아예 없고
//   5개는 `if (secret) {…}` 라 비어 있으면 통과였다 → 외부인이 반복 호출로 Gemini 한도·SEC/DART 호출·Vercel 실행 시간을 태울 수 있었다.
//   공개 라우트의 `?refresh=1`(캐시 무시 재계산) 22곳도 누구나 부를 수 있었다.
//   Vercel 크론은 CRON_SECRET 이 등록돼 있으면 `Authorization: Bearer <값>` 을 자동으로 붙인다.
//   ⛔ URL `?secret=` 은 받지 않는다 — 접근 로그에 비밀값이 남는다.
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Vercel 크론(또는 비밀값을 아는 내부 호출 — cron-health 치유)인가 */
export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

/** 크론 라우트 첫 줄용 — 통과면 null, 아니면 401 응답 */
export function cronUnauthorized(req: Request): NextResponse | null {
  return isCronRequest(req) ? null : NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

/** 로그인한 사용자 id(쿠키 세션을 서버에서 검증) — 없으면 null */
export async function getAuthedUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await createClient().auth.getUser()
    return user?.id ?? null
  } catch { return null }
}

/** 로그인한 선생님인가(서버에서 profiles.role 로 확인 — 클라이언트 값은 믿지 않는다) */
export async function isTeacher(): Promise<boolean> {
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return false
    const { data } = await sb.from('profiles').select('role').eq('id', user.id).single()
    return data?.role === 'teacher'
  } catch { return false }
}

/** `?refresh=1` 같은 강제 재계산을 허락할 것인가 — 크론이거나 선생님일 때만.
 *  허락하지 않으면 호출부는 **오류 대신 캐시 결과**를 돌려준다(화면의 새로고침 버튼이 깨지지 않게). */
export async function canForceRefresh(req: Request): Promise<boolean> {
  return isCronRequest(req) || await isTeacher()
}
