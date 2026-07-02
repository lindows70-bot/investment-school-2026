'use client'
// 🌊 레이 달리오 매크로 투자 철학 — ①부채 사이클(실데이터 진단) ②빅 사이클(교육) ③All Weather(SSOT+백테스트)
// 데이터: /api/dalio-cycle (FRED 실데이터·macro-regime 계절 SSOT·Yahoo 20년 백테스트).
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import type { DalioCycleResult } from '@/app/api/dalio-cycle/route'

const CARD = '#12151c', BORDER = '#252a36', GOLD = '#d4af7a'

// 부채 사이클 6단계
const STAGES = ['초기\n(정상 확장)', '버블\n(후기)', '정점\n(긴축 압력)', '불황\n(디플레)', '아름다운\n디레버리징', '정상화']
const LEAN_COLOR: Record<string, string> = { early: '#4ade80', late: '#f87171', stimulus: '#60a5fa', neutral: '#8599ae' }
const BUBBLE_COLOR: Record<string, string> = { hot: '#f87171', warm: '#fbbf24', cool: '#4ade80', link: '#8599ae' }
const SEASON_KO: Record<string, string> = { goldilocks: '골디락스(봄)', inflation: '인플레이션(여름)', stagflation: '스태그플레이션(가을)', recession: '리세션(겨울)', shoulder: '간절기', unknown: '—' }

