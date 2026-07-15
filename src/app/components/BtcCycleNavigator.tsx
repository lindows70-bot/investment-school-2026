'use client'
// 🔄 비트코인 4년 사이클 내비게이터 — 원본 포스터 방식: '침체기 시작' 정렬 + 4국면 색 밴드(침체→준비→제1상승→제2상승)
// 사이클 4개(2014·2018·2022·2026 시작) 오버레이(시작가=100·로그축). 표본 4개 = 통계 아닌 역사적 참고(정직 캐비엇).
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine, ReferenceArea } from 'recharts'
import type { CycleNav } from '@/app/api/coin-lab/route'
import { TK } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
// 원본 포스터 순서·색: 침체(파랑) → 상승준비(보라) → 제1상승(초록) → 제2상승(노랑)
const BANDS = [
  { from: 0, to: 12, name: '침체기 (Bear)', short: '침체기', color: TK.blue400, years: '2014 · 2018 · 2022 · 2026', desc: '고점 후 깊은 조정 — 과거 −70%대 드로다운' },
  { from: 12, to: 24, name: '상승 준비기 (Pre-Bull)', short: '준비기 · 승부구간', color: TK.violet400, years: '2015 · 2019 · 2023 · 2027', desc: '바닥 다지기·축적 — 원본 포스터의 "승부구간"' },
  { from: 24, to: 36, name: '제1 상승기 (1st Bull)', short: '제1 상승기', color: TK.green400, years: '2016 · 2020 · 2024 · 2028', desc: '반감기 해 — 공급 충격 반영 시작' },
  { from: 36, to: 48, name: '제2 상승기 (2nd Bull)', short: '제2 상승기', color: TK.amber400, years: '2017 · 2021 · 2025 · 2029', desc: '과거 고점은 모두 이 구간' },
]
const LINES = [
  { key: 'c2014', name: '2014~17 사이클', color: TK.sub, dash: '5 3', w: 1.2 },
  { key: 'c2018', name: '2018~21 사이클', color: TK.blue400, dash: '5 3', w: 1.2 },
  { key: 'c2022', name: '2022~25 사이클', color: TK.teal400, dash: '5 3', w: 1.4 },
  { key: 'c2026', name: '2026~ (현재)', color: TK.slate100, dash: undefined, w: 2.6 },
]

