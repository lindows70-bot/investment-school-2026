'use client'
// 학생 내 자산 '지난 흐름' 차트의 Recharts 부분 — GrowthChart 가 데이터를 받은 뒤에만 next/dynamic 으로 불러온다(recharts 청크를 첫 화면에서 뺀다)
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { won, signWon, manWon, upDown } from '@/lib/studentFormat'
// 색·월 표기는 범례를 그리는 GrowthChart 와 같은 값 — 값(import)은 그쪽에서 가져온다(이 파일에서 export 하면 GrowthChart 가 recharts 를 첫 화면에 끌고 온다)
import { C_VALUE, C_COST, ymText } from '@/app/components/student/GrowthChart'

/** month = 'YYYY-MM' · value = 월말 값(valueKrw) · cost = 산 값(valueKrw − cumPnl) · pnl = 차이(cumPnl) */
export interface GrowthDatum { month: string; value: number; cost: number; pnl: number }

/** 축 눈금 — 공백 없이(좁은 축에서 줄바꿈 방지). 첫 칸과 1월만 연도를 붙인다 */
const tickText = (ym: string, i: number) => {
  const m = parseInt(ym.slice(5, 7), 10)
  return i === 0 || m === 1 ? `${ym.slice(2, 4)}년${m}월` : `${m}월`
}

function Tip({ active, payload, lastMonth }: { active?: boolean; payload?: ReadonlyArray<{ payload?: GrowthDatum }>; lastMonth: string }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div style={{ background: TK.bg7, border: `1px solid ${TK.line1}`, borderRadius: RAD.sm, padding: SP.sm, display: 'flex', flexDirection: 'column', gap: SP.xs, fontSize: FS.tiny }}>
      <span style={{ color: TK.sub }}>{ymText(d.month)} {d.month === lastMonth ? '· 지금 시세' : '말'}</span>
      <span style={{ color: C_VALUE }}>월말 값 {won(d.value)}</span>
      <span style={{ color: C_COST }}>산 값 {won(d.cost)}</span>
      <span style={{ color: upDown(d.pnl) }}>차이 {signWon(d.pnl)}</span>
    </div>
  )
}

/** data = 보일 범위만 · lastMonth = 전체 데이터의 마지막 달(지금 시세로 계산된 달) */
export default function GrowthPlot({ data, lastMonth }: { data: GrowthDatum[]; lastMonth: string }) {
  return (
    <div style={{ width: '100%', height: 220, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: SP.sm, right: SP.sm, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={TK.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={tickText} interval="preserveStartEnd" minTickGap={16}
            tick={{ fill: TK.sub, fontSize: FS.micro }} axisLine={{ stroke: TK.border }} tickLine={false} />
          <YAxis tickFormatter={manWon} width={56} domain={['auto', 'auto']}
            tick={{ fill: TK.sub, fontSize: FS.micro }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip lastMonth={lastMonth} />} cursor={{ stroke: TK.line4 }} />
          <Line type="monotone" dataKey="cost" name="산 값" stroke={C_COST} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="value" name="월말 값" stroke={C_VALUE} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
