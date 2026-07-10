'use client'
// 🌊 알트시즌 인덱스 — BTC 도미넌스로 '지금 비트코인 피신 vs 알트코인 랠리' 국면 판독(추가 fetch 0)
const CARD = '#161b25', BORDER = '#1e293b'

export default function AltSeasonIndex({ btcDom, ethDom }: { btcDom: number | null; ethDom: number | null }) {
  if (btcDom == null) return null
  const score = Math.max(0, Math.min(100, Math.round(100 - btcDom)))   // 0=완전 비트시즌, 100=완전 알트시즌
  const zone = btcDom >= 55 ? 'btc' : btcDom <= 42 ? 'alt' : 'neutral'
  const zc = zone === 'alt' ? '#627eea' : zone === 'btc' ? '#f7931a' : '#fbbf24'
  const label = zone === 'alt' ? '🔷 알트 시즌 (위험 선호)' : zone === 'btc' ? '₿ 비트코인 우위 (안전 선호·피신)' : '〰️ 중립 (전환 구간)'
  const desc = zone === 'alt'
    ? '자금이 비트코인에서 알트코인으로 퍼지는 국면 — 위험 선호가 강합니다. 단, 알트는 변동성이 훨씬 크고 알트시즌은 보통 사이클 후반부라 과열 신호일 수도 있습니다.'
    : zone === 'btc'
    ? '자금이 비트코인으로 몰리는 국면 — 불확실성이 크면 투자자는 가장 안전한(=비트코인) 자산으로 피신합니다. 알트코인은 상대적으로 약세인 경우가 많습니다.'
    : '비트코인↔알트코인 자금 흐름이 균형 — 뚜렷한 한쪽 우위가 없는 전환 구간입니다.'
  const altOthers = Math.max(0, +(100 - btcDom - (ethDom ?? 0)).toFixed(1))

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>🌊 알트시즌 인덱스</span>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>BTC 도미넌스로 본 시장 국면</span>
        <span style={{ marginLeft: 'auto', color: zc, fontWeight: 900, fontSize: 20, fontFamily: 'monospace' }}>{score}<span style={{ fontSize: 12, color: '#8a9aaa' }}>/100</span></span>
      </div>

      {/* 게이지: 좌=비트시즌 / 우=알트시즌 */}
      <div style={{ position: 'relative', height: 12, background: 'linear-gradient(90deg,#f7931a,#fbbf24,#627eea)', borderRadius: 6, opacity: 0.85, marginBottom: 4 }}>
        <div style={{ position: 'absolute', left: `${score}%`, top: -3, transform: 'translateX(-50%)', width: 4, height: 18, background: '#e2e8f0', borderRadius: 2, boxShadow: '0 0 4px #000' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#8a9aaa', marginBottom: 10 }}>
        <span>0 ₿ 비트코인 우위</span><span>50 중립</span><span>알트 시즌 100</span>
      </div>

      {/* 도미넌스 분해 */}
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ width: `${btcDom}%`, background: '#f7931a' }} title={`BTC ${btcDom}%`} />
        <div style={{ width: `${ethDom ?? 0}%`, background: '#627eea' }} title={`ETH ${ethDom}%`} />
        <div style={{ width: `${altOthers}%`, background: '#64748b' }} title={`기타 알트 ${altOthers}%`} />
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#aab6c4', marginBottom: 10 }}>
        <span><span style={{ color: '#f7931a' }}>●</span> BTC {btcDom}%</span>
        <span><span style={{ color: '#627eea' }}>●</span> ETH {ethDom ?? '—'}%</span>
        <span><span style={{ color: '#94a3b8' }}>●</span> 기타 알트 {altOthers}%</span>
      </div>

      <div style={{ background: `${zc}12`, border: `1px solid ${zc}33`, borderRadius: 8, padding: '8px 12px' }}>
        <div style={{ color: zc, fontWeight: 800, fontSize: 12, marginBottom: 2 }}>{label}</div>
        <div style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.6 }}>{desc}</div>
      </div>
      <div style={{ color: '#8a9aaa', fontSize: 9.5, marginTop: 6, lineHeight: 1.5 }}>
        ※ BTC 도미넌스↑ = 자금이 비트코인으로 집중(안전 선호) / ↓ = 알트코인으로 분산(위험 선호). 지수=100−BTC.D · 추세가 핵심이니 며칠 흐름을 함께 보세요 · 절대 매매 신호 아님(교육용).
      </div>
    </div>
  )
}
