'use client'
// 학생 간단 모드 셸 — 폰·태블릿은 하단 탭 4개, PC(769px↑)는 왼쪽 메뉴. 기존 35개 화면은 '분석' 링크로 그대로 연다.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TK, FS, RAD, SP, FONT_STACK } from '@/lib/theme'

const TABS = [
  { href: '/s', label: '홈', icon: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5' },
  { href: '/s/assets', label: '내 자산', icon: 'M12 3v9l7.8 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0' },
  { href: '/s/league', label: '리그', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3' },
  { href: '/s/learn', label: '배우기', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5' },
]
const isActive = (pathname: string, href: string) => href === '/s' ? pathname === '/s' : pathname.startsWith(href)

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="st-shell" style={{ display: 'flex', minHeight: '100dvh', background: TK.bg1, color: TK.slate200, fontFamily: FONT_STACK }}>
      <style>{`
        @media (max-width: 768px) { .st-rail { display: none !important } .st-main { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important } }
        @media (min-width: 769px) { .st-tabs { display: none !important } }
      `}</style>
      <nav className="st-rail" aria-label="학생 메뉴" style={{ width: 220, flexShrink: 0, padding: `${SP.xl}px ${SP.lg}px`, background: TK.bg0, borderRight: `1px solid ${TK.border}`, display: 'flex', flexDirection: 'column', gap: SP.xs, position: 'sticky', top: 0, height: '100dvh', boxSizing: 'border-box' }}>
        <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, padding: `0 ${SP.sm}px ${SP.xl}px` }}>투자학교</div>
        {TABS.map(t => {
          const on = isActive(pathname, t.href)
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: SP.sm, height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, background: on ? TK.card : 'transparent', color: on ? TK.slate100 : TK.slate300, fontSize: FS.body, fontWeight: on ? 700 : 500, textDecoration: 'none' }}>
              <Icon d={t.icon} size={20} />{t.label}
            </Link>
          )
        })}
        <div style={{ flexGrow: 1 }} />
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, color: TK.sub, fontSize: FS.tiny, textDecoration: 'none' }}>분석 화면 전체 보기</Link>
      </nav>
      <main className="st-main" style={{ flexGrow: 1, minWidth: 0, maxWidth: 1080, margin: '0 auto', padding: SP.lg, boxSizing: 'border-box' }}>{children}</main>
      <nav className="st-tabs" aria-label="학생 메뉴" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', height: 72, paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: TK.bg0, borderTop: `1px solid ${TK.border}` }}>
        {TABS.map(t => {
          const on = isActive(pathname, t.href)
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.xs, fontSize: FS.tiny, fontWeight: on ? 700 : 500, color: on ? TK.slate100 : TK.sub, textDecoration: 'none' }}>
              <Icon d={t.icon} />{t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
