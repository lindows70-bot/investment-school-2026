'use client'

/**
 * LynchEarningsChart v2 — 하드코딩 완전 제거, 실 포트폴리오 연동
 *
 * ◆ 데이터 파이프라인
 *  1. props.portfolioStocks (부모 investments 배열) → 드롭다운 동적 생성
 *  2. 종목 선택 시 3-way 병렬 fetch:
 *     ① /api/stock-price  → ohlcCharts['1Y'] (월봉 60개) → 연간 평균가 산출
 *     ② /api/financials   → 연도별 EPS (actual, 추정 제외)
 *     ③ /api/stock-info   → 현재가, PE, PEG, 이익성장률(G)
 *  3. 연간 가격 + EPS → 이익선(Fair Value = EPS × 적정 PER) 계산
 *  4. 적정 PER 모델 3종 실시간 토글
 *  5. 빈 포트폴리오 / 분석 불가 종목 → Empty State
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  ChevronDown, Info, BarChart2, Zap, Target, Clock, RefreshCw,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
interface InvestmentItem {
  name:           string
  ticker:         string
  market:         string
  currency?:      string
  lynch_category?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]:  any
}

interface AnnualPoint {
  year:      string
  price:     number | null   // 연간 평균 실제 주가
  ttmEps:    number          // 해당 연도 EPS (연간)
  actualPer: number | null   // 실제 PER
  fairValue: number          // EPS × 적정PER (useMemo에서 주입)
  underLow:  number | null   // 저평가 음영 하단
  underHigh: number | null   // 저평가 음영 상단
  overLow:   number | null   // 고평가 음영 하단
  overHigh:  number | null   // 고평가 음영 상단
}

type PerModel = 'growth' | 'avg5y' | 'fixed15'

// ────────────────────────────────────────────────────────────
// 컬러 시스템
// ────────────────────────────────────────────────────────────
const C = {
  bg:      '#020617',
  surface: '#0f172a',
  card:    '#1e293b',
  cardHi:  '#263348',
  border:  '#334155',
  textHi:  '#f1f5f9',
  textMid: '#94a3b8',
  textLow: '#64748b',
  price:   '#60a5fa',
  fair:    '#f59e0b',
  under:   '#10b981',
  over:    '#f87171',
}

const MODEL_LABELS: Record<PerModel, string> = {
  growth:  '이익성장률 (PEG=1)',
  avg5y:   '5년 평균 PER',
  fixed15: '고정 PER 15배',
}

// ────────────────────────────────────────────────────────────
// 빈 포트폴리오 안내 UI
// ────────────────────────────────────────────────────────────
function EmptyPortfolio() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:14, padding:'60px 24px',
      background:C.card, border:`1px dashed ${C.border}`, borderRadius:14,
      textAlign:'center',
    }}>
      <div style={{ fontSize:40 }}>📭</div>
      <div style={{ fontSize:14, fontWeight:800, color:C.textHi }}>
        등록된 포트폴리오 종목이 없습니다.
      </div>
      <div style={{ fontSize:12, color:C.textLow, lineHeight:1.9, maxWidth:360 }}>
        메인 대시보드에서 종목을 추가하면<br />
        실시간 피터 린치 적정가치 이익선 분석이 시작됩니다.
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 분석 불가 종목 안내 UI
// ────────────────────────────────────────────────────────────
function NoEpsState({ name, reason }: { name: string; reason: string }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:12, padding:'40px 24px', minHeight:280,
      background:C.surface, border:`1px dashed ${C.border}`, borderRadius:12,
      textAlign:'center',
    }}>
      <div style={{ fontSize:32 }}>📊</div>
      <div style={{ fontSize:13, fontWeight:800, color:C.textHi }}>{name}</div>
      <div style={{ fontSize:11, color:C.textLow, lineHeight:1.8, maxWidth:340 }}>{reason}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 커스텀 툴팁
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? null

  const price     = get('price')
  const fairValue = get('fairValue')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ttmEps    = payload[0]?.payload?.ttmEps ?? 0
  const gap       = (price !== null && fairValue !== null && fairValue > 0)
    ? ((price - fairValue) / fairValue * 100)
    : null

  return (
    <div style={{
      background:'#0f172a', border:`1px solid ${C.border}`, borderRadius:10,
      padding:'12px 16px', fontSize:12, minWidth:210, zIndex:50,
      boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight:800, color:C.fair, marginBottom:8, fontSize:13 }}>
        📅 {label}년
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {price !== null && (
          <div style={{ display:'flex', justifyContent:'space-between', gap:20 }}>
            <span style={{ color:C.textMid }}>실제 주가</span>
            <span style={{ color:C.price, fontWeight:700, fontFamily:'monospace' }}>
              {price.toLocaleString(undefined, { maximumFractionDigits:2 })}
            </span>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', gap:20 }}>
          <span style={{ color:C.textMid }}>연간 EPS</span>
          <span style={{ color:C.textHi, fontFamily:'monospace' }}>
            {ttmEps.toLocaleString(undefined, { maximumFractionDigits:2 })}
          </span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:20 }}>
          <span style={{ color:C.textMid }}>린치 적정가치</span>
          <span style={{ color:C.fair, fontWeight:700, fontFamily:'monospace' }}>
            {fairValue?.toLocaleString(undefined, { maximumFractionDigits:2 })}
          </span>
        </div>
        {gap !== null && (
          <div style={{
            borderTop:`1px solid ${C.border}`, marginTop:4, paddingTop:6,
            display:'flex', justifyContent:'space-between',
          }}>
            <span style={{ color:C.textMid }}>가치 괴리율</span>
            <span style={{
              fontWeight:800, fontFamily:'monospace',
              color: gap < 0 ? C.under : C.over,
            }}>
              {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 괴리율 진단 패널
// ────────────────────────────────────────────────────────────
function ValuationPanel({
  price, fair, ticker, model, growthRate,
}: {
  price:      number
  fair:       number
  ticker:     string
  model:      PerModel
  growthRate: number
}) {
  const gap    = ((price - fair) / fair) * 100
  const absGap = Math.abs(gap)
  const isUnder = gap < 0

  const modelDesc =
    model === 'growth'  ? `이익성장률(G≈${growthRate}%) 기준` :
    model === 'avg5y'   ? '5년 평균 PER 기준' : '고정 PER 15배 기준'

  let severity = ''
  let guide = ''
  if (gap <= -30) {
    severity = `${gap.toFixed(1)}% 극단적 저평가`
    guide = `${ticker}는 현재 린치 적정가치 대비 ${absGap.toFixed(0)}% 저평가입니다. 피터 린치는 이 구간을 "역사적 매수 황금 타이밍"으로 정의합니다. EPS 성장 모멘텀이 유지되는지 반드시 확인하세요.`
  } else if (gap <= -15) {
    severity = `${gap.toFixed(1)}% 저평가 매력 구간`
    guide = `적정가치 대비 ${absGap.toFixed(0)}% 할인 상태입니다. 린치는 "이익이 성장하는 기업을 할인가에 사라"고 강조했습니다. 분할 매수 전략을 고려할 만한 구간입니다.`
  } else if (gap <= 0) {
    severity = `${gap.toFixed(1)}% 소폭 저평가`
    guide = `적정가치에 근접한 합리적 밸류에이션입니다. 장기 홀딩 관점에서 비중 유지가 적합합니다.`
  } else if (gap <= 20) {
    severity = `+${gap.toFixed(1)}% 소폭 고평가`
    guide = `소폭 프리미엄 상태입니다. 추가 매수보다 보유 유지를 권장하며, 다음 실적 발표 시 EPS 상향 여부를 확인하세요.`
  } else if (gap <= 50) {
    severity = `+${gap.toFixed(1)}% 고평가 주의`
    guide = `${ticker}는 적정가치 대비 ${absGap.toFixed(0)}% 프리미엄 상태입니다. 린치는 "아무리 좋은 주식도 비싸면 나쁜 투자"라고 경고했습니다. 신규 매수 자제를 권고합니다.`
  } else {
    severity = `+${gap.toFixed(1)}% 극단적 고평가`
    guide = `적정가치 대비 ${absGap.toFixed(0)}% 이상 고평가 상태입니다. 실적이 기대에 미치지 못할 경우 급격한 주가 조정 위험이 있습니다.`
  }

  const accentColor = isUnder ? C.under : C.over
  const Icon = isUnder ? (absGap > 20 ? TrendingDown : Minus) : (absGap > 20 ? TrendingUp : Minus)

  return (
    <div style={{
      marginTop:16, padding:'16px 20px', borderRadius:12,
      background: isUnder ? 'rgba(16,185,129,0.07)' : 'rgba(248,113,113,0.07)',
      border: `1px solid ${isUnder ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
      display:'flex', gap:16, alignItems:'flex-start',
    }}>
      <div style={{
        flexShrink:0, width:90, textAlign:'center', padding:'10px 0',
        borderRadius:10,
        background:`${accentColor}18`, border:`1px solid ${accentColor}40`,
      }}>
        <Icon size={20} color={accentColor} style={{ margin:'0 auto 4px' }} />
        <div style={{ fontSize:18, fontWeight:900, color:accentColor, fontFamily:'monospace' }}>
          {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
        </div>
        <div style={{ fontSize:9, color:C.textLow, marginTop:2 }}>{isUnder ? '저평가' : '고평가'}</div>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:800, color:accentColor, marginBottom:4 }}>{severity}</div>
        <div style={{ fontSize:11, color:C.textMid, lineHeight:1.75 }}>{guide}</div>
        <div style={{ marginTop:8, display:'flex', gap:12, flexWrap:'wrap', fontSize:10, color:C.textLow }}>
          <span>
            현재가{' '}
            <span style={{ color:C.price, fontWeight:700 }}>
              {price.toLocaleString(undefined, { maximumFractionDigits:2 })}
            </span>
          </span>
          <span>vs 적정가{' '}
            <span style={{ color:C.fair, fontWeight:700 }}>
              {fair.toLocaleString(undefined, { maximumFractionDigits:2 })}
            </span>
          </span>
          <span style={{ fontStyle:'italic' }}>({modelDesc})</span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LynchEarningsChart(props: any) {

  // ── Step 1: 부모로부터 실제 포트폴리오 배열 수신 ──────────
  const portfolio: InvestmentItem[] = useMemo(() => {
    const src =
      props.portfolioStocks ??
      props.stocks          ??
      props.portfolio       ??
      props.items           ??
      props.data            ??
      []
    return Array.isArray(src) ? src : []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.portfolioStocks, props.stocks, props.portfolio, props.items, props.data])

  // ── 로컬 상태 ────────────────────────────────────────────
  const [selectedIdx,   setSelectedIdx]   = useState(0)
  const [perModel,      setPerModel]      = useState<PerModel>('growth')
  const [period,        setPeriod]        = useState<'3Y' | '5Y'>('5Y')
  const [dropdownOpen,  setDropdownOpen]  = useState(false)

  // API 결과
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [rawPoints,     setRawPoints]     = useState<Omit<AnnualPoint,'fairValue'|'underLow'|'underHigh'|'overLow'|'overHigh'>[]>([])
  const [growthRate,    setGrowthRate]    = useState(15)
  const [avg5yPer,      setAvg5yPer]      = useState(20)
  const [currentPrice,  setCurrentPrice]  = useState(0)
  const [noEpsReason,   setNoEpsReason]   = useState<string | null>(null)

  const selectedStock = portfolio[selectedIdx] ?? null

  // ── Step 2: 종목 변경 시 3-way 병렬 API fetch ────────────
  const fetchData = useCallback(async (stock: InvestmentItem) => {
    setLoading(true)
    setError(null)
    setNoEpsReason(null)
    setRawPoints([])
    setCurrentPrice(0)

    const { ticker, market = 'US' } = stock
    const isCrypto = market === 'CRYPTO'

    try {
      // CRYPTO는 EPS 분석 불가
      if (isCrypto) {
        setNoEpsReason(`${stock.name}(${ticker})은 가상자산입니다. 피터 린치 이익선 분석은 EPS가 있는 주식 종목에만 적용됩니다.`)
        return
      }

      const enc = encodeURIComponent(ticker)

      // ① 병렬 fetch
      const [priceRes, finRes, infoRes] = await Promise.all([
        fetch(`/api/stock-price?ticker=${enc}&market=${market}`),
        fetch(`/api/financials?ticker=${enc}&market=${market}`),
        fetch(`/api/stock-info?ticker=${enc}&market=${market}`),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [priceData, finData, infoData]: [any, any, any] = await Promise.all([
        priceRes.ok  ? priceRes.json()  : Promise.resolve({}),
        finRes.ok    ? finRes.json()    : Promise.resolve({}),
        infoRes.ok   ? infoRes.json()   : Promise.resolve({}),
      ])

      // ── 현재 주가 ─────────────────────────────────────────
      const cp = Number(priceData?.currentPrice ?? infoData?.price ?? 0)
      setCurrentPrice(cp)

      // ── 이익성장률(G) 추출 ─────────────────────────────────
      // stock-info: pe, peg → G = pe/peg
      // fallback: earningsGrowth (소수 or 백분율)
      const siPe  = Number(infoData?.pe  ?? infoData?.fundamentals?.pe  ?? 0)
      const siPeg = Number(infoData?.peg ?? infoData?.fundamentals?.peg ?? 0)
      let g = 15
      if (siPe > 0 && siPeg > 0) {
        g = Math.round(siPe / siPeg)
      } else {
        const eg = Number(infoData?.earningsGrowth ?? infoData?.fundamentals?.earningsGrowth ?? 0)
        if (eg !== 0) g = Math.round(Math.abs(eg) < 5 ? eg * 100 : eg)
      }
      setGrowthRate(Math.max(1, Math.min(g, 200)))

      // ── 연도별 EPS (financials) ────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fin: Record<string, { eps: number }> = finData?.financials ?? {}
      const epsYears = Object.keys(fin)
        .filter(k => !k.endsWith('E'))   // 추정치 제외
        .sort()

      if (epsYears.length === 0) {
        setNoEpsReason(`${stock.name}(${ticker})의 재무 데이터를 가져올 수 없습니다. ETF·인덱스 또는 상장 초기 종목일 수 있습니다.`)
        return
      }

      // ── 월봉 60개 → 연간 평균가 산출 ─────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const monthly: any[] = (priceData?.ohlcCharts ?? priceData?.charts ?? {})?.['1Y'] ?? []
      const annualPriceMap: Record<string, number[]> = {}

      monthly.forEach((c) => {
        // 날짜: YYYYMMDD (string) 또는 Unix timestamp (number)
        let yr = ''
        if (typeof c.date === 'string') {
          yr = c.date.slice(0, 4)
        } else if (typeof c.date === 'number') {
          yr = new Date(c.date > 1e10 ? c.date : c.date * 1000).getFullYear().toString()
        } else if (typeof c.time === 'number') {
          yr = new Date(c.time > 1e10 ? c.time : c.time * 1000).getFullYear().toString()
        }
        const closePrice = Number(c.close ?? c.c ?? 0)
        if (!yr || yr.length !== 4 || closePrice <= 0) return
        if (!annualPriceMap[yr]) annualPriceMap[yr] = []
        annualPriceMap[yr].push(closePrice)
      })

      // 현재 연도는 현재가로 보완
      const thisYear = new Date().getFullYear().toString()
      if (cp > 0) {
        if (!annualPriceMap[thisYear]) annualPriceMap[thisYear] = []
        annualPriceMap[thisYear].push(cp)
      }

      // 배열 → 연간 평균 단가
      const annualPriceByYear: Record<string, number> = {}
      Object.entries(annualPriceMap).forEach(([yr, arr]) => {
        annualPriceByYear[yr] = arr.reduce((a, b) => a + b, 0) / arr.length
      })

      // ── 데이터 포인트 조립 ────────────────────────────────
      const pts = epsYears.map(yr => {
        const eps          = Number(fin[yr]?.eps ?? 0)
        const annualPrice  = annualPriceByYear[yr] ?? null
        const actualPer    = (annualPrice && eps > 0) ? parseFloat((annualPrice / eps).toFixed(1)) : null
        return { year: yr, price: annualPrice, ttmEps: eps, actualPer }
      })

      // 5년 평균 PER 계산
      const validPers = pts
        .map(p => p.actualPer)
        .filter((p): p is number => p !== null && p > 0 && p < 500)
      if (validPers.length > 0) {
        const avgP = validPers.reduce((a, b) => a + b, 0) / validPers.length
        setAvg5yPer(parseFloat(avgP.toFixed(1)))
      }

      setRawPoints(pts)

    } catch (e) {
      setError(`데이터 로딩 중 오류가 발생했습니다: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // 종목 변경 시 자동 fetch
  useEffect(() => {
    if (selectedStock) fetchData(selectedStock)
  }, [selectedStock, fetchData])

  // selectedIdx 범위 보정 (포트폴리오 종목 수 변경 시)
  useEffect(() => {
    if (portfolio.length > 0 && selectedIdx >= portfolio.length) {
      setSelectedIdx(0)
    }
  }, [portfolio.length, selectedIdx])

  // ── Step 3: fairPer 계산 ─────────────────────────────────
  const fairPer = useMemo(() => {
    if (perModel === 'growth')  return Math.max(growthRate, 1)
    if (perModel === 'avg5y')   return avg5yPer
    return 15
  }, [perModel, growthRate, avg5yPer])

  // ── Step 4: 최종 차트 데이터 (기간 슬라이싱 + fairValue 주입) ─
  const chartData: AnnualPoint[] = useMemo(() => {
    const years = period === '3Y' ? 3 : 5
    const sliced = rawPoints.slice(-years)
    return sliced.map(p => {
      const fv  = p.ttmEps > 0 ? parseFloat((p.ttmEps * fairPer).toFixed(2)) : 0
      const pr  = p.price
      const isUnder = pr !== null && fv > 0 && pr < fv
      const isOver  = pr !== null && fv > 0 && pr > fv
      return {
        ...p,
        fairValue:  fv,
        underLow:   isUnder ? pr  : null,
        underHigh:  isUnder ? fv  : null,
        overLow:    isOver  ? fv  : null,
        overHigh:   isOver  ? pr  : null,
      }
    })
  }, [rawPoints, fairPer, period])

  // ── 최신 데이터 포인트 (진단 패널용) ────────────────────
  const latest = useMemo(() => {
    const withPrice = chartData.filter(p => p.price !== null)
    return withPrice[withPrice.length - 1] ?? null
  }, [chartData])

  const latestPrice = latest?.price ?? currentPrice ?? 0
  const latestFair  = latest?.ttmEps ? latest.ttmEps * fairPer : 0
  const gap         = latestFair > 0 ? ((latestPrice - latestFair) / latestFair) * 100 : null

  // Y축 도메인
  const allY = chartData
    .flatMap(d => [d.price, d.fairValue])
    .filter((v): v is number => v !== null && v > 0)
  const yMin = allY.length > 0 ? Math.floor(Math.min(...allY) * 0.85) : 0
  const yMax = allY.length > 0 ? Math.ceil( Math.max(...allY) * 1.12) : 100

  // ────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────

  // 포트폴리오 비어있을 때
  if (portfolio.length === 0) return <EmptyPortfolio />

  return (
    <div style={{
      background:C.bg, minHeight:'100%',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      padding:'0 0 24px',
    }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div style={{
        padding:'16px 20px 12px', borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:10,
      }}>
        <div style={{
          width:36, height:36, borderRadius:9,
          background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <BarChart2 size={18} color={C.fair} />
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:900, color:C.textHi }}>
            피터 린치 적정가치 이익선 차트
          </div>
          <div style={{ fontSize:11, color:C.textLow, marginTop:1 }}>
            연간 EPS × 적정 PER = Fair Value Line · 내 포트폴리오 종목 연동
          </div>
        </div>
        {/* 범례 */}
        <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
          {[
            { color:C.price,  label:'실제 주가', dash:false },
            { color:C.fair,   label:'적정가치선', dash:true },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:C.textMid }}>
              <div style={{
                width:18, height:2,
                background: l.dash ? 'transparent' : l.color,
                borderTop: l.dash ? `2px dashed ${l.color}` : 'none',
                borderRadius:2,
              }} />
              {l.label}
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:C.textMid }}>
            <div style={{ width:12, height:12, borderRadius:2, background:'rgba(16,185,129,0.3)' }} />
            저평가 구간
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 20px' }}>

        {/* ── 컨트롤러 바 ────────────────────────────────── */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>

          {/* 종목 선택 드롭다운 — 포트폴리오 배열 동적 매핑 */}
          <div style={{ position:'relative' }}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 14px', borderRadius:9,
                background:C.card, border:`1px solid ${C.border}`,
                color:C.textHi, cursor:'pointer', fontSize:13, fontWeight:700,
                minWidth:200,
              }}
            >
              <span style={{
                fontSize:10, padding:'2px 6px', borderRadius:4,
                background:'rgba(96,165,250,0.15)', color:C.price,
                fontFamily:'monospace', fontWeight:900, flexShrink:0,
              }}>
                {selectedStock?.ticker ?? '—'}
              </span>
              {selectedStock?.name ?? '종목 선택'}
              <ChevronDown size={14} color={C.textLow} style={{ marginLeft:'auto' }} />
            </button>

            {dropdownOpen && (
              <div style={{
                position:'absolute', top:'110%', left:0, zIndex:100,
                background:C.card, border:`1px solid ${C.border}`,
                borderRadius:10, overflow:'auto', maxHeight:280, minWidth:230,
                boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
              }}>
                {portfolio.map((inv, idx) => (
                  <button
                    key={`${inv.ticker}-${idx}`}
                    onClick={() => { setSelectedIdx(idx); setDropdownOpen(false) }}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      width:'100%', padding:'10px 14px', textAlign:'left',
                      background: idx === selectedIdx ? C.cardHi : 'transparent',
                      border:'none', cursor:'pointer', color:C.textHi, fontSize:12,
                    }}
                  >
                    <span style={{
                      fontSize:9, padding:'2px 6px', borderRadius:3,
                      background:'rgba(96,165,250,0.15)', color:C.price,
                      fontFamily:'monospace', fontWeight:900, flexShrink:0,
                    }}>
                      {inv.ticker}
                    </span>
                    <div>
                      <div style={{ fontWeight:700 }}>{inv.name}</div>
                      <div style={{ fontSize:9, color:C.textLow }}>{inv.market} · {inv.currency ?? 'USD'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 조회 기간 */}
          <div style={{ display:'flex', borderRadius:9, overflow:'hidden', border:`1px solid ${C.border}` }}>
            {(['3Y','5Y'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                  background: period === p ? C.fair : C.card,
                  color:      period === p ? '#000' : C.textMid,
                  display:'flex', alignItems:'center', gap:5,
                }}
              >
                <Clock size={12} />{p}
              </button>
            ))}
          </div>

          {/* 적정 PER 모델 */}
          <div style={{ display:'flex', borderRadius:9, overflow:'hidden', border:`1px solid ${C.border}` }}>
            {(Object.keys(MODEL_LABELS) as PerModel[]).map(m => {
              const icons = { growth:<Zap size={11}/>, avg5y:<BarChart2 size={11}/>, fixed15:<Target size={11}/> }
              const active = perModel === m
              return (
                <button key={m} onClick={() => setPerModel(m)}
                  style={{
                    padding:'8px 12px', fontSize:11, fontWeight:700, cursor:'pointer', border:'none',
                    background: active ? 'rgba(245,158,11,0.15)' : C.card,
                    color:      active ? C.fair : C.textMid,
                    display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
                  }}
                >
                  {icons[m]} {MODEL_LABELS[m]}
                </button>
              )
            })}
          </div>

          {/* 새로고침 버튼 */}
          {selectedStock && (
            <button
              onClick={() => fetchData(selectedStock)}
              disabled={loading}
              style={{
                marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
                padding:'8px 12px', borderRadius:9, border:`1px solid ${C.border}`,
                background:C.card, color:C.textMid, cursor:'pointer', fontSize:11,
              }}
            >
              <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? '로딩 중…' : '새로고침'}
            </button>
          )}

          {/* 적용 PER 표시 */}
          <div style={{
            padding:'6px 12px', borderRadius:8,
            background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <Info size={12} color={C.fair} />
            <span style={{ fontSize:11, color:C.textMid }}>적정 PER:</span>
            <span style={{ fontSize:13, fontWeight:900, color:C.fair, fontFamily:'monospace' }}>{fairPer}×</span>
          </div>
        </div>

        {/* ── 에러 상태 ──────────────────────────────────── */}
        {error && (
          <div style={{
            padding:'12px 16px', borderRadius:10, marginBottom:14,
            background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)',
            fontSize:12, color:C.over,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── EPS 없는 종목 안내 ─────────────────────────── */}
        {!loading && noEpsReason && <NoEpsState name={selectedStock?.name ?? ''} reason={noEpsReason} />}

        {/* ── 로딩 스피너 ────────────────────────────────── */}
        {loading && (
          <div style={{
            minHeight:320, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:12, color:C.textLow,
          }}>
            <RefreshCw size={28} style={{ animation:'spin 1s linear infinite' }} />
            <div style={{ fontSize:13 }}>{selectedStock?.name} 데이터 수집 중…</div>
            <div style={{ fontSize:11 }}>주가 · 재무 · 성장률 데이터를 동시에 가져오고 있습니다.</div>
          </div>
        )}

        {/* ── 차트 영역 ─────────────────────────────────── */}
        {!loading && !noEpsReason && chartData.length > 0 && (
          <>
            <div style={{
              background:C.card, borderRadius:14, border:`1px solid ${C.border}`,
              padding:'16px 8px 8px 4px',
            }}>
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart data={chartData} margin={{ top:10, right:20, bottom:4, left:10 }}>
                  <defs>
                    <linearGradient id="lc-underGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="lc-overGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f87171" stopOpacity={0.20} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0.03} />
                    </linearGradient>
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                  </defs>

                  <CartesianGrid stroke={C.card} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year"
                    tick={{ fill:C.textLow, fontSize:11 }} axisLine={{ stroke:C.border }} tickLine={false}
                  />
                  <YAxis domain={[yMin, yMax]}
                    tick={{ fill:C.textLow, fontSize:10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v.toLocaleString()}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />

                  {/* 현재 연도 기준선 */}
                  <ReferenceLine
                    x={new Date().getFullYear().toString()}
                    stroke={C.textLow} strokeDasharray="4 2" strokeWidth={1}
                  />

                  {/* 저평가 음영 */}
                  <Area type="monotone" dataKey="underHigh"
                    stroke="none" fill="url(#lc-underGrad)" fillOpacity={1}
                    connectNulls={false} isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="underLow"
                    stroke="none" fill={C.bg} fillOpacity={1}
                    connectNulls={false} isAnimationActive={false} legendType="none" />

                  {/* 고평가 음영 */}
                  <Area type="monotone" dataKey="overHigh"
                    stroke="none" fill="url(#lc-overGrad)" fillOpacity={1}
                    connectNulls={false} isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="overLow"
                    stroke="none" fill={C.bg} fillOpacity={1}
                    connectNulls={false} isAnimationActive={false} legendType="none" />

                  {/* 피터 린치 이익선 (황금 점선) */}
                  <Line type="monotone" dataKey="fairValue"
                    stroke={C.fair} strokeWidth={2.5} strokeDasharray="6 3"
                    dot={false} activeDot={{ r:5, fill:C.fair, stroke:C.surface, strokeWidth:2 }}
                    connectNulls name="린치 적정가치"
                  />
                  {/* 실제 주가 (블루) */}
                  <Line type="monotone" dataKey="price"
                    stroke={C.price} strokeWidth={2.5}
                    dot={{ r:3, fill:C.price, stroke:C.surface, strokeWidth:1 }}
                    activeDot={{ r:5, fill:C.price, stroke:C.surface, strokeWidth:2 }}
                    connectNulls name="실제 주가"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ── KPI 카드 4개 ───────────────────────────── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:14 }}>
              {[
                { label:'현재 주가',     value: latestPrice > 0 ? latestPrice.toLocaleString(undefined,{maximumFractionDigits:2}) : '—', color:C.price },
                { label:'린치 적정가치', value: latestFair  > 0 ? latestFair.toLocaleString( undefined,{maximumFractionDigits:2}) : '—', color:C.fair },
                { label:'최근 EPS',      value: latest?.ttmEps ? latest.ttmEps.toLocaleString(undefined,{maximumFractionDigits:2}) : '—', color:C.textHi },
                { label:'적용 PER',      value:`${fairPer}×`, color:C.textHi },
              ].map(item => (
                <div key={item.label} style={{
                  padding:'12px 14px', borderRadius:10, textAlign:'center',
                  background:C.card, border:`1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize:10, color:C.textLow, marginBottom:4 }}>{item.label}</div>
                  <div style={{ fontSize:17, fontWeight:900, color:item.color, fontFamily:'monospace' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* ── 괴리율 진단 패널 ───────────────────────── */}
            {gap !== null && latestPrice > 0 && latestFair > 0 && (
              <ValuationPanel
                price={latestPrice} fair={latestFair}
                ticker={selectedStock?.ticker ?? ''}
                model={perModel} growthRate={growthRate}
              />
            )}

            {/* ── 린치 원칙 요약 ─────────────────────────── */}
            <div style={{
              marginTop:14, padding:'12px 16px', borderRadius:10,
              background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.15)',
              display:'flex', gap:8, alignItems:'flex-start',
            }}>
              <Info size={14} color={C.fair} style={{ flexShrink:0, marginTop:1 }} />
              <div style={{ fontSize:11, color:C.textLow, lineHeight:1.7 }}>
                <strong style={{ color:C.fair }}>피터 린치 이익선 원칙:</strong>{' '}
                장기적으로 주가는 이익선(EPS × 적정 PER)을 따라간다. 주가가 이익선 아래에 있으면
                저평가 매수 기회, 위에 있으면 프리미엄 경계 구간이다.
                현재 적용 성장률 G≈{growthRate}%,
                5년 평균 PER≈{avg5yPer}× 기준으로 계산됩니다.
              </div>
            </div>
          </>
        )}

        {/* ── 데이터 없을 때 (API 성공했지만 차트 데이터 0개) ── */}
        {!loading && !noEpsReason && !error && chartData.length === 0 && rawPoints.length === 0 && selectedStock && (
          <NoEpsState
            name={selectedStock.name}
            reason="재무 데이터를 분석 중이거나, 해당 종목의 연간 EPS 이력이 없어 이익선을 계산할 수 없습니다. 잠시 후 새로고침 버튼을 눌러주세요."
          />
        )}

      </div>
    </div>
  )
}
