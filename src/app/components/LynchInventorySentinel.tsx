'use client'

/**
 * LynchInventorySentinel — 재고 vs 매출 데드크로스 센티넬
 *
 * ◆ 데이터 흐름
 *   GET /api/financials/inventory-cross
 *   → results[].quarterlyHistory  (차트 전용 배열)
 *     [{ quarter:"24-Q2", revenueYoY:25.4, inventoryYoY:18.2 }, ...]
 *
 * ◆ 차트 dataKey 매핑 (Recharts)
 *   XAxis       dataKey="quarter"
 *   Bar         dataKey="revenueYoY"   — 매출 YoY(%)
 *   Line        dataKey="inventoryYoY" — 재고 YoY(%)
 *   ReferenceLine y=0 — 기준선
 */

import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  AlertTriangle, ShieldAlert, CheckCircle2,
  PackageOpen, RefreshCw, Info, Database,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN'
type FilterSig   = CrossSignal | 'ALL'

interface QuarterlyHistory {
  quarter:      string   // 'YY-Qn'
  revenueYoY:   number   // 매출 YoY % (0 = 데이터없음)
  inventoryYoY: number   // 재고 YoY %
  hasYoY:       boolean  // 실제 YoY 값 존재 여부
}

interface StockResult {
  ticker:           string
  name:             string
  market:           string
  currency:         string
  unitLabel:        string
  signal:           CrossSignal
  gap:              number
  latestQuarter:    string
  revenueYoY:       number
  inventoryYoY:     number
  consecutiveDanger: number
  quarterlyHistory: QuarterlyHistory[]  // 차트용 정규화 배열
  lynchAlert:       string
  dataSource:       string
}

interface ExcludedItem { ticker: string; name: string; reason: string }

interface ApiResponse {
  results:              StockResult[]
  excludedFromAnalysis?: ExcludedItem[]
  summary:              { danger: number; warning: number; healthy: number; unknown: number }
  message?:             string
  meta?: {
    totalHoldings: number; analyzable: number; excluded: number
    analyzed: number; cacheHit: number; cacheMiss: number; pipeline?: string
  }
}

// ────────────────────────────────────────────────────────────
// 컬러 팔레트
// ────────────────────────────────────────────────────────────
const C = {
  bg:      '#020617', surface: '#0f172a', card: '#1e293b', cardHi: '#263348',
  border:  '#334155', textHi: '#f1f5f9', textMid: '#94a3b8', textLow: '#64748b',
  red:     '#f87171', yellow: '#fbbf24', green: '#4ade80', blue: '#60a5fa',
  // 차트 전용
  barRevenue:   '#3b82f6',   // 매출 YoY 막대 — 파랑
  lineInventory:'#ec4899',   // 재고 YoY 선 — 핑크/빨강
}

const SIGNAL_META: Record<CrossSignal, { color:string; bg:string; border:string; label:string }> = {
  DANGER:   { color:C.red,     bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.30)',   label:'위험' },
  WARNING:  { color:C.yellow,  bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.30)',  label:'주의' },
  HEALTHY:  { color:C.green,   bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.30)',   label:'정상' },
  UNKNOWN:  { color:C.textLow, bg:'rgba(100,116,139,0.10)', border:'rgba(100,116,139,0.25)', label:'분석 중' },
}

