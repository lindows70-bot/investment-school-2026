'use client'
// ⚡ 주간 매매 펄스 — 부동산원 주간 아파트 매매가격지수(19지역). 월별 벌집보다 빠른 전환점 감지(1주·4주·13주 변화율 랭킹 + 추이 차트).
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TK } from '@/lib/theme'
import type { ReWeeklyApi, WeeklyRegion } from '@/app/api/re-weekly/route'

const CARD = TK.card, BORDER = TK.border

const fmtPct = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
const colOf = (v: number | null) => v == null ? TK.sub2 : v > 0.02 ? TK.red400 : v < -0.02 ? TK.blue400 : TK.sub

function Spark({ v }: { v: number[] }) {
  if (v.length < 2) return null
  const w = 64, h = 20
  const mn = Math.min(...v), mx = Math.max(...v)
  const span = mx - mn || 1
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * w},${h - ((x - mn) / span) * (h - 3) - 1.5}`).join(' ')
  const up = v[v.length - 1] >= v[0]
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={up ? TK.red400 : TK.blue400} strokeWidth={1.4} />
    </svg>
  )
}

export default function WeeklyPulse() {
  const [data, setData] = useState<ReWeeklyApi | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/re-weekly').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) { if (j?.regions) setData(j); else setErr(true) } })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  if (err) return null
  const up = data?.regions.filter(r => (r.w1 ?? 0) > 0.02) ?? []
  const down = data?.regions.filter(r => (r.w1 ?? 0) < -0.02) ?? []

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
        <b style={{ fontSize: 14, color: TK.slate100 }}>⚡ 주간 매매 펄스</b>
        <span style={{ fontSize: 10.5, color: TK.sub2 }}>
          부동산원 주간 아파트 매매가격지수 — 월별 벌집보다 빠른 전환점 신호{data ? ` · 기준주 ${data.asOfWeek}주차` : ''}
        </span>
      </div>

      {!data ? (
        <div style={{ color: TK.sub, fontSize: 12, padding: '18px 0' }}>⚡ 19개 지역 주간지수를 수집 중…</div>
      ) : (
        <>
          {/* 이번 주 요약 */}
          <div style={{ marginTop: 10, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 13px', fontSize: 11.5, color: TK.sub9, lineHeight: 1.6 }}>
            이번 주 상승 <b style={{ color: TK.red400 }}>{up.length}</b> · 하락 <b style={{ color: TK.blue400 }}>{down.length}</b> · 보합 {data.regions.length - up.length - down.length}
            {up.length > 0 && <> — 상승 상위 <b style={{ color: TK.slate200 }}>{up.slice(0, 3).map(r => r.name).join('·')}</b></>}
            {down.length > 0 && <> / 하락 상위 <b style={{ color: TK.slate200 }}>{down.slice(-3).reverse().map(r => r.name).join('·')}</b></>}
          </div>

          {/* 지역 랭킹 테이블 */}
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 520 }}>
              <thead>
                <tr style={{ color: TK.sub, fontSize: 10, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>지역</th>
                  <th style={{ padding: '4px 6px' }}>1주</th>
                  <th style={{ padding: '4px 6px' }}>4주</th>
                  <th style={{ padding: '4px 6px' }}>13주</th>
                  <th style={{ padding: '4px 6px', textAlign: 'center' }}>26주 흐름</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map((r: WeeklyRegion) => (
                  <tr key={r.name} style={{ borderTop: `1px solid ${BORDER}`, background: r.name === '전국' || r.name === '수도권' ? TK.bg3 : 'transparent' }}>
                    <td style={{ padding: '5px 6px', color: TK.slate200, fontWeight: 700 }}>{r.name}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: colOf(r.w1) }}>{fmtPct(r.w1)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: colOf(r.w4) }}>{fmtPct(r.w4)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: colOf(r.w13) }}>{fmtPct(r.w13)}</td>
                    <td style={{ padding: '5px 6px' }}><div style={{ display: 'flex', justifyContent: 'center' }}><Spark v={r.spark} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 전국·서울·수도권 추이 */}
          <div style={{ height: 220, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={data.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.max(1, Math.floor(data.series.length / 9))} />
                <YAxis tick={{ fill: TK.sub, fontSize: 10 }} width={44} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="전국" stroke={TK.slate200} strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="서울" stroke={TK.orange400} strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="수도권" stroke={TK.blue400} strokeWidth={1.6} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 교육 캐비엇 */}
          <div style={{ fontSize: 10.5, color: TK.sub, lineHeight: 1.65, marginTop: 8 }}>
            🎓 <b style={{ color: TK.slate300 }}>읽는 법</b> — 벌집순환(월별)이 국면을 말한다면, 주간지수는 <b style={{ color: TK.slate300 }}>전환의 첫 신호</b>를 먼저 보여줍니다
            (하락 지역의 주간 낙폭이 줄어들다 +로 돌아서는 주가 바닥 단서). 지수는 2026-06 재기준=100이라 절대 레벨의 과거 비교는 무의미 —
            <b style={{ color: TK.slate300 }}> 변화율로만</b> 읽으세요. 주간 ±0.1%도 연율로는 ±5%대의 큰 흐름. 표본조사 지수(실거래 아님) · 출처 한국부동산원 · 교육용 관측 도구.
          </div>
        </>
      )}
    </div>
  )
}
