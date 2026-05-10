'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart,
  Treemap, BarChart, Bar, Cell as BarCell, ReferenceLine, LabelList,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface IndexData {
  id:        string
  name:      string
  value:     number
  change:    number
  changePct: number
  isUp:      boolean
  currency:  'USD' | 'KRW' | 'JPY'
  open:      number
  high:      number
  low:       number
  chartData: { t: number; v: number }[]
  updatedAt: string
}
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
  dividendYield?: number | null
  annualDividend?: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fundamentals?: any
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
  return v >= 1e8 ? `₩${(v/1e8).toLocaleString('ko-KR', { minimumFractionDigits:1, maximumFractionDigits:1 })}억`
    : v >= 1e4 ? `₩${Math.round(v/1e4).toLocaleString('ko-KR')}만`
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
  if (!width || !height || width < 12 || height < 12) return null

  const rate    = isFinite(returnRate ?? 0) ? (returnRate ?? 0) : 0
  const bgColor = getHeatmapColor(rate)
  const rateText = `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`
  const cx = x + width  / 2
  const cy = y + height / 2

  // ── 박스 크기 기반 폰트 스케일 계산 ─────────────────────
  const minDim   = Math.min(width, height)
  // 수익률 폰트: 박스의 짧은 변 기준, 최소 8 ~ 최대 16
  const rateSize = Math.max(8, Math.min(16, minDim * 0.22))
  // 종목명 폰트: 너비 기준, 최소 7 ~ 최대 12
  const nameSize = Math.max(7, Math.min(12, width * 0.09))
  // 보조 폰트 (티커·비중): 최소 6 ~ 최대 9
  const subSize  = Math.max(6, Math.min(9,  minDim * 0.11))

  // ── 표시 레벨 결정 ────────────────────────────────────────
  const isLarge  = width > 110 && height > 60   // 종목명 + 티커 + 수익률 + 비중
  const isMedium = width > 55  && height > 38   // 티커(단축) + 수익률
  // 그 이하(tiny): 수익률만

  // ── 종목명 최대 글자 수 (너비 비례) ───────────────────────
  const maxChars = Math.max(4, Math.floor(width / (nameSize * 0.65)))
  const shortName = (name ?? '').length > maxChars
    ? (name as string).slice(0, maxChars - 1) + '…'
    : (name ?? '')

  // ── 한국 종목 감지: 순수 숫자(000660) 또는 숫자로 시작(0131V0 ETF) → 이름으로 표시
  const isKrTicker = /^\d/.test(ticker ?? '')
  // 중형 박스 라벨: 한국=단축이름, 미국/코인=티커
  const midLabel = isKrTicker ? shortName : (ticker || shortName)

  // clipPath ID (x,y 기반 고유값)
  const clipId = `tc-${Math.round(x)}-${Math.round(y)}`

  return (
    <g>
      {/* ── 클리핑 마스크: 텍스트가 절대 박스 밖으로 나가지 않음 ── */}
      <defs>
        <clipPath id={clipId}>
          <rect x={x + 2} y={y + 2} width={width - 4} height={height - 4}/>
        </clipPath>
      </defs>

      {/* 배경 박스 */}
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        fill={bgColor} stroke="#0f1117" strokeWidth={2}
        style={{ cursor: 'pointer' }}
      />

      {/* 텍스트 — 모두 clipPath 안에서 렌더 */}
      <g clipPath={`url(#${clipId})`} style={{ pointerEvents: 'none' }}>
        {isLarge ? (
          /* ── 대형 박스: 종목명 + 티커 + 수익률 + 비중 ── */
          <>
            <text x={cx} y={cy - height * 0.22}
              textAnchor="middle" fill="white"
              fontSize={nameSize} fontWeight="bold">
              {shortName}
            </text>
            <text x={cx} y={cy - height * 0.04}
              textAnchor="middle" fill="rgba(255,255,255,0.65)"
              fontSize={subSize}>
              {ticker}
            </text>
            <text x={cx} y={cy + height * 0.18}
              textAnchor="middle" fill="white"
              fontSize={rateSize} fontWeight="bold">
              {rateText}
            </text>
            <text x={cx} y={cy + height * 0.35}
              textAnchor="middle" fill="rgba(255,255,255,0.55)"
              fontSize={subSize}>
              {weight}%
            </text>
          </>
        ) : isMedium ? (
          /* ── 중형 박스: 이름/티커 + 수익률 + 비중(공간 있으면) ── */
          <>
            <text x={cx} y={cy - (height > 55 ? minDim * 0.18 : minDim * 0.12)}
              textAnchor="middle" fill="rgba(255,255,255,0.9)"
              fontSize={Math.max(6, Math.min(subSize + 1, width * 0.12))} fontWeight="bold">
              {midLabel}
            </text>
            <text x={cx} y={cy + (height > 55 ? minDim * 0.08 : minDim * 0.15)}
              textAnchor="middle" fill="white"
              fontSize={Math.max(7, rateSize * 0.85)} fontWeight="bold">
              {rateText}
            </text>
            {/* 공간 충분하면 비중 표시 */}
            {height > 55 && (
              <text x={cx} y={cy + minDim * 0.3}
                textAnchor="middle" fill="rgba(255,255,255,0.55)"
                fontSize={Math.max(6, subSize * 0.9)}>
                {weight}%
              </text>
            )}
          </>
        ) : (
          /* ── 소형 박스: 수익률만 ── */
          <text x={cx} y={cy + rateSize * 0.38}
            textAnchor="middle" fill="white"
            fontSize={Math.max(7, rateSize * 0.75)} fontWeight="bold">
            {rateText}
          </text>
        )}
      </g>
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
  const [indices,     setIndices]     = useState<IndexData[]>([])
  const [indicesLoading, setIndicesLoading] = useState(true)

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

  // 시장 지수 (S&P500 / NASDAQ / KOSPI / KOSDAQ) — 5분 캐시
  useEffect(() => {
    const load = async () => {
      setIndicesLoading(true)
      try {
        const res = await fetch('/api/market-indices')
        if (res.ok) {
          const data: IndexData[] = await res.json()
          setIndices(data)
        }
      } catch { /* silent */ }
      finally { setIndicesLoading(false) }
    }
    load()
    // 5분마다 자동 갱신
    const iv = setInterval(load, 5 * 60 * 1000)
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
          results.forEach(r => {
            m[r.ticker.toUpperCase()] = {
              ...r,
              dividendYield:  r.fundamentals?.dividendYield  ?? null,
              annualDividend: r.fundamentals?.annualDividend  ?? null,
            }
          })
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

  // ── 월별 평가손익 (매수월 기준 그룹핑) ────────────────────────
  const monthlyPnL = useMemo(() => {
    // 매수월별로 종목 그룹핑
    const map: Record<string, { cost: number; curr: number; count: number }> = {}

    pricedInvs.forEach(inv => {
      const lv   = live(inv)
      if (!lv) return
      const month = inv.purchase_date.slice(0, 7)   // "YYYY-MM"
      const exRate = inv.currency === 'USD' ? usdKrw : 1
      const cost   = inv.purchase_price * inv.quantity * exRate
      const curr   = lv.currentPrice    * inv.quantity * exRate

      if (!map[month]) map[month] = { cost: 0, curr: 0, count: 0 }
      map[month].cost  += cost
      map[month].curr  += curr
      map[month].count += 1
    })

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { cost, curr, count }]) => {
        const pnl    = curr - cost
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
        const [y, m] = month.split('-')
        return {
          month,
          label:  `${y.slice(2)}년 ${parseInt(m)}월`,
          pnl:    Math.round(pnl),
          pnlPct: parseFloat(pnlPct.toFixed(1)),
          count,
          isUp:   pnl >= 0,
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedInvs, priceMap, usdKrw])

  // ── 오늘 포트폴리오 등락 (changePct 기반) ──────────────────────
  const todayPnL = useMemo(() => {
    let amount = 0, prevTotal = 0
    pricedInvs.forEach(inv => {
      const lv = priceMap[inv.ticker.toUpperCase()]
      if (!lv || !isFinite(lv.changePct)) return
      const exRate     = inv.currency === 'USD' ? usdKrw : 1
      const currentVal = lv.currentPrice * inv.quantity * exRate
      const prevVal    = currentVal / (1 + lv.changePct / 100)
      amount    += currentVal - prevVal
      prevTotal += prevVal
    })
    const pct = prevTotal > 0 ? (amount / prevTotal) * 100 : 0
    return { amount: Math.round(amount), pct: isFinite(pct) ? pct : 0 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedInvs, priceMap, usdKrw])

  // ── Alerts — 피터린치·버핏 철학 기반 맥락있는 알림 ──────────────
  const alerts = useMemo(() => {
    type Alert = { type:'success'|'warning'|'info'; label:string; msg:string }
    const list: Alert[] = []

    // 종목명 단축 헬퍼
    const shorten = (name: string, max = 14) =>
      name.length > max ? name.slice(0, max - 1) + '…' : name

    // 빈 포트폴리오 안내
    if (investments.length === 0) {
      list.push({ type:'info', label:'GUIDE',
        msg:'자산관리 메뉴에서 보유 종목을 추가하면 포트폴리오 분석이 시작됩니다.' })
      return list
    }

    // ── 수익률 계산 (주식/ETF vs 암호화폐 분리) ──────────────────
    const withRet = pricedInvs.map(inv => {
      const lv  = live(inv)
      const ret = lv ? ((lv.currentPrice - inv.purchase_price) / inv.purchase_price) * 100 : 0
      const dayChange = lv?.changePct ?? 0   // 당일 등락률
      return { inv, ret, dayChange }
    }).filter(d => isFinite(d.ret))

    const stocksETF  = withRet.filter(d => d.inv.market !== 'CRYPTO')
    const cryptos    = withRet.filter(d => d.inv.market === 'CRYPTO')
    const sorted     = [...withRet].sort((a, b) => b.ret - a.ret)
    const sortedDay  = [...withRet].sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange))

    // ── 1. 포트폴리오 스냅샷 (STATUS 대체 — 전문적 문구) ─────────
    const topDayMover = sortedDay[0]
    const dayMoverStr = topDayMover
      ? ` | 오늘 최다 등락: ${shorten(topDayMover.inv.name)} ${topDayMover.dayChange >= 0 ? '+' : ''}${topDayMover.dayChange.toFixed(1)}%`
      : ''
    list.push({ type:'info', label:'MARKET SCAN',
      msg: `📡 ${pricedInvs.length}개 종목 실시간 모니터링 중 (주식/ETF ${stocksETF.length} · 코인 ${cryptos.length})${dayMoverStr}` })

    if (pricedInvs.length === 0) return list

    // ── 2. 포트폴리오 전체 수익률 ────────────────────────────────
    const winners = withRet.filter(d => d.ret > 0).length
    const losers  = withRet.filter(d => d.ret < 0).length
    list.push({
      type: totalRet != null && totalRet >= 0 ? 'success' : 'warning',
      label: 'PORTFOLIO',
      msg: totalRet != null
        ? `전체 수익률 ${fmtPct(totalRet)} | 수익 ${winners}종목 · 손실 ${losers}종목 · 보합 ${withRet.length - winners - losers}종목`
        : `총 ${investments.length}개 종목 보유 중`
    })

    // ── 3. 주식/ETF — 린치 분류 기반 맥락있는 수익 메시지 ─────────
    // 피터린치 원칙: 좋은 종목은 팔지 마라. 스토리가 유효하면 보유.
    const lynchHoldMsg: Record<string, string> = {
      fast_grower: '피터린치: 성장 스토리 유효하면 계속 보유 — 10-bagger를 찾아라',
      stalwart:    '우량주 수익 구간 — 일부 차익 후 장기 보유 병행 전략 고려',
      cyclical:    '경기 순환주 고점 접근 가능 — 사이클 전환 징후 모니터링 권장',
      turnaround:  '회생주 목표 구간 — 펀더멘탈 개선 지속 여부 재확인 필요',
      asset_play:  '자산 가치 실현 중 — 자산 대비 현재 가격 수준 재점검',
      slow_grower: '완만한 성장주 수익 구간 — 배당 재투자 전략 병행 권장',
      na:          '인덱스 펀드 — 피터린치·버핏 공통 추천: 장기 적립 유지',
    }

    const bestStock = stocksETF.sort((a, b) => b.ret - a.ret)[0]
    if (bestStock && bestStock.ret > 0) {
      const cat  = bestStock.inv.lynch_category ?? 'na'
      const name = shorten(bestStock.inv.name)
      const holdMsg = lynchHoldMsg[cat] ?? '수익 중 — 기업 스토리 변화 없으면 보유 유지'
      list.push({ type:'success', label:'TOP GAINER',
        msg: `🏆 ${name} ${fmtPct(bestStock.ret)} — ${holdMsg}` })
    }

    // ── 4. 주식/ETF — 손실 종목 경고 (주식 기준: -10%/-20%) ──────
    const worstStock = stocksETF.sort((a, b) => a.ret - b.ret)[0]
    if (worstStock && worstStock.ret < -10) {
      const name = shorten(worstStock.inv.name)
      const cat  = worstStock.inv.lynch_category ?? ''
      const cycNote = cat === 'cyclical' ? ' (경기 순환주 — 사이클 하락 구간 확인 필요)' : ''
      if (worstStock.ret <= -20) {
        list.push({ type:'warning', label:'RISK ALERT',
          msg:`🔴 ${name} ${fmtPct(worstStock.ret)}${cycNote} — 급락 구간 진입, 분산 전략 재검토 권장` })
      } else {
        list.push({ type:'warning', label:'WATCH',
          msg:`⚠️ ${name} ${fmtPct(worstStock.ret)}${cycNote} — 하락 지속 중, 투자 전략 점검 권장` })
      }
    }

    // ── 5. 암호화폐 — 완전히 다른 기준과 철학 적용 ──────────────
    // 코인은 변동성이 주식의 3~5배 → 기준치를 넓게 적용
    cryptos.forEach(({ inv, ret }) => {
      const name = shorten(inv.name)
      const isBtcEth = ['BTC','ETH'].includes(inv.ticker.toUpperCase())

      if (ret <= -30) {
        // -30% 이상 하락: 코인에서도 급락 경고
        list.push({ type:'warning', label:'CRYPTO RISK',
          msg:`🔴 ${name} ${fmtPct(ret)} — 급락 구간. 포지션 비중·손절 기준 재검토 권장` })
      } else if (ret < -15) {
        // -15~-30%: 코인 변동성 내 정상 조정
        list.push({ type:'info', label:'CRYPTO DIP',
          msg:`📉 ${name} ${fmtPct(ret)} — 변동성 정상 범위 내 조정. 장기 관점 유지 또는 분할 매수 고려` })
      } else if (ret >= 40) {
        // 코인 +40% 이상: 급등 후 일부 차익 고려
        list.push({ type:'success', label:'CRYPTO SURGE',
          msg: isBtcEth
            ? `🚀 ${name} ${fmtPct(ret)} — HODL 전략 유효. 일부 차익 후 현금 비율 관리 고려`
            : `🚀 ${name} ${fmtPct(ret)} — 급등 구간. 알트코인 고변동성 감안, 분할 차익 실현 고려` })
      } else if (ret > 0) {
        // 코인 소폭 수익: HODL 격려
        const hodlMsg = isBtcEth
          ? '디지털 금 특성 — HODL 전략, 단기 변동에 흔들리지 마세요'
          : '코인 보유 중 — 포트폴리오 비중 5~10% 유지, 리스크 관리 필수'
        list.push({ type:'success', label:'CRYPTO HOLD',
          msg:`₿ ${name} ${fmtPct(ret)} — ${hodlMsg}` })
      }
    })

    // ── 6. 추가 고수익 주식 종목 (best 제외, 25% 이상) ───────────
    const extraGainers = sorted.filter(d =>
      d.inv.market !== 'CRYPTO' && d.ret >= 25 && d.inv.id !== bestStock?.inv.id
    ).slice(0, 2)
    extraGainers.forEach(({ inv, ret }) => {
      const cat  = inv.lynch_category ?? 'na'
      const name = shorten(inv.name)
      const holdMsg = lynchHoldMsg[cat] ?? '성장 지속 여부 확인 후 보유 전략 결정'
      list.push({ type:'success', label:'HOLDING',
        msg: `📈 ${name} ${fmtPct(ret)} — ${holdMsg}` })
    })

    return list.slice(0, 8)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments, pricedInvs, priceMap, totalRet])

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

      {/* ── 1. 요약 카드 8개 (Full-Width) ── */}
      {(() => {
        // ── 추가 파생값 계산 ──────────────────────────────────────
        // 코인 비중
        const cryptoVal  = pricedInvs
          .filter(i => i.market === 'CRYPTO')
          .reduce((s,i) => s + toKrw(i, live(i)?.currentPrice ?? i.purchase_price), 0)
        const cryptoPct  = totalCurrKrw > 0 ? (cryptoVal / totalCurrKrw) * 100 : 0

        // 최고 / 최저 수익 종목
        const withRet = pricedInvs
          .map(i => {
            const lv = live(i)
            const ret = lv ? ((lv.currentPrice - i.purchase_price) / i.purchase_price) * 100 : 0
            return { inv: i, ret: isFinite(ret) ? ret : 0 }
          })
          .filter(d => d.ret !== 0)
          .sort((a,b) => b.ret - a.ret)

        const best  = withRet[0]
        const worst = withRet[withRet.length - 1]

        // 짧은 이름 헬퍼
        const shorten = (name: string, max = 8) =>
          name.length > max ? name.slice(0, max - 1) + '…' : name

        const winCount  = pricedInvs.filter(i => (live(i)?.currentPrice ?? 0) > i.purchase_price).length
        const lossCount = pricedInvs.filter(i => (live(i)?.currentPrice ?? 0) < i.purchase_price).length

        // 월간 예상 배당금 계산
        const monthlyDividend = pricedInvs.reduce((sum, inv) => {
          const lv = live(inv)
          const dy = lv?.dividendYield ?? (priceMap[inv.ticker.toUpperCase()]?.fundamentals as { dividendYield?: number | null })?.dividendYield ?? null
          if (!dy || dy <= 0) return sum
          const priceKrw = (lv?.currentPrice ?? inv.purchase_price) * (inv.currency === 'USD' ? usdKrw : 1)
          return sum + priceKrw * inv.quantity * dy / 12
        }, 0)
        const dividendStockCount = pricedInvs.filter(inv => {
          const lv = live(inv)
          const dy = lv?.dividendYield ?? null
          return (dy ?? 0) > 0
        }).length

        // ── 9 카드 정의 ──────────────────────────────────────────
        const N   = '#1b1e2e'
        const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'

        const cards = [
          {
            label: '총 자산 가치', accent: '#e2e8f0',
            main:  pricedInvs.length ? fmtKrw(totalCurrKrw) : fmtKrw(totalCostKrw),
            sub:   pricedInvs.length ? '현재가 기준' : '매수가 기준',
          },
          {
            label: '평가 손익', accent: (totalRet??0) >= 0 ? '#f87171' : '#60a5fa',
            main:  totalPnL !== 0 ? fmtKrw(totalPnL) : '—',
            sub:   totalRet != null ? `${(totalRet??0) >= 0 ? '+' : ''}${(totalRet??0).toFixed(2)}%` : undefined,
          },
          {
            label: '수익률', accent: (totalRet??0) >= 0 ? '#f87171' : '#60a5fa',
            main:  totalRet != null ? `${(totalRet??0) >= 0 ? '+' : ''}${(totalRet??0).toFixed(2)}%` : '—',
            sub:   totalPnL !== 0 ? fmtKrw(totalPnL) : undefined,
          },
          {
            label: '보유 종목', accent: '#60a5fa',
            main:  `${investments.length}개`,
            sub:   pricedInvs.length ? `수익 ${winCount} · 손실 ${lossCount}` : undefined,
          },
          {
            label: 'USD/KRW', accent: '#34d399',
            main:  `₩${Math.round(usdKrw).toLocaleString('ko-KR')}`,
            sub:   rateSource,
          },
          {
            label: '코인 비중', accent: '#fb923c',
            main:  pricedInvs.length ? `${cryptoPct.toFixed(1)}%` : '—',
            sub:   cryptoVal > 0 ? fmtKrw(cryptoVal) : '코인 없음',
          },
          {
            label: '최고 수익', accent: '#f87171',
            main:  best ? `+${best.ret.toFixed(1)}%` : '—',
            sub:   best ? shorten(best.inv.name) : undefined,
          },
          {
            label: '최저 수익', accent: '#60a5fa',
            main:  worst ? `${worst.ret.toFixed(1)}%` : '—',
            sub:   worst ? shorten(worst.inv.name) : undefined,
          },
          {
            label:  '월간 예상 배당금',
            main:   monthlyDividend > 0 ? fmtKrw(Math.round(monthlyDividend)) : '—',
            sub:    monthlyDividend > 0 ? `배당 종목 ${dividendStockCount}개` : '배당 종목 없음',
            accent: '#34d399',
          },
        ]

        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
            {cards.map(({ label, accent, main, sub }) => (
              <div key={label} style={{
                background: N, boxShadow: SHO,
                borderRadius: 12, padding: '12px 14px',
                borderLeft: `3px solid ${accent}`,
              }}>
                <div style={{ fontSize:8, fontWeight:700, color:'#454868', textTransform:'uppercase' as const, letterSpacing:'0.1em', marginBottom:6 }}>
                  {label}
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:accent, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.4px', lineHeight:1.1 }}>
                  {main}
                </div>
                {sub && <div style={{ fontSize:10, color:'#454868', marginTop:4 }}>{sub}</div>}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── 1-b. 글로벌 시장 지수 + 센티멘트 (뉴모피즘 v2) ── */}
      {(() => {
        /* ── 시장 개장 현황 ── */
        const _now  = new Date()
        const _kst  = new Date(_now.getTime() + 9 * 3_600_000)
        const _kDay = _kst.getUTCDay()
        const _kMin = _kst.getUTCHours() * 60 + _kst.getUTCMinutes()
        const isKrxOpen  = _kDay >= 1 && _kDay <= 5 && _kMin >= 540 && _kMin < 930
        const isTseOpen  = _kDay >= 1 && _kDay <= 5 &&
                           ((_kMin >= 540 && _kMin < 690) || (_kMin >= 750 && _kMin < 930))
        const _et   = new Date(_now.getTime() - 4 * 3_600_000)
        const _eDay = _et.getUTCDay()
        const _eMin = _et.getUTCHours() * 60 + _et.getUTCMinutes()
        const isNyseOpen = _eDay >= 1 && _eDay <= 5 && _eMin >= 570 && _eMin < 960

        const upCount   = indices.filter(i => i.isUp).length
        const downCount = indices.length - upCount
        const allUp     = indices.length > 0 && upCount === indices.length
        const majority  = upCount > downCount

        const fmtIdx = (v: number, cur: string) =>
          cur === 'KRW' ? v.toLocaleString('ko-KR',  { maximumFractionDigits: 2 })
          : cur === 'JPY' ? v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
          : v.toLocaleString('en-US', { maximumFractionDigits: 2 })

        /* ── 뉴모피즘 v2 토큰 ─────────────────────────────────────
           핵심: 섹션·카드 동일 배경색 → 그림자만으로 깊이 표현     */
        const N   = '#1b1e2e'   // 공통 배경 (섹션 = 카드 = 패널)
        const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'   // 볼록(raised)
        const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'  // 오목(inset)

        return (
          <div style={{
            background: N, borderRadius: 18,
            boxShadow: '10px 10px 28px #0b0d1a, -6px -6px 18px #2b2f46',
            padding: '16px',
            display: 'flex', gap: 14, alignItems: 'stretch',
          }}>

            {/* ═══ 왼쪽: 6 카드 3×2 ═══ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* 섹션 레이블 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 12, borderRadius: 2, background: 'linear-gradient(180deg,#6366f1,#3b82f6)' }}/>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#454868', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
                  Global Market Indices
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {indicesLoading && indices.length === 0
                  ? [0,1,2,3,4,5].map(i => (
                      <div key={i} style={{ height: 168, borderRadius: 14, background: N, boxShadow: SHO, animation: 'pulse 1.5s infinite' }}/>
                    ))
                  : indices.map(idx => {
                      const up       = idx.isUp
                      const C        = up ? '#ef4444' : '#3b82f6'
                      const Cs       = up ? '#f87171' : '#60a5fa'
                      // ← 방어 코드: chartData/open/high/low 없어도 크래시 없음
                      const chart    = Array.isArray(idx.chartData) ? idx.chartData : []
                      const hasChart = chart.length > 1
                      const idxOpen  = idx.open  ?? idx.value
                      const idxHigh  = idx.high  ?? idx.value
                      const idxLow   = idx.low   ?? idx.value
                      const rangeW   = idxHigh - idxLow
                      const hasRange = isFinite(rangeW) && rangeW > 1
                      const rPos     = hasRange
                        ? Math.max(3, Math.min(97, ((idx.value - idxLow) / rangeW) * 100))
                        : 50
                      const prevClose = idx.value - idx.change

                      return (
                        <div key={idx.id} style={{
                          borderRadius: 14, background: N,
                          boxShadow: SHO,
                          overflow: 'hidden',
                          display: 'flex', flexDirection: 'column',
                          /* 좌측 컬러 보더 — Bloomberg 스타일 */
                          borderLeft: `3px solid ${C}`,
                        }}>

                          {/* ① 헤더 */}
                          <div style={{ padding: '11px 13px 9px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#454868', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
                                {idx.name}
                              </span>
                              <span style={{
                                fontSize: 9, fontWeight: 800, color: Cs,
                                background: `${C}14`, border: `1px solid ${C}30`,
                                borderRadius: 5, padding: '2px 6px',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {up ? '▲' : '▼'} {Math.abs(idx.changePct).toFixed(2)}%
                              </span>
                            </div>

                            {/* 지수값 */}
                            <div style={{
                              fontSize: 22, fontWeight: 800, color: '#dde4f0',
                              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1.1,
                              marginBottom: 4,
                            }}>
                              {fmtIdx(idx.value, idx.currency)}
                            </div>

                            {/* 변화량 | 시가 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: Cs, fontVariantNumeric: 'tabular-nums' }}>
                                {up ? '+' : ''}{fmtIdx(idx.change, idx.currency)}
                                <span style={{ fontSize: 8, color: '#363855', marginLeft: 3, fontWeight: 400 }}>{idx.currency}</span>
                              </span>
                              <span style={{ width: 1, height: 9, background: '#2e3050', flexShrink: 0 }}/>
                              <span style={{ fontSize: 9, color: '#363855' }}>
                                시가 <span style={{ color: '#525678' }}>{fmtIdx(idxOpen, idx.currency)}</span>
                              </span>
                            </div>
                          </div>

                          {/* ② 차트 or OHLC */}
                          {hasChart ? (
                            <div style={{ flex: 1 }}>
                              <ResponsiveContainer width="100%" height={65}>
                                <AreaChart data={chart} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                                  <defs>
                                    <linearGradient id={`sg-${idx.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%"   stopColor={C} stopOpacity={0.28}/>
                                      <stop offset="100%" stopColor={C} stopOpacity={0.02}/>
                                    </linearGradient>
                                  </defs>
                                  <YAxis domain={['auto','auto']} hide/>
                                  <ReferenceLine y={prevClose} stroke={C} strokeDasharray="3 4" strokeWidth={0.8} strokeOpacity={0.4}/>
                                  <Area type="monotone" dataKey="v"
                                    stroke={C} strokeWidth={1.8}
                                    fill={`url(#sg-${idx.id})`}
                                    dot={false} isAnimationActive={false}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            /* KR 지수 — 차트 없음: OHLC 3칸 */
                            <div style={{
                              flex: 1, display: 'flex', alignItems: 'center',
                              padding: '0 13px', gap: 0, minHeight: 65,
                            }}>
                              {([['시가', idxOpen], ['고가', idxHigh], ['저가', idxLow]] as [string, number][]).map(([lbl, val], i) => (
                                <div key={lbl} style={{
                                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                  borderLeft: i > 0 ? '1px solid #252840' : 'none',
                                }}>
                                  <span style={{ fontSize: 8, color: '#363855', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{lbl}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#5a5f7a', fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtIdx(val, idx.currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ③ Day Range 푸터 */}
                          <div style={{ padding: '7px 13px 11px', borderTop: '1px solid #1e2140' }}>
                            {hasRange ? (
                              <>
                                {/* 섹션 레이블 */}
                                <div style={{ fontSize: 8, fontWeight: 700, color: '#363855', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                                  Day Range
                                </div>

                                {/* 저가 | 바 | 고가 — 한줄 레이아웃 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {/* 저가 */}
                                  <div style={{ textAlign: 'right' as const, flexShrink: 0, minWidth: 0 }}>
                                    <div style={{ fontSize: 7, color: '#3b82f6', fontWeight: 700, letterSpacing: '0.06em' }}>저가</div>
                                    <div style={{ fontSize: 9, color: '#60a5fa', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                                      {fmtIdx(idxLow, idx.currency)}
                                    </div>
                                  </div>

                                  {/* 바 트랙 */}
                                  <div style={{ flex: 1, position: 'relative' }}>
                                    {/* 트랙 배경 */}
                                    <div style={{
                                      height: 6, borderRadius: 3,
                                      background: '#13162a',
                                      boxShadow: SHI,
                                      position: 'relative', overflow: 'visible',
                                    }}>
                                      {/* 저가→현재 구간 채움 */}
                                      <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0,
                                        width: `${rPos}%`,
                                        background: `linear-gradient(90deg, ${C}55, ${C}99)`,
                                        borderRadius: 3,
                                      }}/>
                                      {/* 현재가 글로우 점 */}
                                      <div style={{
                                        position: 'absolute', top: '50%',
                                        left: `${rPos}%`,
                                        transform: 'translate(-50%, -50%)',
                                        width: 11, height: 11, borderRadius: '50%',
                                        background: C,
                                        boxShadow: `0 0 8px ${C}cc, 0 0 3px ${C}`,
                                        zIndex: 1,
                                      }}/>
                                    </div>
                                    {/* 현재가 숫자 — 점 아래 중앙 표시 */}
                                    <div style={{
                                      position: 'absolute',
                                      left: `${rPos}%`,
                                      top: 10,
                                      transform: 'translateX(-50%)',
                                      fontSize: 8, fontWeight: 800, color: C,
                                      fontVariantNumeric: 'tabular-nums',
                                      whiteSpace: 'nowrap' as const,
                                      background: N,
                                      padding: '0 2px',
                                    }}>
                                      {fmtIdx(idx.value, idx.currency)}
                                    </div>
                                  </div>

                                  {/* 고가 */}
                                  <div style={{ textAlign: 'left' as const, flexShrink: 0, minWidth: 0 }}>
                                    <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 700, letterSpacing: '0.06em' }}>고가</div>
                                    <div style={{ fontSize: 9, color: '#f87171', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                                      {fmtIdx(idxHigh, idx.currency)}
                                    </div>
                                  </div>
                                </div>

                                {/* 현재가 숫자 공간 확보 */}
                                <div style={{ height: 14 }}/>
                              </>
                            ) : (
                              /* 고저차 없을 때: 심플 텍스트 */
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {([['시가', idxOpen], ['고가', idxHigh], ['저가', idxLow]] as [string,number][]).map(([lbl,val]) => (
                                  <div key={lbl}>
                                    <div style={{ fontSize: 7, color: '#363855', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{lbl}</div>
                                    <div style={{ fontSize: 9, color: '#525678', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtIdx(val, idx.currency)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            </div>

            {/* ═══ 오른쪽: 오늘의 시장 패널 ═══ */}
            <div style={{ width: 214, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* 섹션 레이블 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 12, borderRadius: 2, background: 'linear-gradient(180deg,#a855f7,#6366f1)' }}/>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#454868', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
                  Today&apos;s Market
                </span>
              </div>

              <div style={{
                flex: 1, borderRadius: 14, background: N,
                boxShadow: SHO, padding: '15px 15px',
                display: 'flex', flexDirection: 'column', gap: 13,
              }}>

                {/* A. 지수 방향 */}
                <div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: '#363855', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 9 }}>
                    Market Direction
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 7 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#ef4444', letterSpacing: '-1px', lineHeight: 1 }}>{upCount}</span>
                    <span style={{ fontSize: 11, color: '#363855', margin: '0 5px', fontWeight: 700 }}>/</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#3b82f6', letterSpacing: '-1px', lineHeight: 1 }}>{downCount}</span>
                    <span style={{ fontSize: 9, color: '#454868', marginLeft: 8, lineHeight: 1.3 }}>
                      상승<br/>하락
                    </span>
                  </div>
                  {/* inset 프로그레스 바 */}
                  <div style={{
                    height: 7, borderRadius: 4,
                    boxShadow: SHI, background: '#13162a',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#3b82f628,#3b82f640)' }}/>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: indices.length > 0 ? `${(upCount / indices.length) * 100}%` : '0%',
                      background: 'linear-gradient(90deg,#dc2626,#f87171)',
                      transition: 'width 1.4s cubic-bezier(.4,0,.2,1)',
                    }}/>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, marginTop: 7, textAlign: 'center' as const,
                    color: allUp ? '#f87171' : majority ? '#f87171' : downCount > upCount ? '#60a5fa' : '#525678',
                  }}>
                    {indices.length === 0 ? '—'
                      : allUp ? '📈 전 지수 상승'
                      : majority ? `📈 ${upCount}개 상승 우위`
                      : downCount > upCount ? `📉 ${downCount}개 하락 우위`
                      : '➡ 혼조세'}
                  </div>
                </div>

                {/* 구분선 */}
                <div style={{ height: 1, boxShadow: 'inset 0 1px 2px #0e1020', background: '#0e1020' }}/>

                {/* B. 시장 현황 */}
                <div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: '#363855', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 9 }}>
                    Market Hours
                  </div>
                  {([
                    { flag: '🇺🇸', name: 'NYSE', isOpen: isNyseOpen },
                    { flag: '🇰🇷', name: 'KRX',  isOpen: isKrxOpen  },
                    { flag: '🇯🇵', name: 'TSE',  isOpen: isTseOpen  },
                  ] as const).map(m => (
                    <div key={m.name} style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7,
                      padding: '7px 10px', borderRadius: 10,
                      background: N,
                      boxShadow: m.isOpen
                        ? '4px 4px 10px #0e1020, -2px -2px 7px #282c44, inset 0 0 0 1px #22c55e22'
                        : SHI,
                    }}>
                      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{m.flag}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: m.isOpen ? '#86efac' : '#3d4060', width: 30, letterSpacing: '0.04em' }}>
                        {m.name}
                      </span>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: m.isOpen ? '#22c55e' : '#252840',
                        boxShadow: m.isOpen ? '0 0 8px #22c55e, 0 0 3px #4ade80' : 'none',
                      }}/>
                      <span style={{
                        fontSize: 9, fontWeight: 800, marginLeft: 'auto' as const,
                        color: m.isOpen ? '#4ade80' : '#2e3050',
                        letterSpacing: '0.04em',
                      }}>
                        {m.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: 8, color: '#2a2d42', textAlign: 'center' as const, letterSpacing: '0.04em' }}>
                    평일 기준 · EDT / KST / JST
                  </div>
                </div>

                {/* 구분선 */}
                <div style={{ height: 1, boxShadow: 'inset 0 1px 2px #0e1020', background: '#0e1020' }}/>

                {/* C. 오늘 내 포트폴리오 */}
                <div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: '#363855', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 9 }}>
                    My Portfolio Today
                  </div>
                  <div style={{ borderRadius: 10, background: N, boxShadow: SHI, padding: '11px 12px' }}>
                    {todayPnL.amount !== 0 ? (
                      <>
                        <div style={{
                          fontSize: 20, fontWeight: 900,
                          fontVariantNumeric: 'tabular-nums', lineHeight: 1.15,
                          color: todayPnL.amount >= 0 ? '#f87171' : '#60a5fa',
                          letterSpacing: '-0.4px',
                        }}>
                          {todayPnL.amount >= 0 ? '+' : ''}{fmtKrw(todayPnL.amount)}
                        </div>
                        <div style={{
                          fontSize: 11, fontVariantNumeric: 'tabular-nums', marginTop: 4,
                          color: todayPnL.pct >= 0 ? '#f87171' : '#60a5fa', fontWeight: 600,
                        }}>
                          {todayPnL.pct >= 0 ? '+' : ''}{todayPnL.pct.toFixed(2)}%
                          <span style={{ color: '#363855', marginLeft: 5, fontWeight: 400 }}>금일 등락</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#363855' }}>
                        {pricedInvs.length > 0 ? '보합' : '로딩 중…'}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )
      })()}


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
                  <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em' }}>평가 손익</div>
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

      {/* ── 4. 월별 평가손익 차트 ── */}
      <Card>
        <div style={{ padding:'14px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>
              📊 월별 평가손익 (매수월 기준)
            </div>
            <div style={{ fontSize:11, color:'#374151', marginTop:3 }}>
              각 월에 매수한 종목들의 현재 평가손익 합계
            </div>
          </div>
          {/* 범례 */}
          <div style={{ display:'flex', gap:14, flexShrink:0 }}>
            {[['#ef4444','수익'],['#3b82f6','손실']].map(([c,l])=>(
              <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                <span style={{ width:10, height:10, borderRadius:3, background:c, display:'inline-block' }}/>
                {l}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding:'8px 12px 16px' }}>
          {monthlyPnL.length === 0 ? (
            <Empty msg="현재가가 로드되면 차트가 표시됩니다"/>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyPnL} margin={{ top:20, right:16, bottom:0, left:10 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis
                  dataKey="label"
                  tick={{ fill:'#6b7280', fontSize:11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill:'#6b7280', fontSize:10 }}
                  axisLine={false} tickLine={false} width={56}
                  tickFormatter={v => v >= 1e8 ? `${(v/1e8).toFixed(1)}억` : v >= 1e4 ? `${(v/1e4).toFixed(0)}만` : v === 0 ? '0' : `${v}`}
                />
                <ReferenceLine y={0} stroke="#374151" strokeWidth={1.5}/>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#f1f5f9' }}>
                      <div style={{ fontWeight:700, marginBottom:6 }}>{d.label}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span>매수 종목: <strong>{d.count}개</strong></span>
                        <span style={{ color: d.isUp ? '#ef4444' : '#3b82f6', fontWeight:800, fontSize:14 }}>
                          {d.pnl >= 0 ? '+' : ''}
                          {d.pnl >= 1e8 ? `₩${(d.pnl/1e8).toFixed(1)}억` : d.pnl >= 1e4 ? `₩${(d.pnl/1e4).toFixed(0)}만` : `₩${d.pnl.toLocaleString('ko-KR')}`}
                        </span>
                        <span style={{ color:'#9ca3af', fontSize:11 }}>수익률 {d.pnlPct >= 0 ? '+' : ''}{d.pnlPct}%</span>
                      </div>
                    </div>
                  )
                }}/>
                <Bar dataKey="pnl" radius={[5,5,0,0]} maxBarSize={52}>
                  {monthlyPnL.map((entry, i) => (
                    <BarCell key={i} fill={entry.isUp ? '#ef4444' : '#3b82f6'} fillOpacity={0.85}/>
                  ))}
                  <LabelList
                    dataKey="pnlPct"
                    position="top"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => `${v >= 0 ? '+' : ''}${v}%`}
                    style={{ fontSize:10, fontWeight:700, fill:'#9ca3af' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── 5. 보유 자산 테이블 + 알림 패널 ── */}
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
                  <span style={{ fontSize:9, fontWeight:700, color: alertBorder[a.type], letterSpacing:'0.08em', textTransform:'uppercase' as const, display:'block', marginBottom:3 }}>
                    {(a as { label?: string }).label ?? (a.type === 'success' ? 'PROFIT' : a.type === 'warning' ? 'WARNING' : 'SYSTEM')}
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
