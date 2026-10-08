'use client'
// 학생 간단 모드 셸 — 폰·태블릿은 하단 탭 5개(홈·시장·내 자산·리그·배우기), PC(769px↑)는 왼쪽 메뉴. 기존 35개 화면은 '분석' 링크로 그대로 연다.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TK, FS, RAD, SP, FONT_STACK } from '@/lib/theme'
import LogoutButton from '@/app/components/student/LogoutButton'
import { setViewMode } from '@/lib/viewMode'
import { BrandMark, DcfSignature } from '@/app/components/Brand'
import ChangePasswordBanner from '@/app/components/ChangePasswordBanner'   // 임시 비밀번호 변경 안내 — 학생은 /s 로 착지하므로 여기서도 보여야 한다(2026-10-09)

const TABS = [
  { href: '/s', label: '홈', icon: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5' },
  { href: '/s/market', label: '시장', icon: 'M3 3v18h18M7 15l4-4 3 3 6-7' },
  { href: '/s/assets', label: '내 자산', icon: 'M12 3v9l7.8 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0' },
  { href: '/s/league', label: '리그', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3' },
  { href: '/s/learn', label: '배우기', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5' },
]
// 홈은 정확히 '/s' 만, 나머지는 그 경로와 하위 경로(/s/market?tab=… 는 쿼리라 pathname 에 안 들어온다)
const isActive = (pathname: string, href: string) => href === '/s' ? pathname === '/s' : pathname === href || pathname.startsWith(`${href}/`)

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="st-shell" style={{ display: 'flex', minHeight: '100dvh', background: TK.bg1, color: TK.slate200, fontFamily: FONT_STACK }}>
      {/* 두 조건은 정확한 여집합이어야 한다 — max-width:768 / min-width:769 로 두면 화면 확대(폭 768.4px 등)에서 둘 다 안 맞아 탭과 왼쪽 메뉴가 함께 뜬다(실측) */}
      <style>{`
        @media not all and (min-width: 769px) { .st-rail { display: none !important } .st-main { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important } }
        @media (min-width: 769px) { .st-tabs, .st-top, .st-foot { display: none !important } }
        ::-webkit-scrollbar { width: 5px; height: 5px }
        ::-webkit-scrollbar-track { background: ${TK.bg0} }
        ::-webkit-scrollbar-thumb { background: ${TK.gray800}; border-radius: 99px }
      `}</style>
      <nav className="st-rail" aria-label="학생 메뉴" style={{ width: 220, flexShrink: 0, padding: `${SP.xl}px ${SP.lg}px`, background: TK.bg0, borderRight: `1px solid ${TK.border}`, display: 'flex', flexDirection: 'column', gap: SP.xs, position: 'sticky', top: 0, height: '100dvh', boxSizing: 'border-box' }}>
        {/* 브랜드 — 분석 화면 왼쪽 메뉴와 같은 로고·워드마크(components/Brand) */}
        <Link href="/s" aria-label="홈" style={{ display: 'block', padding: `0 ${SP.sm}px ${SP.xl}px`, textDecoration: 'none', minHeight: 0 }}><BrandMark /></Link>
        {TABS.map(t => {
          const on = isActive(pathname, t.href)
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: SP.sm, height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, background: on ? TK.card : 'transparent', color: on ? TK.slate100 : TK.slate300, fontSize: FS.body, fontWeight: on ? 700 : 500, textDecoration: 'none' }}>
              <Icon d={t.icon} size={20} />{t.label}
            </Link>
          )
        })}
        <div style={{ flexGrow: 1 }} />
        {/* 철학 서명 — 분석 화면 왼쪽 메뉴 발치와 같은 자리 */}
        <div style={{ padding: `${SP.md}px ${SP.sm}px`, borderTop: '1px solid rgba(212,175,55,0.18)' }}><DcfSignature /></div>
        {/* 분석 화면으로 가면 그 선택을 쿠키에 남긴다 — 다음 로그인·앱 아이콘(/start)도 분석 화면으로 연다(홈 인사 줄 링크와 같은 규칙) */}
        <Link href="/dashboard" onClick={() => setViewMode('full')} style={{ display: 'flex', alignItems: 'center', height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, color: TK.sub, fontSize: FS.tiny, textDecoration: 'none' }}>분석 화면 전체 보기</Link>
        <LogoutButton style={{ display: 'flex', alignItems: 'center', height: 44, padding: `0 ${SP.md}px`, borderRadius: RAD.sm, border: 'none', background: 'transparent', color: TK.sub, fontSize: FS.tiny, textAlign: 'left' }} />
      </nav>
      <main className="st-main" style={{ flexGrow: 1, minWidth: 0, maxWidth: 1080, margin: '0 auto', padding: SP.lg, boxSizing: 'border-box' }}>
        {/* 폰·태블릿 — 왼쪽 메뉴가 없으니 맨 위 브랜드 한 줄, 맨 아래 철학 서명(PC 는 왼쪽 메뉴가 들고 있어 숨긴다) */}
        <Link href="/s" className="st-top" aria-label="홈" style={{ display: 'block', paddingBottom: SP.lg, textDecoration: 'none', minHeight: 0 }}><BrandMark compact /></Link>
        <div style={{ marginBottom: SP.lg }}><ChangePasswordBanner /></div>
        {children}
        <div className="st-foot" style={{ maxWidth: 260, margin: `${SP.xl}px auto 0`, paddingTop: SP.lg, borderTop: '1px solid rgba(212,175,55,0.18)' }}><DcfSignature /></div>
      </main>
      <nav className="st-tabs" aria-label="학생 메뉴" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100, display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`, height: 'calc(72px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: TK.bg0, borderTop: `1px solid ${TK.border}` }}>
        {TABS.map(t => {
          const on = isActive(pathname, t.href)
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.xs, minWidth: 0, fontSize: FS.tiny, fontWeight: on ? 700 : 500, color: on ? TK.slate100 : TK.sub, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <Icon d={t.icon} />{t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
