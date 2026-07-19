'use client'
// 🌊 엘리어트 파동 교육 — ①이상적 개념도(정적 SVG, 교과서용) ②실제 차트 위 객관적 스윙(ZigZag) 오버레이
// ⚠️ 실제 파동 번호(1~5, A-B-C)는 분석가마다 다르게 세는 주관적 기법이라 이 앱은 단정하지 않는다.
// 아래 실차트의 번호는 '스윙(고점/저점) 순번'일 뿐 공식 엘리어트 카운트가 아님(제1원칙).
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts'
import type { ElliottEduResult } from '@/app/api/elliott-wave-edu/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg4, BORDER = TK.line3

// ── ① 이상적 개념도(정적 SVG) — 5파 상승(1-2-3-4-5) + 3파 조정(A-B-C) ──────────
function IdealWaveDiagram() {
  // 뷰박스 0..600 x 0..220. 임펄스 5파(상승 추세) + 조정 3파(하락)
  const pts: [number, number, string][] = [
    [20, 170, '0'], [110, 90, '1'], [160, 130, '2'], [280, 40, '3'],
    [330, 80, '4'], [420, 10, '5'], [480, 100, 'A'], [520, 60, 'B'], [580, 140, 'C'],
  ]
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  return (
    <svg viewBox="0 0 600 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1="10" y1="200" x2="595" y2="200" stroke="#3a4152" strokeWidth="1" />
      <path d={path} fill="none" stroke={TK.blue300} strokeWidth="2.5" />
      {/* 임펄스 구간(1~5) 음영 강조선 */}
      <path d={pts.slice(0, 6).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')} fill="none" stroke={TK.green400} strokeWidth="3.5" opacity="0.55" />
      {/* 조정 구간(A~C) 강조선 */}
      <path d={pts.slice(5).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')} fill="none" stroke={TK.red400} strokeWidth="3.5" opacity="0.55" />
      {pts.slice(1).map(([x, y, label], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill={i < 5 ? TK.green400 : TK.red400} />
          <text x={x} y={y - 10} fill={TK.slate200} fontSize="13" fontWeight="800" textAnchor="middle">{label}</text>
        </g>
      ))}
      <text x="165" y="215" fill={TK.green400} fontSize="11" fontWeight="700" textAnchor="middle">임펄스(추세) 5파: 1-2-3-4-5</text>
      <text x="530" y="215" fill={TK.red400} fontSize="11" fontWeight="700" textAnchor="middle">조정 3파: A-B-C</text>
    </svg>
  )
}

export default function ElliottWaveEducation() {
  const [mkt, setMkt] = useState<'US' | 'KR'>('US')
  const [data, setData] = useState<ElliottEduResult | null>(null)
  const [err, setErr] = useState(false)
  const [eduOpen, setEduOpen] = useState(true)

  useEffect(() => {
    setData(null)
    fetch(`/api/elliott-wave-edu?market=${mkt}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => (d.error ? setErr(true) : setData(d))).catch(() => setErr(true))
  }, [mkt])

  const confirmed = data?.swings.filter(s => s.confirmed) ?? []
  const pending = data?.swings.find(s => !s.confirmed) ?? null

  const idxName = mkt === 'US' ? '나스닥100 (QQQ)' : '코스피200'
  const idxFlag = mkt === 'US' ? '🇺🇸' : '🇰🇷'
  // 실제 주가(얇은 선) 위에 '파동 골격'(스윙 연결·굵은 선)을 오버레이해 개념도①과 대응
  const swingByDate = new Map<string, number>()
  confirmed.forEach(s => swingByDate.set(s.date, s.price))
  if (pending) swingByDate.set(pending.date, pending.price)
  const lastIdx = (data?.points.length ?? 0) - 1
  const chartData = (data?.points ?? []).map((p, i) => ({
    ...p,
    zz: swingByDate.has(p.date) ? swingByDate.get(p.date)! : (i === lastIdx ? p.price : null),
  }))

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🌊 엘리어트 파동, 개념부터 실전 차트까지</span>
        <span style={{ color: TK.sub, fontSize: 10.5 }}>교육용 — 실제 파동 번호는 단정하지 않습니다</span>
      </div>

      {/* ① 개념도 */}
      <div style={{ background: TK.bg3, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '10px 14px', marginTop: 8 }}>
        <div style={{ color: TK.sub8, fontSize: 11, marginBottom: 4 }}>① 이상적 개념도 — 추세 5파 + 조정 3파(교과서 예시, 실데이터 아님)</div>
        <IdealWaveDiagram />
      </div>

      {/* ② 실제 차트 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ color: TK.sub8, fontSize: 11 }}>② {idxName} 실제 주봉에 객관적 스윙(ZigZag {data?.zigzagPct ?? 8}%) 표시 — &lsquo;파동을 세는 방식&rsquo;의 예시일 뿐</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['US', 'KR'] as const).map(k => (
              <button key={k} onClick={() => setMkt(k)} style={{
                padding: '3px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: mkt === k ? TK.border : 'transparent', color: mkt === k ? TK.slate200 : TK.sub3 }}>
                {k === 'US' ? '🇺🇸 나스닥100' : '🇰🇷 코스피200'}
              </button>
            ))}
          </div>
        </div>

        {err ? (
          <div style={{ color: TK.sub, fontSize: 12, padding: 12 }}>데이터를 불러오지 못했습니다.</div>
        ) : !data ? (
          <div style={{ color: TK.sub, fontSize: 12, padding: 12 }}>차트를 계산 중입니다…</div>
        ) : (
          <>
            {/* 현재 위치 요약 */}
            <div style={{ background: data.current.direction === 'up' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${data.current.direction === 'up' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
              borderRadius: 9, padding: '8px 12px', marginBottom: 8 }}>
              <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12.5 }}>📍 현재 위치</span>
              <span style={{ color: TK.sub5, fontSize: 12, marginLeft: 8 }}>
                {idxFlag} <b style={{ color: TK.sub8 }}>{idxName}</b> 실제 주가 기준 · 마지막 확정 스윙(#{confirmed[confirmed.length - 1]?.seq ?? '—'}, {confirmed[confirmed.length - 1]?.type === 'high' ? '고점' : '저점'}, {confirmed[confirmed.length - 1]?.date}) 이후
                <b style={{ color: data.current.direction === 'up' ? TK.green400 : TK.red400 }}> {data.current.sincePivotPct > 0 ? '+' : ''}{data.current.sincePivotPct}%</b>
                {pending && <span> · {pending.type === 'high' ? '고점 갱신 중(진행)' : '저점 갱신 중(진행)'}, 아직 {data.zigzagPct}% 반전 미확정</span>}
              </span>
            </div>

            {/* 범례 — 실제 주가(얇게) vs 파동 골격(스윙 연결) */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 10, color: TK.sub, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 18, height: 2, background: TK.amber400, display: 'inline-block' }} /> {idxName} 실제 주가(노란선)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 18, height: 3, background: TK.blue300, display: 'inline-block' }} /> 파동 골격(고점·저점 연결)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: TK.green400, display: 'inline-block' }} /> 고점 ·
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: TK.red400, display: 'inline-block' }} /> 저점 스윙
              </span>
            </div>

            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: TK.sub2, fontSize: 9.5 }} tickFormatter={(s: string) => s.slice(0, 7)} minTickGap={56} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: TK.sub2, fontSize: 9.5 }} axisLine={false} tickLine={false} width={54}
                    tickFormatter={(v: number) => data.market === 'KR' ? `${Math.round(v / 1000)}k` : `$${Math.round(v)}`} />
                  <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, n: any) => [data.market === 'KR' ? `₩${Number(v).toLocaleString()}` : `$${Number(v).toFixed(1)}`, n === '파동 골격' ? '파동 골격' : data.label]} />
                  {/* 실제 주가 — 노란 얇은 선(배경, 가독성 위해 노란색으로 구분) */}
                  <Line type="monotone" dataKey="price" name={data.label} stroke={TK.amber400} strokeWidth={1.1} strokeOpacity={0.8} dot={false} isAnimationActive={false} />
                  {/* 파동 골격 — 스윙 연결 굵은 선(전경), 개념도①의 파란 파동선과 대응 */}
                  <Line type="linear" dataKey="zz" name="파동 골격" stroke={TK.blue300} strokeWidth={2.4} dot={false} connectNulls isAnimationActive={false} />
                  {confirmed.map(s => (
                    <ReferenceDot key={s.seq} x={s.date} y={s.price} r={5} fill={s.type === 'high' ? TK.green400 : TK.red400} stroke={TK.bg3} strokeWidth={1.5}
                      label={{ value: String(s.seq), position: s.type === 'high' ? 'top' : 'bottom', fill: TK.slate200, fontSize: 10, fontWeight: 800 }} />
                  ))}
                  {pending && (
                    <ReferenceDot x={pending.date} y={pending.price} r={5} fill="none" stroke={pending.type === 'high' ? TK.green400 : TK.red400} strokeWidth={2}
                      label={{ value: `${pending.seq}?`, position: pending.type === 'high' ? 'top' : 'bottom', fill: TK.sub, fontSize: 10, fontWeight: 800 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 2px', textAlign: 'left' }}>
        <span style={{ color: TK.btcOrange, fontWeight: 800, fontSize: 12 }}>🎓 엘리어트 파동이란? (그리고 왜 번호를 단정하지 않는가)</span>
        <span style={{ marginLeft: 'auto', color: TK.sub, fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {eduOpen && (
        <div style={{ color: TK.sub5, fontSize: 11, lineHeight: 1.65, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>📐 <b style={{ color: TK.blue300 }}>기본 구조</b> — 랄프 엘리엇이 제시한 이론으로, 시장은 <b style={{ color: TK.green400 }}>추세 방향 5파(1-2-3-4-5)</b> 후 <b style={{ color: TK.red400 }}>반대 방향 조정 3파(A-B-C)</b>로 움직이는 패턴이 반복된다고 봅니다. 3파는 보통 가장 강한 상승, 2·4파는 조정(되돌림)입니다.</div>
          <div>⚠️ <b style={{ color: TK.amber500 }}>왜 이 앱은 번호를 단정하지 않나</b> — 실제 차트에서 &lsquo;지금이 몇 파동인가&rsquo;는 분석가마다 다르게 셀 수 있는 <b>주관적</b> 판단입니다(같은 차트를 보고도 3파라는 사람, 5파라는 사람이 갈립니다). 이 앱은 하드코딩·주관 개입을 배제하는 원칙이라, 위 실제 차트의 번호는 <b>공식 엘리어트 카운트가 아니라</b> 객관적 알고리즘(ZigZag {data?.zigzagPct ?? 8}% 임계)이 찾은 <b>스윙(고점/저점) 순번</b>입니다 — &lsquo;파동을 세는 방식&rsquo;의 개념을 보여줄 뿐입니다.</div>
          <div>🧭 <b style={{ color: TK.sub }}>활용법</b> — 개념도(①)로 큰 그림을 이해하고, 실제 차트(②)에서 &lsquo;고점→저점→고점&rsquo;이 어떻게 반복되며 추세를 이루는지 관찰하세요. 정밀한 매수·매도 신호가 아니라, 시장이 파동처럼 오르내린다는 시각적 직관을 기르는 교육 도구입니다.</div>
        </div>
      )}
    </div>
  )
}
