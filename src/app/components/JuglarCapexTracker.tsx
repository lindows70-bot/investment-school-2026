'use client'
// 주글라르 파동 추적기 — 빅테크 하이퍼스케일러 CAPEX 합산 추이(AI 설비투자 사이클 위치)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, Cell } from 'recharts'
import type { JuglarResult } from '@/app/api/juglar-capex/route'

const CARD = '#12151c', BORDER = '#252a36'

export default function JuglarCapexTracker() {
  const [d, setD] = useState<JuglarResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/juglar-capex', { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => setErr(true))
  }, [])

  if (err) return null
  if (!d) return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 18, color: '#8a9aaa', fontSize: 13 }}>
      🏭 빅테크 설비투자(CAPEX) 추이를 불러오는 중…
    </div>
  )

  const v = {
    surge: { color: '#34d399', text: `🔥 주글라르 상승기 — 빅테크 CAPEX가 전년 대비 +${d.latestYoY}% 급증(AI 인프라 설비투자 폭발)` },
    expand: { color: '#60a5fa', text: `📈 확장 지속 — CAPEX 전년 대비 ${d.latestYoY != null ? (d.latestYoY > 0 ? '+' : '') + d.latestYoY + '%' : '증가'}` },
    slow: { color: '#f59e0b', text: `⚠️ 둔화 — CAPEX 증가세 꺾임(${d.latestYoY}%) · 과잉투자 후 정점 의심` },
  }[d.verdict]

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🏭 주글라르 파동 — 빅테크 CAPEX 추적기</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>하이퍼스케일러 5사 합산 연간 설비투자(AI 인프라 사이클)</span>
      </div>

      {/* 국면 배너 */}
      <div style={{ background: `${v.color}1a`, border: `1px solid ${v.color}55`, borderRadius: 9, padding: '8px 12px', marginBottom: 10, color: '#e2e8f0', fontSize: 12.5, fontWeight: 700 }}>
        {v.text}
      </div>

      <div style={{ height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.years} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fill: '#7f93a8', fontSize: 10 }} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={false} tickLine={false} width={42}
              tickFormatter={(x: number) => `$${x}B`} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any) => [`$${val}B`, '합산 CAPEX']} labelFormatter={(y) => `${y}년`} />
            <Bar dataKey="capexB" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {d.years.map((_, i) => <Cell key={i} fill={i === d.years.length - 1 ? '#34d399' : '#2f6f5f'} />)}
              <LabelList dataKey="yoy" position="top" fill="#aab6c4" fontSize={10}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any) => (val != null ? `${val > 0 ? '+' : ''}${val}%` : '')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 기업별 최근 CAPEX */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {d.anchors.map(a => (
          <span key={a.ticker} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#9aa0b8' }}>
            {a.name} <b style={{ color: '#cdd6e3' }}>${a.latestB ?? '—'}B</b>
          </span>
        ))}
      </div>

      <div style={{ color: '#7f93a8', fontSize: 10, lineHeight: 1.6, marginTop: 10 }}>
        🧭 빅테크 CAPEX 급증 = <b style={{ color: '#34d399' }}>주글라르(설비투자) 파동 상승</b> → ⚡AI 전력망·원전 · 🔧반도체 장비 · 🌐인프라 섹터로 <b>낙수효과</b>(주문이 흘러감). 단, &lsquo;AI 투자 대비 수익(ROI)&rsquo; 의문이 커지면 CAPEX가 꺾여 둔화로 전환될 수 있습니다.
        <br />⚠️ 회계연도 말월이 다른 기업(MS 6월·오라클 5월)이 섞여 단독 연도(4개사 미만)는 제외했습니다. 교육용 참고 지표.
      </div>
    </div>
  )
}
