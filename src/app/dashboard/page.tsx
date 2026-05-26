'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart,
  Treemap, Bar, Cell as BarCell, ReferenceLine, ReferenceDot, LabelList,
  ComposedChart
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import AIPortfolioDashboard from '@/app/components/AIPortfolioDashboard'

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
type AssetRole = 'CORE' | 'SATELLITE'
interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number
  purchase_date: string; lynch_category: LynchKey|null
  asset_role?: AssetRole  // 코어/새틀라이트 포지션 (없으면 폴백 로직 사용)
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
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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
// ─── AI 멘토 탭: 종목 마스터 데이터 (PEG 기반 동적 분석용) ──────────────────
const MENTOR_STOCKS = [
  { name: '현대차',        ticker:'005380', lynchType:'경기순환주',  peg:0.81, growthRate:8.0  },
  { name: '팔란티어',      ticker:'PLTR',   lynchType:'고성장주',    peg:0.90, growthRate:50.0 },
  { name: '제너럴 일렉트릭',ticker:'GE',    lynchType:'턴어라운드주', peg:0.91, growthRate:22.0 },
  { name: '엔비디아',      ticker:'NVDA',   lynchType:'고성장주',    peg:0.93, growthRate:35.0 },
  { name: '삼성전자',      ticker:'005930', lynchType:'대형우량주',  peg:1.21, growthRate:12.0 },
  { name: '코카콜라',      ticker:'KO',     lynchType:'저성장주',    peg:4.40, growthRate:5.0  },
]
const LYNCH_TYPES = ['고성장주','대형우량주','저성장주','경기순환주','자산주','턴어라운드주'] as const

// ─── 백테스팅 데이터 (2021.Q1~2026.Q1, 초기 투자금 1,000만 원) ───────────────
const BACKTEST_DATA = [
  { date:'21.Q1', rebalanceQ:1000, rebalanceY:1000, buyAndHold:1000, benchmark:1000 },
  { date:'21.Q2', rebalanceQ:1080, rebalanceY:1080, buyAndHold:1100, benchmark:1050 },
  { date:'21.Q3', rebalanceQ:1120, rebalanceY:1110, buyAndHold:1150, benchmark:1070 },
  { date:'21.Q4', rebalanceQ:1180, rebalanceY:1170, buyAndHold:1240, benchmark:1120 },
  { date:'22.Q1', rebalanceQ:1100, rebalanceY:1080, buyAndHold:1050, benchmark:1040 },
  { date:'22.Q2', rebalanceQ:1020, rebalanceY:980,  buyAndHold:880,  benchmark:920  },
  { date:'22.Q3', rebalanceQ:980,  rebalanceY:930,  buyAndHold:810,  benchmark:860  },
  { date:'22.Q4', rebalanceQ:1040, rebalanceY:990,  buyAndHold:890,  benchmark:910  },
  { date:'23.Q1', rebalanceQ:1110, rebalanceY:1060, buyAndHold:980,  benchmark:970  },
  { date:'23.Q2', rebalanceQ:1190, rebalanceY:1140, buyAndHold:1080, benchmark:1030 },
  { date:'23.Q3', rebalanceQ:1220, rebalanceY:1160, buyAndHold:1120, benchmark:1050 },
  { date:'23.Q4', rebalanceQ:1310, rebalanceY:1240, buyAndHold:1250, benchmark:1140 },
  { date:'24.Q1', rebalanceQ:1420, rebalanceY:1350, buyAndHold:1380, benchmark:1220 },
  { date:'24.Q2', rebalanceQ:1490, rebalanceY:1410, buyAndHold:1450, benchmark:1260 },
  { date:'24.Q3', rebalanceQ:1530, rebalanceY:1440, buyAndHold:1480, benchmark:1280 },
  { date:'24.Q4', rebalanceQ:1620, rebalanceY:1530, buyAndHold:1590, benchmark:1350 },
  { date:'25.Q1', rebalanceQ:1710, rebalanceY:1610, buyAndHold:1680, benchmark:1410 },
  { date:'25.Q2', rebalanceQ:1780, rebalanceY:1670, buyAndHold:1740, benchmark:1450 },
  { date:'25.Q3', rebalanceQ:1820, rebalanceY:1710, buyAndHold:1760, benchmark:1470 },
  { date:'25.Q4', rebalanceQ:1940, rebalanceY:1820, buyAndHold:1890, benchmark:1540 },
  { date:'26.Q1', rebalanceQ:2080, rebalanceY:1940, buyAndHold:1980, benchmark:1620 },
]
const BACKTEST_SUMMARY = [
  { key:'rebalanceQ' as const, name:'분기별 리밸런싱', final:'2,080만', ret:'+108.0%', mdd:'-16.9%', color:'#10b981' },
  { key:'rebalanceY' as const, name:'연간 리밸런싱',   final:'1,940만', ret:'+94.0%',  mdd:'-20.5%', color:'#818cf8' },
  { key:'buyAndHold' as const, name:'단순 보유 (방치)',final:'1,980만', ret:'+98.0%',  mdd:'-34.6%', color:'#f87171' },
  { key:'benchmark'  as const, name:'시장 평균 지수',  final:'1,620만', ret:'+62.0%',  mdd:'-18.1%', color:'#64748b' },
]
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', padding:'14px 18px 0', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>
    {children}
  </div>
)

// ─── RebalanceWidget ─────────────────────────────────────────────────────────
// 대시보드 중간에 삽입되는 아코디언형 리밸런싱 알림 + 시뮬레이터
// props: corePct(현재 코어 비중%), totalValKrw(총 평가금액), targetCore(목표 코어 비중%)
interface RebalanceWidgetProps {
  corePct:      number          // 현재 코어 비중 (0~100)
  totalValKrw:  number          // 총 평가금액 (원화)
  targetCore:   number          // 목표 코어 비중 (기본값 70)
}

