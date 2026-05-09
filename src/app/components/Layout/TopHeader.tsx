'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

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
      background: '#111827',
      borderBottom: '1px solid #1f2937',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      justifyContent: 'space-between',
      flexShrink: 0,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* 페이지 타이틀 */}
      <h1 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.3px' }}>
        {title}
      </h1>

      {/* 우측 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* USD/KRW 환율 — dashboard 카드와 동일한 값 */}
        {usdKrw && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, letterSpacing: '0.05em' }}>USD/KRW</span>
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              ₩{usdKrw.toLocaleString('ko-KR')}
            </span>
          </div>
        )}

        {usdKrw && <div style={{ width: 1, height: 16, background: '#1f2937' }}/>}

        {/* 날짜 */}
        <span style={{ fontSize: 12, color: '#4b5563' }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
        </span>
      </div>
    </header>
  )
}
