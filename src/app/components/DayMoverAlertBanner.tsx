'use client'
// 🚨 오늘의 급등락 배너 — 비트코인·보유 종목이 당일 ±5% 이상 움직이면 매매 브리핑 맨 위에서 알린다
//    (사용자 요청 2026-08-20: "비트코인이 몇% 올랐다!" + 보유 종목 급등·급락 주의 알림)
//    조용한 날은 아무것도 그리지 않는다 — 매일 뜨는 배너는 배너가 아니다.
import { useEffect, useState } from 'react'
import type { DayMoversApi } from '@/app/api/day-movers/route'
import { TK, FS, RAD } from '@/lib/theme'

export default function DayMoverAlertBanner() {
  const [d, setD] = useState<DayMoversApi | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/day-movers', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && !j.error) setD(j) })
      .catch(() => {})   // 실패 시 배너 생략 — 알림은 부가 정보라 브리핑 본문을 막지 않는다
    return () => { alive = false }
  }, [])

  if (!d || (d.surges.length === 0 && d.drops.length === 0)) return null

  // 가격 등락 규약: 상승=빨강 · 하락=파랑(한국식)
  const row = (m: DayMoversApi['surges'][0], up: boolean) => (
    <div key={`${m.ticker}-${up}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: FS.body, fontWeight: 800, color: up ? TK.red400 : TK.blue400 }}>
        {up ? '🚀' : '⚠️'} {m.name}{m.ticker !== m.name ? `(${m.ticker})` : ''}
        {up ? `이(가) ${m.changePct >= 0 ? '+' : ''}${m.changePct}% 올랐습니다!` : `이(가) ${m.changePct}% 빠졌습니다 — 주의`}
      </span>
      {!m.held && <span style={{ fontSize: FS.micro, color: TK.sub4 }}>미보유 · 시장 바로미터</span>}
    </div>
  )

  return (
    <div style={{
      background: TK.bg3, borderRadius: RAD.md, padding: '13px 16px',
      border: `1px solid ${d.surges.length ? TK.red400 : TK.blue400}55`,
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      <div style={{ fontSize: FS.micro, fontWeight: 800, color: TK.sub3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        오늘의 급등락 (전일 종가 대비 ±{d.threshold}% 이상)
      </div>
      {d.surges.map(m => row(m, true))}
      {d.drops.map(m => row(m, false))}
      <div style={{ fontSize: FS.micro, color: TK.sub4 }}>
        {d.checked}종목 확인{d.failed > 0 ? ` · ⚠️ ${d.failed}종목은 가격을 못 받아 판정 제외` : ''} · {d.asOf} ·
        급등은 추격 매수 신호가 아니고, 급락은 손절 지시가 아닙니다 — 이유(뉴스·공시)를 먼저 확인하세요.
      </div>
    </div>
  )
}
