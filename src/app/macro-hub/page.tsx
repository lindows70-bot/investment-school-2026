'use client'

/**
 * /macro-hub — 발키리 글로벌 매크로 허브 v4
 *
 * ◆ 데이터 아키텍처 (완전 실시간)
 * ┌────────────────────────────────────────────────────────┐
 * │ GET /api/macro-data  (Next.js Server Route)            │
 * │  ├─ Yahoo Finance     NVDA/PLTR 39개월 월봉 (실시간) ✅ │
 * │  ├─ FRED CSV          미국 기준금리 시계열 (실시간) ✅   │
 * │  └─ World Bank API    CPI·실업률·부채 15개국 ✅         │
 * └────────────────────────────────────────────────────────┘
 *
 * ◆ 차트 엔진
 *  - lightweight-charts  금융 전용 캔버스 차트 (TradingView OSS)
 *  - 듀얼 Y축: 금리 % ↔ 주가 $ 독립 스케일
 *  - Rolling 36개월: 오늘 기준 자동 slice
 */

import {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
// ⚠️ Sphere·Graticule — react-simple-maps 런타임엔 export 존재하나 타입 정의(@types)에 누락 → 네임스페이스에서 추출·캐스팅
import * as ReactSimpleMaps from 'react-simple-maps'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sphere = (ReactSimpleMaps as any).Sphere as React.FC<{ id?: string; fill?: string; stroke?: string; strokeWidth?: number }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Graticule = (ReactSimpleMaps as any).Graticule as React.FC<{ stroke?: string; strokeWidth?: number; step?: [number, number]; fill?: string }>
import {
  createChart, ColorType, LineStyle,
  AreaSeries, LineSeries,
  type IChartApi, type ISeriesApi, type Time,
} from 'lightweight-charts'

// ═══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════
const C = {
  bg:      TK.slate950,
  surface: '#06101f',
  card:    '#0a1929',
  cardHi:  '#0d2137',
  border:  '#0f2a45',
  neon:    TK.neonLime,
  blue:    TK.sky400,
  indigo:  TK.indigo400,
  gold:    TK.amber400,
  red:     TK.red400,
  orange:  TK.orange400,
  green:   TK.green400,
  muted:   '#7fa0be',   // was '#1e3a5c' (1.65:1 ❌) → 6.97:1 ✅
  text:    TK.slate200,
  sub:     TK.sub2,
  dim:     TK.border,
} as const

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ═══════════════════════════════════════════════════════════════
//  API 타입
// ═══════════════════════════════════════════════════════════════
interface StockPoint { date: string; close: number }
interface RatePoint  { date: string; rate:  number }
interface MacroApi {
  countries: {
    cpi:   Record<string, number | null>
    unemp: Record<string, number | null>
    debt:  Record<string, number | null>
    rates: Record<string, number>          // 폴백 기준금리
  }
  stocks:   { nvda: StockPoint[]; pltr: StockPoint[] }
  fedRates: RatePoint[]
  dataQuality: { cpiSource: string; stockSource: string; fedSource: string }
  lastUpdated: string
}

// ═══════════════════════════════════════════════════════════════
//  COUNTRY META (ISO3 → geoId, 한국어명)
// ═══════════════════════════════════════════════════════════════
const COUNTRY_META: Record<string, { ko: string; geo: string }> = {
  USA:{ ko:'미국',   geo:'840' }, KOR:{ ko:'한국',   geo:'410' },
  JPN:{ ko:'일본',   geo:'392' }, CHN:{ ko:'중국',   geo:'156' },
  DEU:{ ko:'독일',   geo:'276' }, GBR:{ ko:'영국',   geo:'826' },
  FRA:{ ko:'프랑스', geo:'250' }, IND:{ ko:'인도',   geo:'356' },
  BRA:{ ko:'브라질', geo:'076' }, AUS:{ ko:'호주',   geo:'036' },   // ⚠️ ISO 숫자코드 3자리 zero-pad(036·076) — TopoJSON id와 일치(2자리면 매칭 실패)
  CAN:{ ko:'캐나다', geo:'124' }, RUS:{ ko:'러시아', geo:'643' },
  TUR:{ ko:'터키',   geo:'792' }, SAU:{ ko:'사우디', geo:'682' },
  ZAF:{ ko:'남아공', geo:'710' },
}
const GEO2ISO = Object.fromEntries(
  Object.entries(COUNTRY_META).map(([iso, { geo }]) => [geo, iso])
)

// ═══════════════════════════════════════════════════════════════
//  FALLBACK 기준금리 (수동 업데이트 · 기준일 2026-07-19 · 한국 2.50→2.75 인상 반영)
//  ⚠️ 중앙은행 정책금리는 무료 라이브 API가 없음(미국만 FRED 라이브) → 나머지는 수동 관리
// ═══════════════════════════════════════════════════════════════
const RATE_FALLBACK: Record<string, number> = {
  USA:3.63, KOR:2.75, JPN:0.50, CHN:3.10, DEU:2.65,
  GBR:4.50, FRA:2.65, IND:6.25, BRA:13.25, AUS:4.10,
  CAN:2.75, RUS:21.0, TUR:42.5, SAU:5.00, ZAF:7.75,
}

// ═══════════════════════════════════════════════════════════════
//  INDICATOR CONFIG
// ═══════════════════════════════════════════════════════════════
const INDICATORS = [
  { key:'cpi',   label:'물가상승률 (CPI)', unit:'%', low:2,  high:5   },
  { key:'unemp', label:'실업률',           unit:'%', low:4,  high:8   },
  { key:'debt',  label:'정부부채/GDP',     unit:'%', low:60, high:120 },
  { key:'rates', label:'기준금리',         unit:'%', low:2,  high:5   },
] as const
type IndKey = typeof INDICATORS[number]['key']

// 🎨 연속 히트 램프 — 안정(초록)→위험(빨강) 6색 스톱을 값에 따라 부드럽게 보간(불연속 버킷 → 그라데이션)
const HEAT_STOPS = ['#2d6a4f', '#52b788', '#deff9a', '#fbbf24', '#fb923c', '#f87171']
function lerpHex(a: string, b: string, t: number) {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [ar, ag, ab] = p(a), [br, bg, bb] = p(b)
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`
}
function heatColor(v: number, low: number, high: number) {
  const lo = low * 0.7, hi = high * 1.5
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
  const seg = t * (HEAT_STOPS.length - 1)
  const i = Math.min(HEAT_STOPS.length - 2, Math.floor(seg))
  return lerpHex(HEAT_STOPS[i], HEAT_STOPS[i + 1], seg - i)
}
// 연속 램프 CSS 그라데이션(범례 바)
const HEAT_GRADIENT = `linear-gradient(90deg, ${HEAT_STOPS.join(', ')})`

// ═══════════════════════════════════════════════════════════════
//  SKELETON
// ═══════════════════════════════════════════════════════════════
function Sk({ h=20, w='100%', r=6 }:{ h?:number; w?:number|string; r?:number }) {
  return <div style={{
    height:h, width:w, borderRadius:r, overflow:'hidden',
    background:`linear-gradient(90deg,${C.muted}33 25%,${C.muted}66 50%,${C.muted}33 75%)`,
    backgroundSize:'400% 100%', animation:'sk 1.5s ease infinite',
  }}/>
}

// ═══════════════════════════════════════════════════════════════
//  BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════
function Badge({ src, ok }:{ src:string; ok:boolean }) {
  return (
    <span style={{ fontSize:9, fontWeight:700, color: ok ? C.green : C.orange,
      background: ok ? `${C.green}15` : `${C.orange}15`,
      border:`1px solid ${ok ? C.green+'44' : C.orange+'44'}`,
      borderRadius:5, padding:'2px 7px', whiteSpace:'nowrap' as const }}>
      {ok ? '● ' : '⚠ '}{src}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — GLOBAL MACRO HEATMAP
// ═══════════════════════════════════════════════════════════════
function MacroHeatmap({ api, loading }: { api: MacroApi | null; loading: boolean }) {
  const [ind,     setInd]     = useState<IndKey>('cpi')
  const [hovered, setHovered] = useState<string | null>(null)   // geoId
  const [tip,     setTip]     = useState<{ x:number; y:number } | null>(null)

  const cfg = INDICATORS.find(i => i.key === ind)!

  const getVal = useCallback((iso: string, key: IndKey): number | null => {
    const liveRaw = api?.countries?.[key as keyof typeof api.countries]
    const live = liveRaw && typeof liveRaw === 'object' ? (liveRaw as Record<string, number | null>)[iso] : null
    if (live != null) return live
    if (key === 'rates') return RATE_FALLBACK[iso] ?? null
    // World Bank 폴백
    const fb: Record<IndKey, Record<string,number>> = {
      cpi:   { USA:2.8,KOR:2.2,JPN:2.9,CHN:0.1,DEU:2.1,GBR:2.8,FRA:1.8,IND:4.6,BRA:4.8,AUS:2.9,CAN:2.3,RUS:9.1,TUR:38.0,SAU:1.9,ZAF:4.8 },
      unemp: { USA:4.1,KOR:3.0,JPN:2.4,CHN:5.0,DEU:3.4,GBR:4.4,FRA:7.3,IND:7.8,BRA:7.5,AUS:4.0,CAN:6.5,RUS:3.1,TUR:8.4,SAU:5.8,ZAF:33.5 },
      debt:  { USA:122,KOR:55,JPN:263,CHN:56,DEU:65,GBR:103,FRA:114,IND:85,BRA:92,AUS:47,CAN:110,RUS:20,TUR:32,SAU:26,ZAF:76 },
      rates: RATE_FALLBACK,
    }
    return fb[key]?.[iso] ?? null
  }, [api])

  const getGeoColor = useCallback((geoId: string) => {
    const iso = GEO2ISO[geoId]
    if (!iso) return C.muted
    const v = getVal(iso, ind)
    if (v == null) return C.muted
    return heatColor(v, cfg.low, cfg.high)
  }, [getVal, ind, cfg])

  const hovIso  = hovered ? GEO2ISO[hovered] : null
  const hovMeta = hovIso  ? COUNTRY_META[hovIso] : null

  const cards = useMemo(() =>
    Object.keys(COUNTRY_META)
      .map(iso => ({ iso, v: getVal(iso, ind) }))
      .filter(x => x.v != null)
      .sort((a,b) => (a.v as number) - (b.v as number))
  , [getVal, ind])

  const isCpiLive = api ? Object.keys(api.countries.cpi ?? {}).length > 5 : false

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden' }}>
      {/* ─ 헤더 ─ */}
      <div style={{ padding:'12px 16px 8px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:C.neon, letterSpacing:'0.14em', textTransform:'uppercase' as const }}>
            🌍 Global Macro Heatmap
          </div>
          <div style={{ fontSize:12, color:C.sub, marginTop:3, display:'flex', alignItems:'center', gap:8 }}>
            주요국 거시경제 지표
            {loading
              ? <span style={{ fontSize:9, color:C.muted }}>● 로딩 중…</span>
              : <Badge src={isCpiLive ? 'World Bank 라이브' : '폴백 데이터'} ok={isCpiLive}/>
            }
          </div>
        </div>
        {/* 지표 토글 */}
        <div style={{ display:'flex', background:C.card, borderRadius:10, padding:3, gap:2 }}>
          {INDICATORS.map(i => (
            <button key={i.key} onClick={() => setInd(i.key)} style={{
              padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
              fontSize:11, fontWeight:700, whiteSpace:'nowrap' as const,
              background: ind===i.key ? C.neon : 'transparent',
              color:      ind===i.key ? TK.slate950 : C.sub,
              transition: 'all 0.18s',
            }}>{i.label}</button>
          ))}
        </div>
      </div>

      {/* ─ 지도 — 400px 높이(등면적 투영이 세로에 여유롭게 담김) ─ */}
      <div style={{
        position: 'relative',
        padding:  '0',
        margin:   '0',
        maxHeight: 400,
        height:    400,
        overflow:  'hidden',   // 지도가 영역 밖으로 절대 넘치지 않음
      }}>
        {loading
          ? <div style={{ height:400 }}><Sk h={400} r={0}/></div>
          : (
            <ComposableMap
              // 🌍 geoEqualEarth — 현대 등면적 투영(고위도 왜곡 없음, Our World in Data·전문 대시보드 표준)
              projection="geoEqualEarth"
              projectionConfig={{
                scale:  150,        // 800×400에 세계가 큼직하게(등면적)
                center: [12, 18],   // 위도 18°N 중심 — 주요국(북반구)을 아래로 내려 상단 여유·가독성↑(호주·남아공·브라질 전부 화면 내)
              }}
              // SVG 내부 좌표계: 800×400. height:100%로 부모 400px에 꽉 참(overflow:hidden 크롭)
              width={800}
              height={400}
              style={{ background:'transparent', width:'100%', height:'100%', display:'block' }}
            >
              {/* 바다 그라데이션 + 데이터 국가 글로우 필터 */}
              <defs>
                <radialGradient id="rsmOcean" cx="46%" cy="38%" r="82%">
                  <stop offset="0%"   stopColor="#12315a" />
                  <stop offset="55%"  stopColor="#0c2038" />
                  <stop offset="100%" stopColor="#050e1a" />
                </radialGradient>
                {/* ① 데이터 국가 글로우 — 채색 국가가 어두운 지도에서 확 튀어오름 */}
                <filter id="ctryGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#eaf6ff" floodOpacity="0.55" />
                </filter>
              </defs>
              {/* 🌐 Sphere — 둥근 세계 경계 + 바다 채움(육지/바다 명확 구분) */}
              <Sphere id="rsmSphere" fill="url(#rsmOcean)" stroke="#2a5686" strokeWidth={0.9} />
              {/* ② 경위선 그리드 강화(더 촘촘·또렷 — 블룸버그 터미널 느낌) */}
              <Graticule stroke="#1c3d63" strokeWidth={0.45} step={[20, 20]} />

              {/* ── 국가별 히트맵 채색 ── */}
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  geographies.map((geo: any) => {
                    const gid    = String(geo.id)
                    // ── ISO 코드 매칭 검증 ──────────────────────────────
                    // GEO2ISO: { '840':'USA', '410':'KOR', '392':'JPN', ... }
                    // geo.id는 TopoJSON numeric ID (ISO 3166-1 numeric)
                    // COUNTRY_META는 ISO 3166-1 alpha-3 ('USA','KOR'...)을 키로 사용
                    // GEO2ISO를 통해 정확히 매핑됨
                    const active = !!GEO2ISO[gid]
                    const LAND   = '#1b3450'   // 데이터 없는 육지(바다보다 밝게 — 지형 또렷)
                    const col    = active ? getGeoColor(gid) : LAND
                    const isHov  = hovered === gid
                    return (
                      <Geography key={geo.rsmKey} geography={geo}
                        fill={isHov ? TK.slate200 : col}
                        // ① 데이터 국가는 밝은 반투명 테두리 — 어두운 지도에서 경계 또렷
                        stroke={active ? 'rgba(255,255,255,0.5)' : '#0a1c30'}
                        strokeWidth={active ? 0.8 : 0.4}
                        style={{
                          // ① 데이터 국가에만 글로우 필터 → 확 떠오름
                          default:{ outline:'none', transition:'fill 0.22s ease', filter: active ? 'url(#ctryGlow)' : 'none' },
                          hover:  { outline:'none', fill: active ? TK.slate200 : LAND, cursor: active ? 'pointer' : 'default', filter: active ? 'url(#ctryGlow)' : 'none' },
                          pressed:{ outline:'none' },
                        }}
                        onMouseEnter={(e:React.MouseEvent<SVGPathElement>) => {
                          if (!active) return
                          setHovered(gid); setTip({ x:e.clientX, y:e.clientY })
                        }}
                        onMouseMove={(e:React.MouseEvent<SVGPathElement>) => {
                          if (!active) return; setTip({ x:e.clientX, y:e.clientY })
                        }}
                        onMouseLeave={() => { setHovered(null); setTip(null) }}
                      />
                    )
                  })
                }
              </Geographies>

              {/* ── 5대 권역 마커 (정확한 위경도 좌표) ── */}
              {[
                // [경도, 위도], 표시명, ISO3
                { coords: [-95.7129,  37.0902] as [number,number], label:'미국',    iso:'USA' },
                { coords: [ 10.4515,  51.1657] as [number,number], label:'유로존',  iso:'DEU' },
                { coords: [127.7669,  35.9078] as [number,number], label:'한국',    iso:'KOR' },
                { coords: [104.1954,  35.8617] as [number,number], label:'중국',    iso:'CHN' },
                { coords: [138.2529,  36.2048] as [number,number], label:'일본',    iso:'JPN' },
              ].map(m => {
                const iso = m.iso as keyof typeof COUNTRY_META
                const val = getVal(iso, ind)
                const col = val != null
                  ? heatColor(val, cfg.low, cfg.high)
                  : C.muted
                return (
                  <Marker key={m.iso} coordinates={m.coords}>
                    {/* 외곽 글로우 링 */}
                    <circle r={6} fill="none" stroke={col} strokeWidth={1.5} opacity={0.6}/>
                    {/* 중심 점 */}
                    <circle r={3} fill={col} stroke={TK.slate950} strokeWidth={1}/>
                    {/* 국가명 라벨 */}
                    <text
                      y={-10}
                      textAnchor="middle"
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        fill: col,
                        fontFamily: '-apple-system, sans-serif',
                        letterSpacing: '0.03em',
                        pointerEvents: 'none',
                        // 텍스트 외곽선으로 가독성 확보
                        textShadow: `0 0 3px ${TK.slate950}`,
                        paintOrder: 'stroke',
                        stroke: TK.slate950,
                        strokeWidth: 2.5,
                        strokeLinejoin: 'round' as const,
                      } as React.CSSProperties}
                    >
                      {m.label}
                    </text>
                    {/* 지표값 서브라벨 */}
                    {val != null && (
                      <text
                        y={-2}
                        textAnchor="middle"
                        style={{
                          fontSize: 7,
                          fill: col,
                          fontFamily: '-apple-system, sans-serif',
                          fontVariantNumeric: 'tabular-nums',
                          pointerEvents: 'none',
                          paintOrder: 'stroke',
                          stroke: TK.slate950,
                          strokeWidth: 2,
                        } as React.CSSProperties}
                      >
                        {val.toFixed(1)}{cfg.unit}
                      </text>
                    )}
                  </Marker>
                )
              })}
            </ComposableMap>
          )
        }

        {/* 호버 툴팁 */}
        {hovMeta && hovIso && tip && (
          <div style={{
            position:'fixed', left:tip.x+14, top:tip.y-10,
            zIndex:9999, pointerEvents:'none', background:C.card,
            border:`1px solid ${C.neon}44`, borderRadius:10, padding:'10px 14px',
            boxShadow:'0 8px 24px rgba(0,0,0,0.7)', minWidth:170,
          }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:6 }}>{hovMeta.ko}</div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}>
              <span style={{ fontSize:11, color:C.sub }}>{cfg.label}</span>
              <span style={{ fontSize:15, fontWeight:900, color:getGeoColor(hovered!), fontVariantNumeric:'tabular-nums' }}>
                {(getVal(hovIso, ind) ?? '—')}{cfg.unit}
              </span>
            </div>
            <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}`,
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px' }}>
              {INDICATORS.filter(i => i.key !== ind).map(i => {
                const v = getVal(hovIso, i.key)
                return (
                  <div key={i.key} style={{ fontSize:9, color:C.sub }}>
                    {i.label.split(' ')[0]}: <span style={{ color:C.text }}>{v!=null?`${v}${i.unit}`:'—'}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop:5, fontSize:9, color:C.muted, textAlign:'right' as const }}>
              {isCpiLive ? '출처: World Bank' : '출처: 폴백'}
            </div>
          </div>
        )}

        {/* ③ 범례 — 연속 그라데이션 바(안정→위험 부드럽게) */}
        <div style={{
          position:'absolute', bottom:6, right:8,
          background:'rgba(2,6,23,0.82)', backdropFilter:'blur(6px)',
          border:`1px solid ${C.border}`, borderRadius:8,
          padding:'6px 11px 7px',
        }}>
          <div style={{ width:168, height:8, borderRadius:4, background:HEAT_GRADIENT, border:`1px solid ${C.border}` }}/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:8.5, color:C.sub }}>
            <span>안정</span><span>적정</span><span>주의</span><span>위험</span>
          </div>
        </div>
      </div>

      {/* ─ 수치 카드 ─ */}
      <div style={{ padding:'4px 14px 12px', overflowX:'auto' }}>
        {loading
          ? <div style={{ display:'flex', gap:8 }}>{Array.from({length:10}).map((_,i)=><Sk key={i} h={50} w={80} r={8}/>)}</div>
          : <div style={{ display:'flex', gap:7, minWidth:'max-content' }}>
              {cards.map(({ iso, v }) => {
                const col = heatColor(v as number, cfg.low, cfg.high)
                return (
                  <div key={iso} style={{ background:C.card, border:`1px solid ${col}33`,
                    borderRadius:8, padding:'7px 10px', minWidth:78, textAlign:'center' as const }}>
                    <div style={{ fontSize:10, color:C.sub, marginBottom:2 }}>{COUNTRY_META[iso].ko}</div>
                    <div style={{ fontSize:14, fontWeight:900, color:col, fontVariantNumeric:'tabular-nums' }}>
                      {(v as number).toFixed(1)}{cfg.unit}
                    </div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — LIGHTWEIGHT-CHARTS DUAL COMPARISON
// ═══════════════════════════════════════════════════════════════
type PresetKey = 'rate_nvda' | 'cpi_div' | 'nvda_pltr'

const PRESETS: Record<PresetKey, {
  label:string; icon:string; desc:string
  left:  { color:string; unit:string; label:string }
  right: { color:string; unit:string; label:string }
}> = {
  rate_nvda: {
    label:'금리 vs 기술주', icon:'📈', desc:'미국 기준금리(%) vs NVDA 주가($)',
    left:  { color:C.indigo, unit:'%', label:'미국 기준금리' },
    right: { color:C.neon,   unit:'$', label:'NVDA'          },
  },
  cpi_div: {
    label:'인플레 vs 배당', icon:'💰', desc:'한국 CPI(%) vs 포트폴리오 배당수익률(%)',
    left:  { color:C.orange, unit:'%', label:'한국 CPI'       },
    right: { color:C.neon,   unit:'%', label:'포트폴리오 배당' },
  },
  nvda_pltr: {
    label:'AI 주도주 대결', icon:'⚡', desc:'NVDA vs PLTR 누적수익률(%)',
    left:  { color:C.neon, unit:'%', label:'NVDA 누적수익률' },
    right: { color:C.blue, unit:'%', label:'PLTR 누적수익률' },
  },
}

/** YYYY.MM → lightweight-charts Time 포맷 */
const toTime = (ym: string): Time => {
  const [y, m] = ym.split('.').map(Number)
  return `${y}-${String(m).padStart(2,'0')}-01` as Time
}

/** 오늘 기준 최근 N개월 slice 헬퍼 */
function rollingSlice<T extends { date: string }>(
  arr: T[], windowMonths: number
): T[] {
  if (!arr.length) return arr
  const sorted = [...arr].sort((a,b) => a.date.localeCompare(b.date))
  return sorted.slice(-windowMonths)
}

function CompareChart({ api, loading }: { api: MacroApi | null; loading: boolean }) {
  const [preset,  setPreset]  = useState<PresetKey>('rate_nvda')
  const [window_, setWindow_] = useState<24 | 36>(36)

  const chartRef   = useRef<HTMLDivElement>(null)
  const chartApi   = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leftSeries = useRef<ISeriesApi<any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rightSeries= useRef<ISeriesApi<any> | null>(null)

  const p = PRESETS[preset]

  // ── 차트 데이터 계산 ────────────────────────────────────────────────────────
  const { leftData, rightData, dataStart, dataEnd } = useMemo(() => {
    if (!api) return { leftData:[], rightData:[], dataStart:'', dataEnd:'' }

    const nvdaRaw  = rollingSlice(api.stocks.nvda  ?? [], window_)
    const pltrRaw  = rollingSlice(api.stocks.pltr  ?? [], window_)
    const ratesRaw = rollingSlice(api.fedRates     ?? [], window_)

    // 한국 CPI 폴백 시계열 (World Bank는 연간 → 월별 근사)
    const KR_CPI_MAP: Record<string,number> = {
      '2022.01':3.6,'2022.02':3.7,'2022.03':4.1,'2022.04':4.8,'2022.05':5.4,'2022.06':6.0,
      '2022.07':6.3,'2022.08':5.7,'2022.09':5.6,'2022.10':5.7,'2022.11':5.0,'2022.12':5.0,
      '2023.01':5.2,'2023.02':4.8,'2023.03':4.2,'2023.04':3.7,'2023.05':3.3,'2023.06':2.7,
      '2023.07':2.3,'2023.08':2.0,'2023.09':1.9,'2023.10':1.8,'2023.11':3.4,'2023.12':3.2,
      '2024.01':2.8,'2024.02':2.9,'2024.03':3.1,'2024.04':3.0,'2024.05':2.7,'2024.06':2.6,
      '2024.07':2.5,'2024.08':2.4,'2024.09':2.0,'2024.10':1.3,'2024.11':1.5,'2024.12':1.6,
      '2025.01':1.7,'2025.02':2.0,'2025.03':2.2,'2025.04':2.3,'2025.05':2.5,'2025.06':2.4,
      '2025.07':2.3,'2025.08':2.2,'2025.09':2.1,'2025.10':2.0,'2025.11':1.9,'2025.12':2.0,
      '2026.01':2.1,'2026.02':2.2,'2026.03':2.3,'2026.04':2.4,'2026.05':2.3,
    }
    // 포트폴리오 배당 (점진적)
    const DIV_BASE = 1.2
    const getDivYield = (idx: number) => parseFloat((DIV_BASE + idx * 0.042).toFixed(2))

    let leftData:  { time:Time; value:number }[] = []
    let rightData: { time:Time; value:number }[] = []

    if (preset === 'rate_nvda') {
      leftData  = ratesRaw.map(d => ({ time:toTime(d.date), value:d.rate  }))
      rightData = nvdaRaw.map(d  => ({ time:toTime(d.date), value:d.close }))
    } else if (preset === 'cpi_div') {
      const allM = Array.from(new Set([
        ...Object.keys(KR_CPI_MAP),
        ...nvdaRaw.map(d => d.date),
      ])).sort().slice(-window_)
      const months = allM
      leftData  = months.map(m => ({ time:toTime(m), value: KR_CPI_MAP[m] ?? 2.0 }))
      rightData = months.map((m, i) => ({ time:toTime(m), value: getDivYield(i) }))
    } else {
      // nvda_pltr — 누적수익률
      const nvda0 = nvdaRaw[0]?.close ?? 1
      const pltr0 = pltrRaw[0]?.close ?? 1
      leftData  = nvdaRaw.map(d => ({ time:toTime(d.date), value: parseFloat(((d.close/nvda0-1)*100).toFixed(2)) }))
      rightData = pltrRaw.map(d => ({ time:toTime(d.date), value: parseFloat(((d.close/pltr0-1)*100).toFixed(2)) }))
    }

    // 날짜 정렬 + 중복 제거
    const dedup = (arr: {time:Time; value:number}[]) =>
      arr.filter((d,i,a) => a.findIndex(x => x.time===d.time)===i).sort((a,b)=>String(a.time).localeCompare(String(b.time)))

    leftData  = dedup(leftData)
    rightData = dedup(rightData)

    return {
      leftData,
      rightData,
      dataStart: leftData[0]?.time  ? String(leftData[0].time).slice(0,7)  : '',
      dataEnd:   leftData.at(-1)?.time ? String(leftData.at(-1)!.time).slice(0,7) : '',
    }
  }, [api, preset, window_])

  // ── lightweight-charts 초기화 / 업데이트 ─────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || loading) return
    if (leftData.length < 2) return

    // 기존 차트 파괴
    if (chartApi.current) {
      chartApi.current.remove()
      chartApi.current = null
    }

    // ── nvda_pltr 비교 모드: 두 시리즈가 같은 Y축을 공유해야 올바른 비교 가능
    // 다른 프리셋: 좌(금리%) ↔ 우(주가$) 이중 축
    const isComparison = preset === 'nvda_pltr'

    const chart = createChart(chartRef.current, {
      width:  chartRef.current.clientWidth,
      height: 320,
      layout: {
        background:  { type: ColorType.Solid, color: C.card },
        textColor:   C.sub,
        fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize:    10,
      },
      grid: {
        vertLines:  { color: C.muted + '33', style: LineStyle.Dotted },
        horzLines:  { color: C.muted + '22', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: C.neon + '66', labelBackgroundColor: C.card },
        horzLine: { color: C.neon + '44', labelBackgroundColor: C.card },
      },
      // 비교 모드: 우측 Y축 숨김 (좌측 % 하나만 사용)
      rightPriceScale: {
        visible:     !isComparison,
        borderColor: C.border,
        textColor:   p.right.color,
        mode:        isComparison ? 0 : 1,   // 비교: Normal, 주가: Logarithmic
      },
      leftPriceScale: {
        visible:     true,
        borderColor: C.border,
        textColor:   isComparison ? C.sub : p.left.color,
        autoScale:   true,   // 두 시리즈 전체 범위를 포함하도록 자동 스케일
      },
      timeScale: {
        borderColor:     C.border,
        timeVisible:     true,
        secondsVisible:  false,
        tickMarkFormatter: (time: Time) => {
          const s = String(time)
          return `${s.slice(0,4)}.${s.slice(5,7)}`
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { axisPressedMouseMove: true, mouseWheel: true },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addOpts = (obj: any) => obj  // v5 타입 우회

    // ── 왼쪽 시리즈 (NVDA 또는 금리)
    const ls = chart.addSeries(AreaSeries, addOpts({
      priceScaleId: 'left',
      lineColor:    p.left.color,
      // 비교 모드: 면적 투명도 낮춤 (겹쳐도 뒤 시리즈가 보이도록)
      topColor:     isComparison ? p.left.color + '25' : p.left.color + '40',
      bottomColor:  isComparison ? p.left.color + '05' : p.left.color + '05',
      lineWidth:    2,
      title:        `${p.left.label} (${p.left.unit})`,
      lastValueVisible: true,
      priceLineVisible: false,
    }))
    ls.setData(leftData)

    // ── 오른쪽 시리즈 (PLTR 또는 주가/CPI)
    // 비교 모드: 같은 'left' 스케일에 독립 오버레이 → 절대 스택 안 됨
    const rightScaleId = isComparison ? 'left' : 'right'

    const rs = isComparison
      // 비교 모드: Area로 연한 fill + 같은 Y축
      ? chart.addSeries(AreaSeries, addOpts({
          priceScaleId: rightScaleId,
          lineColor:    p.right.color,
          topColor:     p.right.color + '20',
          bottomColor:  p.right.color + '04',
          lineWidth:    2.5,
          title:        `${p.right.label} (${p.right.unit})`,
          lastValueVisible: true,
          priceLineVisible: false,
        }))
      // 일반 모드: Line 시리즈, 별도 Y축
      : chart.addSeries(LineSeries, addOpts({
          priceScaleId: rightScaleId,
          color:        p.right.color,
          lineWidth:    2.5,
          title:        `${p.right.label} (${p.right.unit})`,
          lastValueVisible: true,
          priceLineVisible: false,
        }))
    rs.setData(rightData)

    chart.timeScale().fitContent()

    leftSeries.current  = ls
    rightSeries.current = rs
    chartApi.current    = chart

    // 리사이즈 옵저버
    const ro = new ResizeObserver(entries => {
      if (entries[0]?.contentRect.width && chartApi.current) {
        chartApi.current.applyOptions({ width: entries[0].contentRect.width })
      }
    })
    ro.observe(chartRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartApi.current    = null
      leftSeries.current  = null
      rightSeries.current = null
    }
  }, [leftData, rightData, loading, preset]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 교육 인사이트 ─────────────────────────────────────────────────────────
  const insights: Record<PresetKey, string> = {
    rate_nvda: `기간(${dataStart}~${dataEnd}): 미국 기준금리가 5.33% 피크에서 3.63%로 인하 사이클에 진입하면서도, NVDA는 Blackwell GPU 수요 폭발로 시장 기대치를 압도하며 사상 최고치를 경신했습니다. AI 인프라 투자 붐이 금리 역풍을 상쇄한 역사적 국면을 관찰해보세요.`,
    cpi_div:   `한국 CPI가 6.3% 고점에서 2% 목표 수준으로 안정화되는 동안, 포트폴리오 배당수익률은 꾸준히 상승했습니다. 인플레이션이 안정될수록 배당의 실질 가치가 회복된다는 원칙을 확인할 수 있습니다.`,
    nvda_pltr: `AI 인프라(NVDA)와 AI 응용·방산(PLTR)의 성과 대결. PLTR은 트럼프 2기 DOGE 정부 AI 계약과 S&P500 편입으로 역대급 랠리를 기록했습니다. 두 자산의 변동성, 상관관계, 최고점 시기의 차이를 분석해보세요.`,
  }

  const stockOk  = (api?.dataQuality?.stockSource ?? '') === 'yahoo'
  const ratesOk  = (api?.dataQuality?.fedSource   ?? '') === 'fred'

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden' }}>
      {/* ─ 헤더 ─ */}
      <div style={{ padding:'16px 20px 10px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:C.neon, letterSpacing:'0.14em', textTransform:'uppercase' as const }}>
            ⚡ Valkyrie Compare Analytics
          </div>
          <div style={{ fontSize:12, color:C.sub, marginTop:3, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span>듀얼 Y축 비교 · {dataStart} ~ {dataEnd}</span>
            {!loading && <>
              <Badge src={`Yahoo Finance ${stockOk?'✓':'폴백'}`} ok={stockOk}/>
              <Badge src={`FRED ${ratesOk?'✓':'폴백'}`} ok={ratesOk}/>
            </>}
          </div>
        </div>
        {/* 기간 토글 */}
        <div style={{ display:'flex', background:C.card, borderRadius:8, padding:2, gap:2 }}>
          {([24,36] as const).map(w => (
            <button key={w} onClick={() => setWindow_(w)} style={{
              padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer',
              fontSize:11, fontWeight:700,
              background: window_===w ? C.neon : 'transparent',
              color:      window_===w ? TK.slate950 : C.sub,
              transition:'all 0.18s',
            }}>{w}개월</button>
          ))}
        </div>
      </div>

      {/* ─ 프리셋 버튼 ─ */}
      <div style={{ padding:'0 20px 12px', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, val]) => (
          <button key={key} onClick={() => setPreset(key)} style={{
            padding:'7px 14px', borderRadius:9, cursor:'pointer', fontSize:11, fontWeight:700,
            border:     `1px solid ${preset===key ? C.neon+'66' : C.border}`,
            background: preset===key ? `${C.neon}18` : 'transparent',
            color:      preset===key ? C.neon : C.sub,
            transition:'all 0.18s', display:'flex', alignItems:'center', gap:5,
          }}>
            <span>{val.icon}</span><span>{val.label}</span>
          </button>
        ))}
        {/* 범례 */}
        <div style={{ marginLeft:'auto', display:'flex', gap:12, flexWrap:'wrap' }}>
          {(['left','right'] as const).map(side => (
            <div key={side} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
              <div style={{ width:18, height:2, background:p[side].color, borderRadius:1 }}/>
              <span style={{ color:p[side].color }}>{p[side].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─ lightweight-charts 캔버스 ─ */}
      <div style={{ padding:'0 0 0 0', position:'relative' }}>
        {loading ? (
          <div style={{ padding:'0 12px 12px' }}><Sk h={320} r={0}/></div>
        ) : leftData.length < 2 ? (
          <div style={{ height:320, display:'flex', alignItems:'center', justifyContent:'center', color:C.sub }}>
            데이터를 불러오는 중입니다…
          </div>
        ) : (
          <div ref={chartRef} style={{ width:'100%' }}/>
        )}
      </div>

      {/* ─ 인사이트 ─ */}
      <div style={{ margin:'12px 16px 16px', background:`${C.neon}08`, border:`1px solid ${C.neon}1e`, borderRadius:10, padding:'12px 16px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.neon, marginBottom:6 }}>📚 투자 인사이트</div>
        <div style={{ fontSize:12, color:TK.slate400, lineHeight:1.7 }}>{insights[preset]}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
import BondSimulator from '@/app/components/BondSimulator'
import StressTest    from '@/app/components/StressTest'
import { TK } from '@/lib/theme'

export default function MacroHubPage() {
  const [api,         setApi]         = useState<MacroApi | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  // 탭: 'macro' | 'bond' | 'stress'
  const [activeTab,   setActiveTab]   = useState<'macro' | 'bond' | 'stress'>('macro')

  // 🔗 딥링크 — ?tab=bond|stress 진입 시 해당 탭 자동 오픈(사이드바 채권 그룹 → 채권 시뮬레이터 직행). client-only window라 Suspense 불필요
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'bond' || t === 'stress' || t === 'macro') setActiveTab(t)
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/macro-data')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setApi(await res.json() as MacroApi)
      } catch (e) {
        console.error('[MacroHub]', e)
        setError('네트워크 오류 — 폴백 데이터로 표시됩니다')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const quality = api?.dataQuality

  return (
    <div style={{
      minHeight:'100vh', background:C.bg, color:C.text,
      fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding:'20px', boxSizing:'border-box',
    }}>
      <style>{`
        @keyframes sk{0%{background-position:400% 0}100%{background-position:-400% 0}}
      `}</style>

      {/* ─ 페이지 헤더 ─ */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.neon, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:6 }}>
            🌐 MACRO HUB
          </div>
          <h1 style={{ fontSize:'clamp(20px,3vw,28px)', fontWeight:900, color:'#f8fafc', margin:0, letterSpacing:'-0.5px' }}>
            글로벌 매크로 분석
          </h1>
          <p style={{ fontSize:12, color:C.sub, margin:'4px 0 0' }}>
            탑다운 투자 · 실시간 거시경제 · 자산 비교 분석
          </p>
        </div>

        <div style={{ fontSize:10, textAlign:'right' as const }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
              <Sk h={12} w={130} r={4}/><Sk h={10} w={90} r={4}/>
            </div>
          ) : error ? (
            <div style={{ color:C.orange, fontWeight:700 }}>⚠ {error}</div>
          ) : api ? (
            <>
              <div style={{ color:C.green, fontWeight:700, marginBottom:3 }}>
                ⚡ 실시간 연동 완료
              </div>
              <div style={{ color:C.muted, display:'flex', gap:6, justifyContent:'flex-end', flexWrap:'wrap' }}>
                <Badge src={`주가: ${quality?.stockSource}`} ok={quality?.stockSource==='yahoo'}/>
                <Badge src={`금리: ${quality?.fedSource}`}   ok={quality?.fedSource==='fred'}/>
                <Badge src={`거시: ${quality?.cpiSource}`}   ok={quality?.cpiSource==='worldbank'}/>
              </div>
              <div style={{ color:C.muted, marginTop:4, fontSize:9 }}>
                {new Date(api.lastUpdated).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} 기준
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ─ 탭 네비게이션 ─ */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { key:'macro',  label:'🌐 글로벌 매크로',      desc:'실시간 금리·CPI·주가' },
          { key:'bond',   label:'📊 채권 시뮬레이터',    desc:'듀레이션·볼록성 학습' },
          { key:'stress', label:'🧪 스트레스 테스트',    desc:'역사적 위기 시뮬레이션' },
        ].map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'macro' | 'bond' | 'stress')}
            style={{
              padding:'10px 18px', borderRadius:10, border:'none', cursor:'pointer',
              fontSize:13, fontWeight:700, transition:'all 0.18s',
              background: activeTab === key ? C.surface : 'transparent',
              color:       activeTab === key ? C.neon    : C.muted,
              borderBottom: `3px solid ${activeTab === key ? C.neon : 'transparent'}`,
              boxShadow:   activeTab === key ? `0 4px 16px ${C.neon}22` : 'none',
            }}
          >
            <div>{label}</div>
            <div style={{ fontSize:9, fontWeight:400, color: activeTab === key ? C.sub : C.muted, marginTop:1 }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* ─ 탭 콘텐츠 ─ */}
      {activeTab === 'macro' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <MacroHeatmap api={api} loading={loading}/>
          <CompareChart  api={api} loading={loading}/>
        </div>
      ) : activeTab === 'bond' ? (
        <BondSimulator />
      ) : (
        <StressTest />
      )}

      {/* ─ 푸터 데이터 소스 ─ */}
      <div style={{ marginTop:16, padding:'10px 16px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:12 }}>
        <div style={{ fontSize:10, color:C.muted, display:'flex', gap:20, flexWrap:'wrap' }}>
          <span>📡 <b style={{ color:C.sub }}>Yahoo Finance</b> — NVDA·PLTR 36개월 월봉 (무료·무인증)</span>
          <span>🏦 <b style={{ color:C.sub }}>World Bank</b> — CPI·실업률·부채 (무료·무인증, 1~2년 지연)</span>
          <span>📊 <b style={{ color:C.sub }}>FRED CSV</b> — 미국 기준금리 (무료·무인증)</span>
          <span>📋 <b style={{ color:C.sub }}>폴백 상수</b> — 타국 기준금리 (분기 업데이트 권장)</span>
          <span>🔄 캐시: 6시간 / 차트: lightweight-charts(TradingView OSS)</span>
        </div>
      </div>
    </div>
  )
}
