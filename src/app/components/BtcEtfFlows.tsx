'use client'
// 🏦 비트코인 현물 ETF — ① 순유입/유출(Farside·최근 일별) ② 누적 거래량(Yahoo 전체·TheBlock 재현)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, AreaChart, Area, Bar, Line, Cell, XAxis, YAxis, Tooltip, ReferenceLine, Legend } from 'recharts'
import type { BtcEtfResult } from '@/app/api/btc-etf/route'

const CARD = '#161b25', BORDER = '#1e293b'
const fmtT = (v: number) => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B` : `$${(v / 1e6).toFixed(0)}M`
const fmtM = (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(2) + 'B' : v.toFixed(0) + 'M'}`
const mmdd = (d: string) => d.slice(5)
/* eslint-disable @typescript-eslint/no-explicit-any */
const flowTip = (val: any, n: any) => n === 'BTC 가격' ? [`$${Math.round(val).toLocaleString()}`, n] : [fmtM(val), '순유입']
const cumTip = (val: any) => [fmtT(val), '누적 거래량']
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function BtcEtfFlows() {
  const [d, setD] = useState<BtcEtfResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/btc-etf', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', color: '#8a9aaa', fontSize: 12 }}>🏦 비트코인 현물 ETF 데이터를 불러오는 중…</div>
  if (!d || d.cumVolume.length === 0) return null

  const flowHasData = d.flow.length > 0
  const cumLatest = d.cumVolume[d.cumVolume.length - 1]?.cum ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ① 순유입/유출 — Farside 최근 일별 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>🏦 현물 ETF 순유입/유출</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>{d.flowWindowDays > 30 ? '2024 출범~현재' : `최근 ${d.flowWindowDays}거래일`} · Farside</span>
          {d.flowCumulative != null && (
            <span style={{ marginLeft: 'auto', color: d.flowCumulative >= 0 ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 12 }}>
              출범 이후 누적 순유입 {fmtM(d.flowCumulative)}
            </span>
          )}
        </div>
        <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
          🟢 유입(기관 자금 들어옴) / 🔴 유출 · 노란선=BTC 가격. <b style={{ color: '#aab6c4' }}>가격의 방향이 아니라 &lsquo;연료&rsquo;</b>를 봅니다 — 지속 유입은 제도권 수요, 유출 전환은 수요 둔화 신호.
        </div>
        {flowHasData ? (
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={d.flow} margin={{ top: 6, right: 8, left: 4, bottom: 2 }}>
              <XAxis dataKey="date" tickFormatter={d.flowWindowDays > 30 ? (v: string) => v.slice(0, 7) : mmdd} tick={{ fill: '#8599ae', fontSize: 10 }} minTickGap={d.flowWindowDays > 30 ? 48 : 8} />
              <YAxis yAxisId="flow" tick={{ fill: '#8599ae', fontSize: 10 }} tickFormatter={(v: number) => `${v}M`} width={48} />
              <YAxis yAxisId="px" orientation="right" domain={['auto', 'auto']} tick={{ fill: '#fbbf24', fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={42} />
              <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
                formatter={flowTip} labelStyle={{ color: '#cbd5e1' }} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              <ReferenceLine yAxisId="flow" y={0} stroke="#475569" />
              <Bar yAxisId="flow" dataKey="net" name="순유입/유출" radius={[2, 2, 0, 0]}>
                {d.flow.map((f, i) => <Cell key={i} fill={f.net >= 0 ? '#22c55e' : '#ef4444'} />)}
              </Bar>
              <Line yAxisId="px" dataKey="price" name="BTC 가격" stroke="#fbbf24" strokeWidth={1.8} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#8a9aaa', fontSize: 11.5, padding: '8px 0' }}>일별 유입/유출 데이터를 일시적으로 불러오지 못했습니다(누적 순유입 {d.flowCumulative != null ? fmtM(d.flowCumulative) : '—'}만 표시).</div>
        )}
      </div>

      {/* ② 누적 거래량 — Yahoo 전체 이력 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>📈 현물 ETF 누적 거래량</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>2024 출범~현재 · Yahoo</span>
          <span style={{ marginLeft: 'auto', color: '#60a5fa', fontWeight: 800, fontSize: 13 }}>{fmtT(cumLatest)}</span>
        </div>
        <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
          출범 이후 거래대금 누적 합계 — 우상향이 가팔라질수록 <b style={{ color: '#aab6c4' }}>제도권 거래가 활발</b>해진다는 의미(시장 성숙도).
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={d.cumVolume} margin={{ top: 6, right: 10, left: 6, bottom: 2 }}>
            <defs>
              <linearGradient id="cumVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(0, 7)} tick={{ fill: '#8599ae', fontSize: 10 }} minTickGap={40} />
            <YAxis tick={{ fill: '#8599ae', fontSize: 10 }} tickFormatter={fmtT} width={48} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
              formatter={cumTip} labelStyle={{ color: '#cbd5e1' }} />
            <Area dataKey="cum" stroke="#60a5fa" strokeWidth={2} fill="url(#cumVol)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 순유입/유출=Farside Investors 공개 데이터(현물 BTC ETF 순창출/환매, 무료 페이지라 최근 일별만) · 누적 거래량=Yahoo Finance 현물 ETF {10}종 거래대금 합산(TheBlock과 동일 출처) · 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}
