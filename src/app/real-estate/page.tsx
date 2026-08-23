'use client'
// 🏠 부동산 인텔리전스 — 독립 섹션(주식·코인에 이은 포트폴리오 3번째 축). Phase 1 = 시장 대시보드
import ReMarketDashboard from '@/app/components/ReMarketDashboard'
import ReDeepGauges from '@/app/components/ReDeepGauges'
import RentYieldSpread from '@/app/components/RentYieldSpread'
import HouseVsKospi from '@/app/components/HouseVsKospi'
import ReWatchlist from '@/app/components/ReWatchlist'
import RePhaseAlert from '@/app/components/RePhaseAlert'
import RePolicyRadar from '@/app/components/RePolicyRadar'   // 🏛️ 정책은 모든 부동산 지표의 상류라 최상단
import ReTaxMap from '@/app/components/ReTaxMap'             // 💰 세금은 국민 관심 1순위 — 정책 바로 아래
import CofixPanel from '@/app/components/CofixPanel'         // 🏦 COFIX — 변동금리 대출 기준금리(2026-08-23)
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
      <RePhaseAlert />
      <RePolicyRadar />
      <ReTaxMap />
      <ReWatchlist />
      {/* 🔗 id 는 정책 레이더의 4대 경로 카드가 걸어오는 앵커다(rePolicy.CHANNEL_META.href) —
          세제·금융 경로가 닿는 지표(거래량·미분양·주담대 금리)가 여기 있다 */}
      <div id="re-market"><ReMarketDashboard /></div>
      {/* 🏦 COFIX — 변동금리 대출의 기준금리. 지금까지 앱은 '주담대 금리'(결과)만 봤고 COFIX(원인)가 없었다.
          금리 축이 있는 시장 대시보드 바로 아래에 둬서 원인→결과 순으로 읽히게 한다(2026-08-23 교차검증) */}
      <CofixPanel />
      <ReDeepGauges />
      <RentYieldSpread />
      <HouseVsKospi />
    </div>
  )
}
