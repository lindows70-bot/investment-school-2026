'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart,
  Treemap,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market   = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower'|'stalwart'|'fast_grower'|'cyclical'|'turnaround'|'asset_play'|'na'
type TimeFrame = '1D'|'1W'|'1M'
interface PricePoint { t: number; v: number }
interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number
  purchase_date: string; lynch_category: LynchKey|null
}
interface LivePrice {
  currentPrice: number; change: number; changePct: number
  charts: Record<TimeFrame, PricePoint[]>; source: 'live'|'cache'
}

// ─── Config ───────────────────────────────────────────────────────────────────
const USD_KRW = 1_350

const LYNCH_META: Record<string, { label: string; color: string }> = {
  slow_grower: { label: '완만한 성장주', color: '#9ca3af' },
  stalwart:    { label: '대형 우량주',   color: '#60a5fa' },
  fast_grower: { label: '빠른 성장주',   color: '#34d399' },
  cyclical:    { label: '경기 순환주',   color: '#fb923c' },
  turnaround:  { label: '회생 기업주',   color: '#f87171' },
  asset_play:  { label: '자산 보유주',   color: '#c084fc' },
  na:          { label: 'N/A',           color: '#374151' },
}
const MKT_COLOR: Record<Market, string> = { US:'#34d399', KR:'#60a5fa', CRYPTO:'#fb923c' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toKrw = (inv: Investment, price?: number) => {
  const p = price ?? inv.purchase_price
  return p * inv.quantity * (inv.currency === 'USD' ? USD_KRW : 1)
}
const fmtKrw = (n: number) => {
  const v = isFinite(n) ? n : 0
  return v >= 1e8 ? `₩${(v/1e8).toFixed(1)}억`
    : v >= 1e7 ? `₩${(v/1e4).toFixed(0)}만`
    : `₩${Math.round(v).toLocaleString('ko-KR')}`
}
/** undefined/null/NaN 안전한 % 포맷 */
const safeFixed = (v: number|null|undefined, d = 1) => (isFinite(v ?? 0) ? (v ?? 0) : 0).toFixed(d)
const fmtPct = (n: number|null|undefined) => {
  const v = isFinite(n ?? 0) ? (n ?? 0) : 0
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

// ─── Treemap custom content ───────────────────────────────────────────────────
const getHeatmapColor = (r: number) =>
  r >= 10 ? '#dc2626' : r >= 0 ? '#ef4444' : r >= -10 ? '#3b82f6' : '#1d4ed8'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, ticker, returnRate, weight } = props
  if (!width || !height || width < 10 || height < 10) return null

  const rate     = isFinite(returnRate ?? 0) ? (returnRate ?? 0) : 0
  const bgColor  = getHeatmapColor(rate)
  const rateText = `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`
  const cx = x + width / 2
  const cy = y + height / 2

  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        fill={bgColor} stroke="#0f1117" strokeWidth={2}
        style={{ cursor: 'pointer' }}
      />

      {/* 큰 블록: 종목명 + 티커 + 수익률 + 비중 */}
      {width > 80 && height > 50 && (
        <>
          <text x={cx} y={cy - 20} textAnchor="middle"
            fill="white" fontSize={Math.min(13, width / 8)} fontWeight="bold"
            style={{ pointerEvents: 'none' }}>
            {(name ?? '').length > 12 ? (name as string).slice(0, 12) + '…' : name}
          </text>
          <text x={cx} y={cy - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.7)" fontSize={Math.min(10, width / 10)}
            style={{ pointerEvents: 'none' }}>
            {ticker}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle"
            fill="white" fontSize={Math.min(14, width / 7)} fontWeight="bold"
            style={{ pointerEvents: 'none' }}>
            {rateText}
          </text>
          <text x={cx} y={cy + 28} textAnchor="middle"
            fill="rgba(255,255,255,0.6)" fontSize={9}
            style={{ pointerEvents: 'none' }}>
            {weight}%
          </text>
        </>
      )}

      {/* 작은 블록: 티커 + 수익률 */}
      {(width <= 80 || height <= 50) && height > 30 && (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle"
            fill="white" fontSize={9} fontWeight="bold"
            style={{ pointerEvents: 'none' }}>
            {ticker || (name as string ?? '').slice(0, 6)}
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle"
            fill="white" fontSize={9}
            style={{ pointerEvents: 'none' }}>
            {rateText}
          </text>
        </>
      )}
    </g>
  )
}

