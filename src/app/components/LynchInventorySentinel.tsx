'use client'

/**
 * LynchInventorySentinel — 재고 vs 매출 데드크로스 센티넬
 *
 * 피터 린치 원칙:
 *  "재고가 매출보다 빠르게 쌓이기 시작하는 기업은
 *   파는 속도보다 만드는 속도가 빠른 것이다. 이것은 위험 신호다."
 *
 * ◆ 데이터 소스: GET /api/financials/inventory-cross
 * ◆ 시그널: DANGER(역전 발생) / WARNING(격차 5% 이내) / HEALTHY(안전)
 */

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import {
  AlertTriangle, ShieldAlert, CheckCircle2,
  TrendingUp, TrendingDown, PackageOpen,
  RefreshCw, Info, ChevronDown, ChevronUp,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 타입 (API 응답과 동기화)
// ────────────────────────────────────────────────────────────
type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN'

interface QuarterData {
  quarter:       string
  revenue:       number
  inventory:     number
  revenueYoY:    number | null
  inventoryYoY:  number | null
  signal:        CrossSignal
  gap:           number | null
}

interface InventoryCrossResult {
  ticker:           string
  name:             string
  market:           string
  unitLabel:        string
  signal:           CrossSignal
  gap:              number
  latestQuarter:    string
  revenueYoY:       number
  inventoryYoY:     number
  consecutiveDanger: number
  trend:            QuarterData[]
  lynchAlert:       string
}

interface InventoryExcluded {
  ticker:  string
  name:    string
  reason:  string
}

interface ApiResponse {
  results:              InventoryCrossResult[]
  excludedFromAnalysis?: InventoryExcluded[]
  summary:              { danger: number; warning: number; healthy: number; unknown: number }
  message?:             string
  meta?:                {
    totalHoldings: number
    analyzable:    number
    excluded:      number
    analyzed:      number
    cacheHit:      number
    cacheMiss:     number
  }
}

// ────────────────────────────────────────────────────────────
// 컬러 시스템
// ────────────────────────────────────────────────────────────
const C = {
  bg:      '#020617', surface: '#0f172a', card: '#1e293b', cardHi: '#263348',
  border:  '#334155', textHi: '#f1f5f9', textMid: '#94a3b8', textLow: '#64748b',
  red:     '#f87171', yellow: '#fbbf24', green: '#4ade80', blue: '#60a5fa',
}

const SIGNAL_META: Record<CrossSignal, { color: string; bg: string; border: string; icon: string; label: string }> = {
  DANGER:  { color: C.red,    bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  icon: '🔴', label: '위험' },
  WARNING: { color: C.yellow, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', icon: '🟡', label: '주의' },
  HEALTHY: { color: C.green,  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.30)',  icon: '🟢', label: '정상' },
  UNKNOWN: { color: C.textLow,bg: 'rgba(100,116,139,0.10)',border: 'rgba(100,116,139,0.25)',icon: '⚪', label: '분석 중' },
}

// ────────────────────────────────────────────────────────────
// 커스텀 툴팁
// ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rev = payload.find((p: any) => p.dataKey === 'revenueYoY')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = payload.find((p: any) => p.dataKey === 'inventoryYoY')?.value
  const gap = inv != null && rev != null ? (inv - rev).toFixed(1) : null
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '8px 12px', fontSize: 11, minWidth: 180,
    }}>
      <div style={{ fontWeight: 800, color: C.yellow, marginBottom: 5 }}>📅 {label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: C.blue }}>매출 YoY</span>
          <span style={{ color: C.blue, fontFamily: 'monospace', fontWeight: 700 }}>
            {rev != null ? `+${rev.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: C.yellow }}>재고 YoY</span>
          <span style={{ color: C.yellow, fontFamily: 'monospace', fontWeight: 700 }}>
            {inv != null ? `+${inv.toFixed(1)}%` : '—'}
          </span>
        </div>
        {gap !== null && (
          <div style={{
            borderTop: `1px solid ${C.border}`, marginTop: 3, paddingTop: 4,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ color: C.textLow }}>격차 (재고-매출)</span>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700,
              color: parseFloat(gap) > 0 ? C.red : C.green,
            }}>
              {parseFloat(gap) > 0 ? '+' : ''}{gap}%p
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 4분기 트렌드 차트
// ────────────────────────────────────────────────────────────
function TrendMiniChart({ trend }: { trend: QuarterData[] }) {
  const chartData = trend
    .filter(q => q.revenueYoY !== null && q.inventoryYoY !== null)
    .map(q => ({
      quarter:      q.quarter,
      revenueYoY:   q.revenueYoY,
      inventoryYoY: q.inventoryYoY,
      gap:          q.gap ?? 0,
    }))

  if (chartData.length === 0) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.textLow, fontSize: 11, fontStyle: 'italic' }}>
        데이터 수집 중...
      </div>
    )
  }

  const hasAnyPositiveGap = chartData.some(d => (d.gap ?? 0) > 0)

  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={C.border} strokeDasharray="2 2" vertical={false} />
        <XAxis dataKey="quarter" tick={{ fill: C.textLow, fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: C.textLow, fontSize: 9 }} axisLine={false} tickLine={false}
          tickFormatter={v => `${v}%`} />
        <Tooltip content={<ChartTip />} />
        <ReferenceLine y={0} stroke={C.border} />

        {/* 매출 YoY 막대 */}
        <Bar dataKey="revenueYoY" name="매출 YoY" radius={[2,2,0,0]} maxBarSize={16}>
          {chartData.map((_, i) => (
            <Cell key={i} fill="rgba(96,165,250,0.55)" />
          ))}
        </Bar>

        {/* 재고 YoY 라인 */}
        <Line
          type="monotone" dataKey="inventoryYoY" name="재고 YoY"
          stroke={hasAnyPositiveGap ? C.red : C.yellow}
          strokeWidth={2} dot={{ r: 3, fill: hasAnyPositiveGap ? C.red : C.yellow }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ────────────────────────────────────────────────────────────
// 개별 종목 카드
// ────────────────────────────────────────────────────────────
function StockCard({ result }: { result: InventoryCrossResult }) {
  const [expanded, setExpanded] = useState(false)
  const sm = SIGNAL_META[result.signal]

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      background: C.card, border: `1px solid ${sm.border}`,
    }}>
      {/* 카드 헤더 */}
      <div
        style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* 시그널 아이콘 */}
          <div style={{
            flexShrink: 0, width: 40, height: 40, borderRadius: 9,
            background: sm.bg, border: `1px solid ${sm.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {result.signal === 'DANGER'  && <AlertTriangle size={20} color={C.red} />}
            {result.signal === 'WARNING' && <ShieldAlert   size={20} color={C.yellow} />}
            {result.signal === 'HEALTHY' && <CheckCircle2  size={20} color={C.green} />}
            {result.signal === 'UNKNOWN' && <PackageOpen   size={20} color={C.textLow} />}
          </div>

          {/* 종목 정보 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: 'rgba(96,165,250,0.15)', color: C.blue,
                fontFamily: 'monospace', fontWeight: 900,
              }}>{result.ticker}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.textHi }}>{result.name}</span>
              {result.consecutiveDanger >= 2 && (
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 20,
                  background: 'rgba(239,68,68,0.15)', color: C.red,
                  fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)',
                }}>
                  🔴 {result.consecutiveDanger}분기 연속
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 20,
                background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
                fontWeight: 800,
              }}>
                {sm.icon} {sm.label}
              </span>
              <span style={{ fontSize: 10, color: C.textLow }}>{result.latestQuarter}</span>
            </div>
          </div>

          {/* 지표 수치 */}
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', justifyContent: 'flex-end', marginBottom: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: C.blue, marginBottom: 1 }}>매출 YoY</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.blue, fontFamily: 'monospace' }}>
                  +{result.revenueYoY.toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: result.signal === 'HEALTHY' ? C.green : C.red, marginBottom: 1 }}>재고 YoY</div>
                <div style={{
                  fontSize: 13, fontWeight: 900, fontFamily: 'monospace',
                  color: result.signal === 'HEALTHY' ? C.green : result.signal === 'WARNING' ? C.yellow : C.red,
                }}>
                  {result.inventoryYoY >= 0 ? '+' : ''}{result.inventoryYoY.toFixed(1)}%
                </div>
              </div>
            </div>
            {/* 격차 배지 */}
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 6,
                fontFamily: 'monospace', fontWeight: 700,
                background: result.gap > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                color: result.gap > 0 ? C.red : C.green,
              }}>
                격차 {result.gap > 0 ? '+' : ''}{result.gap.toFixed(1)}%p
              </span>
            </div>
          </div>

          {/* 방향 아이콘 */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {result.gap > 0
              ? <TrendingUp   size={16} color={C.red}    />
              : <TrendingDown size={16} color={C.green} />
            }
            {expanded ? <ChevronUp size={13} color={C.textLow} /> : <ChevronDown size={13} color={C.textLow} />}
          </div>
        </div>
      </div>

      {/* 확장 영역: 트렌드 차트 + 린치 경보 */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', background: C.surface }}>
          {/* 4분기 트렌드 차트 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              📊 분기별 매출 YoY(막대) vs 재고 YoY(선) 추이 ({result.unitLabel})
            </div>
            <TrendMiniChart trend={result.trend} />
          </div>

          {/* 린치 경보 메시지 */}
          <div style={{
            padding: '10px 14px', borderRadius: 9,
            background: sm.bg, border: `1px solid ${sm.border}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: sm.color, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <PackageOpen size={10} /> 피터 린치의 재고 경보
            </div>
            <div style={{ fontSize: 11, color: C.textMid, lineHeight: 1.7, fontStyle: 'italic' }}>
              {result.lynchAlert}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 스켈레톤 카드 (로딩 중)
// ────────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, rgba(30,41,59,0.8) 25%, rgba(51,65,85,0.6) 50%, rgba(30,41,59,0.8) 75%)',
    backgroundSize: '200% 100%', animation: 'sentinel-shimmer 1.5s infinite', borderRadius: 6,
  }
  return (
    <div style={{ padding: '12px 16px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
      <style>{`@keyframes sentinel-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ ...shimmer, width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...shimmer, height: 12, width: '40%', marginBottom: 8 }} />
          <div style={{ ...shimmer, height: 9, width: '60%' }} />
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ ...shimmer, height: 14, width: 60, marginBottom: 6 }} />
          <div style={{ ...shimmer, height: 14, width: 60 }} />
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function LynchInventorySentinel() {
  const [data,      setData]      = useState<ApiResponse | null>(null)
  const [excluded,  setExcluded]  = useState<InventoryExcluded[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [filterSig, setFilterSig] = useState<CrossSignal | 'ALL'>('ALL')
  const [lastFetch, setLastFetch] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/financials/inventory-cross', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? `오류 (${res.status})`); return }
      setData(body)
      setExcluded(body.excludedFromAnalysis ?? [])
      setLastFetch(new Date().toLocaleTimeString('ko-KR'))
    } catch (e) {
      setError('네트워크 오류: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = (data?.results ?? []).filter(r =>
    filterSig === 'ALL' ? true : r.signal === filterSig
  )

  const summary = data?.summary ?? { danger: 0, warning: 0, healthy: 0, unknown: 0 }

  return (
    <div style={{
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      marginTop: 32,
    }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        borderRadius: '12px 12px 0 0',
        border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PackageOpen size={18} color={C.red} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.textHi }}>
            재고 vs 매출 데드크로스 센티넬
          </div>
          <div style={{ fontSize: 11, color: C.textLow, marginTop: 1 }}>
            피터 린치 리스크 경보 · 재고가 매출보다 빠르게 쌓이는 종목 실시간 추적
          </div>
        </div>

        {/* DANGER 경보 배지 */}
        {summary.danger > 0 && (
          <div style={{
            marginLeft: 'auto',
            padding: '5px 12px', borderRadius: 20,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertTriangle size={13} color={C.red} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.red }}>
              위험 {summary.danger}개 감지
            </span>
          </div>
        )}

        {/* 새로고침 */}
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.card,
            color: C.textMid, cursor: 'pointer', fontSize: 11,
            marginLeft: summary.danger > 0 ? 8 : 'auto',
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? '수집 중…' : lastFetch ? `${lastFetch}` : '새로고침'}
        </button>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      <div style={{
        padding: '14px 20px',
        background: C.card, borderRadius: '0 0 12px 12px',
        border: `1px solid ${C.border}`, borderTop: 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* ── 에러 ────────────────────────────────────────── */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 9,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            fontSize: 11, color: C.red, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <AlertTriangle size={13} /> {error}
            <button onClick={fetchData} style={{ marginLeft: 'auto', color: C.red,
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, textDecoration: 'underline' }}>
              재시도
            </button>
          </div>
        )}

        {/* ── KPI 카드 ─────────────────────────────────────── */}
        {!loading && data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { sig: 'DANGER'  as const, count: summary.danger,  label: '위험 종목' },
              { sig: 'WARNING' as const, count: summary.warning, label: '주의 종목' },
              { sig: 'HEALTHY' as const, count: summary.healthy, label: '정상 종목' },
              { sig: 'UNKNOWN' as const, count: summary.unknown, label: '분석 대기' },
            ].map(item => {
              const sm = SIGNAL_META[item.sig]
              return (
                <div key={item.sig} style={{
                  padding: '10px 14px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: filterSig === item.sig ? sm.bg : C.surface,
                  border: `1px solid ${filterSig === item.sig ? sm.border : C.border}`,
                  transition: 'all 0.2s',
                }} onClick={() => setFilterSig(filterSig === item.sig ? 'ALL' : item.sig)}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: sm.color, fontFamily: 'monospace' }}>
                    {item.count}
                  </div>
                  <div style={{ fontSize: 9, color: C.textLow, marginTop: 2 }}>{sm.icon} {item.label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 린치 원칙 배너 ──────────────────────────────── */}
        <div style={{
          padding: '9px 14px', borderRadius: 9,
          background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.18)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Info size={13} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 10, color: C.textLow, lineHeight: 1.7 }}>
            <strong style={{ color: C.red }}>피터 린치 경보 기준:</strong>{' '}
            재고 YoY &gt; 매출 YoY → <strong style={{ color: C.red }}>DANGER</strong> ·
            격차 5%p 이내 → <strong style={{ color: C.yellow }}>WARNING</strong> ·
            매출이 재고+5%p 이상 → <strong style={{ color: C.green }}>HEALTHY</strong> ·
            2분기 연속 DANGER = 린치의 즉시 매도 시그널
          </div>
        </div>

        {/* ── 카드 리스트 / 스켈레톤 ──────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '32px 24px', textAlign: 'center',
            background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 12,
          }}>
            <PackageOpen size={28} style={{ margin: '0 auto 10px', opacity: 0.25 }} />
            <div style={{ fontSize: 12, color: C.textLow }}>
              {(data?.results ?? []).length === 0
                ? (data?.message ?? '현재 포트폴리오에 재고 리스크를 추적할 제조업/하드웨어 종목이 없습니다.')
                : '선택한 시그널의 종목이 없습니다.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => <StockCard key={r.ticker} result={r} />)}
          </div>
        )}

        {/* ── 분석 제외 종목 섹션 (소프트웨어·금융·서비스) ──── */}
        {!loading && excluded.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              paddingBottom: 8, borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 11, color: C.textLow, fontWeight: 700 }}>
                🚫 재고 분석 미적용 종목 ({excluded.length}개)
              </span>
              <span style={{ fontSize: 10, color: C.textLow }}>
                — 소프트웨어·금융·서비스 기업은 물리적 재고가 없어 제외됨
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {excluded.map(ex => (
                <div key={ex.ticker} style={{
                  padding: '10px 14px', borderRadius: 10, opacity: 0.72,
                  background: 'rgba(15,23,42,0.7)',
                  border: '1px dashed rgba(100,116,139,0.3)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(100,116,139,0.12)', border: '1px dashed rgba(100,116,139,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                  }}>🚫</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 3,
                        background: 'rgba(96,165,250,0.12)', color: C.blue,
                        fontFamily: 'monospace', fontWeight: 900,
                      }}>{ex.ticker}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textMid }}>{ex.name}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textLow, lineHeight: 1.5 }}>{ex.reason}</div>
                  </div>
                  <div style={{
                    flexShrink: 0, fontSize: 9, padding: '3px 9px', borderRadius: 20,
                    background: 'rgba(100,116,139,0.12)', color: C.textLow,
                    border: '1px dashed rgba(100,116,139,0.3)', fontWeight: 700,
                  }}>
                    재고 분석 제외
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 데이터 메타 ─────────────────────────────────── */}
        {!loading && data?.meta && (
          <div style={{ fontSize: 10, color: C.textLow, textAlign: 'right' }}>
            보유 주식 {data.meta.totalHoldings}개 중 재고 분석 대상 {data.meta.analyzable}개 ·
            제외 {data.meta.excluded}개 · 분석 완료 {data.meta.analyzed}개
          </div>
        )}
      </div>
    </div>
  )
}
