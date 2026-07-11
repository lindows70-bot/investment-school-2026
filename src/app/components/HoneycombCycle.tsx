'use client'
// 🐝 벌집순환모형 — 지역별 '가격(3개월) × 거래량(전년동기비)' 산점도(6구역 셰이딩) + 선택 지역 24개월 궤적 + 국면 테이블.
// 부동산판 로테이션 시계: 예측이 아닌 '지금 어느 국면인가' 관측(고전 벌집모형의 결정론 구현).
import { useState, useEffect, useMemo } from 'react'
import type { HoneycombResult, HcPhase } from '@/app/api/re-honeycomb/route'

const CARD = '#141824', BORDER = '#1e293b'
const PH: Record<HcPhase, { name: string; color: string; desc: string }> = {
  2: { name: '② 호황기', color: '#f87171', desc: '가격↑ · 거래↑ — 상승 본격화' },
  3: { name: '③ 침체 진입', color: '#fb923c', desc: '가격↑ · 거래↓ — 비싸져 거래가 마름(상투 경계)' },
  4: { name: '④ 침체기', color: '#eab308', desc: '가격 보합 · 거래↓ — 관망' },
  5: { name: '⑤ 불황기', color: '#60a5fa', desc: '가격↓ · 거래↓ — 조정 진행' },
  6: { name: '⑥ 회복 진입', color: '#2dd4bf', desc: '가격↓ · 거래↑ — 싸지자 거래가 살아남(바닥 탐색)' },
  1: { name: '① 회복기', color: '#4ade80', desc: '가격 보합 · 거래↑ — 반등 준비' },
}
// 국면 재판정(궤적용 — API judge와 동일 공식: 가격 ±0.3% 밴드 × 거래 YoY 부호)
const judgePhase = (p: number, v: number): HcPhase => {
  const pd = p > 0.3 ? 'up' : p < -0.3 ? 'down' : 'flat'
  if (pd === 'up') return v >= 0 ? 2 : 3
  if (pd === 'down') return v >= 0 ? 6 : 5
  return v >= 0 ? 1 : 4
}