export default function BtcCycleNavigator({ nav }: { nav: CycleNav }) {
  // 국면 판정 = 차트 밴드와 동일 기준(침체 연도 1/1 이후 개월 ÷ 12) — 판정과 그림이 항상 일치(제2원칙)
  const bandIdx = Math.min(3, Math.floor(nav.mNow / 12))
  const cur = BANDS[bandIdx]
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🔄 4년 사이클 내비게이터 — 과거 각본 위의 현재 위치</span>
        <span style={{ color: TK.sub, fontSize: 11 }}>침체 연도(2026) 시작 후 {nav.mNow}개월 · 4차 반감기 후 {nav.daysSince}일 · 다음 반감기(예상) D-{nav.nextDDay}</span>
      </div>

      {/* 4국면 필 — 원본 순서(침체→준비→1상승→2상승), 현재 국면 하이라이트 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 7, margin: '10px 0 12px' }}>
        {BANDS.map((p, i) => {
          const here = i === bandIdx
          return (
            <div key={p.name} style={{ position: 'relative', background: here ? `${p.color}14` : TK.bg3, border: `1px solid ${here ? p.color : BORDER}`, borderRadius: 9, padding: '8px 11px' }}>
              {here && <span style={{ position: 'absolute', top: -9, right: 8, background: p.color, color: TK.bg1, fontSize: 9.5, fontWeight: 900, borderRadius: 6, padding: '1px 7px' }}>📍 지금 여기</span>}
              <div style={{ color: p.color, fontWeight: 800, fontSize: 11.5 }}>{i + 1}. {p.name}</div>
              <div style={{ color: TK.sub, fontSize: 10, marginTop: 2 }}>{p.years}</div>
              <div style={{ color: TK.sub5, fontSize: 10, marginTop: 3, lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          )
        })}
      </div>

      <div style={{ background: `${cur.color}10`, border: `1px solid ${cur.color}44`, borderRadius: 9, padding: '8px 12px', marginBottom: 12, fontSize: 11.5, lineHeight: 1.6 }}>
        <b style={{ color: cur.color }}>📍 지금은 {cur.name} {nav.mNow}개월차</b>
        <span style={{ color: TK.sub5 }}> — 과거 3번의 사이클에서 이 자리는 {cur.desc.split(' — ')[0]} 구간이었습니다. 각본이 반복된다는 보장은 없지만, 지금의 하락을 &lsquo;공포&rsquo;가 아니라 &lsquo;사이클의 자리&rsquo;로 읽는 훈련이 목적입니다.</span>
      </div>

      {/* 사이클 오버레이 — 침체기 시작=100 정규화·로그축 + 원본식 4색 국면 밴드 */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={nav.overlay} margin={{ top: 20, right: 14, left: 6, bottom: 0 }}>
          {BANDS.map((b, i) => (
            // 침체기(i=0) 라벨은 왼쪽 정렬 — 밴드 중앙(≈6개월)이 '◀ 현재' 세로선(6.5개월)과 겹쳐 가려지는 문제 회피
            <ReferenceArea key={b.short} x1={b.from} x2={b.to} fill={b.color} fillOpacity={0.18} stroke={b.color} strokeOpacity={0.35} strokeDasharray="3 3"
              label={{ value: b.short, position: i === 0 ? 'insideTopLeft' : 'insideTop', fill: b.color, fontSize: 11.5, fontWeight: 900 }} />
          ))}
          <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
          <XAxis dataKey="m" type="number" domain={[0, 48]} ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
            tick={{ fill: TK.sub, fontSize: 10.5 }} tickFormatter={v => `${v}개월`} />
          <YAxis scale="log" domain={['auto', 'auto']} tick={{ fill: TK.sub, fontSize: 10.5 }} width={48}
            tickFormatter={v => `${((v as number) / 100).toFixed((v as number) < 300 ? 1 : 0)}×`} />
          <Tooltip
            contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
            labelFormatter={v => `침체기 시작 후 ${v}개월`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [`${((v as number) / 100).toFixed(2)}× (침체기 시작가 대비)`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine x={nav.mNow} stroke={TK.slate100} strokeDasharray="5 3"
            label={{ value: '◀ 현재', position: 'insideTopRight', fill: TK.slate100, fontSize: 10 }} />
          {LINES.map(l => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
              stroke={l.color} strokeWidth={l.w} strokeDasharray={l.dash} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 6, lineHeight: 1.65 }}>
        {nav.peaks.filter(p => !p.cycle.startsWith('2026')).map(p => `⭐ ${p.cycle} 사이클 정점: 침체 연도 시작 후 ${p.peakMonth}개월 · ${p.peakMult}×`).join('  /  ')}
        <span> · ⓘ 2014 사이클 선은 데이터가 2014-09부터(야후 한계) — 앞부분 일부 공백</span>
        <br />⚠️ <b style={{ color: TK.slate300 }}>표본이 4개뿐</b>(현재 사이클은 막 시작) — 통계가 아닌 역사적 참고입니다. 현물 ETF 시대엔 기관 자금이 반감기와 무관하게 움직여 &lsquo;사이클이 짧아지거나 사라진다&rsquo;는 반론도 유력합니다.
        과거 각본은 미래를 보장하지 않으며, 이 도구는 매수 신호가 아니라 <b style={{ color: TK.slate300 }}>위치 관측</b>용입니다(코인 비중 ≤5% 가드 유지).
      </div>
    </div>
  )
}
