'use client'
// 🔔 벌집 국면 전환 알림 — 지역 국면(6국면)이 바뀐 최근 7일 이내 전환을 배너로(타점 워처의 부동산판). 전환 없으면 렌더 0.
import { useState, useEffect } from 'react'
import { TK } from '@/lib/theme'
import type { HoneycombResult } from '@/app/api/re-honeycomb/route'

export default function RePhaseAlert() {
  const [changes, setChanges] = useState<NonNullable<HoneycombResult['phaseChanges']>>([])

  useEffect(() => {
    let alive = true
    fetch('/api/re-honeycomb').then(r => r.ok ? r.json() : null)
      .then((j: HoneycombResult | null) => { if (alive && j?.phaseChanges?.length) setChanges(j.phaseChanges) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!changes.length) return null
  return (
    <div style={{ background: `linear-gradient(135deg,#1a1410,${TK.bg1})`, border: `1px solid ${TK.orange400}66`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.orange400 }}>🐝 국면 전환</span>
      {changes.slice(0, 6).map(c => (
        <span key={c.name} style={{ background: TK.bg3, border: `1px solid ${TK.orange400}44`, borderRadius: 7, padding: '3px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>
          <b style={{ color: TK.slate200 }}>{c.name}</b> <span style={{ color: TK.sub }}>{c.from}</span> <span style={{ color: TK.orange400 }}>→</span> <b style={{ color: TK.orange400 }}>{c.to}</b>
        </span>
      ))}
      <span style={{ fontSize: 10, color: TK.sub2 }}>{changes[0]?.date} 감지 · 벌집순환모형 기준(관측이지 매매 신호 아님)</span>
    </div>
  )
}
