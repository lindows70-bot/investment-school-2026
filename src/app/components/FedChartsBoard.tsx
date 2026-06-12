'use client'
// 📊 연준 핵심지표 차트보드 — ①물가 3겹(노이즈 벗기기) ②PPI(물가의 상류) ③고용 듀얼 ④연준의 실탄(금리-기조물가 갭)
import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, ComposedChart,
  XAxis, YAxis, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import type { FedChartsResult } from '@/app/api/fed-charts/route'

const CARD = '#161b25', BORDER = '#1e293b'
const TICK = { fill: '#7f93a8', fontSize: 9.5 }
const TIP_STYLE = { background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }
const fmtYm = (m: string) => `${m.slice(2, 4)}.${m.slice(5, 7)}`   // 2026-05 → 26.05

function Panel({ title, sub, note, badge, children }: { title: string; sub: string; note: string; badge?: { text: string; color: string } | null; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 420px', minWidth: 0, background: CARD, borderRadius: 12, padding: '13px 15px', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5 }}>{title}</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{sub}</span>
        {badge && <span style={{ marginLeft: 'auto', background: `${badge.color}1a`, color: badge.color, border: `1px solid ${badge.color}55`, borderRadius: 999, padding: '1px 9px', fontSize: 10, fontWeight: 800 }}>{badge.text}</span>}
      </div>
      <div style={{ height: 195 }}>{children}</div>
      <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.55, marginTop: 6 }}>{note}</div>
    </div>
  )
}

export default function FedChartsBoard() {
  const [d, setD] = useState<FedChartsResult | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/fed-charts', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
    return () => { alive = false }
  }, [])

  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>📊 연준 핵심지표 차트를 불러오는 중…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(34,197,94,0.05))', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 12, padding: '11px 16px' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>📊 연준 핵심지표 차트보드</span>
        <span style={{ color: '#8a9aaa', fontSize: 11, marginLeft: 10 }}>물가의 상류→하류, 고용, 연준의 실탄까지 — 추세로 읽는 양대책무</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* ① 물가 3겹 — 노이즈 벗기기 */}
        <Panel title="① 물가 3겹 — 노이즈 벗기기" sub="전년비 % · 5년" note={d.inflationNote}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.inflation} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="date" tick={TICK} tickFormatter={fmtYm} minTickGap={42} axisLine={{ stroke: BORDER }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TIP_STYLE} labelStyle={{ color: '#8a9aaa' }} formatter={v => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={2} stroke="#94a3b8" strokeDasharray="4 3" label={{ value: '목표 2%', fill: '#94a3b8', fontSize: 9, position: 'insideRight', dy: -9 }} />
              <Line name="헤드라인 CPI" dataKey="headline" stroke="#fb923c" dot={false} strokeWidth={1.8} connectNulls />
              <Line name="근원 CPI" dataKey="core" stroke="#60a5fa" dot={false} strokeWidth={1.6} strokeDasharray="5 3" connectNulls />
              <Line name="절사평균 PCE (워시 픽)" dataKey="trimmed" stroke="#22d3ee" dot={false} strokeWidth={2.2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* ② PPI — 물가의 상류 */}
        <Panel title="② PPI — 물가의 상류" sub="최종수요 전월비 % · 36개월" note={d.ppiNote}
          badge={d.ppiReaccel ? { text: '🚨 CPI 재가속 경고', color: '#f87171' } : { text: '추세 범위', color: '#4ade80' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.ppi} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="date" tick={TICK} tickFormatter={fmtYm} minTickGap={42} axisLine={{ stroke: BORDER }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TIP_STYLE} labelStyle={{ color: '#8a9aaa' }} formatter={v => `${typeof v === 'number' && v > 0 ? '+' : ''}${v}%`} />
              <ReferenceLine y={0} stroke={BORDER} />
              <Bar dataKey="v" name="PPI MoM" radius={[2, 2, 0, 0]}>
                {d.ppi.map(o => <Cell key={o.date} fill={o.v >= 0 ? '#f87171' : '#60a5fa'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* ③ 고용 듀얼 — 비농업 막대 + 실업률 라인 */}
        <Panel title="③ 고용 듀얼" sub="비농업 MoM(천명) + 실업률 % · 24개월" note={d.laborNote}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.labor} margin={{ top: 6, right: -8, left: -18, bottom: 0 }}>
              <XAxis dataKey="date" tick={TICK} tickFormatter={fmtYm} minTickGap={42} axisLine={{ stroke: BORDER }} tickLine={false} />
              <YAxis yAxisId="l" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={TICK} axisLine={false} tickLine={false} domain={['dataMin - 0.2', 'dataMax + 0.2']} />
              <Tooltip contentStyle={TIP_STYLE} labelStyle={{ color: '#8a9aaa' }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine yAxisId="l" y={0} stroke={BORDER} />
              <Bar yAxisId="l" dataKey="payemsK" name="비농업 MoM(K)" radius={[2, 2, 0, 0]}>
                {d.labor.map(o => <Cell key={o.date} fill={o.payemsK >= 0 ? '#4ade80' : '#f87171'} />)}
              </Bar>
              <Line yAxisId="r" dataKey="unrate" name="실업률 %" stroke="#fbbf24" dot={false} strokeWidth={1.8} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        {/* ④ 연준의 실탄 — 금리 vs 기조물가 갭 */}
        <Panel title="④ 연준의 실탄" sub="FF금리(월말) vs 절사평균 PCE · 5년" note={d.ammoNote}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.ammo} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="date" tick={TICK} tickFormatter={fmtYm} minTickGap={42} axisLine={{ stroke: BORDER }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TIP_STYLE} labelStyle={{ color: '#8a9aaa' }} formatter={v => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line name="기준금리(상단)" dataKey="ffr" stroke="#f87171" dot={false} strokeWidth={2} connectNulls />
              <Line name="절사평균 PCE" dataKey="trimmed" stroke="#22d3ee" dot={false} strokeWidth={2} connectNulls />
              <Line name="갭(실탄 %p)" dataKey="gap" stroke="#a78bfa" dot={false} strokeWidth={1.4} strokeDasharray="4 3" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ FRED 공식 데이터(CPIAUCSL·CPILFESL·PCETRIM12M159SFRBDAL·PPIFIS·PAYEMS·UNRATE·DFEDTARU) · 12h 캐시 · 일별 기준금리는 월말 값으로 다운샘플링 · 컨센서스(예측치) 비교는 무료 신뢰 데이터가 없어 정직하게 제외 · 참고 시각화이며 계절/국면 판정(SSOT)을 바꾸지 않습니다 · 교육용.
      </div>
    </div>
  )
}
