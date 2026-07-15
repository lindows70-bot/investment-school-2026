'use client'

/**
 * BalanceSheetChart v3 — 순수 렌더링 컴포넌트
 *
 * 데이터 페칭은 부모 MacroDashboard가 담당.
 * props로 data / loading / error / isMock / lastUpdated 를 수신.
 */

import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { type BalanceSheetPoint } from '@/lib/fredApi'
import { TK } from '@/lib/theme'

const C = {
  total:   TK.slate200,   // 아이스 실버 — 총자산 기준선
  tsy:     TK.blue500,   // 딥 스카이블루 — 미국채
  mbs:     TK.emerald500,   // 에메랄드 — MBS
  grid:    TK.bg9,
  card:    TK.bg7,
  border:  TK.line1,
  textHi:  TK.slate100,
  textLow: TK.sub3,
}

const fmtT = (v: number) => `$${v.toFixed(2)}T`

function calcDomain(data: BalanceSheetPoint[]): [number, number] {
  if (!data.length) return [6, 10]
  const vals = data.map(d => d.total)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = (hi - lo) * 0.08
  return [parseFloat((lo - pad).toFixed(2)), parseFloat((hi + pad).toFixed(2))]
}

// ── QT 진행 중 여부 판단 (외부에서도 사용 가능하도록 export)
export function isQtOngoing(data: BalanceSheetPoint[], lookback = 3): boolean {
  if (data.length < lookback + 1) return false
  const recent = data.slice(-lookback)
  // lookback 기간 중 과반수 이상 감소하면 QT 진행 중
  let downCount = 0
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].total < recent[i - 1].total) downCount++
  }
  return downCount >= Math.floor(lookback / 2)
}

export interface BalanceSheetChartProps {
  data:        BalanceSheetPoint[]
  loading:     boolean
  error:       string | null
  isMock:      boolean
  lastUpdated: string | null
}

