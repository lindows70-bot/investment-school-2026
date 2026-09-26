// 로그인 뒤 착지 — 로그인 확인 → next(같은 사이트 내부 경로)가 있으면 그리로, 없으면 역할·화면 모드 쿠키로 /s 또는 /dashboard
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { TK, FS, SP, FONT_STACK } from '@/lib/theme'
import {
  VIEW_MODE_COOKIE, safeNext, isLoopPath, authFailureKind, hasAuthTokenCookie, landingAfterLookup,
} from '@/lib/landing'

export const dynamic = 'force-dynamic'

// Supabase 가 응답하지 않을 때 — /login 으로 보내면 미들웨어(쿠키만 봄)가 다시 여기로 돌려보내 무한 이동이 된다.
// 쿠키는 그대로 두고(세션을 잃지 않게) 사실대로 안내한다.
function outageResponse(): NextResponse {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>2026 투자학교</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${TK.bg1};color:${TK.slate100};font-family:${FONT_STACK.replace(/"/g, "'")}">
<div style="padding:${SP.xl}px;text-align:center;font-size:${FS.body}px;line-height:1.6">
<p style="margin:0 0 ${SP.lg}px">잠시 연결이 불안정해요. 잠시 뒤 다시 열어 주세요.</p>
<a href="/start" style="color:${TK.sub}">다시 열기</a>
</div></body></html>`
  return new NextResponse(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '30' },
  })
}

export async function GET(request: NextRequest) {
  // 다른 API 와 같은 서버 클라이언트 — 세션 쿠키가 갱신되면 Next 가 이 응답(리다이렉트)에 붙여 준다
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const next = safeNext(request.nextUrl.searchParams.get('next'))
  if (!user) {
    if (isAuthRetryableFetchError(authError) || authFailureKind(authError) === 'outage') {
      console.warn('[start] getUser 장애 — 안내 화면(503):', authError?.status, authError?.message)
      return outageResponse()
    }
    // 세션이 없거나 서버가 인정하지 않음(다른 기기에서 전체 로그아웃 등) — 쿠키만 보는 미들웨어가
    // /login 을 다시 /start 로 돌려보내지 않도록 이 기기의 로그인 쿠키를 지운다.
    if (hasAuthTokenCookie(request.cookies.getAll().map(c => c.name))) {
      await supabase.auth.signOut({ scope: 'local' })
    }
    const loginUrl = new URL('/login', request.url)
    if (next) loginUrl.searchParams.set('next', next) // 로그인 뒤 다시 여기로 — 원래 가려던 곳을 잃지 않게
    return NextResponse.redirect(loginUrl)
  }

  if (next) {
    const dest = new URL(next, request.url)
    // 이중 안전장치 — 규칙을 통과했어도 해석 결과가 다른 사이트·'//' 경로·되돌이 경로면 버린다
    if (dest.origin === request.nextUrl.origin && !dest.pathname.startsWith('//') && !isLoopPath(dest.pathname)) {
      return NextResponse.redirect(dest)
    }
  }

  // 행 없음(PGRST116) → 학생 홈 · 그 밖의 조회 오류 → 예전 착지(대시보드). 쿠키로 고른 모드는 언제나 먼저.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (error) console.warn('[start] profiles.role 조회 실패:', error.code, error.message)

  const mode = cookies().get(VIEW_MODE_COOKIE)?.value ?? null
  return NextResponse.redirect(new URL(landingAfterLookup(profile?.role ?? null, mode, error?.code), request.url))
}
