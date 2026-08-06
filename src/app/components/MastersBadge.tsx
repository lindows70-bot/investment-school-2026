'use client'
// 🎩 거장 위원회 배지 — 통합추천·리밸런싱 카드에 위원회 판정과 매수 가격 구간을 얹는다.
// ⛔ 점수·순위·선별에는 반영하지 않는다(별도 레이어) — 위원회 재료(PEG·ROE·FCF·기저효과)가
//    이미 6축 점수에 들어가 있어, 점수에 또 더하면 같은 신호를 두 번 세는 것이 된다.
//    대신 **레드라인(하나면 탈락)** 이라는 다른 논리와 **얼마에 살 것인가**(가격 구간)를 보탠다.
// 판정은 /api/masters-verdict?brief=1 — 리서치 탭과 **같은 computeCommittee SSOT**(제2원칙).

import { useEffect, useState } from 'react'
import { TK, FS, RAD } from '@/lib/theme'
import type { MastersVerdictResponse } from '@/app/api/masters-verdict/route'

const C = { pass: TK.green400, gray: TK.amber400, fail: TK.red400 } as const
const L = { pass: '위원회 통과', gray: '위원회 회색', fail: '위원회 불통과' } as const
const I = { pass: '🟢', gray: '🟡', fail: '🔴' } as const

export default function MastersBadge({ ticker, market, currency, currentPrice }: {
  ticker: string; market: string; currency?: string | null; currentPrice?: number | null
}) {
  const [d, setD] = useState<MastersVerdictResponse | null>(null)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    fetch(`/api/masters-verdict?ticker=${encodeURIComponent(ticker)}&market=${market === 'KR' ? 'KR' : 'US'}&brief=1`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j?.masters) setD(j) })
      .catch(() => { /* 배지는 부가 정보 — 실패해도 추천 카드는 그대로 */ })
    return () => { cancelled = true }
  }, [ticker, market])

  if (!d) return null   // 로딩·실패 시 아무것도 그리지 않는다(추천 카드를 흔들지 않음)

  const cur = currency ?? d.currency
  const fmt = (v: number) => cur === 'KRW' ? `₩${Math.round(v).toLocaleString('ko-KR')}` : `$${v.toFixed(2)}`
  const price = currentPrice ?? d.currentPrice
  // 세 상태를 가른다 — '구간 아래(더 싼 값)'를 '구간 안'이라 부르면 부정확하다(오리온 13만 vs 구간 32.6만~ 실사고)
  const bandPos: 'below' | 'in' | 'above' | null = d.buyBand && price != null
    ? (price < d.buyBand.low ? 'below' : price <= d.buyBand.high ? 'in' : 'above') : null
  const hits = d.redlines.filter(r => r.hit)

  const tip = [
    `${L[d.final]} — ${d.finalReason}`,
    '',
    ...d.masters.map(m => `${m.emoji} ${m.name}: ${m.verdict === 'pass' ? '통과' : m.verdict === 'fail' ? '불통과' : '회색'}`),
    hits.length ? `\n🚧 레드라인: ${hits.map(r => r.label).join('·')}` : '',
    '\n⛔ 점수·순위에는 반영되지 않습니다(별도 레이어). 리서치 → 거장 위원회 탭에서 4인 토론 전문을 볼 수 있습니다.',
  ].filter(Boolean).join('\n')

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <span title={tip}
        style={{ background: `${C[d.final]}14`, color: C[d.final], border: `1px solid ${C[d.final]}55`,
          borderRadius: RAD.xs, padding: '1px 7px', fontSize: FS.micro, fontWeight: 800, cursor: 'help', whiteSpace: 'nowrap' }}>
        🎩 {I[d.final]} {L[d.final]}
      </span>
      {hits.length > 0 && (
        <span title={hits.map(r => `${r.label} — ${r.detail}`).join('\n')}
          style={{ background: `${TK.red500}12`, color: TK.red400, border: `1px solid ${TK.red500}44`,
            borderRadius: RAD.xs, padding: '1px 7px', fontSize: FS.micro, cursor: 'help', whiteSpace: 'nowrap' }}>
          🚧 레드라인 {hits.length}
        </span>
      )}
      {d.buyBand && (
        <span title={`버핏식 보수 DCF 내재가치 ${fmt(d.buyBand.fairValue)} 의 안전마진 30~15% 구간입니다.
현재가가 이 구간 위에 있다면 '나쁜 회사'라는 뜻이 아니라 '이 잣대로는 아직 비싸다'는 뜻입니다.
⚠️ 경기순환주는 현재 이익 기준 DCF라 사이클 위치에 따라 구간이 크게 왜곡될 수 있습니다.`}
          style={{ background: bandPos === 'in' || bandPos === 'below' ? `${TK.green500}12` : 'rgba(148,163,184,0.10)',
            color: bandPos === 'in' || bandPos === 'below' ? TK.green400 : TK.slate300,
            border: `1px solid ${bandPos === 'in' || bandPos === 'below' ? TK.green500 : TK.line1}44`,
            borderRadius: RAD.xs, padding: '1px 7px', fontSize: FS.micro, cursor: 'help', whiteSpace: 'nowrap' }}>
          🎯 위원회 매수구간 {fmt(d.buyBand.low)}~{fmt(d.buyBand.high)}
          {bandPos === 'above' && <span style={{ opacity: 0.75 }}> (현재가는 구간 위)</span>}
          {bandPos === 'in' && <span style={{ opacity: 0.85 }}> ✓ 구간 안</span>}
          {bandPos === 'below' && <span style={{ opacity: 0.85 }}> ✓ 구간 아래(안전마진 30%+)</span>}
        </span>
      )}
    </span>
  )
}
