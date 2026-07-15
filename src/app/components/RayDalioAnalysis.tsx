'use client'
// 🌊 레이 달리오 매크로 투자 철학 — ①부채 사이클(실데이터 진단) ②빅 사이클(교육) ③All Weather(SSOT+백테스트)
// 데이터: /api/dalio-cycle (FRED 실데이터·macro-regime 계절 SSOT·Yahoo 20년 백테스트).
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import type { DalioCycleResult } from '@/app/api/dalio-cycle/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg4, BORDER = TK.line3, GOLD = '#d4af7a'

// 부채 사이클 6단계 (카드형)
const STAGE_CARDS = [
  { title: '초기 정상 확장', desc: '생산적 대출 위주' },
  { title: '버블 국면', desc: '자기강화적 신용 투기' },
  { title: '정점 도달', desc: '역사적 긴축·고금리' },
  { title: '불황(디플레이션)', desc: '디폴트·자산가치 붕괴' },
  { title: '아름다운 디레버리징', desc: '양적완화 + 부채조정' },
  { title: '정상화 회복', desc: '안정화·점진적 재팽창' },
]
const LEAN_COLOR: Record<string, string> = { early: TK.green400, late: TK.red400, stimulus: TK.blue400, neutral: TK.sub3 }
const BUBBLE_COLOR: Record<string, string> = { hot: TK.red400, warm: TK.amber400, cool: TK.green400, link: TK.sub3 }
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
        <div style={{ color: TK.sub5, fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>
          세계 최대 헤지펀드 <b style={{ color: TK.slate200 }}>브릿지워터</b>의 창업자. 그의 핵심 통찰은 <b style={{ color: GOLD }}>&ldquo;역사는 반복된다 — 부채·화폐·권력은 거대한 사이클로 움직인다&rdquo;</b>입니다.
          두 저서 『금융 위기 템플릿』(부채 사이클)과 『변화하는 세계질서』(빅 사이클)의 핵심을, <b style={{ color: TK.slate200 }}>현재 실데이터로</b> 진단합니다.
        </div>
        {d && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {[['총부채/GDP', `${d.debt.debtGdp}%`, d.debt.debtGdpTrend === 'up' ? '▲' : ''], ['실질금리', `${d.debt.realRate}%`, ''], ['장단기차', `${d.debt.yieldCurve > 0 ? '+' : ''}${d.debt.yieldCurve}%p`, ''], ['연준 대차대조표', d.debt.fedBsTrend === 'contracting' ? 'QT(긴축)' : d.debt.fedBsTrend === 'expanding' ? 'QE(완화)' : '유지', '']].map(([k, v, t]) => (
              <div key={k} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 13px', minWidth: 110 }}>
                <div style={{ color: TK.sub2, fontSize: 10 }}>{k}</div>
                <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 15 }}>{v} <span style={{ color: TK.red400, fontSize: 12 }}>{t}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: TK.sub, fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: TK.sub, fontSize: 13 }}>실데이터로 달리오 사이클을 진단 중입니다…</div>}

      {d && <>
        {/* 섹션 퀵내비 */}
        <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 6, flexWrap: 'wrap', background: 'rgba(10,13,20,0.85)', backdropFilter: 'blur(6px)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '7px 9px' }}>
          {[['dalio-debt', '① 부채 사이클'], ['dalio-big', '② 빅 사이클'], ['dalio-aw', '③ All Weather']].map(([id, lb]) => (
            <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ background: 'rgba(212,175,122,0.1)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 7, padding: '4px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{lb}</button>
          ))}
        </div>

        {/* ── ① 부채 사이클 ── */}
        <div id="dalio-debt" style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', scrollMarginTop: 52 }}>
          <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>① 부채 사이클 — 『금융 위기 템플릿』</div>
          <div style={{ color: TK.sub, fontSize: 11, marginBottom: 10 }}>신용의 팽창→붕괴→회복 6단계. 실데이터로 현재 위치를 추정합니다(단정 아님).</div>

          {/* 6단계 카드 — 현재 추정 단계 골드 하이라이트 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 7, marginBottom: 10 }}>
            {STAGE_CARDS.map((s, i) => {
              const cur = i === d.debt.stageIndex
              return (
                <div key={i} style={{ background: cur ? `${GOLD}16` : TK.bg3, border: `1px solid ${cur ? GOLD : BORDER}`, borderRadius: 10, padding: '10px 9px', textAlign: 'center', boxShadow: cur ? `0 0 16px ${GOLD}3a` : 'none' }}>
                  <div style={{ color: cur ? GOLD : TK.sub2, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3 }}>{i + 1}단계</div>
                  <div style={{ color: cur ? GOLD : TK.sub11, fontWeight: 800, fontSize: 12, marginTop: 3 }}>{s.title}</div>
                  <div style={{ color: TK.sub, fontSize: 9.5, lineHeight: 1.4, marginTop: 4 }}>{s.desc}</div>
                  {cur && <div style={{ marginTop: 7, background: GOLD, color: TK.bg3, fontWeight: 800, fontSize: 9, borderRadius: 20, padding: '2px 8px', display: 'inline-block' }}>📍 현재 미국 추정 위치</div>}
                </div>
              )
            })}
          </div>
          <div style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}44`, borderRadius: 9, padding: '8px 12px', marginBottom: 10 }}>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>📍 {d.debt.stageLabel}</span>
            <div style={{ color: TK.sub5, fontSize: 11.5, lineHeight: 1.6, marginTop: 3 }}>{d.debt.stageNote}</div>
          </div>

          {/* 근거 신호 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.debt.signals.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 150, color: TK.sub11 }}>{s.label}</span>
                <span style={{ width: 60, color: TK.slate200, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</span>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: LEAN_COLOR[s.lean], flexShrink: 0 }} />
                <span style={{ color: TK.sub8, fontSize: 11 }}>{s.reading}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 버블 7지표 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>🫧 달리오의 버블 지표</span>
            <span style={{ background: `${d.bubble.level === '과열' ? TK.red400 : d.bubble.level === '주의' ? TK.amber400 : TK.green400}22`, color: d.bubble.level === '과열' ? TK.red400 : d.bubble.level === '주의' ? TK.amber400 : TK.green400, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{d.bubble.level} ({d.bubble.score})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.bubble.factors.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: BUBBLE_COLOR[f.status], flexShrink: 0 }} />
                <span style={{ width: 160, color: TK.sub11, fontWeight: 600 }}>{f.label}</span>
                <span style={{ color: TK.sub8, fontSize: 11 }}>{f.note}</span>
              </div>
            ))}
          </div>
          <div style={{ color: TK.sub2, fontSize: 10, marginTop: 8 }}>🔴과열 🟡주의 🟢냉각 ⚪앱 내 다른 지표로 확인 · 달리오: &ldquo;버블은 싼 신용 + 투기 열풍이 겹칠 때 터진다&rdquo;</div>
        </div>

        {/* 역사 오버레이 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 14, marginBottom: 3 }}>📜 역사는 반복된다 — 현재 vs 과거 위기</div>
          <div style={{ color: TK.sub, fontSize: 11, marginBottom: 10 }}>같은 지표를 2008(글로벌 금융위기)·2020(팬데믹)과 나란히 — 실데이터</div>
          {d.history.map(h => (
            <div key={h.metric} style={{ marginBottom: 8 }}>
              <div style={{ color: TK.sub11, fontSize: 11.5, fontWeight: 600, marginBottom: 2 }}>{h.metric}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['현재', h.now, GOLD], ['2008', h.y2008, TK.red400], ['2020', h.y2020, TK.blue400]].map(([lb, v, c]) => (
                  <div key={lb as string} style={{ flex: 1, background: TK.bg3, borderRadius: 8, padding: '6px 10px', borderLeft: `3px solid ${c}` }}>
                    <span style={{ color: TK.sub2, fontSize: 10 }}>{lb}</span>
                    <div style={{ color: c as string, fontWeight: 800, fontSize: 14 }}>{v}{h.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── ② 빅 사이클(교육) ── */}
        <div id="dalio-big" style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', scrollMarginTop: 52 }}>
          <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>② 빅 사이클 — 『변화하는 세계질서』</div>
          <div style={{ color: TK.sub, fontSize: 11, marginBottom: 10 }}>제국의 흥망성쇠(수백 년 주기). 지정학은 실시간 데이터가 없어 이 섹션은 교육 중심입니다.</div>

          {/* 제국 수명 곡선 — 창업·부흥(초록)→평화·번영 정점(골드)→쇠퇴·혼란(빨강) */}
          <div style={{ background: TK.bg3, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '8px 6px', marginBottom: 10 }}>
            <svg viewBox="0 0 1000 330" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <linearGradient id="dalioArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity="0.20" />
                  <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dalioCurve" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={TK.green400} />
                  <stop offset="42%" stopColor={TK.amber400} />
                  <stop offset="58%" stopColor={TK.amber400} />
                  <stop offset="100%" stopColor={TK.red400} />
                </linearGradient>
              </defs>
              {/* 가이드선 */}
              <line x1="40" y1="72" x2="960" y2="72" stroke={BORDER} strokeDasharray="6 6" />
              <line x1="40" y1="278" x2="960" y2="278" stroke={BORDER} strokeDasharray="6 6" />
              {/* 면적 채움(입체감) */}
              <path d="M 60 278 C 220 278 240 205 320 170 C 400 135 440 72 500 72 C 560 72 600 110 680 142 C 770 176 800 278 940 278 L 940 296 L 60 296 Z" fill="url(#dalioArea)" />
              {/* 곡선(그라디언트 스트로크 + 3색 하이라이트) */}
              <path d="M 60 278 C 220 278 240 205 320 170 C 400 135 440 72 500 72 C 560 72 600 110 680 142 C 770 176 800 278 940 278" fill="none" stroke="url(#dalioCurve)" strokeWidth="6.5" strokeLinecap="round" />
              {/* 노드 점 */}
              <circle cx="220" cy="237" r="7" fill={TK.green400} stroke={TK.bg3} strokeWidth="3" />
              <circle cx="500" cy="72" r="7" fill={TK.amber400} stroke={TK.bg3} strokeWidth="3" />
              <circle cx="791" cy="223" r="7" fill={TK.red400} stroke={TK.bg3} strokeWidth="3" />
              {/* 미국 현재 위치 — 펄스 */}
              <circle cx="680" cy="142" r="9" fill="#fff" stroke={TK.red400} strokeWidth="3">
                <animate attributeName="r" values="8.5;12;8.5" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
              </circle>
              {/* 라벨(외곽선으로 곡선 위에서도 선명) */}
              <g style={{ paintOrder: 'stroke' }} stroke={TK.bg3} strokeWidth="4.5" strokeLinejoin="round">
                <text x="220" y="212" fill={TK.green400} fontSize="15" fontWeight="800" textAnchor="middle">1. 창업 &amp; 부흥기</text>
                <text x="500" y="50" fill={TK.amber400} fontSize="15.5" fontWeight="800" textAnchor="middle">2. 평화 &amp; 번영기 (정점)</text>
                <text x="855" y="238" fill={TK.red400} fontSize="15" fontWeight="800" textAnchor="middle">3. 쇠퇴 &amp; 혼란기</text>
                <text x="680" y="108" fill="#ffffff" fontSize="15.5" fontWeight="800" textAnchor="middle">US 미국 (추정 위치)</text>
                <text x="680" y="127" fill={TK.red300} fontSize="12" fontWeight="700" textAnchor="middle">빈부격차·내부 분열 심화</text>
              </g>
            </svg>
          </div>

          {/* 3 국면 설명 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 10 }}>
            {[
              ['1. 창업 & 부흥기', '새로운 혁신·강력한 리더십·제도적 평화 아래 부채 부담이 적고 생산성이 급증하는 도약 단계.', TK.green400],
              ['2. 평화 & 번영기 (정점)', '기축통화 권력을 쥐고 소비가 늘며 번영하지만, 과도한 소비성 부채·인건비 상승이 내포되기 시작.', TK.amber400],
              ['3. 쇠퇴 & 혼란기', '통화 살포에 따른 화폐가치 하락, 내부 빈부격차發 극단주의, 신흥 패권국과의 마찰이 가중.', TK.red400],
            ].map(([t, desc, c]) => (
              <div key={t as string} style={{ background: `${c}14`, border: `1px solid ${c}44`, borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ color: c as string, fontWeight: 800, fontSize: 12 }}>{t}</div>
                <div style={{ color: TK.sub5, fontSize: 10.5, lineHeight: 1.55, marginTop: 4 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 10 }}>
            {[
              ['💰 부채·화폐 사이클', '통화 남발 → 화폐가치 하락 → 부채 위기. 기축통화도 결국 신뢰를 잃는다.', TK.blue400],
              ['⚖️ 내부 질서 사이클', '빈부격차 확대 → 포퓰리즘·갈등 격화 → 내부 혼란. 부의 집중이 임계에 달하면 재편.', TK.amber400],
              ['🌏 외부 질서 사이클', '기존 패권국(미국) vs 신흥 도전국(중국). 무역·기술·군사 경쟁이 질서를 재편한다.', TK.red400],
            ].map(([t, desc, c]) => (
              <div key={t as string} style={{ background: TK.bg3, borderRadius: 9, padding: '9px 12px', borderTop: `2px solid ${c}` }}>
                <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 12 }}>{t}</div>
                <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.5, marginTop: 3 }}>{desc}</div>
              </div>
            ))}
          </div>

          {d.worldPower && <WorldPower wp={d.worldPower} />}
        </div>

        {/* ── ③ All Weather ── */}
        <div id="dalio-aw" style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', scrollMarginTop: 52 }}>
          <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>③ 전천후(All Weather) 포트폴리오 — 실전 적용</div>
          <div style={{ color: TK.sub, fontSize: 11, marginBottom: 10 }}>달리오: &ldquo;미래는 모른다. 어떤 계절이 와도 견디는 균형을 짜라.&rdquo;</div>

          {/* 성장×물가 4분면 — 현재 계절 강조(우리 SSOT) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              ['goldilocks', '성장↑ 물가↓ · 골디락스', '주식·회사채', TK.green400],
              ['inflation', '성장↑ 물가↑ · 인플레이션', '원자재·물가연동채·주식', TK.amber400],
              ['recession', '성장↓ 물가↓ · 리세션', '장기국채·현금', TK.blue400],
              ['stagflation', '성장↓ 물가↑ · 스태그플레이션', '금·원자재·물가연동채', TK.red400],
            ].map(([q, title, assets, c]) => {
              const cur = d.allWeather.usSeason === q
              return (
                <div key={q as string} style={{ background: cur ? `${c}1e` : TK.bg3, border: `1px solid ${cur ? c as string : BORDER}`, borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ color: c as string, fontWeight: 800, fontSize: 11.5 }}>{title}{cur && ' 📍현재'}</div>
                  <div style={{ color: TK.sub8, fontSize: 10.5, marginTop: 2 }}>유리 자산: {assets}</div>
                </div>
              )
            })}
          </div>
          <div style={{ color: TK.sub, fontSize: 10.5, marginBottom: 12 }}>📍 현재 계절 = <b style={{ color: GOLD }}>{SEASON_KO[d.allWeather.usSeason] ?? d.allWeather.usSeason}</b> (우리 4계절 내비게이터와 동일 SSOT). 달리오는 <b style={{ color: TK.slate200 }}>4계절 각각에 위험을 균등 분산</b>해 어떤 계절이든 견디게 합니다.</div>

          {/* 리스크 패리티 배분 */}
          <div style={{ background: TK.bg3, borderRadius: 9, padding: '10px 13px', marginBottom: 12 }}>
            <div style={{ color: TK.sub11, fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>전천후 자산 배분(리스크 패리티)</div>
            <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
              {[['주식', 30, TK.green400], ['장기채', 40, TK.blue400], ['중기채', 15, TK.cyan400], ['금', 7.5, TK.amber400], ['원자재', 7.5, TK.orange400]].map(([l, w, c]) => (
                <div key={l as string} title={`${l} ${w}%`} style={{ width: `${w}%`, background: c as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, color: TK.bg3, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', padding: '0 1px' }}>{`${l} ${w}%`}</div>
              ))}
            </div>
            <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.5 }}>💡 <b style={{ color: TK.blue300 }}>핵심 = 리스크 패리티</b>: 채권 55%는 <b>금액</b>이 크지만 변동성이 작아 <b>위험 기여도</b>는 주식과 비슷해집니다. &ldquo;금액이 아니라 위험을 똑같이 나눈다&rdquo;가 전천후의 발명입니다.</div>
          </div>

          {/* 백테스트 — AW vs SPY 누적 */}
          {d.allWeather.years.length > 3 && <AwBacktest years={d.allWeather.years} cagr={d.allWeather.cagr} worst={d.allWeather.worstYear} />}
          <div style={{ color: TK.sub2, fontSize: 10, marginTop: 8 }}>{d.allWeather.note}</div>
        </div>

        {/* 정적 vs 동적 교육 */}
        <div style={{ background: 'rgba(212,175,122,0.06)', border: `1px solid ${GOLD}33`, borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🎓 달리오 All Weather(정적) vs 우리 4계절·퀀트빌더(동적)</div>
          <div style={{ color: TK.sub5, fontSize: 11.5, lineHeight: 1.7 }}>
            달리오의 전천후는 <b style={{ color: TK.slate200 }}>사시사철 같은 배분</b>을 유지하는 <b>전략적 자산배분</b>입니다(미래를 못 맞히니 항상 균형). 반면 이 앱의 <b style={{ color: TK.slate200 }}>4계절 내비게이터·퀀트빌더</b>는 현재 계절을 판단해 <b>비중을 바꾸는 전술적 배분</b>이죠.
            정답은 없습니다 — 전천후는 <b>2008년 방어에 강했지만(위 백테스트), 2022년 금리 쇼크엔 채권·주식이 함께 빠져 약했습니다</b>. &ldquo;모든 계절&rdquo;이라는 이름에도 완벽한 전략은 없다는 게 정직한 교훈입니다.
          </div>
        </div>
      </>}
    </div>
  )
}

// ② 빅 사이클 — 제국 국력지표 US vs 중국 (World Bank 실데이터 막대)
const fmtPower = (v: number, disp: 'money' | 'pct' | 'pop') =>
  disp === 'pct' ? `${v.toFixed(1)}%` : disp === 'pop' ? `${(v / 1e8).toFixed(1)}억` : v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : `$${(v / 1e9).toFixed(0)}B`

function WorldPower({ wp }: { wp: NonNullable<DalioCycleResult['worldPower']> }) {
  return (
    <div>
      <div style={{ color: TK.sub11, fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>제국 국력지표 — 🇺🇸 미국 vs 🇨🇳 중국 (실데이터)</div>
      <div style={{ color: TK.sub2, fontSize: 10, marginBottom: 8 }}>World Bank 공개 통계(무료). 브릿지워터 독점 점수가 아니라 실측 지표로 패권 격차를 봅니다.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {wp.metrics.map(m => {
          const mx = Math.max(m.us, m.cn) || 1
          return (
            <div key={m.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
                <span style={{ color: TK.sub11, fontWeight: 600 }}>{m.label} <span style={{ color: TK.sub, fontSize: 9 }}>({m.year}) · {m.note}</span></span>
              </div>
              {[['🇺🇸 미국', m.us, TK.blue400], ['🇨🇳 중국', m.cn, TK.red400]].map(([lb, v, c]) => (
                <div key={lb as string} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 52, fontSize: 10, color: TK.sub8 }}>{lb}</span>
                  <div style={{ flex: 1, background: TK.bg3, borderRadius: 4, height: 15, overflow: 'hidden' }}>
                    <div style={{ width: `${((v as number) / mx) * 100}%`, height: '100%', background: c as string, borderRadius: 4, minWidth: 2 }} />
                  </div>
                  <span style={{ width: 62, textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: TK.slate200, fontFamily: 'monospace' }}>{fmtPower(v as number, m.disp)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {/* 기축통화 — 달리오 "최후의 특권" */}
      <div style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}40`, borderRadius: 9, padding: '9px 12px', marginTop: 10 }}>
        <div style={{ color: GOLD, fontWeight: 800, fontSize: 11.5 }}>💵 기축통화 비중 — 달리오의 &ldquo;최후의 특권&rdquo;</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6, marginBottom: 5 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: TK.sub8, marginBottom: 2 }}>🇺🇸 달러(USD)</div>
            <div style={{ background: TK.bg3, borderRadius: 4, height: 15 }}><div style={{ width: `${wp.reserve.usd}%`, height: '100%', background: TK.blue400, borderRadius: 4 }} /></div>
            <div style={{ color: TK.blue400, fontWeight: 800, fontSize: 13, marginTop: 2 }}>{wp.reserve.usd}%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: TK.sub8, marginBottom: 2 }}>🇨🇳 위안(CNY)</div>
            <div style={{ background: TK.bg3, borderRadius: 4, height: 15 }}><div style={{ width: `${wp.reserve.cny}%`, height: '100%', background: TK.red400, borderRadius: 4, minWidth: 2 }} /></div>
            <div style={{ color: TK.red400, fontWeight: 800, fontSize: 13, marginTop: 2 }}>{wp.reserve.cny}%</div>
          </div>
        </div>
        <div style={{ color: TK.sub5, fontSize: 10, lineHeight: 1.5 }}>달러 패권은 제국이 쇠퇴해도 가장 마지막까지 유지되는 특권입니다. 위안화는 아직 3% 미만 — 경제·군사 격차가 좁혀져도 기축통화는 별개의 신뢰 게임. <span style={{ color: TK.sub2 }}>출처: {wp.reserve.source}</span></div>
      </div>
      <div style={{ color: TK.sub2, fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>💡 GDP·국방비는 미국 우위, <b style={{ color: TK.sub11 }}>수출·인구는 중국 우위</b> — 달리오가 말한 &ldquo;외부 질서 사이클(기존 패권 vs 신흥 도전)&rdquo;이 실데이터로 드러납니다. R&D 비중은 미래 국력의 선행지표.</div>
    </div>
  )
}

// All Weather vs S&P500 누적 성장($1 기준)
function AwBacktest({ years, cagr, worst }: { years: { year: string; awPct: number; spyPct: number }[]; cagr: number; worst: { year: string; pct: number } | null }) {
  let aw = 1, spy = 1
  const data = years.map(y => { aw *= 1 + y.awPct / 100; spy *= 1 + y.spyPct / 100; return { year: y.year, AW: Math.round(aw * 100) / 100, SPY: Math.round(spy * 100) / 100 } })
  // Y축을 실제 데이터 범위에 맞춰 좁혀 상하 진폭을 키운다(0~8x 고정 시 절반이 빈 공간이라 선이 눌림)
  const vals = data.flatMap(d => [d.AW, d.SPY])
  const yLo = Math.min(1, Math.floor(Math.min(...vals) * 10) / 10)   // 최저점(2009 딥) 살짝 아래
  const yHi = Math.ceil(Math.max(...vals) * 2) / 2                   // 최고점 위 0.5 단위 올림
  const yTicks = Array.from({ length: Math.floor(yHi) }, (_, i) => i + 1)
  return (
    <div>
      {/* 범례 — 두 선이 뭔지 명시 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 5, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 18, height: 3, background: TK.green400, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ color: TK.sub11 }}><b style={{ color: TK.green400 }}>전천후</b> <span style={{ color: TK.sub }}>(주식30·장기채40·중기채15·금7.5·원자재7.5)</span></span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 18, height: 3, background: TK.sub3, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ color: TK.sub11 }}><b style={{ color: TK.sub9 }}>S&amp;P500</b> <span style={{ color: TK.sub }}>(미국 주식 100%)</span></span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, fontSize: 10.5 }}>
        <span style={{ color: TK.green400 }}>전천후 CAGR <b>{cagr}%/년</b></span>
        {worst && <span style={{ color: TK.red400 }}>전천후 최악의 해 {worst.year} <b>{worst.pct}%</b></span>}
        <span style={{ color: TK.sub }}>세로축 = $1이 {years.length}년간 몇 배로(누적)</span>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 12, left: -8, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fill: TK.sub2, fontSize: 9.5 }} minTickGap={30} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis domain={[yLo, yHi]} ticks={yTicks} allowDataOverflow tick={{ fill: TK.sub2, fontSize: 9.5 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v: number) => `${v}x`} />
            <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, n: any) => [`${v}x`, n === 'AW' ? '전천후' : 'S&P500']} />
            <ReferenceLine x="2008" stroke={`${TK.red400}aa`} strokeDasharray="3 3" label={{ value: '2008 위기', fill: TK.red300, fontSize: 10, fontWeight: 700, position: 'top', dy: -4 }} />
            <ReferenceLine x="2022" stroke={`${TK.red400}aa`} strokeDasharray="3 3" label={{ value: '2022 쇼크', fill: TK.red300, fontSize: 10, fontWeight: 700, position: 'top', dy: -4 }} />
            <Line type="monotone" dataKey="AW" stroke={TK.green400} strokeWidth={2.2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="SPY" stroke={TK.sub3} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
