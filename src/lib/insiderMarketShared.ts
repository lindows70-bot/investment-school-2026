// 🇺🇸 내부자 매수 스캐너 — 화면과 서버가 함께 쓰는 순수 상수·타입(의존성 0). 서버 전용 코드(SEC·Supabase)는 insiderMarket.ts 에.
import type { RevisionSignal } from '@/lib/analystShared'

export const WINDOW_DAYS = 30
/** 보고서 값 — 우리 백테스트 검증치가 아니다(화면에 그렇게 적는다). 표본이 쌓이면 scripts/autopsy.mjs 로 잰다. */
export const LIMITS = { minValue: 100_000, minMcapPct: 0.1, cluster: 2, nearLowPct: 15, minPerBuyer: 10_000, maxGapPct: 120 }
// minPerBuyer·maxGapPct 는 우리가 실측으로 더한 것 — 직원 소액 매수 30명(TSM)·ADR 원주 단가로 +470% 괴리 같은 잡음 차단

export interface InsiderMarketItem {
  ticker: string; issuer: string; sector: string | null; sectorKo: string | null
  buyers: number; roles: string[]; value: number; shares: number; unpriced: boolean
  firstDate: string; lastDate: string
  avgPx: number | null; price: number | null; gapPct: number | null       // 평균 매수단가 대비 현재가 괴리
  mcap: number | null; mcapPct: number | null                              // 시총 대비 매수 비중 %
  cluster: boolean; nearLow: boolean; revision: RevisionSignal; loss: boolean
  buys: { owner: string; role: string; date: string; value: number; unpriced: boolean }[]
}
export interface InsiderMarket {
  asOf: string
  window: { from: string; to: string; daysComplete: number; daysPartial: number; rawBuys: number; candidates: number }
  items: InsiderMarketItem[]
  sectors: { sector: string; ko: string; icon: string; count: number }[]
  summary: string
  partial: boolean
}
