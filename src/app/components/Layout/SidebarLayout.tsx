'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'

// 사이드바 레이아웃을 적용하지 않는 경로
const NO_LAYOUT = ['/login', '/signup']

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const noLayout = NO_LAYOUT.some(p => pathname === p || pathname.startsWith(p + '?'))

  if (noLayout) return <>{children}</>

  return (
    <>
      {/* 모바일/데스크톱 스타일 */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-wrap { display: none !important }
          .main-content { padding: 16px !important }
        }
        @media (min-width: 769px) {
          .bottom-tabs { display: none !important }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px }
        ::-webkit-scrollbar-track { background: #0a0a0a }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 99px }
      `}</style>

      <div style={{
        display: 'flex',
        height: '100vh',
        background: '#0a0a0a',
        overflow: 'hidden',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}>
        {/* ── 사이드바 ── */}
        <div className="sidebar-wrap" style={{ flexShrink: 0 }}>
          <Sidebar />
        </div>

        {/* ── 우측: 헤더 + 콘텐츠 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <TopHeader />
          <main
            className="main-content"
            style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 60px', color: '#f1f5f9' }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* ── 모바일 하단 탭바 ── */}
      <nav className="bottom-tabs" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#111827', borderTop: '1px solid #1f2937',
        display: 'flex', zIndex: 100,
        fontFamily: '-apple-system,sans-serif',
      }}>
        {[
          { href: '/dashboard', icon: '📊', label: '홈' },
          { href: '/assets',    icon: '💼', label: '자산' },
          { href: '/history',   icon: '📋', label: '기록' },
          { href: '/analysis',  icon: '📈', label: '분석' },
        ].map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <a key={href} href={href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 12px', gap: 3, textDecoration: 'none',
              color: active ? '#3b82f6' : '#8a96a8',
              fontSize: 10, fontWeight: active ? 600 : 400,
            }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              {label}
            </a>
          )
        })}
      </nav>
    </>
  )
}
