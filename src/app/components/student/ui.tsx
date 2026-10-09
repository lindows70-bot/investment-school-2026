'use client'
// 학생 화면 공용 프리미티브 — 카드·라벨·큰 수치·칩·타일·빛. "면 둘 · 글자 네 단 · 색 다섯 · 라운드 셋"(docs/student-design/plan.md)을 코드로 고정한다
//   면: 바탕(셸) + 카드(TK.card + TK.border 헤어라인) 둘뿐 — 카드 안의 카드는 만들지 않는다.
//   색: 틴트 TK.blue400(링크·아이콘) · 등락 red400/blue400 · 역할 칩 둘(리그 neonLime · 기록 amber400). 새 hex 없음.
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'

/** 표준 카드 면 — homeUi.card 와 같은 값(둘 다 여기 값을 본다) */
export const surface: CSSProperties = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.lg, padding: SP.lg, minWidth: 0 }

export function Card({ children, style, ariaLabel }: { children: ReactNode; style?: CSSProperties; ariaLabel?: string }) {
  return <section aria-label={ariaLabel} style={{ ...surface, display: 'flex', flexDirection: 'column', gap: SP.sm, ...style }}>{children}</section>
}

/** 라벨 — 카드 맨 위 작은 설명(무엇의 숫자인가) */
export function Label({ children, color = TK.sub, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <span style={{ fontSize: FS.tiny, fontWeight: 600, color, minWidth: 0, ...style }}>{children}</span>
}

/** 핵심 수치 — 한 카드에 하나. 자간을 붙이고 숫자 폭을 고정한다 */
export function Big({ children, size = FS.h2, color = TK.slate100 }: { children: ReactNode; size?: number; color?: string }) {
  return <span style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
}

export type ChipTone = 'lime' | 'gold' | 'plain'
const CHIP: Record<ChipTone, { bg: string; fg: string }> = {
  lime: { bg: TK.neonLime, fg: TK.bg1 },     // 리그 전용
  gold: { bg: TK.amber400, fg: TK.bg1 },     // 기록 전용(경고 글자색과 겹치지 않게 알약 모양으로만)
  plain: { bg: TK.bg7, fg: TK.slate300 },
}
/** 역할 칩 — 알약 · 검은 글자. 성과를 색으로 칠하는 데 쓰지 않는다(등락은 글자색으로) */
export function Chip({ text, tone = 'plain' }: { text: string; tone?: ChipTone }) {
  const c = CHIP[tone]
  return <span style={{ display: 'inline-block', padding: `1px ${SP.sm}px`, borderRadius: RAD.pill, background: c.bg, color: c.fg, fontSize: FS.micro, fontWeight: 800, lineHeight: 1.6, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{text}</span>
}

/** 타일 — 라벨 → 수치(+칩) → 한 줄 보조. 누르면 href. 리그·기록처럼 "지금 내 상태" 하나를 담는다 */
export function Tile({ href, label, value, chip, sub, valueSize = FS.xl, ariaLabel }: { href?: string; label: string; value: ReactNode; chip?: ReactNode; sub?: ReactNode; valueSize?: number; ariaLabel?: string }) {
  const body = (
    <>
      <Label>{label}</Label>
      <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, minWidth: 0, flexWrap: 'wrap' }}>
        <Big size={valueSize}>{value}</Big>
        {chip}
      </span>
      {sub != null && <span style={{ fontSize: FS.tiny, color: TK.sub, minWidth: 0, overflowWrap: 'anywhere' }}>{sub}</span>}
    </>
  )
  const style: CSSProperties = { ...surface, display: 'flex', flexDirection: 'column', gap: SP.xs, color: TK.slate200, textDecoration: 'none', minHeight: 44 }
  return href
    ? <Link href={href} aria-label={ariaLabel} style={style}>{body}</Link>
    : <div aria-label={ariaLabel} style={style}>{body}</div>
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']
/** 'YYYY-MM-DD' → '10월 9일 금요일' — 문자열만 본다(시계 안 봄 · 페이지의 useKstToday 가 마운트 뒤 준다) */
export function dateLine(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return `${mo}월 ${d}일 ${DOW[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]}요일`
}

/** 화면 머리 — 날짜 한 줄(작게) + 큰 제목. 홈(인사)·시장·내 자산·리그·배우기가 같은 머리를 쓴다 */
export function PageHead({ title, today, extra }: { title: ReactNode; today: string | null; extra?: ReactNode }) {
  const d = today ? dateLine(today) : null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.sm, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
        <span style={{ fontSize: FS.tiny, fontWeight: 600, color: TK.sub, minHeight: 20 }}>{d ?? ' '}</span>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
      </div>
      {extra}
    </div>
  )
}

export interface SegOpt<K extends string> { key: K; label: string }
/** 구간 선택(국내·미국·코인 / 코인·미국 주식) — 카드 면 위에 선택 칸만 밝게. 버튼 44px */
export function Segment<K extends string>({ label, options, value, onChange }: { label: string; options: SegOpt<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: SP.xs, padding: SP.xs, borderRadius: RAD.md, background: TK.card, border: `1px solid ${TK.border}` }}>
      {options.map(o => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            style={{ height: 40, minWidth: 0, borderRadius: RAD.sm, border: 'none', background: on ? TK.bg7 : 'transparent', color: on ? TK.slate100 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 가로 막대 — 값의 크기를 한눈에(요즘 강한 분야 1달 흐름). 등락색은 호출부가 준다 · 폭은 0~1 */
export function Bar({ ratio, color }: { ratio: number; color: string }) {
  const w = Math.max(0, Math.min(1, ratio))
  return (
    <span aria-hidden style={{ display: 'block', height: 6, borderRadius: RAD.pill, background: TK.bg7, overflow: 'hidden', minWidth: 0 }}>
      <span style={{ display: 'block', height: '100%', width: `${w * 100}%`, background: color, borderRadius: RAD.pill }} />
    </span>
  )
}

/** 빛 한 점 — 카드 아래쪽에서 올라오는 틴트 라디얼. 한 화면에 하나(가장 중요한 숫자 카드)만 */
export function Glow() {
  return <span aria-hidden style={{ position: 'absolute', left: '-20%', right: '-20%', bottom: '-60%', height: '120%', pointerEvents: 'none', background: `radial-gradient(50% 60% at 50% 100%, ${TK.blue400}47, transparent 70%)` }} />
}
