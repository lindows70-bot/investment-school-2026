'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TK } from '@/lib/theme'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '대시보드',
  '/assets':    '자산관리',
  '/history':   '투자기록',
  '/analysis':  '투자분석',
  '/admin':     '관리자 대시보드',
}

// dashboard/page.tsx 와 동일한 캐시 키 사용 → 두 컴포넌트가 같은 값 표시
const CACHE_KEY = 'usd_krw_rate'
const HOUR_MS   = 60 * 60 * 1000

export default function TopHeader() {
  const pathname = usePathname()
  const [usdKrw, setUsdKrw] = useState<number | null>(null)

  const title = PAGE_TITLES[pathname] ?? '투자학교'

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

      setUsdKrw(1350)
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
        <span style={{
          fontSize: 15, fontWeight: 900, letterSpacing: '-0.4px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f5e6c8 40%, #d4af37 70%, #f0f0f0 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          2026 투자학교
        </span>
      </div>

      {/* 페이지 타이틀 (모바일에서는 브랜드 옆에 숨김, PC에서만 표시) */}
      <h1 className="desktop-page-title" style={{ fontSize: 15, fontWeight: 700, color: TK.slate100, margin: 0, letterSpacing: '-0.3px' }}>
        {title}
      </h1>

      {/* 우측 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* USD/KRW 환율 — dashboard 카드와 동일한 값 */}
        {usdKrw && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: TK.sub7, fontWeight: 600, letterSpacing: '0.05em' }}>USD/KRW</span>
            <span style={{ fontSize: 13, color: TK.emerald500, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              ₩{usdKrw.toLocaleString('ko-KR')}
            </span>
          </div>
        )}

        {usdKrw && <div style={{ width: 1, height: 16, background: TK.gray800 }}/>}

        {/* 날짜 */}
        <span style={{ fontSize: 12, color: TK.sub7 }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
        </span>
      </div>
    </header>
  )
}
