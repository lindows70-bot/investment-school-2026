// 로그인 뒤 착지 — 로그인 확인 → next(같은 사이트 내부 경로)가 있으면 그리로, 없으면 역할·화면 모드 쿠키로 /s 또는 /dashboard
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { VIEW_MODE_COOKIE, landingPath, safeNext } from '@/lib/landing'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 다른 API 와 같은 서버 클라이언트 — 세션 쿠키가 갱신되면 Next 가 이 응답(리다이렉트)에 붙여 준다
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const next = safeNext(request.nextUrl.searchParams.get('next'))
  if (!user) {
    // 쿠키엔 세션이 남아 있는데 서버가 인정하지 않는 경우(다른 기기에서 전체 로그아웃 등) — 미들웨어는 쿠키만 보고
    // /login 을 다시 /start 로 돌려보내 무한 왕복이 된다. 이 기기의 세션 쿠키를 지워 고리를 끊는다.
    // (네트워크 오류면 signOut 이 쿠키를 지우지 않는다 — 오류 401·403·404 일 때만 지운다)
    if (request.cookies.getAll().some(c => c.name.startsWith('sb-'))) {
      await supabase.auth.signOut({ scope: 'local' })
    }
    const loginUrl = new URL('/login', request.url)
    if (next) loginUrl.searchParams.set('next', next) // 로그인 뒤 다시 여기로 — 원래 가려던 곳을 잃지 않게
    return NextResponse.redirect(loginUrl)
  }

  if (next) {
    const dest = new URL(next, request.url)
    // 이중 안전장치 — 규칙을 통과했어도 해석 결과가 다른 사이트면 버린다
    if (dest.origin === request.nextUrl.origin) return NextResponse.redirect(dest)
  }

  // 역할을 못 읽으면(오류·행 없음) null → 학생 홈. 그러면 선생님도 조용히 학생 홈으로 가므로 오류는 로그로 남긴다.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (error) console.warn('[start] profiles.role 조회 실패 — 학생 홈으로 보냄:', error.message)

  const mode = cookies().get(VIEW_MODE_COOKIE)?.value ?? null
  return NextResponse.redirect(new URL(landingPath(profile?.role ?? null, mode), request.url))
}
