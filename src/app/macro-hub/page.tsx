'use client'

/**
 * /macro-hub — 발키리 글로벌 매크로 허브
 *
 * [상단] 글로벌 매크로 히트맵 (react-simple-maps + mock data)
 * [하단] Dual Y-Axis 비교 분석기 (3가지 교육 프리셋)
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

// TopoJSON from CDN (world-atlas 110m)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ═══════════════════════════════════════════════════════════════
//  MACRO MOCK DATA — 주요 10개국 (2024년 기준)
// ═══════════════════════════════════════════════════════════════
interface CountryData {
  name: string; nameKo: string
  cpi: number        // 물가상승률 %
  debt: number       // 정부부채/GDP %
  unemployment: number // 실업률 %
  rate: number       // 기준금리 %
  iso3: string       // ISO 3166-1 numeric (TopoJSON ID)
}

const COUNTRIES: Record<string, CountryData> = {
  '840': { name:'United States', nameKo:'미국',      cpi:3.4,  debt:120, unemployment:3.9, rate:5.50, iso3:'840' },
  '410': { name:'South Korea',   nameKo:'한국',      cpi:2.8,  debt:54,  unemployment:2.9, rate:3.50, iso3:'410' },
  '392': { name:'Japan',         nameKo:'일본',      cpi:2.7,  debt:260, unemployment:2.5, rate:0.10, iso3:'392' },
  '156': { name:'China',         nameKo:'중국',      cpi:0.2,  debt:51,  unemployment:5.2, rate:3.45, iso3:'156' },
  '276': { name:'Germany',       nameKo:'독일',      cpi:2.2,  debt:66,  unemployment:3.0, rate:4.50, iso3:'276' },
  '826': { name:'United Kingdom',nameKo:'영국',      cpi:3.2,  debt:101, unemployment:4.2, rate:5.25, iso3:'826' },
  '250': { name:'France',        nameKo:'프랑스',    cpi:2.4,  debt:112, unemployment:7.5, rate:4.50, iso3:'250' },
  '356': { name:'India',         nameKo:'인도',      cpi:5.1,  debt:83,  unemployment:7.9, rate:6.50, iso3:'356' },
  '76' : { name:'Brazil',        nameKo:'브라질',    cpi:4.5,  debt:89,  unemployment:7.8, rate:10.50,iso3:'76'  },
  '36' : { name:'Australia',     nameKo:'호주',      cpi:3.6,  debt:46,  unemployment:3.8, rate:4.35, iso3:'36'  },
  '124': { name:'Canada',        nameKo:'캐나다',    cpi:2.9,  debt:108, unemployment:6.1, rate:5.00, iso3:'124' },
  '643': { name:'Russia',        nameKo:'러시아',    cpi:7.4,  debt:21,  unemployment:3.2, rate:16.0, iso3:'643' },
  '792': { name:'Turkey',        nameKo:'터키',      cpi:65.0, debt:36,  unemployment:8.8, rate:50.0, iso3:'792' },
  '682': { name:'Saudi Arabia',  nameKo:'사우디',    cpi:1.6,  debt:23,  unemployment:5.9, rate:6.00, iso3:'682' },
  '710': { name:'South Africa',  nameKo:'남아공',    cpi:5.6,  debt:74,  unemployment:32.1,rate:8.25, iso3:'710' },
}

// ═══════════════════════════════════════════════════════════════
//  TIME-SERIES MOCK DATA (2022-01 ~ 2026-05) — 53개월
//  ※ NVDA 가격은 2024.06 10:1 분할 기준 소급 수정 적용
// ═══════════════════════════════════════════════════════════════
const genMonths = (start: string, n: number) => {
  const result: string[] = []
  const [sy, sm] = start.split('-').map(Number)
  for (let i = 0; i < n; i++) {
    const d = new Date(sy, sm - 1 + i)
    result.push(`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return result
}
const MONTHS = genMonths('2022-01', 53)  // 53개월 (2022.01 ~ 2026.05)
const DATA_START = MONTHS[0]
const DATA_END   = MONTHS[MONTHS.length - 1]

// ── 미국 기준금리 (Fed Funds Rate %)
// 2022: 제로금리 → 급격한 인상
// 2023: 5.33% 고점 도달 및 유지
// 2024: 고점 유지 → 9월부터 소폭 인하 시작
// 2025: 점진적 인하 지속 (4.33% → 3.75%)
// 2026: 추가 인하 모멘텀 (3.50% → 3.25%)
const US_RATE = [
  // 2022 (12)
  0.08, 0.08, 0.20, 0.33, 0.77, 1.21, 1.68, 2.33, 3.08, 3.78, 4.10, 4.33,
  // 2023 (12)
  4.58, 4.83, 4.83, 5.08, 5.08, 5.08, 5.33, 5.33, 5.33, 5.33, 5.33, 5.33,
  // 2024 (12)
  5.33, 5.33, 5.33, 5.33, 5.33, 5.33, 5.08, 4.83, 4.58, 4.58, 4.33, 4.33,
  // 2025 (12) — 점진적 인하
  4.33, 4.33, 4.33, 4.25, 4.25, 4.00, 4.00, 4.00, 3.75, 3.75, 3.75, 3.75,
  // 2026 (5) — 추가 인하
  3.50, 3.50, 3.50, 3.25, 3.25,
]

// ── NVDA 주가 (USD, 10:1 분할 소급 적용 기준)
// 2022: 고점에서 -60% 폭락
// 2023: AI 붐 반등, ChatGPT 효과
// 2024: 사상 최고치 행진 (분할 전 ~$135 = 분할 후 $13.5)
// 2025: DeepSeek 쇼크 후 회복, AI 수요 지속
// 2026: 관세 우려 → 조정 → 90일 유예 후 반등
const NVDA = [
  // 2022 (12)
  24.0, 24.5, 21.0, 20.0, 17.5, 14.5, 16.5, 17.0, 12.8, 13.2, 14.0, 14.6,
  // 2023 (12)
  15.0, 21.0, 28.0, 32.0, 41.0, 43.0, 49.0, 50.0, 43.5, 43.5, 49.5, 49.5,
  // 2024 (12) — 분할 완료 후 가격 기준 ($, 분할 소급)
  61.0, 67.0, 82.0, 76.0, 94.0, 135.0, 117.0, 109.0, 116.0, 140.0, 148.0, 134.0,
  // 2025 (12) — DeepSeek 쇼크(1월), 회복 후 랠리
  129.0, 108.0, 110.0, 86.0, 106.0, 131.0, 138.0, 116.0, 121.0, 136.0, 145.0, 134.0,
  // 2026 (5) — 관세 우려 조정 → 반등
  128.0, 118.0, 112.0, 88.0, 114.0,
]

// ── PLTR 주가 (USD)
// 2022: 성장주 폭락
// 2023: 저점 반등
// 2024: 연말 급등 (트럼프 당선 + AI 정부계약)
// 2025: 강력한 우상향, 분기 흑자 지속
// 2026: 관세 우려 조정 → 회복
const PLTR = [
  // 2022 (12)
  13.5, 12.8, 11.2, 10.4,  9.1,  8.2,  9.4,  9.8,  8.1,  7.2,  7.8,  8.0,
  // 2023 (12)
   9.0, 11.2, 13.0, 14.5, 15.2, 14.8, 14.2, 15.0, 16.5, 17.2, 18.0, 17.0,
  // 2024 (12) — 연말 급등
  18.5, 19.8, 21.0, 22.5, 24.0, 26.5, 28.0, 25.0, 32.0, 45.0, 65.0, 82.0,
  // 2025 (12) — 지속 상승, S&P500 편입 효과
  82.0, 92.0, 86.0, 88.0, 120.0, 130.0, 132.0, 118.0, 108.0, 125.0, 155.0, 165.0,
  // 2026 (5) — 관세 조정 → 반등
  155.0, 132.0, 108.0, 85.0, 115.0,
]

// ── 한국 CPI (YoY %)
// 2022: 고물가 (최고 6.3%)
// 2023: 둔화 시작
// 2024: 목표치 2% 수렴
// 2025: 안정적 유지
// 2026: 소폭 반등 (글로벌 관세 영향)
const KR_CPI = [
  // 2022 (12)
  3.6, 3.7, 4.1, 4.8, 5.4, 6.0, 6.3, 5.7, 5.6, 5.7, 5.0, 5.0,
  // 2023 (12)
  5.2, 4.8, 4.2, 3.7, 3.3, 2.7, 2.3, 2.0, 1.9, 1.8, 3.4, 3.2,
  // 2024 (12)
  2.8, 2.9, 3.1, 3.0, 2.7, 2.6, 2.5, 2.4, 2.0, 1.3, 1.5, 1.6,
  // 2025 (12)
  1.7, 2.0, 2.2, 2.3, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 2.0,
  // 2026 (5)
  2.1, 2.2, 2.3, 2.4, 2.3,
]

// ── 포트폴리오 배당수익률 (%) — 점진적 상승
const PORTFOLIO_DIV = [
  // 2022 (12)
  1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.4, 1.3, 1.3, 1.4, 1.4, 1.5,
  // 2023 (12)
  1.5, 1.6, 1.6, 1.7, 1.7, 1.8, 1.8, 1.8, 1.9, 1.9, 2.0, 2.0,
  // 2024 (12)
  2.1, 2.1, 2.2, 2.2, 2.3, 2.3, 2.4, 2.4, 2.5, 2.5, 2.6, 2.6,
  // 2025 (12)
  2.7, 2.7, 2.8, 2.8, 2.9, 2.9, 3.0, 3.0, 3.1, 3.1, 3.2, 3.2,
  // 2026 (5)
  3.3, 3.3, 3.4, 3.4, 3.5,
]

// 프리셋별 시계열 조합
const PRESETS = {
  rate_vs_nvda: {
    label: '금리 vs 기술주',
    icon: '📈',
    desc: '미국 기준금리 vs NVDA 주가 (분할 조정)',
    left:  { key:'rate', label:'미국 기준금리 (%)', color:D.indigo, data:US_RATE, unit:'%', yDomain:[0,6]    },
    right: { key:'nvda', label:'NVDA ($)',           color:D.neon,   data:NVDA,   unit:'$', yDomain:[10,160] },
  },
  cpi_vs_div: {
    label: '인플레 vs 배당',
    icon: '💰',
    desc: '한국 CPI vs 포트폴리오 배당수익률',
    left:  { key:'cpi', label:'한국 CPI (%)',        color:D.orange, data:KR_CPI,        unit:'%', yDomain:[0,8] },
    right: { key:'div', label:'포트폴리오 배당 (%)', color:D.neon,   data:PORTFOLIO_DIV, unit:'%', yDomain:[0,5] },
  },
  nvda_vs_pltr: {
    label: 'AI 주도주 대결',
    icon: '⚡',
    desc: 'NVDA vs PLTR 누적 수익률 (2022.01 = 0% 기준)',
    left:  { key:'nvda_ret', label:'NVDA 누적수익률', color:D.neon,  data:NVDA.map(v=>parseFloat(((v/NVDA[0]-1)*100).toFixed(1))),  unit:'%', yDomain:[-60,450] },
    right: { key:'pltr_ret', label:'PLTR 누적수익률', color:D.blue,  data:PLTR.map(v=>parseFloat(((v/PLTR[0]-1)*100).toFixed(1))),  unit:'%', yDomain:[-60,800] },
  },
} as const
type PresetKey = keyof typeof PRESETS

// 지표별 설정
const INDICATORS = [
  { key:'cpi',          label:'물가상승률 (CPI)',  unit:'%',  low:2,   high:6,   max:70  },
  { key:'debt',         label:'정부부채 비율',     unit:'%',  low:60,  high:120, max:270 },
  { key:'unemployment', label:'실업률',            unit:'%',  low:4,   high:8,   max:35  },
  { key:'rate',         label:'기준금리',          unit:'%',  low:2,   high:5,   max:50  },
] as const
type IndicatorKey = typeof INDICATORS[number]['key']

// ═══════════════════════════════════════════════════════════════
//  COLOR HELPERS
// ═══════════════════════════════════════════════════════════════
function indicatorColor(value: number, low: number, high: number, max: number): string {
  const ratio = Math.min((value - 0) / (max - 0), 1)
  if (ratio <= low / max) return '#2d6a4f'   // 딥 그린 (안정)
  if (ratio <= 0.3) return '#52b788'          // 그린
  if (value <= low)  return D.neon            // 네온 그린 (최적)
  if (value <= high) return D.gold            // 골드 (주의)
  if (value <= high * 1.5) return D.orange    // 오렌지 (경고)
  return D.red                                // 레드 (위험)
}

// ═══════════════════════════════════════════════════════════════
//  CHART DATA BUILDER
// ═══════════════════════════════════════════════════════════════
function buildChartData(preset: typeof PRESETS[PresetKey]) {
  return MONTHS.map((m, i) => ({
    month: m,
    left:  preset.left.data[i]  ?? null,
    right: preset.right.data[i] ?? null,
  }))
}

// ═══════════════════════════════════════════════════════════════
//  TOOLTIP COMPONENTS
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, preset }: any) {
  if (!active || !payload?.length) return null
  const p = PRESETS[preset as PresetKey]
  return (
    <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:10, padding:'10px 14px', minWidth:180, boxShadow:`0 8px 32px rgba(0,0,0,0.6)` }}>
      <div style={{ fontSize:11, color:D.sub, marginBottom:8, fontWeight:600 }}>{label}</div>
      {payload.map((entry: {dataKey:string; value:number}, i: number) => {
        const side = entry.dataKey === 'left' ? p.left : p.right
        return (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:11, color:side.color, display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:side.color, display:'inline-block' }}/>
              {side.label}
            </span>
            <span style={{ fontWeight:800, color:side.color, fontVariantNumeric:'tabular-nums', fontSize:12, marginLeft:12 }}>
              {entry.value != null ? `${entry.dataKey === 'left' && ('unit' in p.left) ? '' : ''}${entry.value.toLocaleString('en-US')}${side.unit}` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 1: HEATMAP
// ═══════════════════════════════════════════════════════════════
function MacroHeatmap() {
  const [indicator, setIndicator] = useState<IndicatorKey>('cpi')
  const [hovered, setHovered]     = useState<string | null>(null)
  const [tooltip, setTooltip]     = useState<{ x:number; y:number } | null>(null)

  const indConfig = INDICATORS.find(i => i.key === indicator)!

  const getColor = useCallback((geoId: string) => {
    const c = COUNTRIES[geoId]
    if (!c) return D.muted
    const val = c[indicator as keyof CountryData] as number
    return indicatorColor(val, indConfig.low, indConfig.high, indConfig.max)
  }, [indicator, indConfig])

  const hoveredCountry = hovered ? COUNTRIES[hovered] : null

  return (
    <div style={{ background:D.surface, border:`1px solid ${D.border}`, borderRadius:18, overflow:'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding:'16px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:D.neon, letterSpacing:'0.14em', textTransform:'uppercase' as const }}>
            🌍 Global Macro Heatmap
          </div>
          <div style={{ fontSize:12, color:D.sub, marginTop:3 }}>주요국 거시경제 지표 비교</div>
        </div>
        {/* 지표 토글 */}
        <div style={{ display:'flex', background:D.card, borderRadius:10, padding:3, gap:2 }}>
          {INDICATORS.map(ind => (
            <button
              key={ind.key}
              onClick={() => setIndicator(ind.key)}
              style={{
                padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:11, fontWeight:700, letterSpacing:'0.03em',
                background: indicator === ind.key ? D.neon : 'transparent',
                color:      indicator === ind.key ? '#020617' : D.sub,
                transition:'all 0.18s',
                whiteSpace:'nowrap' as const,
              }}
            >
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      {/* 지도 영역 */}
      <div style={{ position:'relative', padding:'0 12px 12px' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale:130, center:[10, 20] }}
          style={{ background:'transparent', width:'100%', height:320 }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              geographies.map((geo: any) => {
                const geoId = String(geo.id)
                const isHighlighted = !!COUNTRIES[geoId]
                const color = isHighlighted ? getColor(geoId) : '#0d1f35'
                const isHov = hovered === geoId
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isHov ? '#ffffff' : color}
                    stroke={D.border}
                    strokeWidth={0.4}
                    style={{
                      default:  { outline:'none', transition:'fill 0.2s' },
                      hover:    { outline:'none', fill: isHighlighted ? '#ffffff' : '#0d1f35', cursor: isHighlighted ? 'pointer' : 'default' },
                      pressed:  { outline:'none' },
                    }}
                    onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                      if (!COUNTRIES[geoId]) return
                      setHovered(geoId)
                      setTooltip({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseMove={(e: React.MouseEvent<SVGPathElement>) => {
                      if (!COUNTRIES[geoId]) return
                      setTooltip({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseLeave={() => { setHovered(null); setTooltip(null) }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {/* 지도 툴팁 */}
        {hoveredCountry && tooltip && (
          <div style={{
            position:'fixed' as const,
            left: tooltip.x + 14, top: tooltip.y - 10,
            zIndex:9999, pointerEvents:'none' as const,
            background:D.card, border:`1px solid ${D.neon}44`,
            borderRadius:10, padding:'10px 14px',
            boxShadow:`0 8px 24px rgba(0,0,0,0.7)`,
            minWidth:160,
          }}>
            <div style={{ fontSize:13, fontWeight:800, color:D.text, marginBottom:6 }}>{hoveredCountry.nameKo}</div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
              <span style={{ fontSize:11, color:D.sub }}>{indConfig.label}</span>
              <span style={{ fontSize:14, fontWeight:900, color:getColor(hovered!), fontVariantNumeric:'tabular-nums' }}>
                {(hoveredCountry[indicator as keyof CountryData] as number).toFixed(1)}{indConfig.unit}
              </span>
            </div>
            {/* 부가 지표 */}
            <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${D.border}`, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px' }}>
              {INDICATORS.filter(i => i.key !== indicator).map(i => (
                <div key={i.key} style={{ fontSize:9, color:D.sub }}>
                  {i.label.split(' ')[0]}: <span style={{ color:D.text }}>{(hoveredCountry[i.key as keyof CountryData] as number).toFixed(1)}{i.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 범례 */}
        <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:4, flexWrap:'wrap' as const }}>
          {[
            { color:'#2d6a4f', label:'매우 낮음' },
            { color:'#52b788', label:'낮음' },
            { color:D.neon,    label:'적정' },
            { color:D.gold,    label:'주의' },
            { color:D.orange,  label:'경고' },
            { color:D.red,     label:'위험' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:D.sub }}>
              <div style={{ width:12, height:8, borderRadius:2, background:l.color }}/>
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* 국가별 수치 요약 테이블 */}
      <div style={{ padding:'0 16px 16px', overflowX:'auto' }}>
        <div style={{ display:'flex', gap:8, minWidth:'max-content' }}>
          {Object.values(COUNTRIES).sort((a,b) => (a[indicator as keyof CountryData] as number) - (b[indicator as keyof CountryData] as number)).map(c => {
            const val = c[indicator as keyof CountryData] as number
            const col = indicatorColor(val, indConfig.low, indConfig.high, indConfig.max)
            return (
              <div key={c.iso3} style={{
                background:D.card, border:`1px solid ${col}33`,
                borderRadius:8, padding:'7px 10px', minWidth:80, textAlign:'center' as const,
              }}>
                <div style={{ fontSize:10, color:D.sub, marginBottom:3 }}>{c.nameKo}</div>
                <div style={{ fontSize:14, fontWeight:900, color:col, fontVariantNumeric:'tabular-nums' }}>
                  {val.toFixed(1)}{indConfig.unit}
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
//  SECTION 2: DUAL Y-AXIS COMPARE CHART
// ═══════════════════════════════════════════════════════════════
function CompareChart() {
  const [preset, setPreset] = useState<PresetKey>('rate_vs_nvda')
  const p = PRESETS[preset]
  const chartData = useMemo(() => buildChartData(p), [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  // 표시할 x축 라벨 (짝수월만)
  const xTicks = MONTHS.filter((_, i) => i % 3 === 0)

  return (
    <div style={{ background:D.surface, border:`1px solid ${D.border}`, borderRadius:18, overflow:'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding:'16px 20px 10px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:D.neon, letterSpacing:'0.14em', textTransform:'uppercase' as const }}>
            ⚡ Valkyrie Compare Analytics
          </div>
          <div style={{ fontSize:12, color:D.sub, marginTop:3 }}>듀얼 Y축 비교 분석 · {DATA_START} ~ {DATA_END}</div>
        </div>
        {/* 프리셋 버튼 */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
          {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              style={{
                padding:'7px 14px', borderRadius:9, border:`1px solid ${preset === key ? D.neon+'66' : D.border}`,
                background: preset === key ? `${D.neon}18` : 'transparent',
                color:      preset === key ? D.neon : D.sub,
                fontSize:11, fontWeight:700, cursor:'pointer',
                transition:'all 0.18s', display:'flex', alignItems:'center', gap:5,
              }}
            >
              <span>{val.icon}</span>
              <span>{val.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 현재 프리셋 설명 */}
      <div style={{ padding:'0 20px 10px', display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ fontSize:11, color:D.sub }}>{p.desc}</div>
        <div style={{ display:'flex', gap:12 }}>
          {(['left','right'] as const).map(side => {
            const s = p[side]
            return (
              <div key={side} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                <div style={{ width:16, height:2, background:s.color, borderRadius:1 }}/>
                <span style={{ color:s.color }}>{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 차트 */}
      <div style={{ padding:'0 12px 20px' }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top:10, right:60, bottom:0, left:10 }}>
            <defs>
              <linearGradient id="leftGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={p.left.color}  stopOpacity={0.3}/>
                <stop offset="100%" stopColor={p.left.color}  stopOpacity={0.02}/>
              </linearGradient>
              <linearGradient id="rightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={p.right.color} stopOpacity={0.25}/>
                <stop offset="100%" stopColor={p.right.color} stopOpacity={0.02}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 4" stroke="#0d1f35" vertical={false}/>

            <XAxis
              dataKey="month"
              ticks={xTicks}
              tick={{ fill:'#374151', fontSize:9, fontWeight:500 }}
              axisLine={{ stroke:'#0d1f35' }} tickLine={false}
              interval={0}
            />
            {/* 좌측 Y축 */}
            <YAxis
              yAxisId="left"
              domain={[...p.left.yDomain]}
              tick={{ fill: p.left.color, fontSize:9 }}
              axisLine={false} tickLine={false} width={46}
              tickFormatter={v => `${v}${p.left.unit}`}
            />
            {/* 우측 Y축 */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[...p.right.yDomain]}
              tick={{ fill: p.right.color, fontSize:9 }}
              axisLine={false} tickLine={false} width={52}
              tickFormatter={v => `${v.toLocaleString('en-US')}${p.right.unit}`}
            />

            {/* 0% 기준선 (누적수익률 차트에서만 의미있음) */}
            {preset === 'nvda_vs_pltr' && (
              <ReferenceLine yAxisId="left" y={0} stroke={D.border} strokeWidth={1} strokeDasharray="4 2"/>
            )}

            <Tooltip
              content={<ChartTooltip preset={preset}/>}
              cursor={{ stroke:D.border, strokeWidth:1, strokeDasharray:'4 2' }}
            />

            <Legend
              wrapperStyle={{ fontSize:10, color:D.sub, paddingTop:8 }}
              formatter={(value: string) => {
                const isLeft = value === 'left'
                return <span style={{ color: isLeft ? p.left.color : p.right.color, fontWeight:600 }}>
                  {isLeft ? p.left.label : p.right.label}
                </span>
              }}
            />

            {/* 왼쪽 데이터 — Area */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="left"
              name="left"
              stroke={p.left.color}
              strokeWidth={2}
              fill="url(#leftGrad)"
              dot={false}
              activeDot={{ r:4, fill:p.left.color, stroke:D.surface, strokeWidth:2 }}
              isAnimationActive={true}
              animationDuration={700}
            />
            {/* 오른쪽 데이터 — Line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="right"
              name="right"
              stroke={p.right.color}
              strokeWidth={2.5}
              strokeDasharray="0"
              dot={false}
              activeDot={{ r:4, fill:p.right.color, stroke:D.surface, strokeWidth:2 }}
              isAnimationActive={true}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 교육 인사이트 박스 */}
      {(() => {
        const insights: Record<PresetKey, { title:string; text:string }> = {
          rate_vs_nvda: {
            title: '📚 투자 인사이트',
            text: '2022년 금리 급등(0%→5.5%) 시 NVDA는 -47% 폭락. 그러나 2023~2024 AI 붐으로 사상 최고치 경신. 2025년 DeepSeek 쇼크 단기 조정 후 재상승. 금리 인하 사이클 진입(2024~2026)에도 AI 모멘텀이 압도하는 현상을 관찰할 수 있습니다.',
          },
          cpi_vs_div: {
            title: '📚 투자 인사이트',
            text: '인플레이션(CPI)이 높아질수록 배당 실질 가치는 하락합니다. 배당수익률이 CPI보다 낮으면 실질 수익률은 마이너스! 인플레 방어를 위해 배당성장주를 주목하세요.',
          },
          nvda_vs_pltr: {
            title: '📚 투자 인사이트',
            text: 'AI 인프라(NVDA)와 AI 응용(PLTR)의 성과를 비교합니다. NVDA는 반도체 공급망을, PLTR은 데이터 분석 플랫폼을 대표합니다. 두 자산의 상관관계와 변동성을 비교해보세요.',
          },
        }
        const ins = insights[preset]
        return (
          <div style={{ margin:'0 16px 16px', background:`${D.neon}08`, border:`1px solid ${D.neon}1e`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:D.neon, marginBottom:6 }}>{ins.title}</div>
            <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>{ins.text}</div>
          </div>
        )
      })()}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MacroHubPage() {
  return (
    <div style={{
      minHeight:'100vh',
      background:D.bg,
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      color:D.text,
      padding:'20px',
      boxSizing:'border-box',
    }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:D.neon, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:6 }}>
            🌐 MACRO HUB
          </div>
          <h1 style={{ fontSize:'clamp(20px,3vw,28px)', fontWeight:900, color:'#f8fafc', margin:0, letterSpacing:'-0.5px' }}>
            글로벌 매크로 분석
          </h1>
          <p style={{ fontSize:12, color:D.sub, margin:'4px 0 0' }}>
            탑다운(Top-down) 투자 · 거시경제 지표 · 자산 비교 분석
          </p>
        </div>
        <div style={{ fontSize:10, color:D.muted, textAlign:'right' as const }}>
          <div>데이터 기준: 2024년 기준 정적 데이터</div>
          <div style={{ marginTop:2 }}>시계열: {DATA_START} – {DATA_END} ({MONTHS.length}개월)</div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {/* Section 1: 히트맵 */}
        <MacroHeatmap />
        {/* Section 2: 듀얼 차트 */}
        <CompareChart />
      </div>
    </div>
  )
}
