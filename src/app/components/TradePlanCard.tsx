'use client'
// 📋 매매 플랜 카드 — "1% 리스크 룰" 포지션 사이저. 몇 주를 살지 '감'이 아니라 '감당할 손실'에서 역산.
//   수량 = (포트폴리오 × 리스크%) ÷ (진입가 − ATR손절가)  → 변동성 큰 종목은 자동으로 적게 = 매매 단위 리스크 패리티
//   분할 3단계(신호등 연동) + 익절 참고선(2R·3R 손익비). 전부 결정론·기존 SSOT(entryTiming) 재사용. 교육용, 자동주문 없음.
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
  const [riskPct, setRiskPct] = useState(1)       // 1회 매매 감당 리스크(% of 포트폴리오)
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

  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7,
        fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
        background: open ? 'rgba(196,181,253,0.18)' : 'rgba(196,181,253,0.08)',
        color: '#c4b5fd', border: `1px solid ${open ? '#a78bfa66' : '#a78bfa33'}`,
      }}>📋 {open ? '매매 플랜 접기' : '매매 플랜 — 몇 주를 살까?'}</button>

      {open && (
        <div style={{ marginTop: 6, background: '#12101c', border: '1px solid #a78bfa44', borderRadius: 10, padding: '11px 13px', fontSize: 11, lineHeight: 1.6 }}>
          {/* 리스크 % 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: '#c4b5fd', fontSize: 11.5 }}>🧮 1회 매매 리스크</span>
            <span style={{ display: 'inline-flex', border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
              {[0.5, 1, 2].map(p => (
                <button key={p} onClick={() => setRiskPct(p)} style={{
                  padding: '3px 10px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer', border: 'none',
                  background: riskPct === p ? '#7c3aed' : 'transparent', color: riskPct === p ? '#fff' : '#8599ae',
                }}>{p}%</button>
              ))}
            </span>
            <span style={{ color: '#7f93a8', fontSize: 10 }}>포트 {fmtW(portfolioKrw)} 기준 감당 손실 <b style={{ color: '#e2e8f0' }}>{fmtW(riskBudgetKrw)}</b></span>
          </div>

          {/* 핵심 산식 결과 */}
          <div style={{ background: '#0f1117', borderRadius: 8, padding: '9px 11px', marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 3 }}>
              <span style={{ color: '#7f93a8' }}>주당 리스크</span>
              <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>진입 {fmtP(t.price)} − 🛡손절 {fmtP(t.atrStop)} = <b>{fmtP(perShareRisk)}</b></span>
              <span style={{ color: '#7f93a8' }}>매수 가능 수량</span>
              <span style={{ color: '#4ade80', fontFamily: 'monospace', fontWeight: 800 }}>{qty.toLocaleString()}주 (≈{fmtW(totalKrw)}, 포트의 {Math.round(totalKrw / portfolioKrw * 1000) / 10}%)</span>
              <span style={{ color: '#7f93a8' }}>익절 참고선</span>
              <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>2R {fmtP(r2)} · 3R {fmtP(r3)} <span style={{ color: '#7f93a8', fontFamily: 'inherit' }}>(손절폭의 2·3배 — 손익비 1:2 이상만 노린다)</span></span>
            </div>
          </div>

          {/* 분할 매수 플랜(신호등 연동) */}
          <div style={{ marginBottom: 6 }}>
            <b style={{ color: '#c4b5fd', fontSize: 10.5 }}>📐 분할 진입 플랜 ({t.label})</b>
            <div style={{ color: '#aab6c4', marginTop: 3 }}>
              {qty <= 0 ? (<>
                ⚠️ 이 리스크 예산으로는 1주도 담을 수 없습니다(주당 리스크가 큼) — 리스크 %를 올리거나, 이 종목은 소수점 매매·관망을 검토하세요.
              </>) : qty <= 3 ? (<>
                수량이 {qty}주라 3분할은 무의미 — <b>1주씩 나눠</b> 진입하고, 전량 🛡{fmtP(t.atrStop)} 이탈 시 계획대로 정리.
                {t.light === 'yellow' && <> 2번째 주부터는 구름 상단 <b style={{ fontFamily: 'monospace' }}>{fmtP(t.cloudTop)}</b> 돌파 확인 후.</>}
              </>) : (() => {
                // 급등주는 구름 상단이 손절선보다 아래일 수 있음 → 눌림 기준은 '손절선 위'로 클램프(손절 아래서 사라는 모순 차단)
                const dip = Math.max(t.cloudTop, t.atrStop)
                const dipLabel = t.cloudTop >= t.atrStop ? '구름 상단' : '손절 참고선 위 되돌림'
                return (<>
                  {t.light === 'green' && (<>
                    ① 지금 <b>1/3</b>({Math.floor(qty / 3).toLocaleString()}주) → ② 눌림 시 {dipLabel} <b style={{ fontFamily: 'monospace' }}>{fmtP(dip)}</b> 부근 1/3 → ③ 반등 확인 후 나머지. 셋 다 🛡{fmtP(t.atrStop)} 이탈 시 계획대로 정리.
                  </>)}
                  {t.light === 'yellow' && (<>
                    ① 지금 <b>절반</b>({Math.floor(qty / 2).toLocaleString()}주)까지만 → ② 구름 상단 <b style={{ fontFamily: 'monospace' }}>{fmtP(t.cloudTop)}</b> <b>돌파 확인 후</b> 나머지 절반. 돌파 실패·🛡손절 이탈 시 1차분도 정리.
                  </>)}
                  {t.light === 'red' && (<>
                    ⛔ 지금은 진입 유예 구간입니다. 굳이 담고 싶다면 구름 상단 <b style={{ fontFamily: 'monospace' }}>{fmtP(t.cloudTop)}</b> 돌파를 확인한 뒤 위 수량의 절반부터.
                  </>)}
                </>)
              })()}
            </div>
          </div>

          <div style={{ color: '#6e7f8f', fontSize: 9.5, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
            💡 수량을 리스크에서 역산하면 변동성 큰 종목은 자동으로 적게 담게 됩니다(매매 단위 리스크 패리티). 1%룰 = 10번 연속 틀려도 −10%로 생존. 가격은 최근 종가 기준·자동 주문 없음·교육용.
          </div>
        </div>
      )}
    </div>
  )
}
