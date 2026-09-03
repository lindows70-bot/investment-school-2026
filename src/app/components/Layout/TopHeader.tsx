'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TK, FS } from '@/lib/theme'
import { USD_KRW_FALLBACK } from '@/lib/fx'   // 💱 환율 폴백 SSOT(상수 분열 방지)
import { GROUPS } from './Sidebar'            // 🏷️ 페이지 제목 = 사이드바 라벨(이름은 한 곳에서만 정의)

// 경로 → 제목. 사이드바 메뉴 라벨에서 파생한다 — 예전엔 표를 따로 들고 있어 5개만 등록돼 있었고
// 나머지 29개 화면이 전부 '투자학교'로 떴다(2026-09-03 실측). 쿼리 딥링크는 경로만 취하고 먼저 온 것이 이긴다.
const PAGE_TITLES: Record<string, string> = (() => {
  const m: Record<string, string> = { '/admin': '관리자 대시보드' }
  for (const g of GROUPS) {
    for (const it of g.items) {
      const p = it.href.split('?')[0]
      if (!(p in m)) m[p] = it.label.split(' — ')[0]   // 대시 뒤 부제는 상단바에서 뺀다
    }
  }
  return m
})()

// 정확 일치 → 없으면 가장 긴 상위 경로(/real-estate/apt 같은 하위 화면)
const titleOf = (pathname: string): string => {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const hit = Object.keys(PAGE_TITLES)
    .filter(p => pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return hit ? PAGE_TITLES[hit] : '투자학교'
}

// dashboard/page.tsx 와 동일한 캐시 키 사용 → 두 컴포넌트가 같은 값 표시
const CACHE_KEY = 'usd_krw_rate'
const HOUR_MS   = 60 * 60 * 1000

export default function TopHeader() {
  const pathname = usePathname()
  const [usdKrw, setUsdKrw] = useState<number | null>(null)
  // 📅 날짜는 마운트 후에만 — 렌더 중 new Date() 는 서버(UTC)와 클라이언트(KST)의 날짜가
  //    자정~오전 9시(KST) 사이 하루 어긋나, 전 페이지 하이드레이션 불일치(React #425)를 일으켰다.
  //    스쿨 리그가 '집계 중…'에서 얼어붙은 사고의 뿌리 — 낮에는 두 날짜가 같아 안 보였다.
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    setToday(new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }))
  }, [])

  const title = titleOf(pathname)

  // USD/KRW 환율 — /api/exchange-rate 단일 소스, localStorage 공유 캐시
  useEffect(() => {
    const load = async () => {
      // 1. localStorage 캐시 확인
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { rate, savedAt } = JSON.parse(cached) as { rate: number; savedAt: string }
          if (Date.now() - new Date(savedAt).getTime() < HOUR_MS) {
            setUsdKrw(Math.round(rate))
            return
          }
        }
      } catch { /* ignore */ }

      // 2. API 호출
      try {
        const res = await fetch('/api/exchange-rate')
        if (res.ok) {
          const { rate } = await res.json() as { rate: number }
          if (typeof rate === 'number' && rate > 0) {
            const rounded = Math.round(rate)
            setUsdKrw(rounded)
            localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: rounded, savedAt: new Date().toISOString() }))
            return
          }
        }
      } catch { /* fallback */ }

      setUsdKrw(USD_KRW_FALLBACK)   // 💱 폴백도 SSOT — 화면마다 다른 숫자를 쓰면 표끼리 어긋난다
    }

    load()
  }, [])

  return (
    <header style={{
      height: 52,
      background: TK.gray900,
      borderBottom: `1px solid ${TK.gray800}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      justifyContent: 'space-between',
      flexShrink: 0,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* 모바일 전용 브랜드 로고 (PC에서는 사이드바가 담당하므로 숨김) */}
      <div className="mobile-brand-header" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.svg" alt="IS" style={{ width: 26, height: 26 }}/>
        {/* ⚠️ 모바일 헤더는 52px 한 줄에 브랜드+환율+날짜가 함께 선다 — 여기만 body(15)로 둔다
            (lg 18 로 올렸더니 375px 에서 '2026 투자학'/'교'로 줄바꿈됐다) */}
        <span style={{
          fontSize: FS.body, fontWeight: 900, letterSpacing: '-0.4px', whiteSpace: 'nowrap' as const,
          background: 'linear-gradient(135deg, #ffffff 0%, #f5e6c8 40%, #d4af37 70%, #f0f0f0 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          2026 투자학교
        </span>
      </div>

      {/* 페이지 타이틀 (모바일에서는 브랜드 옆에 숨김, PC에서만 표시) */}
      <h1 className="desktop-page-title" style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100, margin: 0, letterSpacing: '-0.3px' }}>
        {title}
      </h1>

      {/* 우측 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* USD/KRW 환율 — dashboard 카드와 동일한 값 */}
        {usdKrw && (
          <div className="header-fx" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const }}>
            <span style={{ fontSize: FS.micro, color: TK.sub7, fontWeight: 600, letterSpacing: '0.05em' }}>USD/KRW</span>
            <span style={{ fontSize: FS.tiny, color: TK.emerald500, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              ₩{usdKrw.toLocaleString('ko-KR')}
            </span>
          </div>
        )}

        {usdKrw && <div className="header-fx" style={{ width: 1, height: 16, background: TK.gray800 }}/>}

        {/* 날짜 — 서버 렌더에선 비워두고 마운트 후 채운다(하이드레이션 안전) */}
        <span style={{ fontSize: FS.tiny, color: TK.sub7, whiteSpace: 'nowrap' as const }}>{today}</span>
      </div>
    </header>
  )
}
