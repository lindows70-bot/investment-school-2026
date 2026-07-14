'use client'
// 📋 매매 플랜 카드 — "지금 살까? 몇 주? 손절은?"을 학생 눈높이로. 결론 먼저, 계산은 접어둠.
//   결론(신호등)=사라/절반만/사지마라 → 핵심 3줄(지금 몇 주·손절선·감당 리스크) → 🔬 상세(접기)
//   수량 = (포트폴리오 × 리스크%) ÷ (진입가 − ATR손절가) = 매매 단위 리스크 패리티. 전부 결정론·교육용·자동주문 없음.
import { useState, useEffect } from 'react'
import type { EntryTiming } from '@/lib/entryTiming'

const BORDER = '#1e293b'

// 환율 1회 공유 캐시(카드 여러 장이 떠도 fetch 1번)
let fxPromise: Promise<number> | null = null
const getFx = () => fxPromise ?? (fxPromise = fetch('/api/exchange-rate').then(r => r.json()).then(j => (typeof j.rate === 'number' && j.rate > 500 ? j.rate : 1380)).catch(() => 1380))

export default function TradePlanCard({ market, timing, portfolioKrw }: {
  market: string; timing: EntryTiming; portfolioKrw: number
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(false)      // 🔬 상세 근거 펼침
  const [riskPct, setRiskPct] = useState(1)         // 1회 매매 감당 리스크(% of 포트폴리오)
  const [fx, setFx] = useState<number | null>(market === 'KR' ? 1 : null)

  useEffect(() => { if (market !== 'KR') getFx().then(setFx) }, [market])

  const t = timing
  if (t.atrStop == null || t.price <= t.atrStop) return null   // 손절폭 계산 불가 시 정직 생략

  const fmtP = (n: number) => market === 'KR' ? `₩${Math.round(n).toLocaleString()}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  const fmtW = (n: number) => n >= 1e8 ? `${Math.round(n / 1e6) / 100}억원` : `${Math.round(n / 1e4).toLocaleString()}만원`

  const perShareRisk = t.price - t.atrStop                     // 주당 리스크(진입가 − 손절가)
  const riskBudgetKrw = portfolioKrw * riskPct / 100           // 감당할 손실(₩)
  const rate = fx ?? (market === 'KR' ? 1 : 1380)
  const qty = Math.floor(riskBudgetKrw / (perShareRisk * rate))
  const totalKrw = qty * t.price * rate
  const r2 = t.price + 2 * perShareRisk, r3 = t.price + 3 * perShareRisk
  const nominalHeavy = totalKrw / portfolioKrw > 0.15

  // 급등주는 구름 상단이 손절선보다 아래일 수 있음 → 눌림 기준은 '손절선 위'로 클램프
  const dip = Math.max(t.cloudTop, t.atrStop)
  const dipLabel = t.cloudTop >= t.atrStop ? '구름 상단' : '손절선 위 되돌림'

  // 🎯 오늘의 행동 결론 — "사라 / 절반만·기다려라 / 사지마라" (신호등 → 학생 언어)
  const first = qty <= 3 ? Math.min(1, qty) : Math.floor(qty / 3)
  const half = qty <= 3 ? Math.min(1, qty) : Math.floor(qty / 2)
  const v = qty <= 0
    ? { tone: '#94a3b8', title: '⏸️ 지금은 관망하세요', sub: '이 리스크 예산으로는 1주도 담기 부담됩니다 — 리스크%를 올리거나 더 싼 종목을 찾으세요.', now: 0 }
    : t.light === 'green'
    ? { tone: '#22c55e', title: '✅ 지금 사도 됩니다 (한 번에 말고 나눠서)', sub: `추세가 살아있는 자리입니다. 먼저 ${first}주만 담고, 눌릴 때(${dipLabel} ${fmtP(dip)})에 추가, 반등 확인 후 나머지를 채우세요.`, now: first }
    : t.light === 'yellow'
    ? { tone: '#eab308', title: '⏳ 절반만 지금, 나머지는 기다리세요', sub: `아직 방향 확정 전입니다. 지금은 ${half}주까지만 담고, 구름 상단(${fmtP(t.cloudTop)}) 돌파를 확인한 뒤 나머지 절반을 채우세요.`, now: half }
    : { tone: '#ef4444', title: '🚫 지금은 사지 마세요', sub: `진입을 미룰 자리입니다. 굳이 담고 싶다면 구름 상단(${fmtP(t.cloudTop)}) 돌파를 확인한 뒤 소액부터.`, now: 0 }
  const nowKrw = v.now * t.price * rate

  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7,
        fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
        background: open ? 'rgba(196,181,253,0.18)' : 'rgba(196,181,253,0.08)',
        color: '#c4b5fd', border: `1px solid ${open ? '#a78bfa66' : '#a78bfa33'}`,
      }}>📋 {open ? '매매 플랜 접기' : '매매 플랜 — 지금 살까? 몇 주?'}</button>

      {open && (
        <div style={{ marginTop: 6, background: '#12101c', border: '1px solid #a78bfa44', borderRadius: 10, padding: '11px 13px', fontSize: 11, lineHeight: 1.6 }}>
          {/* 🎯 오늘의 행동 — 큰 결론 */}
          <div style={{ background: `${v.tone}14`, border: `1px solid ${v.tone}66`, borderRadius: 9, padding: '9px 12px', marginBottom: 9 }}>
            <div style={{ color: v.tone, fontWeight: 900, fontSize: 13.5 }}>{v.title}</div>
            <div style={{ color: '#cbd5e1', fontSize: 10.5, marginTop: 3, lineHeight: 1.55 }}>{v.sub}</div>
          </div>

          {/* 핵심 3줄 — 지금 몇 주 · 손절선 · 리스크 */}
          <div style={{ background: '#0f1117', borderRadius: 8, padding: '9px 11px', marginBottom: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 6, alignItems: 'center' }}>
            <span style={{ color: '#7f93a8' }}>🛒 지금 담을 양</span>
            <span style={{ color: v.now > 0 ? '#4ade80' : '#94a3b8', fontWeight: 800, fontFamily: 'monospace' }}>
              {v.now > 0 ? `${v.now.toLocaleString()}주 (≈${fmtW(nowKrw)})` : '0주 — 대기'}
              {v.now > 0 && qty > v.now && <span style={{ color: '#7f93a8', fontFamily: 'inherit', fontWeight: 600, fontSize: 10 }}> · 최종 목표 {qty.toLocaleString()}주까지 분할</span>}
            </span>

            <span style={{ color: '#7f93a8' }}>🛡 손절선</span>
            <span style={{ color: '#f87171', fontWeight: 800, fontFamily: 'monospace' }}>{fmtP(t.atrStop)} <span style={{ color: '#7f93a8', fontFamily: 'inherit', fontWeight: 600, fontSize: 10 }}>— 여기 깨지면 계획대로 정리(감정 X)</span></span>

            <span style={{ color: '#7f93a8' }}>🧮 감당 리스크</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                {[0.5, 1, 2].map(p => (
                  <button key={p} onClick={() => setRiskPct(p)} style={{
                    padding: '2px 9px', fontSize: 10, fontWeight: 800, cursor: 'pointer', border: 'none',
                    background: riskPct === p ? '#7c3aed' : 'transparent', color: riskPct === p ? '#fff' : '#8599ae',
                  }}>{p}%</button>
                ))}
              </span>
              <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 10.5 }}>= {fmtW(riskBudgetKrw)} 최대 손실</span>
            </span>
          </div>

          {nominalHeavy && (
            <div style={{ color: '#fb923c', fontSize: 10, marginBottom: 8, lineHeight: 1.5 }}>
              ⚠️ 최종 목표({qty.toLocaleString()}주)가 포트의 {Math.round(totalKrw / portfolioKrw * 1000) / 10}%로 큽니다 — 갭 하락 시 손절선을 건너뛸 수 있으니 한 종목 15% 이내를 권합니다.
            </div>
          )}

          {/* 🔬 상세 근거 — 접어둠(계산·익절선·모멘텀) */}
          <button onClick={() => setDetail(d => !d)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6,
            fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'transparent',
            color: '#8599ae', border: `1px solid ${BORDER}`,
          }}>🔬 계산 근거·익절선·모멘텀 {detail ? '접기 ▲' : '펼치기 ▼'}</button>

          {detail && (
            <div style={{ marginTop: 8 }}>
              {/* 계산 산식 */}
              <div style={{ background: '#0f1117', borderRadius: 8, padding: '9px 11px', marginBottom: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 3, fontSize: 10.5 }}>
                <span style={{ color: '#7f93a8' }}>주당 리스크</span>
                <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>진입 {fmtP(t.price)} − 🛡손절 {fmtP(t.atrStop)} = <b>{fmtP(perShareRisk)}</b></span>
                <span style={{ color: '#7f93a8' }}>수량 산식</span>
                <span style={{ color: '#aab6c4', fontFamily: 'monospace' }}>감당손실 {fmtW(riskBudgetKrw)} ÷ 주당리스크 = <b style={{ color: '#4ade80' }}>{qty.toLocaleString()}주</b></span>
                <span style={{ color: '#7f93a8' }}>익절 참고선</span>
                <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>2R {fmtP(r2)} · 3R {fmtP(r3)} <span style={{ color: '#7f93a8', fontFamily: 'inherit' }}>(손실 1 벌 때 2~3 먹는 손익비)</span></span>
              </div>

              {/* 🎼 라쉬케 — 모멘텀 연쇄('지금이 방아쇠 순간인가') */}
              {t.raschke && (() => {
                const rk = t.raschke
                if (rk.stage === 4) {
                  const g = rk.parabolicRun
                    ? '되돌림이나 직전이 수직 급등 — 첫 눌림목도 함정일 수 있어 반등·거래량 확인 후 소액.'
                    : `추세 확립 + 고점 대비 ${rk.pullbackPct}% 되돌림 — 라쉬케가 꼽는 ${t.light === 'green' ? '추가 진입(불타기)' : '1차 진입'} 적기.`
                  const c = rk.parabolicRun ? '#fb923c' : '#4ade80'
                  return (
                    <div style={{ background: `${c}0d`, border: `1px solid ${c}44`, borderRadius: 8, padding: '7px 10px', marginBottom: 6, fontSize: 10.5, lineHeight: 1.55 }}>
                      <b style={{ color: '#f0abfc' }}>🎼 라쉬케</b> <span style={{ color: c, fontWeight: 800 }}>📍 첫 눌림목(최적 타점)</span>
                      <span style={{ color: '#aab6c4' }}> — {g}</span>
                    </div>
                  )
                }
                if (t.light === 'green') {
                  return (
                    <div style={{ background: '#4ade8009', border: '1px solid #4ade8033', borderRadius: 8, padding: '7px 10px', marginBottom: 6, fontSize: 10.5, lineHeight: 1.55 }}>
                      <b style={{ color: '#f0abfc' }}>🎼 라쉬케</b> <span style={{ color: '#8599ae', fontWeight: 700 }}>추세 이미 진행 중</span>
                      <span style={{ color: '#aab6c4' }}> — 위 계획대로 진입하되, <b>첫 눌림목(숨 고르기)</b>이 오면 그때가 추가 진입 최적.</span>
                    </div>
                  )
                }
                const stageMap: Record<number, { t: string; c: string; g: string }> = {
                  0: { t: '연쇄 시작 전', c: '#8599ae', g: '모멘텀 전환 신호 아직 없음 — 서두르지 말고 관망.' },
                  1: { t: 'CCI 신호탄(선행)', c: '#eab308', g: '바닥권 탈출 신호탄 — 성급한 진입보다 RSI 50 돌파(에너지)를 먼저 확인.' },
                  2: { t: 'RSI 50 돌파(에너지)', c: '#eab308', g: '매수세가 붙는 중 — MACD 영선 돌파(추세 확정)까지 기다리면 확률↑.' },
                  3: { t: 'MACD 영선 돌파(추세 확정)', c: '#4ade80', g: '추세 확정 — 첫 눌림목(숨 고르기)이 오면 그때가 최적 1차 진입.' },
                }
                const s = stageMap[rk.stage]
                return (
                  <div style={{ background: `${s.c}0d`, border: `1px solid ${s.c}44`, borderRadius: 8, padding: '7px 10px', marginBottom: 6, fontSize: 10.5, lineHeight: 1.55 }}>
                    <b style={{ color: '#f0abfc' }}>🎼 라쉬케 연쇄</b> <span style={{ color: s.c, fontWeight: 800 }}>{s.t}</span>
                    <span style={{ color: '#aab6c4' }}> — {s.g}</span>
                  </div>
                )
              })()}

              {/* 📊 매물·평단 지지 */}
              {t.supply && (t.supply.vwap != null || t.supply.poc != null) && (() => {
                const s = t.supply
                const chop = s.choppy && t.light !== 'green'
                const strong = !chop && s.supportStrong && !s.overExtended, extended = !chop && s.supportStrong && s.overExtended, weak = !chop && s.supportWeak
                const col = chop ? '#94a3b8' : strong ? '#38bdf8' : extended ? '#f59e0b' : weak ? '#fb923c' : '#94a3b8'
                const head = chop ? '관망(추세 강도 약함)' : strong ? '지지 탄탄' : extended ? '과대이격(지지선 멀다)' : weak ? '지지 약함' : '혼조'
                return (
                  <div style={{ background: `${col}0d`, border: `1px solid ${col}44`, borderRadius: 8, padding: '7px 10px', marginBottom: 6, fontSize: 10.5, lineHeight: 1.55 }}>
                    <b style={{ color: '#38bdf8' }}>📊 매물·평단</b> <span style={{ color: col, fontWeight: 800 }}>{head}</span>
                    <span style={{ color: '#aab6c4' }}>
                      {' — '}
                      {s.vwap != null && <>⚓기관평단 {s.aboveVwap ? '위' : '아래'}({s.vwapDistPct! >= 0 ? '+' : ''}{s.vwapDistPct}%)</>}
                      {s.poc != null && <> · 📊매물대 {s.abovePoc ? '위(지지)' : '아래(저항)'}({s.pocDistPct! >= 0 ? '+' : ''}{s.pocDistPct}%)</>}
                      {chop && <>. <b style={{ color: '#cbd5e1' }}>추세 강도 약함(ADX {s.adx})</b> — 돌파 신호가 나와도 <b style={{ color: '#e2e8f0' }}>가짜 돌파(휩쏘)</b>일 수 있어 방향 확정 후 진입.</>}
                      {strong && <>. 매수자·거래 대다수가 현재가 아래 = <b style={{ color: '#7dd3fc' }}>눌림 지지 확보</b>.</>}
                      {extended && <>. 평단·매물대가 <b style={{ color: '#fbbf24' }}>크게 아래 = 지지선 멀다</b> — 추격보다 되돌림·분할 진입.</>}
                      {weak && <>. 평단·매물 대다수가 위 = <b style={{ color: '#fdba74' }}>지지 얇음</b> — 반등·매물 소화 확인 후.</>}
                    </span>
                    {s.fvgBuyHi != null && (
                      <div style={{ color: '#a3e635', marginTop: 3 }}>
                        📦 되돌림 매수 존: <b style={{ fontFamily: 'monospace' }}>{fmtP(s.fvgBuyLo!)}~{fmtP(s.fvgBuyHi)}</b> — 눌릴 때 이 구간 지정가 분할이 유리.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          <div style={{ color: '#8a9aaa', fontSize: 9.5, borderTop: `1px solid ${BORDER}`, paddingTop: 6, marginTop: 8 }}>
            💡 수량을 &lsquo;감당할 손실&rsquo;에서 역산 — 변동성 큰 종목은 자동으로 적게 담게 됩니다. 1%룰이면 10번 연속 틀려도 −10%로 생존. 가격은 최근 종가 기준·자동 주문 없음·교육용.
          </div>
        </div>
      )}
    </div>
  )
}
