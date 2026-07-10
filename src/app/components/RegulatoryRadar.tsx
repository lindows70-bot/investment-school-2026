'use client'
// 🏛️ 규제 레이더 — 암호화폐 법안/규제 신호등(친화/중립/규제) + 관련 코인 매칭
import { useState, useEffect } from 'react'
import type { RegulationResult, RegImpact } from '@/app/api/crypto-regulation/route'

const BORDER = '#1e293b'
const SIG: Record<RegImpact, { c: string; bg: string; label: string; dot: string }> = {
  green:  { c: '#22c55e', bg: 'rgba(34,197,94,0.08)',  label: '친화 (유동성 유입)', dot: '🟢' },
  yellow: { c: '#fbbf24', bg: 'rgba(251,191,36,0.08)', label: '논의 중 (불확실)',   dot: '🟡' },
  red:    { c: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: '규제 (유동성 차단)', dot: '🔴' },
}

export default function RegulatoryRadar() {
  const [d, setD] = useState<RegulationResult | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/crypto-regulation', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
    return () => { alive = false }
  }, [])

  if (!d || d.bills.length === 0) return null
  const cm = SIG[d.climate]

  return (
    <div style={{ background: cm.bg, border: `1px solid ${cm.c}44`, borderRadius: 12, padding: '12px 15px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
        <span style={{ fontSize: 15 }}>🏛️</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>규제 레이더</span>
        <span style={{ background: `${cm.c}1f`, color: cm.c, border: `1px solid ${cm.c}55`, borderRadius: 999, padding: '1px 10px', fontSize: 11, fontWeight: 800 }}>{cm.dot} 규제 기후: {cm.label}</span>
        <span style={{ color: '#aab6c4', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.climateText}</span>
        <span style={{ color: cm.c, fontSize: 11, fontWeight: 700 }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
          {d.bills.map((b, i) => {
            const s = SIG[b.impact]
            return (
              <div key={i} style={{ background: '#0f1117', border: `1px solid ${s.c}33`, borderRadius: 9, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 11 }}>{s.dot}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>{b.title}</span>
                  <span style={{ background: `${s.c}14`, color: s.c, border: `1px solid ${s.c}44`, borderRadius: 5, padding: '0 6px', fontSize: 9.5, fontWeight: 700 }}>{b.status}</span>
                  {b.assets.slice(0, 5).map(a => (
                    <span key={a} style={{ background: '#161b25', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '0 6px', fontSize: 9.5, color: '#93c5fd', fontWeight: 700 }}>{a}</span>
                  ))}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.6 }}>{b.summary}</div>
              </div>
            )
          })}
          <div style={{ color: '#8a9aaa', fontSize: 9.5, lineHeight: 1.5 }}>
            🟢 제도권 편입·유동성 유입 / 🟡 논의 중·불확실 / 🔴 규제 강화·유동성 차단 · Google News 실시간 헤드라인을 Gemini가 신호등 분류(헤드라인에 있는 사건만) · 6h 캐시 · 법률 자문이 아닌 교육용 요약입니다.
          </div>
        </div>
      )}
    </div>
  )
}
