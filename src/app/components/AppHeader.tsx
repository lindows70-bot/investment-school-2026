'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  /** 페이지 제목 (로고 옆 표시) */
  title?: string
  /** 최대 너비 (기본 1200) */
  maxWidth?: number
}

export default function AppHeader({ title, maxWidth = 1200 }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [email,       setEmail]       = useState<string | null>(null)
  const [isTeacher,   setIsTeacher]   = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // 로그인 사용자 이메일 + role 가져오기
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setEmail(data.user.email ?? null)
      // role 확인 — teacher만 관리자 링크 노출
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      setIsTeacher(profile?.role === 'teacher')
    })
  }, [])

  // 로그아웃 요청 → 확인 팝업 표시
  const requestLogout = () => {
    setMenuOpen(false)
    setConfirmOpen(true)
  }

  // 확인 후 실제 로그아웃
  const handleLogout = async () => {
    setConfirmOpen(false)
    setLoggingOut(true)

    // 공공장소 대비 — 모든 기기의 세션 제거
    await createClient().auth.signOut({ scope: 'global' })

    router.push('/login')
    router.refresh()
  }

  const isAdmin = pathname.startsWith('/admin')

  const avatarChar = (email?.[0] ?? '?').toUpperCase()

  return (
    <nav style={{
      background: '#111',
      borderBottom: '1px solid #1e1e1e',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(12px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        maxWidth,
        margin: '0 auto',
        padding: '0 20px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>

        {/* ── Left: Logo ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-header.svg"
            alt="Investment School"
            style={{ height: 32, width: 'auto', display: 'block', flexShrink: 0 }}
          />

          {/* 숨겨진 텍스트 — title·subtitle 분리 표시 시 사용 */}
          <span style={{ display: 'none' }}>
            2026 투자학교
          </span>

          {title && (
            <>
              <span style={{ color: '#2a2a2a', fontSize: 16 }}>/</span>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{title}</span>
            </>
          )}

          {isTeacher && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#fb923c',
              background: 'rgba(251,146,60,0.12)',
              border: '1px solid rgba(251,146,60,0.3)',
              borderRadius: 99, padding: '2px 8px',
              letterSpacing: '0.06em',
            }}>
              TEACHER
            </span>
          )}
        </div>

        {/* ── Right: User + Logout ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Teacher 전용 관리자 버튼 — 헤더에 항상 노출 */}
          {isTeacher && !isAdmin && (
            <a
              href="/admin"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 16px rgba(124,58,237,0.3)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
            >
              🏫 관리자 대시보드
            </a>
          )}

          {/* 관리자 페이지에서는 '← 대시보드' 버튼 표시 */}
          {isTeacher && isAdmin && (
            <a
              href="/dashboard"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#374151',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
            >
              ← 대시보드
            </a>
          )}

          {/* 이메일 (md 이상에서만 표시) */}
          {email && (
            <span style={{
              fontSize: 12, color: '#475569',
              maxWidth: 200, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'none',
              // CSS media query를 인라인으로 쓸 수 없어 아래 <style> 태그로 처리
            }} className="header-email">
              {email}
            </span>
          )}

          {/* Avatar + dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              title={email ?? ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px 5px 5px',
                background: menuOpen ? '#1e1e1e' : 'transparent',
                border: '1px solid',
                borderColor: menuOpen ? '#2a2a2a' : 'transparent',
                borderRadius: 99,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!menuOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#222'
                }
              }}
              onMouseLeave={e => {
                if (!menuOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
                }
              }}
            >
              {/* Avatar circle */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg,#1d4ed8,#6d28d9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {avatarChar}
              </div>

              {/* Email short */}
              <span style={{ fontSize: 12, color: '#64748b', maxWidth: 140,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                className="header-email"
              >
                {email}
              </span>

              {/* Chevron */}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="#475569" strokeWidth="2.5" strokeLinecap="round"
                style={{ transition: 'transform 0.15s', transform: menuOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 12, padding: '6px',
                  minWidth: 220, zIndex: 50,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                  animation: 'ddFadeIn 0.12s ease-out',
                }}>
                  {/* User info row */}
                  <div style={{
                    padding: '10px 12px 12px',
                    borderBottom: '1px solid #222', marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(135deg,#1d4ed8,#6d28d9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800, color: '#fff',
                      }}>
                        {avatarChar}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                          {email?.split('@')[0]}
                        </div>
                        <div style={{
                          fontSize: 11, color: '#475569',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 150,
                        }}>
                          {email}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nav links — 관리자 링크는 teacher만 노출 */}
                  {[
                    { href: '/dashboard', label: 'Watchlist', icon: '📈' },
                    ...(isTeacher && !isAdmin ? [{ href: '/admin', label: '관리자 대시보드', icon: '🛡️' }] : []),
                  ].map(({ href, label, icon }) => (
                    <button
                      key={href}
                      onClick={() => { setMenuOpen(false); router.push(href) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 8,
                        background: 'transparent', border: 'none',
                        color: '#94a3b8', fontSize: 13, cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s, color 0.1s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#222'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
                      }}
                    >
                      <span>{icon}</span>{label}
                    </button>
                  ))}

                  <div style={{ borderTop: '1px solid #222', margin: '6px 0' }} />

                  {/* Logout button */}
                  <button
                    onClick={requestLogout}
                    disabled={loggingOut}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8,
                      background: 'transparent', border: 'none',
                      color: '#f87171', fontSize: 13, cursor: loggingOut ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      opacity: loggingOut ? 0.6 : 1,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!loggingOut) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    {loggingOut ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          style={{ animation: 'spin 0.7s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        로그아웃 중…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        로그아웃
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ddFadeIn  { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cfFadeIn  { from { opacity:0; transform:scale(0.96) }      to { opacity:1; transform:scale(1) } }
        @keyframes spin      { to   { transform: rotate(360deg) } }
        @media (max-width: 480px) { .header-email { display: none !important } }
        @media (min-width: 481px) { .header-email { display: block !important } }
      `}</style>

      {/* ── 로그아웃 확인 팝업 ── */}
      {confirmOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmOpen(false) }}
        >
          <div style={{
            background: '#141414', border: '1px solid #2a2a2a',
            borderRadius: 18, padding: '32px 28px',
            width: '100%', maxWidth: 360, textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            animation: 'cfFadeIn 0.18s ease-out',
          }}>
            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 18px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
              로그아웃 하시겠습니까?
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px', lineHeight: 1.6 }}>
              {email}
            </p>
            <p style={{ fontSize: 12, color: '#334155', margin: '0 0 26px' }}>
              모든 기기에서 세션이 종료됩니다.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  border: '1px solid #2a2a2a', background: 'transparent',
                  color: '#94a3b8', fontSize: 14, cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'; (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
