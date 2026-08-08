// ⭐ 핵심 추천(3중 검증) SSOT — 판정 술어와 전향적 적립 스토어. UI(UnifiedReco)와 적립 크론(core-reco)이 같은 술어를 쓴다.
//
// 왜 만들었나(2026-08-08): ⭐핵심 추천은 클라이언트에서만 계산되고 어디에도 적립되지 않아,
// UI가 약속한 "성적은 성적표가 매일 자동 채점합니다"가 실제로는 불가능했다(전향적 승률이 영원히 '적립 대기').
// 소급 검증은 역인과로 무효 확인(2026-08-06) — 전향적 적립만이 이 조합의 승률을 말할 수 있는 유일한 길이다.

/** 적립 스토어 — timing 의 signal-history-v1 과 분리(섞으면 성적표가 core 를 timing 그룹으로 오집계) */
export const CORE_HIST_KEY = 'core-reco-history-v1'

export interface CoreHistEntry {
  date: string
  ticker: string
  name: string
  market: 'KR' | 'US'
  combined: number       // 당시 6축 통합 점수(맥락용)
  prime: boolean         // 🏅 정예 타점 여부
}

/** ⭐ 3중 통과 술어 — 🚦타이밍(진입 적기 or 정예 타점) × 🎩위원회(비불통과·단위의심 없음).
 *  가치(6축 상위)는 items 에 든 것 자체가 통과 조건이라 여기선 안 본다. 결측은 통과가 아니다(verdict 없으면 false). */
export function isCorePick(
  // prime 은 호출부마다 타입이 다르다(UI=PrimeSetup 객체 · 크론=boolean) — 존재 여부만 보므로 unknown 으로 받는다
  timing: { light?: string | null; prime?: unknown } | null | undefined,
  verdict: { final?: string | null; unitSuspect?: boolean | null } | null | undefined,
): boolean {
  const timingOk = !!timing && (timing.light === 'green' || !!timing.prime)
  return timingOk && !!verdict?.final && verdict.final !== 'fail' && !verdict.unitSuspect
}
