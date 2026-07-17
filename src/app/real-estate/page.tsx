'use client'
// 🏠 부동산 인텔리전스 — 독립 섹션(주식·코인에 이은 포트폴리오 3번째 축). Phase 1 = 시장 대시보드
import ReMarketDashboard from '@/app/components/ReMarketDashboard'
import ReDeepGauges from '@/app/components/ReDeepGauges'
import RentYieldSpread from '@/app/components/RentYieldSpread'
import HouseVsKospi from '@/app/components/HouseVsKospi'
import { TK } from '@/lib/theme'

export default function RealEstatePage() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg,#1a1410,${TK.bg1})`, border: `1px solid ${TK.orange400}44`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TK.slate100 }}>🏠 부동산 시장 대시보드</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.55 }}>
          주식의 Fed Watch처럼 — <b style={{ color: TK.orange400 }}>금리(중력) × 가격지수 × 미분양(재고)</b>을 한 화면에.
          KB·한국부동산원 공식 통계(한국은행 ECOS)와 미국 케이스-실러(FRED) 실데이터.
        </div>
      </div>
      <ReMarketDashboard />
      <ReDeepGauges />
      <RentYieldSpread />
      <HouseVsKospi />
    </div>
  )
}
