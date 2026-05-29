/**
 * fedwatchApi.ts — CME FedWatch 클라이언트 서비스
 *
 * /api/fedwatch 프록시를 호출하여 FOMC별 금리 확률 데이터를 반환.
 * 컴포넌트는 이 함수만 사용 — 직접 CME나 Yahoo Finance를 호출하지 않음.
 */

// ── 서버에서 반환하는 타입 (route.ts의 FomcProbData와 동일)
export interface RateProb {
  rate:        number
  label:       string    // '3.00~3.25%'
  prob:        number    // 0~100 (%)
  isConsensus: boolean
}

export interface FomcProbData {
  label:           string        // 'Jun '26'
  date:            string        // '2026-06-17'
  futuresTicker:   string        // 'ZQM26.CBT'
  futuresPrice:    number | null
  impliedRate:     number | null
  postMeetingRate: number | null
  probs:           RateProb[]
  consensusRate:   number | null
  consensusProb:   number | null
  dataAvailable:   boolean
}

export interface FedWatchResponse {
  asOf:     string
  preRate:  number
  meetings: FomcProbData[]
}

/**
 * FOMC 회의별 금리 확률 데이터 조회
 * @param currentRate  현재 기준금리 midpoint (FRED FEDFUNDS 최신값)
 */
export async function fetchFedWatchData(currentRate: number): Promise<FedWatchResponse> {
  const params = new URLSearchParams({
    currentRate: currentRate.toFixed(4),
  })
  const res = await fetch(`/api/fedwatch?${params}`, {
    next: { revalidate: 1800 } as RequestInit['next'],  // 30분 캐시
  })
  if (!res.ok) throw new Error(`[fedwatchApi] /api/fedwatch 오류: ${res.status}`)
  return res.json() as Promise<FedWatchResponse>
}
