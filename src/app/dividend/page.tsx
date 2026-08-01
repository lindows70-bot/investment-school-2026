'use client'
// 💵 배당 인컴 랩 페이지 — 배당주 전용 섹션. 포트폴리오 구성 → 월배당 대시보드·미래 프로젝션(은퇴 월세형)
//    + 📉 커버드콜 X-Ray: 초고분배 상품을 담기 전에 '분배율 ≠ 총수익'을 본주 비교로 확인(관측 전용)
import DividendIncomeLab from '@/app/components/DividendIncomeLab'
import CoveredCallXray from '@/app/components/CoveredCallXray'

export default function DividendPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <DividendIncomeLab />
      <CoveredCallXray />
    </div>
  )
}
