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
  const protectedPaths = [
    '/portfolio', '/admin', '/dashboard', '/assets', '/history',
    '/analysis', '/watchlist', '/research', '/master-strategy',
    '/investment-academy', '/school-lounge', '/macro-hub',
  ]
  const authPaths = ['/login', '/signup']

  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // ── 2. 이미 로그인 → /login, /signup 접근 시 대시보드로 ─────────────────────
  if (user && authPaths.some(p => pathname === p || pathname.startsWith(p + '?'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
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
