'use client'

/**
 * /macro-hub — 발키리 글로벌 매크로 허브 v2
 *
 * [상단] 글로벌 매크로 히트맵 (react-simple-maps)
 * [하단] Dual Y-Axis 비교 분석기 — Rolling 36개월 동적 시스템
 *
 * ◆ Rolling Window 방식
 *   전체 데이터: 2022-01 ~ 2027-12 (72개월) 배열로 사전 내장
 *   차트 바인딩: 오늘 날짜 기준으로 최근 N개월(24/36)만 slice
 *   → 몇 달 뒤 앱을 열어도 코드 수정 없이 최신 36개월이 자동 표시
 */

import { useState, useMemo, useCallback } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from 'recharts'

// ═══════════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const D = {
  bg:      '#020617',
  surface: '#06101f',
  card:    '#0a1929',
  border:  '#0f2a45',
  neon:    '#deff9a',
  blue:    '#38bdf8',
  indigo:  '#818cf8',
  gold:    '#fbbf24',
  red:     '#f87171',
  orange:  '#fb923c',
  muted:   '#1e3a5c',
  text:    '#e2e8f0',
  sub:     '#64748b',
} as const

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ═══════════════════════════════════════════════════════════════
//  MACRO HEATMAP DATA (주요 15개국, 2026년 기준)
// ═══════════════════════════════════════════════════════════════
interface CountryData {
  name: string; nameKo: string
  cpi: number; debt: number; unemployment: number; rate: number; iso3: string
}
const COUNTRIES: Record<string, CountryData> = {
  '840': { name:'United States', nameKo:'미국',    cpi:2.8,  debt:122, unemployment:4.1, rate:4.33, iso3:'840' },
  '410': { name:'South Korea',   nameKo:'한국',    cpi:2.2,  debt:55,  unemployment:3.0, rate:3.50, iso3:'410' },
  '392': { name:'Japan',         nameKo:'일본',    cpi:2.9,  debt:263, unemployment:2.4, rate:0.50, iso3:'392' },
  '156': { name:'China',         nameKo:'중국',    cpi:0.1,  debt:56,  unemployment:5.0, rate:3.10, iso3:'156' },
  '276': { name:'Germany',       nameKo:'독일',    cpi:2.1,  debt:65,  unemployment:3.4, rate:2.65, iso3:'276' },
  '826': { name:'United Kingdom',nameKo:'영국',    cpi:2.8,  debt:103, unemployment:4.4, rate:4.50, iso3:'826' },
  '250': { name:'France',        nameKo:'프랑스',  cpi:1.8,  debt:114, unemployment:7.3, rate:2.65, iso3:'250' },
  '356': { name:'India',         nameKo:'인도',    cpi:4.6,  debt:85,  unemployment:7.8, rate:6.25, iso3:'356' },
  '76' : { name:'Brazil',        nameKo:'브라질',  cpi:4.8,  debt:92,  unemployment:7.5, rate:13.25,iso3:'76'  },
  '36' : { name:'Australia',     nameKo:'호주',    cpi:2.9,  debt:47,  unemployment:4.0, rate:4.10, iso3:'36'  },
  '124': { name:'Canada',        nameKo:'캐나다',  cpi:2.3,  debt:110, unemployment:6.5, rate:2.75, iso3:'124' },
  '643': { name:'Russia',        nameKo:'러시아',  cpi:9.1,  debt:20,  unemployment:3.1, rate:21.0, iso3:'643' },
  '792': { name:'Turkey',        nameKo:'터키',    cpi:38.0, debt:32,  unemployment:8.4, rate:42.5, iso3:'792' },
  '682': { name:'Saudi Arabia',  nameKo:'사우디',  cpi:1.9,  debt:26,  unemployment:5.8, rate:5.00, iso3:'682' },
  '710': { name:'South Africa',  nameKo:'남아공',  cpi:4.8,  debt:76,  unemployment:33.5,rate:7.75, iso3:'710' },
}

// ═══════════════════════════════════════════════════════════════
//  FULL TIME-SERIES DATA — 2022-01 ~ 2027-12 (72개월)
//
//  Rolling Window 시스템:
//  ┌─────────────────────────────────────────────┐
//  │ 전체 배열: 2022.01 ──────────────── 2027.12 │
//  │                        ↑         ↑          │
//  │              오늘 기준  start─────end        │
//  │                        ←── 36개월 ──→        │
//  └─────────────────────────────────────────────┘
//  앱을 열 때마다 오늘 날짜를 기준으로 slice 자동 재계산
// ═══════════════════════════════════════════════════════════════

