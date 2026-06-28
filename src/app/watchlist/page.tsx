'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FullCandleChart from '@/app/components/FullCandleChart'
import MoneyFlowRadar from '@/app/components/MoneyFlowRadar'
import { getAssetType } from '@/lib/assetClassifier'
import type { Candle } from '@/app/components/CandleChart'

const N   = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

type Market    = 'US' | 'KR' | 'CRYPTO'
type TimeFrame = '1D' | '1W' | '1M' | '1Y'

interface WatchlistItem {
  id: string; ticker: string; name: string; market: Market; added_at: string
}
interface LivePrice {
  ticker:      string
  currentPrice: number
  change:      number
  changePct:   number
  ohlcCharts?: Record<TimeFrame, Candle[]>
}
interface StockInfo {
  ticker:     string
  currency?:  string
  per?:       number | null
  peg?:       number | null
  eps?:       number | null
  epsGrowth?: number | null
  forwardEps?: number | null
  marketCap?: number | null
}

// ── 포맷 헬퍼 ────────────────────────────────────────────────
const fmtPrice = (p: number, cur: string) =>
  cur === 'KRW'
    ? `₩${Math.round(p).toLocaleString('ko-KR')}`
    : `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtKrw = (n: number) =>
  n == null || !isFinite(n) ? '—'
  : n >= 1e12 ? `$${(n/1e12).toFixed(2)}T`
  : n >= 1e9  ? `$${(n/1e9).toFixed(1)}B`
  : n >= 1e8  ? `₩${(n/1e8).toFixed(0)}억`
  : `₩${Math.round(n/1e4).toLocaleString('ko-KR')}만`

export default function WatchlistPage() {
  const router  = useRouter()
  const [items,    setItems]    = useState<WatchlistItem[]>([])
  const [prices,   setPrices]   = useState<Record<string,LivePrice>>({})
  const [infos,    setInfos]    = useState<Record<string,StockInfo>>({})
  const [loading,  setLoading]  = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  // 종목별 선택된 타임프레임
  const [tfMap,    setTfMap]    = useState<Record<string,TimeFrame>>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
    if (!uid) { router.push('/login'); return }

    const { data } = await sb.from('watchlist').select('*').eq('user_id', uid).order('added_at', { ascending: false })
    const wl: WatchlistItem[] = data ?? []
    setItems(wl)

    if (wl.length > 0) {
      // 현재가 + ohlcCharts 동시 조회
      const priceRes = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wl.map(w => ({ ticker: w.ticker, market: w.market }))),
      })
      if (priceRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const priceData: any[] = await priceRes.json()
        const m: Record<string,LivePrice> = {}
        priceData.forEach(p => {
          m[p.ticker.toUpperCase()] = {
            ticker:      p.ticker,
            currentPrice: p.currentPrice,
            change:      p.change,
            changePct:   p.changePct,
            ohlcCharts:  p.ohlcCharts,
          }
        })
        setPrices(m)
      }

      // 재무 데이터 (최대 8개 병렬)
      const infoResults = await Promise.all(
        wl.slice(0, 8).map(w =>
          fetch(`/api/stock-info?ticker=${encodeURIComponent(w.ticker)}&market=${w.market}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )
      const infoMap: Record<string,StockInfo> = {}
      infoResults.forEach((raw, i) => {
        if (!raw || raw.error) return
        const f = raw.fundamentals ?? {}
        const toNum = (v: unknown) => typeof v === 'number' && isFinite(v) && v !== 0 ? v : null
        infoMap[wl[i].ticker.toUpperCase()] = {
          ticker:    wl[i].ticker,
          currency:  raw.currency ?? (wl[i].market === 'US' ? 'USD' : 'KRW'),
          per:       toNum(f.pe),
          peg:       toNum(f.peg) ?? (typeof f.peg === 'number' && f.peg > 0 ? f.peg : null),
          eps:       toNum(f.eps),
          epsGrowth: toNum(f.earningsGrowth) != null
            ? (Math.abs(f.earningsGrowth) < 20
                ? +(f.earningsGrowth * 100).toFixed(1)
                : +f.earningsGrowth.toFixed(1))
            : null,
          forwardEps: toNum(f.forwardEps),
          marketCap:  toNum(f.marketCap),
        }
      })
      setInfos(infoMap)
    }
    setLoading(false)
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleRemove = async (id: string, ticker: string) => {
    setRemoving(ticker)
    const sb = createClient()
    await sb.from('watchlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setRemoving(null)
  }

  const getTf = (ticker: string): TimeFrame => tfMap[ticker] ?? '1D'
  const setTf = (ticker: string, tf: TimeFrame) =>
    setTfMap(prev => ({ ...prev, [ticker]: tf }))

  // ── 로딩 스켈레톤 ─────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      {[0,1,2].map(i => (
        <div key={i} style={{ height:200, background:N, boxShadow:SHO, borderRadius:14, animation:'pulse 1.5s infinite' }}/>
      ))}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* ── 헤더 ── */}
      <div style={{ background:N, boxShadow:SHO, borderRadius:14, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:'#dde4f0' }}>⭐ 관심종목</div>
          <div style={{ fontSize:11, color:'#9aa0b8', marginTop:2 }}>{items.length}개 종목 모니터링 중</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={fetchAll}
            style={{ padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer',
              background:N, boxShadow:SHI, color:'#8a9aaa', fontSize:12, fontWeight:600 }}>
            🔄 새로고침
          </button>
          <a href="/research"
            style={{ padding:'7px 16px', borderRadius:9, textDecoration:'none',
              background:'linear-gradient(135deg,#92400e,#b45309)', color:'#fde68a',
              fontSize:12, fontWeight:700, display:'flex', alignItems:'center' }}>
            + 종목 추가
          </a>
        </div>
      </div>

      {/* ── 빈 상태 ── */}
      {items.length === 0 && (
        <div style={{ background:N, boxShadow:SHO, borderRadius:14, padding:'60px 20px', textAlign:'center' as const }}>
          <div style={{ fontSize:40, marginBottom:14 }}>⭐</div>
          <div style={{ fontSize:16, fontWeight:700, color:'#dde4f0', marginBottom:8 }}>관심종목이 없습니다</div>
          <div style={{ fontSize:13, color:'#9aa0b8', marginBottom:20 }}>종목 리서치에서 관심 종목을 추가해보세요</div>
          <a href="/research" style={{ display:'inline-block', padding:'10px 24px', borderRadius:10, textDecoration:'none',
            background:'linear-gradient(135deg,#92400e,#b45309)', color:'#fde68a', fontSize:13, fontWeight:700 }}>
            🔭 종목 리서치 바로가기
          </a>
        </div>
      )}

      {/* ── 종목 행 (한 줄에 한 종목) ── */}
      {items.map(item => {
        const price    = prices[item.ticker.toUpperCase()]
        const info     = infos[item.ticker.toUpperCase()]
        const tf       = getTf(item.ticker)
        const currency = info?.currency ?? (item.market === 'US' ? 'USD' : 'KRW')
        const isUp     = price ? price.changePct >= 0 : true
        const C        = isUp ? '#ef4444' : '#3b82f6'
        const Cs       = isUp ? '#f87171' : '#60a5fa'
        const ohlc     = price?.ohlcCharts?.[tf] ?? []
        const prevClose = price ? price.currentPrice - price.change : undefined

        return (
          <div key={item.id} style={{
            background: N, boxShadow: SHO,
            borderRadius: 14, overflow: 'hidden',
            borderLeft: `3px solid ${C}`,
            display: 'flex', alignItems: 'stretch',
          }}>

            {/* ─ 1. 종목 정보 (왼쪽 200px) ─ */}
            <div style={{ width:200, flexShrink:0, padding:'16px 18px', display:'flex', flexDirection:'column', justifyContent:'center', gap:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#dde4f0', marginBottom:1 }}>{item.name}</div>
                  <div style={{ fontSize:10, color:'#9aa0b8', fontFamily:'monospace' }}>{item.ticker}</div>
                </div>
                <span style={{ fontSize:9, fontWeight:700, color:'#fbbf24',
                  background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)',
                  borderRadius:4, padding:'2px 5px', flexShrink:0 }}>{item.market}</span>
              </div>

              {price ? (
                <>
                  <div style={{ fontSize:22, fontWeight:900, color:'#dde4f0',
                    fontVariantNumeric:'tabular-nums', letterSpacing:'-0.5px', marginTop:6 }}>
                    {fmtPrice(price.currentPrice, currency)}
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:Cs, fontVariantNumeric:'tabular-nums' }}>
                    {isUp ? '▲' : '▼'} {Math.abs(price.changePct).toFixed(2)}%
                    <span style={{ color:'#9aa0b8', marginLeft:6, fontWeight:400 }}>
                      {price.change >= 0 ? '+' : ''}{currency === 'KRW'
                        ? `₩${Math.round(price.change).toLocaleString('ko-KR')}`
                        : `$${price.change.toFixed(2)}`}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:13, color:'#7a8599', marginTop:8 }}>로딩 중…</div>
              )}

              {/* 액션 버튼 */}
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                <a href={`/research?q=${item.ticker}`}
                  style={{ flex:1, padding:'6px 0', borderRadius:7, textAlign:'center' as const,
                    textDecoration:'none', background:N, boxShadow:SHI,
                    color:'#fbbf24', fontSize:11, fontWeight:700 }}>
                  🔭 리서치
                </a>
                <button onClick={() => handleRemove(item.id, item.ticker)}
                  disabled={removing === item.ticker}
                  style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer',
                    background:N, boxShadow:SHI, color:'#f87171', fontSize:11, fontWeight:700 }}>
                  {removing === item.ticker ? '…' : '🗑 삭제'}
                </button>
              </div>
            </div>

            {/* ─ 구분선 ─ */}
            <div style={{ width:1, background:'#1e2140', flexShrink:0, margin:'12px 0' }}/>

            {/* ─ 2. 재무 지표 (중간 220px) ─ */}
            <div style={{ width:220, flexShrink:0, padding:'14px 16px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#7a8599', letterSpacing:'0.1em',
                textTransform:'uppercase' as const, marginBottom:10 }}>핵심 지표</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                {[
                  { label:'PER',        val: info?.per        != null ? info.per.toFixed(1)        : '—' },
                  { label:'PEG',        val: info?.peg        != null ? info.peg.toFixed(2)        : '—' },
                  { label:'EPS',        val: info?.eps        != null
                    ? (currency === 'KRW' ? `₩${Math.round(info.eps).toLocaleString('ko-KR')}` : `$${info.eps.toFixed(2)}`)
                    : '—' },
                  { label:'EPS 성장률', val: info?.epsGrowth  != null ? `${info.epsGrowth.toFixed(1)}%` : '—' },
                  { label:'Forward EPS', val: info?.forwardEps != null
                    ? (currency === 'KRW' ? `₩${Math.round(info.forwardEps).toLocaleString('ko-KR')}` : `$${info.forwardEps.toFixed(2)}`)
                    : '—' },
                  { label:'시가총액',   val: info?.marketCap  != null ? fmtKrw(info.marketCap)         : '—' },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background:'#0a0e1a', boxShadow:SHI, borderRadius:7, padding:'7px 9px' }}>
                    <div style={{ fontSize:8, color:'#7a8599', textTransform:'uppercase' as const,
                      letterSpacing:'0.06em', marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#a8b5c2',
                      fontVariantNumeric:'tabular-nums', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─ 구분선 ─ */}
            <div style={{ width:1, background:'#1e2140', flexShrink:0, margin:'12px 0' }}/>

            {/* ─ 3. 캔들차트 (오른쪽 flex:1) ─ */}
            <div style={{ flex:1, minWidth:0, padding:'10px 14px 8px', display:'flex', flexDirection:'column' }}>
              {/* 타임프레임 탭 */}
              <div style={{ display:'flex', gap:5, marginBottom:6 }}>
                {(['1D','1W','1M','1Y'] as TimeFrame[]).map(t => (
                  <button key={t} onClick={() => setTf(item.ticker, t)}
                    style={{
                      padding:'3px 10px', borderRadius:6, border:'none', cursor:'pointer',
                      fontSize:11, fontWeight:700, transition:'all 0.15s',
                      background: tf === t ? '#fbbf24' : N,
                      boxShadow:  tf === t ? '0 2px 8px rgba(251,191,36,0.3)' : SHI,
                      color:      tf === t ? '#1b1e2e' : '#9aa0b8',
                    }}>{t}</button>
                ))}
                <span style={{ marginLeft:'auto', fontSize:10, color:'#7a8599', alignSelf:'center' }}>
                  {ohlc.length > 0 ? `${ohlc.length}캔들` : ''}
                </span>
              </div>

              {/* 차트 */}
              <div style={{ flex:1, minHeight:160 }}>
                {ohlc.length > 1 ? (
                  <FullCandleChart
                    data={ohlc}
                    currency={currency}
                    timeframe={tf}
                    prevClose={prevClose}
                    height={170}
                  />
                ) : (
                  <div style={{ height:170, display:'flex', alignItems:'center',
                    justifyContent:'center', color:'#7a8599', fontSize:12 }}>
                    {price ? `${tf} 차트 데이터 없음` : '현재가 로딩 중…'}
                  </div>
                )}
              </div>
              {getAssetType(item.ticker, item.name, item.market) === 'STOCK' && (
                <div style={{ marginTop:10 }}>
                  <MoneyFlowRadar ticker={item.ticker} name={item.name} market={item.market} />
                </div>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )
}
