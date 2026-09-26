// 로그인 뒤 어디로 보낼지 정하는 순수 규칙 — 역할·화면 모드 쿠키로 착지 경로, next 는 같은 사이트 내부 경로만 허용
export const VIEW_MODE_COOKIE = 'view_mode'

/**
 * 착지 경로. 본인이 고른 모드(쿠키)가 먼저, 없으면 역할로.
 * 선생님은 쿠키가 없으면 지금처럼 대시보드 — 학생·역할 모름은 학생 홈.
 */
export function landingPath(role: string | null, mode: string | null): '/s' | '/dashboard' {
  if (mode === 'simple') return '/s'
  if (mode === 'full') return '/dashboard'
  return role === 'teacher' ? '/dashboard' : '/s'
}

/**
 * 역할 조회 결과까지 반영한 착지. 본인이 고른 모드(쿠키)는 언제나 먼저.
 * - 행 없음(PostgREST PGRST116) → 역할 모름 → 학생 홈
 * - 그 밖의 조회 오류 → 예전 착지(대시보드) — 선생님이 오류 때문에 조용히 학생 홈으로 가지 않게
 */
export function landingAfterLookup(
  role: string | null,
  mode: string | null,
  errorCode: string | null | undefined,
): '/s' | '/dashboard' {
  if (errorCode && errorCode !== 'PGRST116' && mode !== 'simple' && mode !== 'full') return '/dashboard'
  return landingPath(errorCode ? null : role, mode)
}

/**
 * getUser 실패를 두 갈래로 나눈다.
 * - 'invalid': 세션이 없거나 서버가 세션을 인정하지 않음(401·403·404) → 로그인 쿠키 정리 + /login
 * - 'outage' : 네트워크·5xx·429·알 수 없는 오류 → 쿠키를 지우지도 /login 으로 보내지도 않는다
 *   (보내면 미들웨어가 쿠키만 보고 다시 /start 로 돌려보내 무한 이동이 된다)
 */
export function authFailureKind(err: { name?: string; status?: number } | null | undefined): 'invalid' | 'outage' {
  if (!err) return 'invalid'
  if (err.name === 'AuthRetryableFetchError') return 'outage'
  if (err.name === 'AuthSessionMissingError') return 'invalid'
  const st = err.status
  if (st === 401 || st === 403 || st === 404) return 'invalid'
  return 'outage'
}

/** Supabase 로그인 토큰 쿠키(쪼개진 조각 .0 .1 포함)가 있는가 — code-verifier 같은 다른 쿠키는 세지 않는다 */
export function hasAuthTokenCookie(names: string[]): boolean {
  return names.some(n => /^sb-.+-auth-token(\.\d+)?$/.test(n))
}

// 로그인·가입·착지 자신으로 되돌아가면 빙빙 돈다
const LOOP_PATHS = ['/login', '/signup', '/start']

/** 경로(쿼리 제외)가 로그인·가입·착지 자신이면 true — 대소문자·끝 슬래시·하위 경로 포함 */
export function isLoopPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  return LOOP_PATHS.some(p => lower === p || lower.startsWith(p + '/'))
}

/**
 * 로그인 뒤 돌아갈 곳(next)이 **같은 사이트 내부 경로**일 때만 그대로 돌려준다. 아니면 null.
 * 열린 리다이렉트를 막는다 — '//evil.com'·'/\evil'·'https://x'·'javascript:' 는 모두 null.
 * 한 번 더 풀어서(decode) 본다 — '/%2F%2Fevil' 처럼 인코딩으로 숨긴 '//' 도 막는다.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (typeof next !== 'string' || next.length === 0 || next.length > 512) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return null
  }
  for (const s of [next, decoded]) {
    if (!s.startsWith('/')) return null
    if (s.startsWith('//')) return null
    // 브라우저는 탭·줄바꿈 같은 제어문자를 지운다 — '/\t/evil' 이 '//evil' 이 된다
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(s)) return null
    const path = s.split(/[?#]/)[0]
    // 경로의 '\' 는 브라우저가 '/' 로 읽는다 — '/\evil' 이 '//evil' 이 된다
    if (path.includes('\\')) return null
    if (isLoopPath(path)) return null
  }
  return next
}
