'use client'
// 🌐 국내 시장 수급 랭킹 — 외국인/기관 순매수 상위(1/5/20일) + 쌍끌이 연속매집 (주요 코스피 유니버스)
import { useState, useEffect } from 'react'
import type { MarketFlowKrResult, MarketFlowEntry, Period } from '@/lib/marketFlowKr'
import InvestorTimeline from '@/app/components/InvestorTimeline'

const CARD = '#161b25', BORDER = '#1e293b'
type View = 'foreign' | 'organ' | 'dual'

const won = (v: number) => {
  const eok = Math.round(v / 1e8)
  if (Math.abs(eok) >= 10000) return `${(eok / 10000).toFixed(2)}조`
  return `${eok.toLocaleString()}억`
}
const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

// 미니 주가 스파크라인 — 마지막>처음이면 초록, 아니면 빨강
function MiniChart({ prices }: { prices: number[] }) {
  if (!prices || prices.length < 2) return <div style={{ width: 84, height: 26 }} />
  const W = 84, H = 26, P = 2
  const min = Math.min(...prices), max = Math.max(...prices), rng = max - min || 1
  const xs = prices.map((_, i) => P + (i / (prices.length - 1)) * (W - 2 * P))
  const ys = prices.map(p => P + (1 - (p - min) / rng) * (H - 2 * P))
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const up = prices[prices.length - 1] >= prices[0]
  const col = up ? '#22c55e' : '#ef4444'
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={col} strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={1.8} fill={col} />
    </svg>
  )
}

