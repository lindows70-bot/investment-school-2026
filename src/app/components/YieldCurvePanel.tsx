'use client'
// 📐 수익률곡선 패널 — 만기 곡선(11종·3개월 전 대비) + 두 스프레드 추적 + 역전 이력 대조
//   사용자 요구 ②단기-중기-장기 비교 ③3M/10Y·2Y/10Y 역전 트래킹.
//   ⛔ 타이밍 도구가 아니다 — 리드타임 편차와 2022년 오경보를 화면에 상설 표기한다.
import { useEffect, useState } from 'react'
import type { YieldCurveResult } from '@/lib/yieldCurve'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = TK.bg7
const ALERT_META: Record<YieldCurveResult['alert'], { c: string; bg: string; label: string }> = {
  none: { c: TK.green400, bg: `${TK.green400}12`, label: '정상' },
  watch: { c: TK.amber400, bg: `${TK.amber400}12`, label: '평탄 주의' },
  brief: { c: TK.orange400, bg: `${TK.orange400}14`, label: '짧은 역전' },
  red: { c: TK.red400, bg: `${TK.red400}16`, label: '지속 역전' },
}

export default function YieldCurvePanel() {
  const [d, setD] = useState<YieldCurveResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/yield-curve', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!alive) return; if (j?.curve?.length) { setD(j); setState('ok') } else setState('fail') })
      .catch(() => { if (alive) setState('fail') })
    return () => { alive = false }
  }, [])

  const box = { background: CARD, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 4 }}>
      <b style={{ fontSize: FS.lg, color: TK.slate100 }}>📐 수익률곡선 — 만기별 금리와 장단기 역전</b>
      <span style={{ fontSize: FS.micro, color: TK.sub3 }}>미 국채 11개 만기 · FRED</span>
    </div>
  )
  if (state === 'loading') return <div style={box}>{head}<div style={{ height: 200, background: TK.bg5, borderRadius: RAD.sm, animation: 'pulse 1.5s infinite' }} /></div>
  if (state === 'fail' || !d) return <div style={box}>{head}<div style={{ fontSize: FS.tiny, color: TK.sub3 }}>곡선 데이터를 불러오지 못했습니다 — 새로고침 해보세요.</div></div>

  const A = ALERT_META[d.alert]
  // ── 곡선 SVG (x = 만기 로그 스케일, y = 금리)
  const W = 900, H = 210, PL = 44, PR = 16, PT = 16, PB = 26
  const all = d.curve.concat(d.curvePrev ?? [])
  const lo = Math.min(...all.map(c => c.v)), hi = Math.max(...all.map(c => c.v))
  const pad = Math.max(0.15, (hi - lo) * 0.15)
  const yMin = lo - pad, yMax = hi + pad
  const lx = (yr: number) => Math.log(yr)
  const x0 = lx(1 / 12), x1 = lx(30)
  const X = (yr: number) => PL + ((lx(yr) - x0) / (x1 - x0)) * (W - PL - PR)
  const Y = (v: number) => PT + (1 - (v - yMin) / (yMax - yMin)) * (H - PT - PB)
  const path = (pts: { years: number; v: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.years).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')

  return (
    <div style={box}>
      {head}
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: SP.md }}>
        만기가 길어질수록 금리가 오르는 게 정상입니다. 이 선이 <b style={{ color: TK.sub2 }}>평평해지거나 뒤집히면</b> 시장이 경기 둔화를 보고 있다는 뜻입니다.
      </div>

      {/* 경보 헤드라인 */}
      <div style={{ background: A.bg, border: `1px solid ${A.c}44`, borderRadius: RAD.sm, padding: '9px 12px', marginBottom: SP.md }}>
        <div style={{ fontSize: FS.body, fontWeight: 800, color: A.c, marginBottom: 3 }}>{d.alertHeadline}</div>
        <div style={{ fontSize: FS.micro, color: TK.sub3, lineHeight: 1.65 }}>{d.alertDetail}</div>
      </div>

      {/* 스프레드 2종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: SP.sm, marginBottom: SP.md }}>
        {d.spreads.map(s => {
          const neg = s.value != null && s.value < 0
          const c = neg ? TK.red400 : s.value != null && s.value < 0.25 ? TK.amber400 : TK.green400
          return (
            <div key={s.key} style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '9px 12px', borderLeft: `3px solid ${c}` }}>
              <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 2 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: FS.xl, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>
                  {s.value != null ? `${s.value >= 0 ? '+' : ''}${s.value.toFixed(2)}%p` : '—'}
                </span>
                {neg && <span style={{ fontSize: FS.micro, color: TK.red400 }}>역전 {s.invertedDays}거래일째 · 최심 {s.minPp?.toFixed(2)}%p</span>}
                {!neg && <span style={{ fontSize: FS.micro, color: TK.sub4 }}>1개월 {s.chg1m != null ? (s.chg1m >= 0 ? '+' : '') + s.chg1m.toFixed(2) : '—'} · 3개월 {s.chg3m != null ? (s.chg3m >= 0 ? '+' : '') + s.chg3m.toFixed(2) : '—'}</span>}
              </div>
              <div style={{ fontSize: FS.micro, color: TK.sub4, marginTop: 3, lineHeight: 1.5 }}>{s.meaning}</div>
            </div>
          )
        })}
      </div>

      {/* 곡선 차트 */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = yMin + (yMax - yMin) * (1 - f)
          return (
            <g key={f}>
              <line x1={PL} y1={PT + f * (H - PT - PB)} x2={W - PR} y2={PT + f * (H - PT - PB)} stroke={TK.line1} strokeWidth="0.6" />
              <text x={PL - 5} y={PT + f * (H - PT - PB) + 3} fill={TK.sub4} fontSize="8.5" textAnchor="end">{v.toFixed(1)}%</text>
            </g>
          )
        })}
        {d.curvePrev && <path d={path(d.curvePrev)} fill="none" stroke={TK.sub4} strokeWidth="1.4" strokeDasharray="4 3" />}
        <path d={path(d.curve)} fill="none" stroke={TK.cyan400} strokeWidth="2.2" />
        {d.curve.map(p => (
          <g key={p.years}>
            <circle cx={X(p.years)} cy={Y(p.v)} r="3" fill={TK.cyan400} />
            <text x={X(p.years)} y={H - 14} fill={TK.sub4} fontSize="8.5" textAnchor="middle">{p.label}</text>
            <text x={X(p.years)} y={Y(p.v) - 7} fill={TK.slate200} fontSize="8.5" textAnchor="middle" fontFamily="monospace">{p.v.toFixed(2)}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: SP.md, fontSize: FS.micro, color: TK.sub4, marginTop: 2, marginBottom: SP.md, flexWrap: 'wrap' }}>
        <span><span style={{ color: TK.cyan400 }}>—</span> 오늘({d.curveDate})</span>
        {d.curvePrevDate && <span><span style={{ color: TK.sub4 }}>┄</span> 3개월 전({d.curvePrevDate})</span>}
        <span style={{ marginLeft: 'auto' }}>가로축은 만기(로그 간격)</span>
      </div>

      {/* 모양 판정 */}
      <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.7, background: TK.bg0, borderRadius: RAD.sm, padding: '9px 12px', marginBottom: SP.md }}>
        🔎 <b style={{ color: TK.slate200 }}>지금 곡선 모양</b> — {d.shapeNote}
      </div>

      {/* 역전 이력 대조 */}
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 5 }}>
        <b style={{ color: TK.slate200, fontSize: FS.tiny }}>📚 과거 지속 역전(10거래일 이상)과 그 뒤 침체</b>
        {' '}— 표본 {d.history.length}건 · 리드타임 중앙값 {d.leadSummary.medianMonths ?? '—'}개월
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: FS.micro }}>
          <thead>
            <tr style={{ color: TK.sub4 }}>
              {['역전 기간', '지속', '최심', '뒤이은 침체', '리드타임'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 6px', borderBottom: `1px solid ${TK.line1}`, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.history.slice().reverse().map(h => (
              <tr key={h.from} style={{ color: TK.sub2 }}>
                <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{h.from} ~ {h.to}{h.ongoing && <b style={{ color: TK.red400 }}> (진행중)</b>}</td>
                <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{h.days}일</td>
                <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: h.minPp <= -0.5 ? TK.red400 : TK.sub2 }}>{h.minPp.toFixed(2)}%p</td>
                <td style={{ padding: '4px 6px', color: h.recessionStart ? TK.amber400 : TK.green400 }}>
                  {h.recessionStart ?? '오지 않음'}
                </td>
                <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{h.leadMonths != null ? `${h.leadMonths}개월` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub4, marginTop: SP.sm, lineHeight: 1.7 }}>
        ⚠️ <b style={{ color: TK.sub2 }}>역전은 방향 참고이지 타이밍 도구가 아닙니다.</b> 리드타임이 {d.leadSummary.minMonths}~{d.leadSummary.maxMonths}개월로 편차가 크고,
        {' '}<b style={{ color: TK.amber400 }}>2022~24년 역전은 537일·최심 −1.89%p로 역사상 손꼽히게 깊고 길었는데도 침체가 오지 않았습니다.</b>
        {' '}침체 판정(NBER)은 1년 가까이 지나서 발표되므로 실시간 경보로는 쓸 수 없어, 실시간 대용으로 삼(Sahm) 지표를 함께 봅니다
        {d.sahm && <> — 현재 <b style={{ color: d.sahm.triggered ? TK.red400 : TK.sub2 }}>{d.sahm.v.toFixed(2)}</b>({d.sahm.date}, 발동선 0.50) {d.sahm.triggered ? '⚠️ 발동' : '미발동'}</>}.
      </div>
    </div>
  )
}
