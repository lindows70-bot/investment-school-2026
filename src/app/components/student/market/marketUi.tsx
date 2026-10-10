'use client'
// 학생 시장 화면 카드들이 함께 쓰는 모양 — 칩 줄(가로 스크롤)·배지·종목 줄·더 보기·도움말(?)·상태 문구·지연 차트·마운트 뒤 '지금'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { View } from '@/lib/marketScreen'
import { FailRow, noteStyle } from '@/app/components/student/home/homeUi'

// dynamic() 은 이 자리에서 바로 평가된다 — loading 은 호이스팅되는 function 선언이어야 한다(const 화살표는 TDZ)
/** Recharts 선 차트 — 부모가 높이를 정한 상자 안에 넣는다. 그릴 때 처음 recharts 청크를 받는다 */
export const LinePlot = dynamic(() => import('@/app/components/student/market/LinePlot'), { ssr: false, loading: PlotLoading })
function PlotLoading() { return <div style={{ height: '100%' }} /> }

/** 마운트 뒤에만 정해지는 지금 시각(1분마다) — 렌더 중 new Date() 는 서버·브라우저가 달라 하이드레이션을 깨뜨린다 */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export interface ChipOpt<K extends string> { key: K; label: string; dim?: boolean }
/** 칩 줄 — 넘치면 가로로 밀어 본다(줄바꿈 없음). 버튼은 44px */
export function ChipRow<K extends string>({ label, options, value, onChange }: { label: string; options: ChipOpt<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    // 넘치면 다음 줄로 — 가로 스크롤은 폰(375px)에서 '거래대금' 칩이 반쯤 잘려 보였고, 밀어야 한다는 표시가 없었다(2026-09-27 실측)
    <div role="group" aria-label={label} style={{ display: 'flex', gap: SP.xs, flexWrap: 'wrap', minWidth: 0 }}>
      {options.map(o => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            style={{
              height: 44, flexShrink: 0, padding: `0 ${SP.md}px`, borderRadius: RAD.pill,
              border: `1px solid ${on ? TK.line4 : TK.line1}`, background: on ? TK.bg7 : 'transparent',
              color: on ? TK.slate100 : o.dim ? TK.slate500 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 카드 제목 줄의 기간 탭 — 참고 앱처럼 제목 오른쪽에 붙는 작은 묶음(1달/3달/1년). 버튼 높이는 터치 규칙대로 44 */
export function RangeTabs<K extends string>({ label, options, value, onChange }: { label: string; options: ChipOpt<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    // 리디자인 2026-10-10: 카드 안 상자(bg3)를 없애고 선택 칸만 밝게(TK.bg7) — Segment 와 같은 문법의 작은 판
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {options.map(o => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            style={{
              height: 40, padding: `0 ${SP.sm + 2}px`, borderRadius: RAD.sm, border: 'none', background: on ? TK.bg7 : 'transparent',
              color: on ? TK.slate100 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export type BadgeTone = 'mine' | 'plain' | 'warn'
const BADGE_C: Record<BadgeTone, { c: string; b: string }> = {
  mine: { c: TK.teal400, b: TK.teal400 },
  plain: { c: TK.slate300, b: TK.line1 },
  warn: { c: TK.amber400, b: TK.amber700 },
}
/** 작은 배지 — 등락색(빨강·파랑)은 쓰지 않는다(오름·내림으로 읽히니까) */
export function Badge({ text, tone = 'plain' }: { text: string; tone?: BadgeTone }) {
  const t = BADGE_C[tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: `0 ${SP.xs}px`, borderRadius: RAD.xs, border: `1px solid ${t.b}`, color: t.c, fontSize: FS.micro, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.5 }}>
      {text}
    </span>
  )
}

/** 종목 한 줄 — 긴 이름은 말줄임, 오른쪽 숫자는 줄바꿈 없음. 누르면 종목 상세로 */
export function StockRow({ href, rank, name, tag, badges, main, mainColor, sub, subColor }: {
  href: string; rank?: number; name: string; tag?: string | null
  badges?: { text: string; tone?: BadgeTone }[]
  main: string; mainColor?: string; sub?: string | null; subColor?: string
}) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 52, padding: `${SP.xs}px 0`, borderTop: `1px solid ${TK.border}`, color: TK.slate200, textDecoration: 'none', minWidth: 0 }}>
      {rank != null && <span style={{ width: 20, flexShrink: 0, textAlign: 'right', fontSize: FS.tiny, color: TK.sub }}>{rank}</span>}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: SP.xs, minWidth: 0 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: FS.body, fontWeight: 600, color: TK.slate100 }}>{name}</span>
          {tag && <span style={{ flexShrink: 0, fontSize: FS.micro, color: TK.sub }}>{tag}</span>}
        </span>
        {badges && badges.length > 0 && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: SP.xs }}>
            {badges.map(b => <Badge key={b.text} text={b.text} tone={b.tone} />)}
          </span>
        )}
      </span>
      <span style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: SP.xs }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: mainColor ?? TK.slate100, whiteSpace: 'nowrap' }}>{main}</span>
        {sub && <span style={{ fontSize: FS.tiny, color: subColor ?? TK.sub, whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    </Link>
  )
}

/** '더 보기'·'접기' — total 이 shown 보다 많을 때만 */
export function MoreToggle({ open, total, shown, onToggle }: { open: boolean; total: number; shown: number; onToggle: () => void }) {
  if (total <= shown && !open) return null
  return (
    <button type="button" onClick={onToggle} aria-expanded={open}
      style={{ height: 44, width: '100%', borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer' }}>
      {open ? '접기' : `더 보기 (${total}개까지)`}
    </button>
  )
}

/** 카드 제목 옆 '?' — 누르면 도움말을 펼친다(44px) */
export function HelpButton({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={label}
      style={{ width: 44, height: 44, borderRadius: RAD.pill, border: 'none', background: 'transparent', color: open ? TK.slate100 : TK.sub, fontSize: FS.body, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
      ?
    </button>
  )
}

/** 도움말 상자 — 줄마다 한 문장 */
export function HelpBox({ lines }: { lines: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3 }}>
      {lines.map(l => <span key={l} style={noteStyle(TK.slate300)}>{l}</span>)}
    </div>
  )
}

/** 불러오는 중 · 못 가져옴(+다시). 받았으면 아무것도 안 그린다 */
export function Pending({ view, loading, fail, onRetry, retryLabel }: { view: View<unknown>; loading: string; fail: string; onRetry: () => void; retryLabel: string }) {
  if (view.kind === 'loading') return <span style={noteStyle()}>{loading}</span>
  if (view.kind === 'failed') return <FailRow text={fail} onRetry={onRetry} retryLabel={retryLabel} />
  return null
}
