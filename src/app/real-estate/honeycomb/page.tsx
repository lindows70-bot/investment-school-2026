'use client'
// 🐝 벌집순환모형 — 부동산 Phase 2(지역별 가격×거래량 6국면 = 부동산판 로테이션 시계)
import HoneycombCycle from '@/app/components/HoneycombCycle'
import SupplyPipeline from '@/app/components/SupplyPipeline'
import { TK } from '@/lib/theme'

export default function HoneycombPage() {
  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg,#1a1410,${TK.bg1})`, border: `1px solid ${TK.orange400}44`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TK.slate100 }}>🐝 벌집순환모형 — 지역별 사이클 시계</div>
        <div style={{ fontSize: 12, color: TK.sub, marginTop: 4, lineHeight: 1.55 }}>
          주식의 섹터 로테이션 시계처럼 — <b style={{ color: TK.orange400 }}>가격 × 거래량</b>으로 17개 시도가 벌집 6국면(호황→침체진입→침체→불황→회복진입→회복)의 어디에 있는지 자동 판정합니다.
          한국부동산원 공식 통계 실데이터.
        </div>
      </div>
      <HoneycombCycle />
      <SupplyPipeline />
    </div>
  )
}
