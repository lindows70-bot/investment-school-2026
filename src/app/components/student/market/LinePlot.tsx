'use client'
// 시장 화면 선 차트의 Recharts 부분 — 장중 지수·SPY/QQQ·환율 추이. marketUi 의 LinePlot(next/dynamic)으로 데이터가 온 뒤에만 불러온다(recharts 를 첫 번들에서 뺀다)
//   기본은 축 없는 흐름선(홈 미니 선). 큰 차트는 선택 옵션으로 영역 그라데이션·세로/가로 눈금·격자·고점/저점 말풍선·끝점 강조를 켠다.
//   점선 = 기준선(전일 종가), 누르면 그 시각·값.
import { useId } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine, ReferenceDot, Tooltip, CartesianGrid } from 'recharts'
import { TK, FS, RAD, SP } from '@/lib/theme'

export interface PlotPoint { t: number; v: number }
/** 차트 위 말풍선(고점·저점) — above = 점 위에, below = 점 아래에 */
export interface PlotMark { t: number; v: number; name: string; value: string; when: string; place: 'above' | 'below' }
export interface LinePlotProps {
  points: PlotPoint[]
  color: string
  /** 점선 기준선(전일 종가) — 없으면 안 그린다 */
  baseline?: number | null
  tFmt: (t: number) => string
  vFmt: (v: number) => string
  /** false = 장식용 미니 선 — recharts 접근성 층(키보드 포커스·낭독)을 끈다. 값은 옆 글자가 말한다(홈 지수·환율 미니 선) */
  a11y?: boolean
  /** 선 아래를 선 색 그라데이션으로 채운다 */
  area?: boolean
  /** 세로 눈금(값) — 어느 쪽에 둘지 · 눈금 값 · 글자 */
  yAxis?: 'left' | 'right'
  yTicks?: number[]
  yFmt?: (v: number) => string
  /** 가로 눈금(시각·날짜) */
  xTicks?: number[]
  xFmt?: (t: number) => string
  /** 세로 눈금 자리에 가로 격자선 */
  grid?: boolean
  marks?: PlotMark[]
  /** 마지막 점을 둥근 점 + 번짐으로 강조 */
  endDot?: boolean
  /** 기준선 색·이름표(왼쪽 위) — 없으면 흐린 회색·이름표 없음 */
  baselineColor?: string
  baselineLabel?: string
  /** 영역 그라데이션 시작 불투명도(기본 0.32) */
  areaOpacity?: number
  /** 🎨 두 색 모드(종목 상세 C안 · 2026-10-10): 이 값(내 평단)보다 위는 splitUp 색, 아래는 splitDown 색으로 선·영역을 나눠 그린다.
   *  교차점을 보간해 넣고 각 쪽은 null 로 끊는다(평평한 가짜 선이 생기지 않게). 영역은 split 선을 바닥으로 채운다 */
  splitAt?: number | null
  splitUp?: string
  splitDown?: string
}

/** split 기준으로 위·아래 두 시리즈를 만든다 — 교차하는 구간엔 교차점(값 = split)을 양쪽에 넣는다 */
export function splitSeries(points: PlotPoint[], split: number): { t: number; v: number; up: number | null; dn: number | null }[] {
  const out: { t: number; v: number; up: number | null; dn: number | null }[] = []
  const row = (t: number, v: number) => ({ t, v, up: v >= split ? v : null, dn: v <= split ? v : null })
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (i > 0) {
      const a = points[i - 1]
      if ((a.v - split) * (p.v - split) < 0) {   // 부호가 바뀜 = 사이에서 교차
        const f = (split - a.v) / (p.v - a.v)
        out.push({ t: a.t + (p.t - a.t) * f, v: split, up: split, dn: split })
      }
    }
    out.push(row(p.t, p.v))
  }
  return out
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

// 말풍선 폭 어림 — 한글은 글자 크기만큼, 숫자·기호는 0.62배(측정 없이 SVG 안에서 상자를 그리기 위해)
const textW = (s: string, size: number) => Array.from(s).reduce((w, ch) => w + (/[가-힣]/.test(ch) ? size : ch === ' ' ? size * 0.3 : size * 0.62), 0)

/** 말풍선 — 점과 가는 선으로 잇는다. frac(가로 위치 0~1)이 끝에 가까우면 상자를 안쪽으로 붙여 잘리지 않게 */
function MarkLabel({ viewBox, mark, frac }: { viewBox?: { x?: number; y?: number; width?: number; height?: number }; mark: PlotMark; frac: number }) {
  if (!viewBox || viewBox.x == null || viewBox.y == null) return null
  const cx = viewBox.x + (viewBox.width ?? 0) / 2, cy = viewBox.y + (viewBox.height ?? 0) / 2
  const f = FS.micro, padX = SP.sm, h = f + SP.sm * 1.5, gap = SP.md
  const parts = [`${mark.name} `, mark.value, ` ${mark.when}`]
  const w = textW(parts.join(''), f) + padX * 2
  const bx = frac < 0.2 ? cx - SP.md : frac > 0.8 ? cx - w + SP.md : cx - w / 2
  const by = mark.place === 'above' ? cy - gap - h : cy + gap
  return (
    <g>
      <line x1={cx} y1={mark.place === 'above' ? cy - 4 : cy + 4} x2={cx} y2={mark.place === 'above' ? by + h : by} stroke={TK.line4} strokeWidth={1} />
      <rect x={bx} y={by} width={w} height={h} rx={RAD.sm} fill={TK.bg7} stroke={TK.line1} />
      <text x={bx + padX} y={by + h / 2} dominantBaseline="central" style={{ fontSize: f }}>
        <tspan fill={TK.sub}>{parts[0]}</tspan>
        <tspan fill={TK.slate100} fontWeight={700}>{parts[1]}</tspan>
        <tspan fill={TK.sub}>{parts[2]}</tspan>
      </text>
    </g>
  )
}

