'use client'
// 🌊 엘리어트 파동 실전 설계도 — 주관적 이론을 객관적 필터(224일 EMA·거래량·피보나치·융합 체크리스트)로 계량화
// ⚠️ 실제 파동 번호(1~5, A-B-C)는 분석가마다 다르게 세는 주관적 기법이라 이 앱은 단정하지 않는다(제1원칙).
//    아래 번호는 객관 ZigZag가 찾은 '스윙 순번'일 뿐 공식 엘리어트 카운트가 아니며, EMA·RSI·거래량·피보는 전부 객관 계산.
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceDot, ReferenceLine } from 'recharts'
import type { ElliottEduResult } from '@/app/api/elliott-wave-edu/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg4, BORDER = TK.line3

// ── 객관 지표 헬퍼(주봉) ──────────────────────────────────────────────
// 224일 ≈ 45주 지수이동평균(EMA)
// 차트 왼쪽 시작점부터 그리도록 index 0에서 시드(초기 구간은 워밍업 — BTC 200주선과 동일 방식)
function ema(vals: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const out: (number | null)[] = []
  let prev: number | null = null
  for (let i = 0; i < vals.length; i++) {
    if (prev === null) { prev = vals[i]; out.push(Math.round(prev * 100) / 100); continue }
    prev = vals[i] * k + prev * (1 - k); out.push(Math.round(prev * 100) / 100)
  }
  return out
}
// RSI(14) — Wilder
function rsi(vals: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(vals.length).fill(null)
  if (vals.length <= period) return out
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) { const d = vals[i] - vals[i - 1]; if (d >= 0) gain += d; else loss -= d }
  let ag = gain / period, al = loss / period
  out[period] = al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 10) / 10
  for (let i = period + 1; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0
    ag = (ag * (period - 1) + g) / period; al = (al * (period - 1) + l) / period
    out[i] = al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 10) / 10
  }
  return out
}

