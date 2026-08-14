'use client'
// 🌐 국내 시장 수급 랭킹 — 외국인/기관 순매수 상위(1/5/20일) + 쌍끌이 연속매집 (주요 코스피 유니버스)
//    + 상단: 코스피 × 외국인 누적 순매수 오버레이(2026-08-14 사용자 아이디어 — 지수 투자 학생용 관찰 도구)
import { useState, useEffect } from 'react'
import type { MarketFlowKrResult, MarketFlowEntry, Period } from '@/lib/marketFlowKr'
import type { IndexFlowResult } from '@/lib/indexFlow'
import InvestorTimeline from '@/app/components/InvestorTimeline'
import { TK, FS, RAD } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
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
  const col = up ? TK.green500 : TK.red500
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={col} strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={1.8} fill={col} />
    </svg>
  )
}

// 🌐 코스피 지수 × 외국인 누적 순매수 오버레이 — "함께 움직인다(동행)"를 눈으로 보여준다.
//    ⚠️ 예측 도구가 아니다(실측: 동행 상관은 강하지만 과거 수급→미래 지수 상관 0) — 캐비엇을 반드시 같이 그린다.
function KospiFlowOverlay() {
  const [d, setD] = useState<IndexFlowResult | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/index-flow', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive && Array.isArray(j?.days) && j.days.length >= 60) setD(j) })
      .catch(() => { /* 실패 시 섹션 자체를 접는다 — 지어내지 않는다 */ })
    return () => { alive = false }
  }, [])
  if (!d) return null
  const W = 680, H = 210, PL = 46, PR = 56, PT = 8, PB = 20
  const days = d.days
  const kMin = Math.min(...days.map(x => x.kospi)), kMax = Math.max(...days.map(x => x.kospi))
  // 오른쪽 눈금은 세 주체 누적을 **한 축**으로 — 축이 다르면 비교 표가 아니다(잣대 하나 원칙)
  const flows = days.flatMap(x => [x.cumForeignEok, x.cumOrganEok, x.cumIndivEok])
  const fMin = Math.min(...flows), fMax = Math.max(...flows)
  const x = (i: number) => PL + (i / (days.length - 1)) * (W - PL - PR)
  const yK = (v: number) => H - PB - ((v - kMin) / (kMax - kMin || 1)) * (H - PT - PB)
  const yF = (v: number) => H - PB - ((v - fMin) / (fMax - fMin || 1)) * (H - PT - PB)
  const path = (pick: (p: typeof days[number]) => number, yFn: (v: number) => number) =>
    days.map((p, i) => `${x(i).toFixed(1)},${yFn(pick(p)).toFixed(1)}`).join(' ')
  const dateIdx = [0, 1, 2, 3, 4].map(k => Math.round(k * (days.length - 1) / 4))
  const fmtD = (iso: string) => `${iso.slice(2, 4)}.${iso.slice(5, 7)}`
  const jo = (eok: number) => `${(eok / 10000).toFixed(1)}조`
  const total = d.totalEok
  const yearsLabel = days.length > 300 ? '2년' : '1년'
  const sign = (v: number) => <b style={{ color: v >= 0 ? TK.green400 : TK.red400 }}>{v >= 0 ? '+' : ''}{jo(v)}</b>
  return (
    <div style={{ background: TK.bg3, borderRadius: RAD.sm, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>📈 코스피 지수 × 투자자별 누적 순매수 (최근 {yearsLabel})</b>
        <span style={{ fontSize: FS.micro, color: TK.sub2 }}>
          누적 — 🟢 외국인 {sign(d.totalEok)} · 🔵 기관 {sign(d.totalOrganEok)} · 🟡 개인 {sign(d.totalIndivEok)}
          {typeof d.totalEtcEok === 'number' && <> · ⚪ 기타법인(자사주 등) {sign(d.totalEtcEok)} <span style={{ color: TK.sub4 }}>= 넷의 합 0원(제로섬)</span></>}
          · 당일 동행 상관(외인) <b style={{ color: TK.slate300 }}>{d.corrDaily >= 0 ? '+' : ''}{d.corrDaily.toFixed(2)}</b>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: FS.micro, color: TK.sub3, margin: '6px 0 2px', flexWrap: 'wrap' }}>
        <span><span style={{ color: TK.slate300 }}>━</span> 코스피(왼쪽 눈금)</span>
        <span><span style={{ color: TK.green400 }}>━</span> 외국인</span>
        <span><span style={{ color: TK.blue400 }}>━</span> 기관</span>
        <span><span style={{ color: TK.amber400 }}>━</span> 개인</span>
        <span style={{ color: TK.sub4 }}>누적 순매수 · 오른쪽 눈금(조원)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 0.5, 1].map(t => {
          const yy = PT + t * (H - PT - PB)
          return (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={yy} y2={yy} stroke={TK.border} strokeDasharray="3 4" strokeWidth={1} />
              <text x={PL - 5} y={yy + 3.5} textAnchor="end" fontSize={10} fill={TK.sub3}>{Math.round(kMax - t * (kMax - kMin)).toLocaleString()}</text>
              <text x={W - PR + 5} y={yy + 3.5} textAnchor="start" fontSize={10} fill={TK.sub3}>{jo(fMax - t * (fMax - fMin))}</text>
            </g>
          )
        })}
        {/* 0조 기준선 — 누적이 +(사 모음)에서 −(팔아치움)로 넘어가는 경계.
            ⚠️ 격자선과 같은 점선이면 장식으로 읽힌다(2026-08-14 화면검증) → 실선 + 라벨.
            라벨은 눈금과 겹칠 수 있으니 가까우면(플롯 높이 10% 이내) 생략한다. */}
        {fMin < 0 && fMax > 0 && (() => {
          const y0 = yF(0)
          const plotH = H - PT - PB
          const tooClose = [PT, PT + plotH / 2, PT + plotH].some(ty => Math.abs(ty - y0) < plotH * 0.1)
          return (
            <g>
              <line x1={PL} x2={W - PR} y1={y0} y2={y0} stroke={TK.slate500} strokeWidth={1.2} />
              {!tooClose && <text x={W - PR + 5} y={y0 + 3.5} textAnchor="start" fontSize={10} fontWeight={700} fill={TK.slate400}>0조</text>}
            </g>
          )
        })()}
        {dateIdx.map((di, k) => (
          <text key={k} x={x(di)} y={H - 5} textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'} fontSize={10} fill={TK.sub3}>{fmtD(days[di].d)}</text>
        ))}
        <polyline points={path(p => p.kospi, yK)} fill="none" stroke={TK.slate300} strokeWidth={1.8} />
        <polyline points={path(p => p.cumForeignEok, yF)} fill="none" stroke={TK.green400} strokeWidth={1.6} />
        <polyline points={path(p => p.cumOrganEok, yF)} fill="none" stroke={TK.blue400} strokeWidth={1.4} />
        <polyline points={path(p => p.cumIndivEok, yF)} fill="none" stroke={TK.amber400} strokeWidth={1.4} />
      </svg>
      {/* ⚠️ 문구는 데이터에서 파생 — "함께 움직인다"를 단정하면 이 기간(지수 상승 vs 외인 대량 매도)처럼
          방향이 갈린 해에 요약이 차트를 반박한다(2026-08-14 검증에서 실제로 걸림). */}
      {(() => {
        const idxRet = (days[days.length - 1].kospi / days[0].kospi - 1) * 100
        const sameDir = (idxRet >= 0) === (total >= 0)
        return (
          <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 6, lineHeight: 1.6 }}>
            {sameDir ? (
              <>이 기간 외국인 누적({total >= 0 ? '+' : ''}{jo(total)}원)과 지수({idxRet >= 0 ? '+' : ''}{Math.round(idxRet)}%)는 <b>방향이 같았습니다</b> — 하루하루의 동행(상관 {d.corrDaily >= 0 ? '+' : ''}{d.corrDaily.toFixed(2)})이 긴 흐름으로도 이어진 해입니다.</>
            ) : (
              <>흥미로운 그림입니다 — 하루하루는 함께 움직이지만(당일 상관 {d.corrDaily >= 0 ? '+' : ''}{d.corrDaily.toFixed(2)}), 이 기간의 <b>긴 방향은 반대</b>였습니다: 외국인은 {jo(Math.abs(total))}원을 {total >= 0 ? '사는' : '파는'} 동안 지수는 {idxRet >= 0 ? '+' : ''}{Math.round(idxRet)}% {idxRet >= 0 ? '올랐습니다' : '내렸습니다'}. 초록 선(외국인)과 노란 선(개인)이 거울처럼 갈라지는 게 보이시죠 — <b>한쪽이 판 물량은 반드시 다른 쪽이 산 것</b>이라 수급은 제로섬이고, 그래서 외국인이 곧 지수의 전부가 아닙니다.</>
            )}
            {' '}⚠️ 우리 실측(1,150일)에서 <b>오늘까지의 수급으로 내일 이후를 맞히는 힘은 없었습니다</b>(예측 상관 0) —
            이 차트는 타이밍 도구가 아니라 &ldquo;외국인이 지금 한국 시장을 어떻게 대하고 있나&rdquo;를 읽는 관찰 도구입니다.
          </div>
        )
      })()}
    </div>
  )
}

