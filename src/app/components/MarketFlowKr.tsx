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

function Row({ e, rank, amt, prices, open, chg }: { e: MarketFlowEntry; rank: number; amt: number; prices: number[]; open?: boolean; chg: number | null }) {
  const up = (chg ?? 0) > 0
  const chgCol = chg == null ? '#8a9aaa' : up ? '#22c55e' : '#ef4444'
  const cheap = e.peg != null && e.peg > 0 && e.peg < 1.0 && !e.pegSuspect   // ⚠️ 기저효과 의심은 💎 박탈
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#0f1117', borderRadius: 8, fontSize: 13 }}>
      <span style={{ width: 26, textAlign: 'center', fontWeight: 800, color: rank < 3 ? '#f1f5f9' : '#8a9aaa', fontSize: rank < 3 ? 15 : 12 }}>{medal(rank)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{e.name}</span>
          <span style={{ background: e.market === 'KOSDAQ' ? 'rgba(167,139,250,0.14)' : 'rgba(96,165,250,0.12)', color: e.market === 'KOSDAQ' ? '#a78bfa' : '#60a5fa', borderRadius: 5, padding: '0 5px', fontSize: 9.5, fontWeight: 700 }}>{e.market === 'KOSDAQ' ? '코스닥' : '코스피'}</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>{e.sector}</span>
          {cheap && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #3b82f655', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>💎 저평가 PEG {e.peg!.toFixed(2)}</span>}
          {e.peg != null && e.peg > 0 && e.pegSuspect && <span title="이익 붕괴 후 회복(성장률 100%↑)으로 PEG가 0에 수렴하는 착시 — 경기순환주 저PEG 함정" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid #f59e0b44', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>⚠️ PEG {e.peg!.toFixed(2)} 기저효과</span>}
          {e.dualStreak >= 2 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>🔥 {e.dualStreak}일 쌍끌이</span>}
        </div>
      </div>
      <MiniChart prices={prices} />
      <span style={{ width: 84, textAlign: 'right', color: amt >= 0 ? '#e2e8f0' : '#f87171', fontWeight: 800, fontFamily: 'monospace' }}>{won(amt)}</span>
      <span style={{ width: 64, textAlign: 'right', color: chgCol, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
        {chg == null ? '—' : `${up ? '▲' : '▼'}${Math.abs(chg)}%`}
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
  const [mkt, setMkt] = useState<'ALL' | 'KOSPI' | 'KOSDAQ'>('ALL')        // 코스피/코스닥 필터
  const [heat, setHeat] = useState(false)                                  // 🌡️ 추세속도 맵 모드

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

  // 클라이언트 랭킹 — 선택한 주체(외인/기관) × 기간(1/5/20) × 시장(코스피/코스닥)
  const amtOf = (e: MarketFlowEntry) => (view === 'organ' ? e.organ[period] : e.foreign[period])
  const pool = data.entries.filter(e => mkt === 'ALL' || e.market === mkt)
  const list: MarketFlowEntry[] = view === 'dual'
    ? pool.filter(e => e.dualStreak >= 2).sort((a, b) => b.dualStreak - a.dualStreak || (b.foreign.d1 + b.organ.d1) - (a.foreign.d1 + a.organ.d1)).slice(0, 12)
    : [...pool].sort((a, b) => amtOf(b) - amtOf(a)).filter(e => amtOf(e) > 0).slice(0, 12)

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
  // 등락률 — 선택 기간에 맞춤(1일=당일, 5일/20일=기간 주가변화). closes(오래된→최신) 재사용(추가 fetch 0)
  const periodChg = (e: MarketFlowEntry): number | null => {
    if (view === 'dual' || period === 'd1') return e.changePct
    const c = e.closes
    if (!c || c.length < 2) return e.changePct
    const back = period === 'd5' ? 5 : 20
    const past = c[Math.max(0, c.length - 1 - back)], now = c[c.length - 1]
    return past > 0 ? Math.round(((now - past) / past) * 1000) / 10 : e.changePct
  }
  const chgLabel = view === 'dual' || period === 'd1' ? '등락률' : `${PERIODS.find(p => p.key === period)!.label} 등락`

  // 🌡️ 추세속도(MA10 이격도) 히트맵 헬퍼
  const heatMaxAbs = Math.max(3, ...list.flatMap(e => (e.trendSpeed ?? []).map(v => Math.abs(v))))
  const heatColor = (v: number) => {
    const a = Math.min(0.92, Math.abs(v) / heatMaxAbs * 0.8 + 0.12)
    return v >= 0 ? `rgba(239,68,68,${a})` : `rgba(59,130,246,${a})`   // 🔴상승 / 🔵하락
  }
  const mmdd = (d: string) => d && d.length >= 8 ? `${d.slice(4, 6)}/${d.slice(6, 8)}` : ''
  // 추세 상태: 최신(ts[0]) 부호·강도 vs 5일전(ts[last])
  const speedStatus = (ts: number[]): { label: string; color: string } => {
    if (!ts || ts.length < 2) return { label: '—', color: '#8a9aaa' }
    const latest = ts[0], old = ts[ts.length - 1], accel = Math.abs(latest) >= Math.abs(old)
    if (latest >= 0) {
      if (old < 0) return { label: '🔄 상승전환', color: '#22c55e' }
      return accel ? { label: '🔴 상승가속', color: '#ef4444' } : { label: '🟠 상승둔화', color: '#f59e0b' }
    }
    if (old > 0) return { label: '🔄 하락전환', color: '#3b82f6' }
    return accel ? { label: '🔵 하락가속', color: '#3b82f6' } : { label: '🟢 하락둔화(반등?)', color: '#22c55e' }
  }
  const tsLen = Math.max(0, ...list.map(e => (e.trendSpeed ?? []).length))
  const dateCols = (data.recentDates?.length ? data.recentDates : Array.from({ length: tsLen }, () => '')).slice(0, 5)   // 최신→과거

  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>국내 시장 수급 랭킹</span>
        <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 11 }}>주요 코스피·코스닥 {data.poolSize}종목 · 외인·기관이 담는 종목</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 12 }}>지금 메이저 돈이 어디로 쏠리나 — 새로운 주도주 발굴용. 저PEG면 💎 표시(리밸런싱 위성 후보 힌트)</div>

      {/* 보기 모드: 리스트 ↔ 추세맵 */}
      <div style={{ display: 'inline-flex', gap: 3, background: '#0f1117', padding: 3, borderRadius: 9, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
        {([['list', '📋 리스트'], ['heat', '🌡️ 추세속도 맵']] as const).map(([k, lab]) => {
          const on = (k === 'heat') === heat
          return (
            <button key={k} onClick={() => setHeat(k === 'heat')}
              style={{ padding: '4px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: on ? '#1e293b' : 'transparent', color: on ? '#e2e8f0' : '#8599ae' }}>
              {lab}
            </button>
          )
        })}
      </div>

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

      {/* 시장 필터 (코스피/코스닥) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ color: '#7f93a8', fontSize: 10.5, marginRight: 2 }}>시장</span>
        {([['ALL', '전체'], ['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setMkt(k)}
            style={{ padding: '3px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: mkt === k ? 'rgba(167,139,250,0.18)' : '#0f1117', color: mkt === k ? '#a78bfa' : '#7f93a8',
              border: `1px solid ${mkt === k ? '#a78bfa66' : BORDER}` }}>
            {lab}
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

      {/* ── 리스트 모드 ── */}
      {!heat && (<>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 6px', fontSize: 10.5, color: '#7f93a8' }}>
        <span style={{ width: 26, textAlign: 'center' }}>순위</span>
        <span style={{ flex: 1 }}>종목 (섹터)</span>
        <span style={{ width: 84, textAlign: 'center' }}>주가 ({chartLabel})</span>
        <span style={{ width: 84, textAlign: 'right' }}>{view === 'dual' ? '순매수 대금' : `순매수 (${PERIODS.find(p => p.key === period)!.label})`}</span>
        <span style={{ width: 64, textAlign: 'right' }}>{chgLabel}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {list.length ? list.map((e, i) => {
          const isOpen = openTicker === e.ticker
          return (
            <div key={e.ticker}>
              <Row e={e} rank={i} amt={view === 'dual' ? (e.foreign.d1 + e.organ.d1) : amtOf(e)} prices={pricesFor(e)} open={isOpen} chg={periodChg(e)} />
              {/* 명시적 타임라인 버튼 — 행 아래에 항상 노출 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '3px 4px 0' }}>
                <button
                  onClick={() => setOpenTicker(t => t === e.ticker ? null : e.ticker)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                    background: isOpen ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)', color: isOpen ? '#a5b4fc' : '#818cf8',
                    border: `1px solid ${isOpen ? '#818cf866' : '#818cf833'}` }}>
                  <span>📅</span>
                  <span>{isOpen ? '접기' : '20일 매매동향'}</span>
                  <span style={{ fontSize: 8, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </button>
              </div>
              {isOpen && <div style={{ marginTop: 4 }}><InvestorTimeline ticker={e.ticker} name={e.name} /></div>}
            </div>
          )
        }) : <div style={{ color: '#8a9aaa', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
              {view === 'dual' ? '현재 외인·기관 동시 연속매집(2일+) 종목이 없습니다.' : '해당 순매수 종목이 없습니다.'}
            </div>}
      </div>
      </>)}

      {/* ── 🌡️ 추세속도 맵 모드 ── */}
      {heat && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ color: '#7f93a8', fontSize: 10.5, marginBottom: 8, lineHeight: 1.6 }}>
            {TABS.find(t => t.key === view)!.label} 종목의 <b style={{ color: '#cbd5e1' }}>추세속도(MA10 이격도 %, ±15 상한)</b> 최근 5거래일 — 🔴빨강=상승추세·🔵파랑=하락추세, 짙을수록 강함. 5일 흐름으로 <b style={{ color: '#cbd5e1' }}>가속/둔화/전환</b>을 봅니다.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 540 }}>
            <thead>
              <tr style={{ color: '#7f93a8', fontSize: 10 }}>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px', width: 20 }}>#</th>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px' }}>종목</th>
                {dateCols.map((d, j) => <th key={j} style={{ textAlign: 'center', fontWeight: 700, padding: '0 2px 7px', width: 52 }}>{mmdd(d) || (j === 0 ? '당일' : `-${j}일`)}</th>)}
                <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 6px 7px', width: 96 }}>추세</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              {list.length ? list.map((e, i) => {
                const ts = e.trendSpeed ?? []
                const st = speedStatus(ts)
                return (
                  <tr key={e.ticker} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ color: '#8a9aaa', padding: '6px 6px', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '6px 6px', fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{e.name.length > 9 ? e.name.slice(0, 8) + '…' : e.name}</span>
                      <span style={{ background: e.market === 'KOSDAQ' ? 'rgba(167,139,250,0.14)' : 'rgba(96,165,250,0.12)', color: e.market === 'KOSDAQ' ? '#a78bfa' : '#60a5fa', borderRadius: 4, padding: '0 4px', fontSize: 8.5, fontWeight: 700, marginLeft: 4 }}>{e.market === 'KOSDAQ' ? '코닥' : '코스피'}</span>
                    </td>
                    {dateCols.map((_, j) => {
                      const v = ts[j]
                      return (
                        <td key={j} style={{ textAlign: 'center', padding: 2 }}>
                          {v == null ? <span style={{ color: '#475569' }}>—</span> : (
                            <div style={{ background: heatColor(v), borderRadius: 4, padding: '4px 0', color: '#f8fafc', fontWeight: 700, fontSize: 10.5 }}>
                              {v > 0 ? '+' : ''}{v.toFixed(1)}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'right', padding: '6px 6px', color: st.color, fontWeight: 800, fontSize: 10.5, fontFamily: 'inherit' }}>{st.label}</td>
                  </tr>
                )
              }) : <tr><td colSpan={dateCols.length + 3} style={{ color: '#8a9aaa', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>해당 종목이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        {heat
          ? '※ 추세속도 = (종가−10일 이동평균)/이동평균×100(이격도, ±15% 상한) · 부호=추세방향·크기=강도·5일변화=가속/둔화 · 머니디자인式 추세속도의 교육용 근사(독자지표와 공식 다름) · 투자 추천 아님.'
          : '※ 순매수 대금 = 일별 순매수 수량×종가 누적 추정치(1/5/20일) · 주요 코스피 유니버스 기준(전 종목 아님, ETF 제외) · 매일 장 마감 후 갱신. 교육용 시뮬레이션이며 투자 추천이 아닙니다.'}
      </div>
    </div>
  )
}
