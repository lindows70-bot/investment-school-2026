'use client'
// 🌐 피델리티식 글로벌 비즈니스 사이클 — OECD CLI 실데이터 S-곡선 + 국가 버블 + 클릭 상세 + 국면 성적표
import { useState, useEffect, useMemo } from 'react'
import type { GlobalCycleResult, CycleCountry, CyclePhase } from '@/app/api/global-cycle/route'

const CARD = '#12151c', BORDER = '#252a36', GOLD = '#d4af7a'
const PHASE_COLOR: Record<CyclePhase, string> = { early: '#4ade80', mid: '#60a5fa', late: '#fbbf24', recession: '#f87171' }
const PHASE_KO: Record<CyclePhase, string> = { early: '회복', mid: '확장', late: '후기', recession: '수축' }

// S-곡선: x(0~100) → y. 정점을 x=45(확장 중후반)에 둔 비대칭 힐 — 상승 완만·하강 가파름(경기 사이클 모양)
const W = 1000, H = 360, TOP = 72, BOT = 300
function curveY(x: number): number {
  const t = x / 100
  const peak = 0.45
  const s = t <= peak ? Math.sin((t / peak) * Math.PI / 2) : Math.cos(((t - peak) / (1 - peak)) * Math.PI / 2)
  return BOT - (BOT - TOP) * s
}
const X0 = 60, X1 = 950
const px = (x: number) => X0 + (x / 100) * (X1 - X0)
function curvePath(): string {
  const pts: string[] = []
  for (let x = 0; x <= 100; x += 2) pts.push(`${px(x).toFixed(1)} ${curveY(x).toFixed(1)}`)
  return 'M ' + pts.join(' L ')
}

