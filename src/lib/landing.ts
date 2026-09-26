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

// 로그인·가입·착지 자신으로 되돌아가면 빙빙 돈다
const LOOP_PATHS = ['/login', '/signup', '/start']

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
    const lower = path.toLowerCase()
    if (LOOP_PATHS.some(p => lower === p || lower.startsWith(p + '/'))) return null
  }
  return next
}
