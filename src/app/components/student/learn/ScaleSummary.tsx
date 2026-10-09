'use client'
// 배우기 '더 알아보기' — 오늘의 저울 요약 카드(5줄 × ①②③ 칩만 · 오늘 바뀐 칸 · 누르면 /s/scale). 문장·숫자는 저울 화면에서
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { noteStyle } from '@/app/components/student/home/homeUi'
import type { ScaleResult, ScaleQ } from '@/lib/scale'

const Q_SHORT: Record<ScaleQ, string> = { cash: '①', price: '②', season: '③' }
const dot = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

export default function ScaleSummary() {
  const r = useJson<ScaleResult>('/api/scale')
  const ok = r.state === 'ok' && Array.isArray(r.data?.rows) && r.data!.rows.length > 0
  const changes = ok ? r.data!.changes ?? [] : []
  return (
    <Link href="/s/scale" aria-label="오늘의 저울 열기" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, padding: SP.lg, borderRadius: RAD.lg, background: TK.card, border: `1px solid ${TK.border}`, textDecoration: 'none', minWidth: 0 }}>   {/* 리디자인 2026-10-10: 다른 카드와 같은 면(라운드 16 · 헤어라인) */}
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>오늘의 저울 ›</span>
        <span style={{ fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>① 돈을 만드나 · ② 비싼가 · ③ 계절</span>
      </span>
      {(r.state === 'idle' || r.state === 'loading') && <span style={noteStyle()}>다섯 자산을 재는 중…</span>}
      {(r.state === 'failed' || r.state === 'unauth' || (r.state === 'ok' && !ok)) && <span style={noteStyle(TK.amber400)}>저울을 못 불러왔어요 — 눌러서 다시 열어 보세요.</span>}
      {ok && changes.length > 0 && (
        <span style={{ fontSize: FS.tiny, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
          {r.data!.changedSince ? `${dot(r.data!.changedSince)}보다 ` : ''}바뀐 칸 {changes.length}개 — {changes.slice(0, 2).map(c => `${c.name} ${Q_SHORT[c.q]} ${c.from}→${c.to}`).join(' · ')}{changes.length > 2 ? ' …' : ''}
        </span>
      )}
      {ok && r.data!.rows.map(row => (
        <span key={row.asset} style={{ display: 'grid', gridTemplateColumns: '48px repeat(3, minmax(0, 1fr))', alignItems: 'center', gap: SP.xs, minWidth: 0 }}>
          <span style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate200 }}>{row.name}</span>
          {row.cells.map(c => (
            <span key={c.q} title={c.chip ?? undefined} style={{ minWidth: 0, padding: `2px ${SP.xs}px`, borderRadius: RAD.pill, background: TK.bg3, color: c.chip ? TK.slate200 : TK.sub, fontSize: FS.micro, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.chip ?? '—'}
            </span>
          ))}
        </span>
      ))}
    </Link>
  )
}
