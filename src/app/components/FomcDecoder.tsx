'use client'
// 🏛️ FOMC 디코더 — 직전 연준 회의 결정 + 워시 의장 발언 해석 + 매크로 방향(Fed Watch 탭 최상단 서사 카드)
import { useState, useEffect } from 'react'
import type { FomcDecoderResult, Stance, GapKind } from '@/app/api/fomc-decoder/route'

const CARD = '#161b25', BORDER = '#1e293b'
const STANCE: Record<Stance, { label: string; color: string; icon: string }> = {
  hawkish: { label: '매파 (긴축)', color: '#ef4444', icon: '🦅' },
  neutral: { label: '중립', color: '#fbbf24', icon: '⚖️' },
  dovish:  { label: '비둘기 (완화)', color: '#22c55e', icon: '🕊️' },
}
const GAP: Record<GapKind, { label: string; color: string; icon: string }> = {
  aligned: { label: '의장 ↔ 시장 일치', color: '#22c55e', icon: '🤝' },
  partial: { label: '부분 차이',        color: '#fbbf24', icon: '↔️' },
  diverge: { label: '의장 ↔ 시장 충돌',  color: '#ef4444', icon: '⚡' },
}

export default function FomcDecoder() {
  const [d, setD] = useState<FomcDecoderResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/fomc-decoder', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🏛️ 직전 FOMC 회의 내용을 해석하는 중…</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>FOMC 해석 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>

  const s = STANCE[d.stance]

  return (
    <div style={{ background: `linear-gradient(135deg, ${s.color}14, rgba(96,165,250,0.05))`, border: `1px solid ${s.color}55`, borderRadius: 14, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20 }}>🏛️</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>FOMC 디코더</span>
        <span style={{ background: '#0f1117', color: '#cbd5e1', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{d.meetingLabel} · {d.meetingDate}</span>
        <span style={{ color: '#7f93a8', fontSize: 11 }}>
          {d.isRecent ? `🔴 ${d.daysSince}일 전 회의 — 따끈한 결정` : d.nextDate ? `다음 회의 ${d.nextDate}` : ''}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: `${s.color}1f`, color: s.color, border: `1px solid ${s.color}66`, borderRadius: 999, padding: '4px 13px', fontSize: 13, fontWeight: 800 }}>
          {s.icon} {s.label}
        </span>
      </div>

      {/* 결정 + 기조 */}
      <div style={{ background: '#0f1117', borderRadius: 10, padding: '11px 14px' }}>
        <div style={{ color: '#94a3b8', fontSize: 10.5, marginBottom: 3 }}>📋 이번 회의 결정</div>
        <div style={{ color: '#e2e8f0', fontSize: 13.5, fontWeight: 700, lineHeight: 1.6 }}>{d.decision}</div>
        {d.stanceText && <div style={{ color: '#aab6c4', fontSize: 11.5, marginTop: 4, lineHeight: 1.6 }}>{d.stanceText}</div>}
      </div>

      {/* 🆚 의장 기조 vs 시장(FF선물) 기대 갭 */}
      {d.marketGap && (() => {
        const gp = GAP[d.marketGap.agreement]
        return (
          <div style={{ background: `${gp.color}10`, border: `1px solid ${gp.color}44`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0f1117', border: `1px solid ${s.color}55`, borderRadius: 8, padding: '3px 10px', fontSize: 11.5, fontWeight: 700 }}>
                🎙️ 워시 의장 <span style={{ color: s.color }}>{s.label.split(' ')[0]}</span>
              </span>
              <span style={{ color: '#64748b', fontSize: 13, fontWeight: 800 }}>vs</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0f1117', border: '1px solid #60a5fa55', borderRadius: 8, padding: '3px 10px', fontSize: 11.5, fontWeight: 700 }}>
                📊 시장(FF선물) <span style={{ color: '#93c5fd' }}>{d.marketGap.rateDirLabel}</span>
              </span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: `${gp.color}1f`, color: gp.color, border: `1px solid ${gp.color}66`, borderRadius: 999, padding: '3px 11px', fontSize: 11.5, fontWeight: 800 }}>
                {gp.icon} {gp.label}
              </span>
            </div>
            <div style={{ color: '#dbe3ec', fontSize: 11.5, lineHeight: 1.65 }}>{d.marketGap.text}</div>
          </div>
        )
      })()}

      {/* 워시 의장 발언 해석 */}
      {d.chairRemarks.length > 0 && (
        <div>
          <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 12, marginBottom: 7 }}>🎙️ 워시 의장 발언 해석</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {d.chairRemarks.map((q, i) => (
              <div key={i} style={{ background: '#0f1117', borderRadius: 9, padding: '9px 12px', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>“{q.quote}”</div>
                <div style={{ color: '#9aa7b4', fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>→ {q.meaning}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 그래서 매크로 방향 */}
      <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10, padding: '10px 14px' }}>
        <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 12, marginBottom: 3 }}>🧭 그래서 거시경제 방향은</div>
        <div style={{ color: '#dbe3ec', fontSize: 12, lineHeight: 1.7 }}>{d.macroDirection}</div>
      </div>

      {/* 자산 시사점 */}
      {d.assetImplication.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {d.assetImplication.map((a, i) => (
            <div key={i} style={{ flex: '1 1 180px', minWidth: 160, background: '#0f1117', borderRadius: 9, padding: '8px 12px', border: `1px solid ${BORDER}` }}>
              <div style={{ color: '#cbd5e1', fontWeight: 700, fontSize: 11.5, marginBottom: 2 }}>{a.asset}</div>
              <div style={{ color: '#9aa7b4', fontSize: 11, lineHeight: 1.55 }}>{a.view}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.6 }}>
        ※ 실제 FOMC 성명서·기자회견 뉴스(Google News)를 AI가 해석 — 발언은 헤드라인 근거이며 정확한 원문은 연준 공식 발표로 확인하세요. 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
