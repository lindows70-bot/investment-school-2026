'use client'

/**
 * DashboardContainer — 통합 투자 정보 터미널
 *
 * /api/v1/market/realtime-portfolio 에서 포트폴리오 데이터를 5초 폴링하여
 * 현재가 그리드와 LynchLineTerminal Phase 3 에 동일한 상태값을 전파합니다.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, LayoutDashboard } from 'lucide-react'
import LynchLineTerminal from './LynchLineTerminal'
import { type StudentPortfolio } from './UniversalLynchLineTerminal'

export default function DashboardContainer() {
  const [portfolioData, setPortfolioData] = useState<StudentPortfolio>({})
  const [loading,       setLoading]       = useState(true)
  const [lastUpdated,   setLastUpdated]   = useState('')
  const [fetchError,    setFetchError]    = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/market/realtime-portfolio', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: StudentPortfolio = await res.json()
      setPortfolioData(data)
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'))
      setFetchError(null)
    } catch (err) {
      setFetchError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 5000)
    return () => clearInterval(iv)
  }, [fetchData])

  // ── 초기 로딩
  if (loading) return (
    <div className="w-full h-96 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 font-sans">
      <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#deff9a]" />
      <p className="text-xs">실시간 시장 데이터를 동기화 중입니다…</p>
    </div>
  )

  return (
    <div className="w-full bg-zinc-950 space-y-8 text-zinc-100 font-sans">

      {/* ── 상단 요약 바 */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-[#deff9a]" />
          <h2 className="text-lg font-bold">통합 투자 정보 터미널</h2>
        </div>
        <div className="flex items-center gap-3">
          {fetchError && (
            <span className="text-[10px] text-rose-400">⚠️ {fetchError}</span>
          )}
          <span className="text-[11px] text-zinc-500 font-mono">
            마지막 동기화: {lastUpdated || '—'}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#deff9a] animate-pulse" />
        </div>
      </div>

      {/* ── 현재가 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(portfolioData).map(([ticker, stock]) => {
          const latest  = stock.history?.[stock.history.length - 1]
          if (!latest) return null
          const sign    = stock.isKrw ? '₩' : '$'
          return (
            <div key={ticker} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="text-[10px] text-zinc-500 font-bold truncate">{stock.name}</div>
              <div className="text-xs text-zinc-400 font-mono mt-0.5">{ticker}</div>
              <div className="text-base font-mono font-bold mt-2 text-blue-400">
                {sign}{latest.price.toLocaleString()}
              </div>
              {/* 린치 라인 대비 간단 상태 */}
              {latest.lynch > 0 && (() => {
                const gap = ((latest.price - latest.lynch) / latest.lynch) * 100
                return (
                  <div className={`text-[10px] font-mono mt-1 ${gap < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {gap < 0 ? '▼' : '▲'}{Math.abs(gap).toFixed(1)}%
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* ── Phase 3 차트 터미널 연동 */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <LynchLineTerminal lynchTerminalData={portfolioData as any} />
    </div>
  )
}
