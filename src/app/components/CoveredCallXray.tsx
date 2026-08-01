'use client'
// 📉 커버드콜 X-Ray — "분배율 15%"에 끌리기 전에 본주 대비 총수익(TR)이 얼마나 뒤처졌는지 보는 화면.
//    분배율은 수익이 아니다: 분배에 원금(NAV)이 섞이면 통장엔 들어와도 자산은 줄어든다.
//    ⛔ 매수·매도 지시 아님(관측·교육 전용) · 추천 점수 미반영.
import { useEffect, useState } from 'react'
import { TK } from '@/lib/theme'
import type { CcXrayRow, PeriodStat } from '@/lib/coveredCall'

const C = {
  card: TK.bg7, card2: TK.bg5, border: TK.line1,
  text: TK.slate100, sub: '#b0bec8', low: '#8a9db5',
  green: TK.green400, red: TK.red400, gold: TK.amber500, orange: TK.orange400, cyan: TK.cyan400,
}

const VERDICT = {
  tracking:   { icon: '🟢', label: '본주 추종 양호', color: TK.green400, desc: '본주 총수익을 거의 따라감(운용보수 수준 차이)' },
  lagging:    { icon: '🟡', label: '뒤처짐',        color: TK.amber400, desc: '분배는 받지만 총수익은 본주보다 낮음' },
  far_behind: { icon: '🔴', label: '크게 뒤처짐',   color: TK.red400,   desc: '분배율이 높아도 자산 증가는 본주에 크게 못 미침' },
} as const

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const gapColor = (g: number) => g >= -2 ? TK.green400 : g >= -10 ? TK.amber400 : TK.red400

function PeriodCell({ p }: { p: PeriodStat }) {
  const label = p.months === 999 ? '전체' : `${p.months / 12}년`
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 9.5, color: C.low }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 900, fontFamily: 'monospace', color: gapColor(p.trGap) }}>
        {p.trGap >= 0 ? '+' : ''}{p.trGap.toFixed(1)}%p
      </div>
      <div style={{ fontSize: 9, color: C.low, fontFamily: 'monospace' }}>{pct(p.ccTr)} vs {pct(p.benchTr)}</div>
    </div>
  )
}

export default function CoveredCallXray() {
  const [rows, setRows] = useState<CcXrayRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/covered-call-xray').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) setRows(j?.rows ?? null) })
      .catch(() => { if (alive) setRows(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, fontSize: 12, color: C.low }}>📉 커버드콜 X-Ray 집계 중…</div>
  if (!rows?.length) return null

  const erosion = rows.filter(r => r.navErosion).length

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.text }}>📉 커버드콜 X-Ray</span>
        <span style={{ fontSize: 11, color: C.sub }}>분배율 말고 <b style={{ color: C.gold }}>총수익</b> — 본주를 얼마나 따라갔나</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>
        커버드콜은 <b>분배율이 곧 수익이 아닙니다</b>. 분배에 원금(NAV)이 섞이면 통장엔 매달 들어와도 자산은 줄어듭니다.
        그래서 <b style={{ color: C.cyan }}>배당까지 재투자한 총수익(TR)</b>을 본주와 직접 비교합니다.
        {erosion > 0 && <> 현재 <b style={{ color: C.red }}>{erosion}종은 가격 자체가 하락</b>(원금 침식 정황)입니다.</>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        {rows.map(r => {
          const v = VERDICT[r.verdict]
          const isOpen = open === r.ticker
          return (
            <div key={r.ticker} style={{ background: C.card2, border: `1px solid ${isOpen ? v.color + '66' : C.border}`, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${v.color}` }}>
              <div onClick={() => setOpen(isOpen ? null : r.ticker)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{r.label}</span>
                <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: C.low }}>{r.ticker}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: v.color, background: `${v.color}18`, borderRadius: 5, padding: '2px 7px' }}>{v.icon} {v.label}</span>
                {r.navErosion && <span title="판정 기간 동안 가격(NAV)이 하락 — 분배금의 일부가 원금에서 나왔다는 정황" style={{ fontSize: 10, fontWeight: 800, color: C.red, background: `${C.red}18`, borderRadius: 5, padding: '2px 7px' }}>⚠️ 원금 침식</span>}
                <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: gapColor(r.primary.trGap) }}>
                  {r.primary.trGap >= 0 ? '+' : ''}{r.primary.trGap.toFixed(1)}%p
                </span>
                <span style={{ fontSize: 9.5, color: C.low }}>vs {r.benchLabel}{r.kind === 'proxy' && ' (근사)'}</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                    {r.periods.map(p => <PeriodCell key={p.months} p={p} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10.5 }}>
                    <span style={{ background: TK.bg3, borderRadius: 5, padding: '3px 8px', color: C.sub }}>
                      총수익 <b style={{ color: r.primary.ccTr >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>{pct(r.primary.ccTr)}</b>
                    </span>
                    <span style={{ background: TK.bg3, borderRadius: 5, padding: '3px 8px', color: C.sub }}>
                      가격만 <b style={{ color: r.primary.ccPrice >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>{pct(r.primary.ccPrice)}</b>
                    </span>
                    <span title="총수익 − 가격 = 분배가 만든 부분. 가격이 마이너스면 이 분배의 일부는 원금에서 나온 것" style={{ background: TK.bg3, borderRadius: 5, padding: '3px 8px', color: C.sub }}>
                      분배 기여 <b style={{ color: C.gold, fontFamily: 'monospace' }}>+{r.primary.distContrib.toFixed(1)}%p</b>
                    </span>
                    <span style={{ background: TK.bg3, borderRadius: 5, padding: '3px 8px', color: C.sub }}>구조 <b style={{ color: C.cyan }}>{r.structure}</b></span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 7, lineHeight: 1.6 }}>
                    {v.desc}
                    {r.navErosion && <> · <b style={{ color: C.red }}>가격이 {pct(r.primary.ccPrice)}</b>라 인출해서 쓰면 손실이 확정됩니다(재투자해도 원금 회복이 먼저).</>}
                    <br />
                    <span style={{ color: C.low }}>기간 {r.primary.from} ~ {r.primary.to} · 본주 {r.benchLabel}{r.kind === 'proxy' && ' — 정확한 기초지수 ETF가 없어 근사 비교'}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 10, color: C.low, marginTop: 10, lineHeight: 1.55 }}>
        총수익 = 배당 재투자 기준(Yahoo 조정종가) · 본주와 <b>공통 거래일</b>만 비교(상장일 차이 보정) · 판정은 2년 창 기준(펼치면 1년·전체도 표시) ·
        세금·환율 미반영 · 옵션 프리미엄은 변동성에 따라 달라져 과거가 미래를 보장하지 않습니다 · <b>매수·매도 지시가 아닙니다</b>.
        <br />
        같은 지수를 따라가도 <b style={{ color: C.gold }}>옵션 매도 구조</b>(타겟 프리미엄 vs 데일리 전량)에 따라 결과가 크게 갈립니다 — 이름이 비슷하다고 같은 상품이 아닙니다.
      </div>
    </div>
  )
}