/** 가로 눈금 글자 — 양 끝 가까운 눈금은 안쪽으로 붙여 잘리지 않게('9:00'이 왼쪽 끝에서 '00'만 보였다) */
function XTick({ x, y, payload, t0, t1, fmt }: { x?: number; y?: number; payload?: { value?: number }; t0: number; t1: number; fmt?: (t: number) => string }) {
  const t = payload?.value
  if (x == null || y == null || t == null) return null
  const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0.5
  return (
    <text x={x} y={y + SP.sm} textAnchor={f < 0.06 ? 'start' : f > 0.94 ? 'end' : 'middle'} dominantBaseline="hanging" style={{ fontSize: FS.micro }} fill={TK.sub}>
      {fmt ? fmt(t) : String(t)}
    </text>
  )
}

export default function LinePlot({ points, color, baseline, tFmt, vFmt, a11y = true, area, yAxis, yTicks, yFmt, xTicks, xFmt, grid, marks, endDot, baselineColor, baselineLabel, areaOpacity = 0.32, splitAt, splitUp, splitDown }: LinePlotProps) {
  const gid = useId().replace(/:/g, '')
  const vs = points.map(p => p.v)
  if (baseline != null) vs.push(baseline)   // 기준선이 늘 보이게 세로 범위에 넣는다
  const split = splitAt != null && Number.isFinite(splitAt) && splitUp && splitDown ? splitAt : null
  const data = split != null ? splitSeries(points, split) : points
  const lastColor = split != null && points.length ? (points[points.length - 1].v >= split ? splitUp! : splitDown!) : color
  const lo = Math.min(...vs), hi = Math.max(...vs)
  // 말풍선이 있으면 위·아래에 상자 자리를 더 둔다
  const padK = marks?.length ? 0.32 : 0.08
  const pad = (hi - lo) * padK || Math.abs(hi) * 0.001 || 1
  const t0 = points[0]?.t ?? 0, t1 = points[points.length - 1]?.t ?? 1
  const last = points[points.length - 1]
  const tickStyle = { fontSize: FS.micro, fill: TK.sub }
  const yW = yAxis ? Math.max(36, Math.max(0, ...(yTicks ?? []).map(v => textW((yFmt ?? String)(v), FS.micro))) + SP.sm) : 0
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: SP.xs, right: yAxis === 'right' ? 0 : endDot ? SP.md : SP.xs, bottom: SP.xs, left: yAxis === 'left' ? 0 : SP.xs }} accessibilityLayer={a11y}>
        {(area || split != null) && (
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={areaOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            {split != null && (
              <>
                {/* 위쪽 영역: 선에서 평단선으로 내려오며 옅어진다 · 아래쪽 영역: 평단선에서 선으로 내려가며 짙어진다 */}
                <linearGradient id={`gu${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={splitUp} stopOpacity={areaOpacity} /><stop offset="100%" stopColor={splitUp} stopOpacity={0.03} /></linearGradient>
                <linearGradient id={`gd${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={splitDown} stopOpacity={0.03} /><stop offset="100%" stopColor={splitDown} stopOpacity={areaOpacity} /></linearGradient>
              </>
            )}
          </defs>
        )}
        {grid && <CartesianGrid vertical={false} stroke={TK.line3} />}
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide={!xTicks}
          ticks={xTicks} tick={<XTick t0={t0} t1={t1} fmt={xFmt} />} axisLine={false} tickLine={false} interval={0} height={xTicks ? 22 : 0} />
        <YAxis domain={[lo - pad, hi + pad]} hide={!yAxis} orientation={yAxis ?? 'left'} ticks={yTicks} tickFormatter={yFmt}
          tick={tickStyle} axisLine={false} tickLine={false} width={yW} />
        {baseline != null && (
          <ReferenceLine y={baseline} stroke={baselineColor ?? TK.sub} strokeDasharray="4 4"
            label={baselineLabel ? { value: baselineLabel, position: 'insideTopLeft', fill: baselineColor ?? TK.sub, fontSize: FS.micro, fontWeight: 700 } : undefined} />
        )}
        <Tooltip content={<Tip tFmt={tFmt} vFmt={vFmt} />} cursor={{ stroke: TK.line4 }} />
        {split != null
          ? (
            <>
              {/* 두 색 모드 — 위·아래를 따로 그린다. 영역 바닥은 평단선(baseValue) */}
              <Area type="monotone" dataKey="up" stroke={splitUp} strokeWidth={2.2} fill={`url(#gu${gid})`} baseValue={split} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="dn" stroke={splitDown} strokeWidth={2.2} fill={`url(#gd${gid})`} baseValue={split} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
            </>
          )
          : area
          ? <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} fill={`url(#g${gid})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          : <Line type="linear" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />}
        {marks?.map(m => (
          <ReferenceDot key={`${m.name}${m.t}`} x={m.t} y={m.v} r={3.5} fill={TK.slate300} stroke={TK.bg2} strokeWidth={1.5}
            label={<MarkLabel mark={m} frac={t1 > t0 ? (m.t - t0) / (t1 - t0) : 0.5} />} />
        ))}
        {endDot && last && <ReferenceDot x={last.t} y={last.v} r={10} fill={lastColor} fillOpacity={0.22} stroke="none" />}
        {endDot && last && <ReferenceDot x={last.t} y={last.v} r={4} fill={TK.slate100} stroke={lastColor} strokeWidth={2} />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
