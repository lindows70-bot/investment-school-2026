'use client'
// 📜 채권 축 — 듀레이션 나침반(금리 방향×수익률곡선×크레딧) + 채권 ETF 현황 + 금리 ±1%p 손익 시뮬
//    금리 국면 macro-regime SSOT 재사용. 채권 자산군 진입 화면(/bonds). 경보/가이드만·매매 지시 아님.
import { useEffect, useState, type ReactNode } from 'react'
import type { BondsResult, BondEtf, DurBias } from '@/app/api/bonds/route'
import type { RealYieldResult } from '@/lib/realYield'
import { TK, FS, RAD, SP } from '@/lib/theme'

// 🧮 금리 3형제 2년 차트 — 외부 라이브러리 없이 SVG 3선(스윙 캔들 차트와 같은 관례)
function RealYieldChart({ series }: { series: RealYieldResult['series'] }) {
  const W = 640, H = 170, PAD = 6
  const vals = series.flatMap(p => [p.n, p.r, p.b]).filter((v): v is number => v != null)
  if (vals.length < 10) return null
  const lo = Math.min(...vals) - 0.15, hi = Math.max(...vals) + 0.15
  const x = (i: number) => PAD + (i / Math.max(1, series.length - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2)
  const path = (pick: (p: RealYieldResult['series'][number]) => number | null) =>
    series.map((p, i) => { const v = pick(p); return v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}` })
      .filter(Boolean).join(' ')
  const gridV = [Math.ceil(lo * 2) / 2, Math.floor(hi * 2) / 2]   // 0.5% 격자 상·하단
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridV.map(g => (
        <g key={g}>
          <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke={TK.border} strokeDasharray="3 4" strokeWidth={1} />
          <text x={W - PAD - 2} y={y(g) - 3} textAnchor="end" fontSize={10} fill={TK.sub4}>{g.toFixed(1)}%</text>
        </g>
      ))}
      <polyline points={path(p => p.n)} fill="none" stroke={TK.slate300} strokeWidth={2} />
      <polyline points={path(p => p.r)} fill="none" stroke={TK.violet400} strokeWidth={1.7} />
      <polyline points={path(p => p.b)} fill="none" stroke={TK.amber400} strokeWidth={1.7} />
    </svg>
  )
}

const BORDER = '#2a2f3a'
const CAT_META: Record<BondEtf['category'], { label: string; color: string }> = {
  short: { label: '단기국채', color: TK.green400 },
  mid: { label: '중기국채', color: TK.amber400 },
  long: { label: '장기국채', color: TK.red400 },
  ig: { label: '투자등급 회사채', color: '#38bdf8' },
  hy: { label: '하이일드 회사채', color: '#a855f7' },
  kr: { label: '한국 국고채', color: TK.slate300 },
}
const BIAS_META: Record<DurBias, { label: string; color: string; emoji: string }> = {
  short: { label: '단기채 방어', color: TK.green400, emoji: '🛡️' },
  mid: { label: '중기채 균형', color: TK.amber400, emoji: '⚖️' },
  long: { label: '장기채 확대', color: TK.red400, emoji: '🚀' },
}

const pctColor = (v: number | null) => v == null ? TK.sub4 : v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.slate300
const fmtPct = (v: number | null) => v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'
const fmtPrice = (v: number | null, m: 'US' | 'KR') => v == null ? '—' : m === 'KR' ? '₩' + Math.round(v).toLocaleString() : '$' + v.toFixed(2)

export default function BondsDashboard() {
  const [data, setData] = useState<BondsResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/bonds').then(r => r.ok ? r.json() : Promise.reject(r))
      .then(j => j.error ? setErr(j.error) : setData(j))
      .catch(() => setErr('채권 데이터를 불러오지 못했습니다.'))
  }, [])

  if (err) return <div style={{ padding: 24, color: TK.sub3, textAlign: 'center', fontSize: 13 }}>⚠️ {err}</div>
  if (!data) return <div style={{ padding: 24, color: TK.sub3, textAlign: 'center', fontSize: 13 }}>📜 채권 나침반 계산 중…</div>

  const c = data.compass
  const bm = BIAS_META[c.durationBias]
  const dirColor = data.macro.rateDir === 'cut' ? TK.green400 : data.macro.rateDir === 'hike' ? TK.red400 : TK.amber400

  return (
    <div style={{ padding: '20px 22px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,#0f1420,${TK.bg1})`, border: `1px solid ${TK.violet400}44`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TK.slate100 }}>📜 채권 — 듀레이션 나침반</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.55 }}>
          <b style={{ color: TK.violet400 }}>금리는 채권 가격의 중력</b> — 금리가 내리면 채권값은 오르고, <b style={{ color: TK.slate300 }}>듀레이션(만기)</b>이 길수록 더 크게 움직인다.
          지금 금리 국면에 맞는 <b>단기/중기/장기채·국채/회사채</b> 포지션을 읽는다. 금리 국면은 Fed Watch와 동일 SSOT.
        </div>
        {/* 채권 허브 — 사이드바에서 채권 3항목을 여기 하나로 모았으므로 나머지 두 도구로 가는 길을 여기서 제공 */}
        <div style={{ display: 'flex', gap: SP.sm, flexWrap: 'wrap', marginTop: SP.sm }}>
          <a href="/macro-hub?tab=bond" style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate200, background: TK.bg3, border: `1px solid ${TK.violet400}55`, borderRadius: RAD.pill, padding: '5px 12px', textDecoration: 'none' }}>📊 채권 시뮬레이터 →</a>
          <a href="/macro-hub?tab=stress" style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate200, background: TK.bg3, border: `1px solid ${TK.violet400}55`, borderRadius: RAD.pill, padding: '5px 12px', textDecoration: 'none' }}>⚡ 금리 스트레스 테스트 →</a>
        </div>
      </div>

      {/* 🧮 금리 3형제 — 명목 = 실질 + 기대인플레(항등식 분해) */}
      {data.realYield && (() => {
        const ry = data.realYield
        const sign = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2)
        return (
          <div style={{ background: TK.card, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100 }}>🧮 금리 3형제 — 무엇이 금리를 움직였나</div>
            <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 4, lineHeight: 1.55 }}>
              미국채 10년 금리는 둘의 합입니다 — <b style={{ color: TK.violet400 }}>돈의 진짜 값(TIPS 실질금리)</b> +
              <b style={{ color: TK.amber400 }}> 물가 기대(BEI)</b>. 셋은 통계적 상관이 아니라 <b>정의상 항등식</b>이라
              (FRED 실측 오차 0.00%p), 금리가 움직이면 &ldquo;어느 쪽이 끌었나&rdquo;로 쪼개 읽는 게 정확합니다.
            </div>
            {/* 분해 식 — 지금 값 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {[
                { label: '명목 10년', v: ry.nominal.v, color: TK.slate200, note: '내가 보는 금리' },
                { label: '=  실질(TIPS)', v: ry.real.v, color: TK.violet400, note: '돈의 진짜 값' },
                { label: '+  기대인플레(BEI)', v: ry.bei.v, color: TK.amber400, note: '물가 전망' },
              ].map(k => (
                <div key={k.label} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '8px 14px' }}>
                  <div style={{ fontSize: FS.micro, color: TK.sub3 }}>{k.label} <span style={{ color: TK.sub4 }}>· {k.note}</span></div>
                  <div style={{ fontSize: FS.xl, fontWeight: 800, color: k.color }}>{k.v.toFixed(2)}%</div>
                </div>
              ))}
              <div style={{ fontSize: FS.micro, color: TK.sub4 }}>기준 {ry.nominal.date}</div>
            </div>
            {/* 최근 3개월 분해 + 해석 */}
            <div style={{ background: TK.bg1, borderRadius: RAD.sm, padding: '10px 13px', marginTop: 10, fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.65 }}>
              최근 3개월(60거래일): 명목 <b style={{ color: TK.slate200 }}>{sign(ry.chg60.nominal)}%p</b> =
              실질 <b style={{ color: TK.violet400 }}>{sign(ry.chg60.real)}%p</b> +
              기대인플레 <b style={{ color: TK.amber400 }}>{sign(ry.chg60.bei)}%p</b>
              <div style={{ marginTop: 5, color: TK.slate300 }}>{ry.driverNote.replace(/\*\*/g, '')}</div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ry.levelNotes.map((n, i) => (
                <div key={i} style={{ fontSize: FS.micro, color: TK.sub2, lineHeight: 1.6 }}>· {n.replace(/\*\*/g, '')}</div>
              ))}
            </div>
            {/* 2년 차트 */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 12, fontSize: FS.micro, color: TK.sub3, marginBottom: 4 }}>
                <span><span style={{ color: TK.slate300 }}>━</span> 명목 10년</span>
                <span><span style={{ color: TK.violet400 }}>━</span> 실질(TIPS)</span>
                <span><span style={{ color: TK.amber400 }}>━</span> 기대인플레(BEI)</span>
                <span style={{ marginLeft: 'auto', color: TK.sub4 }}>최근 2년 · 주 단위 · FRED</span>
              </div>
              <RealYieldChart series={ry.series} />
            </div>
            <div style={{ fontSize: FS.micro, color: TK.sub4, marginTop: 6, lineHeight: 1.5 }}>
              ⚠️ BEI에는 유동성·위험 프리미엄이 섞여 순수한 물가 기대보다 조금 왜곡될 수 있습니다.
              수준 판정(긴축적/중립/느슨)은 역사 구간 서술이지 백테스트로 검증된 임계값이 아닙니다.
            </div>
          </div>
        )
      })()}

      {/* 🧭 나침반 */}
      <div style={{ background: `${bm.color}12`, border: `1px solid ${bm.color}55`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: TK.slate100 }}>{c.headline}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {/* 금리 국면 */}
          <div style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: TK.sub3 }}>금리 방향(FF선물)</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: dirColor, marginTop: 2 }}>{data.macro.rateDirLabel}</div>
            <div style={{ fontSize: 10, color: TK.sub4 }}>기준금리 {data.macro.fedRate != null ? data.macro.fedRate.toFixed(2) + '%' : '—'}</div>
          </div>
          {/* 권장 듀레이션 */}
          <div style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${bm.color}55`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: TK.sub3 }}>권장 듀레이션</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: bm.color, marginTop: 2 }}>{bm.emoji} {bm.label}</div>
          </div>
          {/* 크레딧 */}
          <div style={{ flex: '1 1 150px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: TK.sub3 }}>크레딧(회사채)</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.creditBias === 'govt' ? TK.red400 : '#38bdf8', marginTop: 2 }}>{c.creditBias === 'govt' ? '🏛️ 국채 선호' : '💳 크레딧 캐리'}</div>
            <div style={{ fontSize: 10, color: TK.sub4 }}>HY 스프레드 {data.macro.hySpread != null ? data.macro.hySpread.toFixed(2) + '%' : '—'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: TK.sub2, marginTop: 10, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 4 }}>{bm.emoji} {c.durationLabel}</div>
          <div style={{ marginBottom: 4 }}>{c.creditBias === 'govt' ? '🏛️' : '💳'} {c.creditLabel}</div>
          <div style={{ color: data.macro.yieldCurve != null && data.macro.yieldCurve < 0 ? TK.amber400 : TK.sub2 }}>📐 {c.curveNote}</div>
        </div>
      </div>

      {/* 📊 채권 ETF 표 + 금리 손익 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, overflowX: 'auto' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: TK.slate200, marginBottom: 8 }}>📊 채권 ETF 현황 · 금리 ±1%p 손익 시뮬</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 720 }}>
          <thead>
            <tr style={{ color: TK.sub3, textAlign: 'right', borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>채권 ETF</th>
              <th style={{ padding: '6px 8px' }} title="수정 듀레이션(근사) — 금리 1%p당 가격 민감도">듀레이션</th>
              <th style={{ padding: '6px 8px' }}>현재가</th>
              <th style={{ padding: '6px 8px' }}>1개월</th>
              <th style={{ padding: '6px 8px' }}>3개월</th>
              <th style={{ padding: '6px 8px' }}>1년</th>
              <th style={{ padding: '6px 8px', color: TK.green400 }} title="금리 1%p 인하 시 대략 가격 변화">금리 −1%p</th>
              <th style={{ padding: '6px 8px', color: TK.red400 }} title="금리 1%p 인상 시 대략 가격 변화">금리 +1%p</th>
            </tr>
          </thead>
          <tbody>
            {data.etfs.map(e => {
              const cm = CAT_META[e.category]
              return (
                <tr key={e.key} style={{ borderBottom: `1px solid ${TK.bg1}`, textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', padding: '7px 8px' }}>
                    <div style={{ color: TK.slate100, fontWeight: 600 }}>{e.name}</div>
                    <div style={{ fontSize: 9.5, color: cm.color }}>{e.market === 'KR' ? e.ticker : e.ticker} · {cm.label}</div>
                  </td>
                  <td style={{ padding: '7px 8px', color: TK.slate200, fontWeight: 700, fontFamily: 'monospace' }}>{e.modDur.toFixed(1)}</td>
                  <td style={{ padding: '7px 8px', color: TK.slate300, fontFamily: 'monospace' }}>{fmtPrice(e.price, e.market)}</td>
                  <td style={{ padding: '7px 8px', color: pctColor(e.ret1m) }}>{fmtPct(e.ret1m)}</td>
                  <td style={{ padding: '7px 8px', color: pctColor(e.ret3m) }}>{fmtPct(e.ret3m)}</td>
                  <td style={{ padding: '7px 8px', color: pctColor(e.ret1y) }}>{fmtPct(e.ret1y)}</td>
                  <td style={{ padding: '7px 8px', color: TK.green400, fontWeight: 700 }}>+{e.pnlDown1.toFixed(1)}%</td>
                  <td style={{ padding: '7px 8px', color: TK.red400, fontWeight: 700 }}>{e.pnlUp1.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 9.5, color: TK.sub4, marginTop: 8, lineHeight: 1.5 }}>
          금리 손익 = −듀레이션 × 금리변화(수정듀레이션 근사). <b>긴 채권(TLT)일수록 금리에 크게 흔들린다</b> — 금리 1%p 내리면 장기채는 +16%대, 단기채는 +2%대. 듀레이션은 근사값(시점마다 변동)·환헤지 미반영.
        </div>
      </div>

      <BondEdu
        tlt={data.etfs.find(e => e.ticker === 'TLT')?.modDur ?? null}
        shy={data.etfs.find(e => e.ticker === 'SHY')?.modDur ?? null} />

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.55 }}>
        ⚠️ 나침반은 금리 국면 기반 <b>일반 가이드</b>이지 매매 지시가 아니다. 과거 수익률은 미래를 보장하지 않으며, 개별 채권 ETF의 실제 듀레이션·수익률은 시점마다 다르다. 채권도 금리 급변 시 손실이 날 수 있다(2022년 장기채 −30% 실제).
      </div>
    </div>
  )
}

/** 🎓 채권 기초 — 비유로 풀이(기본 펼침). 예시 숫자는 위 표에서 받아 쓴다(리터럴 금지) */
function BondEdu({ tlt, shy }: { tlt: number | null; shy: number | null }) {
  const [open, setOpen] = useState(true)
  const Row = ({ q, a }: { q: string; a: ReactNode }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: TK.slate200, marginBottom: 3 }}>{q}</div>
      <div style={{ fontSize: 11, color: TK.sub2, lineHeight: 1.6 }}>{a}</div>
    </div>
  )
  return (
    <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '11px 14px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: TK.slate100, fontSize: 12.5, fontWeight: 800 }}>
        🎓 처음이라면 — 채권 쉽게 이해하기
        <span style={{ marginLeft: 'auto', color: TK.sub3, fontSize: 11 }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <Row q="📜 채권이 뭔가요?" a={<>정부·기업에 돈을 빌려주고 <b>정해진 이자를 받는 &lsquo;차용증&rsquo;</b>이에요. 주식은 회사의 주인이 되는 것, 채권은 <b>회사에 돈을 빌려주는 채권자</b>가 되는 것. 만기에 원금을 돌려받아 주식보다 안전하고 변동이 작아, <b>포트폴리오의 방어수</b> 역할을 합니다.</>} />
          <Row q="⚖️ 왜 &lsquo;금리는 채권의 중력&rsquo;인가요?" a={<>금리와 채권 가격은 <b>시소처럼 반대</b>예요. 새 채권이 5% 이자를 준다면, 3%짜리 옛 채권은 인기가 없어져 <b>가격이 떨어집니다</b>. 반대로 금리가 내리면 옛 고금리 채권값이 오르죠. 그래서 <b>금리 인하가 예상되면 채권(특히 장기채)이 유리</b>합니다.</>} />
          {/* ⚠️ 예시 숫자를 리터럴로 박지 않는다 — 듀레이션은 시점마다 변한다(리터럴 17·2 vs 실제 표 16.5·1.9).
              위 표에서 그대로 가져와, 설명과 표가 어긋나지 않게 한다(제1원칙). */}
          <Row q="⏳ 듀레이션(Duration)이란?" a={<>채권이 <b>금리 변화에 얼마나 민감한가</b>를 나타내는 &lsquo;시소의 길이&rsquo;예요. 대략 만기가 길수록 커집니다.
            {tlt != null && shy != null
              ? <> 지금 위 표를 보면 장기채(TLT)는 듀레이션 {tlt.toFixed(1)} — <b>금리 1%p 내리면 약 +{tlt.toFixed(1)}%</b>, 올리면 −{tlt.toFixed(1)}%. 단기채(SHY)는 {shy.toFixed(1)}이라 ±{shy.toFixed(1)}%뿐이에요.</>
              : <> 장기채(TLT)는 듀레이션이 커서 금리 1%p에 두 자릿수로 움직이고, 단기채(SHY)는 한 자릿수에 그칩니다.</>}
            {' '}<b>긴 채권일수록 금리 베팅의 지렛대가 크고 위험도 큽니다.</b></>} />
          <Row q="💳 국채 vs 회사채 · 크레딧 스프레드는?" a={<>국채는 정부가 갚아 가장 안전, 회사채는 부도위험이 있어 이자를 더 줍니다. 그 <b>추가 이자가 &lsquo;크레딧 스프레드&rsquo;</b>. 스프레드가 <b>낮으면</b> 회사채로 더 높은 이자를 안전하게 먹을 만하고(캐리), <b>급등하면</b> 경제 위기 신호라 안전한 국채로 피신합니다. 특히 <b>하이일드(고위험 회사채)</b>는 위기에 주식처럼 폭락해요.</>} />
          <Row q="📐 수익률곡선 역전은 왜 무섭나요?" a={<>보통 <b>장기 금리 &gt; 단기 금리</b>(오래 빌려주니 더 받음)인데, 이게 뒤집혀 <b>단기가 더 높아지면(역전)</b> 역사적으로 <b>경기침체 선행 신호</b>였어요. 시장이 &lsquo;곧 경기가 나빠져 금리를 내릴 것&rsquo;이라 보는 것 — 장기채엔 우호적이나 주식엔 경계 신호입니다.</>} />
          <div style={{ fontSize: 10.5, color: TK.sub3, lineHeight: 1.55, borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 2 }}>
            💡 한 줄 요약: <b style={{ color: TK.slate300 }}>금리 내릴 것 같으면 장기채, 오를 것 같으면 단기채</b>. 위기가 오면 하이일드·회사채 대신 <b>국채</b>로. 채권은 주식이 흔들릴 때 받쳐주는 <b>자산배분의 안전판</b>입니다.
          </div>
        </div>
      )}
    </div>
  )
}
