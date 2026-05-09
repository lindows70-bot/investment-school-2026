'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', icon: '📊', label: '대시보드' },
  { href: '/assets',    icon: '💼', label: '자산관리' },
  { href: '/history',   icon: '📋', label: '투자기록' },
  { href: '/analysis',  icon: '📈', label: '투자분석' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const [email,      setEmail]      = useState<string | null>(null)
  const [isTeacher,  setIsTeacher]  = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setEmail(data.user.email ?? null)
      const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
      setIsTeacher(p?.role === 'teacher')
    })
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut({ scope: 'global' })
    router.push('/login')
    router.refresh()
  }

  const avatarChar = (email?.[0] ?? '?').toUpperCase()

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: '#111827',
      borderRight: '1px solid #1f2937',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.svg" alt="IS" style={{ width: 34, height: 34, flexShrink: 0 }}/>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>2026 투자학교</div>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1, fontStyle: 'italic' }}>Get Rich Slowly</div>
        </div>
      </div>

      <div style={{ height: 1, background: '#1f2937', margin: '0 16px' }}/>

      {/* Navigation */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', letterSpacing: '0.1em', padding: '4px 12px 10px', textTransform: 'uppercase' as const }}>
          MAIN MENU
        </div>

        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <a key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
              color:      active ? '#f1f5f9' : '#6b7280',
              background: active ? 'rgba(37,99,235,0.18)' : 'transparent',
              borderLeft: `3px solid ${active ? '#10b981' : 'transparent'}`,
              fontSize: 13, fontWeight: active ? 600 : 400,
              transition: 'all 0.12s', marginBottom: 2,
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLAnchorElement).style.color = '#d1d5db' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#6b7280' } }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
              {label}
            </a>
          )
        })}

        {/* Teacher-only section */}
        {isTeacher && (
          <>
            <div style={{ height: 1, background: '#1f2937', margin: '10px 4px' }}/>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', letterSpacing: '0.1em', padding: '4px 12px 10px', textTransform: 'uppercase' as const }}>
              ANALYSIS TOOL
            </div>
            <a href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
              color:      pathname === '/admin' ? '#f1f5f9' : '#6b7280',
              background: pathname === '/admin' ? 'rgba(124,58,237,0.18)' : 'transparent',
              borderLeft: `3px solid ${pathname === '/admin' ? '#7c3aed' : 'transparent'}`,
              fontSize: 13, fontWeight: pathname === '/admin' ? 600 : 400,
              transition: 'all 0.12s',
            }}>
              <span style={{ fontSize: 15 }}>🏫</span>
              관리자 대시보드
            </a>
          </>
        )}
      </nav>

      {/* User profile + logout */}
      <div style={{ borderTop: '1px solid #1f2937', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {avatarChar}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email?.split('@')[0] ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </div>
          </div>
          {isTeacher && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>
              TEACHER
            </span>
          )}
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{ width: '100%', padding: '7px', borderRadius: 7, background: 'transparent', border: '1px solid #1f2937', color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1f2937' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            로그아웃
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 6 }}>정말 로그아웃?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#1f2937', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>취소</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>나가기</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
