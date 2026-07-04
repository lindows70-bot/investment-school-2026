'use client'
// 🚨 글로벌 위기 감지 레이더 — 시장 버블 4대 지표 실데이터 + 종합 Alert 신호등
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot } from 'recharts'
import type { CrisisRadarResult, CrisisMetric, Signal } from '@/app/api/crisis-radar/route'

const CARD = '#12151c', BORDER = '#252a36'
const SIG: Record<Signal, { dot: string; color: string; ko: string; bg: string }> = {
  safe: { dot: '🟢', color: '#4ade80', ko: '안전', bg: 'rgba(74,222,128,0.08)' },
  caution: { dot: '🟡', color: '#fbbf24', ko: '주의', bg: 'rgba(251,191,36,0.08)' },
  danger: { dot: '🔴', color: '#f87171', ko: '위험', bg: 'rgba(248,113,113,0.09)' },
}

export default function CrisisRadar() {
  const [d, setD] = useState<CrisisRadarResult | null>(null)
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState<string | null>('cape')

  useEffect(() => {
    fetch('/api/crisis-radar', { cache: 'no-store' }).then(r => r.json()).then(x => (x?.metrics ? setD(x) : setErr(true))).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 종합 Alert 배너 */}
      {d && (
        <div style={{ background: SIG[d.alertLevel].bg, border: `1px solid ${SIG[d.alertLevel].color}55`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>{SIG[d.alertLevel].dot}</span>
            <span style={{ color: SIG[d.alertLevel].color, fontWeight: 900, fontSize: 18 }}>글로벌 위기 감지 레이더 — {SIG[d.alertLevel].ko}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {d.metrics.map(m => <span key={m.key} title={m.label} style={{ width: 12, height: 12, borderRadius: '50%', background: SIG[m.signal].color }} />)}
            </span>
          </div>
          <div style={{ color: '#cdd6e3', fontSize: 12.5, lineHeight: 1.7, marginTop: 8 }}>{d.summary}</div>
        </div>
      )}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>버블 지표 4종을 실데이터로 계산 중입니다…</div>}
      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}

      {/* 4지표 반원 게이지 대시보드 */}
      {d && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🎛️ 4대 지표 게이지 — 바늘이 위험(빨강)에 가까울수록 경고</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {d.metrics.map(m => <Gauge key={m.key} m={m} />)}
          </div>
        </div>
      )}

      {/* 버핏지표 역사 라인차트 */}
      {d && d.buffettSeries.length > 8 && <BuffettChart series={d.buffettSeries} current={d.metrics.find(m => m.key === 'buffett')?.value ?? null} />}

      {d && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14, marginBottom: 3 }}>📊 핵심 밸류에이션 지표 4종 — 한눈에 비교</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 10 }}>각 지표는 실데이터로 계산(Shiller·FRED). 클릭하면 과거 위기 대비·해석을 펼칩니다.</div>

          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '0 8px 6px', color: '#7f93a8', fontSize: 10, fontWeight: 700, borderBottom: `1px solid ${BORDER}` }}>
            <span>지표명</span><span>측정 대상</span><span style={{ textAlign: 'right' }}>역사평균</span><span style={{ textAlign: 'right' }}>현재</span><span style={{ textAlign: 'center' }}>경고</span>
          </div>
          {d.metrics.map(m => {
            const s = SIG[m.signal], isOpen = open === m.key
            return (
              <div key={m.key}>
                <div onClick={() => setOpen(isOpen ? null : m.key)} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '9px 8px', borderTop: `1px solid ${BORDER}`, cursor: 'pointer', background: isOpen ? '#0f1117' : 'transparent', alignItems: 'center' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>{m.label}</span>
                  <span style={{ color: '#9aa7b5', fontSize: 10.5 }}>{m.measure}</span>
                  <span style={{ textAlign: 'right', color: '#9aa7b5', fontSize: 11.5, fontFamily: 'monospace' }}>{m.mean}{m.unit}</span>
                  <span style={{ textAlign: 'right', color: s.color, fontSize: 13.5, fontWeight: 800, fontFamily: 'monospace' }}>{m.value != null ? `${m.value}${m.unit}` : '—'}</span>
                  <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: s.color }}>{s.dot} {s.ko}</span>
                </div>
                {isOpen && (
                  <div style={{ background: '#0f1117', borderLeft: `3px solid ${s.color}`, padding: '9px 14px', margin: '0 8px 4px' }}>
                    <div style={{ color: '#cdd6e3', fontSize: 11.5, lineHeight: 1.6 }}>{m.note}</div>
                    <div style={{ color: '#7f93a8', fontSize: 10.5, marginTop: 4 }}>적정 기준: {m.norm}</div>
                    {m.history && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {m.history.map(h => (
                          <div key={h.label} style={{ background: '#161b25', borderRadius: 7, padding: '5px 11px', border: `1px solid ${BORDER}` }}>
                            <div style={{ color: '#7f93a8', fontSize: 9.5 }}>{h.label}</div>
                            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{h.value}{m.unit}</div>
                          </div>
                        ))}
                        {m.value != null && (
                          <div style={{ background: `${s.color}18`, borderRadius: 7, padding: '5px 11px', border: `1px solid ${s.color}55` }}>
                            <div style={{ color: s.color, fontSize: 9.5, fontWeight: 700 }}>현재</div>
                            <div style={{ color: s.color, fontWeight: 900, fontSize: 13, fontFamily: 'monospace' }}>{m.value}{m.unit}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 10, lineHeight: 1.6 }}>
            ⚠️ 데이터: Shiller CAPE·S&P PER(multpl.com)·버핏지표(FRED 시총÷GDP, 과거값도 실측)·10년물(FRED). 임계 밴드는 공개 방법론의 교과서 기준(교육용). <b style={{ color: '#cdd6e3' }}>밸류에이션 지표는 &lsquo;언제&rsquo; 떨어질지는 못 맞힙니다</b> — 고평가에서 몇 년 더 오르기도 합니다. 폭락 예언이 아니라 위험 관리·기대수익 조정 신호로 쓰세요. 레이 달리오 버블 지표·매크로 날씨와 함께 보면 좋습니다.
          </div>
        </div>
      )}
    </div>
  )
}

// 반원 게이지 — 안전/주의/위험 색 아크 + 현재값 바늘
function Gauge({ m }: { m: CrisisMetric }) {
  const s = SIG[m.signal]
  const { min, max, t1, t2, invert } = m.gauge
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  const frac = (v: number) => (clamp(v) - min) / (max - min)          // 0~1
  const ang = (v: number) => Math.PI - frac(v) * Math.PI              // 180°(왼)~0°(오)
  const R = 62, cx = 80, cyy = 78
  const pt = (v: number, r = R) => `${cx + r * Math.cos(ang(v))} ${cyy - r * Math.sin(ang(v))}`
  const arc = (from: number, to: number, color: string) => {
    const large = 0
    return <path d={`M ${pt(from)} A ${R} ${R} 0 ${large} 1 ${pt(to)}`} fill="none" stroke={color} strokeWidth="11" strokeLinecap="butt" />
  }
  // 색 구간: invert면 낮은 값이 위험(왼쪽 아래로)
  const segs = invert
    ? [[min, t2, '#f87171'], [t2, t1, '#fbbf24'], [t1, max, '#4ade80']]   // 낮을수록 위험
    : [[min, t1, '#4ade80'], [t1, t2, '#fbbf24'], [t2, max, '#f87171']]
  const nv = m.value ?? min
  return (
    <div style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${BORDER}`, padding: '8px 8px 6px', textAlign: 'center' }}>
      <svg viewBox="0 0 160 92" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {segs.map(([a, b, c], i) => <g key={i}>{arc(a as number, b as number, c as string)}</g>)}
        {/* 바늘 */}
        <line x1={cx} y1={cyy} x2={cx + (R - 6) * Math.cos(ang(nv))} y2={cyy - (R - 6) * Math.sin(ang(nv))} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cyy} r="4" fill="#fff" />
        <text x={cx} y={cyy - 20} fill={s.color} fontSize="19" fontWeight="900" textAnchor="middle">{m.value != null ? m.value : '—'}</text>
        <text x={cx} y={cyy - 6} fill="#7f93a8" fontSize="8.5" textAnchor="middle">{m.unit}</text>
      </svg>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 11.5, marginTop: 2 }}>{m.label}</div>
      <div style={{ color: s.color, fontSize: 10.5, fontWeight: 800 }}>{s.dot} {s.ko}</div>
    </div>
  )
}

// 버핏지표 1995~현재 실측 라인 + 위기 마킹 + 적정/위험 기준선
function BuffettChart({ series, current }: { series: { date: string; v: number }[]; current: number | null }) {
  const mark = (ym: string) => { const f = series.filter(s => s.date <= ym); return f.length ? f[f.length - 1] : null }
  const m2000 = mark('2000-03'), m2008 = mark('2007-09'), m2020 = mark('2020-03')
  const last = series[series.length - 1]
  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📈 버핏 지표 30년 추이 — 지금이 역대 최고인가?</div>
      <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 8 }}>
        시가총액÷GDP (FRED 실측·분기). <span style={{ color: '#f87171' }}>현재 {current}%</span>가 닷컴·금융위기·팬데믹 고점을 모두 넘었습니다. <span style={{ color: '#4ade80' }}>초록 100%=적정</span> · <span style={{ color: '#fbbf24' }}>노랑 150%=경고</span>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 9 }} minTickGap={50} axisLine={{ stroke: BORDER }} tickLine={false} tickFormatter={(v: string) => v.slice(0, 4)} />
            <YAxis tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={false} tickLine={false} width={38} tickFormatter={(v: number) => `${v}%`} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${v}%`, '버핏지표']} />
            <ReferenceLine y={100} stroke="#4ade80" strokeDasharray="4 4" label={{ value: '적정 100%', fill: '#4ade80', fontSize: 9, position: 'insideBottomRight' }} />
            <ReferenceLine y={150} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: '경고 150%', fill: '#fbbf24', fontSize: 9, position: 'insideTopRight' }} />
            <Line type="monotone" dataKey="v" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
            {m2000 && <ReferenceDot x={m2000.date} y={m2000.v} r={4} fill="#f87171" stroke="#fff" strokeWidth={1} label={{ value: '2000', fill: '#f87171', fontSize: 9, position: 'top' }} />}
            {m2008 && <ReferenceDot x={m2008.date} y={m2008.v} r={4} fill="#fb923c" stroke="#fff" strokeWidth={1} label={{ value: '2008', fill: '#fb923c', fontSize: 9, position: 'top' }} />}
            {m2020 && <ReferenceDot x={m2020.date} y={m2020.v} r={4} fill="#a855f7" stroke="#fff" strokeWidth={1} label={{ value: '2020', fill: '#a855f7', fontSize: 9, position: 'bottom' }} />}
            {last && <ReferenceDot x={last.date} y={last.v} r={5} fill="#f87171" stroke="#fff" strokeWidth={1.5} label={{ value: `현재 ${last.v}%`, fill: '#f87171', fontSize: 10, fontWeight: 700, position: 'left' }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
