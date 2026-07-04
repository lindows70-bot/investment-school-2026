'use client'
// 🚨 글로벌 위기 감지 레이더 — 4대 버블 지표 실데이터. Alert 배너 + 게이지 개요 + 지표별 상세 카드(역사차트+쉬운 설명)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot } from 'recharts'
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

      {/* 게이지 개요 */}
      {d && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🎛️ 한눈에 — 바늘이 빨강(위험)에 가까울수록 경고</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {d.metrics.map(m => <Gauge key={m.key} m={m} />)}
          </div>
        </div>
      )}

      {/* 종합 평가 표 */}
      {d && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>📋 종합 평가 — 4대 지표 한 표로</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 560 }}>
              <thead>
                <tr style={{ color: '#7f93a8', fontSize: 10, textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>지표명</th><th style={{ padding: '4px 8px' }}>측정 대상</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>역사적 평균</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>현재 수준</th>
                  <th style={{ padding: '4px 8px' }}>시장 경고 신호</th>
                </tr>
              </thead>
              <tbody>
                {d.metrics.map(m => {
                  const s = SIG[m.signal]
                  return (
                    <tr key={m.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 700 }}>{m.icon} {m.label}</td>
                      <td style={{ padding: '8px', color: '#9aa7b5', fontSize: 10.5 }}>{m.measure}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#9aa7b5', fontFamily: 'monospace' }}>{m.mean}{m.unit}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: s.color, fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{m.value != null ? `${m.value}${m.unit}` : '—'}</td>
                      <td style={{ padding: '8px', color: s.color, fontWeight: 700, fontSize: 11 }}>{s.dot} {m.alertText}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ color: '#7f93a8', fontSize: 9.5, marginTop: 6 }}>💡 선행 PER(뉴스 ~20배)은 미래 예상이익 기준 &lsquo;주의&rsquo;, 우리 후행 PER(32배)은 확정이익 기준 &lsquo;위험&rsquo; — 둘 다 맞고, 우리가 더 보수적(선행은 유료 데이터).</div>
        </div>
      )}

      {/* 지표별 상세 카드 */}
      {d && d.metrics.map(m => <MetricCard key={m.key} m={m} />)}

      {d && (
        <div style={{ color: '#7f93a8', fontSize: 10, lineHeight: 1.6, padding: '0 4px' }}>
          ⚠️ 데이터: Shiller CAPE·S&P PER·어닝일드(multpl.com)·버핏지표(FRED 시총÷GDP, 과거값도 실측)·국채금리(FRED). 임계 밴드는 공개 방법론의 교과서 기준(교육용). <b style={{ color: '#cdd6e3' }}>밸류에이션 지표는 &lsquo;언제&rsquo; 떨어질지는 못 맞힙니다</b> — 고평가에서 몇 년 더 오르기도 합니다. 폭락 예언이 아니라 위험 관리·기대수익 조정 신호로 쓰세요. 레이 달리오 버블 지표·매크로 날씨와 함께 보면 좋습니다.
        </div>
      )}
    </div>
  )
}

