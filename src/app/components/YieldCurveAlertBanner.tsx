'use client'
// 🔴 장단기 금리 역전 경보 배너 — 대시보드·오늘의 매매브리핑 상단.
//   ⛔ 지속 역전(🔴 red)에서만 뜬다. 짧은 역전·평탄은 채권 페이지 안에서만 알린다
//      (단순 음수로 울리면 2025년에만 6번 울렸다 — Phase 0 실측).
//   ⛔ 매도 지시가 아니다. 리드타임 5~34개월이고 2022년 역전은 침체로 이어지지 않았다.
import { useEffect, useState } from 'react'
import type { YieldCurveResult } from '@/lib/yieldCurve'
import { TK, FS, RAD, SP } from '@/lib/theme'

export default function YieldCurveAlertBanner() {
  const [d, setD] = useState<YieldCurveResult | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/yield-curve', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.alert === 'red') setD(j) })
      .catch(() => { /* graceful — 경보는 없으면 조용히 없다 */ })
    return () => { alive = false }
  }, [])

  if (!d || dismissed) return null
  const inv = d.spreads.filter(s => s.value != null && s.value < 0)
  const L = d.leadSummary

  return (
    <div style={{
      background: `linear-gradient(135deg,${TK.red400}18,${TK.bg1})`, border: `1px solid ${TK.red400}66`,
      borderRadius: RAD.md, padding: `${SP.sm}px ${SP.lg}px`, display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.body, fontWeight: 800, color: TK.red400 }}>🔴 장단기 금리 역전 경보</span>
        {inv.map(s => (
          <span key={s.key} title={s.meaning}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#7f1d1d22', border: `1px solid ${TK.red400}55`, borderRadius: 7, padding: '3px 9px', fontSize: FS.tiny, whiteSpace: 'nowrap' }}>
            <b style={{ color: TK.slate200 }}>{s.label}</b>
            <b style={{ color: TK.red400, fontFamily: 'monospace' }}>{s.value!.toFixed(2)}%p</b>
            <span style={{ color: TK.sub2, fontSize: FS.micro }}>{s.invertedDays}거래일째</span>
          </span>
        ))}
        <a href="/bonds" style={{ fontSize: FS.micro, color: TK.cyan400, textDecoration: 'none' }}>채권 페이지에서 보기 ↗</a>
        <button onClick={() => setDismissed(true)}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: TK.sub, cursor: 'pointer', fontSize: FS.body }}>✕</button>
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub3, lineHeight: 1.65 }}>
        짧은 돈이 긴 돈보다 비싸진 상태 — 시장이 앞으로 금리가 내려갈 것(=경기가 식을 것)으로 보고 있다는 뜻입니다.
        {L.n > 0 && <> 과거 지속 역전 뒤 침체까지 <b style={{ color: TK.amber400 }}>중앙값 {L.medianMonths}개월</b>(범위 {L.minMonths}~{L.maxMonths}개월, 표본 {L.n}건) 걸렸습니다.</>}
        {' '}<b style={{ color: TK.sub2 }}>다만 2022~24년 역전은 537일·최심 −1.89%p로 역사상 손꼽히게 깊었는데도 침체가 오지 않았습니다.</b>
        {' '}⛔ 매도 신호가 아니라 국면 인식입니다.
      </div>
    </div>
  )
}
