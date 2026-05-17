'use client'

/**
 * /macro-hub — 발키리 글로벌 매크로 허브 v3 (실시간 데이터 연동)
 *
 * 데이터 아키텍처:
 * ┌──────────────────────────────────────────────────────┐
 * │  Browser (MacroHub.tsx)                              │
 * │    ↓ fetch('/api/macro-data')                        │
 * │  Next.js API Route                                   │
 * │    ↓ World Bank API  → CPI, 실업률, 부채             │
 * │    ↓ Yahoo Finance   → NVDA, PLTR 36개월 월봉        │
 * │    ↓ FRED CSV        → 미국 기준금리 시계열            │
 * │    ↓ 폴백 상수        → 중앙은행 기준금리 (분기 업데이트)│
 * └──────────────────────────────────────────────────────┘
 *
 * Rolling Window:
 *   오늘 날짜 기준 자동으로 최근 N개월(24/36) slice
 *   → 코드 수정 없이 항상 최신 데이터 유지
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
//  API 응답 타입
// ═══════════════════════════════════════════════════════════════
interface MacroApiResponse {
  countries: {
    cpi:   Record<string, number | null>
    unemp: Record<string, number | null>
    debt:  Record<string, number | null>
    rates: Record<string, number>
  }
  stocks: {
    nvda: { date: string; close: number }[]
    pltr: { date: string; close: number }[]
  }
  fedRates: { date: string; rate: number }[]
  dataQuality: {
    cpiSource:   'worldbank' | 'fallback'
    stockSource: 'yahoo'     | 'fallback'
    fedSource:   'fred'      | 'fallback'
  }
  lastUpdated: string
}

// ═══════════════════════════════════════════════════════════════
//  히트맵 국가 기본 정보 (ISO3 키 기준)
// ═══════════════════════════════════════════════════════════════
const COUNTRY_META: Record<string, { nameKo: string; geoId: string }> = {
  USA: { nameKo: '미국',    geoId: '840' },
  KOR: { nameKo: '한국',    geoId: '410' },
  JPN: { nameKo: '일본',    geoId: '392' },
  CHN: { nameKo: '중국',    geoId: '156' },
  DEU: { nameKo: '독일',    geoId: '276' },
  GBR: { nameKo: '영국',    geoId: '826' },
  FRA: { nameKo: '프랑스',  geoId: '250' },
  IND: { nameKo: '인도',    geoId: '356' },
  BRA: { nameKo: '브라질',  geoId: '76'  },
  AUS: { nameKo: '호주',    geoId: '36'  },
  CAN: { nameKo: '캐나다',  geoId: '124' },
  RUS: { nameKo: '러시아',  geoId: '643' },
  TUR: { nameKo: '터키',    geoId: '792' },
  SAU: { nameKo: '사우디',  geoId: '682' },
  ZAF: { nameKo: '남아공',  geoId: '710' },
}
// geoId → ISO3 역방향 맵
const GEO_TO_ISO3 = Object.fromEntries(
  Object.entries(COUNTRY_META).map(([iso3, { geoId }]) => [geoId, iso3])
)

// ═══════════════════════════════════════════════════════════════
//  히트맵 지표 설정
// ═══════════════════════════════════════════════════════════════
const INDICATORS = [
  { key: 'cpi',   label: '물가상승률 (CPI)', unit: '%', low: 2,  high: 5,   safeTip: '2% 이하 안정' },
  { key: 'unemp', label: '실업률',           unit: '%', low: 4,  high: 8,   safeTip: '4% 이하 완전고용' },
  { key: 'debt',  label: '정부부채 비율',    unit: '%', low: 60, high: 120, safeTip: '60% 이하 건전' },
  { key: 'rates', label: '기준금리',         unit: '%', low: 2,  high: 5,   safeTip: '2~3% 중립금리' },
] as const
type IndicatorKey = typeof INDICATORS[number]['key']

function indicatorColor(value: number, low: number, high: number): string {
  if (value <= low * 0.75) return '#2d6a4f'
  if (value <= low)        return '#52b788'
  if (value <= low * 1.1)  return D.neon
  if (value <= high)       return D.gold
  if (value <= high * 1.5) return D.orange
  return D.red
}

// ═══════════════════════════════════════════════════════════════
//  폴백 데이터 (API 실패 시 사용)
// ═══════════════════════════════════════════════════════════════
const FALLBACK_COUNTRIES = {
  cpi:   { USA:2.8, KOR:2.2, JPN:2.9, CHN:0.1, DEU:2.1, GBR:2.8, FRA:1.8, IND:4.6, BRA:4.8, AUS:2.9, CAN:2.3, RUS:9.1, TUR:38.0, SAU:1.9, ZAF:4.8 },
  unemp: { USA:4.1, KOR:3.0, JPN:2.4, CHN:5.0, DEU:3.4, GBR:4.4, FRA:7.3, IND:7.8, BRA:7.5, AUS:4.0, CAN:6.5, RUS:3.1, TUR:8.4, SAU:5.8, ZAF:33.5 },
  debt:  { USA:122, KOR:55, JPN:263, CHN:56, DEU:65, GBR:103, FRA:114, IND:85, BRA:92, AUS:47, CAN:110, RUS:20, TUR:32, SAU:26, ZAF:76 },
  rates: { USA:3.63, KOR:2.50, JPN:0.50, CHN:3.10, DEU:2.65, GBR:4.50, FRA:2.65, IND:6.25, BRA:13.25, AUS:4.10, CAN:2.75, RUS:21.0, TUR:42.5, SAU:5.00, ZAF:7.75 },
} as const

// ═══════════════════════════════════════════════════════════════
//  Rolling Window 유틸
// ═══════════════════════════════════════════════════════════════
function genMonths(startYM: string, n: number): string[] {
  const [sy, sm] = startYM.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(sy, sm - 1 + i)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function todayYM(): string {
  const t = new Date()
  return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════
//  SKELETON COMPONENT
// ═══════════════════════════════════════════════════════════════
function Skeleton({ h = 20, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: `linear-gradient(90deg, ${D.muted}44 25%, ${D.muted}88 50%, ${D.muted}44 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }}/>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TRADINGVIEW WIDGET — 인터랙티브 실시간 차트 (폴백용)
// ═══════════════════════════════════════════════════════════════
function TradingViewSymbolChart({
  symbols, height = 320,
}: {
  symbols: Array<{ proName: string; title: string }>
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ''
    const container = document.createElement('div')
    container.className = 'tradingview-widget-container__widget'
    ref.current.appendChild(container)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: symbols.map(s => [s.title, s.proName]),
      chartOnly: false,
      width: '100%',
      height,
      locale: 'ko',
      colorTheme: 'dark',
      autosize: false,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      maLineColor: D.neon,
      maLineWidth: 1,
      maLength: 9,
      lineWidth: 2,
      lineType: 0,
      dateRanges: ['1m|30', '3m|60', '12m|1D', '60m|1W'],
      backgroundColor: D.card,
      lineColor: D.neon,
      topColor: `${D.neon}40`,
      bottomColor: `${D.neon}04`,
    })
    ref.current.appendChild(script)

    return () => { if (ref.current) ref.current.innerHTML = '' }
  }, [symbols, height]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tradingview-widget-container" ref={ref}
      style={{ height, borderRadius: 12, overflow: 'hidden', background: D.card }}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
//  TOOLTIP COMPONENT
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, leftLabel, rightLabel, leftUnit, rightUnit, leftColor, rightColor }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 190, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <div style={{ fontSize: 11, color: D.sub, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      {payload.map((entry: { dataKey: string; value: number }, i: number) => {
        const isLeft = entry.dataKey === 'left'
        const col = isLeft ? leftColor : rightColor
        const lbl = isLeft ? leftLabel : rightLabel
        const unt = isLeft ? leftUnit  : rightUnit
        if (entry.value == null) return null
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: col, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: 'inline-block' }}/>
              {lbl}
            </span>
            <span style={{ fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums', fontSize: 13, marginLeft: 16 }}>
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
                : entry.value}{unt}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 1: GLOBAL MACRO HEATMAP
// ═══════════════════════════════════════════════════════════════
function MacroHeatmap({
  data, loading,
}: {
  data: MacroApiResponse['countries'] | null
  loading: boolean
}) {
  const [indicator, setIndicator] = useState<IndicatorKey>('cpi')
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [tooltip,   setTooltip]   = useState<{ x: number; y: number } | null>(null)

  const indCfg = INDICATORS.find(i => i.key === indicator)!

  // ISO3 기반 지표값 조회 (API 데이터 우선, 폴백 적용)
  const getVal = useCallback((iso3: string, key: IndicatorKey): number | null => {
    if (!iso3) return null
    const live = data?.[key]?.[iso3]
    if (live != null) return live
    const fb = (FALLBACK_COUNTRIES[key] as Record<string, number>)[iso3]
    return fb ?? null
  }, [data, indicator]) // eslint-disable-line react-hooks/exhaustive-deps

  const getGeoColor = useCallback((geoId: string): string => {
    const iso3 = GEO_TO_ISO3[geoId]
    if (!iso3) return D.muted
    const val = getVal(iso3, indicator)
    if (val == null) return D.muted
    return indicatorColor(val, indCfg.low, indCfg.high)
  }, [getVal, indicator, indCfg])

  const hovIso3   = hovered ? GEO_TO_ISO3[hovered] : null
  const hovMeta   = hovIso3 ? COUNTRY_META[hovIso3] : null

  // 카드 목록
  const cardList = useMemo(() =>
    Object.keys(COUNTRY_META)
      .map(iso3 => ({ iso3, val: getVal(iso3, indicator) }))
      .filter(x => x.val != null)
      .sort((a, b) => (a.val as number) - (b.val as number))
  , [getVal, indicator])

  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 18, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.neon, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
            🌍 Global Macro Heatmap
          </div>
          <div style={{ fontSize: 12, color: D.sub, marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
            주요국 거시경제 실시간 지표
            {loading ? (
              <span style={{ fontSize: 10, color: D.muted }}>● 로딩 중…</span>
            ) : data ? (
              <span style={{ fontSize: 10, color: '#52b788' }}>● {data.cpi && Object.keys(data.cpi).length > 0 ? 'World Bank 라이브' : '폴백 데이터'}</span>
            ) : null}
          </div>
        </div>
        {/* 지표 토글 */}
        <div style={{ display: 'flex', background: D.card, borderRadius: 10, padding: 3, gap: 2 }}>
          {INDICATORS.map(ind => (
            <button key={ind.key} onClick={() => setIndicator(ind.key)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const,
              background: indicator === ind.key ? D.neon : 'transparent',
              color:      indicator === ind.key ? '#020617' : D.sub,
              transition: 'all 0.18s',
            }}>{ind.label}</button>
          ))}
        </div>
      </div>

      {/* 지도 */}
      <div style={{ position: 'relative', padding: '0 12px 8px' }}>
        {loading ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <Skeleton h={280} w="100%" r={12} />
          </div>
        ) : (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 130, center: [10, 20] }}
            style={{ background: 'transparent', width: '100%', height: 300 }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                geographies.map((geo: any) => {
                  const gid    = String(geo.id)
                  const active = !!GEO_TO_ISO3[gid]
                  const col    = active ? getGeoColor(gid) : '#0d1f35'
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
                        setHovered(gid); setTooltip({ x: e.clientX, y: e.clientY })
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
        )}

        {/* 호버 툴팁 */}
        {hovMeta && hovIso3 && tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
            zIndex: 9999, pointerEvents: 'none', background: D.card,
            border: `1px solid ${D.neon}44`, borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)', minWidth: 170,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: D.text, marginBottom: 6 }}>{hovMeta.nameKo}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 11, color: D.sub }}>{indCfg.label}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: getGeoColor(hovered!), fontVariantNumeric: 'tabular-nums' }}>
                {(getVal(hovIso3, indicator) ?? '—')}{typeof getVal(hovIso3, indicator) === 'number' ? indCfg.unit : ''}
              </span>
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${D.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
              {INDICATORS.filter(i => i.key !== indicator).map(i => {
                const v = getVal(hovIso3, i.key)
                return (
                  <div key={i.key} style={{ fontSize: 9, color: D.sub }}>
                    {i.label.split(' ')[0]}: <span style={{ color: D.text }}>{v != null ? `${v}${i.unit}` : '—'}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop:6, fontSize:9, color:D.muted, textAlign:'right' as const }}>
              {data?.cpi && Object.keys(data.cpi).length > 0 ? '출처: World Bank' : '출처: 폴백'}
            </div>
          </div>
        )}

        {/* 범례 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[['#2d6a4f','매우 안정'],['#52b788','안정'],[D.neon,'적정'],[D.gold,'주의'],[D.orange,'경고'],[D.red,'위험']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: D.sub }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: c }}/>{l}
            </div>
          ))}
        </div>
      </div>

      {/* 국가 수치 카드 */}
      <div style={{ padding: '8px 16px 16px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={52} w={80} r={8} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
            {cardList.map(({ iso3, val }) => {
              const col  = indicatorColor(val as number, indCfg.low, indCfg.high)
              const meta = COUNTRY_META[iso3]
              return (
                <div key={iso3} style={{ background: D.card, border: `1px solid ${col}33`, borderRadius: 8, padding: '7px 10px', minWidth: 80, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 10, color: D.sub, marginBottom: 3 }}>{meta.nameKo}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: col, fontVariantNumeric: 'tabular-nums' }}>
                    {(val as number).toFixed(1)}{indCfg.unit}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 2: DUAL-AXIS COMPARE CHART
// ═══════════════════════════════════════════════════════════════
type PresetKey = 'rate_vs_nvda' | 'cpi_vs_div' | 'nvda_vs_pltr'

function CompareChart({
  apiData, loading,
}: {
  apiData: MacroApiResponse | null
  loading: boolean
}) {
  const [preset,      setPreset]      = useState<PresetKey>('rate_vs_nvda')
  const [windowSize,  setWindowSize]  = useState<24 | 36>(36)
  const [useTVWidget, setUseTVWidget] = useState(false)

  // ── Rolling Window + 프리셋 계산 ───────────────────────────────────────────
  const { chartData, dataStart, dataEnd, p, tvSymbols, quality } = useMemo(() => {
    const today = todayYM()

    // NVDA 데이터 준비 (API → 폴백 정적 배열)
    let nvdaMap: Record<string, number> = {}
    let pltrMap: Record<string, number> = {}
    let rateMap: Record<string, number> = {}

    const nvdaArr = apiData?.stocks?.nvda ?? []
    const pltrArr = apiData?.stocks?.pltr ?? []
    const ratesArr = apiData?.fedRates ?? []

    if (nvdaArr.length > 0) {
      nvdaMap = Object.fromEntries(nvdaArr.map(d => [d.date, d.close]))
    }
    if (pltrArr.length > 0) {
      pltrMap = Object.fromEntries(pltrArr.map(d => [d.date, d.close]))
    }
    if (ratesArr.length > 0) {
      rateMap = Object.fromEntries(ratesArr.map(d => [d.date, d.rate]))
    }

    const hasNvda  = nvdaArr.length  > 12
    const hasPltr  = pltrArr.length  > 12
    const hasRates = ratesArr.length > 12

    // Rolling Window: 오늘 기준 최근 N개월
    const allMonths = genMonths('2022-01', 72)  // 2022~2027 전체
    const todayIdx  = allMonths.indexOf(today)
    const endIdx    = todayIdx >= 0 ? todayIdx : allMonths.length - 1
    const startIdx  = Math.max(0, endIdx - windowSize + 1)
    const months    = allMonths.slice(startIdx, endIdx + 1)

    // 미국 기준금리 (FRED 실시간 우선, 폴백 상수)
    // 폴백: 2022-01부터 현재까지 상수 배열
    const RATE_FALLBACK: Record<string, number> = {}
    const ratePath = [
      ...genMonths('2022-01', 8).map(m => [m, 0.08]),
      ...genMonths('2022-09', 4).map((m, i) => [m, [2.33,3.08,3.78,4.10][i]]),
      ['2022.12', 4.33],
      ...genMonths('2023-01', 7).map((m, i) => [m, [4.58,4.83,4.83,5.08,5.08,5.08,5.33][i]]),
      ...genMonths('2023-08', 5).map(m => [m, 5.33]),
      ...genMonths('2024-01', 8).map(m => [m, 5.33]),
      ['2024.09', 4.88], ['2024.10', 4.88], ['2024.11', 4.63], ['2024.12', 4.38],
      ...genMonths('2025-01', 4).map(m => [m, 4.38]),
      ['2025.05', 4.13], ['2025.06', 4.13], ['2025.07', 3.88], ['2025.08', 3.88],
      ['2025.09', 3.88], ['2025.10', 3.88], ['2025.11', 3.63], ['2025.12', 3.63],
      ...genMonths('2026-01', 12).map(m => [m, 3.63]),
    ] as [string, number][]
    ratePath.forEach(([m, v]) => { RATE_FALLBACK[m] = v })

    const getRate = (m: string) => hasRates ? (rateMap[m] ?? RATE_FALLBACK[m] ?? null) : (RATE_FALLBACK[m] ?? null)

    // KR CPI (World Bank 데이터 우선, 폴백)
    const KR_CPI_FALLBACK: Record<string, number> = {}
    ;[3.6,3.7,4.1,4.8,5.4,6.0,6.3,5.7,5.6,5.7,5.0,5.0,
      5.2,4.8,4.2,3.7,3.3,2.7,2.3,2.0,1.9,1.8,3.4,3.2,
      2.8,2.9,3.1,3.0,2.7,2.6,2.5,2.4,2.0,1.3,1.5,1.6,
      1.7,2.0,2.2,2.3,2.5,2.4,2.3,2.2,2.1,2.0,1.9,2.0,
      2.1,2.2,2.3,2.4,2.3,
    ].forEach((v, i) => { KR_CPI_FALLBACK[allMonths[i]] = v })

    // 포트폴리오 배당 (점진적 상승 mock)
    const DIV_MAP: Record<string, number> = {}
    allMonths.forEach((m, i) => { DIV_MAP[m] = parseFloat((1.2 + i * 0.042).toFixed(2)) })

    // ─ 차트 데이터 빌드 ───────────────────────────────────────────────────────
    // preset별 left/right 데이터
    const buildRow = (m: string) => {
      const nvdaClose = hasNvda ? (nvdaMap[m] ?? null) : null
      const pltrClose = hasPltr ? (pltrMap[m] ?? null) : null
      const rate      = getRate(m)

      if (preset === 'rate_vs_nvda') {
        return { month: m, left: rate, right: nvdaClose }
      }
      if (preset === 'cpi_vs_div') {
        const cpiArr = apiData?.countries?.cpi
        const krCpi  = (cpiArr && cpiArr['KOR'] != null) ? null : (KR_CPI_FALLBACK[m] ?? null)
        return { month: m, left: krCpi, right: DIV_MAP[m] ?? null }
      }
      // nvda_vs_pltr: 누적수익률
      const nvda0 = hasNvda ? (nvdaMap[months[0]] ?? null) : null
      const pltr0 = hasPltr ? (pltrMap[months[0]] ?? null) : null
      return {
        month: m,
        left:  (nvda0 && nvdaClose) ? parseFloat(((nvdaClose / nvda0 - 1) * 100).toFixed(1)) : null,
        right: (pltr0 && pltrClose) ? parseFloat(((pltrClose / pltr0 - 1) * 100).toFixed(1)) : null,
      }
    }

    const chartData = months.map(buildRow)

    const PRESET_META = {
      rate_vs_nvda: {
        label: '금리 vs 기술주', icon: '📈',
        desc:  '미국 기준금리(%) vs NVDA 주가',
        left:  { label: '미국 기준금리', color: D.indigo, unit: '%', yDomain: [0, 6] as [number, number]    },
        right: { label: 'NVDA ($)',      color: D.neon,   unit: '$', yDomain: [10, 260] as [number, number] },
      },
      cpi_vs_div: {
        label: '인플레 vs 배당', icon: '💰',
        desc:  '한국 CPI(%) vs 포트폴리오 배당수익률(%)',
        left:  { label: '한국 CPI',        color: D.orange, unit: '%', yDomain: [0, 8] as [number, number] },
        right: { label: '포트폴리오 배당', color: D.neon,   unit: '%', yDomain: [0, 6] as [number, number] },
      },
      nvda_vs_pltr: {
        label: 'AI 주도주 대결', icon: '⚡',
        desc:  `NVDA vs PLTR 누적수익률 (기준: ${months[0]})`,
        left:  { label: 'NVDA 누적수익률', color: D.neon, unit: '%', yDomain: [-70, 600] as [number, number] },
        right: { label: 'PLTR 누적수익률', color: D.blue, unit: '%', yDomain: [-70, 900] as [number, number] },
      },
    }

    const tvSymbols = {
      rate_vs_nvda: [
        { proName: 'NASDAQ:NVDA', title: 'NVDA' },
        { proName: 'NASDAQ:PLTR', title: 'PLTR' },
      ],
      cpi_vs_div: [
        { proName: 'NASDAQ:NVDA', title: 'NVDA' },
        { proName: 'NASDAQ:PLTR', title: 'PLTR' },
      ],
      nvda_vs_pltr: [
        { proName: 'NASDAQ:NVDA', title: 'NVDA' },
        { proName: 'NASDAQ:PLTR', title: 'PLTR' },
      ],
    }

    return {
      chartData,
      dataStart: months[0] ?? '',
      dataEnd:   months[months.length - 1] ?? '',
      p:         PRESET_META[preset],
      tvSymbols: tvSymbols[preset],
      quality: {
        stockSrc: hasNvda ? '📡 Yahoo Finance' : '📋 폴백',
        rateSrc:  hasRates ? '📡 FRED' : '📋 폴백',
      },
    }
  }, [preset, windowSize, apiData]) // eslint-disable-line react-hooks/exhaustive-deps

  const xTicks = chartData.filter((_, i) => i % (windowSize === 24 ? 2 : 3) === 0).map(d => d.month)

  // ── 교육 인사이트 ─────────────────────────────────────────────────────────
  const insights: Record<PresetKey, string> = {
    rate_vs_nvda:  `기간(${dataStart}~${dataEnd}): 미국 금리가 5.33%에서 3.63%로 인하되는 과정에서 NVDA는 AI 인프라 수요(Blackwell GPU)로 시장 기대를 압도했습니다. 금리 인하 사이클과 AI 투자 붐의 동시 도래는 역사적으로 드문 국면입니다.`,
    cpi_vs_div:    `인플레이션이 2% 안정 목표에 수렴할수록 배당의 실질 가치가 회복됩니다. 배당수익률이 CPI보다 높으면 실질 플러스 수익! 선택된 기간 동안 한국 물가와 배당 추이를 비교해보세요.`,
    nvda_vs_pltr:  `AI 인프라(NVDA)와 AI 응용·방산(PLTR)의 성과 대결. PLTR은 트럼프 2기 'DOGE 정부 AI 계약' 수혜와 S&P500 편입 효과로 역대급 랠리를 기록했습니다. 두 자산의 변동성과 상관관계를 분석해보세요.`,
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
            {!loading && (
              <span style={{ marginLeft: 8, fontSize: 10, color: D.muted }}>
                {quality.stockSrc} · {quality.rateSrc}
              </span>
            )}
          </div>
        </div>

        {/* 우측 컨트롤 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 차트 소스 토글 */}
          <button onClick={() => setUseTVWidget(v => !v)} style={{
            padding: '5px 12px', borderRadius: 7, border: `1px solid ${useTVWidget ? D.neon+'55' : D.border}`,
            background: useTVWidget ? `${D.neon}12` : 'transparent', color: useTVWidget ? D.neon : D.sub,
            fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>
            {useTVWidget ? '📡 TradingView' : '📊 Custom'}
          </button>
          {/* 기간 토글 */}
          <div style={{ display: 'flex', background: D.card, borderRadius: 8, padding: 2, gap: 2 }}>
            {([24, 36] as const).map(w => (
              <button key={w} onClick={() => setWindowSize(w)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 10, fontWeight: 700,
                background: windowSize === w ? D.neon : 'transparent',
                color:      windowSize === w ? '#020617' : D.sub,
                transition: 'all 0.18s',
              }}>{w}개월</button>
            ))}
          </div>
        </div>
      </div>

      {/* 프리셋 버튼 */}
      <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['rate_vs_nvda', 'cpi_vs_div', 'nvda_vs_pltr'] as PresetKey[]).map(key => {
          const ICONS = { rate_vs_nvda: '📈', cpi_vs_div: '💰', nvda_vs_pltr: '⚡' }
          const LABELS = { rate_vs_nvda: '금리 vs 기술주', cpi_vs_div: '인플레 vs 배당', nvda_vs_pltr: 'AI 주도주 대결' }
          return (
            <button key={key} onClick={() => setPreset(key)} style={{
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              border:     `1px solid ${preset === key ? D.neon + '66' : D.border}`,
              background: preset === key ? `${D.neon}18` : 'transparent',
              color:      preset === key ? D.neon : D.sub,
              transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{ICONS[key]}</span><span>{LABELS[key]}</span>
            </button>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['left', 'right'] as const).map(side => (
            <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 16, height: 2, background: p[side].color, borderRadius: 1 }}/>
              <span style={{ color: p[side].color }}>{p[side].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div style={{ padding: '0 8px 12px' }}>
        {loading ? (
          <div style={{ padding: '8px' }}><Skeleton h={300} r={12} /></div>
        ) : useTVWidget ? (
          /* TradingView 실시간 위젯 모드 */
          <div style={{ padding: '0 8px' }}>
            <TradingViewSymbolChart symbols={tvSymbols} height={310} />
            <div style={{ fontSize: 10, color: D.muted, textAlign: 'right' as const, marginTop: 6 }}>
              📡 TradingView 실시간 데이터
            </div>
          </div>
        ) : (
          /* Recharts 커스텀 차트 모드 */
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={chartData} margin={{ top: 12, right: 58, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="lgLeft"  x1="0" y1="0" x2="0" y2="1">
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
                dataKey="month" ticks={xTicks}
                tick={{ fill: '#374151', fontSize: 9, fontWeight: 500 }}
                axisLine={{ stroke: '#0d1f35' }} tickLine={false} interval={0}
              />
              <YAxis yAxisId="left"  domain={[...p.left.yDomain]}
                tick={{ fill: p.left.color,  fontSize: 9 }} axisLine={false} tickLine={false} width={44}
                tickFormatter={v => `${v}${p.left.unit}`}
              />
              <YAxis yAxisId="right" orientation="right" domain={[...p.right.yDomain]}
                tick={{ fill: p.right.color, fontSize: 9 }} axisLine={false} tickLine={false} width={50}
                tickFormatter={v => `${v.toLocaleString('en-US')}${p.right.unit}`}
              />
              {preset === 'nvda_vs_pltr' && (
                <ReferenceLine yAxisId="left" y={0} stroke={D.border} strokeWidth={1} strokeDasharray="4 2"/>
              )}
              <Tooltip
                content={<ChartTooltip
                  leftLabel={p.left.label}   rightLabel={p.right.label}
                  leftUnit={p.left.unit}      rightUnit={p.right.unit}
                  leftColor={p.left.color}    rightColor={p.right.color}
                />}
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
              <Area yAxisId="left" type="monotone" dataKey="left" name="left"
                stroke={p.left.color} strokeWidth={2} fill="url(#lgLeft)" dot={false}
                activeDot={{ r: 4, fill: p.left.color, stroke: D.surface, strokeWidth: 2 }}
                isAnimationActive animationDuration={600}
              />
              <Line yAxisId="right" type="monotone" dataKey="right" name="right"
                stroke={p.right.color} strokeWidth={2.5} dot={false}
                activeDot={{ r: 4, fill: p.right.color, stroke: D.surface, strokeWidth: 2 }}
                isAnimationActive animationDuration={800}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 인사이트 */}
      <div style={{ margin: '0 16px 16px', background: `${D.neon}08`, border: `1px solid ${D.neon}1e`, borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: D.neon, marginBottom: 6 }}>📚 투자 인사이트</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{insights[preset]}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MacroHubPage() {
  const [apiData,  setApiData]  = useState<MacroApiResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/macro-data')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: MacroApiResponse = await res.json()
        setApiData(json)
      } catch (e) {
        console.error('[MacroHub] fetch error:', e)
        setError('데이터 로드 실패 — 폴백 데이터를 사용합니다')
        setApiData(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const today = todayYM()
  const allM  = genMonths('2022-01', 72)
  const end   = allM.indexOf(today) >= 0 ? allM.indexOf(today) : allM.length - 1
  const start = Math.max(0, end - 35)

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '20px', boxSizing: 'border-box' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: D.neon, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            🌐 MACRO HUB
          </div>
          <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
            글로벌 매크로 분석
          </h1>
          <p style={{ fontSize: 12, color: D.sub, margin: '4px 0 0' }}>
            탑다운(Top-down) 투자 · 실시간 거시경제 · 자산 비교 분석
          </p>
        </div>

        <div style={{ fontSize: 10, textAlign: 'right' as const }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <Skeleton h={12} w={120} r={4}/>
              <Skeleton h={10} w={90}  r={4}/>
            </div>
          ) : (
            <>
              <div style={{ color: error ? D.orange : D.neon, fontWeight: 700, marginBottom: 2 }}>
                {error ? '⚠ 폴백 모드' : '⚡ 실시간 연동'}
              </div>
              {apiData && (
                <div style={{ color: D.muted }}>
                  업데이트: {new Date(apiData.lastUpdated).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </div>
              )}
              <div style={{ color: D.muted, marginTop: 2 }}>
                ⏱ Rolling Window: {allM[start]} ~ {allM[end]}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div style={{ marginBottom: 16, background: `${D.orange}12`, border: `1px solid ${D.orange}44`, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: D.orange }}>
          ⚠ {error} — 인터넷 연결을 확인하거나, API 서버가 잠시 후 재시도됩니다.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <MacroHeatmap data={apiData?.countries ?? null} loading={loading} />
        <CompareChart apiData={apiData} loading={loading} />
      </div>

      {/* 데이터 소스 안내 */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, color: D.muted, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span>📡 <strong style={{ color: D.sub }}>Yahoo Finance</strong> — NVDA·PLTR 36개월 월봉 (실시간)</span>
          <span>🏦 <strong style={{ color: D.sub }}>World Bank API</strong> — CPI·실업률·정부부채 (연간, 무료·무인증)</span>
          <span>📊 <strong style={{ color: D.sub }}>FRED CSV</strong> — 미국 기준금리 시계열 (무료·무인증)</span>
          <span>📋 <strong style={{ color: D.sub }}>폴백 상수</strong> — 타국 기준금리 (분기 수동 업데이트)</span>
        </div>
      </div>
    </div>
  )
}
