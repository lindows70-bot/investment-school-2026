'use client'
// 💵 배당 인컴 랩 페이지 — 배당주 전용 섹션. 포트폴리오 구성 → 월배당 대시보드·미래 프로젝션(은퇴 월세형)
//    + 📉 커버드콜 X-Ray: 내 포트에 커버드콜이 담겼을 때만 펼쳐 보여준다(아니면 접힘 — 무관한 정보로 자리 차지 금지)
import { useCallback, useState } from 'react'
import DividendIncomeLab from '@/app/components/DividendIncomeLab'
import CoveredCallXray from '@/app/components/CoveredCallXray'

export default function DividendPage() {
  const [held, setHeld] = useState<string[]>([])
  const onHoldingsChange = useCallback((t: string[]) => setHeld(t), [])
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <DividendIncomeLab onHoldingsChange={onHoldingsChange} />
      <CoveredCallXray heldTickers={held} />
    </div>
  )
}
