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

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── 1. Unauthenticated → /login ──────────────────────────────
  const protectedPaths = ['/portfolio', '/admin', '/dashboard', '/assets', '/history', '/analysis', '/watchlist', '/research']
  const authPaths      = ['/login', '/signup']

  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && authPaths.some(p => pathname === p || pathname.startsWith(p + '?'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── 2. /admin → teacher 전용 ─────────────────────────────────
  // Role은 JWT claim에 없으므로 DB를 직접 조회합니다.
  // 쿼리 비용을 줄이기 위해 /admin 경로에서만 실행합니다.
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'teacher') {
      // 학생은 대시보드로, 미인증은 로그인으로
      const dest = user ? '/dashboard' : '/login'
      const res  = NextResponse.redirect(new URL(dest, request.url))
      // 접근 거부 메시지를 쿼리 파라미터로 전달
      res.headers.set('Location', `${new URL(dest, request.url).href}?denied=admin`)
      return res
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
