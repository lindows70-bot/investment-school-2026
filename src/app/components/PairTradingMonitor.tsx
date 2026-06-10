'use client'

/**
 * 📊 PairTradingMonitor — 글로벌 동종 섹터 페어-트레이딩 시그널
 *
 * 글로벌 1등(US 앵커) 대비 이 종목의 P/S 멀티플 비율이 역사적 평균에서 몇 σ 벗어났는지를
 * 기관 터미널 포맷으로. z ≤ −2 저평가 괴리 / z ≥ +2 고평가 프리미엄.
 *
 * 데이터: 서버액션 getPairSignal (Yahoo 일봉 P/S 시계열, 6h 캐시 · 통화 무관)
 */

import { useState, useEffect } from 'react'
import { getPairSignal, type PairSignalResult } from '@/app/actions/getPairSignal'

interface Props { ticker: string; name: string; market: string }

const C = {
  card: '#1a1d27', card2: '#0a0e16', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', purple: '#a78bfa',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae', term: '#7dd3fc',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

const SIG: Record<PairSignalResult['signal'], { label: string; color: string }> = {
  undervalued: { label: '⚠️ UNDERVALUED DISCONNECT', color: C.cyan },
  overvalued:  { label: '🔺 OVERVALUED PREMIUM',      color: C.red },
  neutral:     { label: '● IN RANGE',                 color: C.textSub },
}

export default function PairTradingMonitor({ ticker, name, market }: Props) {
  const [data, setData] = useState<PairSignalResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setData(null)
    getPairSignal({ ticker, name, market })
      .then(r => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, name, market])

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18 }}>📊</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>글로벌 페어-트레이딩 모니터</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.purple}22`, color: C.purple, fontWeight: 700 }}>SECRET · 상대가치 σ</span>
    </div>
  )
  const Wrap = (child: React.ReactNode, accent = C.border) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${accent}`, fontFamily: FONT }}>{Header}{child}</div>
  )

  if (loading) return Wrap(<div style={{ fontSize: 12.5, color: C.textLow, lineHeight: 1.6 }}>📊 글로벌 1등 대비 ~3년 P/S 멀티플 괴리를 통계 계산 중…</div>)
  if (!data) return null
  if (data.status === 'unsupported' || data.status === 'no_anchor' || data.status === 'is_anchor' || data.status === 'insufficient')
    return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.65 }}>📊 {data.message}</div>)
  if (data.status === 'error') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub }}>📊 {data.message || '데이터를 불러오지 못했습니다.'}</div>)

  const s = SIG[data.signal]
  const accent = s.color
  // z-게이지: -3σ ~ +3σ
  const zClamp = Math.max(-3, Math.min(3, data.z))
  const zPos = ((zClamp + 3) / 6) * 100

  const Line = ({ k, v, c }: { k: string; v: string; c?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: MONO, fontSize: 12 }}>
      <span style={{ color: C.textLow }}>{k}</span>
      <span style={{ color: c || C.text, fontWeight: 700 }}>{v}</span>
    </div>
  )

  return Wrap(
    <>
      {/* 터미널 블록 */}
      <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.term, fontWeight: 800, letterSpacing: 0.3, marginBottom: 4 }}>
          [PAIR TRADING MONITOR] · {(data.sector || 'SECTOR').toUpperCase()}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.textSub, marginBottom: 12 }}>
          ANCHOR <b style={{ color: C.text }}>{data.anchor.ticker}</b> (US) &nbsp;⟷&nbsp; PEER <b style={{ color: accent }}>{data.target.ticker}</b> ({market === 'KR' ? 'KR' : 'US'})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px dashed ${C.border}`, borderBottom: `1px dashed ${C.border}`, padding: '11px 0', marginBottom: 12 }}>
          <Line k="역사적 평균 P/S 비율" v={`${data.baseline.toFixed(3)}  (±${data.sigma.toFixed(3)}σ · ${data.years}년·${data.obs}일)`} />
          <Line k="현재 P/S 비율" v={data.current.toFixed(3)} c={accent} />
          <Line k={`${data.target.ticker} P/S · P/E`} v={`${data.target.ps ?? '—'}x · ${data.target.pe ?? '—'}x`} />
          <Line k={`${data.anchor.ticker} P/S · P/E`} v={`${data.anchor.ps ?? '—'}x · ${data.anchor.pe ?? '—'}x`} />
        </div>

        {/* z-score 게이지 */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ position: 'relative', height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${100 / 6}%`, background: `${C.cyan}55` }} />
            <div style={{ width: `${100 / 6}%`, background: `${C.cyan}22` }} />
            <div style={{ width: `${200 / 6}%`, background: '#1e293b' }} />
            <div style={{ width: `${100 / 6}%`, background: `${C.red}22` }} />
            <div style={{ width: `${100 / 6}%`, background: `${C.red}55` }} />
            {/* 현재 z 마커 */}
            <div style={{ position: 'absolute', top: -3, height: 16, width: 3, left: `calc(${zPos}% - 1.5px)`, background: accent, borderRadius: 2, boxShadow: `0 0 6px ${accent}` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 9, color: C.textLow, marginTop: 3 }}>
            <span>−3σ 저평가</span><span>0</span><span>고평가 +3σ</span>
          </div>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 900, color: accent, marginTop: 12 }}>
          ▶ SIGNAL: [{s.label}]  &nbsp;<span style={{ fontSize: 12 }}>z = {data.z >= 0 ? '+' : ''}{data.z.toFixed(2)}σ</span>
        </div>
      </div>

      {/* 해설 */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.75 }}>{data.comment}</div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        📊 멀티플=P/S(매출 기준·적자에 강함) · 비율=대상÷앵커(통화 무관) · z=현재 비율이 ~3년 평균에서 벗어난 표준편차 · 글로벌 1등(앵커) 대비 상대가치. ⚠️ 평균회귀는 보장되지 않으며(밸류 트랩 가능) 통계적 참고일 뿐 투자 추천이 아닙니다.
      </div>
    </>,
    `${accent}55`
  )
}
