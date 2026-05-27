'use client'

/**
 * LynchEarningsChart — 피터 린치 적정가치 시계열 차트
 *
 * ◆ 핵심 기능
 *  - 분기별 TTM EPS × 적정 PER = 이익선(Fair Value) 실시간 계산
 *  - 적정 PER 3가지 모델 토글: 이익성장률 / 5년 평균 PER / 고정 15배
 *  - 저평가 구간(주가 < 이익선) 에메랄드 음영
 *  - 커스텀 툴팁: 분기·주가·EPS·적정가치·괴리율
 *  - 가치 괴리율 진단 패널 (AI 가이드 텍스트)
 *  - 3Y / 5Y 조회 기간 슬라이싱
 */

import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Info,
  BarChart2,
  Zap,
  Target,
  Clock,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
interface QuarterlyData {
  quarter: string   // e.g. "2022 Q1"
  date:    string   // ISO 형식 정렬용
  price:   number   // 실제 주가
  ttmEps:  number   // TTM EPS (trailing 12m)
  per:     number   // 실제 PER (price / ttmEps)
}

interface StockMeta {
  ticker:     string
  name:       string
  theme:      string
  growthRate: number   // G — 이익성장률(%)
  avgPer5y:   number   // 5년 평균 PER
  currency:   string
  data:       QuarterlyData[]
}

