import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── 세션 확인 ────────────────────────────────────────────────────────────────
  // getSession()은 로컬 쿠키만 읽어 빠름 (네트워크 요청 없음)
  // /admin 경로에서만 getUser()로 DB 검증 (보안 강화)
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const { pathname } = request.nextUrl

  // ── 1. 미인증 → /login ──────────────────────────────────────────────────────
  // ⚠️ 화면을 새로 만들 때 여기에 추가하는 걸 잊기 쉽다 — 2026-08-08 전수 점검에서 13개가 빠져 있었다.
  //    데이터 자체는 API가 401로 막지만, 비로그인 학생은 **빈 화면을 보고 '고장났다'고 오해**한다
  //    (브리핑만 "로그인하면 보입니다"를 따로 처리하고 있었고 나머지는 그냥 비어 보였다).
  const protectedPaths = [
    '/portfolio', '/admin', '/dashboard', '/assets', '/history',
    '/analysis', '/watchlist', '/research', '/master-strategy',
    '/investment-academy', '/school-lounge', '/macro-hub', '/valuation',
    '/school-league',
    // 2026-08-08 보강 — 내 보유·내 신호를 다루거나 로그인 전제인 화면들
    '/briefing', '/weekly-report', '/win-lose', '/signal-report', '/reco-hub',
    '/tech-chart', '/tech-screener', '/earnings-reports', '/hi52-radar',
    '/dividend', '/bonds', '/guru-portfolio', '/real-estate',
    '/s/', // 🎒 학생 간단 모드
  ]
  const authPaths = ['/login', '/signup']

  // 원래 가려던 주소를 next 로 기억한다 — 로그인 뒤 /start 가 같은 사이트 내부 경로인지 확인하고 되돌려 보낸다
  // (/start 는 이 목록에 넣지 않는다 — 스스로 로그인을 확인하고 /login 으로 보낸다)
  if (!user && (pathname === '/s' || protectedPaths.some(p => pathname.startsWith(p)))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // ── 2. 이미 로그인 → /login, /signup 접근 시 착지(/start)로 — next 가 있으면 넘긴다 ──
  if (user && authPaths.some(p => pathname === p || pathname.startsWith(p + '?'))) {
    const startUrl = new URL('/start', request.url)
    const next = request.nextUrl.searchParams.get('next')
    if (next) startUrl.searchParams.set('next', next)
    return NextResponse.redirect(startUrl)
  }

  // ── 3. /admin → teacher 전용 (DB 조회로 role 검증) ─────────────────────────
  if (user && pathname.startsWith('/admin')) {
    // admin 경로에서만 getUser()로 서버 검증 (보안)
    const { data: { user: verifiedUser } } = await supabase.auth.getUser()
    if (!verifiedUser) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', verifiedUser.id)
      .single()

    if (!profile || profile.role !== 'teacher') {
      const dest = new URL('/dashboard', request.url)
      dest.searchParams.set('denied', 'admin')
      return NextResponse.redirect(dest)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
