'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import FullCandleChart from '@/app/components/FullCandleChart'
import JarvisInsight   from '@/app/components/JarvisInsight'
import InsiderReceipt   from '@/app/components/InsiderReceipt'
import NoiseCanceller   from '@/app/components/NoiseCanceller'
import CashRunwayTimer  from '@/app/components/CashRunwayTimer'
import SectorPeerXray   from '@/app/components/SectorPeerXray'
import PairTradingMonitor from '@/app/components/PairTradingMonitor'
import ShadowTracker13F from '@/app/components/ShadowTracker13F'
import MoatBreachDetector from '@/app/components/MoatBreachDetector'
import MoneyFlowRadar    from '@/app/components/MoneyFlowRadar'
import ReverseDcf        from '@/app/components/ReverseDcf'
import StockProfileCard  from '@/app/components/StockProfileCard'
import ResearchVerdictCard from '@/app/components/ResearchVerdict'
import LynchAutoPanel     from '@/app/components/LynchAutoPanel'
import ChoiValuationPanel from '@/app/components/ChoiValuationPanel'
import { getAssetType } from '@/lib/assetClassifier'
import type { Candle } from '@/app/components/CandleChart'

const N   = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

// 탭: 'chart' = 차트 리서치 | 'wizard' = 피터린치 진단
type ResearchTab = 'chart' | 'lynch' | 'buffett' | 'choi'

type Market = 'US' | 'KR' | 'CRYPTO'
type TimeFrame = '1D' | '1W' | '1M' | '1Y'

interface PricePoint { t: number; v: number }
interface StockPrice {
  ticker:      string
  currentPrice: number
  change:      number
  changePct:   number
  charts:      Record<TimeFrame, PricePoint[]>
  ohlcCharts?: Record<TimeFrame, Candle[]>   // OHLC 캔들 데이터
}
interface StockInfo {
  name: string
  market: string
  ticker: string
  per?: number | null
  pbr?: number | null
  eps?: number | null
  epsGrowth?: number | null
  forwardEps?: number | null
  peg?: number | null
  marketCap?: number | null
  currency?: string
  lynchCategory?: string | null
  lynchLabel?: string | null
  hasCash?: boolean | null   // API 자동 계산: true=순현금, false=순부채, null=미확인
  // ⏳ 좀비 생존 타이머용 (DCF 데이터 재사용)
  freeCashflow?: number | null
  totalCash?: number | null
  sharesOutstanding?: number | null
  returnOnEquity?: number | null   // 손익 흑자/적자 판별 (FCF 음수 ≠ 적자)
  operatingMargins?: number | null // 영업이익률 (ROE 왜곡 교차검증용)
}
interface WatchlistItem {
  id: string; ticker: string; name: string; market: Market
}