// ────────────────────────────────────────────────────────────
// 가상 히스토리컬 데이터셋 (각 종목 20분기 = 5년치)
// ────────────────────────────────────────────────────────────
const STOCK_DB: Record<string, StockMeta> = {
  PLTR: {
    ticker: 'PLTR', name: '팔란티어', theme: '고성장주 (AI 데이터)',
    growthRate: 45, avgPer5y: 52, currency: 'USD',
    data: [
      { quarter: '2020 Q1', date: '2020-03-31', price:  9.5,  ttmEps: 0.04, per: 237 },
      { quarter: '2020 Q2', date: '2020-06-30', price: 10.2,  ttmEps: 0.06, per: 170 },
      { quarter: '2020 Q3', date: '2020-09-30', price: 12.8,  ttmEps: 0.08, per: 160 },
      { quarter: '2020 Q4', date: '2020-12-31', price: 25.3,  ttmEps: 0.10, per: 253 },
      { quarter: '2021 Q1', date: '2021-03-31', price: 22.1,  ttmEps: 0.11, per: 201 },
      { quarter: '2021 Q2', date: '2021-06-30', price: 23.4,  ttmEps: 0.13, per: 180 },
      { quarter: '2021 Q3', date: '2021-09-30', price: 20.5,  ttmEps: 0.12, per: 171 },
      { quarter: '2021 Q4', date: '2021-12-31', price: 18.0,  ttmEps: 0.14, per: 129 },
      { quarter: '2022 Q1', date: '2022-03-31', price: 13.2,  ttmEps: 0.08, per: 165 },
      { quarter: '2022 Q2', date: '2022-06-30', price:  8.1,  ttmEps: 0.05, per: 162 },
      { quarter: '2022 Q3', date: '2022-09-30', price:  7.9,  ttmEps: 0.04, per: 198 },
      { quarter: '2022 Q4', date: '2022-12-31', price:  6.4,  ttmEps: 0.03, per: 213 },
      { quarter: '2023 Q1', date: '2023-03-31', price:  8.1,  ttmEps: 0.04, per: 203 },
      { quarter: '2023 Q2', date: '2023-06-30', price: 14.3,  ttmEps: 0.07, per: 204 },
      { quarter: '2023 Q3', date: '2023-09-30', price: 16.9,  ttmEps: 0.09, per: 188 },
      { quarter: '2023 Q4', date: '2023-12-31', price: 20.3,  ttmEps: 0.12, per: 169 },
      { quarter: '2024 Q1', date: '2024-03-31', price: 24.8,  ttmEps: 0.17, per: 146 },
      { quarter: '2024 Q2', date: '2024-06-30', price: 28.4,  ttmEps: 0.22, per: 129 },
      { quarter: '2024 Q3', date: '2024-09-30', price: 38.2,  ttmEps: 0.30, per: 127 },
      { quarter: '2024 Q4', date: '2024-12-31', price: 71.0,  ttmEps: 0.41, per: 173 },
    ],
  },

  KO: {
    ticker: 'KO', name: '코카콜라', theme: '대형우량주 (소비재)',
    growthRate: 8, avgPer5y: 23, currency: 'USD',
    data: [
      { quarter: '2020 Q1', date: '2020-03-31', price: 44.2,  ttmEps: 1.98, per: 22.3 },
      { quarter: '2020 Q2', date: '2020-06-30', price: 44.9,  ttmEps: 1.78, per: 25.2 },
      { quarter: '2020 Q3', date: '2020-09-30', price: 48.1,  ttmEps: 1.72, per: 28.0 },
      { quarter: '2020 Q4', date: '2020-12-31', price: 50.5,  ttmEps: 1.79, per: 28.2 },
      { quarter: '2021 Q1', date: '2021-03-31', price: 51.3,  ttmEps: 1.88, per: 27.3 },
      { quarter: '2021 Q2', date: '2021-06-30', price: 54.2,  ttmEps: 2.02, per: 26.8 },
      { quarter: '2021 Q3', date: '2021-09-30', price: 53.8,  ttmEps: 2.10, per: 25.6 },
      { quarter: '2021 Q4', date: '2021-12-31', price: 56.4,  ttmEps: 2.25, per: 25.1 },
      { quarter: '2022 Q1', date: '2022-03-31', price: 62.4,  ttmEps: 2.32, per: 26.9 },
      { quarter: '2022 Q2', date: '2022-06-30', price: 60.1,  ttmEps: 2.44, per: 24.6 },
      { quarter: '2022 Q3', date: '2022-09-30', price: 55.3,  ttmEps: 2.51, per: 22.0 },
      { quarter: '2022 Q4', date: '2022-12-31', price: 62.2,  ttmEps: 2.48, per: 25.1 },
      { quarter: '2023 Q1', date: '2023-03-31', price: 61.3,  ttmEps: 2.50, per: 24.5 },
      { quarter: '2023 Q2', date: '2023-06-30', price: 59.0,  ttmEps: 2.56, per: 23.0 },
      { quarter: '2023 Q3', date: '2023-09-30', price: 54.7,  ttmEps: 2.60, per: 21.0 },
      { quarter: '2023 Q4', date: '2023-12-31', price: 58.8,  ttmEps: 2.65, per: 22.2 },
      { quarter: '2024 Q1', date: '2024-03-31', price: 59.7,  ttmEps: 2.68, per: 22.3 },
      { quarter: '2024 Q2', date: '2024-06-30', price: 64.8,  ttmEps: 2.72, per: 23.8 },
      { quarter: '2024 Q3', date: '2024-09-30', price: 70.2,  ttmEps: 2.79, per: 25.2 },
      { quarter: '2024 Q4', date: '2024-12-31', price: 62.1,  ttmEps: 2.84, per: 21.9 },
    ],
  },

  NVDA: {
    ticker: 'NVDA', name: '엔비디아', theme: '초고성장주 (반도체·AI)',
    growthRate: 65, avgPer5y: 45, currency: 'USD',
    data: [
      { quarter: '2020 Q1', date: '2020-03-31', price:  56.2,  ttmEps:  1.31, per:  42.9 },
      { quarter: '2020 Q2', date: '2020-06-30', price:  71.3,  ttmEps:  1.55, per:  46.0 },
      { quarter: '2020 Q3', date: '2020-09-30', price: 133.0,  ttmEps:  2.00, per:  66.5 },
      { quarter: '2020 Q4', date: '2020-12-31', price: 131.2,  ttmEps:  2.41, per:  54.4 },
      { quarter: '2021 Q1', date: '2021-03-31', price: 153.1,  ttmEps:  2.87, per:  53.3 },
      { quarter: '2021 Q2', date: '2021-06-30', price: 191.4,  ttmEps:  3.43, per:  55.8 },
      { quarter: '2021 Q3', date: '2021-09-30', price: 220.3,  ttmEps:  3.85, per:  57.2 },
      { quarter: '2021 Q4', date: '2021-12-31', price: 294.1,  ttmEps:  4.44, per:  66.2 },
      { quarter: '2022 Q1', date: '2022-03-31', price: 240.8,  ttmEps:  4.74, per:  50.8 },
      { quarter: '2022 Q2', date: '2022-06-30', price: 169.0,  ttmEps:  3.85, per:  43.9 },
      { quarter: '2022 Q3', date: '2022-09-30', price: 134.8,  ttmEps:  3.34, per:  40.4 },
      { quarter: '2022 Q4', date: '2022-12-31', price: 146.3,  ttmEps:  2.99, per:  48.9 },
      { quarter: '2023 Q1', date: '2023-03-31', price: 277.8,  ttmEps:  3.37, per:  82.4 },
      { quarter: '2023 Q2', date: '2023-06-30', price: 423.0,  ttmEps:  5.21, per:  81.2 },
      { quarter: '2023 Q3', date: '2023-09-30', price: 434.9,  ttmEps:  8.97, per:  48.5 },
      { quarter: '2023 Q4', date: '2023-12-31', price: 495.2,  ttmEps: 12.49, per:  39.6 },
      { quarter: '2024 Q1', date: '2024-03-31', price: 762.0,  ttmEps: 16.84, per:  45.3 },
      { quarter: '2024 Q2', date: '2024-06-30', price: 124.3,  ttmEps:  2.20, per:  56.5 }, // 10:1 분할 후
      { quarter: '2024 Q3', date: '2024-09-30', price: 121.4,  ttmEps:  2.62, per:  46.3 },
      { quarter: '2024 Q4', date: '2024-12-31', price: 134.3,  ttmEps:  2.99, per:  44.9 },
    ],
  },
}

