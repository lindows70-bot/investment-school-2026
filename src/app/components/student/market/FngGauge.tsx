'use client'
// 공포·탐욕 반원 게이지 — 0(극단 공포) 빨강 → 100(극단 탐욕) 초록으로 값 위치에 따라 색이 **연속**으로 바뀌는 호 + 바늘. 홈·시장 화면 공용
//   칸 경계를 긋지 않는다: CNN·alternative.me 의 구간 경계가 서로 달라 칸을 나누면 우리 임계값이 된다(색은 marketScreen.fngColor SSOT).
import { TK, FS, SP } from '@/lib/theme'
import { fngColor } from '@/lib/marketScreen'

const CX = 100, CY = 100, R = 80, W = 16, N = 60
const at = (v: number, r: number) => {
  const th = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100)
  return { x: CX + r * Math.cos(th), y: CY - r * Math.sin(th) }
}
const arc = (v0: number, v1: number) => {
  const a = at(v0, R), b = at(v1, R)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}
// 조각 사이 머리카락 틈이 보이지 않게 조금씩 겹친다
const SEGS = Array.from({ length: N }, (_, i) => ({ d: arc((i * 100) / N, Math.min(100, ((i + 1) * 100) / N + 0.4)), c: fngColor(((i + 0.5) * 100) / N) }))

export function FngGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const tip = at(v, R - W - 6), t0 = at(v, R - W / 2 - 4), t1 = at(v, R + W / 2 + 4)
  const s = at(0, R), e = at(100, R)
  return (
    <svg viewBox="0 0 200 110" width="100%" role="img" aria-label={`0(극단 공포)부터 100(극단 탐욕) 사이에서 ${Math.round(v)}`} style={{ display: 'block' }}>
      <circle cx={s.x} cy={s.y} r={W / 2} fill={fngColor(0)} />
      <circle cx={e.x} cy={e.y} r={W / 2} fill={fngColor(100)} />
      {SEGS.map((g, i) => <path key={i} d={g.d} fill="none" stroke={g.c} strokeWidth={W} />)}
      {/* 호 위 지금 위치 표시 + 바늘 */}
      <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke={TK.slate100} strokeWidth={4} strokeLinecap="round" />
      <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke={fngColor(v)} strokeWidth={5} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={7} fill={TK.slate100} />
      <circle cx={CX} cy={CY} r={3} fill={fngColor(v)} />
    </svg>
  )
}

/** 지금 값(큰 숫자 + 원천 분류 이름을 값 색으로) 왼쪽 · 게이지 오른쪽. 좁으면 게이지가 아래로 내려간다 */
export function FngHero({ value, cls }: { value: number; cls: string | null }) {
  const c = fngColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.md, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm }}>
        <span style={{ fontSize: FS.h1, fontWeight: 800, color: TK.slate100, lineHeight: 1 }}>{Math.round(value)}</span>
        {cls && <span style={{ fontSize: FS.lg, fontWeight: 700, color: c }}>{cls}</span>}
      </div>
      <div style={{ width: 176, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <FngGauge value={value} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>
          <span>0 극단 공포</span><span>100 극단 탐욕</span>
        </div>
      </div>
    </div>
  )
}

/** 최고·최저 값 한 조각 — 값을 같은 색 척도로 칠한다 */
export function FngVal({ v }: { v: number }) {
  return <b style={{ color: fngColor(v) }}>{v}</b>
}
