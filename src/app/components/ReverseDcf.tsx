'use client'
// 🔮 역-DCF 기대치 투자 — 현재 주가에 시장이 심어둔 '내재 성장 기대'를 역산해 실제와 비교(Mauboussin)
import { useState, useEffect } from 'react'
import type { ReverseDcfResult, DcfVerdict } from '@/app/api/reverse-dcf/route'

const CARD = '#161b25', BORDER = '#1e293b'
const V: Record<DcfVerdict, { label: string; color: string; icon: string }> = {
  demanding:    { label: '기대 과도', color: '#ef4444', icon: '🔥' },
  fair:         { label: '합리적',    color: '#fbbf24', icon: '⚖️' },
  conservative: { label: '기대 보수 (저평가 여지)', color: '#22c55e', icon: '🌱' },
  unknown:      { label: '판단 보류', color: '#8a9aaa', icon: '❔' },
}

export default function ReverseDcf({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [d, setD] = useState<ReverseDcfResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/reverse-dcf?ticker=${encodeURIComponent(ticker)}&market=${market}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🔮 역-DCF 내재 기대 계산 중…</div>
  if (!d) return null
  const v = V[d.verdict]

  // 게이지: 내재 기대 vs 실제 성장 (0~40% 스케일)
  const SCALE = 40
  const pos = (g: number | null) => g == null ? null : Math.min(Math.max((g / SCALE) * 100, 0), 100)
  const impPos = pos(d.impliedGrowth), actPos = pos(d.actualGrowth)

  return (
    <div style={{ background: `${v.color}0d`, border: `1px solid ${v.color}55`, borderRadius: 14, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🔮</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15 }}>역-DCF 기대치 투자</span>
        <span style={{ color: '#7f93a8', fontSize: 11 }}>주가가 말하는 미래 — {name}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: `${v.color}1f`, color: v.color, border: `1px solid ${v.color}66`, borderRadius: 999, padding: '4px 13px', fontSize: 12.5, fontWeight: 800 }}>{v.icon} {v.label}</span>
      </div>

      <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>{d.headline}</div>

      {d.impliedGrowth != null && (
        <div style={{ background: '#0f1117', borderRadius: 10, padding: '12px 14px' }}>
          {/* 내재 기대 */}
          <Row label="📈 시장 내재 기대" val={d.impliedGrowth} pos={impPos} color={v.color} scale={SCALE} />
          {/* 실제/예상 성장 */}
          {d.actualGrowth != null && <div style={{ marginTop: 9 }}><Row label={d.growthSource === 'peg' ? '🎯 예상 성장(PEG 내재)' : '🏭 실제 성장(최근)'} val={d.actualGrowth} pos={actPos} color="#60a5fa" scale={SCALE} /></div>}
        </div>
      )}

      <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.7 }}>{d.detail}</div>

      <div style={{ color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.6 }}>
        ※ 가정: 요구수익률 {Math.round(d.assumptions.r * 100)}% · 고성장 {d.assumptions.years}년 · 종착 PER {d.assumptions.termPe}배(시장 평균). PER {d.pe ?? '—'}에서 역산. 가정이 바뀌면 내재 기대도 달라지는 교육용 사고틀이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}

function Row({ label, val, pos, color, scale }: { label: string; val: number; pos: number | null; color: string; scale: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#c4cae0', fontSize: 11.5 }}>{label}</span>
        <span style={{ color, fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>연 {val > 0 ? '+' : ''}{val}%</span>
      </div>
      <div style={{ height: 10, background: '#1e293b', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pos ?? 0}%`, height: '100%', background: color, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
        <span style={{ color: '#475569', fontSize: 8.5 }}>0%</span>
        <span style={{ color: '#475569', fontSize: 8.5 }}>{scale}%+ (10년 지속 극소수)</span>
      </div>
    </div>
  )
}
