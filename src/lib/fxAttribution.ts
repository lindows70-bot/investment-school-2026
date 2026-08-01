// 💱 환율 기여도 분해 SSOT — "달러로는 벌었는데 계좌는 마이너스"의 정체를 분리한다.
//   원화 수익 = 달러 수익 + 환율 기여. 매입일 환율(KRW=X 그날 종가)과 현재 환율의 차이가 환율 기여.
//   ⚠️ 원화 상장 해외 ETF(TIGER 미국S&P500 등)는 대상이 아니다 — 앱 보유가 원화 표시라 매입 환율 개념이 없다.
//   ⛔ 예측·환헤지 권유 아님(과거 분해·관측 전용).

export interface FxLot {
  ticker: string
  name: string
  purchaseDate: string      // YYYY-MM-DD
  purchasePrice: number     // 현지통화(USD)
  quantity: number
  currentPrice: number      // 현지통화(USD)
}

export interface FxRow {
  ticker: string
  name: string
  purchaseDate: string      // 여러 행이면 가장 이른 매입일
  lots: number              // 병합된 행 수(분할매수)
  fxBuy: number             // 원가 가중 평균 매입 환율
  costUsd: number
  valueUsd: number
  costKrw: number
  valueKrw: number
  retUsd: number            // 달러 기준 수익률 %
  retKrw: number            // 원화 기준 수익률 %
  fxContrib: number         // 환율 기여 %p (= retKrw − retUsd)
  flipped: boolean          // 달러↔원화 부호가 뒤집힘(가장 헷갈리는 케이스)
}

export interface FxScenario { deltaPct: number; fxRate: number; valueKrw: number; diffKrw: number }

export interface FxAttribution {
  fxNow: number
  rows: FxRow[]
  costKrw: number
  valueKrw: number
  retUsd: number            // 포트 전체(해외분) 달러 기준
  retKrw: number
  fxContrib: number
  /** 환노출 = 해외 종목 + 달러 현금(예수금) — 분모는 투자 자산 + 현금 */
  fxExposurePct: number | null
  cashUsdKrw: number        // 환노출에 포함된 달러 현금(원화 환산)
  scenarios: FxScenario[]
  flippedCount: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** 매입일 환율 — 그날 값이 없으면(주말·휴장) 직전 거래일. 범위보다 이르면 가장 이른 값 */
export function fxAt(fxSeries: { date: string; rate: number }[], date: string): number | null {
  if (!fxSeries.length) return null
  let best: number | null = null
  for (const b of fxSeries) {
    if (b.date <= date) best = b.rate
    else break
  }
  return best ?? fxSeries[0].rate
}

/** 행 단위 분해 → 티커별 병합(분할매수는 매입일마다 환율이 다르므로 원가 가중) */
export function buildFxAttribution(
  lots: FxLot[],
  fxSeries: { date: string; rate: number }[],
  fxNow: number,
  totalPortfolioKrw?: number,
  cashUsd = 0,              // 달러 예수금(원화 환산 전) — 이것도 환율에 노출된 자산
): FxAttribution | null {
  if (!lots.length || !fxNow || fxNow <= 0) return null

  const byTicker = new Map<string, {
    name: string; date: string; lots: number
    costUsd: number; valueUsd: number; costKrw: number; valueKrw: number
  }>()

  for (const l of lots) {
    if (!(l.quantity > 0) || !(l.purchasePrice > 0) || !(l.currentPrice > 0)) continue
    const fxBuy = fxAt(fxSeries, l.purchaseDate)
    if (!fxBuy || fxBuy <= 0) continue
    const key = l.ticker.toUpperCase()
    const cur = byTicker.get(key) ?? { name: l.name, date: l.purchaseDate, lots: 0, costUsd: 0, valueUsd: 0, costKrw: 0, valueKrw: 0 }
    const cU = l.purchasePrice * l.quantity
    const vU = l.currentPrice * l.quantity
    cur.lots++
    cur.costUsd += cU
    cur.valueUsd += vU
    cur.costKrw += cU * fxBuy          // 매입 시점 환율로 환산한 실제 투입 원화
    cur.valueKrw += vU * fxNow
    if (l.purchaseDate < cur.date) cur.date = l.purchaseDate
    byTicker.set(key, cur)
  }
  if (!byTicker.size) return null

  const rows: FxRow[] = []
  let costKrw = 0, valueKrw = 0, costUsd = 0, valueUsd = 0
  for (const [ticker, a] of Array.from(byTicker.entries())) {   // ⚠️ for..of Map은 TS2802(tsconfig 타깃) — Array.from 필수
    const retUsd = (a.valueUsd / a.costUsd - 1) * 100
    const retKrw = (a.valueKrw / a.costKrw - 1) * 100
    costKrw += a.costKrw; valueKrw += a.valueKrw
    costUsd += a.costUsd; valueUsd += a.valueUsd
    // ⚠️ 화면이 'A + B = C'로 보여주므로 **반올림된 값끼리** 합이 맞아야 한다
    //    (원본끼리 빼고 반올림하면 -8.4 + -5.5 = -13.8처럼 0.1%p 어긋난 줄이 생긴다)
    const rU = r1(retUsd), rK = r1(retKrw)
    rows.push({
      ticker, name: a.name, purchaseDate: a.date, lots: a.lots,
      fxBuy: Math.round(a.costKrw / a.costUsd),        // 원가 가중 평균 매입 환율
      costUsd: a.costUsd, valueUsd: a.valueUsd, costKrw: a.costKrw, valueKrw: a.valueKrw,
      retUsd: rU, retKrw: rK, fxContrib: r1(rK - rU),
      // 부호 뒤집힘 — 달러로는 이익인데 원화로는 손실(또는 반대). 학생이 가장 헷갈리는 케이스
      flipped: (retUsd > 0 && retKrw < 0) || (retUsd < 0 && retKrw > 0),
    })
  }
  rows.sort((a, b) => a.fxContrib - b.fxContrib)      // 환손실 큰 순

  const retUsd = r1((valueUsd / costUsd - 1) * 100)
  const retKrw = r1((valueKrw / costKrw - 1) * 100)
  const cashUsdKrw = Math.max(0, cashUsd) * fxNow      // 달러 예수금도 환율에 노출된다
  const exposureKrw = valueKrw + cashUsdKrw

  // 환율만 ±N% 움직였을 때 원화 평가액(다른 조건 불변 가정)
  const usdTotal = valueUsd + Math.max(0, cashUsd)       // 종목 + 달러 예수금
  const scenarios: FxScenario[] = [-10, -5, 5, 10].map(d => {
    const rate = fxNow * (1 + d / 100)
    const v = usdTotal * rate
    return { deltaPct: d, fxRate: Math.round(rate), valueKrw: Math.round(v), diffKrw: Math.round(v - usdTotal * fxNow) }
  })

  return {
    fxNow: Math.round(fxNow * 10) / 10,
    rows,
    costKrw: Math.round(costKrw), valueKrw: Math.round(valueKrw),
    retUsd, retKrw, fxContrib: r1(retKrw - retUsd),
    // 분모 = 투자 자산 + 현금(현금 카드의 '총자산'과 같은 기준) · 분자 = 해외 종목 + 달러 현금
    fxExposurePct: totalPortfolioKrw && totalPortfolioKrw > 0
      ? r1(exposureKrw / (totalPortfolioKrw + cashUsdKrw) * 100) : null,
    cashUsdKrw: Math.round(cashUsdKrw),
    scenarios,
    flippedCount: rows.filter(r => r.flipped).length,
  }
}
