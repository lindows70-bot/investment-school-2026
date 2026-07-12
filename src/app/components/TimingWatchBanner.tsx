'use client'
// 🔔 오늘의 타점 신호 배너 — 내 보유 종목의 매수/매도 타점이 어제와 달라졌을 때만 조용히 등장(변화 없으면 렌더 0).
//    신호등(EMA·구름) + 🎼라쉬케(첫눌림목·하락다이버전스) + 🔥스퀴즈(분출) + 📊매물·평단(지지 전환)을 한 배너에. ⛔ 알림만·자동주문 없음.
import { useState, useEffect } from 'react'
import type { WatchSig } from '@/app/api/cron/timing-watch/route'

export default function TimingWatchBanner() {
  const [sigs, setSigs] = useState<WatchSig[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/timing-watch').then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.sigs?.length) setSigs(j.sigs) })
      .catch(() => {})
  }, [])

  if (!sigs.length || dismissed) return null

  const sells = sigs.filter(s => s.kind === 'sell')
  const buys = sigs.filter(s => s.kind === 'buy')

  const Chip = ({ s }: { s: WatchSig }) => {
    const c = s.kind === 'sell' ? '#f87171' : '#4ade80'
    const bg = s.kind === 'sell' ? '#7f1d1d33' : '#14532d33'
    return (
      <span title={s.detail} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, border: `1px solid ${c}55`, borderRadius: 7, padding: '3px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>
        <b style={{ color: '#e2e8f0' }}>{s.market === 'KR' ? '🇰🇷' : '🇺🇸'} {s.name}</b>
        <b style={{ color: c, fontSize: 10 }}>{s.icon} {s.label}</b>
      </span>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(135deg,#151226,#0d1017)', border: '1px solid #a78bfa55', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#c4b5fd' }}>🔔 오늘의 타점 신호</span>
      {sells.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#f87171' }}>🔴 매도·경계</span>}
      {sells.slice(0, 5).map(s => <Chip key={s.ticker + s.market + s.label} s={s} />)}
      {buys.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#4ade80', marginLeft: sells.length ? 4 : 0 }}>🟢 매수 기회</span>}
      {buys.slice(0, 5).map(s => <Chip key={s.ticker + s.market + s.label} s={s} />)}
      {sigs.length > 10 && <span style={{ fontSize: 10, color: '#7f93a8' }}>외 {sigs.length - 10}건</span>}
      <span style={{ fontSize: 10.5, color: '#a8b5c2' }}>어제 대비 전환 · 기술적 차트에서 확인</span>
      <button onClick={() => setDismissed(true)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#8a9aaa', cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  )
}
