'use client'
// 🧭 섹터 로테이션 시계 — 17섹터(GICS 11+테마 6)를 상대강도×모멘텀 4사분면에. 클릭 시 드릴다운(SectorCanvas).
import { useEffect, useState } from 'react'
import type { RotationResult, RotationItem, Quadrant } from '@/app/api/sector-rotation/route'
import SectorCanvas from '@/app/components/SectorCanvas'

const BORDER = '#2a2f3a'
const QC: Record<Quadrant, string> = { leading: '#22c55e', weakening: '#ef4444', lagging: '#94a3b8', improving: '#38bdf8' }

export default function SectorRotation() {
  const [data, setData] = useState<RotationResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sector-rotation').then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j)))
      .then(j => j.error ? setErr(j.error) : setData(j))
      .catch(j => setErr(j?.error || '로테이션 데이터를 불러오지 못했습니다. 섹터 탭을 몇 개 방문하면 캐시가 채워집니다.'))
  }, [])

  if (err) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>⚠️ {err}</div>
  if (!data) return <div style={{ padding: 24, color: '#8599ae', textAlign: 'center', fontSize: 13 }}>🧭 섹터 자금 순환 계산 중… (17개 섹터 집계)</div>

  // ── 시계 좌표 ──
  const cx = 250, cy = 235, halfW = 205, halfH = 190
  const maxRs = Math.max(1, ...data.items.map(i => Math.abs(i.rs)))
  const maxMom = Math.max(1, ...data.items.map(i => Math.abs(i.mom)))
  const px = (rs: number) => cx + (rs / maxRs) * halfW * 0.92
  const py = (mom: number) => cy - (mom / maxMom) * halfH * 0.92

  const short = (label: string) => label.replace(/\s*\(.*\)/, '').slice(0, 6)

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
          <svg viewBox="0 0 500 480" style={{ width: '100%' }}>
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
            {/* 시계방향 화살표 */}
            <path d={`M ${cx + 150} ${cy - 150} A 150 150 0 0 1 ${cx + 150} ${cy + 150}`} fill="none" stroke="#8599ae" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
            <path d={`M ${cx + 150} ${cy + 150} l -7 -8 l 11 1 z`} fill="#8599ae" opacity={0.5} />
            {/* 섹터 점 */}
            {data.items.map(it => {
              const x = px(it.rs), y = py(it.mom), c = QC[it.quadrant], on = sel === it.key
              return (
                <g key={it.key} onClick={() => setSel(it.key)} style={{ cursor: 'pointer' }}>
                  <circle cx={x} cy={y} r={on ? 7 : 5} fill={c} stroke={on ? '#fff' : c} strokeWidth={on ? 1.6 : 0} />
                  {it.group === 'theme' && <circle cx={x} cy={y} r={on ? 10 : 8} fill="none" stroke={c} strokeWidth={0.9} opacity={0.6} />}
                  <text x={x + (x > cx ? -9 : 9)} y={y + 3.2} textAnchor={x > cx ? 'end' : 'start'} fontSize={9} fontWeight={on ? 800 : 600} fill={on ? '#fff' : '#cbd5e1'}>{it.emoji}{short(it.label)}</text>
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
            쏠림 점수 = 상대강도(1M) 0.6 + 모멘텀(1W) 0.4. 17섹터 평균 대비 %p. 가격 상대강도 기준(수급의 결과=가격).
          </div>
        </div>
      </div>

      {/* 드릴다운 */}
      {sel ? (
        <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#8599ae', marginBottom: 6 }}>🔎 드릴다운 — 소섹터 카드 + 미국·한국 대표종목</div>
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
          <span style={{ color, fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{it.score >= 0 ? '+' : ''}{it.score}</span>
        </div>
      )) : <div style={{ fontSize: 10.5, color: '#6e7f8f', padding: '4px 6px' }}>해당 없음</div>}
    </div>
  )
}
