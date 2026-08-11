'use client'
// 🚨 스윙 손절 경보 — 스윙 타점이 추천했던 종목이 **손절선 아래로 마감**하면 매매 브리핑에 크게 띄운다.
//   "손절선이 오면 손절한다"는 이 기법의 반쪽이다 — 진입만 알려주고 이탈을 침묵하면 물타기 유혹만 남는다.
//   경보가 없으면 렌더 0(조용한 날엔 화면을 차지하지 않는다 — 희석 경보와 같은 관례).
//   ⚠️ 종가 기준(킴스 'Daily Close' 원칙): 장중 꼬리로 살짝 찍은 건 경보하지 않는다.
import { useEffect, useState } from 'react'
import type { SwingRadar } from '@/lib/swingRadar'
import { SWING_TRACKS } from '@/lib/swingSetup'
import { TK, FS, RAD } from '@/lib/theme'

export default function SwingStopAlertBanner() {
  const [alerts, setAlerts] = useState<SwingRadar['stopAlerts']>([])
  useEffect(() => {
    let alive = true
    fetch('/api/swing-radar', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive && Array.isArray(j?.stopAlerts)) setAlerts(j.stopAlerts) })
      .catch(() => { /* 실패 시 렌더 0 — 경보를 지어내지 않는다 */ })
    return () => { alive = false }
  }, [])
  if (!alerts.length) return null

  return (
    <div style={{ background: `${TK.red400}14`, border: `2px solid ${TK.red400}`, borderRadius: RAD.md, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.xl }}>🚨</span>
        <b style={{ fontSize: FS.lg, color: TK.red400 }}>스윙 손절선 이탈 — 오늘 정리를 검토하세요</b>
        <span style={{ fontSize: FS.micro, color: TK.sub2 }}>스윙 타점이 추천했던 종목이 손절선 아래로 <b>마감</b>했습니다</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {alerts.map((a, i) => {
          const cur = a.market === 'KR' ? '₩' : '$'
          const f = (n: number) => a.market === 'KR' ? Math.round(n).toLocaleString() : n.toFixed(2)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: TK.bg1, borderRadius: RAD.sm, padding: '9px 12px' }}>
              <span style={{ fontSize: FS.body }}>{a.flag}</span>
              <b style={{ fontSize: FS.body, color: TK.slate100 }}>{a.name}</b>
              <span style={{ fontSize: FS.micro, color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{a.ticker}</span>
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{SWING_TRACKS[a.track].icon} {a.date} 추천</span>
              <span style={{ marginLeft: 'auto', fontSize: FS.tiny, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: TK.sub2 }}>
                손절선 {cur}{f(a.stop)} → 종가 <b style={{ color: TK.blue400 }}>{cur}{f(a.last)}</b>
              </span>
              <b style={{ fontSize: FS.body, color: TK.blue400, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{a.lossPct}%</b>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 8, lineHeight: 1.6 }}>
        진입 근거(구조선)가 깨졌습니다 — 이 기법은 <b>여기서 정리하고 다음 자리를 기다리는 것</b>까지가 한 세트입니다.
        ⛔ 추가 매수(물타기)로 평단을 낮추는 대응은 이 기법이 아닙니다. · 매도 지시가 아닌 교육용 알림입니다.
      </div>
    </div>
  )
}
