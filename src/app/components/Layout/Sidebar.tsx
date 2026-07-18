'use client'

import { useState, useEffect, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK } from '@/lib/theme'

// ── 용도 기반 5그룹 — "매일 보는 것"이 맨 위, 나머지는 사전(레퍼런스) ──
interface NavItem { href: string; icon: string; label: string }
interface NavGroup { title: string; color: string; items: NavItem[] }
const GROUPS: NavGroup[] = [
  {
    title: '📌 매일', color: TK.emerald500,
    items: [
      { href: '/briefing',  icon: '🎯', label: '오늘의 매매 브리핑' },
      { href: '/win-lose',  icon: '⚔️', label: '승패 해부실' },
      { href: '/signal-report', icon: '📋', label: '앱 신호 성적표' },
      { href: '/dashboard', icon: '📊', label: '대시보드' },
    ],
  },
  {
    title: '💼 내 자산', color: TK.blue500,
    items: [
      { href: '/assets',  icon: '💼', label: '자산 관리' },
      { href: '/history', icon: '📋', label: '투자 기록' },
    ],
  },
  {
    title: '🔍 종목 확인', color: TK.amber400,
    items: [
      { href: '/research',             icon: '🔭', label: '종목 리서치' },
      { href: '/tech-chart',           icon: '📉', label: '기술적 차트' },
      { href: '/watchlist',            icon: '⭐', label: '관심종목' },
      { href: '/analysis?tab=lynch',   icon: '🔍', label: '피터린치 분석' },
      { href: '/analysis?tab=buffett', icon: '🛡️', label: '워렌버핏 분석' },
      { href: '/valuation',            icon: '📊', label: '최일 가치분석' },
    ],
  },
  {
    title: '🌍 시장 탐구', color: TK.violet400,
    items: [
      { href: '/dashboard?tab=rotation',            icon: '🧭', label: '섹터 로테이션 시계' },
      { href: '/dashboard?tab=moneyflow&view=unified', icon: '💰', label: '수급·통합추천' },
      { href: '/dashboard?tab=rebalance',           icon: '🤖', label: 'AI 리밸런싱' },
      { href: '/macro-hub',                         icon: '🌐', label: 'Macro Hub' },
    ],
  },
  {
    title: '🏠 부동산', color: TK.orange400,
    items: [
      { href: '/real-estate', icon: '🏠', label: '부동산 시장 대시보드' },
      { href: '/real-estate/honeycomb', icon: '🐝', label: '벌집순환모형(지역 사이클)' },
      { href: '/real-estate/apt', icon: '🔍', label: '아파트 단지 리서치' },
      { href: '/real-estate/plan2040', icon: '🏙️', label: '2040 서울플랜' },
    ],
  },
  {
    title: '📜 채권', color: '#2dd4bf',
    items: [
      { href: '/bonds', icon: '🧭', label: '듀레이션 나침반' },
    ],
  },
  {
    title: '🪙 암호화폐', color: TK.btcOrange,
    items: [
      { href: '/dashboard?tab=coinlab', icon: '🪙', label: '코인 랩' },
    ],
  },
  {
    title: '🎓 교육·학교', color: TK.indigo400,
    items: [
      { href: '/investment-academy', icon: '🎓', label: 'Investment Academy' },
      { href: '/master-strategy',    icon: '🏹', label: 'Master Strategy' },
      { href: '/school-lounge',      icon: '💬', label: 'School Lounge' },
      { href: '/school-league',      icon: '🏆', label: 'School League' },
    ],
  },
]