export default function HoneycombCycle() {
  const [d, setD] = useState<HoneycombResult | null>(null)
  const [err, setErr] = useState(false)
  const [sel, setSel] = useState('서울')

  useEffect(() => {
    fetch('/api/re-honeycomb').then(r => r.ok ? r.json() : null)
      .then(j => j && !j.error ? setD(j) : setErr(true))
      .catch(() => setErr(true))
  }, [])

  const selRegion = useMemo(() => d?.regions.find(r => r.name === sel) ?? null, [d, sel])

  if (err) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#f87171', fontSize: 12 }}>⚠️ 벌집순환 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🐝 지역별 가격×거래량 국면을 계산 중… (한국부동산원 R-ONE, 첫 로드는 ~1분)</div>

  /* ── 산점도 좌표계(SVG) — x=거래량 YoY %, y=가격 3개월 % ── */
  const W = 760, H = 470, padL = 54, padR = 16, padT = 26, padB = 40
  const pts = d.regions.filter(r => r.priceChg3m != null && r.volYoY != null)
  const xMax = Math.max(30, ...pts.map(r => Math.abs(r.volYoY!))) * 1.15
  const yMax = Math.max(2.5, ...pts.map(r => Math.abs(r.priceChg3m!))) * 1.2
  const X = (v: number) => padL + ((v + xMax) / (2 * xMax)) * (W - padL - padR)
  const Y = (p: number) => padT + ((yMax - p) / (2 * yMax)) * (H - padT - padB)
  const PB = 0.3   // 가격 보합 밴드 ±0.3%
  // 6구역: (가격 up/flat/down) × (거래 +/-)
  const zones: { x1: number; x2: number; y1: number; y2: number; ph: HcPhase }[] = [
    { x1: 0, x2: xMax, y1: PB, y2: yMax, ph: 2 }, { x1: -xMax, x2: 0, y1: PB, y2: yMax, ph: 3 },
    { x1: 0, x2: xMax, y1: -PB, y2: PB, ph: 1 }, { x1: -xMax, x2: 0, y1: -PB, y2: PB, ph: 4 },
    { x1: 0, x2: xMax, y1: -yMax, y2: -PB, ph: 6 }, { x1: -xMax, x2: 0, y1: -yMax, y2: -PB, ph: 5 },
  ]
  // 라벨 declutter(점 위 지역명)
  const placed: { x: number; y: number }[] = []
  const canLabel = (x: number, y: number) => {
    if (placed.some(p => Math.abs(p.x - x) < 50 && Math.abs(p.y - y) < 16)) return false
    placed.push({ x, y }); return true
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 국면 요약 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {([2, 3, 4, 5, 6, 1] as HcPhase[]).map(p => (
          <div key={p} style={{ flex: '1 1 150px', background: CARD, border: `1px solid ${d.phaseCount[p] ? PH[p].color : BORDER}`, borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ color: PH[p].color, fontWeight: 800, fontSize: 11.5 }}>{PH[p].name} <span style={{ color: '#e2e8f0' }}>{d.phaseCount[p]}곳</span></div>
            <div style={{ color: '#8a9aaa', fontSize: 10, marginTop: 2, lineHeight: 1.45 }}>{PH[p].desc}</div>
          </div>
        ))}
      </div>

      {/* 🐝 육각형 벌집 시계 — 고전 벌집모형 다이어그램(국면 꼭짓점 + 지역 배치 + 선택 지역 궤적) */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🐝 벌집 시계 — 육각형 위의 현재 위치</div>
        <div style={{ color: '#8a9aaa', fontSize: 11, margin: '3px 0 6px', lineHeight: 1.55 }}>
          고전 벌집모형 그대로 — 시장은 육각형을 <b style={{ color: '#cbd5e1' }}>시계방향</b>(②호황→③침체진입→④침체→⑤불황→⑥회복진입→①회복)으로 돕니다.
          각 꼭짓점에 현재 그 국면인 지역을 배치했고, 흰 궤적은 선택 지역({sel})이 최근 24개월간 벌집을 돌아온 길입니다.
        </div>
        {(() => {
          const HW = 760, HH = 460, cx = HW / 2, cy = HH / 2 + 4, R = 158
          // 시계방향 배치: ②호황(12시) → ③(2시) → ④(4시) → ⑤(6시) → ⑥(8시) → ①(10시)
          const ORDER: HcPhase[] = [2, 3, 4, 5, 6, 1]
          const vx = (i: number) => cx + R * Math.sin((i * 60) * Math.PI / 180)
          const vy = (i: number) => cy - R * Math.cos((i * 60) * Math.PI / 180)
          const vIdx = (ph: HcPhase) => ORDER.indexOf(ph)
          // 지역 칩: 꼭짓점 바깥 방향으로 스택
          const byPhase = new Map<HcPhase, string[]>()
          for (const r of d.regions) { const a = byPhase.get(r.phase) ?? []; if (r.name === '전국') a.unshift('🇰🇷전국'); else a.push(r.name); byPhase.set(r.phase, a) }
          // 선택 지역 궤적: 월별 국면 → 꼭짓점 경로(연속 중복 제거, 진행도에 따라 안쪽→바깥 반경 오프셋으로 시간 구분)
          const path: { ph: HcPhase; ym: string }[] = []
          if (selRegion) for (const t of selRegion.trail) {
            const ph = judgePhase(t.p, t.v)
            if (!path.length || path[path.length - 1].ph !== ph) path.push({ ph, ym: t.ym })
          }
          const trailPt = (ph: HcPhase, k: number, n: number) => {
            const i = vIdx(ph), f = 0.52 + 0.34 * (n <= 1 ? 1 : k / (n - 1))   // 과거=안쪽, 최신=꼭짓점 근처
            return { x: cx + R * f * Math.sin(i * 60 * Math.PI / 180), y: cy - R * f * Math.cos(i * 60 * Math.PI / 180) }
          }
          return (
            <svg viewBox={`0 0 ${HW} ${HH}`} style={{ width: '100%' }}>
              {/* 육각형 몸체 + 시계방향 화살표 */}
              <polygon points={ORDER.map((_, i) => `${vx(i)},${vy(i)}`).join(' ')} fill="rgba(255,255,255,0.02)" stroke="#3a4358" strokeWidth={1.4} />
              {ORDER.map((_, i) => {
                const j = (i + 1) % 6
                const mx = (vx(i) + vx(j)) / 2, my = (vy(i) + vy(j)) / 2
                const ang = Math.atan2(vy(j) - vy(i), vx(j) - vx(i)) * 180 / Math.PI
                return <text key={'ar' + i} x={mx} y={my + 4} textAnchor="middle" fill="#8a9aaa" fontSize={13} transform={`rotate(${ang} ${mx} ${my})`}>▶</text>
              })}
              {/* 꼭짓점(국면) + 지역 칩 */}
              {ORDER.map((ph, i) => {
                const x = vx(i), y = vy(i)
                const outX = cx + (R + 34) * Math.sin(i * 60 * Math.PI / 180)
                const outY = cy - (R + 34) * Math.cos(i * 60 * Math.PI / 180)
                const names = byPhase.get(ph) ?? []
                const isSelHere = selRegion && selRegion.phase === ph
                return (
                  <g key={'v' + ph}>
                    <circle cx={x} cy={y} r={13} fill={PH[ph].color} fillOpacity={0.22} stroke={PH[ph].color} strokeWidth={isSelHere ? 2.4 : 1.4} />
                    <text x={x} y={y + 4} textAnchor="middle" fill={PH[ph].color} fontSize={12} fontWeight={900}>{ph}</text>
                    {(() => {
                      const dir = outY < cy ? -1 : 1   // 위쪽 꼭짓점은 위로, 아래쪽은 아래로 스택(원·변과 겹침 방지)
                      const rows = Math.ceil(names.length / 3)
                      return (<>
                        <text x={outX} y={outY} textAnchor="middle" fill={PH[ph].color} fontSize={11.5} fontWeight={900}>{PH[ph].name}</text>
                        {Array.from({ length: rows }, (_, row) => (
                          <text key={'r' + row} x={outX} y={outY + dir * (15 + row * 13)} textAnchor="middle" fontSize={10.5}>
                            {names.slice(row * 3, row * 3 + 3).map((nm, k) => (
                              <tspan key={nm} fill={nm === sel || nm === '🇰🇷전국' ? '#f1f5f9' : '#aab6c4'} fontWeight={nm === sel || nm === '🇰🇷전국' ? 900 : 600} onClick={() => nm !== '🇰🇷전국' && setSel(nm)} style={{ cursor: nm === '🇰🇷전국' ? 'default' : 'pointer' }}>{k > 0 ? ' · ' : ''}{nm}</tspan>
                            ))}
                          </text>
                        ))}
                      </>)
                    })()}
                  </g>
                )
              })}
              {/* 선택 지역 궤적 — 안쪽(과거)→꼭짓점(최신) */}
              {path.length > 1 && (
                <g>
                  <polyline points={path.map((s, k) => { const p = trailPt(s.ph, k, path.length); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')}
                    fill="none" stroke="#f1f5f9" strokeWidth={1.6} strokeOpacity={0.6} strokeDasharray="4 3" />
                  {path.map((s, k) => {
                    const p = trailPt(s.ph, k, path.length)
                    const isLast = k === path.length - 1
                    return (
                      <g key={'tp' + k}>
                        <circle cx={p.x} cy={p.y} r={isLast ? 7 : 3.5} fill={isLast ? PH[s.ph].color : '#cbd5e1'} stroke={isLast ? '#f1f5f9' : 'none'} strokeWidth={2} />
                        <text x={p.x + (isLast ? (p.x < cx ? 12 : -12) : 0)} y={p.y + (isLast ? 18 : -7)} textAnchor="middle" fill={isLast ? '#f1f5f9' : '#8a9aaa'} fontSize={isLast ? 10.5 : 8.5} fontWeight={isLast ? 900 : 600}>{isLast ? `${sel} 현재` : s.ym.slice(2)}</text>
                      </g>
                    )
                  })}
                </g>
              )}
              <text x={cx} y={cy + 4} textAnchor="middle" fill="#5a6578" fontSize={11} fontWeight={700}>시계방향 순환</text>
            </svg>
          )
        })()}
      </div>

      {/* 산점도 + 선택 지역 궤적 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📍 정밀 지도 — 실제 수치 좌표(가격×거래량)</div>
        <div style={{ color: '#8a9aaa', fontSize: 11, margin: '3px 0 6px', lineHeight: 1.55 }}>
          위 벌집 시계의 실제 수치 버전 — 가로 = 거래량(최근 3개월, 전년동기비 %) · 세로 = 가격(3개월 변화 %). 지역 점 클릭으로 선택(궤적은 위 벌집 시계에서).
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
          {zones.map((z, i) => (
            <rect key={i} x={X(z.x1)} y={Y(z.y2)} width={X(z.x2) - X(z.x1)} height={Y(z.y1) - Y(z.y2)}
              fill={PH[z.ph].color} fillOpacity={0.09} stroke={PH[z.ph].color} strokeOpacity={0.25} strokeDasharray="3 3" />
          ))}
          {zones.map((z, i) => (
            <text key={'zl' + i} x={(X(z.x1) + X(z.x2)) / 2} y={z.ph === 1 || z.ph === 4 ? (Y(z.y1) + Y(z.y2)) / 2 + 3 : z.y2 > 0.31 ? Y(z.y2) + 14 : Y(z.y1) - 6}
              textAnchor="middle" fill={PH[z.ph].color} fontSize={11} fontWeight={900} opacity={0.85}>{PH[z.ph].name}</text>
          ))}
          {/* 축 */}
          <line x1={X(0)} x2={X(0)} y1={padT} y2={H - padB} stroke="#3a4358" strokeWidth={1} />
          <line x1={padL} x2={W - padR} y1={Y(0)} y2={Y(0)} stroke="#3a4358" strokeWidth={1} />
          <text x={W - padR} y={Y(0) - 6} textAnchor="end" fill="#8a9aaa" fontSize={10}>거래량 YoY(%) →</text>
          <text x={X(0) + 6} y={padT + 10} fill="#8a9aaa" fontSize={10}>가격 3개월(%) ↑</text>
          {/* 지역 점 — 궤적은 위 육각형 벌집 시계가 담당(클램핑 아티팩트 방지 위해 산점도에선 미표시) */}
          {pts.map(r => {
            const x = X(Math.max(-xMax, Math.min(xMax, r.volYoY!))), y = Y(Math.max(-yMax, Math.min(yMax, r.priceChg3m!)))
            const isSel = r.name === sel, isNat = r.name === '전국'
            const c = PH[r.phase].color
            return (
              <g key={r.name} style={{ cursor: 'pointer' }} onClick={() => setSel(r.name)}>
                <circle cx={x} cy={y} r={isSel ? 8 : isNat ? 7 : 5.5} fill={c} stroke={isSel || isNat ? '#f1f5f9' : '#0d1017'} strokeWidth={isSel ? 2.2 : 1.2} />
                {(isSel || isNat || canLabel(x, y)) && (
                  <text x={x} y={y - (isSel ? 12 : 9)} textAnchor="middle" fill={isSel ? '#f1f5f9' : '#aab6c4'} fontSize={isSel || isNat ? 11 : 9.5} fontWeight={isSel || isNat ? 900 : 700}>{r.name}</text>
                )}
              </g>
            )
          })}
        </svg>
        {selRegion && (
          <div style={{ background: `${PH[selRegion.phase].color}10`, border: `1px solid ${PH[selRegion.phase].color}44`, borderRadius: 9, padding: '8px 12px', marginTop: 8, fontSize: 11.5, lineHeight: 1.6 }}>
            <b style={{ color: PH[selRegion.phase].color }}>📍 {selRegion.name}: {PH[selRegion.phase].name}</b>
            <span style={{ color: '#aab6c4' }}> — 가격 3개월 {selRegion.priceChg3m! > 0 ? '+' : ''}{selRegion.priceChg3m}% · 거래량 YoY {selRegion.volYoY! > 0 ? '+' : ''}{selRegion.volYoY}%(3개월 {selRegion.vol3m?.toLocaleString()}호) · {PH[selRegion.phase].desc} · 기준 {selRegion.asOf}</span>
          </div>
        )}
      </div>

      {/* 지역 테이블 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>지역별 국면 상세</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))', gap: 7 }}>
          {d.regions.map(r => (
            <button key={r.name} onClick={() => setSel(r.name)} style={{
              textAlign: 'left', background: r.name === sel ? `${PH[r.phase].color}14` : '#0f1117', border: `1px solid ${r.name === sel ? PH[r.phase].color : BORDER}`,
              borderRadius: 9, padding: '8px 11px', cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ color: '#e2e8f0', fontSize: 12 }}>{r.name === '전국' ? '🇰🇷 전국' : r.name}</b>
                <span style={{ color: PH[r.phase].color, fontSize: 10.5, fontWeight: 800 }}>{PH[r.phase].name}</span>
              </div>
              <div style={{ color: '#8a9aaa', fontSize: 10, marginTop: 3, fontFamily: 'monospace' }}>
                가격3m {r.priceChg3m! > 0 ? '+' : ''}{r.priceChg3m}% · 거래YoY {r.volYoY! > 0 ? '+' : ''}{r.volYoY}%
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 교육 + 캐비엇 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', fontSize: 11, color: '#aab6c4', lineHeight: 1.7 }}>
        <b style={{ color: '#e2e8f0' }}>🎓 벌집모형 읽는 법</b> — 부동산은 공급이 느려(인허가→입주 2~3년) 가격과 거래량이 벌집(육각형)을 시계방향으로 도는 경향이 있습니다.
        핵심 신호 2개: <b style={{ color: '#fb923c' }}>③ 침체 진입(가격은 오르는데 거래가 마름)</b> = 추격 매수 경계 /
        <b style={{ color: '#2dd4bf' }}> ⑥ 회복 진입(가격은 빠지는데 거래가 살아남)</b> = 바닥 탐색 신호(스마트머니 선진입).
        <div style={{ marginTop: 6, color: '#8a9aaa', fontSize: 10.5 }}>
          ⚠️ 실거래 신고(~30일) 지연분이 최근 거래량을 과소집계할 수 있어 최신월 판정은 보수적으로 읽으세요. 국면은 관측이지 예측·매수 신호가 아니며, 시도 내에서도 시군구별 편차가 큽니다(교육용).
          출처: 한국부동산원 R-ONE(월간 아파트 매매가격지수·행정구역별 매매거래량). 24시간 캐시.
        </div>
      </div>
    </div>
  )
}
