'use client'

/**
 * MacroTerminalDashboard v3 — 매크로 터미널 오케스트레이터
 *
 * SSOT: 모든 Lynch 계산 로직은 @/lib/lynchAnalysis 에서 import
 * - calcFairMultiple: PE/PEG → 적정 멀티플 (모든 예외 처리 포함)
 * - sanitizeEps: EPS 이상값 클램핑 (SK하이닉스 등 API 오류 방어)
 * - estimateBeta: PE/PEG → 금리 민감도
 * - estimateCorrelation: 섹터/시장 → 매크로 상관계수
 * - LYNCH_CATEGORY_KR: DB 영문 키 → 한글 레이블
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import MacroStressTester,       { type StressPortfolioItem }  from './MacroStressTester'
import DynamicCategorySwitcher, { type StockFundamental }     from './DynamicCategorySwitcher'
import LynchLineTerminal,       { type LivePriceMap, type LynchTerminalData } from './LynchLineTerminal'
import { Activity } from 'lucide-react'
import { getAssetType } from '@/lib/assetClassifier'
import {
  calcFairMultiple,
  estimateBeta,
  estimateBasePeg,
  estimateCorrelation,
  safeNumber,
  LYNCH_CATEGORY_KR,
} from '@/lib/lynchAnalysis'

const toMacroFactor = (r: number) => parseFloat((1 + r * -0.3).toFixed(4))

// ETF·원자재·코인 제외 판별 (SSOT: assetClassifier)
function isIndividualStock(inv: { ticker: string; name?: string; market?: string }): boolean {
  return getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') === 'STOCK'
}

interface PortfolioInvestment {
  ticker:          string
  name?:           string
  purchase_price:  number
  currency?:       string
  market?:         string
  lynch_category?: string | null
}

interface DividendEntry {
  annualDividend?:  number | null
  dividendYield?:   number | null
  pe?:              number | null
  earningsGrowth?:  number | null  // 0~1 소수 또는 % 정수
  peg?:            number | null
}

interface Props {
  investments?:       PortfolioInvestment[]
  livePortfolioData?: LivePriceMap
  dividendMap?:       Record<string, DividendEntry>
}

export default function MacroTerminalDashboard({
  investments       = [],
  livePortfolioData = {},
  dividendMap       = {},
}: Props) {
  const [rateShock, setRateShock] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void setRateShock  // Phase 1 슬라이더 UI 연동 예정
  const macroFactor = toMacroFactor(rateShock)

  const getLivePrice = (ticker: string) =>
    livePortfolioData[ticker.toUpperCase()]?.currentPrice ??
    livePortfolioData[ticker]?.currentPrice ??
    0

  // ────────────────────────────────────────────────────────
  // Phase 1: 매크로 스트레스 테스터 데이터
  // ────────────────────────────────────────────────────────
  const stressData = useMemo<StressPortfolioItem[]>(() => {
    return investments
      .filter(inv => isIndividualStock(inv))
      .map(inv => {
        const livePrice = getLivePrice(inv.ticker) || inv.purchase_price
        const div    = dividendMap[inv.ticker.toUpperCase()] ?? {}
        const pe     = safeNumber(div.pe)
        const peg    = safeNumber(div.peg)
        // SSOT: beta / basePEG는 lynchAnalysis에서 계산
        const beta    = estimateBeta(pe, peg, inv.market)
        const basePEG = estimateBasePeg(pe, peg)
        const category = inv.lynch_category
          ? (LYNCH_CATEGORY_KR[inv.lynch_category] ?? inv.lynch_category)
          : undefined
        return { ticker: inv.ticker, name: inv.name ?? inv.ticker,
                 avgPrice: inv.purchase_price, currentPrice: livePrice,
                 beta, basePEG, category }
      })
      .filter(item => item.avgPrice > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments, livePortfolioData, dividendMap])

  // ────────────────────────────────────────────────────────
  // Phase 2: 실제 재무 데이터 (/api/macro-fundamentals)
  // ────────────────────────────────────────────────────────
  const [fundamentalData,    setFundamentalData]    = useState<StockFundamental[]>([])
  const [, setFundamentalLoading] = useState(false)

  const fetchFundamentals = useCallback(async () => {
    const stocks = investments.filter(inv => isIndividualStock(inv))
    if (!stocks.length) return
    setFundamentalLoading(true)
    try {
      const params = new URLSearchParams({
        tickers:    stocks.map(i => i.ticker).join(','),
        markets:    stocks.map(i => i.market ?? 'US').join(','),
        names:      stocks.map(i => encodeURIComponent(i.name ?? i.ticker)).join(','),
        categories: stocks.map(i => i.lynch_category ?? '').join(','),
      })
      const res = await fetch(`/api/macro-fundamentals?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`macro-fundamentals ${res.status}`)
      const apiData: Record<string, {
        epsGrowth: number; revenueGrowth: number; debtRatio: number
        divYield: number; netCashRatio: number; correlation: number
      }> = await res.json()

      setFundamentalData(stocks.map(inv => {
        const d   = apiData[inv.ticker] ?? {}
        const div = dividendMap[inv.ticker.toUpperCase()] ?? {}
        const dy  = safeNumber(div.dividendYield)
        const divYield = dy > 0 ? (dy < 1 ? parseFloat((dy * 100).toFixed(2)) : dy) : (d.divYield ?? 0)
        return {
          ticker:          inv.ticker,
          name:            inv.name ?? inv.ticker,
          epsGrowth:       d.epsGrowth     ?? 15,
          revenueGrowth:   d.revenueGrowth ?? 12,
          debtRatio:       d.debtRatio     ?? (inv.market === 'KR' ? 60 : 50),
          divYield,
          netCashRatio:    d.netCashRatio  ?? 10,
          // SSOT: correlation — lynchAnalysis
          correlation:     d.correlation  ?? estimateCorrelation(inv.market, inv.lynch_category),
          dbLynchCategory: inv.lynch_category ?? null,
        }
      }))
    } catch {
      // 폴백: dividendMap PE/PEG 기반
      setFundamentalData(investments.filter(inv => isIndividualStock(inv)).map(inv => {
        const div = dividendMap[inv.ticker.toUpperCase()] ?? {}
        const pe  = safeNumber(div.pe)
        const peg = safeNumber(div.peg)
        return {
          ticker:          inv.ticker,
          name:            inv.name ?? inv.ticker,
          // earningsGrowth 폴백: PE/PEG 없는 신규 종목도 합리적 G값 추출
          epsGrowth: (() => {
            if (pe > 0 && peg > 0) return Math.round(pe / peg)
            const eg = safeNumber(div.earningsGrowth)
            if (eg > 0) return Math.round(eg < 2 ? eg * 100 : eg)
            return 15
          })(),
          revenueGrowth: (() => {
            if (pe > 0 && peg > 0) return Math.round((pe / peg) * 0.85)
            const eg = safeNumber(div.earningsGrowth)
            if (eg > 0) return Math.round((eg < 2 ? eg * 100 : eg) * 0.85)
            return 12
          })(),
          debtRatio:       inv.market === 'KR' ? 60 : 50,
          divYield:        safeNumber(div.dividendYield),
          netCashRatio:    10,
          correlation:     estimateCorrelation(inv.market, inv.lynch_category),
          dbLynchCategory: inv.lynch_category ?? null,
        }
      }))
    } finally {
      setFundamentalLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments, dividendMap])

  useEffect(() => { fetchFundamentals() }, [fetchFundamentals])

  // ────────────────────────────────────────────────────────
  // Phase 3: EPS 이력 (/api/lynch-eps-history)
  // multiple은 항상 dividendMap 기반 실시간 재계산 (캐시값 사용 안함)
  // ────────────────────────────────────────────────────────
  const [lynchTerminalData, setLynchTerminalData] = useState<LynchTerminalData>({})
  const [epsLoading, setEpsLoading] = useState(false)

  const individualStocks = useMemo(
    () => investments.filter(inv => isIndividualStock(inv)),
    [investments]
  )

  const buildResult = useCallback((
    rawData: Record<string, { name: string; isKrw: boolean; history: { date: string; price: number; eps: number }[] }>
  ): LynchTerminalData => {
    const result: LynchTerminalData = {}
    Object.entries(rawData).forEach(([ticker, stock]) => {
      if (!stock.history?.length) return
      const inv       = individualStocks.find(i => i.ticker === ticker)
      const livePrice = getLivePrice(ticker) || (inv?.purchase_price ?? 0)
      const category  = inv?.lynch_category
        ? (LYNCH_CATEGORY_KR[inv.lynch_category] ?? inv.lynch_category)
        : undefined
      // SSOT: calcFairMultiple — 캐시의 multiple을 덮어씀
      const div      = dividendMap[ticker.toUpperCase()] ?? {}
      const multiple = calcFairMultiple(safeNumber(div.pe), safeNumber(div.peg), inv?.lynch_category, inv?.market)
      result[ticker] = {
        name:         stock.name,
        category:     category ?? '미분류',
        multiple,
        isKrw:        stock.isKrw,
        currentPrice: livePrice,
        history:      stock.history,
      }
    })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [individualStocks, dividendMap])

  const CACHE_VERSION = 'v5'  // 종목명 URL 디코딩 캐시 무효화
  const CACHE_TTL     = 6 * 60 * 60 * 1000  // 6시간 (EPS는 분기 업데이트)

  const fetchEpsHistory = useCallback(async () => {
    if (!individualStocks.length) return
    const cacheKey = `lynch_eps_${CACHE_VERSION}_${individualStocks.map(i => i.ticker).sort().join('_')}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const { historyData, ts } = JSON.parse(cached) as { historyData: Parameters<typeof buildResult>[0]; ts: number }
        if (Date.now() - ts < CACHE_TTL) {
          setLynchTerminalData(buildResult(historyData))
          return
        }
      }
    } catch { /* ignore */ }

    setEpsLoading(true)
    try {
      const params = new URLSearchParams({
        tickers:       individualStocks.map(i => i.ticker).join(','),
        markets:       individualStocks.map(i => i.market ?? 'US').join(','),
        currentPrices: individualStocks.map(i => String(getLivePrice(i.ticker) || i.purchase_price)).join(','),
        names:         individualStocks.map(i => encodeURIComponent(i.name ?? i.ticker)).join(','),
        categories:    individualStocks.map(i => i.lynch_category ?? '').join(','),
        pes:           individualStocks.map(i => String(safeNumber(dividendMap[i.ticker.toUpperCase()]?.pe))).join(','),
      })
      const res = await fetch(`/api/lynch-eps-history?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`EPS API ${res.status}`)
      const apiData: Record<string, { name: string; isKrw: boolean; history: { date: string; price: number; eps: number }[]; error?: string }> = await res.json()

      const historyData: Parameters<typeof buildResult>[0] = {}
      Object.entries(apiData).forEach(([ticker, stock]) => {
        if (stock.history?.length) historyData[ticker] = { name: stock.name, isKrw: stock.isKrw, history: stock.history }
      })
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ historyData, ts: Date.now() })) } catch { /* ignore */ }
      setLynchTerminalData(buildResult(historyData))
    } catch (err) {
      console.error('[MacroTerminal] EPS 조회 실패:', err)
    } finally {
      setEpsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [individualStocks, dividendMap, buildResult])

  useEffect(() => { fetchEpsHistory() }, [fetchEpsHistory])

  // ────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* 공유 상태 배너 */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-950 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#deff9a] animate-pulse" />
          <span className="text-xs font-bold text-zinc-300">매크로 터미널 LIVE</span>
          <span className="text-[10px] text-zinc-500">
            포트폴리오 {stressData.length}개 개별 종목 · SSOT 분석 엔진
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-zinc-500">Phase 1 금리 충격:</span>
          <span className={`font-mono font-bold ${rateShock > 0 ? 'text-rose-400' : rateShock < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {rateShock > 0 ? `+${rateShock.toFixed(2)}%p` : rateShock < 0 ? `${rateShock.toFixed(2)}%p` : '동결'}
          </span>
          <span className="text-zinc-600 mx-1">{`→`}</span>
          <span className="text-zinc-500">린치 멀티플 보정:</span>
          <span className={`font-mono font-bold ${macroFactor < 1 ? 'text-rose-400' : macroFactor > 1 ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {`×${macroFactor.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Phase 1 */}
      <MacroStressTester portfolioData={stressData} />

      {/* Phase 2 */}
      <DynamicCategorySwitcher stocksFundamentalData={fundamentalData} />

      {/* Phase 3 */}
      {epsLoading && !Object.keys(lynchTerminalData).length ? (
        <div className="w-full p-8 bg-black border border-zinc-800 rounded-xl font-sans">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <Activity className="w-6 h-6 text-[#deff9a] animate-pulse" />
            <div className="text-sm">DART / FMP에서 EPS 이력 수집 중…</div>
            <div className="text-xs text-zinc-600">
              {individualStocks.length}개 종목 · Yahoo Finance + FMP (US) · Naver + DART (KR)
            </div>
          </div>
        </div>
      ) : Object.keys(lynchTerminalData).length > 0 ? (
        <LynchLineTerminal
          lynchTerminalData={lynchTerminalData}
          macroFactor={macroFactor}
        />
      ) : (
        <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-center text-zinc-500 text-sm font-sans">
          <Activity className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
          EPS 데이터를 불러오는 중입니다. 잠시 후 자동으로 표시됩니다.
        </div>
      )}
    </div>
  )
}