/** 시작 월부터 n개월 배열 생성 (형식: "YYYY.MM") */
const genMonths = (start: string, n: number): string[] => {
  const [sy, sm] = start.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(sy, sm - 1 + i)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

// 72개월 전체 타임라인 (2022-01 ~ 2027-12)
const ALL_MONTHS = genMonths('2022-01', 72)

// ── 미국 기준금리 (Fed Funds Rate %) ──────────────────────────
// 2022: 제로금리→급격한 인상(0.08%→4.33%)
// 2023: 고금리 유지(5.33%)
// 2024: 고점 유지 후 9월부터 소폭 인하
// 2025: 점진적 인하(4.33%→3.75%)
// 2026: 추가 인하(3.50%→2.50%) — 경기 둔화 대응
// 2027: 중립금리 수렴(2.00%) — 예측치
const US_RATE_ALL = [
  // 2022
  0.08, 0.08, 0.20, 0.33, 0.77, 1.21, 1.68, 2.33, 3.08, 3.78, 4.10, 4.33,
  // 2023
  4.58, 4.83, 4.83, 5.08, 5.08, 5.08, 5.33, 5.33, 5.33, 5.33, 5.33, 5.33,
  // 2024
  5.33, 5.33, 5.33, 5.33, 5.33, 5.33, 5.08, 4.83, 4.58, 4.58, 4.33, 4.33,
  // 2025
  4.33, 4.33, 4.33, 4.25, 4.25, 4.00, 4.00, 4.00, 3.75, 3.75, 3.75, 3.75,
  // 2026
  3.50, 3.50, 3.50, 3.25, 3.25, 3.00, 3.00, 2.75, 2.75, 2.75, 2.50, 2.50,
  // 2027 (예측)
  2.50, 2.25, 2.25, 2.25, 2.00, 2.00, 2.00, 2.00, 2.00, 2.00, 2.00, 2.00,
]

// ── NVDA 주가 (USD, 2024.06 10:1 분할 소급 기준) ─────────────
// 2022: 하락장 -47%
// 2023: ChatGPT AI 붐 반등 +240%
// 2024: H100→H200 사이클, ATH 행진
// 2025: DeepSeek 쇼크(1~2월) 후 회복, Blackwell 수요 폭발
// 2026: 관세 쇼크(4월) → 90일 유예 반등, AI 수요 지속
// 2027: AI 인프라 2.0 사이클 진입 (예측)
const NVDA_ALL = [
  // 2022
  24.0, 24.5, 21.0, 20.0, 17.5, 14.5, 16.5, 17.0, 12.8, 13.2, 14.0, 14.6,
  // 2023
  15.0, 21.0, 28.0, 32.0, 41.0, 43.0, 49.0, 50.0, 43.5, 43.5, 49.5, 49.5,
  // 2024
  61.0, 67.0, 82.0, 76.0, 94.0, 135.0, 117.0, 109.0, 116.0, 140.0, 148.0, 134.0,
  // 2025
  125.0, 108.0, 109.0, 86.0, 106.0, 131.0, 141.0, 118.0, 120.0, 136.0, 145.0, 134.0,
  // 2026
  128.0, 117.0, 112.0, 88.0, 114.0, 128.0, 138.0, 145.0, 134.0, 128.0, 142.0, 156.0,
  // 2027 (예측)
  165.0, 160.0, 178.0, 185.0, 172.0, 180.0, 188.0, 196.0, 190.0, 202.0, 218.0, 230.0,
]

// ── PLTR 주가 (USD) ────────────────────────────────────────────
// 2022: 성장주 폭락 -41%
// 2023: 저점 회복
// 2024: 트럼프 당선 + S&P500 편입 + AI 정부계약 → 연말 급등
// 2025: 분기 흑자 지속, 방산 AI 수혜 극대화
// 2026: 관세 조정 후 반등, 정부 AI 지출 증가
// 2027: AI 기업 소프트웨어 플랫폼 수혜 (예측)
const PLTR_ALL = [
  // 2022
  13.5, 12.8, 11.2, 10.4,  9.1,  8.2,  9.4,  9.8,  8.1,  7.2,  7.8,  8.0,
  // 2023
   9.0, 11.2, 13.0, 14.5, 15.2, 14.8, 14.2, 15.0, 16.5, 17.2, 18.0, 17.0,
  // 2024
  18.5, 19.8, 21.0, 22.5, 24.0, 26.5, 28.0, 25.0, 32.0, 45.0, 65.0, 82.0,
  // 2025
  82.0, 92.0, 88.0, 90.0, 122.0, 132.0, 138.0, 122.0, 112.0, 128.0, 158.0, 168.0,
  // 2026
  158.0, 135.0, 110.0, 86.0, 118.0, 130.0, 138.0, 145.0, 132.0, 128.0, 142.0, 155.0,
  // 2027 (예측)
  165.0, 162.0, 178.0, 188.0, 175.0, 182.0, 192.0, 202.0, 195.0, 210.0, 225.0, 238.0,
]

// ── 한국 CPI (YoY %) ──────────────────────────────────────────
// 2022: 에너지·공급망 충격 고물가(최고 6.3%)
// 2023: 금리 효과, 물가 둔화
// 2024: 2% 목표 수렴
// 2025: 안정(1.7~2.5%)
// 2026: 글로벌 관세 영향 소폭 반등
// 2027: 안정 기조 유지 (예측)
const KR_CPI_ALL = [
  // 2022
  3.6, 3.7, 4.1, 4.8, 5.4, 6.0, 6.3, 5.7, 5.6, 5.7, 5.0, 5.0,
  // 2023
  5.2, 4.8, 4.2, 3.7, 3.3, 2.7, 2.3, 2.0, 1.9, 1.8, 3.4, 3.2,
  // 2024
  2.8, 2.9, 3.1, 3.0, 2.7, 2.6, 2.5, 2.4, 2.0, 1.3, 1.5, 1.6,
  // 2025
  1.7, 2.0, 2.2, 2.3, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 2.0,
  // 2026
  2.1, 2.2, 2.3, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 1.9, 1.8, 1.8,
  // 2027 (예측)
  1.9, 2.0, 2.1, 2.2, 2.3, 2.2, 2.1, 2.0, 1.9, 1.9, 1.8, 1.8,
]

// ── 포트폴리오 배당수익률 (%, 점진적 상승) ─────────────────────
const PORT_DIV_ALL = [
  // 2022
  1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.4, 1.3, 1.3, 1.4, 1.4, 1.5,
  // 2023
  1.5, 1.6, 1.6, 1.7, 1.7, 1.8, 1.8, 1.8, 1.9, 1.9, 2.0, 2.0,
  // 2024
  2.1, 2.1, 2.2, 2.2, 2.3, 2.3, 2.4, 2.4, 2.5, 2.5, 2.6, 2.6,
  // 2025
  2.7, 2.7, 2.8, 2.8, 2.9, 2.9, 3.0, 3.0, 3.1, 3.1, 3.2, 3.2,
  // 2026
  3.3, 3.3, 3.4, 3.4, 3.5, 3.5, 3.6, 3.6, 3.7, 3.7, 3.8, 3.8,
  // 2027 (예측)
  3.9, 3.9, 4.0, 4.0, 4.1, 4.1, 4.2, 4.2, 4.3, 4.3, 4.4, 4.4,
]

// ═══════════════════════════════════════════════════════════════
//  ROLLING WINDOW 유틸 — 오늘 기준 endIdx 자동 계산
// ═══════════════════════════════════════════════════════════════

/** 오늘 날짜 → ALL_MONTHS 내 가장 가까운(≤ 오늘) 인덱스 반환 */
function getTodayIdx(): number {
  const today   = new Date()
  const yearStr = today.getFullYear()
  const monStr  = String(today.getMonth() + 1).padStart(2, '0')
  const key     = `${yearStr}.${monStr}`
  const idx     = ALL_MONTHS.findIndex(m => m === key)
  // 데이터 범위를 벗어난 미래 날짜면 마지막 인덱스 반환
  if (idx < 0) return ALL_MONTHS.length - 1
  return idx
}

// ═══════════════════════════════════════════════════════════════
//  HEATMAP 색상 헬퍼
// ═══════════════════════════════════════════════════════════════
const INDICATORS = [
  { key:'cpi',          label:'물가상승률 (CPI)', unit:'%', low:2,  high:5,   max:70  },
  { key:'debt',         label:'정부부채 비율',    unit:'%', low:60, high:120, max:270 },
  { key:'unemployment', label:'실업률',           unit:'%', low:4,  high:8,   max:35  },
  { key:'rate',         label:'기준금리',         unit:'%', low:2,  high:5,   max:50  },
] as const
type IndicatorKey = typeof INDICATORS[number]['key']

function indicatorColor(value: number, low: number, high: number): string {
  if (value <= low * 0.8)  return '#2d6a4f'
  if (value <= low)        return '#52b788'
  if (value <= low * 1.1)  return D.neon
  if (value <= high)       return D.gold
  if (value <= high * 1.5) return D.orange
  return D.red
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 1: MACRO HEATMAP (변경 없음)
// ═══════════════════════════════════════════════════════════════
function MacroHeatmap() {
  const [indicator, setIndicator] = useState<IndicatorKey>('cpi')
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [tooltip,   setTooltip]   = useState<{ x: number; y: number } | null>(null)

  const indCfg = INDICATORS.find(i => i.key === indicator)!

  const getColor = useCallback((geoId: string) => {
    const c = COUNTRIES[geoId]
    if (!c) return D.muted
    return indicatorColor(c[indicator as keyof CountryData] as number, indCfg.low, indCfg.high)
  }, [indicator, indCfg])

  const hovCtr = hovered ? COUNTRIES[hovered] : null

  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 18, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.neon, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>🌍 Global Macro Heatmap</div>
          <div style={{ fontSize: 12, color: D.sub, marginTop: 3 }}>주요국 거시경제 지표 비교 (2026년 기준)</div>
        </div>
        {/* 지표 토글 */}
        <div style={{ display: 'flex', background: D.card, borderRadius: 10, padding: 3, gap: 2 }}>
          {INDICATORS.map(ind => (
            <button key={ind.key} onClick={() => setIndicator(ind.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const,
              background: indicator === ind.key ? D.neon : 'transparent',
              color:      indicator === ind.key ? '#020617' : D.sub,
              transition: 'all 0.18s',
            }}>{ind.label}</button>
          ))}
        </div>
      </div>

      {/* 지도 */}
      <div style={{ position: 'relative', padding: '0 12px 12px' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 130, center: [10, 20] }}
          style={{ background: 'transparent', width: '100%', height: 310 }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              geographies.map((geo: any) => {
                const gid    = String(geo.id)
                const active = !!COUNTRIES[gid]
                const col    = active ? getColor(gid) : '#0d1f35'
                const isHov  = hovered === gid
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isHov ? '#ffffff' : col}
                    stroke={D.border}
                    strokeWidth={0.4}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.2s' },
                      hover:   { outline: 'none', fill: active ? '#ffffff' : '#0d1f35', cursor: active ? 'pointer' : 'default' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                      if (!active) return
                      setHovered(gid)
                      setTooltip({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseMove={(e: React.MouseEvent<SVGPathElement>) => {
                      if (!active) return
                      setTooltip({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseLeave={() => { setHovered(null); setTooltip(null) }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {/* 툴팁 */}
        {hovCtr && tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
            zIndex: 9999, pointerEvents: 'none', background: D.card,
            border: `1px solid ${D.neon}44`, borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)', minWidth: 160,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: D.text, marginBottom: 6 }}>{hovCtr.nameKo}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 11, color: D.sub }}>{indCfg.label}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: getColor(hovered!), fontVariantNumeric: 'tabular-nums' }}>
                {(hovCtr[indicator as keyof CountryData] as number).toFixed(1)}{indCfg.unit}
              </span>
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${D.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {INDICATORS.filter(i => i.key !== indicator).map(i => (
                <div key={i.key} style={{ fontSize: 9, color: D.sub }}>
                  {i.label.split(' ')[0]}: <span style={{ color: D.text }}>{(hovCtr[i.key as keyof CountryData] as number).toFixed(1)}{i.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 범례 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {[['#2d6a4f','매우 안정'],['#52b788','안정'],[D.neon,'적정'],[D.gold,'주의'],[D.orange,'경고'],[D.red,'위험']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: D.sub }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: c }}/>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* 국가 수치 카드 */}
      <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
          {Object.values(COUNTRIES)
            .sort((a, b) => (a[indicator as keyof CountryData] as number) - (b[indicator as keyof CountryData] as number))
            .map(c => {
              const val = c[indicator as keyof CountryData] as number
              const col = indicatorColor(val, indCfg.low, indCfg.high)
              return (
                <div key={c.iso3} style={{ background: D.card, border: `1px solid ${col}33`, borderRadius: 8, padding: '7px 10px', minWidth: 80, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: D.sub, marginBottom: 3 }}>{c.nameKo}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: col, fontVariantNumeric: 'tabular-nums' }}>
                    {val.toFixed(1)}{indCfg.unit}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 2: COMPARE CHART — Rolling Window 시스템
// ═══════════════════════════════════════════════════════════════

type PresetKey = 'rate_vs_nvda' | 'cpi_vs_div' | 'nvda_vs_pltr'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, leftLabel, rightLabel, leftUnit, rightUnit, leftColor, rightColor }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 190, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <div style={{ fontSize: 11, color: D.sub, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      {payload.map((entry: { dataKey: string; value: number }, i: number) => {
        const isLeft = entry.dataKey === 'left'
        const col    = isLeft ? leftColor  : rightColor
        const lbl    = isLeft ? leftLabel  : rightLabel
        const unit   = isLeft ? leftUnit   : rightUnit
        if (entry.value == null) return null
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: col, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: 'inline-block' }}/>
              {lbl}
            </span>
            <span style={{ fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums', fontSize: 13, marginLeft: 16 }}>
              {entry.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{unit}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CompareChart() {
  const [preset,     setPreset]     = useState<PresetKey>('rate_vs_nvda')
  const [windowSize, setWindowSize] = useState<24 | 36>(36)

  // ── Rolling Window 핵심 로직 ─────────────────────────────────
  const { months, dataStart, dataEnd, presets } = useMemo(() => {
    const endIdx   = getTodayIdx()
    const startIdx = Math.max(0, endIdx - windowSize + 1)

    const months   = ALL_MONTHS.slice(startIdx, endIdx + 1)
    const us_rate  = US_RATE_ALL.slice(startIdx, endIdx + 1)
    const nvda     = NVDA_ALL.slice(startIdx, endIdx + 1)
    const pltr     = PLTR_ALL.slice(startIdx, endIdx + 1)
    const kr_cpi   = KR_CPI_ALL.slice(startIdx, endIdx + 1)
    const port_div = PORT_DIV_ALL.slice(startIdx, endIdx + 1)

    const presets = {
      rate_vs_nvda: {
        label: '금리 vs 기술주', icon: '📈',
        desc: '미국 기준금리(%) vs NVDA 주가(분할 조정)',
        left:  { label: '미국 기준금리', color: D.indigo, data: us_rate,  unit: '%', yDomain: [0, 6]    },
        right: { label: 'NVDA ($)',      color: D.neon,   data: nvda,    unit: '$', yDomain: [10, 250] },
      },
      cpi_vs_div: {
        label: '인플레 vs 배당', icon: '💰',
        desc: '한국 CPI(%) vs 포트폴리오 배당수익률(%)',
        left:  { label: '한국 CPI',        color: D.orange, data: kr_cpi,   unit: '%', yDomain: [0, 8] },
        right: { label: '포트폴리오 배당', color: D.neon,   data: port_div, unit: '%', yDomain: [0, 5] },
      },
      nvda_vs_pltr: {
        label: 'AI 주도주 대결', icon: '⚡',
        desc: `NVDA vs PLTR — 기준 ${months[0]} = 0% 누적수익률`,
        left:  {
          label: 'NVDA 누적수익률', color: D.neon,
          data:  nvda.map(v => parseFloat(((v / nvda[0] - 1) * 100).toFixed(1))),
          unit: '%', yDomain: [-70, 500],
        },
        right: {
          label: 'PLTR 누적수익률', color: D.blue,
          data:  pltr.map(v => parseFloat(((v / pltr[0] - 1) * 100).toFixed(1))),
          unit: '%', yDomain: [-70, 900],
        },
      },
    }

    return {
      months,
      dataStart: months[0] ?? '',
      dataEnd:   months[months.length - 1] ?? '',
      presets,
    }
  }, [windowSize])  // eslint-disable-line react-hooks/exhaustive-deps

  const p = presets[preset]

  // 차트 데이터 빌드
  const chartData = useMemo(() =>
    months.map((m, i) => ({
      month: m,
      left:  p.left.data[i]  ?? null,
      right: p.right.data[i] ?? null,
    }))
  , [months, preset])  // eslint-disable-line react-hooks/exhaustive-deps

  const xTicks = months.filter((_, i) => i % (windowSize === 24 ? 2 : 3) === 0)

  // 교육 인사이트
  const insights: Record<PresetKey, { title: string; text: string }> = {
    rate_vs_nvda: {
      title: '📚 투자 인사이트',
      text: `기준 기간(${dataStart}~${dataEnd}) 중, 미국 금리가 고점을 찍고 인하로 전환하는 사이클에서도 NVDA는 AI 수요 모멘텀으로 시장 기대를 압도했습니다. Blackwell GPU 수요와 데이터센터 투자가 금리 역풍을 상쇄한 사례를 관찰해보세요.`,
    },
    cpi_vs_div: {
      title: '📚 투자 인사이트',
      text: `인플레이션(CPI)이 안정화될수록 배당의 실질 가치가 회복됩니다. 선택된 기간 동안 한국 CPI의 하향 안정화와 함께 포트폴리오 배당수익률이 꾸준히 상승하는 추세를 확인해보세요. 배당성장 투자의 핵심 원리입니다.`,
    },
    nvda_vs_pltr: {
      title: '📚 투자 인사이트',
      text: `AI 인프라(NVDA)와 AI 응용(PLTR)의 성과를 비교합니다. NVDA는 반도체 공급망을, PLTR은 데이터 분석·방산 AI 플랫폼을 대표합니다. 선택된 ${windowSize}개월 동안 두 자산의 변동성과 상관관계를 분석해보세요.`,
    },
  }

  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 18, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.neon, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
            ⚡ Valkyrie Compare Analytics
          </div>
          <div style={{ fontSize: 12, color: D.sub, marginTop: 3 }}>
            듀얼 Y축 비교 분석 · {dataStart} ~ {dataEnd}
          </div>
        </div>

        {/* 프리셋 버튼 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.entries(presets) as [PresetKey, typeof presets[PresetKey]][]).map(([key, val]) => (
            <button key={key} onClick={() => setPreset(key)} style={{
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              border:      `1px solid ${preset === key ? D.neon + '66' : D.border}`,
              background:  preset === key ? `${D.neon}18` : 'transparent',
              color:       preset === key ? D.neon : D.sub,
              transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{val.icon}</span><span>{val.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 서브헤더: 설명 + Rolling Window 토글 */}
      <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: D.sub }}>{p.desc}</span>
          {/* 데이터 범례 */}
          {(['left', 'right'] as const).map(side => (
            <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 16, height: 2, background: p[side].color, borderRadius: 1 }}/>
              <span style={{ color: p[side].color }}>{p[side].label}</span>
            </div>
          ))}
        </div>

        {/* 🔑 Rolling Window 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: D.sub, fontWeight: 600 }}>기간</span>
          <div style={{ display: 'flex', background: D.card, borderRadius: 8, padding: 2, gap: 2 }}>
            {([24, 36] as const).map(w => (
              <button key={w} onClick={() => setWindowSize(w)} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 10, fontWeight: 700,
                background: windowSize === w ? D.neon : 'transparent',
                color:      windowSize === w ? '#020617' : D.sub,
                transition: 'all 0.18s',
              }}>{w}개월</button>
            ))}
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div style={{ padding: '0 8px 12px' }}>
        {chartData.length < 2 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.sub }}>
            데이터 로딩 중…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={chartData} margin={{ top: 12, right: 60, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="lgLeft" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={p.left.color}  stopOpacity={0.28}/>
                  <stop offset="100%" stopColor={p.left.color}  stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="lgRight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={p.right.color} stopOpacity={0.22}/>
                  <stop offset="100%" stopColor={p.right.color} stopOpacity={0.02}/>
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="2 4" stroke="#0d1f35" vertical={false}/>
              <XAxis
                dataKey="month"
                ticks={xTicks}
                tick={{ fill: '#374151', fontSize: 9, fontWeight: 500 }}
                axisLine={{ stroke: '#0d1f35' }} tickLine={false}
                interval={0}
              />
              {/* 좌측 Y축 */}
              <YAxis
                yAxisId="left"
                domain={[...p.left.yDomain]}
                tick={{ fill: p.left.color, fontSize: 9 }}
                axisLine={false} tickLine={false} width={46}
                tickFormatter={v => `${v}${p.left.unit}`}
              />
              {/* 우측 Y축 */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[...p.right.yDomain]}
                tick={{ fill: p.right.color, fontSize: 9 }}
                axisLine={false} tickLine={false} width={52}
                tickFormatter={v => `${v.toLocaleString('en-US')}${p.right.unit}`}
              />

              {/* 누적수익률 모드 기준선 */}
              {preset === 'nvda_vs_pltr' && (
                <ReferenceLine yAxisId="left" y={0} stroke={D.border} strokeWidth={1} strokeDasharray="4 2"/>
              )}

              <Tooltip
                content={
                  <ChartTooltip
                    leftLabel={p.left.label}   rightLabel={p.right.label}
                    leftUnit={p.left.unit}      rightUnit={p.right.unit}
                    leftColor={p.left.color}    rightColor={p.right.color}
                  />
                }
                cursor={{ stroke: D.border, strokeWidth: 1, strokeDasharray: '4 2' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: D.sub, paddingTop: 8 }}
                formatter={(value: string) => {
                  const isLeft = value === 'left'
                  return <span style={{ color: isLeft ? p.left.color : p.right.color, fontWeight: 600 }}>
                    {isLeft ? p.left.label : p.right.label}
                  </span>
                }}
              />

              {/* 왼쪽 — Area */}
              <Area
                yAxisId="left" type="monotone" dataKey="left" name="left"
                stroke={p.left.color} strokeWidth={2}
                fill="url(#lgLeft)" dot={false}
                activeDot={{ r: 4, fill: p.left.color, stroke: D.surface, strokeWidth: 2 }}
                isAnimationActive={true} animationDuration={600}
              />
              {/* 오른쪽 — Line */}
              <Line
                yAxisId="right" type="monotone" dataKey="right" name="right"
                stroke={p.right.color} strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: p.right.color, stroke: D.surface, strokeWidth: 2 }}
                isAnimationActive={true} animationDuration={800}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 교육 인사이트 */}
      <div style={{ margin: '0 16px 16px', background: `${D.neon}08`, border: `1px solid ${D.neon}1e`, borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: D.neon, marginBottom: 6 }}>
          {insights[preset].title}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          {insights[preset].text}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MacroHubPage() {
  // 오늘 날짜 기준 rolling window 정보 (헤더용)
  const { displayStart, displayEnd, totalMonths } = useMemo(() => {
    const endIdx   = getTodayIdx()
    const startIdx = Math.max(0, endIdx - 36 + 1)
    return {
      displayStart: ALL_MONTHS[startIdx]  ?? '',
      displayEnd:   ALL_MONTHS[endIdx]    ?? '',
      totalMonths:  endIdx - startIdx + 1,
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: D.bg, color: D.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '20px', boxSizing: 'border-box',
    }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: D.neon, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            🌐 MACRO HUB
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
            글로벌 매크로 분석
          </h1>
          <p style={{ fontSize: 12, color: D.sub, margin: '4px 0 0' }}>
            탑다운(Top-down) 투자 · 거시경제 지표 · 자산 비교 분석
          </p>
        </div>
        <div style={{ fontSize: 10, color: D.muted, textAlign: 'right' as const }}>
          <div style={{ color: D.neon, fontWeight: 700, marginBottom: 2 }}>
            ⏱ Rolling {totalMonths}개월 Window
          </div>
          <div>시계열: {displayStart} – {displayEnd}</div>
          <div style={{ marginTop: 2, color: '#1e3a5c' }}>
            전체 DB: {ALL_MONTHS[0]} ~ {ALL_MONTHS[ALL_MONTHS.length - 1]} (72개월)
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <MacroHeatmap />
        <CompareChart />
      </div>
    </div>
  )
}