// ─── Mini sparkline for table ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MiniChart = ({ data }: { data: PricePoint[] }) => {
  if (!data?.length) return <span style={{ color:'#374151', fontSize:11 }}>—</span>
  const dir = data[data.length-1].v > data[0].v
  return (
    <ResponsiveContainer width={60} height={24}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={dir?'#ef4444':'#3b82f6'} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
        <YAxis domain={['auto','auto']} hide/>
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Tooltip styles ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DarkTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#1a1d27', border:'1px solid #2a2d3a', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9' }}>
      {label && <div style={{ color:'#4b5563', marginBottom:4, fontSize:11 }}>{label}</div>}
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? fmtKrw(p.value) : p.value}</div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
const Empty = ({ msg = '종목을 추가하면 차트가 표시됩니다' }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#374151', fontSize:13, minHeight:100 }}>
    {msg}
  </div>
)

// ─── Card wrapper ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background:'#1a1d27', border:'0.5px solid #2a2d3a', borderRadius:12, ...style }}>
    {children}
  </div>
)
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', padding:'14px 18px 0', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>
    {children}
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [priceMap,    setPriceMap]    = useState<Record<string,LivePrice>>({})
  const [loading,     setLoading]     = useState(true)
  const [usdKrw,      setUsdKrw]      = useState(USD_KRW)
  const [rateSource,  setRateSource]  = useState<string>('로딩 중')

  // 5초 타임아웃
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 5000)
    return () => clearTimeout(t)
  }, [loading])

  // USD/KRW 환율 — 단일 소스(/api/exchange-rate), localStorage 캐시, 1시간 갱신
  // TopHeader와 동일한 키('usd_krw_rate')를 사용해 값을 공유
  useEffect(() => {
    const CACHE_KEY = 'usd_krw_rate'
    const HOUR_MS   = 60 * 60 * 1000

    const fetchRate = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { rate, savedAt } = JSON.parse(cached) as { rate: number; savedAt: string }
          if (Date.now() - new Date(savedAt).getTime() < HOUR_MS) {
            setUsdKrw(Math.round(rate))
            setRateSource('실시간 환율 (1시간 갱신)')
            return
          }
        }
      } catch { /* ignore */ }

      try {
        const res = await fetch('/api/exchange-rate')
        if (res.ok) {
          const { rate } = await res.json() as { rate: number }
          if (typeof rate === 'number' && rate > 0) {
            const rounded = Math.round(rate)
            setUsdKrw(rounded)
            setRateSource('실시간 환율 (1시간 갱신)')
            localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: rounded, savedAt: new Date().toISOString() }))
            return
          }
        }
      } catch { /* fallback */ }

      setUsdKrw(USD_KRW)
      setRateSource('기본값 ₩1,350')
    }

    fetchRate()
    const iv = setInterval(fetchRate, HOUR_MS)
    return () => clearInterval(iv)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data:{session} } = await sb.auth.getSession()
      const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
      if (!uid) { router.push('/login'); return }

      const { data } = await sb
        .from('investments')
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category')
        .eq('user_id', uid)
      const invs = data ?? []
      setInvestments(invs)

      if (invs.length > 0) {
        const res = await fetch('/api/stock-price', {
          method: 'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(invs.map(i => ({ ticker:i.ticker, market:i.market }))),
        })
        if (res.ok) {
          const results: ({ticker:string}&LivePrice)[] = await res.json()
          const m: Record<string,LivePrice> = {}
          results.forEach(r => { m[r.ticker.toUpperCase()] = r })
          setPriceMap(m)
        }
      }
    } catch(e) { console.error('[Dashboard]', e) }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived values ─────────────────────────────────────────────
  const live = (inv: Investment) => priceMap[inv.ticker.toUpperCase()] ?? null

  const pricedInvs = investments.filter(i => live(i))
  const totalCostKrw = investments.reduce((s,i) => s + toKrw(i), 0)
  const totalCurrKrw = pricedInvs.reduce((s,i) => {
    const lv = live(i)
    return s + (lv ? toKrw(i, lv.currentPrice) : toKrw(i))
  }, 0)
  const costPricedKrw = pricedInvs.reduce((s,i) => s + toKrw(i), 0)
  const totalPnL  = totalCurrKrw - costPricedKrw
  const totalRet  = costPricedKrw > 0 ? (totalPnL / costPricedKrw) * 100 : null

  // ── Treemap data ───────────────────────────────────────────────
  const treemapData = useMemo(() => {
    // 현재가가 로드된 유효한 종목만 포함
    const valid = investments.filter(inv => {
      const lv = live(inv)
      return (
        inv.name?.trim() &&
        inv.ticker?.trim() &&
        inv.purchase_price > 0 &&
        inv.quantity > 0 &&
        lv && lv.currentPrice > 0
      )
    })

    const rows = valid.map(inv => {
      const lv             = live(inv)!
      const exRate         = inv.currency === 'USD' ? usdKrw : 1
      const currentValKrw  = lv.currentPrice  * inv.quantity * exRate
      const purchaseValKrw = inv.purchase_price * inv.quantity * exRate
      const rawRet = purchaseValKrw > 0
        ? ((currentValKrw - purchaseValKrw) / purchaseValKrw) * 100
        : 0
      const ret = isFinite(rawRet) ? Math.round(rawRet * 10) / 10 : 0

      return {
        name:       inv.name ?? inv.ticker,
        ticker:     inv.ticker,
        size:       Math.max(currentValKrw, 1),
        returnRate: ret,
        weight:     '0',   // 다음 단계에서 계산
      }
    })

    // 비중(weight) 계산 — 전체 평가금액 대비
    const totalSize = rows.reduce((s, d) => s + d.size, 0)
    rows.forEach(d => {
      d.weight = totalSize > 0
        ? ((d.size / totalSize) * 100).toFixed(1)
        : '0'
    })

    return rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments, priceMap, usdKrw])

  // ── 30-day portfolio trend using 1M chart data ─────────────────
  const trendData = useMemo(() => {
    if (!pricedInvs.length) return []
    // Collect all timestamps from 1M charts
    const tsSet = new Set<number>()
    pricedInvs.forEach(inv => {
      (priceMap[inv.ticker.toUpperCase()]?.charts?.['1M'] ?? []).forEach(p => tsSet.add(p.t))
    })
    const sortedTs = Array.from(tsSet).sort((a,b) => a-b).slice(-30)
    if (!sortedTs.length) return []

    return sortedTs.map(t => {
      let total = 0
      pricedInvs.forEach(inv => {
        const chart = priceMap[inv.ticker.toUpperCase()]?.charts?.['1M'] ?? []
        if (!chart.length) { total += toKrw(inv); return }
        const closest = chart.reduce((a,b) => Math.abs(b.t-t) < Math.abs(a.t-t) ? b : a)
        total += toKrw(inv, closest.v)
      })
      return {
        t,
        date: new Date(t).toLocaleDateString('ko-KR', { month:'numeric', day:'numeric' }),
        value: Math.round(total),
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedInvs, priceMap])

  const trendUp = trendData.length >= 2 && trendData[trendData.length-1].value >= trendData[0].value
  const trendGradId = 'trendGrad'

  // ── Market donut data ──────────────────────────────────────────
  const mktData = (['US','KR','CRYPTO'] as Market[]).map(m => ({
    name: m, value: investments.filter(i => i.market === m).length, color: MKT_COLOR[m],
  })).filter(d => d.value > 0)

  // ── Lynch donut data ───────────────────────────────────────────
  const lynchData = useMemo(() => {
    const counts: Record<string,number> = {}
    investments.forEach(i => { const k = i.lynch_category ?? 'na'; counts[k] = (counts[k]??0)+1 })
    return Object.entries(counts).map(([k,v]) => ({
      name: LYNCH_META[k]?.label ?? k, value: v, color: LYNCH_META[k]?.color ?? '#374151'
    }))
  }, [investments])

  // ── Alerts ─────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { type:'success'|'warning'|'info'; msg: string }[] = []
    list.push({ type:'info', msg:'시장 개요: 미국 증시는 AI·반도체 중심으로 강세 유지 중입니다.' })
    pricedInvs.forEach(inv => {
      const lv  = live(inv)
      const ret = lv ? ((lv.currentPrice - inv.purchase_price) / inv.purchase_price) * 100 : 0
      if (ret >= 15)  list.push({ type:'success', msg:`${inv.name} ${fmtPct(ret)} — 수익 실현을 고려해 보세요` })
      if (ret <= -10) list.push({ type:'warning', msg:`${inv.name} ${fmtPct(ret)} — 손실 중인 종목입니다` })
    })
    return list.slice(0, 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedInvs, priceMap])

  const alertBorder: Record<string, string> = { success:'#16a34a', warning:'#dc2626', info:'#2563eb' }
  const alertBg:     Record<string, string> = { success:'rgba(22,163,74,0.08)', warning:'rgba(220,38,38,0.08)', info:'rgba(37,99,235,0.08)' }
  const alertIcon:   Record<string, string> = { success:'✅', warning:'⚠️', info:'ℹ️' }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {[90, 300, 260, 300].map((h,i) => (
        <div key={i} style={{ height:h, background:'#1a1d27', borderRadius:12, animation:'pulse 1.5s infinite' }}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  // ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .hover-row:hover td{background:rgba(255,255,255,0.03)!important}
      `}</style>

      {/* ── 1. 요약 카드 4개 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
        {[
          { label:'총 자산 가치',   value: pricedInvs.length ? fmtKrw(totalCurrKrw) : fmtKrw(totalCostKrw), sub: pricedInvs.length ? '현재가 기준' : '매수가 기준', accent:'#f1f5f9' },
          { label:'총 손익 (KRW)',  value: totalRet != null ? fmtPct(totalRet) : '—', sub: totalPnL !== 0 ? fmtKrw(totalPnL) : undefined, accent: (totalRet??0) >= 0 ? '#ef4444' : '#3b82f6' },
          { label:'보유 종목 수',   value: `${investments.length}개`, sub:`수익 ${pricedInvs.filter(i=>(live(i)?.currentPrice??0)>i.purchase_price).length} · 손실 ${pricedInvs.filter(i=>(live(i)?.currentPrice??0)<i.purchase_price).length}`, accent:'#60a5fa' },
          { label:'USD/KRW 환율',  value: `₩${Math.round(usdKrw).toLocaleString('ko-KR')}`, sub: rateSource, accent:'#34d399' },
        ].map(({ label, value, sub, accent }) => (
          <Card key={label} style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:8 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color: accent, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.4px' }}>{value}</div>
            {sub && <div style={{ fontSize:10, color:'#374151', marginTop:4 }}>{sub}</div>}
          </Card>
        ))}
      </div>

      {/* ── 2. 자산 비중 히트맵 ── */}
      <Card>
        <SectionTitle>자산 비중 히트맵</SectionTitle>
        <div style={{ padding:'12px 16px 16px' }}>
          {treemapData.length === 0 ? <Empty/> : (
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={treemapData}
                dataKey="size"
                isAnimationActive={false}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={<CustomTreemapContent {...({} as any)}/>}
              />
            </ResponsiveContainer>
          )}
          {/* 히트맵 범례 */}
          <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
            {[['#dc2626','+10% 이상'],['#ef4444','0~+10%'],['#374151','보합'],['#3b82f6','0~-10%'],['#1d4ed8','-10% 이하']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block', flexShrink:0 }}/>
                {l}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ── 3. 자산 추이 + 비중 도넛 2단 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'6fr 4fr', gap:16 }}>

        {/* 좌: 30일 자산 추이 */}
        <Card>
          <SectionTitle>자산 총액 변화 (최근 30일)</SectionTitle>
          <div style={{ padding:'8px 18px 4px', display:'flex', gap:24 }}>
            {totalRet != null && (
              <>
                <div>
                  <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em' }}>누적 수익률</div>
                  <div style={{ fontSize:16, fontWeight:800, color:(totalRet??0)>=0?'#ef4444':'#3b82f6', fontVariantNumeric:'tabular-nums' }}>{fmtPct(totalRet)}</div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em' }}>실현 손익</div>
                  <div style={{ fontSize:16, fontWeight:800, color:totalPnL>=0?'#ef4444':'#3b82f6', fontVariantNumeric:'tabular-nums' }}>{fmtKrw(totalPnL)}</div>
                </div>
              </>
            )}
          </div>
          <div style={{ padding:'4px 12px 16px' }}>
            {trendData.length < 2 ? <Empty msg="현재가 데이터 로딩 후 표시됩니다"/> : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{ top:8, right:8, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={trendGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={trendUp?'#ef4444':'#3b82f6'} stopOpacity={0.25}/>
                      <stop offset="100%" stopColor={trendUp?'#ef4444':'#3b82f6'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fill:'#4b5563', fontSize:10 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fill:'#4b5563', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>v>=1e8?`${(v/1e8).toFixed(0)}억`:v>=1e4?`${(v/1e4).toFixed(0)}만`:`${v}`} width={50}/>
                  <Tooltip content={<DarkTip/>}/>
                  <Area type="monotone" dataKey="value" name="포트폴리오" stroke={trendUp?'#ef4444':'#3b82f6'} strokeWidth={2} fill={`url(#${trendGradId})`} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* 우: 도넛 차트 2개 */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* 시장별 */}
          <Card style={{ flex:1, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>시장별 비중</div>
            {mktData.length === 0 ? <Empty/> : (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <ResponsiveContainer width={90} height={90}>
                  <PieChart>
                    <Pie data={mktData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={42} paddingAngle={2}>
                      {mktData.map((e,i) => <Cell key={i} fill={e.color} stroke="transparent"/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                  {mktData.map(d => (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:8,height:8,borderRadius:'50%',background:d.color,flexShrink:0 }}/>
                      <span style={{ fontSize:11, color:d.color, fontWeight:600 }}>{d.name}</span>
                      <span style={{ fontSize:11, color:'#4b5563', marginLeft:'auto' }}>{d.value}종</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 린치 분류 */}
          <Card style={{ flex:1, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>
              피터 린치 분류
              <span style={{ float:'right', color:'#374151' }}>{investments.length}종목</span>
            </div>
            {lynchData.filter(d=>d.name!=='N/A').length === 0 ? <Empty/> : (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart>
                      <Pie data={lynchData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={42} paddingAngle={2}>
                        {lynchData.map((e,i) => <Cell key={i} fill={e.color} stroke="transparent"/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:11, fontWeight:800, color:'#f1f5f9', pointerEvents:'none' }}>
                    {investments.length}
                  </div>
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
                  {lynchData.slice(0,5).map(d => (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:'50%',background:d.color,flexShrink:0 }}/>
                      <span style={{ fontSize:9,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1 }}>{d.name}</span>
                      <span style={{ fontSize:10,color:'#4b5563',flexShrink:0 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── 4. 보유 자산 테이블 + 알림 패널 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'6fr 4fr', gap:16 }}>

        {/* 좌: 보유 자산 테이블 */}
        <Card>
          <SectionTitle>보유 자산 상세</SectionTitle>
          <div style={{ overflowX:'auto', padding:'10px 0 16px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1f2937' }}>
                  {['자산명','시장','매수단가','현재가','수익률','7일 추이'].map(h => (
                    <th key={h} style={{ padding:'6px 14px', textAlign:'left', fontSize:9, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investments.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding:'32px 14px', textAlign:'center', color:'#374151', fontSize:13 }}>
                    자산관리 페이지에서 종목을 추가해주세요
                  </td></tr>
                ) : investments.map((inv, idx) => {
                  const lv  = live(inv)
                  const ret = lv ? ((lv.currentPrice - inv.purchase_price) / inv.purchase_price) * 100 : null
                  const rc  = ret == null ? '#6b7280' : ret >= 0 ? '#ef4444' : '#3b82f6'
                  const w7  = lv?.charts?.['1W'] ?? []
                  return (
                    <tr key={inv.id} className="hover-row" style={{ borderTop:'1px solid #1f2937', background:idx%2===0?'transparent':'rgba(13,17,23,0.3)' }}>
                      <td style={{ padding:'9px 14px' }}>
                        <div style={{ fontWeight:600, color:'#f1f5f9' }}>{inv.name}</div>
                        <div style={{ fontSize:10, color:'#4b5563', fontFamily:'monospace', marginTop:1 }}>{inv.ticker}</div>
                      </td>
                      <td style={{ padding:'9px 14px' }}>
                        <span style={{ fontSize:9,fontWeight:700,color:MKT_COLOR[inv.market],border:`1px solid ${MKT_COLOR[inv.market]}44`,borderRadius:4,padding:'1px 4px' }}>{inv.market}</span>
                      </td>
                      <td style={{ padding:'9px 14px', color:'#6b7280', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                        {inv.currency==='KRW' ? `₩${Math.round(inv.purchase_price).toLocaleString()}` : `$${inv.purchase_price.toFixed(2)}`}
                      </td>
                      <td style={{ padding:'9px 14px', color:'#cbd5e1', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                        {lv ? (inv.currency==='KRW' ? `₩${Math.round(lv.currentPrice).toLocaleString()}` : `$${lv.currentPrice.toFixed(2)}`) : '—'}
                      </td>
                      <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}>
                        {ret !== null ? (
                          <span style={{ fontSize:13,fontWeight:800,color:rc,fontVariantNumeric:'tabular-nums' }}>
                            {(ret??0)>=0?'+':''}{safeFixed(ret,2)}%
                          </span>
                        ) : <span style={{ color:'#374151' }}>—</span>}
                      </td>
                      <td style={{ padding:'5px 14px' }}>
                        <MiniChart data={w7}/>
                      </td>
                    </tr>
                  )
                })}

                {/* 합계 행 */}
                {investments.length > 0 && (
                  <tr style={{ borderTop:'2px solid #374151', background:'#0d1117' }}>
                    <td colSpan={3} style={{ padding:'9px 14px', fontWeight:700, color:'#f1f5f9', fontSize:12 }}>합계 ({investments.length}종목)</td>
                    <td style={{ padding:'9px 14px', fontWeight:700, color:'#f1f5f9', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                      {pricedInvs.length ? fmtKrw(totalCurrKrw) : '—'}
                    </td>
                    <td style={{ padding:'9px 14px' }}>
                      {totalRet != null && (
                        <span style={{ fontSize:13,fontWeight:800,color:totalRet>=0?'#ef4444':'#3b82f6',fontVariantNumeric:'tabular-nums' }}>
                          {fmtPct(totalRet)}
                        </span>
                      )}
                    </td>
                    <td/>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 우: 알림 패널 */}
        <Card>
          <SectionTitle>투자학교 알림</SectionTitle>
          <div style={{ padding:'12px 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            {alerts.length === 0 ? (
              <Empty msg="종목을 추가하면 알림이 표시됩니다"/>
            ) : alerts.map((a, i) => (
              <div key={i} style={{
                padding:'10px 12px', borderRadius:8,
                background: alertBg[a.type],
                border: `1px solid ${alertBorder[a.type]}44`,
                fontSize:12, color:'#d1d5db', lineHeight:1.5,
                display:'flex', gap:8, alignItems:'flex-start',
              }}>
                <span style={{ flexShrink:0, fontSize:14 }}>{alertIcon[a.type]}</span>
                <div>
                  <span style={{ fontSize:9, fontWeight:700, color: alertBorder[a.type], letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:3 }}>
                    {a.type === 'success' ? 'PROFIT' : a.type === 'warning' ? 'WARNING' : 'SYSTEM'}
                  </span>
                  {a.msg}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