function RebalanceWidget({ corePct, totalValKrw, targetCore }: RebalanceWidgetProps) {
  const [isOpen,       setIsOpen]       = useState(false)
  const [simulated,    setSimulated]    = useState(false)  // 가상 리밸런싱 실행 여부
  const [animating,    setAnimating]    = useState(false)

  const satPct    = 100 - corePct
  const targetSat = 100 - targetCore
  const gap       = corePct - targetCore            // 양수 = Core 과잉, 음수 = Satellite 과잉
  const absGap    = Math.abs(gap)
  const THRESHOLD = 5                               // 편차 5% 이상 시 알림

  // 리밸런싱 필요 없으면 숨김
  if (absGap < THRESHOLD || totalValKrw === 0) return null

  // 조정 필요 금액 계산
  // 예) Core 과잉: Satellite 매수 or Core 일부 매도
  const adjustKrw = Math.round((absGap / 100) * totalValKrw)
  const coreIsOver = gap > 0  // true = Core 과잉(Sat 소외), false = Sat 과잉(Core 소외)

  // 가상 리밸런싱 실행
  const handleSimulate = () => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setSimulated(true)
      setAnimating(false)
    }, 800)
  }
  const handleReset = () => { setSimulated(false); setAnimating(false) }

  // 시뮬레이션 적용 시 표시할 비중
  const displayCore = simulated ? targetCore : corePct
  const displaySat  = simulated ? targetSat  : satPct

  // 바 색상
  const CORE_CLR = '#38bdf8'
  const SAT_CLR  = '#fb923c'
  const WARN_CLR = '#f97316'

  return (
    <div style={{ marginBottom: 0 }}>
      {/* ── 알림 배너 ────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            12,
        padding:        '12px 18px',
        borderRadius:   isOpen ? '12px 12px 0 0' : 12,
        background:     'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(234,88,12,0.08))',
        border:         `1px solid rgba(249,115,22,0.35)`,
        borderBottom:   isOpen ? 'none' : `1px solid rgba(249,115,22,0.35)`,
        cursor:         'default',
        transition:     'border-radius 0.25s',
      }}>
        {/* 아이콘 + 텍스트 */}
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: WARN_CLR, marginBottom: 2 }}>
            리밸런싱 필요 — {coreIsOver ? 'Core 과잉' : 'Satellite 과잉'} ({absGap.toFixed(1)}%p 편차)
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
            목표 {targetCore}/{targetSat} vs 현재 {Math.round(corePct)}/{Math.round(satPct)} —&nbsp;
            {coreIsOver
              ? `Satellite 자산이 ${absGap.toFixed(1)}%p 소외됨`
              : `Core 자산이 ${absGap.toFixed(1)}%p 소외됨`}
            &nbsp;· 약 {fmtKrw(adjustKrw)} 이동 필요
          </div>
        </div>
        {/* 확장 버튼 */}
        <button
          onClick={() => { setIsOpen(v => !v); if (!isOpen) setSimulated(false) }}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            5,
            padding:        '7px 14px',
            borderRadius:   8,
            border:         `1px solid rgba(249,115,22,0.4)`,
            background:     isOpen ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.1)',
            color:          WARN_CLR,
            fontSize:       12,
            fontWeight:     700,
            cursor:         'pointer',
            whiteSpace:     'nowrap' as const,
            transition:     'background 0.2s',
            flexShrink:     0,
          }}
        >
          시뮬레이션 {isOpen ? '닫기 🔼' : '열기 🔽'}
        </button>
      </div>

      {/* ── 아코디언 확장 영역 ────────────────────────────────────── */}
      <div style={{
        overflow:   'hidden',
        maxHeight:  isOpen ? 420 : 0,
        opacity:    isOpen ? 1 : 0,
        transition: 'max-height 0.35s ease, opacity 0.25s ease',
      }}>
        <div style={{
          display:      'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:          16,
          padding:      '16px 18px 18px',
          background:   '#121520',
          border:       '1px solid rgba(249,115,22,0.25)',
          borderTop:    'none',
          borderRadius: '0 0 12px 12px',
        }}>

          {/* ── 좌측: 비중 비교 바 그래프 ────────────────────────── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 14 }}>
              비중 비교
            </div>

            {/* 목표 비중 바 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>목표 비중</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Core {targetCore}% / Sat {targetSat}%
                </span>
              </div>
              <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: '#1e2330' }}>
                <div style={{
                  width:      `${targetCore}%`,
                  background: `${CORE_CLR}90`,
                  display:    'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize:   10, fontWeight: 800, color: CORE_CLR,
                  transition: 'width 0.6s ease',
                }}>
                  {targetCore >= 20 ? `${targetCore}%` : ''}
                </div>
                <div style={{
                  flex:       1,
                  background: `${SAT_CLR}90`,
                  display:    'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize:   10, fontWeight: 800, color: SAT_CLR,
                }}>
                  {targetSat >= 20 ? `${targetSat}%` : ''}
                </div>
              </div>
            </div>

            {/* 현재 비중 바 (시뮬레이션 시 애니메이션) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  현재 비중 {simulated && <span style={{ color: '#4ade80', marginLeft: 4 }}>→ 조정 완료 ✓</span>}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Core {Math.round(displayCore)}% / Sat {Math.round(displaySat)}%
                </span>
              </div>
              <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: '#1e2330' }}>
                <div style={{
                  width:      `${displayCore}%`,
                  background: simulated ? `${CORE_CLR}90` : `${CORE_CLR}cc`,
                  display:    'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize:   10, fontWeight: 800, color: CORE_CLR,
                  transition: animating ? 'width 0.8s cubic-bezier(0.4,0,0.2,1)' : 'width 0.6s ease',
                }}>
                  {displayCore >= 20 ? `${Math.round(displayCore)}%` : ''}
                </div>
                <div style={{
                  flex:       1,
                  background: simulated ? `${SAT_CLR}90` : `${SAT_CLR}cc`,
                  display:    'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize:   10, fontWeight: 800, color: SAT_CLR,
                  transition: animating ? 'width 0.8s cubic-bezier(0.4,0,0.2,1)' : 'width 0.6s ease',
                }}>
                  {displaySat >= 20 ? `${Math.round(displaySat)}%` : ''}
                </div>
              </div>
            </div>

            {/* 편차 강조 */}
            {!simulated && (
              <div style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                padding:    '8px 12px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border:     '1px solid rgba(239,68,68,0.2)',
              }}>
                <span style={{ fontSize: 18 }}>{coreIsOver ? '📊' : '📉'}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171' }}>
                    {coreIsOver ? `Core +${absGap.toFixed(1)}%p 쏠림` : `Satellite +${absGap.toFixed(1)}%p 쏠림`}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                    목표 대비 {absGap.toFixed(1)}%p 이탈
                  </div>
                </div>
              </div>
            )}
            {simulated && (
              <div style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                padding:    '8px 12px',
                borderRadius: 8,
                background: 'rgba(74,222,128,0.08)',
                border:     '1px solid rgba(74,222,128,0.2)',
              }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
                  목표 비중 달성 시뮬레이션 완료
                </div>
              </div>
            )}
          </div>

          {/* ── 우측: 매매 처방전 ─────────────────────────────────── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 14 }}>
              매매 처방전
            </div>

            <div style={{
              padding:      '14px 16px',
              borderRadius: 10,
              background:   'rgba(249,115,22,0.07)',
              border:       '1px solid rgba(249,115,22,0.2)',
              marginBottom: 12,
            }}>
              {/* 처방 제목 */}
              <div style={{ fontSize: 12, fontWeight: 800, color: WARN_CLR, marginBottom: 8 }}>
                {coreIsOver
                  ? '📌 소외된 Satellite 자산 보강 권장'
                  : '📌 과잉 Satellite 일부 수익 확정 권장'}
              </div>
              {/* 처방 내용 */}
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
                {coreIsOver ? (
                  <>
                    비대해진 <span style={{ color: CORE_CLR, fontWeight: 700 }}>Core(채권·ETF)</span> 자산을 일부 매도(수익 확정)하고,
                    소외된 <span style={{ color: SAT_CLR, fontWeight: 700 }}>Satellite(성장주)</span> 자산을 추가 매수하세요.
                  </>
                ) : (
                  <>
                    비대해진 <span style={{ color: SAT_CLR, fontWeight: 700 }}>Satellite(성장주)</span> 자산을 일부 매도(수익 확정)하고,
                    소외된 <span style={{ color: CORE_CLR, fontWeight: 700 }}>Core(채권·ETF)</span> 자산을 추가 매수하세요.
                  </>
                )}
              </div>
            </div>

            {/* 조정 금액 */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'space-between',
              padding:      '10px 14px',
              borderRadius: 8,
              background:   '#1e2330',
              border:       '1px solid #2a2d3a',
              marginBottom: 14,
            }}>
              <div>
                <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 3 }}>
                  가상 이동 필요 금액
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtKrw(adjustKrw)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#374151', lineHeight: 1.6 }}>
                <div>{coreIsOver ? 'Core → Satellite' : 'Satellite → Core'}</div>
                <div>전체 자산의 {absGap.toFixed(1)}%</div>
              </div>
            </div>

            {/* 리밸런싱 실행 / 초기화 버튼 */}
            {!simulated ? (
              <button
                onClick={handleSimulate}
                disabled={animating}
                style={{
                  width:        '100%',
                  padding:      '11px',
                  borderRadius: 8,
                  border:       'none',
                  cursor:       animating ? 'default' : 'pointer',
                  background:   animating
                    ? 'rgba(249,115,22,0.2)'
                    : 'linear-gradient(135deg,#ea580c,#c2410c)',
                  boxShadow:    animating ? 'none' : '0 4px 12px rgba(234,88,12,0.3)',
                  color:        animating ? WARN_CLR : '#fff',
                  fontSize:     13,
                  fontWeight:   800,
                  letterSpacing: '0.03em',
                  transition:   'all 0.2s',
                }}
              >
                {animating ? '리밸런싱 시뮬레이션 중…' : '⚖️ 가상 리밸런싱 실행'}
              </button>
            ) : (
              <button
                onClick={handleReset}
                style={{
                  width:        '100%',
                  padding:      '11px',
                  borderRadius: 8,
                  border:       '1px solid rgba(74,222,128,0.3)',
                  cursor:       'pointer',
                  background:   'rgba(74,222,128,0.08)',
                  color:        '#4ade80',
                  fontSize:     13,
                  fontWeight:   700,
                  transition:   'all 0.2s',
                }}
              >
                🔄 초기 상태로 되돌리기
              </button>
            )}
            <div style={{ fontSize: 10, color: '#374151', textAlign: 'center', marginTop: 6 }}>
              * 가상 시뮬레이션 — 실제 매매와 무관합니다
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  // 배당 데이터 (stock-info API — SEIBro/Yahoo 포함, 1시간 캐시)
  const [targetCore, setTargetCore] = useState(70)   // 목표 코어 비중 (기본 70%)
  const [dividendMap, setDividendMap] = useState<Record<string, {
    annualDividend: number | null
    dividendYield:  number | null
  }>>({})
  const [dividendLoading, setDividendLoading] = useState(false)
  const [showDivDetail,   setShowDivDetail]   = useState(false)  // 배당 상세 팝업
  const [btActive,  setBtActive]  = useState({ rebalanceQ:true, rebalanceY:false, buyAndHold:true, benchmark:true })
  const [dashTab,   setDashTab]   = useState<'live' | 'backtest' | 'mentor'>('live')

  // ── AI 멘토 탭: 동적 인사이트 계산 ────────────────────────────────
  const mentorInsights = useMemo(() => {
    const sorted = [...MENTOR_STOCKS].sort((a, b) => a.peg - b.peg)
    const best   = sorted[0]                          // PEG 최저 → 매수 우위
    const worst  = sorted[sorted.length - 1]          // PEG 최고 → 경계

    // 레이더 차트: 6대 분류별 보유 종목 수 → 0~100 스케일
    const maxCount = Math.max(1, Math.max(...LYNCH_TYPES.map(t => MENTOR_STOCKS.filter(s => s.lynchType === t).length)))
    const radarData = LYNCH_TYPES.map(t => ({
      subject: t.replace('주','').replace('성장','성장\n'),
      A: Math.round((MENTOR_STOCKS.filter(s => s.lynchType === t).length / maxCount) * 100),
      fullMark: 100,
    }))

    return { best, worst, radarData }
  }, [])

  // ── 버튼 조합별 동적 인사이트 패널 ─────────────────────────────
  const renderBtInsight = () => {
    const { rebalanceQ, rebalanceY, buyAndHold } = btActive
    const none = !rebalanceQ && !rebalanceY && !buyAndHold

    // 아무것도 선택 안 했을 때
    if (none) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(100,116,139,0.08)', border:'1px solid rgba(100,116,139,0.2)' }}>
        <span style={{ fontSize:16 }}>💡</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#cbd5e1' }}>비교 분석 가이드:</b>{' '}
          상단 전략 버튼을 2개 이상 켜서 대조해 보세요. 리밸런싱 유무와 주기에 따라 하락장 방어력과 최종 자산 규모가 어떻게 달라지는지 실시간으로 확인할 수 있습니다.
        </div>
      </div>
    )

    // Case 1: 3개 모두 (종합 비교)
    if (rebalanceQ && rebalanceY && buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(99,102,241,0.09)', border:'1px solid rgba(99,102,241,0.25)' }}>
        <span style={{ fontSize:16 }}>🔍</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#818cf8' }}>전체 전략 종합 비교 레포트:</b><br />
          분기 리밸런싱(+108%) &gt; 단순 보유(+98%) &gt; 연간 리밸런싱(+94%) 순으로 성과가 갈립니다.
          특히 2022년 하락장 당시 분기 리밸런싱의 MDD는{' '}
          <b style={{ color:'#10b981' }}>-16.9%</b>로 방치형(<b style={{ color:'#f87171' }}>-34.6%</b>)의 절반 수준에 불과했습니다.
          리스크를 절반으로 낮추면서도 최종 수익은 더 높이는 것이 가능함을 5년 데이터가 증명합니다.
        </div>
      </div>
    )

    // Case 2: 분기 + 단순 보유 (핵심 교육 뷰)
    if (rebalanceQ && !rebalanceY && buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.25)' }}>
        <span style={{ fontSize:16 }}>⚠️</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#fbbf24' }}>리밸런싱 vs 단순 방치 결정적 차이:</b><br />
          2022년 하락장 저점(빨간 점)을 복기해 보세요. 방치한 계좌는 고점 대비{' '}
          <b style={{ color:'#f87171' }}>-34.6%</b> 폭락하며 심리적 한계에 부딪힙니다.
          반면 분기별 리밸런싱(초록선)은 하락폭을 <b style={{ color:'#10b981' }}>-16.9%</b>로 철저히 방어하고,
          이때 싼 가격에 자동 매집된 주식들 덕분에 상승장이 오자마자 훨씬 빠르게 복리 성장했습니다.
        </div>
      </div>
    )

    // Case 3: 분기 + 연간 (주기 비교)
    if (rebalanceQ && rebalanceY && !buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)' }}>
        <span style={{ fontSize:16 }}>🔄</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#34d399' }}>리밸런싱 주기(빈도)의 비밀:</b><br />
          연간 1회(보라선)보다 분기별 1회(초록선)로 더 자주 조정하면 2022년 같은 급변 장세에서 훨씬 유리합니다.
          분기 조율은 시장이 일시적으로 과도하게 눌리는 구간을 기민하게 포착하여,
          연간 리밸런싱 대비 최종 성과를 약{' '}
          <b style={{ color:'#34d399' }}>14%p 이상</b> 앞서 나가게 만듭니다.
        </div>
      </div>
    )

    // Case 4: 연간 + 단순 보유
    if (!rebalanceQ && rebalanceY && buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.25)' }}>
        <span style={{ fontSize:16 }}>📊</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#c084fc' }}>연간 관리와 무관심의 차이:</b><br />
          일 년에 딱 한 번만 리밸런싱해도(보라선) 방치(빨간선)보다 변동성(MDD: -20.5% vs -34.6%)을 크게 낮출 수 있습니다.
          다만 1년이라는 긴 주기 때문에 하락장 한가운데서 발생하는 저가 매수 기회를 놓쳐 최종 수익률은 다소 아쉽게 마감됩니다.
        </div>
      </div>
    )

    // Case 5: 분기 리밸런싱 단독
    if (rebalanceQ && !rebalanceY && !buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.25)' }}>
        <span style={{ fontSize:16 }}>🟢</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#10b981' }}>분기별 리밸런싱 전략:</b><br />
          3개월마다 자산 비중을 원래 목표대로 맞춰주는 전략입니다.
          오를 때 일부 이익 실현, 떨어질 때 기계적으로 분할 매수하는 효과가 자동 발생하여
          장기 우상향 포트폴리오의 복리 에너지를 극대화하는 최고의 처방전입니다.
        </div>
      </div>
    )

    // Case 6: 단순 보유 단독
    if (!rebalanceQ && !rebalanceY && buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)' }}>
        <span style={{ fontSize:16 }}>🔴</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#f87171' }}>단순 보유(Buy & Hold) 무방비 상태:</b><br />
          좋은 종목이라도 관리를 전혀 하지 않으면 변동성 폭탄을 정면으로 맞습니다.
          2022년 구간처럼 자산이 <b style={{ color:'#f87171' }}>-34.6%</b>까지 주저앉는 고통을 겪게 되어,
          투자학교 학생들에게 자산 배분과 주기적 리밸런싱이 왜 생명줄인지 경고합니다.
        </div>
      </div>
    )

    // Case 7: 연간 리밸런싱 단독
    if (!rebalanceQ && rebalanceY && !buyAndHold) return (
      <div style={{ marginTop:12, display:'flex', gap:8, padding:'11px 14px', borderRadius:9, background:'rgba(168,85,247,0.07)', border:'1px solid rgba(168,85,247,0.25)' }}>
        <span style={{ fontSize:16 }}>📅</span>
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#c084fc' }}>연간 리밸런싱 전략:</b><br />
          1년에 한 번 리밸런싱하는 전략은 관리 부담이 적어 바쁜 직장인에게 적합합니다.
          단순 방치보다는 분명히 낫지만, 분기별 조정에 비해 급변 장세 대응이 늦어 기회 비용이 발생합니다.
          입문 단계 전략으로는 충분하며, 익숙해지면 분기별로 업그레이드를 권장합니다.
        </div>
      </div>
    )

    // 기타 (benchmark만 등)
    return null
  }

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
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category,asset_role')
        .eq('user_id', uid)
      const invs = data ?? []
      setInvestments(invs)

      // ── 미분류 종목 자동 분류 (백그라운드) ────────────────────────
      // ETF·CRYPTO 제외하고 lynch_category가 null인 종목만
      const ETF_BRANDS_CHECK = ['TIGER','KODEX','ACE','PLUS','KBSTAR','HANARO','ARIRANG','SOL','RISE','1Q','ETF']
      const unclassified = invs.filter(i =>
        !i.lynch_category &&
        i.market !== 'CRYPTO' &&
        !ETF_BRANDS_CHECK.some(b => i.name.toUpperCase().includes(b))
      )
      if (unclassified.length > 0) {
        // 비동기로 분류 (UI 블로킹 없이)
        ;(async () => {
          for (const inv of unclassified) {
            try {
              const res = await fetch(
                `/api/lynch-classify?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`,
                { cache: 'no-store' }
              )
              if (!res.ok) continue
              const { category, isEtf } = await res.json()
              if (isEtf || !category || category === 'na') continue
              // 본인 투자 항목이므로 RLS 통과
              await sb.from('investments')
                .update({ lynch_category: category })
                .eq('id', inv.id)
                .eq('user_id', uid)
            } catch { /* 무시 */ }
            await new Promise(r => setTimeout(r, 100))
          }
          // 분류 완료 후 investments 상태 업데이트 (화면 반영)
          const { data: refreshed } = await sb
            .from('investments')
            .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category,asset_role')
            .eq('user_id', uid)
          if (refreshed) setInvestments(refreshed)
        })()
      }

      if (invs.length > 0) {
        // 최대 30개씩 배치로 나눠서 요청 (25개 이상 보유 학생 대응)
        const BATCH_SIZE = 30
        const tickers = invs.map(i => ({ ticker: i.ticker, market: i.market }))
        const batches: typeof tickers[] = []
        for (let i = 0; i < tickers.length; i += BATCH_SIZE)
          batches.push(tickers.slice(i, i + BATCH_SIZE))

        const allResults: ({ticker:string}&LivePrice)[] = []
        for (const batch of batches) {
          const res = await fetch('/api/stock-price', {
            method: 'POST', headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify(batch),
          })
          if (res.ok) {
            const partial: ({ticker:string}&LivePrice)[] = await res.json()
            allResults.push(...partial)
          }
        }

        if (allResults.length > 0) {
          const m: Record<string,LivePrice> = {}
          allResults.forEach(r => {
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

  // ★ 자산관리 탭에서 매수/매도/편집 발생 시 즉시 리렌더링
  useEffect(() => {
    const handler = () => {
      console.log('[Dashboard] portfolio-updated 이벤트 수신 → 데이터 갱신')
      fetchAll()
    }
    window.addEventListener('portfolio-updated', handler)
    return () => window.removeEventListener('portfolio-updated', handler)
  }, [fetchAll])

  // ★ 브라우저 탭/창 전환 후 돌아올 때 자동 갱신 (캐시 데이터 방지)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Dashboard] 탭 전환 복귀 → 데이터 자동 갱신')
        fetchAll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchAll])

  // ── strategy_configs에서 목표 Core 비중 로드 ─────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data } = await sb
          .from('strategy_configs')
          .select('core_pct')
          .limit(1)
          .single()
        if (data?.core_pct != null && data.core_pct > 0) setTargetCore(data.core_pct)
      } catch { /* 무시: 기본값 70% 유지 */ }
    }
    load()
  }, [])

  // ── 배당 데이터 (stock-info) — investments 로드 후 백그라운드 조회 ──
  // stock-price는 배당 데이터가 부정확(KR ETF 특히) → stock-info로 별도 보완
  useEffect(() => {
    if (investments.length === 0) return
    const BATCH = 4   // 동시 요청 수 (SEIBro 세션 부하 방지)
    const DELAY = 400 // ms

    let cancelled = false
    const run = async () => {
      setDividendLoading(true)
      const result: typeof dividendMap = {}

      for (let i = 0; i < investments.length; i += BATCH) {
        if (cancelled) break
        const slice = investments.slice(i, i + BATCH)
        await Promise.all(slice.map(async inv => {
          try {
            const res = await fetch(
              `/api/stock-info?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`,
            )
            if (!res.ok) return
            const d = await res.json()
            const f = d?.fundamentals
            result[inv.ticker.toUpperCase()] = {
              annualDividend: f?.annualDividend ?? null,
              dividendYield:  f?.dividendYield  ?? null,
            }
          } catch { /* 무시 */ }
        }))
        if (i + BATCH < investments.length) {
          await new Promise(r => setTimeout(r, DELAY))
        }
      }

      if (!cancelled) setDividendMap(result)
      setDividendLoading(false)
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments])

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

  // ── 트렌드 차트 토글 & 파생 데이터 ────────────────────────────────────────
  const [trendMode, setTrendMode] = useState<'amount' | 'pct'>('amount')

  // 수익률(%) 기준 데이터: 첫날 기준 누적 변화율
  const trendDataPct = useMemo(() => {
    if (trendData.length < 2) return []
    const base = trendData[0].value
    if (!base) return []
    return trendData.map(d => ({
      ...d,
      pct: parseFloat(((d.value - base) / base * 100).toFixed(3)),
    }))
  }, [trendData])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeData   = (trendMode === 'amount' ? trendData : trendDataPct) as any[]
  const activeKey    = trendMode === 'amount' ? 'value' : 'pct'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const trendUp      = activeData.length >= 2 &&
    activeData[activeData.length-1][activeKey] >= activeData[0][activeKey]

  // 최고/최저 인덱스
  const trendMinMaxIdx = useMemo(() => {
    if (activeData.length < 2) return { maxIdx: -1, minIdx: -1 }
    let maxIdx = 0, minIdx = 0
    activeData.forEach((d: Record<string,number>, i: number) => {
      if (d[activeKey] > activeData[maxIdx][activeKey]) maxIdx = i
      if (d[activeKey] < activeData[minIdx][activeKey]) minIdx = i
    })
    return { maxIdx, minIdx }
  }, [activeData, activeKey])

  const NEON   = '#deff9a'
  const trendGradId = 'trendGradNeon'

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

  // ── 월별 평가손익 (매수월 기준 그룹핑 + Core/Satellite 분리) ─────
  // ★ asset_role 필드 기반 Core 판별 (DB에 저장된 명시적 포지션 사용)
  // 방어: asset_role 없는 기존 데이터는 ETF 브랜드·린치 카테고리로 폴백
  const ETF_BRANDS_CORE = ['TIGER','KODEX','ACE','PLUS','KBSTAR','HANARO','ARIRANG','SOL','RISE','ETF']
  const isCoreInv = (inv: Investment) => {
    // 1순위: DB에 명시된 asset_role
    if ((inv as Investment & { asset_role?: string }).asset_role === 'SATELLITE') return false
    if ((inv as Investment & { asset_role?: string }).asset_role === 'CORE')      return true
    // 폴백: ETF 브랜드 또는 안정적 린치 카테고리
    const upper = inv.name.toUpperCase()
    if (ETF_BRANDS_CORE.some(b => upper.includes(b))) return true
    const cat = inv.lynch_category
    return cat === 'stalwart' || cat === 'slow_grower'
  }

  // ── 현재 Core/Satellite 비중 계산 (평가금액 기준) ─────────────
  const currentCorePct = useMemo(() => {
    if (pricedInvs.length === 0 || totalCurrKrw === 0) return 0
    const coreVal = pricedInvs.reduce((s, inv) => {
      const lv  = live(inv)
      if (!lv) return s
      const val = toKrw(inv, lv.currentPrice)
      return isCoreInv(inv) ? s + val : s
    }, 0)
    return (coreVal / totalCurrKrw) * 100
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedInvs, priceMap, usdKrw])

  const monthlyPnL = useMemo(() => {
    type MonthBucket = { coreCost:number; coreCurr:number; satCost:number; satCurr:number; count:number }
    const map: Record<string, MonthBucket> = {}

    pricedInvs.forEach(inv => {
      const lv = live(inv)
      if (!lv) return
      const month  = inv.purchase_date.slice(0, 7)
      const exRate = inv.currency === 'USD' ? usdKrw : 1
      const cost   = inv.purchase_price * inv.quantity * exRate
      const curr   = lv.currentPrice    * inv.quantity * exRate
      if (!map[month]) map[month] = { coreCost:0, coreCurr:0, satCost:0, satCurr:0, count:0 }
      if (isCoreInv(inv)) { map[month].coreCost += cost; map[month].coreCurr += curr }
      else                { map[month].satCost  += cost; map[month].satCurr  += curr }
      map[month].count += 1
    })

    const rows = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { coreCost, coreCurr, satCost, satCurr, count }]) => {
        const corePnl  = Math.round(coreCurr - coreCost)
        const satPnl   = Math.round(satCurr  - satCost)
        const totalPnl = corePnl + satPnl
        const totalCost = coreCost + satCost
        const pnlPct    = totalCost > 0 ? parseFloat(((totalPnl / totalCost) * 100).toFixed(1)) : 0
        const [y, m]    = month.split('-')
        return { month, label:`${y.slice(2)}년 ${parseInt(m)}월`, corePnl, satPnl, totalPnl, pnlPct, count, isUp: totalPnl >= 0 }
      })

    // 누적 평가손익 추가
    let cumulative = 0
    return rows.map(r => { cumulative += r.totalPnl; return { ...r, cumulative } })
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
        @keyframes divModalIn{from{opacity:0;transform:translate(-50%,-48%) scale(0.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      `}</style>

      {/* ── 대시보드 탭 네비게이션 ── */}
      <div style={{ display:'flex', gap:4, background:'#0f172a', padding:'4px', borderRadius:10, border:'1px solid #1f2937', alignSelf:'flex-start' }}>
        {([
          { key:'live'     as const, icon:'📊', label:'실시간 대시보드',         desc:'자산 현황 · 리밸런싱' },
          { key:'backtest' as const, icon:'⏳', label:'투자 타임머신 (백테스트)', desc:'5개년 전략 시뮬레이터' },
          { key:'mentor'   as const, icon:'🤖', label:'AI 멘토 족집게',           desc:'마스터 진단 레포트' },
        ]).map(({ key, icon, label, desc }) => (
          <button key={key} type="button" onClick={() => setDashTab(key)}
            style={{
              display:'flex', flexDirection:'column', alignItems:'flex-start',
              padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              transition:'all 0.18s',
              background:  dashTab === key ? '#1e293b' : 'transparent',
              boxShadow:   dashTab === key ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
            }}>
            <span style={{ fontSize:13, fontWeight:700, color: dashTab === key ? '#f1f5f9' : '#475569' }}>
              {icon} {label}
            </span>
            <span style={{ fontSize:9, color: dashTab === key ? '#64748b' : '#334155', marginTop:1 }}>{desc}</span>
          </button>
        ))}
      </div>

      {/* ── 실시간 대시보드 탭 ── */}
      <div id="tab-live" style={{ display: dashTab==='live' ? 'flex' : 'none', flexDirection:'column', gap:16 }}>

      {/* ── 배당 상세 모달 (fixed center) ── */}
      {showDivDetail && (
        <>
          {/* 백드롭 */}
          <div
            onClick={() => setShowDivDetail(false)}
            style={{
              position:'fixed', inset:0, zIndex:1000,
              background:'rgba(0,0,0,0.6)',
              backdropFilter:'blur(4px)',
              WebkitBackdropFilter:'blur(4px)',
            }}
          />
          {/* 모달 본체 */}
          <div style={{
            position:'fixed',
            top:'50%', left:'50%',
            transform:'translate(-50%,-50%)',
            zIndex:1001,
            width: 'min(400px, 90vw)',
            maxHeight:'80vh',
            background:'#0f1117',
            border:'1px solid #1e2a40',
            borderRadius:16,
            boxShadow:'0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(52,211,153,0.1)',
            display:'flex', flexDirection:'column',
            animation:'divModalIn 0.2s ease-out',
            overflow:'hidden',
          }}>
            {/* 헤더 */}
            <div style={{
              padding:'18px 20px 14px',
              borderBottom:'1px solid #1a2235',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              flexShrink:0,
            }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#34d399', letterSpacing:'0.12em', textTransform:'uppercase' as const }}>
                  💰 종목별 배당금 상세
                </div>
                <div style={{ fontSize:10, color:'#374168', marginTop:3 }}>
                  월간 예상 기준 · {dividendMap && Object.keys(dividendMap).length > 0 ? `${investments.length}개 종목 분석` : ''}
                </div>
              </div>
              <button
                onClick={() => setShowDivDetail(false)}
                style={{
                  width:28, height:28, borderRadius:8,
                  background:'#1a2235', border:'1px solid #252f47',
                  color:'#6b7280', cursor:'pointer', fontSize:14,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0,
                }}
              >✕</button>
            </div>

            {/* 종목 리스트 (스크롤) */}
            <div style={{ overflowY:'auto', flex:1, padding:'6px 0' }}>
              {dividendMap && investments
                .map(inv => {
                  const key  = inv.ticker.toUpperCase()
                  const lv   = priceMap[inv.ticker.toUpperCase()]
                  const dMap = dividendMap[key]
                  const annDiv = dMap?.annualDividend ?? null
                  let monthlyAmt = 0
                  if (annDiv && annDiv > 0) {
                    const annDivKrw = inv.currency === 'USD' ? annDiv * usdKrw : annDiv
                    monthlyAmt = annDivKrw * inv.quantity / 12
                  } else {
                    const dy = dMap?.dividendYield ?? lv?.dividendYield ?? null
                    if (dy && dy > 0) {
                      const p = (lv?.currentPrice ?? inv.purchase_price) * (inv.currency === 'USD' ? usdKrw : 1)
                      monthlyAmt = p * inv.quantity * dy / 12
                    }
                  }
                  return monthlyAmt > 0 ? { ...inv, monthlyAmt } : null
                })
                .filter((d): d is (Investment & {monthlyAmt:number}) => d !== null)
                .sort((a,b) => b.monthlyAmt - a.monthlyAmt)
                .map((d, i, arr) => (
                  <div key={d.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'11px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid #111827' : 'none',
                    transition:'background 0.1s',
                  }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.03)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      {/* 색상 dot */}
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', flexShrink:0, boxShadow:'0 0 6px rgba(52,211,153,0.5)' }}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{
                          fontSize:13, fontWeight:600, color:'#dde4f0',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const,
                          maxWidth:200,
                        }}>
                          {d.name}
                        </div>
                        <div style={{ fontSize:10, color:'#374168', marginTop:2 }}>
                          {d.ticker} · {d.quantity.toLocaleString()}주
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' as const, flexShrink:0, marginLeft:12 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#34d399', fontVariantNumeric:'tabular-nums' }}>
                        {fmtKrw(Math.round(d.monthlyAmt))}
                      </div>
                      <div style={{ fontSize:10, color:'#374168', marginTop:2 }}>/ 월</div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* 합계 푸터 */}
            <div style={{
              padding:'14px 20px',
              borderTop:'1px solid #1a2235',
              background:'#090c14',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              flexShrink:0,
            }}>
              <div>
                <div style={{ fontSize:9, color:'#454868', fontWeight:700, letterSpacing:'0.1em' }}>TOTAL / 월</div>
                <div style={{ fontSize:10, color:'#374168', marginTop:2 }}>
                  연 {fmtKrw(Math.round(
                    investments.reduce((sum, inv) => {
                      const key  = inv.ticker.toUpperCase()
                      const lv   = priceMap[inv.ticker.toUpperCase()]
                      const dMap = dividendMap[key]
                      const annDiv = dMap?.annualDividend ?? null
                      if (annDiv && annDiv > 0) return sum + annDiv * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1)
                      const dy = dMap?.dividendYield ?? lv?.dividendYield ?? null
                      if (dy && dy > 0) {
                        const p = (lv?.currentPrice ?? inv.purchase_price) * (inv.currency === 'USD' ? usdKrw : 1)
                        return sum + p * inv.quantity * dy
                      }
                      return sum
                    }, 0)
                  ))} 예상
                </div>
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:'#34d399', fontVariantNumeric:'tabular-nums', letterSpacing:'-0.5px' }}>
                {fmtKrw(Math.round(
                  investments.reduce((sum, inv) => {
                    const key  = inv.ticker.toUpperCase()
                    const lv   = priceMap[inv.ticker.toUpperCase()]
                    const dMap = dividendMap[key]
                    const annDiv = dMap?.annualDividend ?? null
                    if (annDiv && annDiv > 0) return sum + annDiv * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1) / 12
                    const dy = dMap?.dividendYield ?? lv?.dividendYield ?? null
                    if (dy && dy > 0) {
                      const p = (lv?.currentPrice ?? inv.purchase_price) * (inv.currency === 'USD' ? usdKrw : 1)
                      return sum + p * inv.quantity * dy / 12
                    }
                    return sum
                  }, 0)
                ))}
              </div>
            </div>
          </div>
        </>
      )}

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

        // 월간 예상 배당금 계산 — dividendMap(stock-info) 우선, fallback priceMap
        // 우선순위: annualDividend(주/좌당 연간 배당금) → dividendYield × 현재가
        const monthlyDividend = investments.reduce((sum, inv) => {
          const key  = inv.ticker.toUpperCase()
          const lv   = live(inv)
          const dMap = dividendMap[key]

          // annualDividend: 주당 연간 배당금(원화 기준, KR ETF는 SEIBro 합산)
          const annDiv = dMap?.annualDividend ?? null
          if (annDiv && annDiv > 0) {
            // KR: 원화 그대로, US: USD→KRW 환산
            const annDivKrw = inv.currency === 'USD' ? annDiv * usdKrw : annDiv
            return sum + annDivKrw * inv.quantity / 12
          }

          // fallback: dividendYield × 현재가
          const dy = dMap?.dividendYield
            ?? lv?.dividendYield
            ?? null
          if (!dy || dy <= 0) return sum
          const priceKrw = (lv?.currentPrice ?? inv.purchase_price) * (inv.currency === 'USD' ? usdKrw : 1)
          return sum + priceKrw * inv.quantity * dy / 12
        }, 0)

        // 종목별 배당 상세 목록 (팝업용)
        const dividendDetails = investments
          .map(inv => {
            const key  = inv.ticker.toUpperCase()
            const lv   = live(inv)
            const dMap = dividendMap[key]
            const annDiv = dMap?.annualDividend ?? null
            let monthlyAmt = 0
            if (annDiv && annDiv > 0) {
              const annDivKrw = inv.currency === 'USD' ? annDiv * usdKrw : annDiv
              monthlyAmt = annDivKrw * inv.quantity / 12
            } else {
              const dy = dMap?.dividendYield ?? lv?.dividendYield ?? null
              if (dy && dy > 0) {
                const priceKrw = (lv?.currentPrice ?? inv.purchase_price) * (inv.currency === 'USD' ? usdKrw : 1)
                monthlyAmt = priceKrw * inv.quantity * dy / 12
              }
            }
            return monthlyAmt > 0 ? { name: inv.name, ticker: inv.ticker, monthlyAmt } : null
          })
          .filter((d): d is { name:string; ticker:string; monthlyAmt:number } => d !== null)
          .sort((a, b) => b.monthlyAmt - a.monthlyAmt)

        const dividendStockCount = dividendDetails.length

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
            main:   dividendLoading
              ? '조회 중…'
              : monthlyDividend > 0
                ? fmtKrw(Math.round(monthlyDividend))
                : '—',
            sub:    dividendLoading
              ? `${investments.length}개 종목 분석 중`
              : monthlyDividend > 0
                ? `배당 종목 ${dividendStockCount}개 · 연 ${fmtKrw(Math.round(monthlyDividend * 12))}`
                : '배당 종목 없음',
            accent: '#34d399',
          },
        ]

        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
            {cards.map(({ label, accent, main, sub }) => {
              const isDivCard = label === '월간 예상 배당금'
              return (
                <div key={label} style={{
                  background: N, boxShadow: SHO,
                  borderRadius: 12, padding: '12px 14px',
                  borderLeft: `3px solid ${accent}`,
                  position: 'relative' as const,
                }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#454868', textTransform:'uppercase' as const, letterSpacing:'0.1em', marginBottom:6 }}>
                    {label}
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:accent, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.4px', lineHeight:1.1 }}>
                    {main}
                  </div>
                  {sub && <div style={{ fontSize:10, color:'#454868', marginTop:4 }}>{sub}</div>}

                  {/* 배당 카드 전용: 상세보기 버튼 */}
                  {isDivCard && !dividendLoading && monthlyDividend > 0 && (
                    <button
                      onClick={() => setShowDivDetail(v => !v)}
                      style={{
                        marginTop:7, padding:'3px 10px',
                        background:'transparent',
                        border:`1px solid ${showDivDetail ? '#34d399' : '#2a3050'}`,
                        borderRadius:5, color: showDivDetail ? '#34d399' : '#4b5680',
                        fontSize:9, fontWeight:600, cursor:'pointer',
                        letterSpacing:'0.04em', transition:'all 0.15s',
                      }}
                    >
                      {showDivDetail ? '✕ 닫기' : '상세 보기 →'}
                    </button>
                  )}
                </div>
              )
            })}
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

        {/* 좌: 30일 자산 추이 (업그레이드) */}
        <Card>
          {/* 헤더: 타이틀 + 토글 */}
          <div style={{ padding:'14px 18px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>
              자산 총액 변화 (최근 30일)
            </div>
            {/* 세그먼트 토글 */}
            <div style={{ display:'flex', background:'#13162a', borderRadius:8, padding:2, gap:2 }}>
              {(['amount','pct'] as const).map(mode => (
                <button key={mode} onClick={() => setTrendMode(mode)} style={{
                  padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer',
                  fontSize:10, fontWeight:700, letterSpacing:'0.04em',
                  background: trendMode === mode ? NEON : 'transparent',
                  color:       trendMode === mode ? '#0a0a0a' : '#4b5563',
                  transition:'all 0.18s',
                }}>
                  {mode === 'amount' ? '₩ 금액' : '% 수익률'}
                </button>
              ))}
            </div>
          </div>

          {/* KPI 요약 */}
          <div style={{ padding:'8px 18px 4px', display:'flex', gap:20, flexWrap:'wrap' }}>
            {totalRet != null && (
              <>
                <div>
                  <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>30일 수익률</div>
                  <div style={{ fontSize:15, fontWeight:800, color:(totalRet??0)>=0?'#ef4444':'#3b82f6', fontVariantNumeric:'tabular-nums' }}>{fmtPct(totalRet)}</div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>평가 손익</div>
                  <div style={{ fontSize:15, fontWeight:800, color:totalPnL>=0?'#ef4444':'#3b82f6', fontVariantNumeric:'tabular-nums' }}>{fmtKrw(totalPnL)}</div>
                </div>
                {trendData.length >= 2 && (() => {
                  const { maxIdx, minIdx } = trendMinMaxIdx
                  const maxVal = maxIdx >= 0 ? activeData[maxIdx][activeKey] as number : null
                  const minVal = minIdx >= 0 ? activeData[minIdx][activeKey] as number : null
                  return (
                    <>
                      {maxVal != null && (
                        <div>
                          <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>30일 최고</div>
                          <div style={{ fontSize:15, fontWeight:800, color:NEON, fontVariantNumeric:'tabular-nums' }}>
                            {trendMode==='amount' ? fmtKrw(maxVal) : `+${maxVal.toFixed(2)}%`}
                          </div>
                        </div>
                      )}
                      {minVal != null && (
                        <div>
                          <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>30일 최저</div>
                          <div style={{ fontSize:15, fontWeight:800, color:'#6b7280', fontVariantNumeric:'tabular-nums' }}>
                            {trendMode==='amount' ? fmtKrw(minVal) : `${minVal.toFixed(2)}%`}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </>
            )}
          </div>

          {/* 차트 */}
          <div style={{ padding:'4px 8px 12px' }}>
            {activeData.length < 2 ? <Empty msg="현재가 데이터 로딩 후 표시됩니다"/> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activeData} margin={{ top:20, right:12, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={trendGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={NEON} stopOpacity={0.28}/>
                      <stop offset="60%"  stopColor={NEON} stopOpacity={0.06}/>
                      <stop offset="100%" stopColor={NEON} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1e30" vertical={false}/>
                  <XAxis
                    dataKey="date"
                    tick={{ fill:'#374151', fontSize:9 }}
                    axisLine={false} tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill:'#374151', fontSize:9 }}
                    axisLine={false} tickLine={false}
                    width={48}
                    domain={[
                      (dataMin: number) => dataMin * (trendMode==='amount' ? 0.9985 : 1) - (trendMode==='pct' ? 0.05 : 0),
                      (dataMax: number) => dataMax * (trendMode==='amount' ? 1.0015 : 1) + (trendMode==='pct' ? 0.05 : 0),
                    ]}
                    tickFormatter={v =>
                      trendMode === 'pct'
                        ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
                        : v >= 1e8 ? `${(v/1e8).toFixed(1)}억`
                        : v >= 1e4 ? `${(v/1e4).toFixed(0)}만`
                        : `${v}`
                    }
                  />
                  {/* 커스텀 툴팁 */}
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const val = payload[0]?.value as number
                      return (
                        <div style={{
                          background:'#0f1117', border:'1px solid #1e2a40',
                          borderRadius:10, padding:'10px 14px',
                          boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
                          minWidth:130,
                        }}>
                          <div style={{ fontSize:10, color:'#4b5563', marginBottom:6, fontWeight:600 }}>{label}</div>
                          <div style={{ fontSize:14, fontWeight:800, color:NEON, fontVariantNumeric:'tabular-nums' }}>
                            {trendMode === 'pct'
                              ? `${val > 0 ? '+' : ''}${val.toFixed(2)}%`
                              : val >= 1e8
                                ? `₩${(val/1e8).toFixed(2)}억`
                                : `₩${Math.round(val).toLocaleString('ko-KR')}`
                            }
                          </div>
                          {trendMode === 'pct' && (
                            <div style={{ fontSize:10, color:'#374151', marginTop:3 }}>
                              {val >= 0 ? '▲' : '▼'} 기준일 대비
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  {/* 메인 에어리어 */}
                  <Area
                    type="monotone"
                    dataKey={activeKey}
                    name="포트폴리오"
                    stroke={NEON}
                    strokeWidth={2}
                    fill={`url(#${trendGradId})`}
                    isAnimationActive={true}
                    animationDuration={600}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    dot={(props: any) => {
                      const cx: number = props.cx ?? 0
                      const cy: number = props.cy ?? 0
                      const index: number = props.index ?? 0
                      const { maxIdx, minIdx } = trendMinMaxIdx
                      if (index === maxIdx) {
                        return (
                          <g key={`max-${index}`}>
                            <circle cx={cx} cy={cy} r={5} fill={NEON} stroke="#0f1117" strokeWidth={2}/>
                            <text x={cx} y={cy - 12} textAnchor="middle" fontSize={9} fontWeight={700} fill={NEON}>최고</text>
                          </g>
                        )
                      }
                      if (index === minIdx) {
                        return (
                          <g key={`min-${index}`}>
                            <circle cx={cx} cy={cy} r={5} fill="#6b7280" stroke="#0f1117" strokeWidth={2}/>
                            <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9} fontWeight={700} fill="#6b7280">최저</text>
                          </g>
                        )
                      }
                      return <g key={`dot-${index}`}/>
                    }}
                    activeDot={{ r:5, fill:NEON, stroke:'#0f1117', strokeWidth:2 }}
                  />
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

      {/* ── 4. 월별 평가손익 콤보 차트 (업그레이드) ── */}
      <Card>
        {/* 헤더 */}
        <div style={{ padding:'14px 20px 6px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>
              📊 월별 평가손익 (매수월 기준)
            </div>
            <div style={{ fontSize:11, color:'#374151', marginTop:3 }}>
              Core · Satellite 분리 누적 손익 + 추이선
            </div>
          </div>
          {/* 범례 */}
          <div style={{ display:'flex', gap:12, flexShrink:0, alignItems:'center' }}>
            {[
              { color:'#deff9a', label:'Core (ETF·우량주)', dash:false },
              { color:'#38bdf8', label:'Satellite (성장·테마)', dash:false },
              { color:'#818cf8', label:'누적 추이', dash:true },
            ].map(({ color, label, dash }) => (
              <span key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#6b7280' }}>
                {dash
                  ? <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="2" strokeDasharray="4 2"/></svg>
                  : <span style={{ width:10, height:10, borderRadius:3, background:color, display:'inline-block', opacity:0.85 }}/>
                }
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding:'4px 8px 16px' }}>
          {monthlyPnL.length === 0 ? (
            <Empty msg="현재가가 로드되면 차트가 표시됩니다"/>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={monthlyPnL} margin={{ top:24, right:16, bottom:0, left:8 }} barCategoryGap="32%">
                <defs>
                  {/* Core 수익 그라데이션 */}
                  <linearGradient id="coreProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#deff9a" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#deff9a" stopOpacity={0.55}/>
                  </linearGradient>
                  {/* Core 손실 그라데이션 */}
                  <linearGradient id="coreLoss" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"   stopColor="#f87171" stopOpacity={0.90}/>
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0.50}/>
                  </linearGradient>
                  {/* Sat 수익 그라데이션 */}
                  <linearGradient id="satProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#38bdf8" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.55}/>
                  </linearGradient>
                  {/* Sat 손실 그라데이션 */}
                  <linearGradient id="satLoss" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"   stopColor="#fb923c" stopOpacity={0.90}/>
                    <stop offset="100%" stopColor="#fb923c" stopOpacity={0.50}/>
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="2 4" stroke="#1a2035" vertical={false}/>

                <XAxis
                  dataKey="label"
                  tick={{ fill:'#4b5563', fontSize:10, fontWeight:500 }}
                  axisLine={{ stroke:'#1e2a3a' }} tickLine={false}
                />
                <YAxis
                  yAxisId="bar"
                  tick={{ fill:'#4b5563', fontSize:9 }}
                  axisLine={false} tickLine={false} width={52}
                  tickFormatter={v => v === 0 ? '0' : v >= 1e8 ? `${(v/1e8).toFixed(1)}억` : v >= 1e4 ? `${(v/1e4).toFixed(0)}만` : Math.abs(v) >= 1e4 ? `-${(Math.abs(v)/1e4).toFixed(0)}만` : `${(v/1e4).toFixed(0)}만`}
                />
                <YAxis
                  yAxisId="line"
                  orientation="right"
                  tick={{ fill:'#374151', fontSize:9 }}
                  axisLine={false} tickLine={false} width={52}
                  tickFormatter={v => v === 0 ? '0' : v >= 1e8 ? `${(v/1e8).toFixed(1)}억` : v >= 1e4 ? `${(v/1e4).toFixed(0)}만` : `${v}`}
                />

                {/* 기준선 Y=0 */}
                <ReferenceLine yAxisId="bar" y={0} stroke="#2d3a50" strokeWidth={1.5}/>

                {/* 커스텀 툴팁 */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  const fmtAmt = (v: number) => {
                    const abs = Math.abs(v)
                    const sign = v >= 0 ? '+' : '-'
                    if (abs >= 1e8) return `${sign}₩${(abs/1e8).toFixed(2)}억`
                    if (abs >= 1e4) return `${sign}₩${Math.round(abs/1e4).toLocaleString('ko-KR')}만`
                    return `${sign}₩${abs.toLocaleString('ko-KR')}`
                  }
                  return (
                    <div style={{
                      background:'#0f1117', border:'1px solid #1e2a40',
                      borderRadius:12, padding:'12px 16px',
                      boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
                      minWidth:200, fontSize:12,
                    }}>
                      {/* 헤더 */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:8, borderBottom:'1px solid #1e2a40' }}>
                        <span style={{ fontWeight:700, color:'#dde4f0', fontSize:13 }}>{d.label}</span>
                        <span style={{ fontSize:10, color:'#4b5563' }}>{d.count}개 종목</span>
                      </div>
                      {/* Core / Satellite 분리 */}
                      {[
                        { label:'Core', value: d.corePnl, color: d.corePnl >= 0 ? '#deff9a' : '#f87171' },
                        { label:'Satellite', value: d.satPnl, color: d.satPnl >= 0 ? '#38bdf8' : '#fb923c' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                          <span style={{ fontSize:11, color:'#6b7280', display:'flex', alignItems:'center', gap:5 }}>
                            <span style={{ width:7, height:7, borderRadius:2, background:color, display:'inline-block' }}/>
                            {label}
                          </span>
                          <span style={{ fontWeight:700, color, fontVariantNumeric:'tabular-nums', fontSize:12 }}>
                            {fmtAmt(value)}
                          </span>
                        </div>
                      ))}
                      {/* 합계 */}
                      <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #1e2a40', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:11, color:'#6b7280', fontWeight:600 }}>합계</span>
                        <div style={{ textAlign:'right' as const }}>
                          <div style={{ fontWeight:900, color: d.isUp ? '#deff9a' : '#f87171', fontSize:15, fontVariantNumeric:'tabular-nums' }}>
                            {fmtAmt(d.totalPnl)}
                          </div>
                          <div style={{ fontSize:10, color:'#4b5563', marginTop:1 }}>
                            {d.pnlPct >= 0 ? '+' : ''}{d.pnlPct}%
                          </div>
                        </div>
                      </div>
                      {/* 누적 */}
                      <div style={{ marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'#374151' }}>누적 손익</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#818cf8', fontVariantNumeric:'tabular-nums' }}>
                          {fmtAmt(d.cumulative)}
                        </span>
                      </div>
                    </div>
                  )
                }}/>

                {/* Core 막대 — 수익/손실 그라데이션 */}
                <Bar yAxisId="bar" dataKey="corePnl" name="Core" stackId="pnl" maxBarSize={56} radius={[0,0,0,0]}>
                  {monthlyPnL.map((entry, i) => (
                    <BarCell
                      key={i}
                      fill={entry.corePnl >= 0 ? 'url(#coreProfit)' : 'url(#coreLoss)'}
                    />
                  ))}
                </Bar>

                {/* Satellite 막대 */}
                <Bar yAxisId="bar" dataKey="satPnl" name="Satellite" stackId="pnl" maxBarSize={56}
                  radius={[4,4,0,0]}
                >
                  {monthlyPnL.map((entry, i) => (
                    <BarCell
                      key={i}
                      fill={entry.satPnl >= 0 ? 'url(#satProfit)' : 'url(#satLoss)'}
                    />
                  ))}
                  <LabelList
                    dataKey="pnlPct"
                    position="top"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => `${v >= 0 ? '+' : ''}${v}%`}
                    style={{ fontSize:10, fontWeight:700, fill:'#6b7280' }}
                  />
                </Bar>

                {/* 누적 추이선 */}
                <Line
                  yAxisId="line"
                  type="monotone"
                  dataKey="cumulative"
                  name="누적 손익"
                  stroke="#818cf8"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r:3, fill:'#818cf8', stroke:'#0f1117', strokeWidth:1.5 }}
                  activeDot={{ r:5, fill:'#818cf8', stroke:'#0f1117', strokeWidth:2 }}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── 리밸런싱 알림 & 시뮬레이터 (편차 5%p 이상 시 조건부 표시) ── */}
      <RebalanceWidget
        corePct={currentCorePct}
        totalValKrw={totalCurrKrw}
        targetCore={targetCore}
      />

      {/* ── 5. 보유 자산 테이블 + 알림 패널 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'6fr 4fr', gap:16 }}>

        {/* 좌: 보유 자산 테이블 */}
        <Card>
          <SectionTitle>보유 자산 상세</SectionTitle>
          <div style={{ overflowX:'auto', padding:'10px 0 16px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1f2937' }}>
                  {/* ★ '자산분류' 컬럼 추가 — RebalanceWidget 색상과 동기화 */}
                  {['자산명','시장','자산분류','매수수량','매수단가','현재가','수익률','7일 추이'].map(h => (
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
                      {/* ★ 자산분류 배지 — RebalanceWidget Core=#38bdf8 / Sat=#fb923c 동기화 */}
                      <td style={{ padding:'9px 14px' }}>
                        {(() => {
                          const isCore = isCoreInv(inv)
                          return (
                            <span style={{
                              display:       'inline-flex',
                              alignItems:    'center',
                              gap:           3,
                              fontSize:      9,
                              fontWeight:    800,
                              letterSpacing: '0.06em',
                              padding:       '2px 7px',
                              borderRadius:  5,
                              whiteSpace:    'nowrap',
                              // Core: #38bdf8 계열 (리밸런싱 바와 동일)
                              // Satellite: #fb923c 계열 (리밸런싱 바와 동일)
                              color:      isCore ? '#38bdf8'                : '#fb923c',
                              background: isCore ? 'rgba(56,189,248,0.10)' : 'rgba(251,146,60,0.10)',
                              border:     isCore ? '1px solid rgba(56,189,248,0.22)' : '1px solid rgba(251,146,60,0.22)',
                            }}>
                              {isCore ? '🛡 CORE' : '🚀 SAT'}
                            </span>
                          )
                        })()}
                      </td>
                      {/* ★ 매수수량 셀 */}
                      <td style={{ padding:'9px 14px', color:'#60a5fa', fontVariantNumeric:'tabular-nums', fontWeight:600, whiteSpace:'nowrap' }}>
                        {inv.quantity.toLocaleString('ko-KR')}주
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
                    {/* ★ 자산분류 컬럼 추가로 colSpan 4→5 */}
                    <td colSpan={5} style={{ padding:'9px 14px', fontWeight:700, color:'#f1f5f9', fontSize:12 }}>합계 ({investments.length}종목)</td>
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
      </div>  {/* 6fr/4fr grid 닫기 */}
      </div>  {/* 실시간 대시보드 탭 끝 */}

      {/* ── 투자 타임머신 탭 ── */}
      <div id="tab-backtest" style={{ display: dashTab==='backtest' ? 'flex' : 'none', flexDirection:'column', gap:16 }}>
      <Card>
        <div style={{ padding:'16px 20px 0', display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:18 }}>⏳</span>
              <span style={{ fontSize:14, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.3px' }}>투자 타임머신 — 과거 5개년 백테스팅 시뮬레이터</span>
            </div>
            <div style={{ fontSize:11, color:'#64748b' }}>2021년 초에 1,000만 원 투자 가정 · 리밸런싱 여부에 따른 자산 성장 추이 비교</div>
          </div>
          <div style={{ display:'flex', gap:4, background:'#0f172a', padding:'4px', borderRadius:9, flexWrap:'wrap' }}>
            {([
              { key:'rebalanceQ' as const, label:'분기 리밸런싱', color:'#10b981' },
              { key:'rebalanceY' as const, label:'연간 리밸런싱', color:'#818cf8' },
              { key:'buyAndHold' as const, label:'단순 방치',     color:'#f87171' },
            ]).map(({ key, label, color }) => (
              <button key={key} type="button" onClick={() => setBtActive(p => ({ ...p, [key]: !p[key] }))}
                style={{ padding:'5px 11px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, transition:'all 0.15s',
                  background: btActive[key] ? '#1e293b' : 'transparent', color: btActive[key] ? color : '#475569',
                  boxShadow: btActive[key] ? '0 1px 4px rgba(0,0,0,0.4)' : 'none' }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'14px 20px 0' }}>
          {BACKTEST_SUMMARY.map(s => {
            const on = btActive[s.key]
            return (
              <div key={s.key} onClick={() => setBtActive(p => ({ ...p, [s.key]: !p[s.key] }))}
                style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', transition:'all 0.2s',
                  background: on ? '#1e293b' : '#0f172a', border: `1.5px solid ${on ? s.color + '55' : '#1f2937'}`, opacity: on ? 1 : 0.45 }}>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{s.name}</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#f1f5f9', fontVariantNumeric:'tabular-nums' }}>{s.final}</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, paddingTop:6, borderTop:'1px solid #1f2937', fontSize:10 }}>
                  <span style={{ fontWeight:700, color: s.color }}>{s.ret}</span>
                  <span style={{ color:'#475569' }}>MDD <b style={{ color:'#94a3b8' }}>{s.mdd}</b></span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding:'12px 20px 0' }}>
          <div style={{ background:'#0f172a', borderRadius:12, border:'1px solid #1f2937', padding:'14px 4px 8px' }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={BACKTEST_DATA} margin={{ top:10, right:20, bottom:5, left:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:10 }} axisLine={{ stroke:'#1f2937' }} tickLine={false} />
                <YAxis domain={[700, 2200]} tickFormatter={(v:number) => `${v}만`}
                  tick={{ fill:'#64748b', fontSize:10 }} axisLine={{ stroke:'#1f2937' }} tickLine={false} width={46} />
                <Tooltip
                  contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }}
                  labelStyle={{ color:'#94a3b8', fontWeight:700 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${v}만 원`, String(name)]}
                />
                <ReferenceLine x="22.Q1" stroke="#f87171" strokeDasharray="3 3" strokeWidth={1} opacity={0.5}
                  label={{ value:'22년 하락 시작', position:'insideTopRight', fill:'#f87171', fontSize:9 }} />
                <ReferenceLine x="23.Q1" stroke="#4ade80" strokeDasharray="3 3" strokeWidth={1} opacity={0.5}
                  label={{ value:'회복 시작', position:'insideTopLeft', fill:'#4ade80', fontSize:9 }} />
                {btActive.rebalanceQ && <Line type="monotone" dataKey="rebalanceQ" name="분기별 리밸런싱" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:'#10b981' }} />}
                {btActive.rebalanceY && <Line type="monotone" dataKey="rebalanceY" name="연간 리밸런싱"   stroke="#818cf8" strokeWidth={2}   dot={false} activeDot={{ r:4, fill:'#818cf8' }} />}
                {btActive.buyAndHold && <Line type="monotone" dataKey="buyAndHold" name="단순 보유(방치)" stroke="#f87171" strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:'#f87171' }} />}
                {btActive.benchmark  && <Line type="monotone" dataKey="benchmark"  name="시장 평균 지수" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                {btActive.buyAndHold && <ReferenceDot x="22.Q3" y={810} r={5} fill="#f87171" stroke="#0f172a" strokeWidth={2} />}
                {btActive.rebalanceQ && <ReferenceDot x="22.Q3" y={980} r={5} fill="#10b981" stroke="#0f172a" strokeWidth={2} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 버튼 조합별 동적 인사이트 패널 ── */}
        <div style={{ padding:'0 20px 16px' }}>
          {renderBtInsight()}
        </div>
      </Card>
      </div>  {/* 투자 타임머신 탭 끝 */}

      {/* ── AI 멘토 족집게 탭 ── */}
      <div id="tab-mentor" style={{ display: dashTab==='mentor' ? 'flex' : 'none', flexDirection:'column', gap:16 }}>
        <AIPortfolioDashboard />
      </div>  {/* AI 멘토 탭 끝 */}

    </div>
  )
}