export default function RayDalioAnalysis() {
  const [d, setD] = useState<DalioCycleResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/dalio-cycle', { cache: 'no-store' }).then(r => r.json()).then(x => (x.error ? setErr(true) : setD(x))).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── INTRO ── */}
      <div style={{ background: `linear-gradient(135deg, #0f1830, ${CARD})`, borderRadius: 14, border: `1px solid ${GOLD}44`, padding: '18px 22px' }}>
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 20 }}>🌊 레이 달리오 — 사이클로 세상을 읽다</div>
        <div style={{ color: '#aab6c4', fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>
          세계 최대 헤지펀드 <b style={{ color: '#e2e8f0' }}>브릿지워터</b>의 창업자. 그의 핵심 통찰은 <b style={{ color: GOLD }}>&ldquo;역사는 반복된다 — 부채·화폐·권력은 거대한 사이클로 움직인다&rdquo;</b>입니다.
          두 저서 『금융 위기 템플릿』(부채 사이클)과 『변화하는 세계질서』(빅 사이클)의 핵심을, <b style={{ color: '#e2e8f0' }}>현재 실데이터로</b> 진단합니다.
        </div>
        {d && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {[['총부채/GDP', `${d.debt.debtGdp}%`, d.debt.debtGdpTrend === 'up' ? '▲' : ''], ['실질금리', `${d.debt.realRate}%`, ''], ['장단기차', `${d.debt.yieldCurve > 0 ? '+' : ''}${d.debt.yieldCurve}%p`, ''], ['연준 대차대조표', d.debt.fedBsTrend === 'contracting' ? 'QT(긴축)' : d.debt.fedBsTrend === 'expanding' ? 'QE(완화)' : '유지', '']].map(([k, v, t]) => (
              <div key={k} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 13px', minWidth: 110 }}>
                <div style={{ color: '#7f93a8', fontSize: 10 }}>{k}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15 }}>{v} <span style={{ color: '#f87171', fontSize: 12 }}>{t}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>실데이터로 달리오 사이클을 진단 중입니다…</div>}

      {d && <>
        {/* ── ① 부채 사이클 ── */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>① 부채 사이클 — 『금융 위기 템플릿』</div>
          <div style={{ color: '#8a9aaa', fontSize: 11, marginBottom: 10 }}>신용의 팽창→붕괴→회복 6단계. 실데이터로 현재 위치를 추정합니다(단정 아님).</div>

          {/* 6단계 아크 */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', background: '#0f1117', borderRadius: 10, padding: '14px 10px 8px', marginBottom: 10 }}>
            {STAGES.map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', margin: '0 auto 5px',
                  background: i === d.debt.stageIndex ? GOLD : '#2a3242', border: i === d.debt.stageIndex ? `2px solid #fff` : 'none',
                  boxShadow: i === d.debt.stageIndex ? `0 0 12px ${GOLD}` : 'none' }} />
                <div style={{ color: i === d.debt.stageIndex ? GOLD : '#7f93a8', fontSize: 9.5, fontWeight: i === d.debt.stageIndex ? 800 : 500, whiteSpace: 'pre-line', lineHeight: 1.2 }}>{s}</div>
                {i === d.debt.stageIndex && <div style={{ color: GOLD, fontSize: 9, marginTop: 2 }}>📍 현재 추정</div>}
              </div>
            ))}
          </div>
          <div style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}44`, borderRadius: 9, padding: '8px 12px', marginBottom: 10 }}>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>📍 {d.debt.stageLabel}</span>
            <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.6, marginTop: 3 }}>{d.debt.stageNote}</div>
          </div>

          {/* 근거 신호 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.debt.signals.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 150, color: '#cdd6e3' }}>{s.label}</span>
                <span style={{ width: 60, color: '#e2e8f0', fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</span>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: LEAN_COLOR[s.lean], flexShrink: 0 }} />
                <span style={{ color: '#9aa7b5', fontSize: 11 }}>{s.reading}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 버블 7지표 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>🫧 달리오의 버블 지표</span>
            <span style={{ background: `${d.bubble.level === '과열' ? '#f87171' : d.bubble.level === '주의' ? '#fbbf24' : '#4ade80'}22`, color: d.bubble.level === '과열' ? '#f87171' : d.bubble.level === '주의' ? '#fbbf24' : '#4ade80', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{d.bubble.level} ({d.bubble.score})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.bubble.factors.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: BUBBLE_COLOR[f.status], flexShrink: 0 }} />
                <span style={{ width: 160, color: '#cdd6e3', fontWeight: 600 }}>{f.label}</span>
                <span style={{ color: '#9aa7b5', fontSize: 11 }}>{f.note}</span>
              </div>
            ))}
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8 }}>🔴과열 🟡주의 🟢냉각 ⚪앱 내 다른 지표로 확인 · 달리오: &ldquo;버블은 싼 신용 + 투기 열풍이 겹칠 때 터진다&rdquo;</div>
        </div>

        {/* 역사 오버레이 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14, marginBottom: 3 }}>📜 역사는 반복된다 — 현재 vs 과거 위기</div>
          <div style={{ color: '#8a9aaa', fontSize: 11, marginBottom: 10 }}>같은 지표를 2008(글로벌 금융위기)·2020(팬데믹)과 나란히 — 실데이터</div>
          {d.history.map(h => (
            <div key={h.metric} style={{ marginBottom: 8 }}>
              <div style={{ color: '#cdd6e3', fontSize: 11.5, fontWeight: 600, marginBottom: 2 }}>{h.metric}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['현재', h.now, GOLD], ['2008', h.y2008, '#f87171'], ['2020', h.y2020, '#60a5fa']].map(([lb, v, c]) => (
                  <div key={lb as string} style={{ flex: 1, background: '#0f1117', borderRadius: 8, padding: '6px 10px', borderLeft: `3px solid ${c}` }}>
                    <span style={{ color: '#7f93a8', fontSize: 10 }}>{lb}</span>
                    <div style={{ color: c as string, fontWeight: 800, fontSize: 14 }}>{v}{h.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── ② 빅 사이클(교육) ── */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>② 빅 사이클 — 『변화하는 세계질서』</div>
          <div style={{ color: '#8a9aaa', fontSize: 11, marginBottom: 10 }}>제국의 흥망성쇠(수백 년 주기). 지정학은 실시간 데이터가 없어 이 섹션은 교육 중심입니다.</div>

          {/* 제국 수명 곡선 */}
          <svg viewBox="0 0 600 150" style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 10 }}>
            <path d="M 20 130 Q 150 130 220 60 T 400 40 Q 480 45 580 120" fill="none" stroke={GOLD} strokeWidth="2.5" />
            {[['창업·부흥', 120, 60, '#4ade80'], ['평화·번영 (정점)', 400, 40, '#fbbf24'], ['쇠퇴·혼란', 540, 110, '#f87171']].map(([l, x, y, c]) => (
              <g key={l as string}>
                <circle cx={x as number} cy={y as number} r="5" fill={c as string} />
                <text x={x as number} y={(y as number) - 10} fill="#e2e8f0" fontSize="11" fontWeight="700" textAnchor="middle">{l}</text>
              </g>
            ))}
            {/* 미국 현재 위치 표시(정점~쇠퇴 사이 — 교육용 정성 표시) */}
            <circle cx="455" cy="55" r="6" fill="none" stroke="#fff" strokeWidth="2" />
            <text x="455" y="80" fill="#fff" fontSize="10" fontWeight="800" textAnchor="middle">🇺🇸 미국(추정)</text>
          </svg>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 10 }}>
            {[
              ['💰 부채·화폐 사이클', '통화 남발 → 화폐가치 하락 → 부채 위기. 기축통화도 결국 신뢰를 잃는다.', '#60a5fa'],
              ['⚖️ 내부 질서 사이클', '빈부격차 확대 → 포퓰리즘·갈등 격화 → 내부 혼란. 부의 집중이 임계에 달하면 재편.', '#fbbf24'],
              ['🌏 외부 질서 사이클', '기존 패권국(미국) vs 신흥 도전국(중국). 무역·기술·군사 경쟁이 질서를 재편한다.', '#f87171'],
            ].map(([t, desc, c]) => (
              <div key={t as string} style={{ background: '#0f1117', borderRadius: 9, padding: '9px 12px', borderTop: `2px solid ${c}` }}>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12 }}>{t}</div>
                <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.5, marginTop: 3 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ color: '#cdd6e3', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>제국 경쟁력 8대 지표 (달리오)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['🎓 교육', '💡 혁신·기술', '⚔️ 군사력', '🚢 무역량', '🏭 경제 산출', '🏦 금융 중심', '💵 기축통화', '🏛️ 거버넌스'].map(x => (
              <span key={x} style={{ background: 'rgba(212,175,122,0.1)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 6, padding: '3px 9px', fontSize: 10.5, fontWeight: 600 }}>{x}</span>
            ))}
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>⚠️ 이 8대 지표의 국가별 실시간 점수는 브릿지워터 독자 데이터라 공개 실데이터가 없습니다 — 개념 교육으로만 제공합니다. 실앵커(미국 vs 중국 GDP·기축통화 점유율)는 향후 발표치 기준으로 보강 가능.</div>
        </div>

        {/* ── ③ All Weather ── */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>③ 전천후(All Weather) 포트폴리오 — 실전 적용</div>
          <div style={{ color: '#8a9aaa', fontSize: 11, marginBottom: 10 }}>달리오: &ldquo;미래는 모른다. 어떤 계절이 와도 견디는 균형을 짜라.&rdquo;</div>

          {/* 성장×물가 4분면 — 현재 계절 강조(우리 SSOT) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              ['goldilocks', '성장↑ 물가↓ · 골디락스', '주식·회사채', '#4ade80'],
              ['inflation', '성장↑ 물가↑ · 인플레이션', '원자재·물가연동채·주식', '#fbbf24'],
              ['recession', '성장↓ 물가↓ · 리세션', '장기국채·현금', '#60a5fa'],
              ['stagflation', '성장↓ 물가↑ · 스태그플레이션', '금·원자재·물가연동채', '#f87171'],
            ].map(([q, title, assets, c]) => {
              const cur = d.allWeather.usSeason === q
              return (
                <div key={q as string} style={{ background: cur ? `${c}1e` : '#0f1117', border: `1px solid ${cur ? c as string : BORDER}`, borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ color: c as string, fontWeight: 800, fontSize: 11.5 }}>{title}{cur && ' 📍현재'}</div>
                  <div style={{ color: '#9aa7b5', fontSize: 10.5, marginTop: 2 }}>유리 자산: {assets}</div>
                </div>
              )
            })}
          </div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 12 }}>📍 현재 계절 = <b style={{ color: GOLD }}>{SEASON_KO[d.allWeather.usSeason] ?? d.allWeather.usSeason}</b> (우리 4계절 내비게이터와 동일 SSOT). 달리오는 <b style={{ color: '#e2e8f0' }}>4계절 각각에 위험을 균등 분산</b>해 어떤 계절이든 견디게 합니다.</div>

          {/* 리스크 패리티 배분 */}
          <div style={{ background: '#0f1117', borderRadius: 9, padding: '10px 13px', marginBottom: 12 }}>
            <div style={{ color: '#cdd6e3', fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>전천후 자산 배분(리스크 패리티)</div>
            <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
              {[['주식', 30, '#4ade80'], ['장기채', 40, '#60a5fa'], ['중기채', 15, '#22d3ee'], ['금', 7.5, '#fbbf24'], ['원자재', 7.5, '#fb923c']].map(([l, w, c]) => (
                <div key={l as string} title={`${l} ${w}%`} style={{ width: `${w}%`, background: c as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, color: '#0f1117', fontWeight: 800 }}>{w as number >= 10 ? `${l} ${w}%` : ''}</div>
              ))}
            </div>
            <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.5 }}>💡 <b style={{ color: '#93c5fd' }}>핵심 = 리스크 패리티</b>: 채권 55%는 <b>금액</b>이 크지만 변동성이 작아 <b>위험 기여도</b>는 주식과 비슷해집니다. &ldquo;금액이 아니라 위험을 똑같이 나눈다&rdquo;가 전천후의 발명입니다.</div>
          </div>

          {/* 백테스트 — AW vs SPY 누적 */}
          {d.allWeather.years.length > 3 && <AwBacktest years={d.allWeather.years} cagr={d.allWeather.cagr} worst={d.allWeather.worstYear} />}
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 8 }}>{d.allWeather.note}</div>
        </div>

        {/* 정적 vs 동적 교육 */}
        <div style={{ background: 'rgba(212,175,122,0.06)', border: `1px solid ${GOLD}33`, borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🎓 달리오 All Weather(정적) vs 우리 4계절·퀀트빌더(동적)</div>
          <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.7 }}>
            달리오의 전천후는 <b style={{ color: '#e2e8f0' }}>사시사철 같은 배분</b>을 유지하는 <b>전략적 자산배분</b>입니다(미래를 못 맞히니 항상 균형). 반면 이 앱의 <b style={{ color: '#e2e8f0' }}>4계절 내비게이터·퀀트빌더</b>는 현재 계절을 판단해 <b>비중을 바꾸는 전술적 배분</b>이죠.
            정답은 없습니다 — 전천후는 <b>2008년 방어에 강했지만(위 백테스트), 2022년 금리 쇼크엔 채권·주식이 함께 빠져 약했습니다</b>. &ldquo;모든 계절&rdquo;이라는 이름에도 완벽한 전략은 없다는 게 정직한 교훈입니다.
          </div>
        </div>
      </>}
    </div>
  )
}

// All Weather vs S&P500 누적 성장($1 기준)
function AwBacktest({ years, cagr, worst }: { years: { year: string; awPct: number; spyPct: number }[]; cagr: number; worst: { year: string; pct: number } | null }) {
  let aw = 1, spy = 1
  const data = years.map(y => { aw *= 1 + y.awPct / 100; spy *= 1 + y.spyPct / 100; return { year: y.year, AW: Math.round(aw * 100) / 100, SPY: Math.round(spy * 100) / 100 } })
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, fontSize: 11 }}>
        <span style={{ color: '#4ade80' }}>■ 전천후 CAGR <b>{cagr}%/년</b></span>
        {worst && <span style={{ color: '#f87171' }}>최악의 해 {worst.year} <b>{worst.pct}%</b></span>}
        <span style={{ color: '#8a9aaa' }}>$1이 {years.length}년간 몇 배로(누적)</span>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fill: '#7f93a8', fontSize: 9.5 }} minTickGap={30} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v: number) => `${v}x`} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, n: any) => [`${v}x`, n === 'AW' ? '전천후' : 'S&P500']} />
            <ReferenceLine x="2008" stroke="#f8717166" strokeDasharray="3 3" label={{ value: '2008', fill: '#f87171', fontSize: 9, position: 'top' }} />
            <ReferenceLine x="2022" stroke="#f8717166" strokeDasharray="3 3" label={{ value: '2022', fill: '#f87171', fontSize: 9, position: 'top' }} />
            <Line type="monotone" dataKey="AW" stroke="#4ade80" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="SPY" stroke="#8599ae" strokeWidth={1.6} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