// ────────────────────────────────────────────────────────────
// 컬러 & 상수
// ────────────────────────────────────────────────────────────
const C = {
  bg:       '#020617',
  surface:  '#0f172a',
  card:     '#1e293b',
  cardHi:   '#263348',
  border:   '#334155',
  textHi:   '#f1f5f9',
  textMid:  '#94a3b8',
  textLow:  '#64748b',
  price:    '#60a5fa',   // 실제 주가 — 블루
  fair:     '#f59e0b',   // 이익선 — 앰버/골드
  under:    '#10b981',   // 저평가 음영 — 에메랄드
  over:     '#f87171',   // 고평가 음영 — 레드
  grid:     '#1e293b',
}

type PerModel = 'growth' | 'avg5y' | 'fixed15'

const MODEL_LABELS: Record<PerModel, string> = {
  growth:  '이익성장률 (PEG=1)',
  avg5y:   '5년 평균 PER',
  fixed15: '고정 PER 15배',
}

// ────────────────────────────────────────────────────────────
// 커스텀 툴팁
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const price     = payload.find((p: any) => p.dataKey === 'price')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fairValue = payload.find((p: any) => p.dataKey === 'fairValue')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eps       = payload.find((p: any) => p.dataKey === 'fairValue')?.payload?.ttmEps
  const gap = fairValue && price
    ? (((price - fairValue) / fairValue) * 100)
    : null

  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '12px 16px',
      fontSize: 12,
      minWidth: 210,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight: 800, color: C.fair, marginBottom: 8, fontSize: 13 }}>
        📅 {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: C.textMid }}>실제 주가</span>
          <span style={{ color: C.price, fontWeight: 700, fontFamily: 'monospace' }}>
            ${price?.toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: C.textMid }}>TTM EPS</span>
          <span style={{ color: C.textHi, fontFamily: 'monospace' }}>
            ${eps?.toFixed(2) ?? '-'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: C.textMid }}>린치 적정가치</span>
          <span style={{ color: C.fair, fontWeight: 700, fontFamily: 'monospace' }}>
            ${fairValue?.toFixed(2)}
          </span>
        </div>
        {gap !== null && (
          <div style={{
            borderTop: `1px solid ${C.border}`,
            marginTop: 4,
            paddingTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: C.textMid }}>가치 괴리율</span>
            <span style={{
              fontWeight: 800,
              fontFamily: 'monospace',
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
  currentPrice,
  fairValue,
  ticker,
  model,
  growthRate,
}: {
  currentPrice: number
  fairValue: number
  ticker: string
  model: PerModel
  growthRate: number
}) {
  const gap = ((currentPrice - fairValue) / fairValue) * 100
  const isUnder = gap < 0
  const absGap = Math.abs(gap)

  const modelDesc =
    model === 'growth'  ? `이익성장률(G=${growthRate}%) 기준` :
    model === 'avg5y'   ? '5년 평균 PER 기준' :
    '고정 PER 15배 기준'

  let label = ''
  let guide = ''

  if (gap <= -30) {
    label = `${gap.toFixed(1)}% 극단적 저평가`
    guide = `${ticker}는 현재 린치 적정가치 대비 ${absGap.toFixed(0)}% 저평가 상태입니다. 피터 린치는 이 구간을 "역사적 매수 황금 타이밍"으로 정의합니다. 단, 실적 추이와 EPS 성장 모멘텀을 반드시 재확인하세요.`
  } else if (gap <= -15) {
    label = `${gap.toFixed(1)}% 저평가 매력 구간`
    guide = `${ticker}는 적정가치 대비 ${absGap.toFixed(0)}% 할인된 상태입니다. 린치는 "이익이 성장하는 기업을 할인가에 사라"고 강조했습니다. 분할 매수 전략을 고려해볼 만한 구간입니다.`
  } else if (gap <= 0) {
    label = `${gap.toFixed(1)}% 소폭 저평가`
    guide = `적정가치 대비 소폭 할인 상태입니다. 적정 가격에 근접한 합리적 밸류에이션으로, 장기 홀딩 관점에서 비중 유지가 적합합니다.`
  } else if (gap <= 20) {
    label = `+${gap.toFixed(1)}% 소폭 고평가`
    guide = `적정가치 대비 소폭 프리미엄 상태입니다. 당장의 추가 매수보다 보유 포지션 유지를 권장합니다. 실적 시즌에 EPS 상향 조정 여부를 모니터링하세요.`
  } else if (gap <= 50) {
    label = `+${gap.toFixed(1)}% 고평가 주의`
    guide = `${ticker}는 현재 린치 적정가치 대비 ${absGap.toFixed(0)}% 고평가 상태입니다. 린치는 "최고의 주식도 지나치게 비싸면 나쁜 투자"라고 경고했습니다. 신규 매수 자제 및 분할 익절을 검토하세요.`
  } else {
    label = `+${gap.toFixed(1)}% 극단적 고평가`
    guide = `적정가치 대비 ${absGap.toFixed(0)}% 이상 프리미엄이 붙어있습니다. 시장의 과도한 낙관이 반영된 상태로, 이익 성장이 기대에 부응하지 못할 경우 급격한 주가 조정 위험이 있습니다.`
  }

  const borderColor = isUnder ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'
  const bgColor     = isUnder ? 'rgba(16,185,129,0.07)' : 'rgba(248,113,113,0.07)'
  const accentColor = isUnder ? C.under : C.over
  const Icon = isUnder
    ? (absGap > 20 ? TrendingDown : Minus)
    : (absGap > 20 ? TrendingUp  : Minus)

  return (
    <div style={{
      marginTop: 16,
      padding: '16px 20px',
      borderRadius: 12,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      {/* 괴리율 수치 */}
      <div style={{
        flexShrink: 0,
        width: 90,
        textAlign: 'center',
        padding: '10px 0',
        borderRadius: 10,
        background: `${accentColor}18`,
        border: `1px solid ${accentColor}40`,
      }}>
        <Icon size={20} color={accentColor} style={{ margin: '0 auto 4px' }} />
        <div style={{ fontSize: 18, fontWeight: 900, color: accentColor, fontFamily: 'monospace' }}>
          {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
        </div>
        <div style={{ fontSize: 9, color: C.textLow, marginTop: 2 }}>
          {isUnder ? '저평가' : '고평가'}
        </div>
      </div>

      {/* 텍스트 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: accentColor, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: C.textMid, lineHeight: 1.75 }}>
          {guide}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 10, color: C.textLow }}>
            <span style={{ color: C.price, fontWeight: 700 }}>현재가 ${currentPrice.toFixed(2)}</span>
            {' '}vs{' '}
            <span style={{ color: C.fair, fontWeight: 700 }}>적정가 ${fairValue.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textLow, fontStyle: 'italic' }}>
            ({modelDesc})
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function LynchEarningsChart() {
  const [selectedTicker, setSelectedTicker] = useState<string>('PLTR')
  const [perModel, setPerModel]             = useState<PerModel>('growth')
  const [period, setPeriod]                 = useState<'3Y' | '5Y'>('5Y')
  const [dropdownOpen, setDropdownOpen]     = useState(false)

  const stock = STOCK_DB[selectedTicker]

  // ── 기간 슬라이싱 ──────────────────────────────────────────
  const filteredData = useMemo(() => {
    const quarters = period === '3Y' ? 12 : 20
    return stock.data.slice(-quarters)
  }, [stock, period])

  // ── 적정 PER 계산 ─────────────────────────────────────────
  const fairPer = useMemo(() => {
    if (perModel === 'growth')  return stock.growthRate
    if (perModel === 'avg5y')   return stock.avgPer5y
    return 15
  }, [perModel, stock])

  // ── 차트 데이터 가공 ───────────────────────────────────────
  // 밴드 음영을 위해 underArea(저평가)/overArea(고평가) 필드 추가
  const chartData = useMemo(() => {
    return filteredData.map(d => {
      const fairValue = parseFloat((d.ttmEps * fairPer).toFixed(2))
      const isUnder   = d.price < fairValue
      return {
        ...d,
        fairValue,
        // 저평가 구간: price ~ fairValue 사이 음영
        underLow:  isUnder ? d.price    : null,
        underHigh: isUnder ? fairValue  : null,
        // 고평가 구간: fairValue ~ price 사이 음영
        overLow:   !isUnder ? fairValue : null,
        overHigh:  !isUnder ? d.price   : null,
      }
    })
  }, [filteredData, fairPer])

  // ── 마지막 데이터 포인트 (진단 패널용) ────────────────────
  const latest      = chartData[chartData.length - 1]
  const latestPrice = latest?.price      ?? 0
  const latestFair  = latest?.fairValue  ?? 0

  // ── Y축 도메인 자동 계산 ───────────────────────────────────
  const allValues = chartData.flatMap(d => [d.price, d.fairValue])
  const yMin = Math.floor(Math.min(...allValues) * 0.85)
  const yMax  = Math.ceil(Math.max(...allValues) * 1.10)

  return (
    <div style={{
      background: C.bg,
      minHeight: '100%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '0 0 24px',
    }}>

      {/* ── 헤더 타이틀 ──────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <BarChart2 size={18} color={C.fair} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.textHi }}>
            피터 린치 적정가치 이익선 차트
          </div>
          <div style={{ fontSize: 11, color: C.textLow, marginTop: 1 }}>
            TTM EPS × 적정 PER → Fair Value Line · 저평가 구간 자동 감지
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {/* 범례 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textMid }}>
            <div style={{ width: 18, height: 2, background: C.price, borderRadius: 2 }} />
            실제 주가
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textMid }}>
            <div style={{ width: 18, height: 2, background: C.fair, borderRadius: 2, borderTop: '2px dashed ' + C.fair }} />
            적정가치선
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textMid }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(16,185,129,0.3)' }} />
            저평가 구간
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px' }}>

        {/* ── 컨트롤러 바 ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          marginBottom: 16,
        }}>

          {/* 종목 선택 드롭다운 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 9,
                background: C.card, border: `1px solid ${C.border}`,
                color: C.textHi, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                minWidth: 180,
              }}
            >
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'rgba(96,165,250,0.15)', color: C.price,
                fontFamily: 'monospace', fontWeight: 900,
              }}>
                {stock.ticker}
              </span>
              {stock.name}
              <ChevronDown size={14} color={C.textLow} style={{ marginLeft: 'auto' }} />
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, zIndex: 50,
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, overflow: 'hidden', minWidth: 220,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {Object.values(STOCK_DB).map(s => (
                  <button
                    key={s.ticker}
                    onClick={() => { setSelectedTicker(s.ticker); setDropdownOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '10px 14px', textAlign: 'left',
                      background: s.ticker === selectedTicker ? C.cardHi : 'transparent',
                      border: 'none', cursor: 'pointer', color: C.textHi, fontSize: 12,
                    }}
                  >
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 3,
                      background: 'rgba(96,165,250,0.15)', color: C.price,
                      fontFamily: 'monospace', fontWeight: 900, flexShrink: 0,
                    }}>
                      {s.ticker}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: C.textLow }}>{s.theme}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 조회 기간 */}
          <div style={{
            display: 'flex', borderRadius: 9, overflow: 'hidden',
            border: `1px solid ${C.border}`,
          }}>
            {(['3Y', '5Y'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: period === p ? C.fair : C.card,
                  color:      period === p ? '#000' : C.textMid,
                  border: 'none',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Clock size={12} />
                {p}
              </button>
            ))}
          </div>

          {/* 적정 PER 모델 */}
          <div style={{
            display: 'flex', borderRadius: 9, overflow: 'hidden',
            border: `1px solid ${C.border}`,
          }}>
            {(Object.keys(MODEL_LABELS) as PerModel[]).map(m => {
              const icons = {
                growth:  <Zap size={11} />,
                avg5y:   <BarChart2 size={11} />,
                fixed15: <Target size={11} />,
              }
              return (
                <button
                  key={m}
                  onClick={() => setPerModel(m)}
                  style={{
                    padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: perModel === m ? 'rgba(245,158,11,0.2)' : C.card,
                    color:      perModel === m ? C.fair : C.textMid,
                    border:     perModel === m ? `1px solid rgba(245,158,11,0.4)` : 'none',
                    borderRadius: perModel === m ? 8 : 0,
                    display: 'flex', alignItems: 'center', gap: 5,
                    margin: perModel === m ? 1 : 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {icons[m]}
                  {MODEL_LABELS[m]}
                </button>
              )
            })}
          </div>

          {/* 현재 적정 PER 표시 */}
          <div style={{
            marginLeft: 'auto',
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Info size={12} color={C.fair} />
            <span style={{ fontSize: 11, color: C.textMid }}>적정 PER:</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.fair, fontFamily: 'monospace' }}>
              {fairPer}×
            </span>
          </div>
        </div>

        {/* ── 차트 영역 ─────────────────────────────────────────── */}
        <div style={{
          background: C.card, borderRadius: 14,
          border: `1px solid ${C.border}`,
          padding: '16px 8px 8px 4px',
        }}>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                {/* 저평가 그라디언트 */}
                <linearGradient id="underGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                </linearGradient>
                {/* 고평가 그라디언트 */}
                <linearGradient id="overGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f87171" stopOpacity={0.20} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.03} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="quarter"
                tick={{ fill: C.textLow, fontSize: 10 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                interval={period === '3Y' ? 1 : 3}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: C.textLow, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={52}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* 현재 마지막 포인트 수직선 */}
              <ReferenceLine
                x={latest?.quarter}
                stroke={C.textLow}
                strokeDasharray="4 2"
                strokeWidth={1}
              />

              {/* 저평가 구간 음영 (Area — underLow~underHigh) */}
              <Area
                type="monotone"
                dataKey="underHigh"
                stroke="none"
                fill="url(#underGrad)"
                fillOpacity={1}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="underLow"
                stroke="none"
                fill={C.bg}  // 아래쪽은 배경으로 덮어 실제 gap만 보이게
                fillOpacity={1}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />

              {/* 고평가 구간 음영 */}
              <Area
                type="monotone"
                dataKey="overHigh"
                stroke="none"
                fill="url(#overGrad)"
                fillOpacity={1}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="overLow"
                stroke="none"
                fill={C.bg}
                fillOpacity={1}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />

              {/* 피터 린치 이익선 (황금 대시) */}
              <Line
                type="monotone"
                dataKey="fairValue"
                stroke={C.fair}
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 5, fill: C.fair, stroke: C.surface, strokeWidth: 2 }}
                name="린치 적정가치"
              />

              {/* 실제 주가 (진한 블루) */}
              <Line
                type="monotone"
                dataKey="price"
                stroke={C.price}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: C.price, stroke: C.surface, strokeWidth: 2 }}
                name="실제 주가"
              />

              <Legend
                wrapperStyle={{ paddingTop: 12, fontSize: 11, color: C.textMid }}
                formatter={(value) => (
                  <span style={{ color: C.textMid }}>{value}</span>
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── 종목 메타 정보 카드 ────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
          marginTop: 14,
        }}>
          {[
            { label: '현재 주가',    value: `$${latestPrice.toFixed(2)}`,  color: C.price },
            { label: '린치 적정가치', value: `$${latestFair.toFixed(2)}`,   color: C.fair },
            {
              label: `EPS (TTM)`,
              value: `$${latest?.ttmEps?.toFixed(2) ?? '-'}`,
              color: C.textHi,
            },
            {
              label: '적용 PER',
              value: `${fairPer}×`,
              color: C.textHi,
            },
          ].map(item => (
            <div key={item.label} style={{
              padding: '12px 14px', borderRadius: 10,
              background: C.card, border: `1px solid ${C.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: C.textLow, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── 가치 괴리율 진단 패널 ─────────────────────────────── */}
        {latestPrice > 0 && latestFair > 0 && (
          <ValuationPanel
            currentPrice={latestPrice}
            fairValue={latestFair}
            ticker={stock.ticker}
            model={perModel}
            growthRate={stock.growthRate}
          />
        )}

        {/* ── 린치 투자 원칙 요약 ────────────────────────────────── */}
        <div style={{
          marginTop: 14,
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(245,158,11,0.05)',
          border: '1px solid rgba(245,158,11,0.15)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Info size={14} color={C.fair} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: C.textLow, lineHeight: 1.7 }}>
            <strong style={{ color: C.fair }}>피터 린치 이익선 원칙:</strong>{' '}
            장기적으로 주가는 이익선(EPS × 적정 PER)을 따라간다.
            주가가 이익선 아래에 있으면 저평가 매수 기회, 이익선 위에 있으면 프리미엄 경계 구간이다.
            현재 종목의 이익성장률(G)={stock.growthRate}%, 5년 평균 PER={stock.avgPer5y}× 기준으로 적정 가치가 계산된다.
          </div>
        </div>

      </div>
    </div>
  )
}
