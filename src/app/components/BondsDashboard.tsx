'use client'
// 📜 채권 축 — 듀레이션 나침반(금리 방향×수익률곡선×크레딧) + 채권 ETF 현황 + 금리 ±1%p 손익 시뮬
//    금리 국면 macro-regime SSOT 재사용. 채권 자산군 진입 화면(/bonds). 경보/가이드만·매매 지시 아님.
import { useEffect, useState, type ReactNode } from 'react'
import type { BondsResult, BondEtf, DurBias } from '@/app/api/bonds/route'
import { TK } from '@/lib/theme'

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
      </div>

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

      <BondEdu />

      <div style={{ fontSize: 9.5, color: TK.sub4, lineHeight: 1.55 }}>
        ⚠️ 나침반은 금리 국면 기반 <b>일반 가이드</b>이지 매매 지시가 아니다. 과거 수익률은 미래를 보장하지 않으며, 개별 채권 ETF의 실제 듀레이션·수익률은 시점마다 다르다. 채권도 금리 급변 시 손실이 날 수 있다(2022년 장기채 −30% 실제).
      </div>
    </div>
  )
}

/** 🎓 채권 기초 — 비유로 풀이(기본 펼침) */
function BondEdu() {
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
          <Row q="⏳ 듀레이션(Duration)이란?" a={<>채권이 <b>금리 변화에 얼마나 민감한가</b>를 나타내는 &lsquo;시소의 길이&rsquo;예요. 대략 만기가 길수록 커집니다. 듀레이션 17인 장기채(TLT)는 <b>금리 1%p 내리면 약 +17%</b>, 올리면 −17%. 듀레이션 2인 단기채(SHY)는 ±2%뿐. <b>긴 채권일수록 금리 베팅의 지렛대가 크고 위험도 큽니다.</b></>} />
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