// 지표별 상세 카드 — 헤더(값·신호) + 역사 미니차트 + 쉬운 설명 + 과거위기 칩
function MetricCard({ m }: { m: CrisisMetric }) {
  const s = SIG[m.signal]
  const dangerY = m.gauge.invert ? m.gauge.t2 : m.gauge.t2   // 위험 임계선
  const meanY = m.mean
  const last = m.series.length ? m.series[m.series.length - 1] : null
  const mk = (ym: string) => { const f = m.series.filter(x => x.date <= ym); return f.length ? f[f.length - 1] : null }
  const crises = m.key === 'erp' ? [] : [['2000-03', '2000', '#f87171'], ['2007-09', '2008', '#fb923c'], ['2020-03', '2020', '#a855f7']] as const
  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17 }}>{m.icon}</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>{m.label}</span>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>{m.measure}</span>
        <span style={{ marginLeft: 'auto', color: s.color, fontWeight: 900, fontSize: 20, fontFamily: 'monospace' }}>{m.value != null ? `${m.value}${m.unit}` : '—'}</span>
        <span style={{ background: `${s.color}20`, color: s.color, borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>{s.dot} {s.ko}</span>
      </div>

      {/* 역사 미니차트 */}
      {m.series.length > 8 && (
        <div style={{ height: 150, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={m.series} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.28" /><stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 8.5 }} minTickGap={55} axisLine={{ stroke: BORDER }} tickLine={false} tickFormatter={(v: string) => v.slice(0, 4)} />
              <YAxis tick={{ fill: '#7f93a8', fontSize: 8.5 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v: number) => `${v}${m.unit === '%' ? '%' : ''}`} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${v}${m.unit}`, m.label]} />
              <ReferenceLine y={meanY} stroke="#4ade80" strokeDasharray="4 4" label={{ value: `평균 ${meanY}`, fill: '#4ade80', fontSize: 8.5, position: 'insideBottomLeft' }} />
              <ReferenceLine y={dangerY} stroke="#f87171" strokeDasharray="4 4" label={{ value: `위험 ${dangerY}`, fill: '#f87171', fontSize: 8.5, position: 'insideTopLeft' }} />
              <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={2} fill={`url(#g-${m.key})`} isAnimationActive={false} />
              {crises.map(([ym, lb, c]) => { const p = mk(ym); return p ? <ReferenceDot key={ym} x={p.date} y={p.v} r={3.5} fill={c} stroke="#fff" strokeWidth={1} label={{ value: lb, fill: c, fontSize: 8.5, position: 'top' }} /> : null })}
              {last && <ReferenceDot x={last.date} y={last.v} r={4.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 쉬운 설명 */}
      <div style={{ background: '#0f1117', borderRadius: 9, borderLeft: `3px solid ${s.color}`, padding: '9px 12px', marginTop: 8 }}>
        <div style={{ color: s.color, fontWeight: 800, fontSize: 11.5, marginBottom: 3 }}>🎓 쉽게 말하면</div>
        <div style={{ color: '#cdd6e3', fontSize: 11.5, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: mdBold(m.explain) }} />
      </div>

      {/* 현재 신호 해석 + 과거위기 칩 */}
      <div style={{ color: '#9aa7b5', fontSize: 11, lineHeight: 1.6, marginTop: 7 }}>{m.note}</div>
      {m.history && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
          {m.history.map(h => (
            <div key={h.label} style={{ background: '#161b25', borderRadius: 7, padding: '4px 10px', border: `1px solid ${BORDER}` }}>
              <span style={{ color: '#7f93a8', fontSize: 9 }}>{h.label} </span>
              <span style={{ color: '#cdd6e3', fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{h.value}{m.unit}</span>
            </div>
          ))}
          {m.value != null && (
            <div style={{ background: `${s.color}18`, borderRadius: 7, padding: '4px 10px', border: `1px solid ${s.color}55` }}>
              <span style={{ color: s.color, fontSize: 9, fontWeight: 700 }}>현재 </span>
              <span style={{ color: s.color, fontWeight: 900, fontSize: 12, fontFamily: 'monospace' }}>{m.value}{m.unit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// **굵게** → <b> (설명 강조)
function mdBold(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b style="color:#e2e8f0">$1</b>')
}

// 반원 게이지
function Gauge({ m }: { m: CrisisMetric }) {
  const s = SIG[m.signal]
  const { min, max, t1, t2, invert } = m.gauge
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  const ang = (v: number) => Math.PI - ((clamp(v) - min) / (max - min)) * Math.PI
  const R = 60, cx = 80, cyy = 76
  const pt = (v: number, r = R) => `${cx + r * Math.cos(ang(v))} ${cyy - r * Math.sin(ang(v))}`
  const arc = (from: number, to: number, color: string) => <path d={`M ${pt(from)} A ${R} ${R} 0 0 1 ${pt(to)}`} fill="none" stroke={color} strokeWidth="11" />
  const segs = invert
    ? [[min, t2, '#f87171'], [t2, t1, '#fbbf24'], [t1, max, '#4ade80']]
    : [[min, t1, '#4ade80'], [t1, t2, '#fbbf24'], [t2, max, '#f87171']]
  const nv = m.value ?? min
  return (
    <div style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${BORDER}`, padding: '8px 8px 6px', textAlign: 'center' }}>
      <svg viewBox="0 0 160 90" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {segs.map(([a, b, c], i) => <g key={i}>{arc(a as number, b as number, c as string)}</g>)}
        <line x1={cx} y1={cyy} x2={cx + (R - 6) * Math.cos(ang(nv))} y2={cyy - (R - 6) * Math.sin(ang(nv))} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cyy} r="4" fill="#fff" />
        <text x={cx} y={cyy - 20} fill={s.color} fontSize="18" fontWeight="900" textAnchor="middle">{m.value != null ? m.value : '—'}</text>
        <text x={cx} y={cyy - 7} fill="#7f93a8" fontSize="8" textAnchor="middle">{m.unit}</text>
      </svg>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 11, marginTop: 2 }}>{m.icon} {m.label}</div>
      <div style={{ color: s.color, fontSize: 10.5, fontWeight: 800 }}>{s.dot} {s.ko}</div>
    </div>
  )
}
