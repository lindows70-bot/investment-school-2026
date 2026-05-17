'use client'

import { useState, useEffect, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', icon: '📊', label: '대시보드' },
  { href: '/assets',    icon: '💼', label: '자산 관리' },
  { href: '/history',   icon: '📋', label: '투자 기록' },
  { href: '/analysis',  icon: '📈', label: '투자 분석' },
]

const ANALYSIS_NAV = [
  { href: '/analysis?tab=lynch',   icon: '🔍', label: '피터린치 분석' },
  { href: '/analysis?tab=buffett', icon: '🛡️', label: '워렌버핏 분석' },
]

const RESEARCH_NAV = [
  { href: '/research',   icon: '🔭', label: '종목 리서치' },
  { href: '/watchlist',  icon: '⭐', label: '관심종목' },
]

const SCHOOL_NAV = [
  { href: '/master-strategy',    icon: '🏹', label: 'Master Strategy' },
  { href: '/investment-academy', icon: '🎓', label: 'Investment Academy' },
  { href: '/school-lounge',      icon: '💬', label: 'School Lounge' },
  { href: '/macro-hub',          icon: '🌐', label: 'Macro Hub' },
]

function SidebarInner() {
  const pathname = usePathname()
  const router   = useRouter()

  const [email,      setEmail]      = useState<string | null>(null)
  const [displayName,setDisplayName]= useState<string | null>(null)
  const [isTeacher,  setIsTeacher]  = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setEmail(data.user.email ?? null)
      const { data: p } = await sb.from('profiles').select('role, full_name').eq('id', data.user.id).single()
      setIsTeacher(p?.role === 'teacher')
      setDisplayName(p?.full_name ?? null)
    })
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut({ scope: 'global' })
    router.push('/login')
    router.refresh()
  }

  const searchParams  = useSearchParams()
  const currentTab    = searchParams.get('tab') ?? 'lynch'   // 기본값 lynch
  const avatarChar    = (displayName ?? email ?? '?')[0].toUpperCase()
  const isAnalysis    = pathname.startsWith('/analysis')

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      background: 'linear-gradient(180deg, #0d1117 0%, #111827 100%)',
      borderRight: '1px solid #1f2937',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* ── 로고 & 브랜딩 영역 (Glassmorphism) ───────────────── */}
      <div style={{ padding: '20px 16px 16px', position: 'relative' as const }}>

        {/* 유리 카드 배경 */}
        <div style={{
          position: 'relative' as const,
          borderRadius: 16,
          padding: '18px 18px 14px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden' as const,
        }}>
          {/* 은은한 골드 빛 번짐 */}
          <div style={{
            position: 'absolute' as const, top: -20, right: -20,
            width: 80, height: 80, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
            pointerEvents: 'none' as const,
          }}/>

          {/* 아이콘 + 텍스트 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="IS" style={{
              width: 40, height: 40, flexShrink: 0,
              filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.45)) drop-shadow(0 0 3px rgba(255,255,255,0.2))',
            }}/>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 메인 브랜드명 — 애플 스타일 미니멀 두꺼운 폰트 */}
              <div style={{
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: '-0.6px',
                lineHeight: 1.15,
                fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
                background: 'linear-gradient(135deg, #ffffff 0%, #f5e6c8 35%, #d4af37 65%, #f0f0f0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
              }}>
                2026 투자학교
              </div>

              {/* 슬로건 — 얇은 이탤릭, 골드 계열 */}
              <div style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 200,
                fontStyle: 'italic',
                letterSpacing: '0.15em',
                color: 'rgba(212,175,55,0.75)',
                fontFamily: '"Georgia", "Times New Roman", serif',
                whiteSpace: 'nowrap' as const,
              }}>
                Get Rich Slowly
              </div>
            </div>
          </div>

          {/* 교사 배지 */}
          {isTeacher && (
            <div style={{
              marginTop: 12,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: 'rgba(251,146,60,0.1)',
              border: '1px solid rgba(251,146,60,0.25)',
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 12 }}>🏫</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#fb923c', letterSpacing: '0.05em' }}>교장선생님모드</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)', margin: '0 12px' }}/>

      {/* ── 메인 메뉴 ─────────────────────────────────────── */}
      <nav style={{ padding: '14px 10px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
          MAIN MENU
        </div>

        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <a key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      active ? '#f1f5f9' : '#6b7280',
              background: active ? 'rgba(37,99,235,0.2)' : 'transparent',
              borderLeft: `3px solid ${active ? '#10b981' : 'transparent'}`,
              fontSize: 14, fontWeight: active ? 700 : 400,
              transition: 'all 0.12s', marginBottom: 3,
              boxShadow: active ? 'inset 0 0 0 1px rgba(37,99,235,0.15)' : 'none',
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLAnchorElement).style.color = '#d1d5db' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#6b7280' } }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>{icon}</span>
              {label}
            </a>
          )
        })}

        {/* ── 분석 도구 ── */}
        <div style={{ height: 1, background: '#1f2937', margin: '12px 4px 12px' }}/>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
          ANALYSIS TOOL
        </div>

        {ANALYSIS_NAV.map(({ href, icon, label }) => {
          // searchParams에서 tab 값을 읽어 정확히 판별
          const active = isAnalysis && (
            (href.includes('lynch')   && currentTab === 'lynch')   ||
            (href.includes('buffett') && currentTab === 'buffett')
          )
          return (
            <a key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      active ? '#f1f5f9' : '#6b7280',
              background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
              borderLeft: `3px solid ${active ? '#a78bfa' : 'transparent'}`,
              fontSize: 14, fontWeight: active ? 700 : 400,
              transition: 'all 0.12s', marginBottom: 3,
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(167,139,250,0.08)'; (e.currentTarget as HTMLAnchorElement).style.color = '#c4b5fd' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#6b7280' } }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>{icon}</span>
              {label}
            </a>
          )
        })}

        {/* ── 리서치 도구 ── */}
        <div style={{ height: 1, background: '#1f2937', margin: '12px 4px 12px' }}/>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
          RESEARCH
        </div>
        {RESEARCH_NAV.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <a key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      active ? '#f1f5f9' : '#6b7280',
              background: active ? 'rgba(251,191,36,0.12)' : 'transparent',
              borderLeft: `3px solid ${active ? '#fbbf24' : 'transparent'}`,
              fontSize: 14, fontWeight: active ? 700 : 400,
              transition: 'all 0.12s', marginBottom: 3,
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(251,191,36,0.07)'; (e.currentTarget as HTMLAnchorElement).style.color = '#fde68a' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#6b7280' } }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>{icon}</span>
              {label}
            </a>
          )
        })}

        {/* ── SCHOOL 섹션 ── */}
        <div style={{ height: 1, background: '#1f2937', margin: '12px 4px 12px' }}/>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
          SCHOOL
        </div>
        {SCHOOL_NAV.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <a key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      active ? '#f1f5f9' : '#6b7280',
              background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
              borderLeft: `3px solid ${active ? '#818cf8' : 'transparent'}`,
              fontSize: 14, fontWeight: active ? 700 : 400,
              transition: 'all 0.12s', marginBottom: 3,
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(99,102,241,0.07)'; (e.currentTarget as HTMLAnchorElement).style.color = '#a5b4fc' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#6b7280' } }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>{icon}</span>
              {label}
            </a>
          )
        })}

        {/* Teacher 전용 관리자 */}
        {isTeacher && (
          <>
            <div style={{ height: 1, background: '#1f2937', margin: '12px 4px 12px' }}/>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
              ADMIN
            </div>
            <a href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      pathname === '/admin' ? '#f1f5f9' : '#6b7280',
              background: pathname === '/admin' ? 'rgba(251,146,60,0.15)' : 'transparent',
              borderLeft: `3px solid ${pathname === '/admin' ? '#fb923c' : 'transparent'}`,
              fontSize: 14, fontWeight: pathname === '/admin' ? 700 : 400,
              transition: 'all 0.12s',
            }}>
              <span style={{ fontSize: 17, minWidth: 20, textAlign: 'center' as const }}>🏫</span>
              관리자 대시보드
            </a>
          </>
        )}
      </nav>

      {/* ── 사용자 프로필 ─────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #1f2937', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 0 10px rgba(37,99,235,0.35)' }}>
            {avatarChar}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName ?? email?.split('@')[0] ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {email}
            </div>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid #1f2937', color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1f2937' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            로그아웃
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' as const, marginBottom: 6 }}>정말 로그아웃?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '7px', borderRadius: 7, background: '#1f2937', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>취소</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: '7px', borderRadius: 7, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>나가기</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

// useSearchParams는 Suspense 경계 안에서 사용해야 함
export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  )
}
