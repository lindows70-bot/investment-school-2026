'use client'
// 🔔 타점 전환 배너 — 내 보유 종목의 신호등이 어제와 달라졌을 때만 조용히 등장(변화 없으면 렌더 0)
//    🟢 전환 = 기다리던 돌파(매물대 소화·정배열 안착) / 🔴 전환 = 최후 방어선 붕괴 경계
import { useState, useEffect } from 'react'
import type { WatchChange } from '@/app/api/cron/timing-watch/route'

const L: Record<string, { icon: string; txt: string; c: string; bg: string }> = {
  green: { icon: '🟢', txt: '진입 적기로 전환(돌파)', c: '#4ade80', bg: '#14532d33' },
  yellow: { icon: '🟡', txt: '대기 구간으로 전환', c: '#eab308', bg: '#42200633' },
  red: { icon: '🔴', txt: '진입 유예·추세 이탈', c: '#f87171', bg: '#7f1d1d33' },
}

export default function TimingWatchBanner() {
  const [changes, setChanges] = useState<WatchChange[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/timing-watch').then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.changes?.length) setChanges(j.changes) })
      .catch(() => {})
  }, [])

  if (!changes.length || dismissed) return null

  return (
    <div style={{ background: 'linear-gradient(135deg,#151226,#0d1017)', border: '1px solid #a78bfa55', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#c4b5fd' }}>🔔 내 종목 타점 전환</span>
      {changes.slice(0, 6).map(c => {
        const to = L[c.to]
        return (
          <span key={c.ticker + c.market} title={to.txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: to.bg, border: `1px solid ${to.c}55`, borderRadius: 7, padding: '3px 9px', fontSize: 11 }}>
            <b style={{ color: '#e2e8f0' }}>{c.market === 'KR' ? '🇰🇷' : '🇺🇸'} {c.name}</b>
            <span style={{ color: '#8599ae', fontFamily: 'monospace', fontSize: 10 }}>{L[c.from]?.icon}→{to.icon}</span>
            <b style={{ color: to.c, fontSize: 10 }}>{c.to === 'green' ? '돌파!' : c.to === 'red' ? '이탈 경계' : '대기'}</b>
          </span>
        )
      })}
      {changes.length > 6 && <span style={{ fontSize: 10, color: '#7f93a8' }}>외 {changes.length - 6}건</span>}
      <span style={{ fontSize: 11, color: '#a8b5c2' }}>어제 대비 EMA112·224+구름 국면 변화 · 기술적 차트에서 확인</span>
      <button onClick={() => setDismissed(true)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#8a9aaa', cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  )
}
