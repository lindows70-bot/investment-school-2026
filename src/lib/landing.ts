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
 * - 오류 없음 → 역할대로
 * - 행 없음(PostgREST PGRST116) → 역할 모름 → 학생 홈
 * - 그 밖의 모든 조회 오류 → 예전 착지(대시보드) — 선생님이 오류 때문에 조용히 학생 홈으로 가지 않게.
 *   ⚠️ code 문자열이 아니라 오류 '존재'로 가른다 — postgrest-js 는 fetch 실패·타임아웃이면 code "",
 *   게이트웨이 HTML 5xx 면 code undefined 를 준다(가장 흔한 장애가 '오류 없음'으로 읽히면 안 된다).
 */
export function landingAfterLookup(
  role: string | null,
  mode: string | null,
  lookupError: { code?: string } | null | undefined,
): '/s' | '/dashboard' {
  if (!lookupError) return landingPath(role, mode)
  if (mode === 'simple' || mode === 'full') return landingPath(null, mode)
  return lookupError.code === 'PGRST116' ? '/s' : '/dashboard'
}

// 400 이어도 '세션이 무효'라는 뜻인 오류 코드 — auth-js 가 이미 세션을 지운 뒤라 '연결 불안정'이 아니다
const INVALID_SESSION_CODES = ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'bad_jwt']

/**
 * getUser 실패를 두 갈래로 나눈다.
 * - 'invalid': 세션이 없거나 서버가 세션을 인정하지 않음(401·403·404, 무효 세션 코드) → 로그인 쿠키 정리 + /login
 * - 'outage' : 네트워크·5xx·429·그 밖의 알 수 없는 오류 → 쿠키를 지우지도 /login 으로 보내지도 않는다
 *   (보내면 미들웨어가 쿠키만 보고 다시 /start 로 돌려보내 무한 이동이 된다)
 */
export function authFailureKind(
  err: { name?: string; status?: number; code?: string } | null | undefined,
): 'invalid' | 'outage' {
  if (!err) return 'invalid'
  if (err.name === 'AuthRetryableFetchError') return 'outage'
  if (err.name === 'AuthSessionMissingError') return 'invalid'
  if (err.code && INVALID_SESSION_CODES.includes(err.code)) return 'invalid'
  const st = err.status
  if (st === 401 || st === 403 || st === 404) return 'invalid'
  return 'outage'
}

/** Supabase 로그인 토큰 쿠키 이름만 골라낸다(쪼개진 조각 .0 .1 포함) — code-verifier 같은 다른 쿠키는 빼고 */
export function authTokenCookieNames(names: string[]): string[] {
  return names.filter(n => /^sb-.+-auth-token(\.\d+)?$/.test(n))
}

/** Supabase 로그인 토큰 쿠키가 하나라도 있는가 */
export function hasAuthTokenCookie(names: string[]): boolean {
  return authTokenCookieNames(names).length > 0
}

/** HTML 속성값 이스케이프(& " < > ') */
export function escapeHtmlAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')
}

/** 장애 안내 화면의 '다시 열기' 주소 — safeNext 를 통과한 next 가 있으면 잃지 않게 붙인다(속성에 넣을 수 있게 이스케이프까지) */
export function retryHref(next: string | null): string {
  const safe = safeNext(next)
  return escapeHtmlAttr(safe ? `/start?next=${encodeURIComponent(safe)}` : '/start')
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
