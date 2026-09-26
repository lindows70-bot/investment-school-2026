'use client'
// 시장 화면 선 차트의 Recharts 부분 — 장중 지수·SPY/QQQ·환율 추이. marketUi 의 LinePlot(next/dynamic)으로 데이터가 온 뒤에만 불러온다(recharts 를 첫 번들에서 뺀다)
//   축 라벨은 그리지 않는다(학생 화면 — 값은 카드 글자로, 선은 흐름만). 점선 = 기준선(전일 종가), 누르면 그 시각·값.
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts'
import { TK, FS, RAD, SP } from '@/lib/theme'

export interface PlotPoint { t: number; v: number }
export interface LinePlotProps {
  points: PlotPoint[]
  color: string
  /** 점선 기준선(전일 종가) — 없으면 안 그린다 */
  baseline?: number | null
  tFmt: (t: number) => string
  vFmt: (v: number) => string
}

function Tip({ active, payload, tFmt, vFmt }: { active?: boolean; payload?: ReadonlyArray<{ payload?: PlotPoint }>; tFmt: (t: number) => string; vFmt: (v: number) => string }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div style={{ background: TK.bg7, border: `1px solid ${TK.line1}`, borderRadius: RAD.sm, padding: `${SP.xs}px ${SP.sm}px`, fontSize: FS.tiny, color: TK.slate200, whiteSpace: 'nowrap' }}>
      {tFmt(d.t)} · {vFmt(d.v)}
    </div>
  )
}

export default function LinePlot({ points, color, baseline, tFmt, vFmt }: LinePlotProps) {
  const vs = points.map(p => p.v)
  if (baseline != null) vs.push(baseline)   // 기준선이 늘 보이게 세로 범위에 넣는다
  const lo = Math.min(...vs), hi = Math.max(...vs)
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.001 || 1
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: SP.xs, right: SP.xs, bottom: SP.xs, left: SP.xs }}>
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
        <YAxis domain={[lo - pad, hi + pad]} hide />
        {baseline != null && <ReferenceLine y={baseline} stroke={TK.sub} strokeDasharray="4 4" />}
        <Tooltip content={<Tip tFmt={tFmt} vFmt={vFmt} />} cursor={{ stroke: TK.line4 }} />
        <Line type="linear" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
