'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import { TK, FS, FONT_STACK } from '@/lib/theme'

// 사이드바 레이아웃을 적용하지 않는 경로
const NO_LAYOUT = ['/login', '/signup']

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const noLayout = NO_LAYOUT.some(p => pathname === p || pathname.startsWith(p + '?'))

  // 📱 모바일 전체 메뉴 서랍 — 하단 탭 4개로는 📌 매일 5개 중 4개에 갈 길이 없었다(2026-09-03 실측).
  //    탭을 더 늘리는 대신 사이드바를 그대로 서랍으로 띄운다 → 33개 항목 전부 도달 가능.
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (noLayout) return <>{children}</>

  return (
    <>
      {/* 모바일/데스크톱 스타일 */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-wrap { display: none !important }
          /* 하단 고정 탭바(약 62px)에 본문 끝이 가리던 문제 — 아래 여백을 탭바 높이 이상으로 */
          .main-content { padding: 16px 16px 96px !important }
        }
        @media (min-width: 769px) {
          .bottom-tabs { display: none !important }
          .nav-drawer  { display: none !important }
        }
        /* 좁은 화면에선 상단바 한 줄(52px)에 브랜드+환율+날짜가 다 못 선다 — 환율은 대시보드에도 있으므로 뺀다 */
        @media (max-width: 430px) { .header-fx { display: none !important } }
        ::-webkit-scrollbar { width: 5px; height: 5px }
        ::-webkit-scrollbar-track { background: #0a0a0a }
        ::-webkit-scrollbar-thumb { background: ${TK.gray800}; border-radius: 99px }
        @keyframes drawerIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @media (prefers-reduced-motion: reduce) { .nav-drawer-panel { animation: none !important } }
      `}</style>

      <div style={{
        display: 'flex',
        height: '100vh',
        background: '#0a0a0a',
        overflow: 'hidden',
        fontFamily: FONT_STACK,
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
            style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 60px', color: TK.slate100 }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* ── 📱 모바일 전체 메뉴 서랍 (사이드바 재사용 — 메뉴 정의가 한 곳에 유지된다) ── */}
      {drawerOpen && (
        <div className="nav-drawer" style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex' }}>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(3px)' }}
          />
          <div className="nav-drawer-panel" style={{
            position: 'relative', height: '100%',
            boxShadow: '0 0 48px rgba(0,0,0,0.75)',
            animation: 'drawerIn 0.18s ease-out',
          }}>
            <Sidebar />
          </div>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'absolute', top: 12, left: 272,
              width: 40, height: 40, borderRadius: 99,
              background: TK.gray900, border: `1px solid ${TK.gray800}`,
              color: TK.slate100, fontSize: FS.lg, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 모바일 하단 탭바 ── */}
      {/* 📌 매일 그룹의 첫 화면(브리핑)을 첫 탭으로 — 구 4탭(홈·자산·기록·분석)에는 브리핑·주간·승패·성적표로
          가는 길이 아예 없어, 휴대폰에서는 매일 볼 화면 5개 중 4개에 도달할 수 없었다. */}
      <nav className="bottom-tabs" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: TK.gray900, borderTop: `1px solid ${TK.gray800}`,
        display: 'flex', zIndex: 100,
        fontFamily: FONT_STACK,
      }}>
        {[
          { href: '/briefing',  icon: '🎯', label: '브리핑' },
          { href: '/dashboard', icon: '📊', label: '대시보드' },
          { href: '/assets',    icon: '💼', label: '자산' },
          { href: '/history',   icon: '📋', label: '기록' },
        ].map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <a key={href} href={href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 12px', gap: 3, textDecoration: 'none',
              color: active ? TK.blue500 : TK.sub7,
              fontSize: FS.micro, fontWeight: active ? 600 : 400,
            }}>
              <span style={{ fontSize: FS.xl }}>{icon}</span>
              {label}
            </a>
          )
        })}

        {/* 전체 메뉴 — 나머지 29개 화면으로 가는 유일한 모바일 경로 */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="전체 메뉴 열기"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 12px', gap: 3,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TK.sub7, fontSize: FS.micro, fontWeight: 400,
          }}
        >
          <span style={{ fontSize: FS.xl }}>☰</span>
          전체
        </button>
      </nav>
    </>
  )
}
