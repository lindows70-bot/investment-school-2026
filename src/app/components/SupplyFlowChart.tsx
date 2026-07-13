'use client'
// 📈 수급 차트 — 종목의 외국인·기관·개인 누적 순매수를 '증권사식 캔들 주가차트'와 오버레이(스마트머니 매집/이탈을 눈으로). KR 개별주식 전용, 아무 종목이나.
import { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import type { TimelineResult } from '@/app/api/money-flow/timeline/route'

const CARD = '#161b25', BORDER = '#1e293b'
const C = { foreign: '#22c55e', organ: '#60a5fa', individual: '#8a9aaa', up: '#F0475B', down: '#3B82F6' }   // 한국식: 양봉 빨강·음봉 파랑
const eok = (v: number) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}조` : `${Math.round(v).toLocaleString()}억`

interface Candle { date: string; open: number; high: number; low: number; close: number }
interface Row { d: string; o: number; h: number; l: number; c: number; range: [number, number]; fCum: number; oCum: number; iCum: number }

// 캔들 커스텀 shape — Recharts Bar(dataKey=range=[저,고])의 y/height(가격축 픽셀)로 몸통·꼬리 그림
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandleShape(props: any) {
  const { x, width, y, height, payload } = props
  const { o, h, l, c } = payload as { o: number; h: number; l: number; c: number }
  const cx = x + width / 2
  const up = c >= o
  const color = up ? C.up : C.down
  if (!(h > l)) return <line x1={x + 1} x2={x + width - 1} y1={y} y2={y} stroke={color} strokeWidth={1.4} />
  const pxPer = height / (h - l)
  const oy = y + (h - o) * pxPer, cyy = y + (h - c) * pxPer
  const bodyTop = Math.min(oy, cyy), bodyH = Math.max(Math.abs(oy - cyy), 1)
  const bw = Math.max(width * 0.62, 1.6)
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
    </g>
  )
}

export default function SupplyFlowChart({ ticker, market, name }: { ticker: string; market: string; name?: string }) {
  const [tl, setTl] = useState<TimelineResult | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [state, setState] = useState<'load' | 'ok' | 'none'>('load')
  const isKr = market === 'KR' || /^\d{6}/.test(ticker)

  useEffect(() => {
    if (!ticker || !isKr) { setState('none'); return }
    let alive = true
    setState('load'); setTl(null); setCandles([])
    Promise.all([
      fetch(`/api/money-flow/timeline?ticker=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name ?? ticker)}&days=250`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/tech-chart?ticker=${encodeURIComponent(ticker)}&market=KR&tf=D`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([j, tc]) => {
      if (!alive) return
      if (j?.rows?.length >= 5) { setTl(j); setCandles(Array.isArray(tc?.candles) ? tc.candles : []); setState('ok') }
      else setState('none')
    }).catch(() => { if (alive) setState('none') })
    return () => { alive = false }
  }, [ticker, market, name, isKr])

  const { chart, smartTotal, recent5Smart, priceChg, pMin, pMax } = useMemo(() => {
    if (!tl?.rows?.length) return { chart: [] as Row[], smartTotal: 0, recent5Smart: 0, priceChg: 0, pMin: 0, pMax: 0 }
    const cMap = new Map<string, Candle>()
    for (const k of candles) cMap.set(k.date, k)
    const chron = [...tl.rows].reverse()   // 과거→현재
    let cf = 0, co = 0, ci = 0
    const chart: Row[] = chron.map(r => {
      cf += r.foreign; co += r.organ; ci += r.individual
      const cd = cMap.get(r.date)
      const o = cd?.open ?? r.close, h = cd?.high ?? r.close, l = cd?.low ?? r.close, c = cd?.close ?? r.close
      return { d: r.date.slice(5), o, h, l, c, range: [l, h], fCum: Math.round(cf * 10) / 10, oCum: Math.round(co * 10) / 10, iCum: Math.round(ci * 10) / 10 }
    })
    const last = chart[chart.length - 1]
    const smartTotal = (last?.fCum ?? 0) + (last?.oCum ?? 0)
    const recent5Smart = tl.rows.slice(0, 5).reduce((s, r) => s + r.foreign + r.organ, 0)
    const priceChg = chart.length > 1 && chart[0].c > 0 ? Math.round(((last.c - chart[0].c) / chart[0].c) * 1000) / 10 : 0
    let pMin = Infinity, pMax = -Infinity
    for (const r of chart) { if (r.l < pMin) pMin = r.l; if (r.h > pMax) pMax = r.h }
    return { chart, smartTotal, recent5Smart, priceChg, pMin: pMin * 0.985, pMax: pMax * 1.015 }
  }, [tl, candles])

  if (state === 'none') return null
  if (state === 'load') return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18, color: '#8a9aaa', fontSize: 12.5 }}>
      📈 수급 차트 — 캔들 주가 + 외국인·기관·개인 누적 순매수를 불러오는 중…
    </div>
  )
  if (!tl) return null

  const V = smartTotal < 0 && recent5Smart < 0
    ? { key: 'exit', label: '🚨 스마트머니 지속 이탈', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', bd: 'rgba(239,68,68,0.4)' }
    : smartTotal < 0
    ? { key: 'weak', label: '⚠️ 스마트머니 이탈 우위', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.4)' }
    : recent5Smart > 0
    ? { key: 'accum', label: '🟢 스마트머니 매집', color: '#22c55e', bg: 'rgba(34,197,94,0.10)', bd: 'rgba(34,197,94,0.4)' }
    : { key: 'mixed', label: '⚪ 수급 혼조', color: '#8a9aaa', bg: 'rgba(138,154,170,0.08)', bd: BORDER }
  const msg = V.key === 'exit'
    ? `최근 ${tl.days}거래일 외국인+기관이 합산 ${eok(smartTotal)} 순매도(최근 5일도 이탈 지속) — 개인이 물량을 받아내는 SK하이닉스형 분산 구조입니다. 스마트머니 이탈은 하락 압력이 누적되는 신호(수급은 개미와 반대로 해석).`
    : V.key === 'weak'
    ? `최근 ${tl.days}거래일 외국인+기관 합산 ${eok(smartTotal)} 순매도 우위 — 다만 최근 5일은 소폭 유입 전환. 메이저 수급 방향을 더 지켜보세요.`
    : V.key === 'accum'
    ? `최근 ${tl.days}거래일 외국인+기관이 합산 ${eok(smartTotal)} 순매수로 매집 중입니다. 스마트머니가 들어오는 구간(수급은 연료, 방향은 실적).`
    : `외국인+기관 합산 ${eok(smartTotal)}로 뚜렷한 방향이 없습니다. 수급보다 펀더멘탈 신호를 중심으로 보세요.`

  return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${V.bd}`, overflow: 'hidden' }}>
      <div style={{ background: V.bg, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>📈 수급 차트</span>
        <span style={{ fontSize: 11, color: '#8a9aaa' }}>{tl.name} · 캔들 주가 + 외국인·기관·개인 누적 순매수</span>
        <span style={{ marginLeft: 'auto', background: V.color + '22', color: V.color, border: `1px solid ${V.bd}`, borderRadius: 999, padding: '3px 12px', fontWeight: 800, fontSize: 12 }}>{V.label}</span>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ color: '#cbd5e1', fontSize: 11.5, lineHeight: 1.6, marginBottom: 10 }}>
          {msg} <span style={{ color: '#8a9aaa' }}>같은 기간 주가 {priceChg >= 0 ? '+' : ''}{priceChg}%.</span>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chart} margin={{ top: 6, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 9.5, fill: '#7f93a8' }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis yAxisId="flow" tick={{ fontSize: 9.5, fill: '#7f93a8' }} tickFormatter={(v: number) => eok(v)} width={46} />
            <YAxis yAxisId="price" orientation="right" domain={[pMin, pMax]} tick={{ fontSize: 9.5, fill: '#a8b5c2' }} tickFormatter={(v: number) => v >= 10000 ? `${Math.round(v / 1000).toLocaleString()}천` : v.toLocaleString()} width={48} />
            <ReferenceLine yAxisId="flow" y={0} stroke="#475569" strokeWidth={1} />
            <Tooltip
              contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(val, key) => {
                const m: Record<string, string> = { fCum: '🌍 외국인 누적', oCum: '🏛️ 기관 누적', iCum: '👤 개인 누적', range: '주가(고·저)' }
                const k = String(key)
                if (k === 'range' && Array.isArray(val)) return [`${Number(val[0]).toLocaleString()}~${Number(val[1]).toLocaleString()}`, '주가']
                return [eok(Number(val)), m[k] ?? k]
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="plainline"
              formatter={(v) => ({ range: '🕯️ 주가(캔들·우축)', fCum: '🌍 외국인 누적', oCum: '🏛️ 기관 누적', iCum: '👤 개인 누적' } as Record<string, string>)[v] ?? v} />
            {/* 🕯️ 캔들 주가(우축·한국식 양봉 빨강/음봉 파랑) */}
            <Bar yAxisId="price" dataKey="range" name="range" shape={<CandleShape />} isAnimationActive={false} />
            {/* 누적 수급선(좌축) */}
            <Line yAxisId="flow" dataKey="fCum" name="fCum" stroke={C.foreign} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="flow" dataKey="oCum" name="oCum" stroke={C.organ} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            <Line yAxisId="flow" dataKey="iCum" name="iCum" stroke={C.individual} strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>

        <div style={{ color: '#8a9aaa', fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
          🕯️ 캔들=실제 주가(한국식 <span style={{ color: C.up }}>양봉 빨강</span>/<span style={{ color: C.down }}>음봉 파랑</span>·우축). 🌍외국인·🏛️기관 누적선(좌축)이 <b style={{ color: '#bbf7d0' }}>우상향(매집)</b>이면 유입, <b style={{ color: '#fecaca' }}>우하향(이탈)</b>이면 물량을 개인(👤)이 받는 분산 구조입니다.
          캔들과 함께 보면 &lsquo;누가 주가를 끌어올리고/눌렀나&rsquo;가 보입니다. 대금=순매수 수량×종가 추정·최근 {tl.days}거래일·교육용(투자 추천 아님).
        </div>
      </div>
    </div>
  )
}