// ────────────────────────────────────────────────────────────
// 커스텀 툴팁
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rev = payload.find((p: any) => p.dataKey === 'revenueYoY')?.payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = payload.find((p: any) => p.dataKey === 'inventoryYoY')?.payload
  const hasYoY = rev?.hasYoY ?? false

  const revVal = rev?.revenueYoY ?? 0
  const invVal = inv?.inventoryYoY ?? 0
  const gap    = invVal - revVal
  const isDanger = gap > 0

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 9, padding: '10px 14px', fontSize: 11,
      minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontWeight: 800, color: C.yellow, marginBottom: 8 }}>📅 {label}</div>
      {!hasYoY ? (
        <div style={{ color: C.textLow, fontStyle: 'italic' }}>전년 동기 데이터 없음</div>
      ) : (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:4 }}>
            <span style={{ color: C.textMid }}>매출 YoY</span>
            <span style={{ color: C.barRevenue, fontWeight:700, fontFamily:'monospace' }}>
              {revVal >= 0 ? '+' : ''}{revVal.toFixed(1)}%
            </span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:6 }}>
            <span style={{ color: C.textMid }}>재고 YoY</span>
            <span style={{ color: C.lineInventory, fontWeight:700, fontFamily:'monospace' }}>
              {invVal >= 0 ? '+' : ''}{invVal.toFixed(1)}%
            </span>
          </div>
          <div style={{
            borderTop: `1px solid ${C.border}`, paddingTop: 6,
            display:'flex', justifyContent:'space-between',
          }}>
            <span style={{ color: C.textLow }}>격차(재고-매출)</span>
            <span style={{
              fontWeight: 800, fontFamily: 'monospace',
              color: isDanger ? C.red : C.green,
            }}>
              {gap > 0 ? '+' : ''}{gap.toFixed(1)}%p
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 분기 트렌드 차트 — 핵심 컴포넌트
// ────────────────────────────────────────────────────────────
function QuarterlyChart({ history, unitLabel }: { history: QuarterlyHistory[]; unitLabel: string }) {

  // ★ 차트 데이터는 quarterlyHistory 배열 그대로 사용
  //   dataKey: "quarter" / "revenueYoY" / "inventoryYoY"
  const data = history.length > 0 ? history : []

  if (data.length === 0) {
    return (
      <div style={{
        height: 140, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:8, color: C.textLow,
      }}>
        <RefreshCw size={24} style={{ opacity: 0.3 }} />
        <span style={{ fontSize: 11 }}>분기 데이터 수집 중...</span>
      </div>
    )
  }

  const hasAnyYoY = data.some(d => d.hasYoY)

  return (
    <div>
      {/* 범례 */}
      <div style={{ display:'flex', gap:16, marginBottom:6, paddingLeft:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color: C.textMid }}>
          <div style={{ width:12, height:12, background:C.barRevenue, borderRadius:2 }} />
          매출 YoY(%)
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color: C.textMid }}>
          <div style={{ width:18, height:2, background:C.lineInventory, borderRadius:2 }} />
          재고 YoY(%)
        </div>
        <span style={{ fontSize:9, color: C.textLow, marginLeft:'auto' }}>{unitLabel}</span>
      </div>

      <ResponsiveContainer width="100%" height={145}>
        {/* ★ data={data}: quarterlyHistory 배열 직접 바인딩 */}
        <ComposedChart data={data} margin={{ top:5, right:4, bottom:0, left:-10 }}>
          <CartesianGrid stroke={C.border} strokeDasharray="2 2" vertical={false} />

          {/* ★ XAxis dataKey="quarter" */}
          <XAxis
            dataKey="quarter"
            tick={{ fill: C.textLow, fontSize: 9 }}
            axisLine={false} tickLine={false}
          />
          {/* ★ YAxis: YoY % 단위 */}
          <YAxis
            tick={{ fill: C.textLow, fontSize: 9 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}%`}
          />

          <Tooltip content={<ChartTooltip />} />

          {/* 기준선 y=0 */}
          <ReferenceLine y={0} stroke={C.border} strokeWidth={1.5} />

          {/* ★ Bar dataKey="revenueYoY" — 매출 YoY 막대 */}
          <Bar
            dataKey="revenueYoY"
            name="매출액 YoY (%)"
            maxBarSize={20}
            radius={[2,2,0,0]}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.hasYoY ? C.barRevenue : 'rgba(59,130,246,0.2)'}
                opacity={d.hasYoY ? 0.8 : 0.4}
              />
            ))}
          </Bar>

          {/* ★ Line dataKey="inventoryYoY" — 재고 YoY 선 */}
          <Line
            dataKey="inventoryYoY"
            name="재고자산 YoY (%)"
            stroke={C.lineInventory}
            strokeWidth={2}
            dot={{ r: 3, fill: C.lineInventory, stroke: C.surface, strokeWidth:1.5 }}
            activeDot={{ r:5, fill: C.lineInventory }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {!hasAnyYoY && (
        <div style={{ textAlign:'center', fontSize:10, color: C.textLow, marginTop:4, fontStyle:'italic' }}>
          ※ 전년 동기 데이터 부족 — 차트에 YoY 값 대신 0% 표시됩니다.
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 스켈레톤 카드
// ────────────────────────────────────────────────────────────
function SkeletonCard() {
  const s: React.CSSProperties = {
    background:'linear-gradient(90deg,rgba(30,41,59,.8)25%,rgba(51,65,85,.6)50%,rgba(30,41,59,.8)75%)',
    backgroundSize:'200% 100%', animation:'skshimmer 1.5s infinite', borderRadius:5,
  }
  return (
    <div style={{ padding:'14px 16px', borderRadius:12, background:C.card, border:`1px solid ${C.border}` }}>
      <style>{`@keyframes skshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display:'flex', gap:12, marginBottom:12 }}>
        <div style={{ ...s, width:40, height:40, borderRadius:9, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ ...s, height:11, width:'40%', marginBottom:7 }} />
          <div style={{ ...s, height:9,  width:'65%' }} />
        </div>
        <div style={{ ...s, width:55, height:32, borderRadius:8 }} />
      </div>
      <div style={{ ...s, height:140, borderRadius:8 }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 개별 종목 카드
// ────────────────────────────────────────────────────────────
function StockCard({ r }: { r: StockResult }) {
  const [expanded, setExpanded] = useState(false)
  const sm = SIGNAL_META[r.signal]

  return (
    <div style={{
      borderRadius:12, overflow:'hidden',
      background:C.card, border:`1px solid ${sm.border}`,
    }}>
      {/* 헤더 — 클릭 시 확장 */}
      <div
        style={{ padding:'13px 16px', cursor:'pointer', userSelect:'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>

          {/* 시그널 아이콘 */}
          <div style={{
            flexShrink:0, width:38, height:38, borderRadius:9,
            background:sm.bg, border:`1px solid ${sm.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {r.signal === 'DANGER'  && <AlertTriangle size={19} color={C.red}     />}
            {r.signal === 'WARNING' && <ShieldAlert   size={19} color={C.yellow}  />}
            {r.signal === 'HEALTHY' && <CheckCircle2  size={19} color={C.green}   />}
            {r.signal === 'UNKNOWN' && (
              <RefreshCw size={17} color={C.textLow}
                style={{ animation:'spin 2s linear infinite' }}
              />
            )}
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>

          {/* 종목 정보 */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{
                fontSize:9, padding:'1px 6px', borderRadius:3,
                background:'rgba(96,165,250,0.15)', color:C.blue,
                fontFamily:'monospace', fontWeight:900,
              }}>{r.ticker}</span>
              <span style={{ fontSize:12, fontWeight:800, color:C.textHi }}>{r.name}</span>
              {r.consecutiveDanger >= 2 && (
                <span style={{
                  fontSize:9, padding:'1px 6px', borderRadius:20,
                  background:'rgba(239,68,68,0.15)', color:C.red,
                  border:'1px solid rgba(239,68,68,0.3)', fontWeight:700,
                }}>
                  🔴 {r.consecutiveDanger}분기 연속
                </span>
              )}
            </div>
            {/* 시그널 배지 + 최신 분기 */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{
                fontSize:9, padding:'2px 8px', borderRadius:20,
                background:sm.bg, color:sm.color, border:`1px solid ${sm.border}`,
                fontWeight:800,
              }}>
                {sm.label}
              </span>
              {r.latestQuarter && (
                <span style={{ fontSize:10, color:C.textLow }}>{r.latestQuarter}</span>
              )}
              {r.signal === 'UNKNOWN' && (
                <span style={{ fontSize:9, color:C.textLow, fontStyle:'italic' }}>
                  재무데이터 조회 중
                </span>
              )}
            </div>
          </div>

          {/* 최신 분기 수치 */}
          {r.signal !== 'UNKNOWN' && (
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ display:'flex', gap:14, alignItems:'flex-end', marginBottom:4 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, color:C.blue, marginBottom:1 }}>매출 YoY</div>
                  <div style={{ fontSize:13, fontWeight:900, color:C.blue, fontFamily:'monospace' }}>
                    {r.revenueYoY >= 0 ? '+' : ''}{r.revenueYoY.toFixed(1)}%
                  </div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, color:r.signal==='HEALTHY'?C.green:C.red, marginBottom:1 }}>재고 YoY</div>
                  <div style={{
                    fontSize:13, fontWeight:900, fontFamily:'monospace',
                    color: r.gap > 0 ? C.red : r.gap < -5 ? C.green : C.yellow,
                  }}>
                    {r.inventoryYoY >= 0 ? '+' : ''}{r.inventoryYoY.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <span style={{
                  fontSize:10, padding:'2px 8px', borderRadius:6, fontFamily:'monospace', fontWeight:700,
                  background: r.gap > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                  color: r.gap > 0 ? C.red : C.green,
                }}>
                  격차 {r.gap > 0 ? '+' : ''}{r.gap.toFixed(1)}%p
                </span>
              </div>
            </div>
          )}

          {/* 펼치기 화살표 */}
          <div style={{
            flexShrink:0, fontSize:11, color:C.textLow,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>▼</div>
        </div>
      </div>

      {/* 확장: 분기 차트 + 린치 한마디 */}
      {expanded && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 16px', background:C.surface }}>
          {/* 분기 트렌드 차트 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.textLow, fontWeight:700, marginBottom:8,
              display:'flex', alignItems:'center', gap:5 }}>
              📊 분기별 매출 YoY(막대) vs 재고 YoY(선) 추이
            </div>
            <QuarterlyChart
              history={r.quarterlyHistory}
              unitLabel={r.unitLabel}
            />
          </div>

          {/* 린치 한마디 */}
          <div style={{
            padding:'10px 14px', borderRadius:9,
            background:sm.bg, border:`1px solid ${sm.border}`,
            display:'flex', gap:10, alignItems:'flex-start',
          }}>
            <span style={{ fontSize:14, flexShrink:0 }}>📦</span>
            <div>
              <div style={{ fontSize:9, fontWeight:800, color:sm.color, marginBottom:5 }}>
                피터 린치의 재고 경보
              </div>
              <div style={{ fontSize:11, color:C.textMid, lineHeight:1.8, fontStyle:'italic' }}>
                {r.lynchAlert}
              </div>
            </div>
          </div>

          {/* 데이터 출처 */}
          <div style={{ marginTop:8, fontSize:9, color:C.textLow, textAlign:'right' }}>
            출처: {r.dataSource} · {r.unitLabel}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 비제조업 제외 종목 카드
// ────────────────────────────────────────────────────────────
function ExcludedCard({ item }: { item: ExcludedItem }) {
  return (
    <div style={{
      padding:'10px 14px', borderRadius:10, opacity:0.7,
      background:`linear-gradient(135deg,${C.card},rgba(15,23,42,.6))`,
      border:'1px dashed rgba(100,116,139,.3)',
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{
        flexShrink:0, width:34, height:34, borderRadius:8,
        background:'rgba(100,116,139,.12)', border:'1px dashed rgba(100,116,139,.25)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
      }}>🚫</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <span style={{
            fontSize:9, padding:'1px 6px', borderRadius:3,
            background:'rgba(96,165,250,.12)', color:C.blue,
            fontFamily:'monospace', fontWeight:900,
          }}>{item.ticker}</span>
          <span style={{ fontSize:11, fontWeight:700, color:C.textMid }}>{item.name}</span>
        </div>
        <div style={{ fontSize:10, color:C.textLow, lineHeight:1.5 }}>{item.reason}</div>
      </div>
      <span style={{
        flexShrink:0, fontSize:9, padding:'3px 9px', borderRadius:20,
        background:'rgba(100,116,139,.12)', color:C.textLow,
        border:'1px dashed rgba(100,116,139,.3)', fontWeight:700,
      }}>재고 분석 제외</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function LynchInventorySentinel() {

  const [apiData,   setApiData]   = useState<ApiResponse | null>(null)
  const [excluded,  setExcluded]  = useState<ExcludedItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [filterSig, setFilterSig] = useState<FilterSig>('ALL')
  const [lastFetch, setLastFetch] = useState('')

  // ── 데이터 Fetch ──────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/financials/inventory-cross', { cache: 'no-store' })
      const body = await res.json() as ApiResponse
      if (!res.ok) { setError(body.message ?? `오류 (${res.status})`); return }

      // ★ State 갱신 → 즉시 리렌더링
      setApiData(body)
      setExcluded(body.excludedFromAnalysis ?? [])
      setLastFetch(new Date().toLocaleTimeString('ko-KR'))
    } catch (e) {
      setError('네트워크 오류: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 마운트 시 자동 호출
  useEffect(() => { fetchData() }, [])

  // ── 집계 ─────────────────────────────────────────────────
  const summary = apiData?.summary ?? { danger:0, warning:0, healthy:0, unknown:0 }
  const results = apiData?.results ?? []

  // ── 필터 + 정렬 ──────────────────────────────────────────
  const ORDER: Record<CrossSignal, number> = { DANGER:0, WARNING:1, HEALTHY:2, UNKNOWN:3 }
  const filtered = useMemo(() => {
    const base = filterSig === 'ALL' ? results : results.filter(r => r.signal === filterSig)
    return [...base].sort((a, b) => ORDER[a.signal] - ORDER[b.signal] || b.gap - a.gap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, filterSig])

  // ────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────
  return (
    <div style={{
      marginTop:32,
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div style={{
        padding:'14px 20px 12px',
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:'12px 12px 0 0',
        display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{
          width:36, height:36, borderRadius:9, flexShrink:0,
          background:'rgba(248,113,113,.15)', border:'1px solid rgba(248,113,113,.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <PackageOpen size={18} color={C.red} />
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:900, color:C.textHi }}>
            재고 vs 매출 데드크로스 센티넬
          </div>
          <div style={{ fontSize:11, color:C.textLow, marginTop:1 }}>
            피터 린치 리스크 경보 · 재고가 매출보다 빠르게 쌓이는 종목 추적
          </div>
        </div>

        {/* 새로고침 */}
        <button
          onClick={fetchData} disabled={loading}
          style={{
            marginLeft:'auto', display:'flex', alignItems:'center', gap:5,
            padding:'6px 12px', borderRadius:8,
            border:`1px solid ${C.border}`, background:C.card,
            color:C.textMid, cursor:'pointer', fontSize:11,
          }}
        >
          <RefreshCw size={12} style={{ animation:loading?'spin 1s linear infinite':'none' }} />
          {loading ? '수집 중…' : lastFetch || '새로고침'}
        </button>
      </div>

      <div style={{
        padding:'14px 20px',
        background:C.card, border:`1px solid ${C.border}`,
        borderTop:'none', borderRadius:'0 0 12px 12px',
        display:'flex', flexDirection:'column', gap:12,
      }}>

        {/* ── 에러 ─────────────────────────────────────────── */}
        {error && (
          <div style={{
            padding:'10px 14px', borderRadius:9,
            background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)',
            display:'flex', gap:8, alignItems:'center', fontSize:11, color:C.red,
          }}>
            <AlertTriangle size={13} /> {error}
            <button onClick={fetchData} style={{
              marginLeft:'auto', color:C.red, background:'none',
              border:'none', cursor:'pointer', fontSize:10, textDecoration:'underline',
            }}>재시도</button>
          </div>
        )}

        {/* ── KPI 카드 ──────────────────────────────────────── */}
        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {([
              { sig:'DANGER'  as const, count:summary.danger,  label:'위험 종목' },
              { sig:'WARNING' as const, count:summary.warning, label:'주의 종목' },
              { sig:'HEALTHY' as const, count:summary.healthy, label:'정상 종목' },
              { sig:'UNKNOWN' as const, count:summary.unknown, label:'분석 대기' },
            ] as const).map(item => {
              const sm = SIGNAL_META[item.sig]
              const active = filterSig === item.sig
              return (
                <div key={item.sig} style={{
                  padding:'10px 14px', borderRadius:10, textAlign:'center', cursor:'pointer',
                  background: active ? sm.bg : C.surface,
                  border: `1px solid ${active ? sm.border : C.border}`,
                  transition:'all .2s',
                }} onClick={() => setFilterSig(active ? 'ALL' : item.sig)}>
                  <div style={{ fontSize:22, fontWeight:900, color:sm.color, fontFamily:'monospace' }}>
                    {item.count}
                  </div>
                  <div style={{ fontSize:9, color:C.textLow, marginTop:2 }}>{item.label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 파이프라인 메타 ───────────────────────────────── */}
        {!loading && apiData?.meta && (
          <div style={{
            padding:'7px 12px', borderRadius:8,
            background:'rgba(59,130,246,.06)', border:`1px solid rgba(59,130,246,.2)`,
            display:'flex', gap:8, alignItems:'center',
          }}>
            <Database size={12} color={C.blue} />
            <div style={{ fontSize:10, color:C.textLow }}>
              보유 {apiData.meta.totalHoldings}종목 중 재고 분석 {apiData.meta.analyzable}개 ·{' '}
              <span style={{ color:C.green }}>캐시 HIT {apiData.meta.cacheHit}</span>
              {apiData.meta.cacheMiss > 0 &&
                <span style={{ color:C.yellow }}> · 신규 {apiData.meta.cacheMiss}</span>
              }
              {apiData.meta.pipeline &&
                <span style={{ color:C.textLow }}> · {apiData.meta.pipeline}</span>
              }
            </div>
          </div>
        )}

        {/* ── 린치 원칙 배너 ────────────────────────────────── */}
        <div style={{
          padding:'9px 13px', borderRadius:9,
          background:'rgba(248,113,113,.05)', border:'1px solid rgba(248,113,113,.18)',
          display:'flex', gap:8, alignItems:'flex-start',
        }}>
          <Info size={13} color={C.red} style={{ flexShrink:0, marginTop:1 }} />
          <div style={{ fontSize:10, color:C.textLow, lineHeight:1.7 }}>
            <strong style={{ color:C.red }}>피터 린치 경보 기준:</strong>{' '}
            재고 YoY &gt; 매출 YoY → <strong style={{ color:C.red }}>DANGER</strong> ·
            격차 5%p 이내 → <strong style={{ color:C.yellow }}>WARNING</strong> ·
            매출이 재고보다 5%p+ 높음 → <strong style={{ color:C.green }}>HEALTHY</strong>
          </div>
        </div>

        {/* ── 필터 탭 ──────────────────────────────────────── */}
        {!loading && results.length > 0 && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:10, color:C.textLow, fontWeight:700 }}>필터:</span>
            {(['ALL','DANGER','WARNING','HEALTHY','UNKNOWN'] as FilterSig[]).map(s => (
              <button key={s} onClick={() => setFilterSig(s)} style={{
                padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:700,
                cursor:'pointer', border:'none',
                background: filterSig === s
                  ? (s === 'ALL' ? 'rgba(96,165,250,.15)' : SIGNAL_META[s as CrossSignal]?.bg)
                  : C.surface,
                color: filterSig === s
                  ? (s === 'ALL' ? C.blue : SIGNAL_META[s as CrossSignal]?.color)
                  : C.textLow,
                outline: filterSig === s ? `1px solid ${s==='ALL'?'rgba(96,165,250,.3)':SIGNAL_META[s as CrossSignal]?.border}` : '1px solid transparent',
              }}>
                {s === 'ALL' ? `전체 (${results.length})` : SIGNAL_META[s as CrossSignal]?.label}
              </button>
            ))}
          </div>
        )}

        {/* ── 카드 리스트 / 스켈레톤 / Empty ──────────────── */}
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[0,1,2].map(i => <SkeletonCard key={i} />)}
            <div style={{ textAlign:'center', fontSize:11, color:C.textLow }}>
              <RefreshCw size={12} style={{ display:'inline-block', verticalAlign:'middle', marginRight:5, animation:'spin 1s linear infinite' }} />
              분기 재고·매출 데이터 수집 중...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding:'36px 24px', textAlign:'center',
            background:C.surface, border:`1px dashed ${C.border}`, borderRadius:12,
          }}>
            <PackageOpen size={28} style={{ margin:'0 auto 10px', opacity:.25 }} />
            <div style={{ fontSize:13, fontWeight:700, color:C.textHi, marginBottom:5 }}>
              {filterSig !== 'ALL' ? '선택한 시그널의 종목이 없습니다.' : '분석 대상 제조업 종목 없음'}
            </div>
            <div style={{ fontSize:11, color:C.textLow, maxWidth:340, margin:'0 auto', lineHeight:1.8 }}>
              {filterSig !== 'ALL'
                ? '다른 필터를 선택해주세요.'
                : (apiData?.message ?? '포트폴리오에 재고 리스크를 추적할 제조업/하드웨어 종목이 없습니다.')}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(r => <StockCard key={r.ticker} r={r} />)}
          </div>
        )}

        {/* ── 비제조업 제외 종목 ────────────────────────────── */}
        {!loading && excluded.length > 0 && (
          <div>
            <div style={{
              display:'flex', alignItems:'center', gap:8, marginBottom:8,
              paddingBottom:8, borderBottom:`1px solid ${C.border}`,
            }}>
              <span style={{ fontSize:11, color:C.textLow, fontWeight:700 }}>
                🚫 재고 분석 미적용 종목 ({excluded.length}개)
              </span>
              <span style={{ fontSize:10, color:C.textLow }}>
                — 소프트웨어·금융·서비스 기업은 물리적 재고가 없어 제외
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {excluded.map(item => <ExcludedCard key={item.ticker} item={item} />)}
            </div>
          </div>
        )}

        {/* ── 메타 ─────────────────────────────────────────── */}
        {!loading && apiData?.meta && (
          <div style={{ fontSize:10, color:C.textLow, textAlign:'right' }}>
            분석 완료 {apiData.meta.analyzed}/{apiData.meta.analyzable}개 · 제외 {apiData.meta.excluded}개
          </div>
        )}

      </div>
    </div>
  )
}
