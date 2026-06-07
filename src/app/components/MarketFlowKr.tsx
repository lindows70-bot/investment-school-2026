'use client'
// 🌐 국내 시장 수급 랭킹 — 외국인/기관 순매수 상위 + 쌍끌이 연속매집 (주요 코스피 유니버스)
import { useState, useEffect } from 'react'
import type { MarketFlowKrResult, MarketFlowEntry } from '@/lib/marketFlowKr'

const CARD = '#161b25', BORDER = '#1e293b'
type View = 'foreign' | 'organ' | 'dual'

const won = (v: number) => {
  const eok = Math.round(v / 1e8)
  return eok >= 10000 ? `${(eok / 10000).toFixed(2)}조` : `${eok.toLocaleString()}억`
}
const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

function Row({ e, rank, amtKey }: { e: MarketFlowEntry; rank: number; amtKey: 'foreignAmt' | 'organAmt' }) {
  const up = (e.changePct ?? 0) > 0
  const chgCol = e.changePct == null ? '#8a9aaa' : up ? '#22c55e' : '#ef4444'
  const cheap = e.peg != null && e.peg > 0 && e.peg < 1.0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#0f1117', borderRadius: 8, fontSize: 13 }}>
      <span style={{ width: 26, textAlign: 'center', fontWeight: 800, color: rank < 3 ? '#f1f5f9' : '#8a9aaa', fontSize: rank < 3 ? 15 : 12 }}>{medal(rank)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{e.name}</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>{e.sector}</span>
          {cheap && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #3b82f655', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>💎 저평가 PEG {e.peg!.toFixed(2)}</span>}
          {e.dualStreak >= 2 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>🔥 {e.dualStreak}일 쌍끌이</span>}
        </div>
      </div>
      <span style={{ width: 78, textAlign: 'right', color: '#e2e8f0', fontWeight: 800, fontFamily: 'monospace' }}>{won(e[amtKey])}</span>
      <span style={{ width: 64, textAlign: 'right', color: chgCol, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
        {e.changePct == null ? '—' : `${up ? '▲' : '▼'}${Math.abs(e.changePct)}%`}
      </span>
    </div>
  )
}

export default function MarketFlowKr() {
  const [data, setData] = useState<MarketFlowKrResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('foreign')

  useEffect(() => {
    let alive = true
    fetch('/api/market-flow-kr', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setData(j) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🌐 시장 수급 랭킹을 집계 중입니다…</div>
  if (!data || !data.poolSize) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>시장 수급 데이터를 불러오지 못했습니다. 장 마감 후 다시 확인해 주세요.</div>

  const list = view === 'foreign' ? data.foreignTop : view === 'organ' ? data.organTop : data.dualBuy
  const amtKey: 'foreignAmt' | 'organAmt' = view === 'organ' ? 'organAmt' : 'foreignAmt'
  const TABS: { key: View; label: string; color: string }[] = [
    { key: 'foreign', label: '🟢 외국인 순매수', color: '#22c55e' },
    { key: 'organ', label: '🔵 기관 순매수', color: '#3b82f6' },
    { key: 'dual', label: '🔥 쌍끌이 연속매집', color: '#f59e0b' },
  ]

  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>국내 시장 수급 랭킹</span>
        <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 11 }}>주요 코스피 {data.poolSize}종목 · 외인·기관이 담는 종목</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 12 }}>지금 메이저 돈이 어디로 쏠리나 — 새로운 주도주 발굴용. 저PEG면 💎 표시(리밸런싱 위성 후보 힌트)</div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: view === t.key ? `${t.color}22` : '#0f1117', color: view === t.key ? t.color : '#8a9aaa',
              border: `1px solid ${view === t.key ? `${t.color}66` : BORDER}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 6px', fontSize: 10.5, color: '#7f93a8' }}>
        <span style={{ width: 26, textAlign: 'center' }}>순위</span>
        <span style={{ flex: 1 }}>종목 (섹터)</span>
        <span style={{ width: 78, textAlign: 'right' }}>순매수 대금</span>
        <span style={{ width: 64, textAlign: 'right' }}>등락률</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {list.length ? list.map((e, i) => <Row key={e.ticker} e={e} rank={i} amtKey={amtKey} />)
          : <div style={{ color: '#8a9aaa', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
              {view === 'dual' ? '현재 외인·기관 동시 연속매집(2일+) 종목이 없습니다.' : '해당 순매수 종목이 없습니다.'}
            </div>}
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        ※ 순매수 대금은 일별 순매수 수량×종가 추정치 · 주요 코스피 유니버스 기준(전 종목 아님, ETF 제외) · 매일 장 마감 후 갱신. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
