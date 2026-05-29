/**
 * fredApi.ts — FRED 데이터 서비스 레이어
 *
 * 클라이언트 컴포넌트에서 사용하는 유일한 진입점.
 * 직접 FRED API를 호출하지 않고 /api/fred 프록시를 통해 요청한다.
 *
 * 주요 Series ID:
 *  PCEPI      — Personal Consumption Expenditures Price Index (Headline PCE)
 *  PCEPILFE   — PCE excluding Food and Energy (Core PCE)
 *  FEDFUNDS   — Effective Federal Funds Rate (EFFR)
 */

// ────────────────────────────────────────────────────────────────────────────
// 공통 타입
// ────────────────────────────────────────────────────────────────────────────
export interface FredObservation {
  date:  string   // 'YYYY-MM-DD'
  value: number
}

/** /api/fred 프록시 응답 형태 */
interface FredProxyResponse {
  seriesId:     string
  units:        string
  observations: FredObservation[]
  error?:       string
  fallback?:    boolean
}

/** 인플레이션 & 금리 차트용 병합 포인트 */
export interface InflationPoint {
  month:       string    // 'YYYY-MM'
  headlinePCE: number    // Headline PCE YoY %
  corePCE:     number    // Core PCE YoY %
  fedRate:     number    // EFFR %
}

// ────────────────────────────────────────────────────────────────────────────
// 헬퍼 함수
// ────────────────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'YYYY-MM' */
const toMonth = (date: string) => date.slice(0, 7)

/** N개월 전 날짜를 'YYYY-MM-DD' 형식으로 반환 */
function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * 단일 FRED 시리즈 fetch
 * @param seriesId  FRED 시리즈 ID (예: 'PCEPI')
 * @param units     변환 방식 ('lin' | 'pc1' 등)
 * @param months    최근 N개월치 (기본 42 = 약 3.5년)
 */
async function fetchSeries(
  seriesId: string,
  units: 'lin' | 'pc1' | 'pch' | 'chg' = 'lin',
  months = 42,
): Promise<FredObservation[]> {
  const params = new URLSearchParams({
    series_id:          seriesId,
    units,
    observation_start:  monthsAgo(months),
  })

  const res = await fetch(`/api/fred?${params.toString()}`, {
    // 브라우저 캐시 1시간 (FRED 월별 업데이트)
    next: { revalidate: 3600 } as RequestInit['next'],
  })

  if (!res.ok) {
    throw new Error(`[fredApi] /api/fred 오류: ${res.status} (series: ${seriesId})`)
  }

  const json: FredProxyResponse = await res.json()

  if (json.error) {
    throw new Error(`[fredApi] FRED 오류: ${json.error} (series: ${seriesId})`)
  }

  return json.observations
}

// ────────────────────────────────────────────────────────────────────────────
// 인플레이션 & 금리 데이터 — 3개 시리즈 병렬 fetch + 월 단위 병합
// ────────────────────────────────────────────────────────────────────────────

/**
 * Headline PCE, Core PCE, EFFR를 병렬로 가져와서
 * 날짜 기준으로 병합된 InflationPoint[] 를 반환한다.
 *
 * - PCE 시리즈: units='pc1' (전년 동기 대비 % 변화) → 직접 YoY% 반환
 * - FEDFUNDS  : units='lin' (월별 평균 %, 이미 % 단위)
 * - 3개 시리즈 모두 데이터가 있는 월만 결과에 포함
 *
 * @param months  최근 N개월치 (기본 36 = 3년)
 */
