'use client'
// 내 자산 히트맵 — 코어·위성 두 묶음, 칸 크기 = 평가금액, 색 = 오늘 등락(한국식 빨강 상승·파랑 하락). 시세 없는 종목은 점선 칸으로 밝힌다.
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { squarify, splitGroups, heatFill, type Rect } from '@/lib/treemap'
import type { HoldingRow } from '@/lib/portfolioSummary'
import { won, pct } from '@/lib/studentFormat'
const GAP = 3          // 칸 사이 틈 — 보합(회색) 칸끼리도 경계가 보이게
const LABEL_MIN_W = 60 // 이보다 좁은 묶음은 이름표를 숨긴다(옆 이름표와 겹침)

// 가장자리를 반올림한다(크기가 아니라) — 크기를 반올림하면 칸 사이에 1px 틈·겹침이 생긴다
function snap(r: Rect) {
  const left = Math.round(r.x), top = Math.round(r.y)
  return {
    left, top,
    width: Math.max(Math.round(r.x + r.w) - left - GAP, 0),
    height: Math.max(Math.round(r.y + r.h) - top - GAP, 0),
  }
}

export default function Heatmap({ rows, corePct, height = 240 }: { rows: HoldingRow[]; corePct: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    // 정수로 내림 — 소수점 폭 변화마다 다시 그리는 루프를 막는다
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  const top = 22
  const box: Rect = { x: 0, y: top, w, h: height - top }
  const core = rows.filter(r => r.role === 'CORE'), sat = rows.filter(r => r.role === 'SATELLITE')
  const coreVal = core.reduce((a, r) => a + r.evalKrw, 0), satVal = sat.reduce((a, r) => a + r.evalKrw, 0)
  const g = splitGroups(coreVal, satVal, box)
  const tiles = [
    ...squarify(core.map(r => r.evalKrw), g.core).map((rect, i) => ({ rect, row: core[i] })),
    ...squarify(sat.map(r => r.evalKrw), g.sat).map((rect, i) => ({ rect, row: sat[i] })),
  ].map(t => ({ ...t, pos: snap(t.rect) }))
    // 반올림 뒤 폭·높이가 0 인 칸은 그리지 않는다 — 테두리만 점으로 남고, 보이지 않는 링크가 탭 순서에 끼어든다
    .filter(t => t.pos.width > 0 && t.pos.height > 0)

  // 두 묶음이 다 있을 때만 corePct 를 나눠 적고, 한쪽뿐이면 그쪽이 100%다
  const both = coreVal > 0 && satVal > 0
  const coreLabel = both ? Math.round(corePct) : 100
  const satLabel = both ? 100 - coreLabel : 100   // 두 이름표 합이 늘 100

  return (
    <section aria-label="한눈에 보는 내 종목" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>한눈에 보는 내 종목</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>크기 = 평가금액 · 색 = 오늘 등락</span>
      </div>
      <div ref={ref} style={{ position: 'relative', width: '100%', height }}>
        {w > 0 && g.core.w >= LABEL_MIN_W && (
          <span style={{ position: 'absolute', left: 2, top: 0, fontSize: FS.micro, fontWeight: 700, color: TK.sky400 }}>코어 {coreLabel}%</span>
        )}
        {w > 0 && g.sat.w >= LABEL_MIN_W && (
          <span style={{ position: 'absolute', left: Math.round(g.sat.x) + 2, top: 0, fontSize: FS.micro, fontWeight: 700, color: TK.orange400 }}>위성 {satLabel}%</span>
        )}
        {w > 0 && tiles.map(({ row, pos }) => {
          const fill = heatFill(row.priced ? row.changePct : null, { red500: TK.red500, blue500: TK.blue500, flat2: TK.line1 })
          const showText = pos.width >= 44 && pos.height >= 28
          const big = pos.height > 90 && pos.width > 90
          const hasPct = row.priced && row.changePct != null
          // '지난 시세' 꼬리표는 % 옆에 들어갈 폭이 있을 때만(좁으면 잘려 보인다 — aria-label 에는 항상 들어간다)
          const label = hasPct
            ? `${row.name} 오늘 ${pct(row.changePct as number)}${row.stale ? '(지난 시세)' : ''} · ${won(row.evalKrw)}`
            : `${row.name} 시세 없음 · 매수가 기준 ${won(row.evalKrw)}`
          return (
            <Link key={row.id} href={`/s/stock/${encodeURIComponent(row.ticker)}`} title={row.name} aria-label={label}
              style={{
                position: 'absolute', ...pos, boxSizing: 'border-box',
                padding: pos.height < 48 ? SP.xs : SP.sm, borderRadius: RAD.xs, overflow: 'hidden',
                background: fill ?? TK.card, border: fill ? 'none' : `1px dashed ${TK.sub}`,
                color: TK.slate100, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2,
              }}>
              {showText && <>
                <span style={{ fontSize: FS.tiny, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                {hasPct
                  ? <span style={{ fontSize: big ? FS.lg : FS.tiny, fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {pct(row.changePct as number)}
                      {row.stale && pos.width >= (big ? 130 : 110) && <span style={{ fontSize: FS.tiny, fontWeight: 600, color: TK.slate100 }}> 지난 시세</span>}
                    </span>
                  : pos.height > 48 && <span style={{ fontSize: FS.tiny, color: TK.sub }}>시세 못 가져옴 · 매수가로 계산</span>}
                {pos.height > 76 && <span style={{ fontSize: FS.tiny, color: TK.slate100 }}>{won(row.evalKrw)}</span>}
              </>}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
