'use client'
// 💵 배당 인컴 랩 페이지 — 배당주 전용 섹션. 포트폴리오 구성 → 월배당 대시보드·미래 프로젝션(은퇴 월세형)
import DividendIncomeLab from '@/app/components/DividendIncomeLab'

export default function DividendPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <DividendIncomeLab />
    </div>
  )
}
