// 워렌 버핏식 DCF 내재가치 계산 SSOT — 버핏 분석 패널·모닝스타 등급이 공유(제2원칙)
// 모든 금액은 원시 통화값(KR=원, US=USD), shares=주 단위. 통화 변환 없이 내재가치/주가가 같은 단위.

export interface DcfRow { year: number; fcf: number; pv: number; cumPv: number }
export interface DcfResult {
  rows: DcfRow[]
  pvSum: number
  terminalValue: number
  tvPV: number
  enterpriseValue: number
  equityValue: number
  intrinsicPerShare: number
  safetyMargin: number      // (내재가치-현재가)/내재가치 ×100 — 내재가치≤0이면 -999
}

/** DCF 5개년 + 영구가치(고든) — fcf0·netDebt 원시통화, g/r/gp는 %단위, shares=주 */
export function calcDCF(
  fcf0: number, g: number, r: number, gp: number,
  netDebt: number, shares: number, curPrice: number,
): DcfResult {
  const gR = g / 100, rR = r / 100, gpR = gp / 100
  const rows: DcfRow[] = []
  let pvSum = 0, prevFcf = fcf0
  for (let yr = 1; yr <= 5; yr++) {
    const fcf = prevFcf * (1 + gR)
    const pv  = fcf / Math.pow(1 + rR, yr)
    pvSum    += pv
    rows.push({ year: yr, fcf, pv, cumPv: pvSum })
    prevFcf = fcf
  }
  const fcf5 = rows[4].fcf
  const terminalValue = rR > gpR ? (fcf5 * (1 + gpR)) / (rR - gpR) : fcf5 * 25
  const tvPV             = terminalValue / Math.pow(1 + rR, 5)
  const enterpriseValue  = pvSum + tvPV
  const equityValue      = enterpriseValue - netDebt
  const intrinsicPerShare = shares > 0 ? equityValue / shares : 0
  const safetyMargin = intrinsicPerShare > 0 ? ((intrinsicPerShare - curPrice) / intrinsicPerShare) * 100 : -999
  return { rows, pvSum, terminalValue, tvPV, enterpriseValue, equityValue, intrinsicPerShare, safetyMargin }
}

/** DCF 입력 산출용 펀더멘탈 — stock-info fundamentals에서 그대로 매핑 */
export interface DcfFundamentals {
  marketCap?: number | null
  pe?: number | 'N/A' | null
  sharesOutstanding?: number | null
  freeCashflow?: number | null
  totalDebt?: number | null
  totalCash?: number | null
  earningsGrowth?: number | null
}

export interface DcfInputs {
  isKr: boolean; cat: string; mc: number | null; pe: number | null
  shares: number | null; sharesSrc: 'real' | 'est' | 'none'
  fcf0: number | null; fcfSrc: 'real' | 'est' | 'none'; fcfNormalized: boolean
  netDebt: number; netDebtSrc: 'real' | 'est'
  g: number; gSrc: 'real' | 'est'; r: number; gp: number
  ok: boolean   // DCF 계산 가능(흑자 FCF + 주식수 확보)
}

/**
 * 자동 DCF 입력값 산출(슬라이더 없이 100% 자동) — 버핏 패널과 동일 로직(SSOT).
 * 우선순위: Yahoo 실데이터 → 추정 → 린치 카테고리 기본값.
 */
export function deriveDcfInputs(
  fund: DcfFundamentals,
  opts: { market?: string; currency?: string; lynchCategory?: string | null; currentPrice: number },
): DcfInputs {
  const isKr = opts.market === 'KR' || opts.currency === 'KRW'
  const cat  = opts.lynchCategory ?? 'na'
  const mc   = (typeof fund.marketCap === 'number' && fund.marketCap > 0) ? fund.marketCap : null
  const pe   = (typeof fund.pe === 'number' && fund.pe > 0) ? fund.pe : null
  const curPrice = opts.currentPrice

  // ① 유통주식수
  let shares: number | null = (fund.sharesOutstanding && fund.sharesOutstanding > 0) ? fund.sharesOutstanding : null
  let sharesSrc: 'real' | 'est' | 'none' = shares ? 'real' : 'none'
  if (!shares && mc && curPrice > 0) { shares = mc / curPrice; sharesSrc = 'est' }

  // ② FCF (고PER 정상화 보정)
  let fcf0: number | null = (fund.freeCashflow && fund.freeCashflow > 0) ? fund.freeCashflow : null
  let fcfSrc: 'real' | 'est' | 'none' = fcf0 ? 'real' : 'none'
  let fcfNormalized = false
  if (!fcf0 && mc && pe) {
    const catNormalPE: Record<string, number> = { fast_grower: 28, stalwart: 18, slow_grower: 13, cyclical: 12, turnaround: 18, asset_play: 12, na: 18 }
    const effPE = pe > 40 ? (catNormalPE[cat] ?? 18) : pe
    fcfNormalized = pe > 40
    fcf0 = (mc / effPE) * 0.85
    fcfSrc = 'est'
  }

  // ③ 순부채
  let netDebt = 0
  let netDebtSrc: 'real' | 'est' = 'est'
  if (fund.totalDebt != null && fund.totalCash != null) { netDebt = fund.totalDebt - fund.totalCash; netDebtSrc = 'real' }

  // ④ 성장률(% · -5~35 클램핑)
  let g = 8
  let gSrc: 'real' | 'est' = 'est'
  const eg = fund.earningsGrowth
  if (eg != null && isFinite(eg) && eg !== 0) {
    const pct = Math.abs(eg) < 5 ? eg * 100 : eg
    g = Math.max(-5, Math.min(35, parseFloat(pct.toFixed(1))))
    gSrc = 'real'
  } else {
    const catG: Record<string, number> = { fast_grower: 20, stalwart: 10, cyclical: 8, slow_grower: 4, turnaround: 12, asset_play: 5 }
    g = catG[cat] ?? 8
  }

  // ⑤ 할인율
  const r = isKr ? 9 : 8.5
  const ok = !!(fcf0 && fcf0 > 0 && shares && shares > 0)
  return { isKr, cat, mc, pe, shares, sharesSrc, fcf0, fcfSrc, fcfNormalized, netDebt, netDebtSrc, g, gSrc, r, gp: 2.5, ok }
}
