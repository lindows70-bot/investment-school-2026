'use client'
// 💵 FCF 수익률·이익-현금 괴리 카드 — 리서치(워렌버핏·최일) 단일종목 화면. /api/stock-fcf(스크리너와 동일 SSOT 로직) 소비.
//   버블·하락장에서 결정적인 '주가 대비 현금창출력'과 '이익의 질(현금 전환)'을 배지로.
import { useState, useEffect } from 'react'
import type { StockFcfResult } from '@/app/api/stock-fcf/route'

const C = { panel: '#12141c', grid: '#1e2230', low: '#8a9aaa' }

export default function FcfQualityCard({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [d, setD] = useState<StockFcfResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setD(null)
    fetch(`/api/stock-fcf?ticker=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name)}&market=${market}`)
      .then(r => r.json()).then(j => { if (alive) { setD(j?.grade ? j : null); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, name, market])

  if (loading) return <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12, fontSize: 11, color: C.low }}>💵 FCF 분석 중…</div>
  if (!d || d.grade === 'na' && !d.isFinancial) return null

  // 등급별 배지 문구·색
  const badge = (() => {
    switch (d.grade) {
      case 'gap': return { t: '⚠️ 이익-현금 괴리', c: '#f87171', bg: '#7f1d1d33', sub: '영업흑자인데 영업현금흐름(OCF)까지 적자 — 이익이 현금으로 안 들어옴(분식·버블 조기경보)' }
      case 'excellent': return { t: `💵 FCF 수익률 ${d.fcfYield}% · 우수`, c: '#4ade80', bg: '#14532d33', sub: '주가 대비 현금창출력 우수 — 버블·하락장 방어력이 강한 자리' }
      case 'good': return { t: `💵 FCF 수익률 ${d.fcfYield}% · 양호`, c: '#a3e635', bg: '#3f621233', sub: '주가 대비 현금창출력 양호' }
      case 'fair': return { t: `💵 FCF 수익률 ${d.fcfYield}%`, c: '#eab308', bg: '#42200633', sub: '주가 대비 현금창출력 보통' }
      case 'expensive': return { t: `💵 FCF 수익률 ${d.fcfYield}% · 현금 대비 고평가`, c: '#fb923c', bg: '#7c2d1233', sub: '현금창출 대비 주가가 비쌈 — 버블·하락장에서 취약할 수 있음(멀티플 의존)' }
      case 'capex': return { t: '💵 FCF 적자(영업현금은 흑자)', c: '#22d3ee', bg: '#0e494933', sub: '영업현금(OCF)은 흑자인데 CAPEX 성장 투자로 FCF 적자 — 좀비 아님(투자 회수 여부가 관건)' }
      case 'loss': return { t: '💵 FCF·영업현금 적자', c: '#f87171', bg: '#7f1d1d33', sub: '현금 창출력 약화 — 현금 런웨이·흑자전환 먼저 확인' }
      default: return null
    }
  })()

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 800, color: '#c4b5fd', fontSize: 12, marginBottom: 8 }}>
        💵 FCF(잉여현금흐름) 품질 <span style={{ color: C.low, fontWeight: 400, fontSize: 10 }}>— 버블·하락장에서 결정적인 &lsquo;주가 대비 현금창출력&rsquo;과 &lsquo;이익의 질&rsquo;</span>
      </div>

      {d.isFinancial ? (
        <div style={{ fontSize: 11, color: C.low, lineHeight: 1.6 }}>
          🏦 <b style={{ color: '#94a3b8' }}>금융주(은행·보험·증권)</b> — 영업현금흐름·FCF가 예금·대출·트레이딩·보험 float으로 출렁여 &lsquo;이익의 질&rsquo; 신호가 무의미합니다. FCF 지표는 중립 처리하고 <b>P/B·ROE·내재가치(EV)</b>로 평가하세요.
        </div>
      ) : badge ? (<>
        <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: badge.c, background: badge.bg, border: `1px solid ${badge.c}55`, borderRadius: 7, padding: '3px 10px', marginBottom: 6 }}>{badge.t}</span>
        <div style={{ fontSize: 10.5, color: C.low, lineHeight: 1.55 }}>{badge.sub}</div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 3, fontSize: 10.5 }}>
          <span style={{ color: C.low }}>FCF 수익률</span>
          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{d.fcfYield != null ? `${d.fcfYield}% (FCF ÷ 시가총액)` : '—'}</span>
          <span style={{ color: C.low }}>영업이익률</span>
          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{d.opMargin != null ? `${d.opMargin}%` : '—'}</span>
          <span style={{ color: C.low }}>영업현금흐름</span>
          <span style={{ color: d.ocf != null && d.ocf < 0 ? '#f87171' : '#4ade80', fontFamily: 'monospace' }}>{d.ocf != null ? (d.ocf >= 0 ? '흑자' : '적자') : '—'}{d.fcf != null ? ` · FCF ${d.fcf >= 0 ? '흑자' : '적자'}` : ''}</span>
        </div>
      </>) : null}

      <div style={{ marginTop: 8, fontSize: 9.5, color: '#7f93a8', borderTop: `1px solid ${C.grid}`, paddingTop: 6, lineHeight: 1.5 }}>
        💡 FCF 수익률이 높을수록 &lsquo;주가 대비 현금을 싸게&rsquo; 사는 것 — 버블 땐 고멀티플·저FCF수익률이 취약, 하락장 땐 현금창출력이 방어막. &lsquo;영업흑자인데 영업현금 적자(괴리)&rsquo;는 이익이 현금으로 안 들어오는 분식·버블 경보(추천 점수에도 반영). CAPEX로 FCF만 적자인 성장주와는 구분합니다.
      </div>
    </div>
  )
}
