'use client'
// 💰 수급 배지 — 리밸런서 매도/매수 카드에 클라이언트 lazy로 수급 신호를 한 칩으로 부착. 탭하면 상세 펼침
import { useState, useEffect } from 'react'
import type { MoneyFlowResult, FlowStatus } from '@/lib/moneyFlow'

const CFG: Record<Exclude<FlowStatus, 'UNSUPPORTED'>, { label: string; color: string; emoji: string }> = {
  INFLOW:    { label: '수급 유입',     color: '#22c55e', emoji: '🟢' },
  CROWDED:   { label: '수급 이탈·과열', color: '#ef4444', emoji: '🔴' },
  NEGLECTED: { label: '기관 소외',     color: '#f59e0b', emoji: '🟡' },
  NEUTRAL:   { label: '수급 중립',     color: '#8a9aaa', emoji: '⚪' },
}

export default function MoneyFlowBadge({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [data, setData] = useState<MoneyFlowResult | null>(null)
  const [done, setDone] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/money-flow?ticker=${encodeURIComponent(ticker)}&market=${market}&name=${encodeURIComponent(name)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive) setData(j) })
      .catch(() => {})
      .finally(() => { if (alive) setDone(true) })
    return () => { alive = false }
  }, [ticker, name, market])

  if (!done) return <span style={{ color: '#475569', fontSize: 10.5 }}>· 수급…</span>
  if (!data || data.status === 'UNSUPPORTED') return null
  const c = CFG[data.status]

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, background: `${c.color}1a`, color: c.color,
          border: `1px solid ${c.color}55`, borderRadius: 999, padding: '1px 7px 1px 8px', fontSize: 10.5, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.6,
        }}
        aria-expanded={open}
      >
        {c.emoji} {c.label}
        <span style={{ fontSize: 8, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && (
        <div style={{ flexBasis: '100%', width: '100%', marginTop: 6, background: `${c.color}0d`, border: `1px solid ${c.color}33`, borderRadius: 8, padding: '9px 12px' }}>
          <div style={{ color: '#cbd5e1', fontSize: 11.5, lineHeight: 1.6 }}>{data.lynchComment}</div>
          <div style={{ color: c.color, fontSize: 11.5, fontWeight: 600, lineHeight: 1.55, marginTop: 5 }}>🧭 {data.actionGuide}</div>
        </div>
      )}
    </>
  )
}
