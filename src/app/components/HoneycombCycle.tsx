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
    if (placed.some(p => Math.abs(p.x - x) < 44 && Math.abs(p.y - y) < 13)) return false
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

      {/* 산점도 + 선택 지역 궤적 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🐝 벌집순환 지도 — 17개 시도의 현재 국면</div>
        <div style={{ color: '#8a9aaa', fontSize: 11, margin: '3px 0 6px', lineHeight: 1.55 }}>
          가로 = 거래량(최근 3개월, 전년동기비 %) · 세로 = 가격(3개월 변화 %). 고전 벌집모형은 시장이 ②호황 → ③침체진입 → ④침체 → ⑤불황 → ⑥회복진입 → ①회복 순으로 <b style={{ color: '#cbd5e1' }}>시계방향</b> 순환한다고 봅니다.
          지역 클릭 시 아래 24개월 궤적이 바뀝니다.
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
          {/* 선택 지역 궤적(최근 24개월) */}
          {selRegion && selRegion.trail.length > 1 && (
            <g>
              <polyline points={selRegion.trail.map(t => `${X(Math.max(-xMax, Math.min(xMax, t.v))).toFixed(1)},${Y(Math.max(-yMax, Math.min(yMax, t.p))).toFixed(1)}`).join(' ')}
                fill="none" stroke="#f1f5f9" strokeWidth={1.4} strokeOpacity={0.55} />
              {selRegion.trail.map((t, i) => i % 6 === 0 && (
                <text key={i} x={X(Math.max(-xMax, Math.min(xMax, t.v)))} y={Y(Math.max(-yMax, Math.min(yMax, t.p))) - 5}
                  textAnchor="middle" fill="#cbd5e1" fontSize={8.5} opacity={0.8}>{t.ym.slice(2)}</text>
              ))}
            </g>
          )}
          {/* 지역 점 */}
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
