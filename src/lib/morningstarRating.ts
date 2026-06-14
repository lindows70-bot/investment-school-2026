// 🌟 모닝스타식 스타 등급 산정 SSOT — 공개 방법론(해자·공정가치·불확실성·자본배분)을 우리 실데이터로 재현(교육용)
// 모닝스타 실제 별점·적정가를 베끼지 않음(저작권). DCF·해자·ROE는 전부 기존 엔진 재사용(제2원칙).

export type Uncertainty  = 'Low' | 'Medium' | 'High' | 'Very High'
export type MoatWidth    = 'wide' | 'moderate' | 'narrow' | 'none'
export type MoatTrend    = 'positive' | 'stable' | 'negative'
export type Stewardship  = 'exemplary' | 'standard' | 'poor'

export interface StarInputs {
  pFv:        number | null   // 현재가 / 공정가치(내재가치). null=DCF 불가(적자 등)
  moatWidth:  MoatWidth
  moatVerdict:'intact' | 'hairline' | 'breach' | 'early'
  opMargin:   number | null   // 영업이익률 소수(-0.24=-24%)
  roe:        number | null   // 소수(0.18=18%)
  netDebtPos: boolean | null  // 순부채>0(빚>현금)이면 true
  category:   string          // 린치 6대 분류
}

export interface StarResult {
  stars:       number | null  // 1~5(0.5 단위), null=DCF 불가로 가격평가 보류
  uncertainty: Uncertainty
  moatWidth:   MoatWidth
  moatTrend:   MoatTrend
  stewardship: Stewardship
  discountPct: number | null  // 공정가치 대비 할인(+)/할증(-) % = 안전마진
}

/**
 * 불확실성(Uncertainty) — 모닝스타의 정수. 해자가 약하거나 적자·경기민감일수록 미래 현금흐름
 * 예측이 어려워 '같은 별점을 받으려면 더 큰 안전마진'을 요구한다.
 */
export function uncertaintyOf(moatWidth: MoatWidth, opMargin: number | null, category: string): Uncertainty {
  const loss = opMargin != null && opMargin < 0
  if (loss || category === 'turnaround' || moatWidth === 'none') return 'Very High'
  if (moatWidth === 'narrow' || category === 'fast_grower' || category === 'cyclical') return 'High'
  if (moatWidth === 'moderate' || category === 'asset_play') return 'Medium'
  return 'Low'   // wide 해자 + 흑자 + stalwart/slow_grower
}

// 불확실성별 P/FV(현재가/공정가치) 별점 밴드 — 공개 방법론. 불확실성↑ = 밴드↑(더 싸야 별 많음)
const BANDS: Record<Uncertainty, { s5: number; s4: number; s2: number; s1: number }> = {
  'Low':       { s5: 0.80, s4: 0.90, s2: 1.15, s1: 1.25 },
  'Medium':    { s5: 0.70, s4: 0.85, s2: 1.25, s1: 1.45 },
  'High':      { s5: 0.55, s4: 0.75, s2: 1.45, s1: 1.75 },
  'Very High': { s5: 0.40, s4: 0.65, s2: 1.75, s1: 2.20 },
}

function moatTrendOf(verdict: StarInputs['moatVerdict']): MoatTrend {
  if (verdict === 'breach') return 'negative'
  if (verdict === 'hairline') return 'negative'
  if (verdict === 'intact') return 'stable'
  return 'stable'   // early
}

function stewardshipOf(roe: number | null, netDebtPos: boolean | null): Stewardship {
  if (roe == null) return 'standard'
  if (roe >= 0.20 && netDebtPos !== true) return 'exemplary'   // 고ROE + 과도한 빚 없음
  if (roe < 0.08 || (roe < 0.12 && netDebtPos === true)) return 'poor'
  return 'standard'
}

export function computeStarRating(i: StarInputs): StarResult {
  const uncertainty = uncertaintyOf(i.moatWidth, i.opMargin, i.category)
  const moatTrend = moatTrendOf(i.moatVerdict)
  const stewardship = stewardshipOf(i.roe, i.netDebtPos)
  const discountPct = i.pFv != null && i.pFv > 0 ? +((1 - i.pFv) * 100).toFixed(1) : null

  let stars: number | null = null
  if (i.pFv != null && i.pFv > 0) {
    const b = BANDS[uncertainty]
    if (i.pFv <= b.s5) stars = 5
    else if (i.pFv <= b.s4) stars = 4
    else if (i.pFv < b.s2) stars = 3
    else if (i.pFv < b.s1) stars = 2
    else stars = 1
    // 해자 훼손(breach)은 별 0.5 차감(가격이 싸도 무너지는 성은 신중) — 하한 1
    if (i.moatVerdict === 'breach' && stars > 1) stars -= 0.5
  }
  return { stars, uncertainty, moatWidth: i.moatWidth, moatTrend, stewardship, discountPct }
}

export const UNCERTAINTY_KO: Record<Uncertainty, string> = {
  'Low': '낮음', 'Medium': '보통', 'High': '높음', 'Very High': '매우 높음',
}
export const MOAT_KO: Record<MoatWidth, string> = {
  wide: '넓고 강력', moderate: '보통', narrow: '얕음', none: '없음',
}
export const TREND_KO: Record<MoatTrend, string> = {
  positive: '개선', stable: '안정', negative: '훼손',
}
export const STEWARD_KO: Record<Stewardship, string> = {
  exemplary: '우수', standard: '보통', poor: '미흡',
}
