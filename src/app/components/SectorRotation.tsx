'use client'
// 🧭 섹터 로테이션 시계 — 17섹터(GICS 11+테마 6)를 상대강도×모멘텀 4사분면에. 클릭 시 드릴다운(SectorCanvas).
import { useEffect, useState } from 'react'
import type { RotationResult, RotationItem, Quadrant } from '@/app/api/sector-rotation/route'
import SectorCanvas from '@/app/components/SectorCanvas'

const BORDER = '#2a2f3a'
const pcol = (v: number | null) => v == null ? '#8a9aaa' : v > 0 ? '#34d399' : v < 0 ? '#f87171' : '#8a9aaa'
const pfmt = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`
const it2 = (emoji: string, label: string) => `${emoji}${label}`
const QC: Record<Quadrant, string> = { leading: '#22c55e', weakening: '#ef4444', lagging: '#94a3b8', improving: '#38bdf8' }
const QI: Record<Quadrant, string> = { leading: '🌱', weakening: '🔥', lagging: '🍂', improving: '❄️' }
const QN: Record<Quadrant, string> = { leading: '주도', weakening: '과열', lagging: '이탈', improving: '태동' }
// 풀 라벨(키별 고정) — 잘림 없이 전체 표기
const FULL: Record<string, string> = {
  energy: '에너지', materials: '소재', industrials: '산업재', discretionary: '자유소비재', staples: '필수소비재',
  healthcare: '헬스케어', financials: '금융', infotech: '정보기술', communication: '커뮤니케이션', utilities: '유틸리티', realestate: '리츠',
  quantum: '양자컴퓨팅', 'ai-semi': 'AI반도체', power: 'AI전력망', 'phys-ai': '피지컬AI', 'ai-bio': 'AI바이오', defense: '우주항공·방산',
}

export default function SectorRotation() {
  const [data, setData] = useState<RotationResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sector-rotation').then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j)))
      .then(j => {
        if (j.error) return setErr(j.error)
        setData(j)
        // 기본으로 자금 유입 1순위 섹터 드릴다운을 펼쳐 보여줌(학생이 클릭할 줄 몰라도 상세가 보이게)
        setSel(prev => prev ?? (j.inflow?.[0]?.key ?? j.items?.[0]?.key ?? null))
      })
      .catch(j => setErr(j?.error || '로테이션 데이터를 불러오지 못했습니다. 섹터 탭을 몇 개 방문하면 캐시가 채워집니다.'))
  }, [])

  if (err) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>⚠️ {err}</div>
  if (!data) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>🧭 섹터 자금 순환 계산 중… (17개 섹터 집계)</div>

  // ── 시계 좌표 (파워 스케일링으로 중앙 뭉침을 펼침, halfW 축소로 라벨 여백 확보) ──
  const cx = 250, cy = 245, halfW = 172, halfH = 205
  const maxRs = Math.max(1, ...data.items.map(i => Math.abs(i.rs)))
  const maxMom = Math.max(1, ...data.items.map(i => Math.abs(i.mom)))
  const spread = (v: number, max: number) => (v >= 0 ? 1 : -1) * Math.pow(Math.min(Math.abs(v) / max, 1), 0.5)
  const px = (rs: number) => cx + spread(rs, maxRs) * halfW * 0.92
  const py = (mom: number) => cy - spread(mom, maxMom) * halfH * 0.92

  // 라벨 겹침 방지(declutter): 점 위치는 그대로, 라벨 y만 같은 쪽끼리 최소 간격 확보
  const laid = data.items.map(it => {
    const x = px(it.rs), y = py(it.mom)
    return { it, x, y, ly: y, side: (x > cx ? 'r' : 'l') as 'r' | 'l' }
  })
  for (const side of ['l', 'r'] as const) {
    const grp = laid.filter(d => d.side === side).sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < grp.length; i++) if (grp[i].ly - grp[i - 1].ly < 13) grp[i].ly = grp[i - 1].ly + 13
    const overflow = grp.length ? Math.max(0, grp[grp.length - 1].ly - (cy + halfH - 4)) : 0
    if (overflow > 0) for (const d of grp) d.ly -= overflow
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#141824,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>🧭 섹터 로테이션 시계 — 지금 돈이 어디로 도나</div>
        <div style={{ fontSize: 12, color: '#8599ae', marginTop: 4, lineHeight: 1.5 }}>
          17개 섹터(GICS 11 + 테마 6)를 <b style={{ color: '#cbd5e1' }}>상대강도(가로)×모멘텀(세로)</b>로 배치. 자금은 🌱주도→🔥과열→🍂이탈→❄️태동을 <b style={{ color: '#cbd5e1' }}>시계방향</b>으로 순환.
          점 클릭 → 소섹터·대표종목 드릴다운. <b style={{ color: '#cbd5e1' }}>예측이 아니라 현재 위치.</b>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {/* 시계 */}
        <div style={{ flex: '1 1 480px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 8 }}>
          <svg viewBox="0 0 500 470" style={{ width: '100%' }}>
            {/* 사분면 배경 */}
            <g opacity={0.12}>
              <rect x={cx - halfW} y={cy - halfH} width={halfW} height={halfH} fill={QC.improving} />
              <rect x={cx} y={cy - halfH} width={halfW} height={halfH} fill={QC.leading} />
              <rect x={cx - halfW} y={cy} width={halfW} height={halfH} fill={QC.lagging} />
              <rect x={cx} y={cy} width={halfW} height={halfH} fill={QC.weakening} />
            </g>
            <line x1={cx - halfW} y1={cy} x2={cx + halfW} y2={cy} stroke={BORDER} strokeWidth={1} />
            <line x1={cx} y1={cy - halfH} x2={cx} y2={cy + halfH} stroke={BORDER} strokeWidth={1} />
            {/* 사분면 라벨 */}
            <text x={cx + halfW - 6} y={cy - halfH + 16} textAnchor="end" fontSize={12} fontWeight={800} fill={QC.leading}>🌱 주도</text>
            <text x={cx - halfW + 6} y={cy - halfH + 16} fontSize={12} fontWeight={800} fill={QC.improving}>❄️ 태동</text>
            <text x={cx + halfW - 6} y={cy + halfH - 8} textAnchor="end" fontSize={12} fontWeight={800} fill={QC.weakening}>🔥 과열</text>
            <text x={cx - halfW + 6} y={cy + halfH - 8} fontSize={12} fontWeight={800} fill={QC.lagging}>🍂 이탈</text>
            {/* 축 */}
            <text x={cx + halfW - 4} y={cy + 14} textAnchor="end" fontSize={9.5} fill="#8599ae">상대강도 →</text>
            <text x={cx + 5} y={cy - halfH + 10} fontSize={9.5} fill="#8599ae">모멘텀 ↑</text>
            {/* 시계방향 순환 화살표 — 4개 모서리(태동→주도→과열→이탈) */}
            {(() => {
              const A = '#7f8ea0', op = 0.45, m = 40, o = 15   // 색·투명도·화살길이·모서리 여백
              const R = cx + halfW - o, L = cx - halfW + o, T = cy - halfH + o, B = cy + halfH - o
              const arrow = (path: string, hx: number, hy: number, pts: string) => (
                <g opacity={op}>
                  <path d={path} fill="none" stroke={A} strokeWidth={1.4} strokeLinecap="round" />
                  <path d={`M ${hx} ${hy} ${pts} z`} fill={A} />
                </g>
              )
              return (
                <>
                  {/* 상단: 태동→주도 (오른쪽으로) */}
                  {arrow(`M ${cx - m} ${T} Q ${cx} ${T - 8} ${cx + m} ${T}`, cx + m, T, `l -6 -4 l 1 8`)}
                  {/* 우측: 주도→과열 (아래로) */}
                  {arrow(`M ${R} ${cy - m} Q ${R + 8} ${cy} ${R} ${cy + m}`, R, cy + m, `l -4 -6 l 8 1`)}
                  {/* 하단: 과열→이탈 (왼쪽으로) */}
                  {arrow(`M ${cx + m} ${B} Q ${cx} ${B + 8} ${cx - m} ${B}`, cx - m, B, `l 6 -4 l -1 8`)}
                  {/* 좌측: 이탈→태동 (위로) */}
                  {arrow(`M ${L} ${cy + m} Q ${L - 8} ${cy} ${L} ${cy - m}`, L, cy - m, `l -4 6 l 8 -1`)}
                </>
              )
            })()}
            {/* 섹터 점 + 겹침방지 라벨 */}
            {laid.map(({ it, x, y, ly, side }) => {
              const c = QC[it.quadrant], on = sel === it.key
              const lx = side === 'r' ? x + 8 : x - 8
              return (
                <g key={it.key} onClick={() => setSel(it.key)} style={{ cursor: 'pointer' }}>
                  {Math.abs(ly - y) > 4 && <line x1={x} y1={y} x2={lx} y2={ly} stroke={c} strokeWidth={0.5} opacity={0.3} />}
                  <circle cx={x} cy={y} r={on ? 6 : 4.5} fill={c} stroke={on ? '#fff' : c} strokeWidth={on ? 1.5 : 0} />
                  {it.group === 'theme' && <circle cx={x} cy={y} r={on ? 9 : 7.5} fill="none" stroke={c} strokeWidth={0.9} opacity={0.55} />}
                  <text x={lx} y={ly + 3} textAnchor={side === 'r' ? 'start' : 'end'} fontSize={7.2} fontWeight={on ? 800 : 600} fill={on ? '#fff' : '#c3cdd9'}>{it.emoji}{FULL[it.key] ?? it.label}</text>
                </g>
              )
            })}
          </svg>
          <div style={{ fontSize: 10, color: '#6e7f8f', padding: '0 8px 6px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>◯ 테두리 = 테마 섹터</span><span>중앙=평균 · 우=강함 · 상=가속</span><span>점 클릭 → 드릴다운</span>
          </div>
        </div>

        {/* 자금 순환 랭킹 */}
        <div style={{ flex: '1 1 240px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>💰 자금 순환 랭킹</div>
          <Rank title="🔥 유입 Top (돈 몰림)" color="#22c55e" items={data.inflow} onSel={setSel} sel={sel} />
          <div style={{ height: 10 }} />
          <Rank title="❄️ 이탈 Top (돈 빠짐)" color="#94a3b8" items={data.outflow} onSel={setSel} sel={sel} />
          <div style={{ fontSize: 10, color: '#6e7f8f', marginTop: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 8, lineHeight: 1.5 }}>
            쏠림 점수 = 상대강도(1M) 0.6 + 모멘텀(1W) 0.4. 17섹터 평균 대비 %p. 가격 상대강도 기준(수급의 결과=가격). 옆 사분면 배지로 국면 확인 — ❄️태동은 아직 약하나 모멘텀이 돌기 시작(순점수 낮아도 이탈과 결이 다름).
          </div>
        </div>
      </div>

      {/* 🎯 소섹터 통합 실전 랭킹 — 매수 후보 vs 매도·익절 (드릴다운 카드와 동일 SSOT) */}
      {(data.buys?.length || data.sells?.length) ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {/* 매수 후보 */}
          <div style={{ flex: '1.2 1 340px', background: 'linear-gradient(135deg,#10241a,#0d1017)', border: '1px solid #22c55e44', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#4ade80' }}>🎯 실전 매수 후보 랭킹 — 돈 몰리며 실제로 오르는 소섹터</div>
            <div style={{ fontSize: 10, color: '#7f93a8', margin: '3px 0 10px' }}>매수 게이트(상대강세+주간상승+추세유지) 통과 소섹터만 · 오른쪽 <b style={{ color: '#a8b5c2' }}>+N점 = 쏠림 점수</b>(섹터 쏠림+소섹터 쏠림, 평균 대비 %p — 수익률 아님) · <b style={{ color: '#a8b5c2' }}>줄을 클릭하면 아래에 상세가 펼쳐집니다</b></div>
            {data.buys?.length ? data.buys.map((p, i) => (
              <div key={p.sectorKey + p.subKey} onClick={() => setSel(p.sectorKey)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: i === 0 ? '#14532d33' : 'transparent', border: i === 0 ? '1px solid #22c55e44' : '1px solid transparent', marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: i < 3 ? 14 : 10, width: 22, textAlign: 'center', color: '#8599ae', fontWeight: 700 }}>{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                  <span style={{ color: '#8599ae', fontWeight: 500 }}>{it2(p.sectorEmoji, FULL[p.sectorKey] ?? p.sectorLabel)} › </span>{p.subEmoji}{p.subLabel}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: QC[p.q], background: QC[p.q] + '22', borderRadius: 4, padding: '1px 5px' }}>{QI[p.q]}{QN[p.q]}</span>
                <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#8599ae' }}>1주 <b style={{ color: pcol(p.ret1w) }}>{pfmt(p.ret1w)}</b> · 1년 <b style={{ color: pcol(p.ret1y) }}>{pfmt(p.ret1y)}</b></span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                  {p.etfUs && <b style={{ background: '#14532d', color: '#4ade80', border: '1px solid #22c55e55', borderRadius: 5, padding: '1px 7px', fontSize: 10 }}>🇺🇸 {p.etfUs}</b>}
                  {p.etfKr && <b style={{ background: '#14532d', color: '#4ade80', border: '1px solid #22c55e55', borderRadius: 5, padding: '1px 7px', fontSize: 10 }}>🇰🇷 {p.etfKr}</b>}
                  <b style={{ color: '#4ade80', fontSize: 11, fontFamily: 'monospace' }}>+{p.total}점</b>
                </span>
              </div>
            )) : <div style={{ fontSize: 11, color: '#8599ae', padding: '6px 8px' }}>⏳ 지금은 매수 게이트를 통과한 소섹터가 없습니다 — 반등 확인 후.</div>}
          </div>
          {/* 매도·익절 신호 */}
          <div style={{ flex: '1 1 300px', background: 'linear-gradient(135deg,#241710,#0d1017)', border: '1px solid #f59e0b44', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fbbf24' }}>⚠️ 매도·익절 신호 — 돈 빠지기 시작한 소섹터</div>
            <div style={{ fontSize: 10, color: '#7f93a8', margin: '3px 0 10px' }}>과열(강했으나 모멘텀 반전) 소섹터 · 이탈 심한 순 · 1년+ = 익절 / 1년− = 비중 축소</div>
            {data.sells?.length ? data.sells.map((p, i) => (
              <div key={p.sectorKey + p.subKey} onClick={() => setSel(p.sectorKey)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, width: 16, textAlign: 'center', color: '#8599ae', fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                  <span style={{ color: '#8599ae', fontWeight: 500 }}>{it2(p.sectorEmoji, FULL[p.sectorKey] ?? p.sectorLabel)} › </span>{p.subEmoji}{p.subLabel}
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: p.profit ? '#fbbf24' : '#f87171', background: (p.profit ? '#f59e0b' : '#ef4444') + '22', borderRadius: 4, padding: '1px 6px' }}>{p.profit ? '💰 분할 익절' : '✂️ 비중 축소'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, fontFamily: 'monospace', color: '#8599ae' }}>1주 <b style={{ color: pcol(p.ret1w) }}>{pfmt(p.ret1w)}</b> · 1년 <b style={{ color: pcol(p.ret1y) }}>{pfmt(p.ret1y)}</b>{p.etfUs || p.etfKr ? <span style={{ color: '#a78b6d' }}> · {[p.etfUs, p.etfKr].filter(Boolean).join('·')}</span> : null}</span>
              </div>
            )) : <div style={{ fontSize: 11, color: '#8599ae', padding: '6px 8px' }}>현재 매도 신호 소섹터 없음.</div>}
          </div>
        </div>
      ) : null}

      {/* 드릴다운 */}
      {sel ? (
        <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#8599ae', marginBottom: 6, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>🔎 <b style={{ color: '#cbd5e1' }}>{FULL[sel] ?? sel} 드릴다운</b> — 소섹터 카드 + 미국·한국 대표종목</span>
            {data.inflow?.[0]?.key === sel && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#4ade80', background: '#14532d55', border: '1px solid #22c55e44', borderRadius: 5, padding: '1px 7px' }}>🔥 자금 유입 1위 — 기본 표시</span>}
            <span style={{ marginLeft: 'auto', color: '#6e7f8f' }}>👆 다른 섹터가 궁금하면 위 시계의 점이나 랭킹 줄을 클릭하세요</span>
          </div>
          <SectorCanvas sectorKey={sel} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: '#8599ae', textAlign: 'center', padding: '10px 0' }}>👆 시계의 섹터 점이나 랭킹을 클릭하면 소섹터·대표종목이 여기 펼쳐집니다.</div>
      )}

      <div style={{ fontSize: 10.5, color: '#6e7f8f', lineHeight: 1.6, padding: '0 4px' }}>
        ⚠️ 🌱주도(강+가속)·🔥과열(강했으나 둔화·차익경계)·🍂이탈(약+둔화)·❄️태동(약했으나 가속·역발상 매집징후) — 막스 시계추와 같은 철학(과열은 경계, 소외+반등은 기회). 예측 아닌 현재 위치. 섹터 수익률은 섹터 탭과 동일(제2원칙). 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}

function Rank({ title, color, items, onSel, sel }: { title: string; color: string; items: RotationItem[]; onSel: (k: string) => void; sel: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color, marginBottom: 5 }}>{title}</div>
      {items.length ? items.map((it, i) => (
        <div key={it.key} onClick={() => onSel(it.key)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: sel === it.key ? '#1b2230' : 'transparent', marginBottom: 2 }}>
          <span style={{ color: '#6e7f8f', fontSize: 10, width: 12 }}>{i + 1}</span>
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, flex: 1 }}>{it.emoji} {it.label.replace(/\s*\(.*\)/, '')}</span>
          <span style={{ fontSize: 9.5, color: QC[it.quadrant], fontWeight: 700, marginRight: 2 }}>{QI[it.quadrant]}{QN[it.quadrant]}</span>
          <span style={{ color, fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{it.score >= 0 ? '+' : ''}{it.score}</span>
        </div>
      )) : <div style={{ fontSize: 10.5, color: '#6e7f8f', padding: '4px 6px' }}>해당 없음</div>}
    </div>
  )
}
