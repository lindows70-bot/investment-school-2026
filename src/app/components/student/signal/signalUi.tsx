'use client'
// 위기 신호등 공용 모양 — 등 한 알(Lamp) · 세 알짜리 신호등(TrafficLight) · 색 이름. 홈 카드와 상세 화면(/s/signal)이 같은 부품을 쓴다
//   빨강·노랑·초록은 여기서만 '신호등 색'이다 — 등락색(오름 빨강·내림 파랑)과 섞이지 않게 글자는 칠하지 않고 등(동그라미)만 칠한다. 색맹 대비로 색 이름을 늘 글자로 함께 적는다
import type { CSSProperties } from 'react'
import { TK, RAD, SP } from '@/lib/theme'
import type { LightColor } from '@/lib/crisisSignal'

export const LAMP: Record<LightColor, string> = { red: TK.red400, yellow: TK.amber400, green: TK.green400, none: TK.slate600 }
export const COLOR_KO: Record<LightColor, string> = { red: '빨강', yellow: '노랑', green: '초록', none: '모름' }

/** 등 한 알 — 켜진 등은 번짐(glow) + 윗부분 반사, 모름은 테두리만 */
export function Lamp({ color, size = 14, off = false, style }: { color: LightColor; size?: number; off?: boolean; style?: CSSProperties }) {
  const c = LAMP[color]
  const lit = color !== 'none' && !off
  return (
    <span aria-hidden style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
      background: lit ? `radial-gradient(circle at 35% 30%, ${TK.slate100}99 0%, ${c} 38%, ${c} 100%)` : off ? `${c}2e` : 'transparent',
      border: lit ? 'none' : `1.5px ${color === 'none' ? 'dashed' : 'solid'} ${off ? `${c}55` : TK.slate500}`,
      boxShadow: lit ? `0 0 ${Math.round(size * 0.9)}px ${c}8c` : 'none',
      ...style,
    }} />
  )
}

/** 신호등 — 세 알(빨강·노랑·초록) 중 지금 색만 켠다. 모름이면 셋 다 꺼진다. vertical = 세로(상세), 아니면 가로(홈 카드) */
export function TrafficLight({ color, lamp = 22, vertical = false }: { color: LightColor; lamp?: number; vertical?: boolean }) {
  return (
    <span role="img" aria-label={`신호등 ${COLOR_KO[color]}`} style={{
      display: 'inline-flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', gap: Math.round(lamp * 0.36), flexShrink: 0,
      padding: Math.round(lamp * 0.36), borderRadius: RAD.pill, background: TK.bg0, border: `1px solid ${TK.line1}`,
    }}>
      {(['red', 'yellow', 'green'] as const).map(c => <Lamp key={c} color={c} size={lamp} off={c !== color} />)}
    </span>
  )
}

/** 등 이름 칩 — 등 한 알 + 짧은 이름. 홈 카드의 한 줄 요약 */
export function LampChip({ color, name }: { color: LightColor; name: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: SP.xs + 2, whiteSpace: 'nowrap', minWidth: 0 }}>
      <Lamp color={color} size={12} />
      <span>{name}</span>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{COLOR_KO[color]}</span>
    </span>
  )
}

/** 'YYYY-MM-DD' → 'YYYY.M.D' · 'YYYY-MM' → 'YYYY.M' */
export const dotDate = (s: string): string =>
  s.length === 7 ? `${s.slice(0, 4)}.${Number(s.slice(5, 7))}` : `${s.slice(0, 4)}.${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`