export async function fetchInflationAndRate(months = 36): Promise<InflationPoint[]> {
  // 병렬 fetch — Promise.all 로 3개 동시 요청
  const [headlineRaw, coreRaw, fedRaw] = await Promise.all([
    fetchSeries('PCEPI',    'pc1', months + 14),  // pc1 변환에 12개월 기준 데이터 필요 → +여유
    fetchSeries('PCEPILFE', 'pc1', months + 14),
    fetchSeries('FEDFUNDS', 'lin', months + 2),
  ])

  // 월 단위 맵 구성 (key: 'YYYY-MM')
  const headlineMap = new Map(headlineRaw.map(o => [toMonth(o.date), o.value]))
  const coreMap     = new Map(coreRaw.map(o => [toMonth(o.date), o.value]))
  const fedMap      = new Map(fedRaw.map(o => [toMonth(o.date), o.value]))

  // 3개 시리즈에 공통으로 존재하는 월만 선택 (조인)
  // 기준 시리즈: FEDFUNDS (월별 데이터 가장 규칙적)
  const result: InflationPoint[] = []
  const cutoff = monthsAgo(months).slice(0, 7)  // 'YYYY-MM' 컷오프

  Array.from(fedMap.entries()).forEach(([month, fedRate]) => {
    if (month < cutoff) return

    const headlinePCE = headlineMap.get(month)
    const corePCE     = coreMap.get(month)

    // 3개 모두 있는 월만 포함 (결측 월 제외)
    if (headlinePCE == null || corePCE == null) return

    result.push({
      month,
      headlinePCE: parseFloat(headlinePCE.toFixed(2)),
      corePCE:     parseFloat(corePCE.toFixed(2)),
      fedRate:     parseFloat(fedRate.toFixed(2)),
    })
  })

  // 월 오름차순 정렬
  return result.sort((a, b) => a.month.localeCompare(b.month))
}

// ────────────────────────────────────────────────────────────────────────────
// 연준 대차대조표 (QT) — WALCL / WSHOTSL / WSHOMCB
// ────────────────────────────────────────────────────────────────────────────

/** 대차대조표 차트용 포인트 (주간 → 월별 평균으로 집계) */
export interface BalanceSheetPoint {
  month: string    // 'YYYY-MM'
  total: number    // 총자산 (조 달러, Trillions)
  tsy:   number    // 미국채 (Trillions)
  mbs:   number    // MBS    (Trillions)
}

/** Millions → Trillions 변환 */
const mToT = (v: number) => parseFloat((v / 1_000_000).toFixed(4))

/**
 * WALCL / WSHOTSL / WSHOMCB 3개 시리즈를 병렬 fetch 후
 * 월별 평균으로 집계하여 BalanceSheetPoint[] 반환.
 *
 * FRED 단위: Millions of Dollars (주간 Wednesday 기준)
 * → 조 달러(Trillions)로 변환
 */
export async function fetchBalanceSheet(months = 42): Promise<BalanceSheetPoint[]> {
  const [totalRaw, tsyRaw, mbsRaw] = await Promise.all([
    fetchSeries('WALCL',   'lin', months),   // 총자산
    fetchSeries('WSHOTSL', 'lin', months),   // 미국채
    fetchSeries('WSHOMCB', 'lin', months),   // MBS
  ])

  // 주간 → 월별 평균 집계 헬퍼
  function toMonthlyAvg(obs: FredObservation[]): Map<string, number> {
    const sums = new Map<string, { sum: number; count: number }>()
    obs.forEach(o => {
      const m = toMonth(o.date)
      const prev = sums.get(m) ?? { sum: 0, count: 0 }
      sums.set(m, { sum: prev.sum + o.value, count: prev.count + 1 })
    })
    const result = new Map<string, number>()
    sums.forEach(({ sum, count }, m) => {
      result.set(m, mToT(sum / count))
    })
    return result
  }

  const totalMap = toMonthlyAvg(totalRaw)
  const tsyMap   = toMonthlyAvg(tsyRaw)
  const mbsMap   = toMonthlyAvg(mbsRaw)

  const cutoff = monthsAgo(months).slice(0, 7)
  const result: BalanceSheetPoint[] = []

  Array.from(totalMap.entries()).forEach(([month, total]) => {
    if (month < cutoff) return
    const tsy = tsyMap.get(month)
    const mbs = mbsMap.get(month)
    if (tsy == null || mbs == null) return
    result.push({ month, total, tsy, mbs })
  })

  return result.sort((a, b) => a.month.localeCompare(b.month))
}

// ────────────────────────────────────────────────────────────────────────────
// API Key 설정 여부 확인 (클라이언트에서 503 수신 시 폴백 판단용)
// ────────────────────────────────────────────────────────────────────────────
export async function checkFredApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/fred?series_id=FEDFUNDS&limit=1')
    if (res.status === 503) return false  // API Key 미설정
    return res.ok
  } catch {
    return false
  }
}