// ── ① 이상적 개념도(정적 SVG) — 5파 상승(1-2-3-4-5) + 3파 조정(A-B-C) ──────────
function IdealWaveDiagram() {
  const pts: [number, number, string][] = [
    [20, 170, '0'], [110, 90, '1'], [160, 130, '2'], [280, 40, '3'],
    [330, 80, '4'], [420, 10, '5'], [480, 100, 'A'], [520, 60, 'B'], [580, 140, 'C'],
  ]
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  return (
    <svg viewBox="0 0 600 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1="10" y1="200" x2="595" y2="200" stroke="#3a4152" strokeWidth="1" />
      <path d={path} fill="none" stroke={TK.blue300} strokeWidth="2.5" />
      <path d={pts.slice(0, 6).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')} fill="none" stroke={TK.green400} strokeWidth="3.5" opacity="0.55" />
      <path d={pts.slice(5).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')} fill="none" stroke={TK.red400} strokeWidth="3.5" opacity="0.55" />
      {pts.slice(1).map(([x, y, label], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill={i < 5 ? TK.green400 : TK.red400} />
          <text x={x} y={y - 10} fill={TK.slate200} fontSize="13" fontWeight="800" textAnchor="middle">{label}</text>
        </g>
      ))}
      <text x="165" y="215" fill={TK.green400} fontSize="11" fontWeight="700" textAnchor="middle">임펄스(추세) 5파: 1-2-3-4-5</text>
      <text x="530" y="215" fill={TK.red400} fontSize="11" fontWeight="700" textAnchor="middle">조정 3파: A-B-C</text>
    </svg>
  )
}

// 융합 체크리스트 단계 상태 배지
type Verdict = 'pass' | 'watch' | 'fail' | 'na'
const VC: Record<Verdict, { c: string; t: string }> = {
  pass: { c: TK.green500, t: '충족' }, watch: { c: TK.amber500, t: '관찰' },
  fail: { c: TK.red400, t: '미충족' }, na: { c: TK.slate500, t: '해당 없음' },
}

export default function ElliottWaveEducation() {
  const [mkt, setMkt] = useState<'US' | 'KR'>('US')
  const [data, setData] = useState<ElliottEduResult | null>(null)
  const [err, setErr] = useState(false)
  const [eduOpen, setEduOpen] = useState(true)
  const [showWave, setShowWave] = useState(true)   // 🌊 알고리즘 추정 파동 카운트 표시

  useEffect(() => {
    setData(null)
    fetch(`/api/elliott-wave-edu?market=${mkt}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => (d.error ? setErr(true) : setData(d))).catch(() => setErr(true))
  }, [mkt])

  const confirmed = data?.swings.filter(s => s.confirmed) ?? []
  const pending = data?.swings.find(s => !s.confirmed) ?? null
  const idxName = mkt === 'US' ? '나스닥100 (QQQ)' : '코스피200'
  const idxFlag = mkt === 'US' ? '🇺🇸' : '🇰🇷'

  // 실제 주가(얇은 선) + 파동 골격(스윙 연결) + 224일 EMA + 거래량/RSI
  const swingByDate = new Map<string, number>()
  confirmed.forEach(s => swingByDate.set(s.date, s.price))
  if (pending) swingByDate.set(pending.date, pending.price)
  const pointsArr = data?.points ?? []
  const lastIdx = pointsArr.length - 1
  const closes = pointsArr.map(p => p.price)
  const emaArr = ema(closes, 45)
  const rsiArr = rsi(closes, 14)
  const emaLast = emaArr.length ? emaArr[emaArr.length - 1] : null
  const chartData = pointsArr.map((p, i) => ({
    date: p.date, price: p.price,
    zz: swingByDate.has(p.date) ? swingByDate.get(p.date)! : (i === lastIdx ? p.price : null),
    ma: emaArr[i], rsi: rsiArr[i],
    volUp: i > 0 && p.price >= closes[i - 1] ? p.volume : 0,
    volDn: i > 0 && p.price < closes[i - 1] ? p.volume : 0,
  }))

  // 📐 최근 상승 임펄스 레그 — 마지막 확정 저점(L0) → 그 이후 실제 최고가(legHigh). 미확정 고점도 포착(객관)
  const cf = confirmed
  let leg: { lowP: number; lowDate: string; highP: number; highDate: string } | null = null
  {
    let L0: (typeof cf)[number] | null = null
    for (let i = cf.length - 1; i >= 0; i--) { if (cf[i].type === 'low') { L0 = cf[i]; break } }
    if (L0) {
      const after = pointsArr.filter(p => p.date >= L0!.date)
      if (after.length) {
        let hi = after[0]
        for (const p of after) if (p.price > hi.price) hi = p
        if (hi.price > L0.price) leg = { lowP: L0.price, lowDate: L0.date, highP: hi.price, highDate: hi.date }
      }
    }
  }
  // 피보나치 되돌림/확장(레그 저점→고점 기준)
  let fib: { levels: { y: number; lbl: string }[]; ext: number } | null = null
  if (leg) {
    const range = leg.highP - leg.lowP
    const retr = (r: number) => leg!.highP - r * range
    fib = { ext: leg.lowP + 1.618 * range, levels: [
      { y: retr(0.382), lbl: '38.2%' }, { y: retr(0.5), lbl: '50%' }, { y: retr(0.618), lbl: '61.8%' },
    ] }
  }

  // ⭐ 융합 체크리스트 — 상승 레그에 4-STEP 객관 점검(파동 번호 단정 아님)
  let conf: null | {
    step1: Verdict; step2: Verdict; step3: Verdict; step4: Verdict
    retrPct: number; newHigh: boolean; overall: 'buy' | 'watch' | 'void'
  } = null
  if (data && leg && emaLast != null) {
    const cur = data.current.price
    const range = leg.highP - leg.lowP
    const afterHigh = pointsArr.filter(p => p.date > leg!.highDate)
    const pbLow = afterHigh.length ? Math.min(...afterHigh.map(p => p.price)) : cur
    const newHigh = cur >= leg.highP - 1e-9
    const retrPct = Math.round(((leg.highP - cur) / range) * 1000) / 10   // 현재 되돌림 깊이
    const legVols = pointsArr.filter(p => p.date >= leg!.lowDate && p.date <= leg!.highDate).map(p => p.volume).filter(v => v > 0)
    const pbVols = afterHigh.map(p => p.volume).filter(v => v > 0)
    const legAvgV = legVols.length ? legVols.reduce((a, b) => a + b, 0) / legVols.length : 0
    const pbAvgV = pbVols.length ? pbVols.reduce((a, b) => a + b, 0) / pbVols.length : 0
    const step1: Verdict = cur > emaLast ? 'pass' : 'fail'
    const step2: Verdict = newHigh ? 'na' : retrPct > 100 ? 'fail' : retrPct >= 38.2 && retrPct <= 61.8 ? 'pass' : 'watch'
    const step3: Verdict = legAvgV > 0 && pbAvgV > 0 ? (pbAvgV < legAvgV ? 'pass' : 'watch') : 'na'
    const step4: Verdict = pbLow > leg.lowP ? 'pass' : 'fail'
    const overall: 'buy' | 'watch' | 'void' =
      step1 === 'fail' || step4 === 'fail' || step2 === 'fail' ? 'void'
        : step1 === 'pass' && step4 === 'pass' && (step2 === 'pass' || step2 === 'na') && step3 !== 'watch' ? 'buy' : 'watch'
    conf = { step1, step2, step3, step4, retrPct, newHigh, overall }
  }

  // 🌊 알고리즘 추정 엘리어트 카운트 — 구조 바닥(최저 확정 저점)에서 스윙에 1-5·A-B-C 라벨 + 3대 규칙 검증(객관)
  const waveLabel = new Map<number, string>()
  let waveRules: null | { r1: boolean; r2: boolean; r3: boolean; ok: boolean } = null
  {
    const lows = cf.filter(s => s.type === 'low')
    const anchor = lows.length ? lows.reduce((m, s) => (s.price < m.price ? s : m)) : null
    if (anchor) {
      const ordered = [...cf, ...(pending ? [pending] : [])].filter(s => s.date > anchor.date).sort((a, b) => (a.date < b.date ? -1 : 1))
      const LB = ['1', '2', '3', '4', '5', 'A', 'B', 'C']
      ordered.forEach((s, i) => { if (i < LB.length) waveLabel.set(s.seq, LB[i]) })
      const byLabel = (l: string) => ordered.find(s => waveLabel.get(s.seq) === l) ?? null
      const w1 = byLabel('1'), w2 = byLabel('2'), w3 = byLabel('3'), w4 = byLabel('4'), w5 = byLabel('5')
      if (w1 && w2 && w3 && w4 && w5) {
        const len1 = Math.abs(w1.price - anchor.price), len3 = Math.abs(w3.price - w2.price), len5 = Math.abs(w5.price - w4.price)
        const r1 = w2.price > anchor.price          // 2파는 1파 시작점 이하로 안 내려감
        const r3 = w4.price > w1.price               // 4파 저점 > 1파 고점(중첩 없음)
        const r2 = !(len3 < len1 && len3 < len5)     // 3파는 최단 아님
        waveRules = { r1, r2, r3, ok: r1 && r2 && r3 }
      }
    }
  }
  const isImpulse = (l: string | undefined) => !!l && '12345'.includes(l)

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🌊 엘리어트 파동 실전 설계도</span>
        <span style={{ color: TK.sub, fontSize: 10.5 }}>주관적 이론 → 객관적 필터(224 EMA · 거래량 · 피보나치 · 융합) — 파동 번호는 단정 안 함</span>
      </div>

      {/* ① 개념도 */}
      <div style={{ background: TK.bg3, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '10px 14px', marginTop: 8 }}>
        <div style={{ color: TK.sub8, fontSize: 11, marginBottom: 4 }}>① 이상적 개념도 — 추세 5파 + 조정 3파(교과서 예시, 실데이터 아님)</div>
        <IdealWaveDiagram />
      </div>

      {/* ② 실제 차트 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ color: TK.sub8, fontSize: 11 }}>② {idxName} 실제 주봉 + 224 EMA·피보·알고리즘 추정 파동 카운트 — 규칙 검증 병기(확정 아님)</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['US', 'KR'] as const).map(k => (
              <button key={k} onClick={() => setMkt(k)} style={{
                padding: '3px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: mkt === k ? TK.border : 'transparent', color: mkt === k ? TK.slate200 : TK.sub3 }}>
                {k === 'US' ? '🇺🇸 나스닥100' : '🇰🇷 코스피200'}
              </button>
            ))}
          </div>
        </div>

        {err ? (
          <div style={{ color: TK.sub, fontSize: 12, padding: 12 }}>데이터를 불러오지 못했습니다.</div>
        ) : !data ? (
          <div style={{ color: TK.sub, fontSize: 12, padding: 12 }}>차트를 계산 중입니다…</div>
        ) : (
          <>
            {/* 현재 위치 요약 */}
            <div style={{ background: data.current.direction === 'up' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${data.current.direction === 'up' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
              borderRadius: 9, padding: '8px 12px', marginBottom: 8 }}>
              <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12.5 }}>📍 현재 위치</span>
              <span style={{ color: TK.sub5, fontSize: 12, marginLeft: 8 }}>
                {idxFlag} <b style={{ color: TK.sub8 }}>{idxName}</b> 실제 주가 기준 · 마지막 확정 스윙(#{confirmed[confirmed.length - 1]?.seq ?? '—'}, {confirmed[confirmed.length - 1]?.type === 'high' ? '고점' : '저점'}, {confirmed[confirmed.length - 1]?.date}) 이후
                <b style={{ color: data.current.direction === 'up' ? TK.green400 : TK.red400 }}> {data.current.sincePivotPct > 0 ? '+' : ''}{data.current.sincePivotPct}%</b>
                {pending && <span> · {pending.type === 'high' ? '고점 갱신 중(진행)' : '저점 갱신 중(진행)'}, 아직 {data.zigzagPct}% 반전 미확정</span>}
              </span>
            </div>

            {/* 범례 */}
            <div style={{ display: 'flex', gap: 13, alignItems: 'center', fontSize: 10, color: TK.sub, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 18, height: 2, background: TK.amber400, display: 'inline-block' }} /> 실제 주가</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 18, height: 3, background: TK.blue300, display: 'inline-block' }} /> 파동 골격</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 18, height: 0, borderTop: `2px dashed ${TK.violet400}`, display: 'inline-block' }} /> 224일 EMA(1년선)</span>
              {fib && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 18, height: 0, borderTop: `1px dashed ${TK.green400}`, display: 'inline-block' }} /> 피보 되돌림·목표</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: TK.green400, display: 'inline-block' }} />고점·<span style={{ width: 9, height: 9, borderRadius: '50%', background: TK.red400, display: 'inline-block' }} />저점 스윙</span>
            </div>

            {/* 메인 차트: 가격 + EMA + 골격 + 피보 + 스윙 */}
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 44, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: TK.sub2, fontSize: 9.5 }} tickFormatter={(s: string) => s.slice(0, 7)} minTickGap={56} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: TK.sub2, fontSize: 9.5 }} axisLine={false} tickLine={false} width={54}
                    tickFormatter={(v: number) => data.market === 'KR' ? `${Math.round(v / 1000)}k` : `$${Math.round(v)}`} />
                  <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, n: any) => [data.market === 'KR' ? `₩${Number(v).toLocaleString()}` : `$${Number(v).toFixed(1)}`, n === '파동 골격' ? '파동 골격' : n === '224일선' ? '224일 EMA' : data.label]} />
                  {/* 피보나치 되돌림·확장(마지막 상승 스윙) */}
                  {fib && fib.levels.map(l => (
                    <ReferenceLine key={l.lbl} y={l.y} stroke={TK.green400} strokeDasharray="2 4" strokeOpacity={0.45}
                      label={{ value: l.lbl, position: 'right', fill: TK.green400, fontSize: 8.5, fillOpacity: 0.8 }} />
                  ))}
                  {fib && <ReferenceLine y={fib.ext} stroke={TK.amber500} strokeDasharray="3 3" strokeOpacity={0.5}
                    label={{ value: '161.8% 목표', position: 'right', fill: TK.amber500, fontSize: 8.5 }} />}
                  {/* 실제 주가(노란 얇은 선) */}
                  <Line type="monotone" dataKey="price" name={data.label} stroke={TK.amber400} strokeWidth={1.1} strokeOpacity={0.8} dot={false} isAnimationActive={false} />
                  {/* 224일 EMA(1년선) */}
                  <Line type="monotone" dataKey="ma" name="224일선" stroke={TK.violet400} strokeWidth={1.4} strokeDasharray="5 3" strokeOpacity={0.85} dot={false} connectNulls isAnimationActive={false} />
                  {/* 파동 골격(스윙 연결) */}
                  <Line type="linear" dataKey="zz" name="파동 골격" stroke={TK.blue300} strokeWidth={2.4} dot={false} connectNulls isAnimationActive={false} />
                  {confirmed.map(s => {
                    const wl = showWave ? waveLabel.get(s.seq) : undefined
                    return (
                      <ReferenceDot key={s.seq} x={s.date} y={s.price} r={5} fill={s.type === 'high' ? TK.green400 : TK.red400} stroke={TK.bg3} strokeWidth={1.5}
                        label={{ value: wl ?? String(s.seq), position: s.type === 'high' ? 'top' : 'bottom', fill: wl ? (isImpulse(wl) ? TK.green400 : TK.red400) : TK.slate200, fontSize: wl ? 13 : 10, fontWeight: 800 }} />
                    )
                  })}
                  {pending && (() => {
                    const wl = showWave ? waveLabel.get(pending.seq) : undefined
                    return (
                      <ReferenceDot x={pending.date} y={pending.price} r={5} fill="none" stroke={pending.type === 'high' ? TK.green400 : TK.red400} strokeWidth={2}
                        label={{ value: wl ? `${wl}?` : `${pending.seq}?`, position: pending.type === 'high' ? 'top' : 'bottom', fill: wl ? (isImpulse(wl) ? TK.green400 : TK.red400) : TK.sub, fontSize: wl ? 12 : 10, fontWeight: 800 }} />
                    )
                  })()}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 거래량 + RSI 스트립 — 파동의 동력원(3파 폭발 / 5파 다이버전스) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 1 }}>
              <span style={{ color: TK.sub, fontSize: 9.5 }}>📊 거래량(막대) · RSI 14(주황선) — 3파 거래량 폭발 / 5파 가격↑·RSI↓ 다이버전스 확인</span>
            </div>
            <div style={{ height: 92 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 44, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis yAxisId="v" hide domain={[0, 'dataMax']} />
                  <YAxis yAxisId="r" orientation="right" domain={[0, 100]} ticks={[30, 70]} tick={{ fill: TK.sub2, fontSize: 8.5 }} axisLine={false} tickLine={false} width={26} />
                  <ReferenceLine yAxisId="r" y={70} stroke={TK.red400} strokeDasharray="2 3" strokeOpacity={0.4} />
                  <ReferenceLine yAxisId="r" y={30} stroke={TK.green400} strokeDasharray="2 3" strokeOpacity={0.4} />
                  <Bar yAxisId="v" dataKey="volUp" fill={TK.green500} fillOpacity={0.5} isAnimationActive={false} />
                  <Bar yAxisId="v" dataKey="volDn" fill={TK.red400} fillOpacity={0.5} isAnimationActive={false} />
                  <Line yAxisId="r" type="monotone" dataKey="rsi" stroke={TK.amber500} strokeWidth={1.3} dot={false} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 224일 EMA 실전 해석 */}
            <div style={{ color: TK.sub, fontSize: 10, marginTop: 6, lineHeight: 1.55, background: 'rgba(167,139,250,0.06)', border: `1px solid rgba(167,139,250,0.22)`, borderRadius: 8, padding: '7px 10px' }}>
              📏 <b style={{ color: TK.violet400 }}>224일선(1년선)</b> 위 스윙만 &lsquo;의미 있는 파동&rsquo;으로 봅니다 — 1년선 아래 작은 파동은 노이즈로 걸러 <b>주관적 카운팅에 객관 기준</b>을 부여합니다. <b style={{ color: TK.green400 }}>1년선 돌파</b> = 하락 종료·새 상승 사이클 출발(제1파), 이후 <b>눌림목(2파)</b>에서 진입해 가장 강력한 <b>3파</b>를 노립니다.
            </div>

            {/* 🌊 알고리즘 추정 파동 카운트 — 3대 규칙 검증 병기(정직) */}
            <div style={{ marginTop: 10, background: TK.bg3, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: waveRules ? 6 : 0 }}>
                <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>🌊 알고리즘 추정 파동 카운트</span>
                <span style={{ color: TK.sub, fontSize: 10 }}>구조 바닥에서 스윙에 1-5·A-B-C 라벨 (확정 아님 · 규칙 검증 병기)</span>
                <button onClick={() => setShowWave(v => !v)} style={{
                  marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
                  background: showWave ? TK.border : 'transparent', color: showWave ? TK.slate200 : TK.sub3 }}>
                  {showWave ? '🌊 파동 표시 ON' : '파동 표시 OFF'}
                </button>
              </div>
              {waveRules ? (
                <>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {[
                      { ok: waveRules.r1, t: '법칙1 · 2파>1파 시작점' },
                      { ok: waveRules.r2, t: '법칙2 · 3파≠최단' },
                      { ok: waveRules.r3, t: '법칙3 · 4파≠1파 중첩' },
                    ].map(r => (
                      <span key={r.t} style={{ fontSize: 10, fontWeight: 700, color: r.ok ? TK.green500 : TK.red400, background: r.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${r.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 6, padding: '3px 8px' }}>
                        {r.ok ? '✅' : '❌'} {r.t}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: waveRules.ok ? TK.green500 : TK.amber500, fontSize: 10.5, fontWeight: 700, marginTop: 6 }}>
                    {waveRules.ok
                      ? '🟢 3대 규칙 충족 — 유효한 카운트 후보(그래도 확정은 아님, 대체 시나리오 병행)'
                      : '🟡 규칙 위반 — 이 카운트는 무효/재검토 필요. 실제 데이터로 기계적 카운트하면 규칙 위반이 흔합니다 = 엘리어트가 주관적인 이유(대체 카운트 필요).'}
                  </div>
                </>
              ) : (
                <div style={{ color: TK.sub, fontSize: 10, marginTop: 4 }}>1~5파를 이룰 스윙이 아직 부족해 규칙 검증 보류(진행 중).</div>
              )}
              <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 5, lineHeight: 1.5 }}>
                ⓘ 이 라벨은 <b>객관 알고리즘</b>(최저 저점 기점 + ZigZag {data.zigzagPct}% 스윙)이 매긴 <b>추정 카운트</b>이지 공식·확정 카운트가 아닙니다. 같은 차트를 분석가마다 다르게 셀 수 있으므로 규칙 검증과 함께 &lsquo;확률적 참고&rsquo;로만 보세요.
              </div>
            </div>

            {/* ⭐ 융합(Confluence) 체크리스트 — 현재 차트 객관 점검 */}
            {conf && (
              <div style={{ marginTop: 10, background: TK.bg3, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>⭐ 융합 체크리스트 — 현재 {idxName} 객관 점검</span>
                  <span style={{
                    marginLeft: 'auto', fontWeight: 800, fontSize: 11.5,
                    color: conf.overall === 'buy' ? TK.green500 : conf.overall === 'watch' ? TK.amber500 : TK.red400 }}>
                    {conf.overall === 'buy' ? '🟢 매수 세팅 정렬(3파 대기)' : conf.overall === 'watch' ? '🟡 조건 일부 관찰' : '🔴 세팅 무효(규칙/추세 이탈)'}
                  </span>
                </div>
                {([
                  { s: conf.step1, t: 'STEP 1 · 추세', d: `가격이 224일 EMA 위 (Wave 1 검증)` },
                  { s: conf.step2, t: 'STEP 2 · 되돌림', d: conf.newHigh ? '되돌림 진행 전(신고가 갱신 중)' : `직전 상승분의 ${conf.retrPct}% 되돌림 (건강 구간 38.2~61.8%)` },
                  { s: conf.step3, t: 'STEP 3 · 거래량', d: '눌림목 거래량이 상승 구간보다 감소 (정상 조정)' },
                  { s: conf.step4, t: 'STEP 4 · 무효화 방어', d: '되돌림이 기준 저점(1파 시작점)을 안 깸' },
                ] as const).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11 }}>
                    <span style={{ width: 42, fontWeight: 800, fontSize: 10, color: VC[r.s].c, flexShrink: 0 }}>{r.s === 'pass' ? '✅' : r.s === 'watch' ? '⚠️' : r.s === 'fail' ? '❌' : '➖'} {VC[r.s].t}</span>
                    <span style={{ color: TK.slate300, fontWeight: 700, width: 118, flexShrink: 0 }}>{r.t}</span>
                    <span style={{ color: TK.sub5, fontSize: 10.5 }}>{r.d}</span>
                  </div>
                ))}
                <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 5, lineHeight: 1.5 }}>
                  ⓘ 4개 필터를 <b>객관 계산</b>(EMA·되돌림·거래량·구조 저점)으로 점검한 것이지, &lsquo;지금이 몇 파동&rsquo;이라는 단정이 아닙니다. 목표가는 피보 <b style={{ color: TK.amber500 }}>161.8% 확장</b>, 손절은 <b>1파 시작점 이탈</b>. 정밀 거래량·RSI 확인은 <b>[기술적 차트]</b>에서.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 🎓 실전 가이드 아코디언 */}
      <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 0 2px', textAlign: 'left' }}>
        <span style={{ color: TK.btcOrange, fontWeight: 800, fontSize: 12 }}>🎓 실전 설계도 — 3대 법칙 · 피보나치 · 거래량 동력 · 심리 · ABC 조정</span>
        <span style={{ marginLeft: 'auto', color: TK.sub, fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {eduOpen && (
        <div style={{ color: TK.sub5, fontSize: 11, lineHeight: 1.6, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 임펄스 vs 조정 */}
          <div>
            <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>⚖️ 시장의 두 상태 — 임펄스 vs 조정</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', background: 'rgba(96,165,250,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 9px' }}>
                <div style={{ color: TK.blue300, fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>🔵 임펄스(Motive) · 5파</div>
                <div style={{ color: TK.sub5, fontSize: 10, lineHeight: 1.5 }}>새 추세 형성(추세 방향). 거래량 진행될수록 폭발적 증가. 발생 빈도는 낮지만 <b>수익 극대화 구간</b>.</div>
              </div>
              <div style={{ flex: '1 1 200px', background: 'rgba(251,146,60,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 9px' }}>
                <div style={{ color: TK.orange400, fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>🟠 조정(Corrective) · 3파 A-B-C</div>
                <div style={{ color: TK.sub5, fontSize: 10, lineHeight: 1.5 }}>과열 소화·부분 되돌림(추세 반대). 거래량 점진 감소·변동성 축소. <b>현대 시장(외환·코인)에서 가장 빈번</b>.</div>
              </div>
            </div>
          </div>

          {/* 🔒 3대 절대 법칙 */}
          <div>
            <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 11.5, marginBottom: 5 }}>🔒 절대 불변의 3대 법칙 (The 3 Unbreakable Rules)</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {[
                { t: '법칙 1 · 2파 기점 이탈 금지', d: '2파는 1파 시작점 이하로 못 내려감. 100%+ 되돌리면 카운팅 폐기.' },
                { t: '법칙 2 · 3파 최단 금지', d: '3파는 1·3·5파 중 가장 짧을 수 없음. 보통 가장 길고 강력(연장).' },
                { t: '법칙 3 · 4파–1파 중첩 금지', d: '4파 저점은 1파 고점과 겹칠 수 없음. (변동성 큰 장선 미세 침범=유효하나 불완전)' },
              ].map(r => (
                <div key={r.t} style={{ flex: '1 1 150px', background: 'rgba(248,113,113,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 9px' }}>
                  <div style={{ color: TK.red300, fontWeight: 800, fontSize: 10, marginBottom: 2 }}>🔒 {r.t}</div>
                  <div style={{ color: TK.sub5, fontSize: 10, lineHeight: 1.45 }}>{r.d}</div>
                </div>
              ))}
            </div>
            <div style={{ color: TK.sub, fontSize: 10, marginTop: 4 }}>⛑️ 이 법칙이 깨지는 지점 = <b>손절 기준</b>. 주 시나리오가 무너지면 대체 카운팅(Plan B)으로 전환하는 게 프로의 리스크 관리.</div>
          </div>

          {/* 📐 피보나치 */}
          <div>
            <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>📐 피보나치 — 파동의 수학적 비율</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div>↩️ <b style={{ color: TK.blue300 }}>되돌림</b> — <b>2파</b>: 1파의 50~61.8%(최대 85.4%) · <b>4파</b>: 3파의 23.6~38.2% 얕은 조정(50% 미만)</div>
              <div>↗️ <b style={{ color: TK.green400 }}>확장(목표가)</b> — <b>3파</b>: 1파의 <b>161.8%</b>(엘리어트의 꽃)·2.0·2.618배 · <b>5파</b>: 1파와 1:1 또는 4파의 123.6~161.8% 역확장</div>
              <div>🎯 <b style={{ color: TK.amber500 }}>ABC 타점</b> — C파는 A파의 1:1~1.618배에서 멈추는 경향. 여러 비율이 겹치는(Confluence) 자리가 최고 신뢰도 진입점.</div>
            </div>
          </div>

          {/* 📊 거래량·다이버전스 */}
          <div>
            <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>📊 거래량·RSI = 파동의 동력원</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div>• <b style={{ color: TK.green400 }}>1파</b> 거래량 다소↑(시장 의구심) → <b style={{ color: TK.green400 }}>2파</b> 확연히↓(정상 눌림목 증명)</div>
              <div>• <b style={{ color: TK.green400 }}>3파</b> 거래량 <b>폭발 + 갭(Gap)</b> = 가장 강력·확실한 진행 신호</div>
              <div>• <b style={{ color: TK.red400 }}>5파</b> 신고가는 경신해도 거래량↓·RSI↓ <b>다이버전스</b> = 추세 종료 임박(마지막 잔치)</div>
              <div style={{ color: TK.sub, fontSize: 10 }}>🔗 <b>컨플런스</b>: 이평선 돌파(시작)+거래량 급증(힘)+RSI 다이버전스(종료)를 결합해 주관성을 줄입니다 — 위 거래량·RSI 스트립 및 <b>[기술적 차트]</b>의 라쉬케 다이버전스로 교차 확인.</div>
            </div>
          </div>

          {/* 🎭 파동의 인격 */}
          <div>
            <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>🎭 파동의 인격 — 대중 심리의 기하학</div>
            <div><b>1파</b> 의구심(스마트머니 매집) → <b>2파</b> 공포(전저점 재시험) → <b style={{ color: TK.green400 }}>3파</b> 환희·탐욕(갭·대중 참여) → <b style={{ color: TK.red400 }}>5파</b> 과도한 확신(다이버전스) → <b>A·B·C</b> 미련(B파 안도 랠리)·투매(C파 절망).</div>
            <div style={{ marginTop: 5, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, #60a5fa, #4ade80, #f59e0b, #f87171, #a855f7)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: TK.sub, marginTop: 2 }}><span>Fear · 의구심</span><span>Greed · 환희/과신</span><span>Fear · 공포/절망</span></div>
          </div>

          {/* 🌀 ABC 조정 3형태 */}
          <div>
            <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>🌀 현대 시장의 ABC 조정 3형태</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div>• <b>지그재그</b>(5-3-5) — 강력·깊은 A파 하락 후 발생. B파는 A파의 50~61.8%.</div>
              <div>• <b>레귤러 플랫</b>(3-3-5) — B파가 A파 시작점(90%)까지 반등 후 C파 하락. 박스권.</div>
              <div>• <b style={{ color: TK.red400 }}>확장형 플랫</b> — B파가 A파 고점을 돌파(123.6%)해 <b>불 트랩(Bull Trap)</b>을 만든 뒤 C파가 A파 저점을 깨고 폭락(고점 국면 빈번).</div>
            </div>
          </div>

          {/* ♻️ 프랙탈 */}
          <div>♻️ <b style={{ color: TK.violet400 }}>프랙탈 구조</b> — 큰 파동 하나 속에 동일한 5-3 주기가 더 작게 반복됩니다(자기 유사성). 분 단위 틱부터 수십 년 슈퍼사이클까지 같은 원리 → <b>큰 흐름(장기 TF)의 방향을 알아야 작은 흐름(단기 TF)에서 길을 잃지 않습니다.</b></div>

          {/* 🧠 마인드셋 */}
          <div style={{ background: 'rgba(251,191,36,0.06)', border: `1px solid rgba(251,191,36,0.25)`, borderRadius: 8, padding: '8px 10px' }}>
            🧠 <b style={{ color: TK.amber500 }}>마인드셋</b> — 파동은 주관적 예술이 아니라 <b>현대 지표(224 EMA·거래량·피보)와 결합된 엄격한 기하학적 리스크 관리 시스템</b>입니다. 기술적 분석은 미래를 맞추는 예언서가 아니라 <b>확률적 우위</b>를 점하는 도구 — 맹신하지 말고 &lsquo;확률&rsquo;에 베팅하세요.
          </div>

          <div>⚠️ <b style={{ color: TK.amber500 }}>파동 카운트를 어떻게 그렸나 (그리고 왜 &lsquo;확정&rsquo;이 아닌가)</b> — 차트의 1-5·A-B-C는 <b>객관 알고리즘</b>(최저 저점 기점 + ZigZag {data?.zigzagPct ?? 8}% 스윙)이 매긴 <b>추정 카운트</b>이고, 옆에 <b>3대 규칙(2파·3파·4파) 검증</b>을 함께 표시합니다. 다만 &lsquo;지금이 몇 파동인가&rsquo;는 기점·시간대에 따라 분석가마다 다르게 셀 수 있어 <b>공식·확정 카운트가 아닙니다</b> — 실제로 기계적 카운트는 규칙을 자주 위반합니다(그래서 대체 시나리오를 병행). EMA·거래량·피보·융합 체크리스트는 전부 객관 계산이며, 파동 라벨은 &lsquo;확률적 참고&rsquo;로만 보세요.</div>
        </div>
      )}
    </div>
  )
}
