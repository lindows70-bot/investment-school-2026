'use client'
// 🕯️ 주간 캔들 리스크 신호 — 장악형(Engulfing) 패턴. 객관적 계산(주관 개입 0)이라 엘리어트 파동(주관적 카운팅)과 달리 채택.
import { useState, useEffect } from 'react'
import type { CandlePatternResult } from '@/app/api/candle-pattern/route'

const CARD = '#12151c', BORDER = '#252a36'

export default function CandlePatternRisk() {
  const [data, setData] = useState<CandlePatternResult | null>(null)
  const [err, setErr] = useState(false)
  const [eduOpen, setEduOpen] = useState(false)

  useEffect(() => {
    fetch('/api/candle-pattern', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => setErr(true))
  }, [])

  if (err) return null
  if (!data || data.anchors.length === 0) return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 18, color: '#8a9aaa', fontSize: 13 }}>
      🕯️ 주간 캔들 패턴을 분석 중입니다…
    </div>
  )

  const flagged = data.anchors.filter(a => a.pattern !== 'none')

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🕯️ 주간 캔들 리스크 신호</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>장악형(Engulfing) 패턴 — 완전 객관 계산, 매매 지시 아님</span>
      </div>

      {flagged.length > 0 ? (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 9, padding: '8px 12px', marginBottom: 10, color: '#fca5a5', fontSize: 12, fontWeight: 700 }}>
          ⚠️ {flagged.map(a => `${a.label} ${a.pattern === 'bearish' ? '약세장악형' : '강세장악형'}`).join(' · ')} 포착 — 펀더멘탈과 별개로 단기 변동성 경계 신호입니다.
        </div>
      ) : (
        <div style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 9, padding: '8px 12px', marginBottom: 10, color: '#9aa7b5', fontSize: 12 }}>
          현재 감지된 장악형 패턴 없음 — 특이 리스크 신호 없음.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.anchors.map(a => {
          const c = a.pattern === 'bearish' ? '#f87171' : a.pattern === 'bullish' ? '#4ade80' : '#64748b'
          const label = a.pattern === 'bearish' ? '🔻 약세장악형' : a.pattern === 'bullish' ? '🔺 강세장악형' : '— 없음'
          return (
            <div key={a.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
              <span style={{ width: 130, color: '#cdd6e3', fontWeight: 700 }}>{a.market === 'KR' ? '🇰🇷' : '🇺🇸'} {a.label}</span>
              <span style={{ color: c, fontWeight: 800, width: 90 }}>{label}</span>
              <span style={{ color: '#7f93a8', fontSize: 10 }}>{a.weekOf} 완결주 · O{a.curOpen}→C{a.curClose} (전주 O{a.prevOpen}→C{a.prevClose})</span>
            </div>
          )
        })}
      </div>

      <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 2px', textAlign: 'left' }}>
        <span style={{ color: '#f7931a', fontWeight: 800, fontSize: 12 }}>🎓 장악형 패턴이란? (왜 엘리어트 파동은 안 쓰나)</span>
        <span style={{ marginLeft: 'auto', color: '#8a9aaa', fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {eduOpen && (
        <div style={{ color: '#aab6c4', fontSize: 11, lineHeight: 1.65, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>🕯️ <b style={{ color: '#f87171' }}>약세장악형(Bearish Engulfing)</b> — 직전 주(양봉)의 몸통 전체를 이번 주(음봉)가 시가·종가로 완전히 감싸는 패턴. <b style={{ color: '#4ade80' }}>강세장악형</b>은 그 반대(반등 신호).</div>
          <div>📐 <b style={{ color: '#93c5fd' }}>완전 객관적 계산</b> — 시가·종가 네 숫자의 대소 비교뿐이라 사람마다 다르게 볼 여지가 없습니다.</div>
          <div>⚠️ <b style={{ color: '#f59e0b' }}>왜 엘리어트 파동은 안 쓰나</b> — 파동(1~5, a-b-c) 카운팅은 분석가마다 다르게 셀 수 있는 <b>주관적</b> 기법입니다. 이 앱은 하드코딩·주관 개입을 배제하는 원칙이라, 객관적으로 계산 가능한 캔들 패턴만 채택했습니다.</div>
          <div style={{ color: '#8a9aaa' }}>🧭 <b>펀더멘탈이 여전히 주(主)</b> — 이 신호는 &lsquo;열기가 뜨거울 때 단기 되돌림 가능성&rsquo;을 알리는 보조 경고일 뿐, 매수·매도 지시가 아닙니다. 장악형 이후에도 추세가 이어지는 경우가 흔합니다(속임형/false signal).</div>
        </div>
      )}
    </div>
  )
}
