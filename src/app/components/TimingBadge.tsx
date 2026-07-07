'use client'
// 🚦 타점 신호등 배지 — 추천 카드 공용(통합추천·리밸런싱·퀀트빌더·로테이션). 점수와 무관한 WHEN 정보 레이어.
import type { EntryTiming } from '@/lib/entryTiming'

const COL: Record<string, { c: string; bg: string; bd: string }> = {
  green: { c: '#4ade80', bg: '#14532d33', bd: '#22c55e55' },
  yellow: { c: '#eab308', bg: '#42200633', bd: '#eab30855' },
  red: { c: '#f87171', bg: '#7f1d1d33', bd: '#ef444455' },
}

export default function TimingBadge({ t, market, compact = false }: { t: EntryTiming | null | undefined; market?: string; compact?: boolean }) {
  if (!t) return null
  const s = COL[t.light]
  const fmtStop = (n: number) => market === 'KR' ? `₩${Math.round(n).toLocaleString()}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (compact) return (
    <span title={`${t.guide}${t.atrStop != null ? ` · 🛡ATR손절 ${fmtStop(t.atrStop)}` : ''}`}
      style={{ fontSize: 9.5, fontWeight: 800, color: s.c, background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  )
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 8, padding: '6px 10px', fontSize: 10.5, lineHeight: 1.55 }}>
      <b style={{ color: s.c }}>{t.label}</b>
      <span style={{ color: '#aab6c4' }}> — {t.guide}</span>
      {t.atrStop != null && <span style={{ color: '#c4b5fd' }}> · 🛡 손절 참고 {fmtStop(t.atrStop)}</span>}
    </div>
  )
}
