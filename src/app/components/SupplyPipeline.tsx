'use client'
// 🏗️ 공급 파이프라인 — 인허가→착공→준공(입주) 3단계 시차 차트 + 지역별 미분양(부동산판 주글라르).
//    "3년 전 착공이 오늘의 입주물량" — 벌집(수요 국면)의 반쪽인 공급 사이클을 채움. 판정은 역사 백분위(결정론).
import { useState, useEffect, useMemo } from 'react'
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TK } from '@/lib/theme'
import type { SupplyApi } from '@/app/api/re-supply/route'

const CARD = TK.card, BORDER = TK.border

const VERDICT_META = {
  cliff: { icon: '🏜️', label: '공급 절벽 예고', color: TK.orange400, desc: '인허가·착공이 역사 하위 25% — 2~3년 뒤 입주물량 감소 가능성(공급 부족은 가격을 받침)' },
  glut: { icon: '🌊', label: '공급 확대 구간', color: TK.sky400, desc: '인허가·착공이 역사 상위 25% — 2~3년 뒤 입주 부담 가능성(공급 과잉은 가격을 누름)' },
  neutral: { icon: '⚖️', label: '공급 중립', color: TK.sub, desc: '인허가·착공이 역사 중간 범위 — 공급발 충격 신호 없음' },
} as const

const fmtHo = (n: number | null) => n == null ? '—' : n >= 10000 ? `${(n / 10000).toFixed(1)}만호` : `${Math.round(n).toLocaleString()}호`

export default function SupplyPipeline() {
  const [data, setData] = useState<SupplyApi | null>(null)
  const [region, setRegion] = useState('전국')
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/re-supply').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) { if (j?.regions) setData(j); else setErr(true) } })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  const sel = data?.regions.find(r => r.name === region) ?? null
  const chart = useMemo(() => (sel?.points ?? []).filter(x => x.p != null || x.s != null || x.c != null).map(x => ({
    ym: `${x.t.slice(0, 4)}-${x.t.slice(4)}`, 인허가: x.p, 분양: x.b, 착공: x.s, 준공: x.c, 미분양: x.u,
  })), [sel])

  if (err) return null
  const vm = sel ? VERDICT_META[sel.verdict] : null

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
        <b style={{ fontSize: 14, color: TK.slate100 }}>🏗️ 공급 파이프라인</b>
        <span style={{ fontSize: 10.5, color: TK.sub2 }}>인허가 → 분양 → 착공 → (2~3년) 준공=입주 — 벌집(수요)의 반대편, 공급 사이클. 12개월 누적 기준</span>
      </div>

      {!data ? (
        <div style={{ color: TK.sub, fontSize: 12, padding: '18px 0' }}>🏗️ 공급 통계(인허가·착공·준공·미분양)를 수집 중…</div>
      ) : (
        <>
          {/* 지역 선택 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {data.regions.map(r => (
              <button key={r.name} onClick={() => setRegion(r.name)} style={{
                padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: region === r.name ? TK.orange400 : TK.bg3, color: region === r.name ? TK.bg1 : TK.slate300,
                border: `1px solid ${region === r.name ? TK.orange400 : BORDER}`,
              }}>{VERDICT_META[r.verdict].icon} {r.name}</button>
            ))}
          </div>

          {sel && vm && (
            <>
              {/* 판정 배너 + KPI */}
              <div style={{ marginTop: 10, background: TK.bg3, border: `1px solid ${vm.color}44`, borderRadius: 10, padding: '10px 14px' }}>
                <b style={{ fontSize: 13, color: vm.color }}>{vm.icon} {sel.name} — {vm.label}</b>
                <div style={{ fontSize: 11, color: TK.sub9, marginTop: 3, lineHeight: 1.55 }}>{vm.desc}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 8 }}>
                {([
                  ['📋 인허가(12개월)', sel.latest.permitTtm, sel.latest.permitPct, '미래 공급의 씨앗'],
                  ['🏷️ 분양(12개월)', sel.latest.presaleTtm, sel.latest.presalePct, '시장에 예고된 물량(2015~)'],
                  ['🚧 착공(12개월)', sel.latest.startTtm, sel.latest.startPct, '2~3년 뒤 입주 예고'],
                  ['🏢 준공=입주(12개월)', sel.latest.compTtm, sel.latest.compPct, '지금 시장에 풀리는 물량'],
                  ['📦 미분양(현재)', sel.latest.unsold, sel.latest.unsoldPct, '팔리지 않은 재고'],
                ] as [string, number | null, number | null, string][]).map(([label, v, pct, desc]) => (
                  <div key={label} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 12px' }}>
                    <div style={{ color: TK.sub, fontSize: 10, fontWeight: 700 }}>{label}</div>
                    <div style={{ color: TK.slate100, fontSize: 16, fontWeight: 900, fontFamily: 'monospace' }}>{fmtHo(v)}</div>
                    <div style={{ fontSize: 9.5, color: pct == null ? TK.sub2 : pct <= 25 ? TK.orange400 : pct >= 75 ? TK.sky400 : TK.sub2 }}>
                      역사 백분위 {pct != null ? `${pct}%` : '—'} · {desc}
                    </div>
                  </div>
                ))}
              </div>

              {/* 3단계 + 미분양 차트 */}
              <div style={{ height: 300, marginTop: 12 }}>
                <ResponsiveContainer>
                  <ComposedChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="ym" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.max(1, Math.floor(chart.length / 10))} />
                    <YAxis yAxisId="l" tick={{ fill: TK.sub, fontSize: 10 }} width={46} tickFormatter={v => `${Math.round(v / 10000)}만`} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fill: TK.amber400, fontSize: 10 }} width={44} tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)} />
                    <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any, name: any) => [fmtHo(v as number), name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area yAxisId="r" type="monotone" dataKey="미분양" fill={`${TK.amber400}22`} stroke={TK.amber400} strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                    <Line yAxisId="l" type="monotone" dataKey="인허가" stroke={TK.violet400} strokeWidth={2} dot={false} connectNulls />
                    <Line yAxisId="l" type="monotone" dataKey="분양" stroke={TK.pink400} strokeWidth={1.6} dot={false} connectNulls />
                    <Line yAxisId="l" type="monotone" dataKey="착공" stroke={TK.teal400} strokeWidth={2} dot={false} connectNulls />
                    <Line yAxisId="l" type="monotone" dataKey="준공" stroke={TK.slate100} strokeWidth={1.6} dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 교육 캐비엇 */}
              <div style={{ fontSize: 10.5, color: TK.sub, lineHeight: 1.65, marginTop: 8 }}>
                🎓 <b style={{ color: TK.slate300 }}>읽는 법</b> — 인허가·착공(보라·청록)은 <b style={{ color: TK.slate300 }}>미래 공급</b>, 준공(흰색)은 <b style={{ color: TK.slate300 }}>지금 입주 물량</b>입니다.
                인허가·착공이 꺾인 지 2~3년 뒤 준공이 줄어드는 시차를 눈으로 확인하세요 — &ldquo;오늘의 공급 절벽이 내일의 가격 압력&rdquo;.
                단, 공급은 가격의 한 축일 뿐(수요=금리·심리와 함께) · 인허가≠전부 착공(취소·지연 존재) · 착공·준공은 2011년~ 제공. 출처: 국토교통부(ECOS·부동산원 재배포) · 교육용 관측 도구.
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