function Row({ e, rank, amt, prices, open }: { e: MarketFlowEntry; rank: number; amt: number; prices: number[]; open?: boolean }) {
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
      <MiniChart prices={prices} />
      <span style={{ width: 84, textAlign: 'right', color: amt >= 0 ? '#e2e8f0' : '#f87171', fontWeight: 800, fontFamily: 'monospace' }}>{won(amt)}</span>
      <span style={{ width: 64, textAlign: 'right', color: chgCol, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
        {e.changePct == null ? '—' : `${up ? '▲' : '▼'}${Math.abs(e.changePct)}%`}
      </span>
      <span style={{ width: 12, textAlign: 'center', color: '#64748b', fontSize: 9, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
    </div>
  )
}

export default function MarketFlowKr() {
  const [data, setData] = useState<MarketFlowKrResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('foreign')
  const [period, setPeriod] = useState<Period>('d1')
  const [intraday, setIntraday] = useState<Record<string, number[]>>({})   // 1Day 인트라데이(표시 행만)
  const [openTicker, setOpenTicker] = useState<string | null>(null)        // 행 클릭 → 일별 매매동향 타임라인 펼침

  useEffect(() => {
    let alive = true
    fetch('/api/market-flow-kr', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setData(j) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // 1일(인트라데이) 뷰일 때만 표시 행의 분봉 차트를 lazy 로드
  useEffect(() => {
    if (!data || view === 'dual' || period !== 'd1') return
    const codes = [...data.entries].sort((a, b) => (view === 'organ' ? b.organ.d1 - a.organ.d1 : b.foreign.d1 - a.foreign.d1)).slice(0, 12).map(e => e.ticker)
    const need = codes.filter(c => !intraday[c])
    if (!need.length) return
    let alive = true
    fetch(`/api/kr-chart?codes=${need.join(',')}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive && j && typeof j === 'object') setIntraday(prev => ({ ...prev, ...j })) })
      .catch(() => {})
    return () => { alive = false }
  }, [data, view, period, intraday])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🌐 시장 수급 랭킹을 집계 중입니다…</div>
  if (!data || !data.poolSize) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>시장 수급 데이터를 불러오지 못했습니다. 장 마감 후 다시 확인해 주세요.</div>

  // 클라이언트 랭킹 — 선택한 주체(외인/기관) × 기간(1/5/20)
  const amtOf = (e: MarketFlowEntry) => (view === 'organ' ? e.organ[period] : e.foreign[period])
  const list: MarketFlowEntry[] = view === 'dual'
    ? data.entries.filter(e => e.dualStreak >= 2).sort((a, b) => b.dualStreak - a.dualStreak || (b.foreign.d1 + b.organ.d1) - (a.foreign.d1 + a.organ.d1)).slice(0, 12)
    : [...data.entries].sort((a, b) => amtOf(b) - amtOf(a)).filter(e => amtOf(e) > 0).slice(0, 12)

  const TABS: { key: View; label: string; color: string }[] = [
    { key: 'foreign', label: '🟢 외국인 순매수', color: '#22c55e' },
    { key: 'organ', label: '🔵 기관 순매수', color: '#3b82f6' },
    { key: 'dual', label: '🔥 쌍끌이 연속매집', color: '#f59e0b' },
  ]
  const PERIODS: { key: Period; label: string }[] = [
    { key: 'd1', label: '1일' }, { key: 'd5', label: '5일 누적' }, { key: 'd20', label: '20일 누적' },
  ]
  // 기간 → 차트 데이터: 1일=인트라데이(1Day) / 5일·쌍끌이=최근5일(1주) / 20일=최근20일(1개월)
  const pricesFor = (e: MarketFlowEntry): number[] => {
    if (view !== 'dual' && period === 'd1') return intraday[e.ticker] ?? []
    const w = (view === 'dual' || period === 'd5') ? 5 : 20
    return e.closes.slice(-w)
  }
  const chartLabel = view === 'dual' ? '1주' : period === 'd1' ? '1Day' : period === 'd5' ? '1주' : '1개월'

  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>국내 시장 수급 랭킹</span>
        <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 11 }}>주요 코스피 {data.poolSize}종목 · 외인·기관이 담는 종목</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 12 }}>지금 메이저 돈이 어디로 쏠리나 — 새로운 주도주 발굴용. 저PEG면 💎 표시(리밸런싱 위성 후보 힌트)</div>

      {/* 주체 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: view === t.key ? `${t.color}22` : '#0f1117', color: view === t.key ? t.color : '#8a9aaa',
              border: `1px solid ${view === t.key ? `${t.color}66` : BORDER}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 기간 토글 (쌍끌이 뷰에선 숨김) */}
      {view !== 'dual' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{ padding: '3px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: period === p.key ? 'rgba(148,163,184,0.18)' : '#0f1117', color: period === p.key ? '#e2e8f0' : '#7f93a8',
                border: `1px solid ${period === p.key ? '#475569' : BORDER}` }}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 6px', fontSize: 10.5, color: '#7f93a8' }}>
        <span style={{ width: 26, textAlign: 'center' }}>순위</span>
        <span style={{ flex: 1 }}>종목 (섹터)</span>
        <span style={{ width: 84, textAlign: 'center' }}>주가 ({chartLabel})</span>
        <span style={{ width: 84, textAlign: 'right' }}>{view === 'dual' ? '순매수 대금' : `순매수 (${PERIODS.find(p => p.key === period)!.label})`}</span>
        <span style={{ width: 64, textAlign: 'right' }}>등락률</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {list.length ? list.map((e, i) => (
          <div key={e.ticker}>
            <div onClick={() => setOpenTicker(t => t === e.ticker ? null : e.ticker)} style={{ cursor: 'pointer' }}>
              <Row e={e} rank={i} amt={view === 'dual' ? (e.foreign.d1 + e.organ.d1) : amtOf(e)} prices={pricesFor(e)} open={openTicker === e.ticker} />
            </div>
            {openTicker === e.ticker && <div style={{ marginTop: 4 }}><InvestorTimeline ticker={e.ticker} name={e.name} /></div>}
          </div>
        )) : <div style={{ color: '#8a9aaa', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
              {view === 'dual' ? '현재 외인·기관 동시 연속매집(2일+) 종목이 없습니다.' : '해당 순매수 종목이 없습니다.'}
            </div>}
      </div>
      <div style={{ color: '#7f93a8', fontSize: 10.5, marginTop: 6 }}>💡 종목을 클릭하면 외국인·기관·개인 <b>일별 매매동향 타임라인</b>이 펼쳐집니다.</div>

      <div style={{ color: '#6e7f8f', fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        ※ 순매수 대금 = 일별 순매수 수량×종가 누적 추정치(1/5/20일) · 주요 코스피 유니버스 기준(전 종목 아님, ETF 제외) · 매일 장 마감 후 갱신. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
