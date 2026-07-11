'use client'
// 🔄 비트코인 4년 사이클 내비게이터 — 반감기 기준 4국면(제1상승→제2상승→침체→상승준비) 현재 위치 +
// 과거 사이클(2016·2020) vs 현재(2024) 오버레이(반감기가=100 정규화·로그축). 표본 3개 = 통계 아닌 역사적 참고(정직 캐비엇).
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts'
import type { CycleNav } from '@/app/api/coin-lab/route'

const CARD = '#141824', BORDER = '#1e293b'
const PHASES = [
  { name: '제1 상승기', years: '2016 · 2020 · 2024', color: '#4ade80', desc: '반감기 해 — 공급 충격 반영 시작' },
  { name: '제2 상승기(정점)', years: '2017 · 2021 · 2025', color: '#fbbf24', desc: '과거 고점은 모두 이 연차(반감기 후 12~18개월)' },
  { name: '침체기(Bear)', years: '2018 · 2022 · 2026', color: '#f87171', desc: '고점 후 깊은 조정 — 과거 −70%대 드로다운' },
  { name: '상승 준비기(승부구간)', years: '2019 · 2023 · 2027', color: '#60a5fa', desc: '바닥 다지기·축적 — 다음 사이클 준비' },
]

export default function BtcCycleNavigator({ nav }: { nav: CycleNav }) {
  const cur = PHASES[nav.yearIdx]
  const lastM = (() => { let m = 0; for (const r of nav.overlay) if (r.c2024 != null && r.m > m) m = r.m; return m })()
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🔄 4년 사이클 내비게이터 — 과거 각본 위의 현재 위치</span>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>4차 반감기 후 {nav.daysSince}일 · 사이클 {nav.yearIdx + 1}년차 · 다음 반감기(예상) D-{nav.nextDDay}</span>
      </div>

      {/* 4국면 필 — 현재 국면 하이라이트 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 7, margin: '10px 0 12px' }}>
        {PHASES.map((p, i) => {
          const here = i === nav.yearIdx
          return (
            <div key={p.name} style={{ position: 'relative', background: here ? `${p.color}14` : '#0f1117', border: `1px solid ${here ? p.color : BORDER}`, borderRadius: 9, padding: '8px 11px' }}>
              {here && <span style={{ position: 'absolute', top: -9, right: 8, background: p.color, color: '#0d1017', fontSize: 9.5, fontWeight: 900, borderRadius: 6, padding: '1px 7px' }}>📍 지금 여기</span>}
              <div style={{ color: p.color, fontWeight: 800, fontSize: 11.5 }}>{i + 1}. {p.name}</div>
              <div style={{ color: '#8a9aaa', fontSize: 10, marginTop: 2 }}>{p.years}</div>
              <div style={{ color: '#aab6c4', fontSize: 10, marginTop: 3, lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          )
        })}
      </div>

      <div style={{ background: `${cur.color}10`, border: `1px solid ${cur.color}44`, borderRadius: 9, padding: '8px 12px', marginBottom: 12, fontSize: 11.5, lineHeight: 1.6 }}>
        <b style={{ color: cur.color }}>📍 지금은 {cur.name} 자리({cur.years.split(' · ')[2] ?? ''}년)</b>
        <span style={{ color: '#aab6c4' }}> — 과거 3번의 사이클에서 이 연차는 {cur.desc.split(' — ')[0]} 구간이었습니다. 각본이 반복된다는 보장은 없지만, 지금의 하락을 &lsquo;공포&rsquo;가 아니라 &lsquo;사이클의 자리&rsquo;로 읽는 훈련이 목적입니다.</span>
      </div>

      {/* 사이클 오버레이 — 반감기가=100, 로그축 */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={nav.overlay} margin={{ top: 6, right: 14, left: 6, bottom: 0 }}>
          <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
          <XAxis dataKey="m" type="number" domain={[0, 48]} ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
            tick={{ fill: '#8a9aaa', fontSize: 10.5 }} tickFormatter={v => `${v}개월`} />
          <YAxis scale="log" domain={['auto', 'auto']} tick={{ fill: '#8a9aaa', fontSize: 10.5 }} width={48}
            tickFormatter={v => `${((v as number) / 100).toFixed((v as number) < 300 ? 1 : 0)}×`} />
          <Tooltip
            contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
            labelFormatter={v => `반감기 후 ${v}개월`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [`${((v as number) / 100).toFixed(2)}× (반감기가 대비)`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine x={lastM} stroke="#fbbf24" strokeDasharray="5 3"
            label={{ value: '◀ 현재', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }} />
          <Line type="monotone" dataKey="c2016" name="2016 사이클" stroke="#8a9aaa" strokeWidth={1.3} strokeDasharray="5 3" dot={false} connectNulls />
          <Line type="monotone" dataKey="c2020" name="2020 사이클" stroke="#60a5fa" strokeWidth={1.3} strokeDasharray="5 3" dot={false} connectNulls />
          <Line type="monotone" dataKey="c2024" name="2024 사이클(현재)" stroke="#f1f5f9" strokeWidth={2.4} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 6, lineHeight: 1.65 }}>
        {nav.peaks.filter(p => p.cycle !== '2024').map(p => `⭐ ${p.cycle} 사이클 정점: 반감기 후 ${p.peakMonth}개월 · ${p.peakMult}×`).join('  /  ')}
        <br />⚠️ <b style={{ color: '#cbd5e1' }}>표본이 3개뿐</b> — 통계가 아닌 역사적 참고입니다. 현물 ETF 시대엔 기관 자금이 반감기와 무관하게 움직여 &lsquo;사이클이 짧아지거나 사라진다&rsquo;는 반론도 유력합니다.
        과거 각본은 미래를 보장하지 않으며, 이 도구는 매수 신호가 아니라 <b style={{ color: '#cbd5e1' }}>위치 관측</b>용입니다(코인 비중 ≤5% 가드 유지).
      </div>
    </div>
  )
}