export default function ResearchPage() {
  // ── 상단 탭 ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ResearchTab>('chart')

  const [query,      setQuery]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [priceData,  setPriceData]  = useState<StockPrice | null>(null)
  const [stockInfo,  setStockInfo]  = useState<StockInfo | null>(null)
  const [timeframe,  setTimeframe]  = useState<TimeFrame>('1D')
  const [error,      setError]      = useState<string | null>(null)
  const [watchlist,  setWatchlist]  = useState<WatchlistItem[]>([])
  const [addingWL,   setAddingWL]   = useState(false)
  const [wlSuccess,  setWlSuccess]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.user) return
      const { data } = await sb.from('watchlist').select('*').eq('user_id', session.user.id)
      setWatchlist(data ?? [])
    }
    load()
  }, [])

  // Auto-search from URL query param ?q=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('q')
      if (q) handleSearch(q.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = async (tickerInput?: string) => {
    const t = (tickerInput ?? query).trim().toUpperCase()
    if (!t) return
    setQuery(t)
    setLoading(true)
    setError(null)
    setPriceData(null)
    setStockInfo(null)

    try {
      const market: Market = /^\d/.test(t) ? 'KR'
        : ['BTC','ETH','XRP','SOL','ADA','DOGE','MATIC','AVAX','DOT','LINK'].includes(t) ? 'CRYPTO'
        : 'US'

      const [priceRes, infoRes, lynchRes] = await Promise.all([
        fetch('/api/stock-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ ticker: t, market }]),
        }),
        fetch(`/api/stock-info?ticker=${encodeURIComponent(t)}&market=${market}`),
        fetch(`/api/lynch-classify?ticker=${encodeURIComponent(t)}&market=${market}`),
      ])

      if (priceRes.ok) {
        const prices = await priceRes.json()
        if (prices[0]) setPriceData(prices[0])
      }
      if (infoRes.ok) {
        const raw = await infoRes.json()
        if (!raw.error) {
          // API 응답 구조: { fundamentals: { pe, peg, earningsGrowth, marketCap, ... } }
          const f = raw.fundamentals ?? {}
          const toNum = (v: unknown): number | null =>
            typeof v === 'number' && isFinite(v) && v !== 0 ? v : null

          // Lynch 분류 가져오기
          let lynchCategory: string | null = null
          let lynchLabel:    string | null = null
          if (lynchRes.ok) {
            const lynchData = await lynchRes.json()
            lynchCategory = lynchData.category ?? null
            const LYNCH_LABELS: Record<string,string> = {
              slow_grower: '저성장주', stalwart: '대형 우량주',
              fast_grower: '빠른 성장주',  cyclical:  '경기 순환주',
              turnaround:  '회생 기업주',  asset_play:'자산 보유주',
              na: 'N/A',
            }
            lynchLabel = lynchData.category ? (LYNCH_LABELS[lynchData.category] ?? lynchData.category) : null
          }

          setStockInfo({
            name:          raw.name,
            market:        raw.market,
            ticker:        raw.ticker,
            currency:      raw.currency ?? 'USD',
            per:           toNum(f.pe),
            pbr:           toNum(f.pbr),
            eps:           toNum(f.eps),
            // earningsGrowth: 소수(0.18) → % 변환. KR annual은 이미 % 단위일 수도 있으므로 방어
            epsGrowth:     toNum(f.earningsGrowth) != null
              ? (Math.abs(f.earningsGrowth) < 20   // 소수 형태 (0.18 = 18%)
                  ? +(f.earningsGrowth * 100).toFixed(1)
                  : +f.earningsGrowth.toFixed(1))   // 이미 % 형태 (32.6%)
              : null,
            forwardEps:    toNum(f.forwardEps),
            peg:           toNum(f.peg) ?? (typeof f.peg === 'number' && f.peg > 0 ? f.peg : null),
            marketCap:     toNum(f.marketCap),
            lynchCategory,
            lynchLabel,
            // API가 자동 계산한 순현금 여부 (US: FMP, KR: Naver annual)
            hasCash: typeof raw.hasCash === 'boolean' ? raw.hasCash : null,
            // ⏳ 생존 타이머용 (DCF 데이터 재사용 — 추가 fetch 없음)
            freeCashflow:      toNum(f.freeCashflow),
            totalCash:         toNum(f.totalCash),
            sharesOutstanding: toNum(f.sharesOutstanding),
            returnOnEquity:    toNum(f.returnOnEquity),
            operatingMargins:  toNum(f.operatingMargins),
          })
        }
      }
      if (!priceRes.ok && !infoRes.ok) setError('종목을 찾을 수 없습니다. 티커를 확인해주세요.')
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddWatchlist = async () => {
    if (!stockInfo || !priceData) return
    setAddingWL(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.user) return

      const market: Market = /^\d/.test(query) ? 'KR'
        : ['BTC','ETH','XRP','SOL','ADA','DOGE'].includes(query) ? 'CRYPTO' : 'US'

      const { error } = await sb.from('watchlist')
        .upsert({ user_id: session.user.id, ticker: query, name: stockInfo.name, market }, { onConflict: 'user_id,ticker' })
        .select()
      if (!error) {
        setWlSuccess(true)
        setTimeout(() => setWlSuccess(false), 2500)
        const { data: wl } = await sb.from('watchlist').select('*').eq('user_id', session.user.id)
        setWatchlist(wl ?? [])
      }
    } finally {
      setAddingWL(false)
    }
  }

  const isInWatchlist = watchlist.some(w => w.ticker === query)

  // ★ 린치/내부자/어닝/애널리스트 분석은 '개별 주식'만 — ETF·코인·원자재 제외
  const assetType = stockInfo ? getAssetType(stockInfo.ticker, stockInfo.name, stockInfo.market) : null
  const isStock = assetType === 'STOCK'
  const NON_STOCK_KR: Record<string, string> = { ETF: 'ETF·인덱스 펀드', CRYPTO: '암호화폐', COMMODITY: '원자재·실물자산' }
  const NonStockNotice = (
    <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: '20px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>🚫</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#dde4f0', marginBottom: 6 }}>
        개별 주식 전용 분석입니다
      </div>
      <div style={{ fontSize: 12, color: '#8b92b8', lineHeight: 1.7 }}>
        <b style={{ color: '#fbbf24' }}>{stockInfo?.name || query}</b>은(는) <b>{assetType ? (NON_STOCK_KR[assetType] ?? assetType) : '비주식'}</b>이라
        피터 린치 6대 분류·내부자 매수·어닝콜·애널리스트 분석 대상이 아닙니다.<br/>
        (ETF·코인·원자재는 발행 기업·내부자·EPS가 없어 개별 기업 분석이 불가능합니다.)
      </div>
    </div>
  )
  // 그루 탭에서 아직 종목을 조회하지 않았을 때 안내
  const GuruEmptyNotice = (
    <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: '24px', textAlign: 'center', color: '#8b92b8', fontSize: 13, lineHeight: 1.8 }}>
      🔎 먼저 <b style={{ color: '#fbbf24' }}>📈 차트 리서치</b> 탭에서 종목을 조회하세요.<br/>
      조회한 종목이 이 탭의 그루 분석에 자동으로 적용됩니다.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* ── 탭 네비게이션 ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid #4a5070`, paddingBottom: 0 }}>
        {([
          { key: 'chart',   label: '📈 차트 리서치',   desc: '캔들 + 핵심지표 + 종합 판정' },
          { key: 'lynch',   label: '🔍 피터린치 분석', desc: '6대 분류·PEG·이익선 자동' },
          { key: 'buffett', label: '🏰 워렌버핏 분석', desc: '공정가치·해자·안전마진' },
          { key: 'choi',    label: '🧭 최일 가치분석', desc: '적정주가·PER밴드(준비 중)' },
        ] as { key: ResearchTab; label: string; desc: string }[]).map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 18px 12px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 13, fontWeight: 700,
              color:       activeTab === key ? '#fbbf24' : '#9aa0b8',
              borderBottom: `3px solid ${activeTab === key ? '#fbbf24' : 'transparent'}`,
              transition: 'all 0.18s',
            }}
          >
            <div>{label}</div>
            <div style={{ fontSize: 9, fontWeight: 400, color: activeTab === key ? '#92400e' : '#7a8599', marginTop: 1 }}>
              {desc}
            </div>
          </button>
        ))}
      </div>

      {/* ── 차트 리서치 탭 ────────────────────── */}
      {activeTab === 'chart' && (<>

      {/* Search bar */}
      <div style={{ background: N, boxShadow: SHO, borderRadius: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="티커 입력 (예: AAPL, 005930, BTC)"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
              background: '#0a0e1a', boxShadow: SHI, color: '#dde4f0',
              fontSize: 16, fontWeight: 600, outline: 'none', letterSpacing: '0.04em',
              fontFamily: 'monospace',
            }}
          />
          <button onClick={() => handleSearch()}
            style={{
              padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: '#1b1e2e', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
              boxShadow: '0 4px 12px rgba(251,191,36,0.3)',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? '조회 중…' : '조 회'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#9aa0b8', marginRight: 4, fontWeight: 700, letterSpacing: '0.08em' }}>빠른 조회:</span>
          {[
            { t: 'AAPL',   label: 'AAPL · Apple' },
            { t: 'NVDA',   label: 'NVDA · NVIDIA' },
            { t: 'TSLA',   label: 'TSLA · Tesla' },
            { t: '005930', label: '005930 · 삼성전자' },
            { t: '000660', label: '000660 · SK하이닉스' },
            { t: 'BTC',    label: 'BTC · 비트코인' },
          ].map(({ t, label }) => (
            <button key={t} onClick={() => handleSearch(t)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid #4a5070',
                background: 'transparent', color: '#8a9aaa', fontSize: 11, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = '#fbbf24'; (e.currentTarget).style.color = '#fbbf24' }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = '#4a5070'; (e.currentTarget).style.color = '#8a9aaa' }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px', color: '#f87171', fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
          <div style={{ background: N, boxShadow: SHO, borderRadius: 14, height: 420, animation: 'pulse 1.5s infinite' }}/>
          <div style={{ background: N, boxShadow: SHO, borderRadius: 14, height: 420, animation: 'pulse 1.5s infinite' }}/>
        </div>
      )}

      {/* Main content */}
      {!loading && (priceData || stockInfo) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>

          {/* LEFT: Chart panel */}
          <div style={{ background: N, boxShadow: SHO, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                    {stockInfo?.market === 'KR' ? 'KR Stock' : stockInfo?.market === 'CRYPTO' ? 'Crypto' : 'US Stock'}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#dde4f0', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                    {stockInfo?.name ?? query}
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa0b8', marginTop: 4, fontFamily: 'monospace' }}>{query}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {priceData && (
                    <>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#dde4f0', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                        {stockInfo?.currency === 'KRW' ? '₩' : '$'}{priceData.currentPrice.toLocaleString(stockInfo?.currency === 'KRW' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 2 })}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 12px', borderRadius: 20, marginTop: 6,
                        background: priceData.changePct >= 0 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                        color: priceData.changePct >= 0 ? '#f87171' : '#60a5fa',
                        fontSize: 14, fontWeight: 700,
                      }}>
                        {priceData.changePct >= 0 ? '▲' : '▼'} {Math.abs(priceData.changePct).toFixed(2)}%
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Timeframe tabs */}
            {priceData && (
              <div style={{ display: 'flex', gap: 6, padding: '0 24px 12px' }}>
                {(['1D','1W','1M','1Y'] as TimeFrame[]).map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    style={{
                      padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: timeframe === tf ? '#fbbf24' : '#0a0e1a',
                      boxShadow: timeframe === tf ? '0 2px 8px rgba(251,191,36,0.3)' : SHI,
                      color: timeframe === tf ? '#1b1e2e' : '#8a9aaa',
                      fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                    }}>{tf}</button>
                ))}
              </div>
            )}

            {/* Chart — 캔들차트 (1D/1W/1M) */}
            {(() => {
              const ohlc      = priceData?.ohlcCharts?.[timeframe] ?? []
              const prevClose = priceData ? priceData.currentPrice - priceData.change : undefined
              const currency  = stockInfo?.currency ?? 'USD'

              if (ohlc.length > 1) {
                return (
                  <div style={{ padding: '4px 0 8px' }}>
                    <FullCandleChart
                      data={ohlc}
                      currency={currency}
                      timeframe={timeframe}
                      prevClose={prevClose}
                    />
                  </div>
                )
              }

              // OHLC 없는 경우 → 빈 상태
              return (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0b8', fontSize: 13 }}>
                  {!priceData ? '종목을 조회해주세요' : '캔들 데이터 없음'}
                </div>
              )
            })()}
          </div>

          {/* RIGHT: Key metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>핵심 지표</span>
                <span style={{ fontSize: 11, color: '#7a8599' }}>{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {stockInfo && [
                  { label: 'PER',         value: stockInfo.per != null ? stockInfo.per.toFixed(1) : '—' },
                  { label: 'PBR',         value: stockInfo.pbr != null ? stockInfo.pbr.toFixed(1) : '—' },
                  { label: 'EPS',         value: stockInfo.eps != null ? (stockInfo.currency === 'KRW' ? `₩${Math.round(stockInfo.eps).toLocaleString()}` : `$${stockInfo.eps.toFixed(2)}`) : '—' },
                  { label: 'EPS 성장률',  value: stockInfo.epsGrowth != null ? `${stockInfo.epsGrowth.toFixed(1)}%` : '—' },
                  { label: 'Forward EPS', value: stockInfo.forwardEps != null ? (stockInfo.currency === 'KRW' ? `₩${Math.round(stockInfo.forwardEps).toLocaleString()}` : `$${stockInfo.forwardEps.toFixed(2)}`) : '—' },
                  { label: 'PEG',         value: stockInfo.peg != null ? stockInfo.peg.toFixed(2) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#0a0e1a', boxShadow: SHI, borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dde4f0', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                  </div>
                ))}
              </div>
              {stockInfo?.marketCap != null && (
                <div style={{ marginTop: 8, background: '#0a0e1a', boxShadow: SHI, borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>시가총액</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dde4f0' }}>
                    {stockInfo.marketCap >= 1e12
                      ? `${(stockInfo.marketCap / 1e12).toFixed(2)}T`
                      : stockInfo.marketCap >= 1e9
                      ? `${(stockInfo.marketCap / 1e9).toFixed(1)}B`
                      : stockInfo.marketCap >= 1e8
                      ? `₩${(stockInfo.marketCap / 1e8).toFixed(0)}억`
                      : `₩${(stockInfo.marketCap / 1e4).toFixed(0)}만`}
                  </div>
                </div>
              )}
            </div>

            {/* 관심종목 버튼 */}
            <button onClick={handleAddWatchlist} disabled={addingWL || isInWatchlist}
              style={{
                padding: '13px', borderRadius: 12, border: 'none', cursor: isInWatchlist ? 'default' : 'pointer',
                background: isInWatchlist
                  ? 'rgba(251,191,36,0.15)'
                  : wlSuccess
                  ? 'rgba(34,197,94,0.2)'
                  : 'linear-gradient(135deg,#92400e,#b45309)',
                boxShadow: isInWatchlist ? SHI : SHO,
                color: isInWatchlist ? '#fbbf24' : wlSuccess ? '#4ade80' : '#fde68a',
                fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}>
              {isInWatchlist ? '⭐ 관심종목 등록됨' : wlSuccess ? '✅ 추가 완료!' : '⭐ 관심종목 추가'}
            </button>
          </div>
        </div>
      )}

      {/* Research checkpoints */}
      {!loading && stockInfo && priceData && (
        <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🎯 리서치 체크포인트</span>
            <span style={{ fontSize: 10, color: '#7a8599' }}>자동 요약</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>

            {/* 피터린치 분류 */}
            <div style={{ background: '#0a0e1a', boxShadow: SHI, borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #a78bfa' }}>
              <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>피터린치 분류</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{stockInfo.lynchLabel ?? '분석 불가'}</div>
              <div style={{ fontSize: 10, color: '#7a8599', marginTop: 4 }}>
                {stockInfo.lynchCategory === 'fast_grower' ? '연 20%+ 고성장. 미래 가치 선반영.' :
                 stockInfo.lynchCategory === 'stalwart'    ? '연 10~12% 안정 성장. 대형 우량주.' :
                 stockInfo.lynchCategory === 'slow_grower' ? '저성장. 배당 중심 투자.' :
                 stockInfo.lynchCategory === 'cyclical'    ? '경기 사이클 추종. 타이밍 중요.' :
                 stockInfo.lynchCategory === 'turnaround'  ? '회생 중. 펀더멘탈 회복 확인 필요.' :
                 stockInfo.lynchCategory === 'asset_play'  ? '자산 가치 재평가 기대.' :
                 '분류 데이터 없음'}
              </div>
            </div>

            {/* PEG 해석 */}
            <div style={{ background: '#0a0e1a', boxShadow: SHI, borderRadius: 10, padding: '12px 14px',
              borderLeft: `3px solid ${stockInfo.peg != null ? (stockInfo.peg <= 1 ? '#10b981' : stockInfo.peg <= 2 ? '#60a5fa' : '#f87171') : '#7a8599'}` }}>
              <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>PEG 해석</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: stockInfo.peg != null ? (stockInfo.peg <= 1 ? '#10b981' : stockInfo.peg <= 2 ? '#60a5fa' : '#f87171') : '#7a8599' }}>
                {stockInfo.peg != null ? stockInfo.peg.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#7a8599', marginTop: 4 }}>
                {stockInfo.peg == null ? 'PEG 데이터 없음' :
                 stockInfo.peg <= 1 ? '✅ 강력 매수 구간. 성장 대비 저평가.' :
                 stockInfo.peg <= 2 ? '🔵 적정 가격 수준.' :
                 '⚠️ 가격 부담 큼. 고성장 지속 필요.'}
              </div>
            </div>

            {/* 기간 수익률 */}
            <div style={{ background: '#0a0e1a', boxShadow: SHI, borderRadius: 10, padding: '12px 14px',
              borderLeft: `3px solid ${priceData.changePct >= 0 ? '#ef4444' : '#3b82f6'}` }}>
              <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>당일 수익률</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: priceData.changePct >= 0 ? '#f87171' : '#60a5fa' }}>
                {priceData.changePct >= 0 ? '+' : ''}{priceData.changePct.toFixed(2)}%
              </div>
              <div style={{ fontSize: 10, color: '#7a8599', marginTop: 4 }}>
                전일 대비 {priceData.change >= 0 ? '+' : ''}{stockInfo.currency === 'KRW' ? `₩${Math.round(priceData.change).toLocaleString()}` : `$${priceData.change.toFixed(2)}`}
              </div>
            </div>

            {/* Forward EPS */}
            <div style={{ background: '#0a0e1a', boxShadow: SHI, borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #34d399' }}>
              <div style={{ fontSize: 9, color: '#9aa0b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Forward EPS</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>
                {stockInfo.forwardEps != null
                  ? (stockInfo.currency === 'KRW' ? `₩${Math.round(stockInfo.forwardEps).toLocaleString()}` : `$${stockInfo.forwardEps.toFixed(2)}`)
                  : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#7a8599', marginTop: 4 }}>애널리스트 예상 이익 기준 EPS</div>
            </div>

          </div>
        </div>
      )}

      {/* ★ ETF·코인·원자재 → 개별주식 전용 분석 차단 안내 (1회) */}
      {!loading && stockInfo && priceData && !isStock && NonStockNotice}

      {/* 🎯 종합 매수 판정 — 4축(계절·가치·수급·모멘텀)+리스크 "이 종목 매수해도 되나?"(차트 탭의 전체 평가) */}
      {!loading && stockInfo && priceData && isStock && (
        <ResearchVerdictCard ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
      )}

      {/* 💰 시장 시그널 — 수급·페어·13F (차트 탭) */}
      {!loading && stockInfo && priceData && isStock && (
        <MoneyFlowRadar ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
      )}
      {!loading && stockInfo && priceData && isStock && (
        <PairTradingMonitor ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
      )}
      {!loading && stockInfo && priceData && isStock && (
        <ShadowTracker13F ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
      )}

      </>)} {/* activeTab === 'chart' 닫기 */}

      {/* ── 🔍 피터린치 분석 탭 (한 페이지 자동) ─────────────────── */}
      {activeTab === 'lynch' && (!stockInfo ? GuruEmptyNotice : !isStock ? NonStockNotice : (<>
        <LynchAutoPanel
          ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market}
          per={stockInfo.per} peg={stockInfo.peg} eps={stockInfo.eps} epsGrowth={stockInfo.epsGrowth}
          currentPrice={priceData?.currentPrice ?? null} currency={stockInfo.currency}
          lynchCategory={stockInfo.lynchCategory} lynchLabel={stockInfo.lynchLabel}
        />
        <JarvisInsight ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market}
          facts={{ per: stockInfo.per, peg: stockInfo.peg, eps: stockInfo.eps, epsGrowth: stockInfo.epsGrowth,
            forwardEps: stockInfo.forwardEps, lynchLabel: stockInfo.lynchLabel, marketCap: stockInfo.marketCap, currency: stockInfo.currency }} />
        <NoiseCanceller ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
        <SectorPeerXray ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
      </>))}

      {/* ── 🏰 워렌버핏 분석 탭 ──────────────────────────────────── */}
      {activeTab === 'buffett' && (!stockInfo ? GuruEmptyNotice : !isStock ? NonStockNotice : (<>
        <StockProfileCard ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
        <MoatBreachDetector ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
        <ReverseDcf ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
        <CashRunwayTimer ticker={stockInfo.ticker} name={stockInfo.name} currency={stockInfo.currency}
          freeCashflow={stockInfo.freeCashflow} totalCash={stockInfo.totalCash} sharesOutstanding={stockInfo.sharesOutstanding}
          returnOnEquity={stockInfo.returnOnEquity} operatingMargins={stockInfo.operatingMargins} />
        <InsiderReceipt ticker={stockInfo.ticker} name={stockInfo.name} market={stockInfo.market} />
      </>))}

      {/* ── 🧭 최일 가치분석 탭 (/valuation 전체 추출 — embedded 자동조회) ── */}
      {activeTab === 'choi' && (!stockInfo ? GuruEmptyNotice : !isStock ? NonStockNotice : (
        <ChoiValuationPanel ticker={stockInfo.ticker} market={stockInfo.market === 'KR' ? 'KR' : 'US'} embedded />
      ))}
    </div>
  )
}