// 그룹 색상 → 활성/호버 스타일용 rgba
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

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
      background: `linear-gradient(180deg, #0d1117 0%, ${TK.gray900} 100%)`,
      borderRight: `1px solid ${TK.gray800}`,
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

          {/* ── 💵 시그니처 — DCF 철학(미래 현금흐름을 현재가치로 할인) ── */}
          <div style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid rgba(212,175,55,0.18)' }}>
            <div style={{
              fontSize: 10.5, fontWeight: 600, lineHeight: 1.55, letterSpacing: '0.01em',
              color: 'rgba(245,230,200,0.88)', fontFamily: '"Georgia","Times New Roman",serif',
            }}>
              미래에 벌어들일 현금흐름을{' '}
              <span style={{
                fontWeight: 800, fontStyle: 'italic',
                background: 'linear-gradient(135deg,#f5e6c8 0%,#d4af37 60%,#fffbe6 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>할인한다</span>
            </div>
            {/* 공식 — PV = Σ FCFₜ / (1+r)ᵗ (실제 분수 표기) */}
            <div style={{
              marginTop: 8, padding: '7px 10px', borderRadius: 9,
              background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(212,175,55,0.22)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontFamily: '"Cambria Math","Georgia",serif', userSelect: 'none' as const,
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#d4af37', fontStyle: 'italic' }}>PV</span>
              <span style={{ fontSize: 12, color: 'rgba(245,230,200,0.6)' }}>=</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#d4af37', lineHeight: 1, marginRight: 1 }}>Σ</span>
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
                <span style={{ fontSize: 11, color: '#f5e6c8', fontWeight: 700 }}>FCF<sub style={{ fontSize: 7.5 }}>t</sub></span>
                <span style={{ height: 1, width: '100%', minWidth: 46, background: 'rgba(212,175,55,0.55)', margin: '1.5px 0' }} />
                <span style={{ fontSize: 10.5, color: 'rgba(245,230,200,0.82)' }}>(1+r)<sup style={{ fontSize: 7.5 }}>t</sup></span>
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 9.5, fontWeight: 500, color: 'rgba(240,220,170,0.92)', letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.4 }}>
              돈의 시간가치 × 위험을 반영한 현재가치
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
              <span style={{ fontSize: 11, fontWeight: 600, color: TK.orange400, letterSpacing: '0.05em' }}>교장선생님모드</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)', margin: '0 12px' }}/>

      {/* ── 메인 메뉴 — 용도 기반 5그룹(📌매일이 맨 위, 나머지는 사전) ───────── */}
      <nav style={{ padding: '14px 10px', flex: 1 }}>
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            {gi > 0 && <div style={{ height: 1, background: TK.gray800, margin: '12px 4px 12px' }} />}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: g.color, letterSpacing: '0.08em', padding: '0 10px 9px', opacity: 0.9 }}>
              {g.title}
            </div>
            {g.items.map(({ href, icon, label }) => {
              // active 판정 — 쿼리 딥링크(?tab=, ?view=)는 쿼리까지 정확 일치, 일반 경로는 startsWith
              const [hPath, hQuery] = href.split('?')
              let active: boolean
              if (hQuery) {
                const hq = new URLSearchParams(hQuery)
                active = pathname === hPath && Array.from(hq.entries()).every(([k, v]) => searchParams.get(k) === v)
              } else if (hPath === '/dashboard' || hPath === '/real-estate') {
                // 하위 경로(딥링크·서브페이지)가 있는 허브는 정확 일치만 — 자식 항목과 이중 하이라이트 방지
                active = pathname === hPath && !searchParams.get('tab')
              } else if (hPath === '/analysis') {
                active = isAnalysis && !searchParams.get('tab')
              } else {
                active = pathname === hPath || pathname.startsWith(hPath + '/')
              }
              // /analysis?tab= 계열 특수 판별(기본 탭 lynch)
              if (hPath === '/analysis' && hQuery) {
                active = isAnalysis && currentTab === new URLSearchParams(hQuery).get('tab')
              }
              return (
                <a key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  color:      active ? TK.slate100 : TK.sub,
                  background: active ? rgba(g.color, 0.16) : 'transparent',
                  borderLeft: `3px solid ${active ? g.color : 'transparent'}`,
                  fontSize: 13.5, fontWeight: active ? 700 : 400,
                  transition: 'all 0.12s', marginBottom: 2,
                }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = rgba(g.color, 0.07); (e.currentTarget as HTMLAnchorElement).style.color = '#d1d5db' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = TK.sub } }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>{icon}</span>
                  {label}
                </a>
              )
            })}
          </div>
        ))}

        {/* Teacher 전용 관리자 */}
        {isTeacher && (
          <>
            <div style={{ height: 1, background: TK.gray800, margin: '12px 4px 12px' }}/>
            <div style={{ fontSize: 10, fontWeight: 700, color: TK.sub6, letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
              ADMIN
            </div>
            <a href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      pathname === '/admin' ? TK.slate100 : TK.sub,
              background: pathname === '/admin' ? 'rgba(251,146,60,0.15)' : 'transparent',
              borderLeft: `3px solid ${pathname === '/admin' ? TK.orange400 : 'transparent'}`,
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
      <div style={{ borderTop: `1px solid ${TK.gray800}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${TK.blue600},#7c3aed)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 0 10px rgba(37,99,235,0.35)' }}>
            {avatarChar}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: TK.slate100, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName ?? email?.split('@')[0] ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: TK.sub7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {email}
            </div>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: `1px solid ${TK.gray800}`, color: TK.sub, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = TK.red400; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = TK.sub; (e.currentTarget as HTMLButtonElement).style.borderColor = TK.gray800 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            로그아웃
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: TK.sub9, textAlign: 'center' as const, marginBottom: 6 }}>정말 로그아웃?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '7px', borderRadius: 7, background: TK.gray800, border: 'none', color: TK.sub9, fontSize: 12, cursor: 'pointer' }}>취소</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: '7px', borderRadius: 7, background: TK.red600, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>나가기</button>
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