function Row({ e, rank, amt, prices, open, chg }: { e: MarketFlowEntry; rank: number; amt: number; prices: number[]; open?: boolean; chg: number | null }) {
  const up = (chg ?? 0) > 0
  const chgCol = chg == null ? TK.sub : up ? TK.green500 : TK.red500
  const cheap = e.peg != null && e.peg > 0 && e.peg < 1.0 && !e.pegSuspect   // ⚠️ 기저효과 의심은 💎 박탈
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: TK.bg3, borderRadius: 8, fontSize: 13 }}>
      <span style={{ width: 26, textAlign: 'center', fontWeight: 800, color: rank < 3 ? TK.slate100 : TK.sub, fontSize: rank < 3 ? 15 : 12 }}>{medal(rank)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: TK.slate200, fontWeight: 700 }}>{e.name}</span>
          <span style={{ background: e.market === 'KOSDAQ' ? 'rgba(167,139,250,0.14)' : 'rgba(96,165,250,0.12)', color: e.market === 'KOSDAQ' ? TK.violet400 : TK.blue400, borderRadius: 5, padding: '0 5px', fontSize: 9.5, fontWeight: 700 }}>{e.market === 'KOSDAQ' ? '코스닥' : '코스피'}</span>
          <span style={{ color: TK.sub, fontSize: 11 }}>{e.sector}</span>
          {cheap && <span style={{ background: 'rgba(59,130,246,0.15)', color: TK.blue400, border: `1px solid ${TK.blue500}55`, borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>💎 저평가 PEG {e.peg!.toFixed(2)}</span>}
          {e.peg != null && e.peg > 0 && e.pegSuspect && <span title="이익 붕괴 후 회복(성장률 100%↑)으로 PEG가 0에 수렴하는 착시 — 경기순환주 저PEG 함정" style={{ background: 'rgba(245,158,11,0.12)', color: TK.amber400, border: `1px solid ${TK.amber500}44`, borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>⚠️ PEG {e.peg!.toFixed(2)} 기저효과</span>}
          {e.dualStreak >= 2 && <span style={{ background: 'rgba(245,158,11,0.15)', color: TK.amber500, border: `1px solid ${TK.amber500}55`, borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>🔥 {e.dualStreak}일 쌍끌이</span>}
        </div>
      </div>
      <MiniChart prices={prices} />
      <span style={{ width: 84, textAlign: 'right', color: amt >= 0 ? TK.slate200 : TK.red400, fontWeight: 800, fontFamily: 'monospace' }}>{won(amt)}</span>
      <span style={{ width: 64, textAlign: 'right', color: chgCol, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
        {chg == null ? '—' : `${up ? '▲' : '▼'}${Math.abs(chg)}%`}
      </span>
      <span style={{ width: 12, textAlign: 'center', color: TK.slate500, fontSize: 9, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
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

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>🌐 시장 수급 랭킹을 집계 중입니다…</div>
  if (!data || !data.poolSize) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>시장 수급 데이터를 불러오지 못했습니다. 장 마감 후 다시 확인해 주세요.</div>

  // 클라이언트 랭킹 — 선택한 주체(외인/기관) × 기간(1/5/20) × 시장(코스피/코스닥)
  const amtOf = (e: MarketFlowEntry) => (view === 'organ' ? e.organ[period] : e.foreign[period])
  const pool = data.entries.filter(e => mkt === 'ALL' || e.market === mkt)
  const list: MarketFlowEntry[] = view === 'dual'
    ? pool.filter(e => e.dualStreak >= 2).sort((a, b) => b.dualStreak - a.dualStreak || (b.foreign.d1 + b.organ.d1) - (a.foreign.d1 + a.organ.d1)).slice(0, 12)
    : [...pool].sort((a, b) => amtOf(b) - amtOf(a)).filter(e => amtOf(e) > 0).slice(0, 12)

  const TABS: { key: View; label: string; color: string }[] = [
    { key: 'foreign', label: '🟢 외국인 순매수', color: TK.green500 },
    { key: 'organ', label: '🔵 기관 순매수', color: TK.blue500 },
    { key: 'dual', label: '🔥 쌍끌이 연속매집', color: TK.amber500 },
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
    if (!ts || ts.length < 2) return { label: '—', color: TK.sub }
    const latest = ts[0], old = ts[ts.length - 1], accel = Math.abs(latest) >= Math.abs(old)
    if (latest >= 0) {
      if (old < 0) return { label: '🔄 상승전환', color: TK.green500 }
      return accel ? { label: '🔴 상승가속', color: TK.red500 } : { label: '🟠 상승둔화', color: TK.amber500 }
    }
    if (old > 0) return { label: '🔄 하락전환', color: TK.blue500 }
    return accel ? { label: '🔵 하락가속', color: TK.blue500 } : { label: '🟢 하락둔화(반등?)', color: TK.green500 }
  }
  const tsLen = Math.max(0, ...list.map(e => (e.trendSpeed ?? []).length))
  const dateCols = (data.recentDates?.length ? data.recentDates : Array.from({ length: tsLen }, () => '')).slice(0, 5)   // 최신→과거

  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}` }}>
      {/* 📈 지수 투자 학생용 — 코스피 × 외인 누적 오버레이(랭킹보다 먼저, 시장 전체 그림부터) */}
      <KospiFlowOverlay />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 16 }}>국내 시장 수급 랭킹</span>
        <span style={{ marginLeft: 'auto', color: TK.sub2, fontSize: 11 }}>주요 코스피·코스닥 {data.poolSize}종목 · 외인·기관이 담는 종목</span>
      </div>
      <div style={{ color: TK.sub2, fontSize: 11, marginBottom: 12 }}>지금 메이저 돈이 어디로 쏠리나 — 새로운 주도주 발굴용. 저PEG면 💎 표시(리밸런싱 위성 후보 힌트)</div>

      {/* 보기 모드: 리스트 ↔ 추세맵 */}
      <div style={{ display: 'inline-flex', gap: 3, background: TK.bg3, padding: 3, borderRadius: 9, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
        {([['list', '📋 리스트'], ['heat', '🌡️ 추세속도 맵']] as const).map(([k, lab]) => {
          const on = (k === 'heat') === heat
          return (
            <button key={k} onClick={() => setHeat(k === 'heat')}
              style={{ padding: '4px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: on ? TK.border : 'transparent', color: on ? TK.slate200 : TK.sub3 }}>
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
              background: view === t.key ? `${t.color}22` : TK.bg3, color: view === t.key ? t.color : TK.sub,
              border: `1px solid ${view === t.key ? `${t.color}66` : BORDER}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 시장 필터 (코스피/코스닥) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ color: TK.sub2, fontSize: 10.5, marginRight: 2 }}>시장</span>
        {([['ALL', '전체'], ['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setMkt(k)}
            style={{ padding: '3px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: mkt === k ? 'rgba(167,139,250,0.18)' : TK.bg3, color: mkt === k ? TK.violet400 : TK.sub2,
              border: `1px solid ${mkt === k ? `${TK.violet400}66` : BORDER}` }}>
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
                background: period === p.key ? 'rgba(148,163,184,0.18)' : TK.bg3, color: period === p.key ? TK.slate200 : TK.sub2,
                border: `1px solid ${period === p.key ? TK.slate600 : BORDER}` }}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 리스트 모드 ── */}
      {!heat && (<>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 6px', fontSize: 10.5, color: TK.sub2 }}>
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
                    background: isOpen ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)', color: isOpen ? TK.indigo300 : TK.indigo400,
                    border: `1px solid ${isOpen ? `${TK.indigo400}66` : `${TK.indigo400}33`}` }}>
                  <span>📅</span>
                  <span>{isOpen ? '접기' : '20일 매매동향'}</span>
                  <span style={{ fontSize: 8, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </button>
              </div>
              {isOpen && <div style={{ marginTop: 4 }}><InvestorTimeline ticker={e.ticker} name={e.name} /></div>}
            </div>
          )
        }) : <div style={{ color: TK.sub, fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
              {view === 'dual' ? '현재 외인·기관 동시 연속매집(2일+) 종목이 없습니다.' : '해당 순매수 종목이 없습니다.'}
            </div>}
      </div>
      </>)}

      {/* ── 🌡️ 추세속도 맵 모드 ── */}
      {heat && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ color: TK.sub2, fontSize: 10.5, marginBottom: 8, lineHeight: 1.6 }}>
            <b style={{ color: TK.slate300 }}>[{view === 'dual' ? '쌍끌이' : PERIODS.find(p => p.key === period)!.label}] {TABS.find(t => t.key === view)!.label} 상위 종목</b> · 📅 <b style={{ color: TK.slate300 }}>기간 토글 = 순매수 랭킹 기준</b>(어느 기간에 많이 샀나)일 뿐, 오른쪽 <b style={{ color: TK.slate300 }}>추세속도 컬럼은 항상 최근 5거래일 고정</b>(MA10 이격도 %, ±15). 🔴상승·🔵하락, 짙을수록 강함, 5일 흐름으로 <b style={{ color: TK.slate300 }}>가속/둔화/전환</b>.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 540 }}>
            <thead>
              <tr style={{ color: TK.sub2, fontSize: 10 }}>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px', width: 20 }}>#</th>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 6px 7px' }}>종목</th>
                <th colSpan={dateCols.length} style={{ textAlign: 'center', fontWeight: 700, padding: '0 2px 2px', color: TK.violet400, fontSize: 9 }}>추세속도 — 항상 최근 5거래일(순매수 기간과 무관)</th>
                <th style={{ width: 96 }}></th>
              </tr>
              <tr style={{ color: TK.sub2, fontSize: 10 }}>
                <th style={{ padding: '0 6px 7px', width: 20 }}></th>
                <th style={{ padding: '0 6px 7px' }}></th>
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
                    <td style={{ color: TK.sub, padding: '6px 6px', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '6px 6px', fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: 700, color: TK.slate200 }}>{e.name.length > 9 ? e.name.slice(0, 8) + '…' : e.name}</span>
                      <span style={{ background: e.market === 'KOSDAQ' ? 'rgba(167,139,250,0.14)' : 'rgba(96,165,250,0.12)', color: e.market === 'KOSDAQ' ? TK.violet400 : TK.blue400, borderRadius: 4, padding: '0 4px', fontSize: 8.5, fontWeight: 700, marginLeft: 4 }}>{e.market === 'KOSDAQ' ? '코스닥' : '코스피'}</span>
                    </td>
                    {dateCols.map((_, j) => {
                      const v = ts[j]
                      return (
                        <td key={j} style={{ textAlign: 'center', padding: 2 }}>
                          {v == null ? <span style={{ color: TK.slate600 }}>—</span> : (
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
              }) : <tr><td colSpan={dateCols.length + 3} style={{ color: TK.sub, fontSize: 12, padding: '12px 0', textAlign: 'center' }}>해당 종목이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: TK.sub, fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        {heat
          ? '※ 추세속도 = (종가−10일 이동평균)/이동평균×100(이격도, ±15% 상한) · 부호=추세방향·크기=강도·5일변화=가속/둔화 · 머니디자인式 추세속도의 교육용 근사(독자지표와 공식 다름) · 투자 추천 아님.'
          : '※ 순매수 대금 = 일별 순매수 수량×종가 누적 추정치(1/5/20일) · 주요 코스피 유니버스 기준(전 종목 아님, ETF 제외) · 매일 장 마감 후 갱신. 교육용 시뮬레이션이며 투자 추천이 아닙니다.'}
      </div>
    </div>
  )
}
