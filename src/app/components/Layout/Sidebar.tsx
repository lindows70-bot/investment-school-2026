'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, SP, FONT_STACK } from '@/lib/theme'
import { setViewMode } from '@/lib/viewMode'

// ── 용도 기반 그룹 — "매일 보는 것"이 맨 위, 나머지는 사전(레퍼런스) ──
//    ⭐ export 이유: 상단바(TopHeader)가 페이지 제목을 여기서 파생한다. 예전엔 제목 표가 따로 있어
//       5개만 등록돼 있었고 나머지 29개 화면이 전부 '투자학교'로 떴다 — 같은 이름은 한 곳에서만 정의한다.
export interface NavItem { href: string; icon: string; label: string }
export interface NavGroup { title: string; color: string; items: NavItem[] }
export const GROUPS: NavGroup[] = [
  {
    title: '📌 매일', color: TK.emerald500,
    items: [
      { href: '/briefing',  icon: '🎯', label: '오늘의 매매 브리핑' },
      { href: '/weekly-report', icon: '📄', label: '주간 리포트' },
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
      { href: '/earnings-reports',     icon: '📑', label: '실적 리포트' },
      { href: '/tech-chart',           icon: '📉', label: '기술적 차트' },
      { href: '/tech-screener',        icon: '🔎', label: '기술적 종목 검색기' },
      { href: '/watchlist',            icon: '⭐', label: '관심종목' },
      { href: '/analysis?tab=lynch',   icon: '🔍', label: '린치·버핏 분석' },
      { href: '/valuation',            icon: '📊', label: '최일 가치분석' },
      { href: '/guru-portfolio',       icon: '🐳', label: '거인의 포트폴리오' },
    ],
  },
  {
    // 여러 근거로 종목을 추천하는 곳을 한 그룹으로(지도=근거·위계 안내). 중복 방지 위해 시장 탐구에서 이관
    title: '🎯 종목 추천', color: '#a855f7',
    items: [
      { href: '/reco-hub', icon: '🗺️', label: '추천 지도 — 모든 추천 입구' },
      // 🧭 대시보드 탭 딥링크(코인 랩 선례) — 성적표(전향 검증)까지 붙은 핵심 화면인데 탭 속에만 있었다(2026-08-21 사용자 요청)
      { href: '/dashboard?tab=rotation', icon: '🧭', label: '섹터 로테이션 시계 — 돈의 물길' },
      // 🐎 전용 크론·헬스 감시까지 있는 정식 기능인데 내비게이션에서만 빠져 있었다(추천 지도 카드로만 진입 가능)
      { href: '/hi52-radar', icon: '🐎', label: '신고가 레이더 — 달리는 말' },
      // 🎯 중장기 본류와 분리된 단기 트랙 — 국면이 맞을 때만 켜지고 대부분의 날은 비어 있다
      { href: '/swing', icon: '🎯', label: '스윙 타점 — 1~2주 짧게' },
    ],
  },
  {
    title: '🌍 시장 탐구', color: TK.violet400,
    items: [
      { href: '/macro-hub', icon: '🌐', label: 'Macro Hub — 계절·막스·위기' },
      { href: '/us-smart-money', icon: '🇺🇸', label: '미국 스마트머니 — 큰돈은 어디로' },
    ],
  },
  {
    title: '🏠 부동산', color: TK.orange400,
    items: [
      { href: '/real-estate', icon: '🏠', label: '부동산 시장 대시보드' },
      { href: '/real-estate/honeycomb', icon: '🐝', label: '벌집순환모형(지역 사이클)' },
      { href: '/real-estate/apt', icon: '🔍', label: '아파트 단지 리서치' },
      { href: '/real-estate/redevelopment', icon: '🏗️', label: '정비사업(재건축·재개발)' },
      { href: '/real-estate/plan2040', icon: '🏙️', label: '2040 서울플랜' },
    ],
  },
  {
    title: '💵 배당', color: TK.amber500,
    items: [
      { href: '/dividend', icon: '💵', label: '배당 인컴 랩' },
    ],
  },
  {
    title: '📜 채권', color: '#2dd4bf',
    items: [
      { href: '/bonds', icon: '🧭', label: '듀레이션 나침반 — 시뮬·스트레스' },
    ],
  },
  {
    title: '🪙 암호화폐', color: TK.btcOrange,
    items: [
      { href: '/dashboard?tab=coinlab&cv=btc', icon: '₿', label: '코인 랩 — BTC·알트·스테이블·관련주' },
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
  // 📂 '매일'·'내 자산' 밖의 8개 그룹은 접어 둔다 — 실측(2026-09-03) 메뉴 33개 중 스크롤 없이
  //    보이는 건 9개뿐이었고, 그룹 10개가 전부 같은 무게라 '매일'과 '채권(항목 1개)'이 동급으로 보였다.
  const [moreOpen,   setMoreOpen]   = useState(false)

  // 사이드바가 <a> 풀 네비로 리마운트될 때 스크롤이 맨 위로 튀는 문제 →
  // 마운트 후 활성 항목이 사이드바 중앙에 오도록 aside 스크롤만 조정(윈도우·메인 영향 없음)
  const asideRef  = useRef<HTMLElement | null>(null)
  const activeRef = useRef<HTMLAnchorElement | null>(null)

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

  // active 판정 — 쿼리 딥링크(?tab=, ?view=)는 쿼리까지 정확 일치, 일반 경로는 startsWith.
  // 그룹 접기와 렌더가 **같은 규칙**을 써야 하므로 함수로 분리했다(접힌 그룹 안에 현재 화면이 있으면 자동으로 펼친다).
  const isActiveHref = (href: string): boolean => {
    const [hPath, hQuery] = href.split('?')
    let active: boolean
    if (hQuery) {
      const hq = new URLSearchParams(hQuery)
      active = pathname === hPath && Array.from(hq.entries()).every(([k, v]) => searchParams.get(k) === v)
    } else if (hPath === '/dashboard' || hPath === '/real-estate' || hPath === '/macro-hub') {
      // 하위 경로·탭 딥링크가 있는 허브는 정확 일치+탭 없을 때만 — 자식 항목과 이중 하이라이트 방지
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
    return active
  }

  // 📂 위 2그룹(📌 매일 · 💼 내 자산)만 상시 노출, 나머지 8그룹은 '더 보기'로 접는다.
  //    단 현재 보고 있는 화면이 접힌 그룹에 있으면 자동으로 펼친다(내 위치를 잃지 않게).
  const PINNED = 2
  const restGroups   = GROUPS.slice(PINNED)
  const activeInRest = restGroups.some(g => g.items.some(it => isActiveHref(it.href)))
  const showRest     = moreOpen || activeInRest
  const restCount    = restGroups.reduce((n, g) => n + g.items.length, 0)

  // 활성 항목을 사이드바 중앙으로(리마운트·teacher 섹션 지연 렌더 모두 대응)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const aside = asideRef.current, el = activeRef.current
      if (!aside || !el) return
      const ar = aside.getBoundingClientRect(), er = el.getBoundingClientRect()
      const delta = (er.top - ar.top) - (aside.clientHeight / 2 - el.clientHeight / 2)
      aside.scrollTop = Math.max(0, aside.scrollTop + delta)
    })
    return () => cancelAnimationFrame(id)
  }, [pathname, currentTab, isTeacher])

  return (
    <aside ref={asideRef} style={{
      width: 260, flexShrink: 0,
      background: `linear-gradient(180deg, #0d1117 0%, ${TK.gray900} 100%)`,
      borderRight: `1px solid ${TK.gray800}`,
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
      fontFamily: FONT_STACK,
    }}>

      {/* ── 로고 & 브랜딩 — 한 줄 압축(2026-09-03) ─────────────────
          구 블록(유리카드 + 슬로건 + DCF 공식 + 캡션)은 사이드바 높이의 **34%(264px)** 를 차지해
          첫 메뉴가 그 아래에서 시작했고, 메뉴 33개 중 스크롤 없이 보이는 건 9개뿐이었다(실측).
          ⚠️ DCF 철학 서명은 **지우지 않고 하단(프로필 위)으로 옮겼다** — 브랜드는 남기고 자리만 내준다. */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="IS" style={{
            width: 34, height: 34, flexShrink: 0,
            filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.42))',
          }}/>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 토큰예외: 브랜드 워드마크의 골드 그라데이션 — 로고와 한 벌인 아이덴티티 색이라 TK 의미색으로 대체 불가(값 자체는 기존 것 유지) */}
            <div style={{
              fontSize: FS.lg, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15,
              whiteSpace: 'nowrap' as const,
              fontFamily: FONT_STACK,
              background: 'linear-gradient(135deg, #ffffff 0%, #f5e6c8 35%, #d4af37 65%, #f0f0f0 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              2026 투자학교
            </div>
            <div style={{
              marginTop: 1, fontSize: FS.micro, fontWeight: 300, fontStyle: 'italic',
              letterSpacing: '0.12em', color: 'rgba(212,175,55,0.8)',
              fontFamily: '"Georgia", "Times New Roman", serif', whiteSpace: 'nowrap' as const,
            }}>
              Get Rich Slowly
            </div>
          </div>
        </div>

        {/* 교사 배지 — 260px 안에서 브랜드명과 같은 줄에 두면 '2026 투자학 / 교'로 줄바꿈된다 */}
        {isTeacher && (
          <div style={{ marginTop: 9 }}>
            <span title="교장선생님(teacher) 모드" style={{
              display: 'inline-block',
              fontSize: FS.micro, fontWeight: 700, color: TK.orange400,
              background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)',
              borderRadius: 8, padding: '3px 9px', whiteSpace: 'nowrap' as const,
            }}>
              🏫 교장선생님 모드
            </span>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)', margin: '0 12px' }}/>

      {/* ── 메인 메뉴 — 📌 매일 · 💼 내 자산만 상시 노출, 나머지 8그룹은 '더 보기'로 접는다 ───────── */}
      <nav style={{ padding: '14px 10px', flex: 1 }}>
        {(() => {
          const renderGroup = (g: NavGroup, gi: number) => (
            <div key={g.title}>
              {gi > 0 && <div style={{ height: 1, background: TK.gray800, margin: '12px 4px 12px' }} />}
              <div style={{ fontSize: FS.micro, fontWeight: 800, color: g.color, letterSpacing: '0.08em', padding: '0 10px 9px', opacity: 0.9 }}>
                {g.title}
              </div>
              {g.items.map(({ href, icon, label }) => {
                const active = isActiveHref(href)
                return (
                  <a key={href} href={href} ref={active ? activeRef : undefined} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                    color:      active ? TK.slate100 : TK.sub,
                    background: active ? rgba(g.color, 0.16) : 'transparent',
                    borderLeft: `3px solid ${active ? g.color : 'transparent'}`,
                    fontSize: FS.body, fontWeight: active ? 700 : 400,
                    transition: 'all 0.12s', marginBottom: 2,
                  }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = rgba(g.color, 0.07); (e.currentTarget as HTMLAnchorElement).style.color = '#d1d5db' } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = TK.sub } }}
                  >
                    <span style={{ fontSize: FS.lg, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>{icon}</span>
                    {label}
                  </a>
                )
              })}
            </div>
          )
          return (
            <>
              {GROUPS.slice(0, PINNED).map((g, gi) => renderGroup(g, gi))}

              {/* 더 보기 — 현재 화면이 접힌 그룹 안에 있으면 이미 펼쳐져 있으므로 토글을 숨긴다 */}
              {!activeInRest && (
                <button
                  type="button"
                  onClick={() => setMoreOpen(v => !v)}
                  aria-expanded={showRest}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    margin: '14px 0 2px', padding: '9px 12px', borderRadius: 10,
                    background: 'transparent', border: `1px dashed ${TK.gray800}`,
                    color: TK.sub, fontSize: FS.tiny, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = TK.gray900; (e.currentTarget as HTMLButtonElement).style.color = TK.slate100 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = TK.sub }}
                >
                  {showRest ? '접기' : `그 밖의 메뉴 ${restCount}개 더 보기`}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.18s', transform: showRest ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}

              {showRest && restGroups.map((g, gi) => renderGroup(g, gi + PINNED))}
            </>
          )
        })()}

        {/* Teacher 전용 관리자 */}
        {isTeacher && (
          <>
            <div style={{ height: 1, background: TK.gray800, margin: '12px 4px 12px' }}/>
            <div style={{ fontSize: FS.micro, fontWeight: 700, color: TK.sub6, letterSpacing: '0.12em', padding: '0 10px 10px', textTransform: 'uppercase' as const }}>
              ADMIN
            </div>
            <a href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color:      pathname === '/admin' ? TK.slate100 : TK.sub,
              background: pathname === '/admin' ? 'rgba(251,146,60,0.15)' : 'transparent',
              borderLeft: `3px solid ${pathname === '/admin' ? TK.orange400 : 'transparent'}`,
              fontSize: FS.body, fontWeight: pathname === '/admin' ? 700 : 400,
              transition: 'all 0.12s',
            }}>
              <span style={{ fontSize: FS.lg, minWidth: 20, textAlign: 'center' as const }}>🏫</span>
              관리자 대시보드
            </a>
          </>
        )}

        {/* 🎒 간편 화면(학생 홈)으로 — 모드를 쿠키에 남겨 다음 로그인도 간편 화면으로 착지한다(선생님도 보인다) */}
        <div style={{ height: 1, background: TK.gray800, margin: `${SP.md}px ${SP.xs}px` }}/>
        {/* 토큰예외: 세로 여백 9·라운드 10·아이콘 칸 20 은 바로 위 메뉴 항목들과 같은 모양을 맞추려는 값(SP·RAD 에 없음) */}
        <a href="/s" onClick={() => setViewMode('simple')} style={{
          display: 'flex', alignItems: 'center', gap: SP.md,
          padding: `9px ${SP.md}px`, borderRadius: 10, textDecoration: 'none',
          color: TK.sub, background: 'transparent',
          borderLeft: '3px solid transparent',
          fontSize: FS.body, fontWeight: 400,
          transition: 'all 0.12s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = TK.gray900; (e.currentTarget as HTMLAnchorElement).style.color = TK.slate100 }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = TK.sub }}
        >
          <span style={{ fontSize: FS.lg, lineHeight: 1, minWidth: 20, textAlign: 'center' as const }}>🎒</span>
          간편 화면
        </a>
      </nav>

      {/* ── 💵 시그니처 — DCF 철학(미래 현금흐름을 현재가치로 할인) ──────────
          2026-09-03 상단 브랜드 블록에서 여기로 내렸다. 지우지 않은 이유 = 이 앱의 철학 서명이고,
          매일 쓰는 메뉴가 그 아래에서 시작하던 것만이 문제였다. 이제 메뉴가 먼저, 서명이 발치에 있다. */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(212,175,55,0.18)' }}>
          <div style={{
            fontSize: FS.micro, fontWeight: 600, lineHeight: 1.55, letterSpacing: '0.01em',
            color: 'rgba(245,230,200,0.88)', fontFamily: '"Georgia","Times New Roman",serif',
          }}>
            미래에 벌어들일 현금흐름을{' '}
            {/* 토큰예외: 위와 같은 브랜드 골드 그라데이션(철학 서명의 강조어) */}
            <span style={{
              fontWeight: 800, fontStyle: 'italic',
              background: 'linear-gradient(135deg,#f5e6c8 0%,#d4af37 60%,#fffbe6 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>할인한다</span>
          </div>
          {/* 공식 — PV = Σ FCFₜ / (1+r)ᵗ (실제 분수 표기) */}
          <div style={{
            marginTop: 7, padding: '6px 10px', borderRadius: 9,
            background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(212,175,55,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: '"Cambria Math","Georgia",serif', userSelect: 'none' as const,
          }}>
            <span style={{ fontSize: FS.tiny, fontWeight: 800, color: '#d4af37', fontStyle: 'italic' }}>PV</span>
            <span style={{ fontSize: FS.micro, color: 'rgba(245,230,200,0.6)' }}>=</span>
            <span style={{ fontSize: FS.lg, fontWeight: 700, color: '#d4af37', lineHeight: 1, marginRight: 1 }}>Σ</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
              {/* 토큰예외: 수식의 아래·위 첨자(t)는 밑글자보다 작아야 수식으로 읽힌다 — FS 최소단(micro 11)으로는 첨자 표현 불가.
                  읽을 문장이 아니라 수식 기호이므로 '설명문 micro 금지' 규칙 대상도 아니다. */}
              <span style={{ fontSize: FS.micro, color: '#f5e6c8', fontWeight: 700 }}>FCF<sub style={{ fontSize: 8 }}>t</sub></span>
              <span style={{ height: 1, width: '100%', minWidth: 46, background: 'rgba(212,175,55,0.55)', margin: '1.5px 0' }} />
              <span style={{ fontSize: FS.micro, color: 'rgba(245,230,200,0.82)' }}>(1+r)<sup style={{ fontSize: 8 }}>t</sup></span>
            </span>
          </div>
        </div>
      </div>

      {/* ── 사용자 프로필 ─────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${TK.gray800}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${TK.blue600},#7c3aed)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.body, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 0 10px rgba(37,99,235,0.35)' }}>
            {avatarChar}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: FS.tiny, color: TK.slate100, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName ?? email?.split('@')[0] ?? '—'}
            </div>
            <div style={{ fontSize: FS.micro, color: TK.sub7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {email}
            </div>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: `1px solid ${TK.gray800}`, color: TK.sub, fontSize: FS.tiny, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
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
            <div style={{ fontSize: FS.tiny, color: TK.sub9, textAlign: 'center' as const, marginBottom: 6 }}>정말 로그아웃?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '7px', borderRadius: 7, background: TK.gray800, border: 'none', color: TK.sub9, fontSize: FS.tiny, cursor: 'pointer' }}>취소</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: '7px', borderRadius: 7, background: TK.red600, border: 'none', color: '#fff', fontSize: FS.tiny, fontWeight: 600, cursor: 'pointer' }}>나가기</button>
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