export default function GlobalBusinessCycle() {
  const [d, setD] = useState<GlobalCycleResult | null>(null)
  const [err, setErr] = useState(false)
  const [sel, setSel] = useState<string>('US')

  useEffect(() => {
    fetch('/api/global-cycle', { cache: 'no-store' }).then(r => r.json()).then(x => (x?.countries?.length ? setD(x) : setErr(true))).catch(() => setErr(true))
  }, [])

  // 같은 자리 겹침 방지: curveX 근접 국가는 위로 계단식 오프셋
  const placed = useMemo(() => {
    if (!d) return []
    const sorted = [...d.countries].sort((a, b) => a.curveX - b.curveX)
    const out: (CycleCountry & { yOff: number })[] = []
    for (const c of sorted) {
      const near = out.filter(o => Math.abs(o.curveX - c.curveX) < 6)
      out.push({ ...c, yOff: near.length * 34 })
    }
    return out
  }, [d])

  const cur = d?.countries.find(c => c.code === sel) ?? null

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>🌐 글로벌 비즈니스 사이클 — 국가별 경기 위치</div>
      <div style={{ color: '#8a9aaa', fontSize: 11, marginBottom: 10 }}>
        피델리티 프레임워크를 <b style={{ color: '#cdd6e3' }}>OECD 경기선행지수(CLI) 실데이터</b>로 재현 — 레벨(100 기준)×3개월 모멘텀 자동 판정(독점 배치 모사 아님).
      </div>

      {err && <div style={{ color: '#8a9aaa', fontSize: 13, padding: 12 }}>데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ color: '#8a9aaa', fontSize: 13, padding: 12 }}>13개국 경기선행지수를 분석 중입니다…</div>}

      {d && <>
        {/* 인플레이션 압력 안내 바(피델리티 원본 요소 — 사이클 후반일수록 물가 압력↑ 교육) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#7f93a8', fontSize: 10 }}>물가·금리 압력</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #4ade8033, #fbbf2477, #f87171bb)' }} />
          <span style={{ color: '#f87171', fontSize: 10 }}>높음</span>
        </div>

        {/* ── S-곡선 + 국가 버블 ── */}
        <div style={{ background: '#0f1117', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '6px 4px', marginBottom: 10 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="gcCurve" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4ade80" /><stop offset="30%" stopColor="#60a5fa" />
                <stop offset="55%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#f87171" />
              </linearGradient>
              <linearGradient id="gcArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity="0.14" /><stop offset="100%" stopColor={GOLD} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* 국면 배경 밴드 */}
            {([['early', 0, 25], ['mid', 25, 50], ['late', 50, 75], ['recession', 75, 100]] as [CyclePhase, number, number][]).map(([ph, a, b]) => (
              <g key={ph}>
                <rect x={px(a)} y={30} width={px(b) - px(a)} height={H - 46} fill={PHASE_COLOR[ph]} opacity="0.045" />
                {a > 0 && <line x1={px(a)} y1={30} x2={px(a)} y2={H - 16} stroke={BORDER} strokeDasharray="4 5" />}
                <text x={(px(a) + px(b)) / 2} y={H - 24} fill={PHASE_COLOR[ph]} fontSize="13" fontWeight="800" textAnchor="middle" opacity="0.9">{PHASE_KO[ph]}</text>
              </g>
            ))}
            {/* 면적 + 곡선 */}
            <path d={`${curvePath()} L ${px(100)} ${BOT + 14} L ${px(0)} ${BOT + 14} Z`} fill="url(#gcArea)" />
            <path d={curvePath()} fill="none" stroke="url(#gcCurve)" strokeWidth="5.5" strokeLinecap="round" />
            {/* 국가 버블 */}
            {placed.map(c => {
              const cx = px(c.curveX), cy = curveY(c.curveX) - c.yOff
              const active = c.code === sel
              return (
                <g key={c.code} onClick={() => setSel(c.code)} style={{ cursor: 'pointer' }}>
                  {c.yOff > 0 && <line x1={cx} y1={curveY(c.curveX)} x2={cx} y2={cy + 12} stroke={PHASE_COLOR[c.phase]} strokeWidth="1" opacity="0.4" />}
                  <circle cx={cx} cy={cy} r={active ? 15 : 12} fill={`${PHASE_COLOR[c.phase]}2e`} stroke={PHASE_COLOR[c.phase]} strokeWidth={active ? 3 : 1.8}>
                    {active && <animate attributeName="r" values="14;17;14" dur="1.8s" repeatCount="indefinite" />}
                  </circle>
                  <text x={cx} y={cy + 5} fontSize="14" textAnchor="middle">{c.flag}</text>
                  <g style={{ paintOrder: 'stroke' }} stroke="#0f1117" strokeWidth="4" strokeLinejoin="round">
                    <text x={cx} y={cy - (active ? 21 : 18)} fill={active ? '#fff' : PHASE_COLOR[c.phase]} fontSize={active ? 13 : 11.5} fontWeight="800" textAnchor="middle">{c.ko}</text>
                  </g>
                </g>
              )
            })}
          </svg>
        </div>

        {/* ── 선택 국가 상세 ── */}
        {cur && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, background: `${PHASE_COLOR[cur.phase]}0e`, border: `1px solid ${PHASE_COLOR[cur.phase]}44`, borderRadius: 10, padding: '11px 14px', marginBottom: 10, alignItems: 'center' }}>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#e2e8f0' }}>{cur.flag} {cur.ko}</div>
              <div style={{ color: PHASE_COLOR[cur.phase], fontWeight: 800, fontSize: 13 }}>{PHASE_KO[cur.phase]} 국면</div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div><div style={{ color: '#7f93a8', fontSize: 10 }}>경기선행지수(CLI)</div><div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14, fontFamily: 'monospace' }}>{cur.cli}</div></div>
              <div><div style={{ color: '#7f93a8', fontSize: 10 }}>3개월 모멘텀</div><div style={{ color: cur.momentum > 0 ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 14, fontFamily: 'monospace' }}>{cur.momentum > 0 ? '+' : ''}{cur.momentum}</div></div>
              <div><div style={{ color: '#7f93a8', fontSize: 10 }}>기준월</div><div style={{ color: '#cdd6e3', fontWeight: 700, fontSize: 12 }}>{cur.asOfMonth}</div></div>
            </div>
            {/* CLI 24개월 스파크라인 */}
            <Spark values={cur.spark} color={PHASE_COLOR[cur.phase]} />
            <div style={{ flexBasis: '100%', color: '#aab6c4', fontSize: 11, lineHeight: 1.55 }}>
              {d.phaseGuide.find(g => g.phase === cur.phase)?.note} <b style={{ color: PHASE_COLOR[cur.phase] }}>유리 경향: {d.phaseGuide.find(g => g.phase === cur.phase)?.favored}</b>
            </div>
          </div>
        )}

        {/* ── 국면별 성적표 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {d.phaseGuide.map(g => {
            const members = d.countries.filter(c => c.phase === g.phase)
            return (
              <div key={g.phase} style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${PHASE_COLOR[g.phase]}44`, borderTop: `2px solid ${PHASE_COLOR[g.phase]}`, padding: '9px 11px' }}>
                <div style={{ color: PHASE_COLOR[g.phase], fontWeight: 800, fontSize: 12 }}>{g.ko}</div>
                <div style={{ color: '#9aa7b5', fontSize: 10.5, marginTop: 3 }}>유리: {g.favored}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {members.length ? members.map(m => (
                    <button key={m.code} onClick={() => setSel(m.code)} style={{ background: `${PHASE_COLOR[g.phase]}18`, color: '#cdd6e3', border: `1px solid ${PHASE_COLOR[g.phase]}33`, borderRadius: 6, padding: '2px 7px', fontSize: 10.5, cursor: 'pointer' }}>{m.flag} {m.ko}</button>
                  )) : <span style={{ color: '#5a6b7c', fontSize: 10.5 }}>해당 국가 없음</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 10, lineHeight: 1.55 }}>
          ⚠️ OECD CLI(진폭조정)는 발표 시차 ~1개월 — 피델리티 공식 배치와 다를 수 있습니다(우리는 공개 실데이터 자동 판정). 이 사이클은 <b>성장 축</b>만 봅니다 — 물가까지 합친 판정은 🧭 4계절 내비게이터(성장×물가) 참조. 국면별 유리 자산은 역사적 <b>경향</b>이지 매매 지시가 아닙니다.
        </div>
      </>}
    </div>
  )
}

// CLI 24개월 미니 스파크라인
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 130, h = 36
  const mn = Math.min(...values), mx = Math.max(...values), rg = mx - mn || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - mn) / rg) * (h - 8)}`).join(' ')
  // 기준선 100 위치(범위 안일 때만)
  const y100 = mn <= 100 && mx >= 100 ? h - 4 - ((100 - mn) / rg) * (h - 8) : null
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      {y100 != null && <line x1="0" y1={y100} x2={w} y2={y100} stroke="#5a6b7c" strokeDasharray="3 3" strokeWidth="0.8" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx={w} cy={h - 4 - ((values[values.length - 1] - mn) / rg) * (h - 8)} r="2.5" fill={color} />
    </svg>
  )
}
