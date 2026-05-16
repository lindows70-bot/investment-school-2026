'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'login' | 'signup'
type Status = 'idle' | 'loading' | 'error' | 'success'

// ── Inline styles (no Tailwind dependency for this page) ─────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,

  // subtle dot-grid pattern overlay
  grid: {
    position: 'fixed' as const,
    inset: 0,
    backgroundImage:
      'radial-gradient(circle, #ffffff08 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    pointerEvents: 'none' as const,
  },

  wrap: {
    width: '100%',
    maxWidth: 420,
    position: 'relative' as const,
    zIndex: 1,
  },

  // ── Logo ──
  logoWrap: {
    textAlign: 'center' as const,
    marginBottom: 32,
  },
  logoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    boxShadow: '0 0 32px rgba(37,99,235,0.35)',
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.5px',
    margin: 0,
  },
  logoSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },

  // ── Card ──
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },

  // ── Tab bar ──
  tabBar: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    background: '#111',
    borderRadius: 10,
    padding: 4,
    marginBottom: 28,
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '8px 0',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.18s ease',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#f1f5f9' : '#64748b',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
  }),

  // ── Form ──
  fieldWrap: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
  },
  inputWrap: { position: 'relative' as const },
  inputIcon: {
    position: 'absolute' as const,
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#475569',
    pointerEvents: 'none' as const,
    lineHeight: 1,
  },
  input: {
    width: '100%',
    padding: '11px 12px 11px 36px',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },

  // ── Error / success banners ──
  errorBox: {
    background: '#2d0a0a',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#f87171',
    fontSize: 13,
    marginBottom: 16,
  },
  successBox: {
    background: '#052e16',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#34d399',
    fontSize: 13,
    marginBottom: 16,
  },

  // ── Submit button ──
  btn: (loading: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '12px',
    background: loading
      ? '#1d3a7a'
      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'opacity 0.15s, transform 0.1s',
    marginTop: 4,
    letterSpacing: '0.01em',
  }),

  // ── Footer link ──
  footerText: {
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#475569',
    marginTop: 20,
  },
  footerLink: {
    color: '#60a5fa',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontSize: 13,
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },

  divider: {
    borderColor: '#2a2a2a',
    margin: '20px 0',
  },
}

// ── SVG icons (inline, no dependency) ────────────────────────────────────────
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const SpinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
)

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)

const TrendIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────
function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [tab,      setTab]      = useState<Tab>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [status,   setStatus]   = useState<Status>('idle')
  const [message,  setMessage]  = useState('')
  const [focused,  setFocused]  = useState<string | null>(null)
  const redirectingRef = useRef(false)  // 중복 리다이렉트 방지

  // ── 안정적인 리다이렉트 함수 ────────────────────────────────────────────────
  // router.push()는 Next.js RSC fetch로 동작 → 미들웨어 쿠키 race condition 발생
  // window.location.href (hard redirect)를 사용해 브라우저가 fresh cookie를 전송하도록 함
  const redirectToDashboard = () => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    // Next.js 서버 상태 새로고침 후 hard redirect
    router.refresh()
    window.location.href = '/dashboard'
  }

  // ── onAuthStateChange 리스너 — 세션 수립 즉시 감지 ──────────────────────────
  // signInWithPassword 후 쿠키가 완전히 전파되는 시점에 SIGNED_IN 이벤트가 발생
  useEffect(() => {
    const sb = createClient()
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        redirectToDashboard()
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Support ?tab=signup and ?reason=idle in URL
  useEffect(() => {
    if (searchParams.get('tab') === 'signup') setTab('signup')
    if (searchParams.get('reason') === 'idle') {
      setStatus('error')
      setMessage('30분 동안 활동이 없어 자동 로그아웃 되었습니다.')
    }
  }, [searchParams])

  const reset = (t: Tab) => {
    setTab(t); setStatus('idle'); setMessage('')
    setEmail(''); setPassword(''); setFullName('')
  }

  // ── Input focus border style ──────────────────────────────
  const inputStyle = (name: string): React.CSSProperties => ({
    ...S.input,
    borderColor: focused === name ? '#2563eb' : '#2a2a2a',
    boxShadow: focused === name ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
  })

  // ── Login ─────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return  // 중복 제출 방지
    setStatus('loading'); setMessage('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStatus('error')
      setMessage(
        error.message.includes('Invalid login') || error.message.includes('invalid_credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : '로그인 중 오류가 발생했습니다. 다시 시도해주세요.'
      )
      return
    }

    // 세션이 즉시 반환된 경우 바로 리다이렉트
    // (onAuthStateChange 리스너가 SIGNED_IN 이벤트로도 동작하므로 어느 쪽이든 리다이렉트)
    if (data.session) {
      setStatus('success')
      setMessage('로그인 성공! 대시보드로 이동합니다…')
      redirectToDashboard()
    }
  }

  // ── Sign up ───────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setStatus('error'); setMessage('비밀번호는 6자 이상이어야 합니다.'); return
    }
    setStatus('loading'); setMessage('')

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'student' } },
    })

    if (signUpError) {
      setStatus('error')
      // 에러 코드/메시지별 한국어 안내
      const msg = signUpError.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('user already'))
        setMessage('이미 가입된 이메일입니다. 로그인해주세요.')
      else if (msg.includes('rate limit') || signUpError.status === 429)
        setMessage('잠시 후 다시 시도해주세요. (이메일 발송 한도 초과)')
      else if (msg.includes('email') && msg.includes('invalid'))
        setMessage('올바른 이메일 주소를 입력해주세요.')
      else if (msg.includes('password'))
        setMessage('비밀번호 조건을 확인해주세요. (6자 이상)')
      else if (msg.includes('database') || msg.includes('trigger') || msg.includes('violates'))
        setMessage('DB 설정 오류입니다. 관리자에게 문의하세요. (' + signUpError.message + ')')
      else
        setMessage('회원가입 오류: ' + signUpError.message)
      console.error('[Signup]', signUpError)
      return
    }

    // ── 이미 가입된 이메일이지만 identities가 없는 경우 (이메일 확인 필요) ──
    if (data.user && !data.user.identities?.length) {
      setStatus('error')
      setMessage('이미 가입된 이메일입니다. 로그인해주세요.')
      return
    }

    // profiles 테이블 upsert (트리거가 없는 경우 대비 — 에러 무시)
    if (data.user) {
      await supabase.from('profiles').upsert({
        id:        data.user.id,
        email:     data.user.email ?? email,
        full_name: fullName,
        role:      'student',
      }, { onConflict: 'id' }).then(({ error: pe }) => {
        if (pe) console.warn('[Signup] profiles upsert failed (non-fatal):', pe.message)
      })
    }

    // ── 이메일 인증 여부에 따라 분기 ──────────────────────────
    // session이 있으면 → 인증 불필요, 바로 대시보드 이동
    // session이 없으면 → 인증 메일 발송됨, 안내 메시지 표시
    if (data.session) {
      setStatus('success')
      setMessage('가입 완료! 대시보드로 이동합니다…')
      redirectToDashboard()
    } else {
      setStatus('success')
      setMessage('가입 완료! 이메일로 발송된 인증 링크를 클릭한 후 로그인해주세요.')
      // 탭을 로그인으로 전환해 바로 로그인할 수 있게 안내
      setTimeout(() => {
        setTab('login')
        setStatus('idle')
        setMessage('')
        setPassword('')
      }, 3500)
    }
  }

  const isLoading = status === 'loading'

  return (
    <>
      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={S.page}>
        <div style={S.grid} />

        <div style={S.wrap}>
          {/* ── Logo ── */}
          <div style={S.logoWrap}>
            <div style={S.logoIcon}><TrendIcon /></div>
            <h1 style={S.logoTitle}>2026 투자학교</h1>
            <p style={S.logoSub}>포트폴리오 관리 · 피터 린치 분류 · 수익률 분석</p>
          </div>

          {/* ── Card ── */}
          <div style={S.card}>
            {/* Tab bar */}
            <div style={S.tabBar}>
              <button style={S.tab(tab === 'login')}  onClick={() => reset('login')}>로그인</button>
              <button style={S.tab(tab === 'signup')} onClick={() => reset('signup')}>회원가입</button>
            </div>

            {/* Status banners */}
            {status === 'error'   && <div style={S.errorBox}>⚠ {message}</div>}
            {status === 'success' && <div style={S.successBox}>✓ {message}</div>}

            {/* ── Login form ── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin}>
                <div style={S.fieldWrap}>
                  <label style={S.label}>이메일</label>
                  <div style={S.inputWrap}>
                    <span style={S.inputIcon}><MailIcon /></span>
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                      style={inputStyle('email')}
                      placeholder="student@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.label}>비밀번호</label>
                  <div style={S.inputWrap}>
                    <span style={S.inputIcon}><LockIcon /></span>
                    <input
                      type="password" required value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      style={inputStyle('password')}
                      placeholder="비밀번호 입력"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} style={S.btn(isLoading)}>
                  {isLoading ? <><SpinIcon /> 로그인 중…</> : <>로그인 <ArrowIcon /></>}
                </button>
              </form>
            )}

            {/* ── Signup form ── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignup}>
                <div style={S.fieldWrap}>
                  <label style={S.label}>이름</label>
                  <div style={S.inputWrap}>
                    <span style={S.inputIcon}><UserIcon /></span>
                    <input
                      type="text" required value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      onFocus={() => setFocused('name')}
                      onBlur={() => setFocused(null)}
                      style={inputStyle('name')}
                      placeholder="홍길동"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.label}>이메일</label>
                  <div style={S.inputWrap}>
                    <span style={S.inputIcon}><MailIcon /></span>
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                      style={inputStyle('email')}
                      placeholder="student@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.label}>비밀번호 <span style={{ color: '#475569', fontWeight: 400 }}>(6자 이상)</span></label>
                  <div style={S.inputWrap}>
                    <span style={S.inputIcon}><LockIcon /></span>
                    <input
                      type="password" required value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      style={inputStyle('password')}
                      placeholder="6자 이상 입력"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* Role badge (read-only) */}
                <div style={{ ...S.fieldWrap, marginBottom: 20 }}>
                  <label style={S.label}>역할</label>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', background: '#111',
                    border: '1px solid #2a2a2a', borderRadius: 8,
                    color: '#60a5fa', fontSize: 13,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                    학생 (Student)
                  </div>
                </div>

                <button type="submit" disabled={isLoading} style={S.btn(isLoading)}>
                  {isLoading ? <><SpinIcon /> 가입 중…</> : <>회원가입 <ArrowIcon /></>}
                </button>
              </form>
            )}

            {/* Footer switch link */}
            <p style={S.footerText}>
              {tab === 'login' ? (
                <>계정이 없으신가요?{' '}
                  <button style={S.footerLink} onClick={() => reset('signup')}>회원가입</button>
                </>
              ) : (
                <>이미 계정이 있으신가요?{' '}
                  <button style={S.footerLink} onClick={() => reset('login')}>로그인</button>
                </>
              )}
            </p>
          </div>

          {/* Bottom caption */}
          <p style={{ textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 20 }}>
            © 2026 투자학교 · 모든 투자의 책임은 본인에게 있습니다
          </p>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}>
      <LoginContent />
    </Suspense>
  )
}
