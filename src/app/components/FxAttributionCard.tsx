'use client'
// 💱 환율 기여도 분해 — "달러로는 벌었는데 계좌는 왜 마이너스지?"를 숫자로 답한다.
//    원화 수익 = 달러 수익 + 환율 기여. ⛔ 예측·환헤지 권유 아님(과거 분해·관측 전용).
import { useEffect, useState } from 'react'
import { TK } from '@/lib/theme'
import type { FxAttribution } from '@/lib/fxAttribution'

const C = {
  card: '#12151f', card2: TK.bg5, border: TK.border,
  text: TK.slate100, sub: '#b0bec8', low: '#8a9db5',
  green: TK.green400, red: TK.red400, gold: TK.amber400, cyan: TK.cyan400,
}

const won = (n: number) => n >= 1e8 ? `₩${(n / 1e8).toFixed(1)}억`
  : Math.abs(n) >= 1e4 ? `₩${Math.round(n / 1e4).toLocaleString()}만` : `₩${Math.round(n).toLocaleString()}`
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const pp = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%p`
const col = (n: number) => n >= 0 ? C.green : C.red

export default function FxAttributionCard() {
  const [d, setD] = useState<FxAttribution | null>(null)
  const [loading, setLoading] = useState(true)
  const [openAll, setOpenAll] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/fx-attribution').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) setD(j?.error || j?.empty ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, fontSize: 12, color: C.low }}>💱 환율 기여도 계산 중…</div>
  if (!d || !d.rows.length) return null

  const shown = openAll ? d.rows : d.rows.slice(0, 5)
  const flipped = d.rows.filter(r => r.flipped)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.text }}>💱 환율 기여도</span>
        <span style={{ fontSize: 11, color: C.sub }}>달러로 번 것 vs 환율이 만든 것</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.low, fontFamily: 'monospace' }}>현재 ₩{d.fxNow.toLocaleString()}</span>
      </div>

      {/* 3분해 — 원화 수익 = 달러 수익 + 환율 기여 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {[
          { k: '달러 기준 수익', v: pct(d.retUsd), c: col(d.retUsd), sub: '종목이 실제로 번 것' },
          { k: '환율 기여', v: pp(d.fxContrib), c: col(d.fxContrib), sub: d.fxContrib >= 0 ? '환율이 보태준 것' : '환율이 깎아먹은 것' },
          { k: '원화 기준 수익', v: pct(d.retKrw), c: col(d.retKrw), sub: '내 계좌에 찍히는 것' },
        ].map(x => (
          <div key={x.k} style={{ flex: '1 1 150px', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10.5, color: C.low }}>{x.k}</div>
            <div style={{ fontSize: 19, fontWeight: 900, fontFamily: 'monospace', color: x.c }}>{x.v}</div>
            <div style={{ fontSize: 9.5, color: C.low, marginTop: 1 }}>{x.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: C.sub, marginTop: 7, lineHeight: 1.6 }}>
        해외 종목 {won(d.valueKrw)}{d.cashUsdKrw > 0 && <> + 달러 예수금 {won(d.cashUsdKrw)}</>}
        {d.fxExposurePct != null && <> · <b style={{ color: C.cyan }}>총자산의 {d.fxExposurePct}%</b>가 환율에 노출(현금 포함)</>}
        {' '}— 원화 수익({pct(d.retKrw)}) = 달러 수익({pct(d.retUsd)}) + 환율({pp(d.fxContrib)}).
        {d.cashUsdKrw > 0 && <span style={{ color: C.low }}> 아래 수익 분해는 <b>종목만</b>입니다(예수금은 매입 환율 개념이 없어 노출·시나리오에만 반영).</span>}
      </div>

      {flipped.length > 0 && (
        <div style={{ marginTop: 9, fontSize: 11.5, fontWeight: 700, color: C.gold, background: '#2a2213', borderRadius: 8, padding: '8px 11px', lineHeight: 1.6 }}>
          ⚠️ <b>{flipped.length}종은 달러와 원화의 부호가 다릅니다</b> — {flipped.slice(0, 3).map(r => `${r.name.slice(0, 14)}(달러 ${pct(r.retUsd)} → 원화 ${pct(r.retKrw)})`).join(' · ')}
          {flipped.length > 3 && ` 외 ${flipped.length - 3}종`}. 종목은 올랐는데 계좌는 마이너스인 이유가 환율입니다.
        </div>
      )}

      {/* 종목별 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 11 }}>
        {shown.map(r => (
          <div key={r.ticker} style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', background: r.flipped ? '#221c10' : C.card2, borderRadius: 8, padding: '7px 11px', borderLeft: `3px solid ${col(r.fxContrib)}` }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{r.name.length > 18 ? r.name.slice(0, 18) : r.name}</span>
            <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: C.low }}>{r.ticker}</span>
            <span style={{ fontSize: 9.5, color: C.low }} title={`매입 ${r.purchaseDate}${r.lots > 1 ? ` 외 ${r.lots - 1}건(원가 가중)` : ''}`}>
              매입 ₩{r.fxBuy.toLocaleString()}{r.lots > 1 && ` (${r.lots}건)`}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'baseline', fontFamily: 'monospace', fontSize: 11.5 }}>
              <span style={{ color: col(r.retUsd) }} title="달러 기준">{pct(r.retUsd)}</span>
              <span style={{ color: C.low, fontSize: 10 }}>+</span>
              <span style={{ color: col(r.fxContrib), fontWeight: 800 }} title="환율 기여">{pp(r.fxContrib)}</span>
              <span style={{ color: C.low, fontSize: 10 }}>=</span>
              <span style={{ color: col(r.retKrw), fontWeight: 900, fontSize: 12.5 }} title="원화 기준(내 계좌)">{pct(r.retKrw)}</span>
            </span>
          </div>
        ))}
        {d.rows.length > 5 && (
          <div onClick={() => setOpenAll(!openAll)} style={{ fontSize: 10.5, color: C.cyan, cursor: 'pointer', textAlign: 'center', padding: '3px 0' }}>
            {openAll ? '접기 ▴' : `전체 ${d.rows.length}종 보기 ▾`}
          </div>
        )}
      </div>

      {/* 시나리오 — 환율만 움직였을 때 */}
      <div style={{ marginTop: 12, background: C.card2, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text }}>환율만 움직인다면 (다른 조건 그대로)</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
          {d.scenarios.map(s => (
            <span key={s.deltaPct} style={{ fontSize: 10.5, background: TK.bg3, borderRadius: 6, padding: '4px 9px', color: C.sub }}>
              ₩{s.fxRate.toLocaleString()} <span style={{ color: C.low }}>({s.deltaPct > 0 ? '+' : ''}{s.deltaPct}%)</span>
              {' '}<b style={{ color: col(s.diffKrw), fontFamily: 'monospace' }}>{s.diffKrw >= 0 ? '+' : ''}{won(Math.abs(s.diffKrw)).replace('₩', s.diffKrw >= 0 ? '₩' : '−₩')}</b>
            </span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: C.low, marginTop: 10, lineHeight: 1.55 }}>
        매입일 환율 = 그날 종가(실제 체결 환율·증권사 환전 스프레드와 다를 수 있음) · 분할매수는 원가 가중 평균 · 배당·수수료 미반영 ·
        <b> 원화 상장 해외 ETF(TIGER 미국S&P500 등)는 제외</b>(원화로 사고팔아 매입 환율 개념이 없음 — 다만 그 안에도 환노출은 있습니다) ·
        예측이 아니라 <b>지나간 기간의 분해</b>이며 환헤지 권유가 아닙니다.
      </div>
    </div>
  )
}