function Skeleton() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: TK.bg10, animation: 'pulse 1.5s infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: 280, background: TK.bg10, borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 22, width: 360, background: TK.bg10, borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ height: 22, width: 70, background: TK.bg10, borderRadius: 4, marginBottom: 4, animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: 10, width: 70, background: '#141c28', borderRadius: 3, animation: 'pulse 1.5s infinite' }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{
        height: 260, background: 'rgba(30,37,53,0.5)', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 12, color: C.textLow }}>FRED API 데이터 수신 중…</div>
          <div style={{ fontSize: 11, color: TK.sub6, marginTop: 4 }}>WALCL · WSHOTSL · WSHOMCB</div>
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d: BalanceSheetPoint | undefined = payload[0]?.payload
  return (
    <div style={{ background: TK.slate900, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ color: TK.sub2, marginBottom: 6, fontSize: 11, fontWeight: 700 }}>{label}</div>
      {d && (
        <>
          <div style={{ color: C.total, marginBottom: 3 }}>총자산: <strong style={{ fontFamily: 'monospace' }}>{fmtT(d.total)}</strong></div>
          <div style={{ color: C.tsy, marginBottom: 3 }}>미국채(UST): <strong style={{ fontFamily: 'monospace' }}>{fmtT(d.tsy)}</strong></div>
          <div style={{ color: C.mbs }}>MBS: <strong style={{ fontFamily: 'monospace' }}>{fmtT(d.mbs)}</strong></div>
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, fontSize: 10, color: C.textLow }}>
            기타: <span style={{ fontFamily: 'monospace' }}>{fmtT(parseFloat((d.total - d.tsy - d.mbs).toFixed(4)))}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function BalanceSheetChart({ data, loading, error, isMock, lastUpdated }: BalanceSheetChartProps) {
  if (loading) return <Skeleton />

  const latest    = data[data.length - 1]
  const peak      = data.reduce((m, d) => d.total > m.total ? d : m, data[0] ?? { total: 0, month: '', tsy: 0, mbs: 0 })
  const peakMonth = peak?.month ?? ''
  const shrink    = peak && latest ? parseFloat((peak.total - latest.total).toFixed(2)) : 0
  const yDomain   = calcDomain(data)
  const qtGoing   = isQtOngoing(data)

  const qtStartMonth = (() => {
    const peakIdx = data.findIndex(d => d.month === peak?.month)
    if (peakIdx < 0) return '2022-06'
    for (let i = peakIdx + 1; i < data.length; i++) {
      if (data[i].total < data[i - 1].total) return data[i].month
    }
    return data[peakIdx + 1]?.month ?? '2022-06'
  })()

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>💧</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.textHi }}>연준 대차대조표 — 양적긴축(QT) 현황</span>
            {isMock ? (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.12)', color: TK.amber400, fontWeight: 700 }}>MOCK DATA</span>
            ) : (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', color: TK.green400, fontWeight: 700 }}>🟢 LIVE · FRED</span>
            )}
            {lastUpdated && !isMock && <span style={{ fontSize: 9, color: TK.sub6 }}>업데이트: {lastUpdated}</span>}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 7,
            background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)',
            fontSize: 11, color: TK.indigo400, fontWeight: 600,
          }}>
            ⚡ 고점({peakMonth}) {peak ? fmtT(peak.total) : '—'} 대비
            <strong style={{ color: TK.red400, marginLeft: 4 }}>–{fmtT(shrink)} 축소</strong>
            {qtGoing
              ? <span style={{ color: TK.red400, marginLeft: 4 }}>· QT 진행 중</span>
              : <span style={{ color: TK.green400, marginLeft: 4 }}>· QT 감속 감지</span>
            }
          </div>
          {error && (
            <div style={{
              marginTop: 8, padding: '6px 12px', borderRadius: 6,
              background: isMock ? 'rgba(251,191,36,0.07)' : 'rgba(248,113,113,0.07)',
              border: `1px solid ${isMock ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`,
              fontSize: 11, color: isMock ? '#fcd34d' : TK.red400,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isMock ? '⚠️' : '🔴'} {error}
            </div>
          )}
        </div>

        {latest && (
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: '현재 총자산',  val: fmtT(latest.total), color: C.total },
              { label: '미국채 보유',  val: fmtT(latest.tsy),   color: C.tsy   },
              { label: 'MBS 보유',    val: fmtT(latest.mbs),   color: C.mbs   },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: item.color, fontFamily: 'monospace', lineHeight: 1.1 }}>{item.val}</div>
                <div style={{ fontSize: 9, color: TK.sub3, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.total} stopOpacity={0.08} />
              <stop offset="95%" stopColor={C.total} stopOpacity={0.00} />
            </linearGradient>
            <linearGradient id="gradTsy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.tsy}   stopOpacity={0.45} />
              <stop offset="95%" stopColor={C.tsy}   stopOpacity={0.08} />
            </linearGradient>
            <linearGradient id="gradMbs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.mbs}   stopOpacity={0.55} />
              <stop offset="95%" stopColor={C.mbs}   stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: C.textLow, fontSize: 10 }} tickLine={false}
            axisLine={{ stroke: C.border }} interval={Math.max(1, Math.floor(data.length / 8))} />
          <YAxis domain={yDomain} tickFormatter={(v: number) => `$${Number(v).toFixed(1)}T`}
            tick={{ fill: C.textLow, fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.textHi, paddingTop: 6 }} iconType="rect" />
          <ReferenceLine x={qtStartMonth} stroke={TK.red400} strokeDasharray="5 3"
            strokeWidth={1.3} strokeOpacity={0.65}
            label={{ value: 'QT 시작', position: 'insideTopRight', fill: TK.red400, fontSize: 10, fontWeight: 700 }}
          />
          <Area type="monotone" dataKey="mbs"   name="MBS"        stroke={C.mbs}   strokeWidth={1.5} fill="url(#gradMbs)"   isAnimationActive={false} />
          <Area type="monotone" dataKey="tsy"   name="미국채(UST)" stroke={C.tsy}   strokeWidth={2}   fill="url(#gradTsy)"   isAnimationActive={false} />
          <Area type="monotone" dataKey="total" name="총자산 합계" stroke={C.total} strokeWidth={2.5} fill="url(#gradTotal)" strokeDasharray="6 2" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', fontSize: 11, color: TK.slate400, lineHeight: 1.7 }}>
        <strong style={{ color: TK.red400 }}>📌 QT 해석:</strong>{' '}
        연준 보유 채권 만기 시 재투자 중단 → 시중 달러 유동성 흡수.
        현재 누적 축소: <strong style={{ color: TK.red400 }}>{shrink > 0 ? `–${fmtT(shrink)}` : '계산 중'}</strong>.
        QT 상태:{' '}
        {qtGoing
          ? <strong style={{ color: TK.red400 }}>진행 중 — 위험자산에 구조적 압력</strong>
          : <strong style={{ color: TK.green400 }}>감속 감지 — 유동성 압박 완화 신호</strong>
        }
        {!isMock && <span style={{ marginLeft: 8, color: TK.sub6 }}>· 출처: FRED WALCL/WSHOTSL/WSHOMCB</span>}
      </div>
    </div>
  )
}
