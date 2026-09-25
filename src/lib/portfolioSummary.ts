// 학생 홈·내 자산이 함께 쓰는 보유 요약 SSOT — 평가·손익·오늘 등락·코어/위성 비중·투자 체크
//   규칙은 자산 관리 화면(assets/page.tsx 411~470)과 같다: 평가 = (시세 없으면 매수가) × 수량 × 환율.
//   다른 점 하나 — 시세 없는 종목을 priced:false 로 밝혀 화면이 '못 가져왔어요'를 말하게 한다.
export type Market = 'US' | 'KR' | 'CRYPTO'
export type Role = 'CORE' | 'SATELLITE'

export interface HoldingInput {
  id: string; ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'
  purchase_price: number; quantity: number; asset_role: Role | null
}
export interface PriceInput { currentPrice: number; change: number; changePct: number; error?: string }
export interface HoldingRow {
  id: string; ticker: string; name: string; market: Market; role: Role
  priced: boolean; currentPrice: number | null; changePct: number | null
  costKrw: number; evalKrw: number; pnlKrw: number; pnlPct: number | null
  todayKrw: number | null; weightPct: number
}
export interface PortfolioSummary {
  rows: HoldingRow[]
  totalCostKrw: number; totalEvalKrw: number; pnlKrw: number; pnlPct: number | null
  todayKrw: number; todayPct: number | null
  corePct: number; satPct: number; unpricedCount: number
  /** true iff 보유는 있는데(rows.length > 0) 전부 시세 실패 — 이때 pnlPct 는 항상 null(0.0% 오해 방지) */
  allUnpriced: boolean
}

/** 자산 관리 화면(assets/page.tsx fetchInvestments)과 같은 중복 제거 — id 로 한 번, 티커(대문자)로 한 번, 먼저 온 것을 남긴다.
 *  호출부는 created_at 내림차순으로 넘겨야 두 화면의 합계가 같아진다(같은 티커면 최신 행이 남는다). */
export function dedupeHoldings<T extends { id: string; ticker: string }>(rows: T[]): T[] {
  const seenId = new Set<string>(), seenTicker = new Set<string>()
  return rows.filter(r => {
    if (seenId.has(r.id)) return false
    seenId.add(r.id)
    return true
  }).filter(r => {
    const key = r.ticker.toUpperCase()
    if (seenTicker.has(key)) return false
    seenTicker.add(key)
    return true
  })
}

export function isPriced(p: PriceInput | null | undefined): p is PriceInput {
  return !!p && !p.error && Number.isFinite(p.currentPrice) && p.currentPrice > 0
    && Number.isFinite(p.change) && Number.isFinite(p.changePct)
}

// 콜러가 환율을 추측하면 안 된다 — 달러 보유가 있는데 usdKrw 가 유효하지 않으면 즉시 실패한다
// (호출부가 침묵하는 0%가 아니라 실제 실패 상태를 보여주게 한다).
export function summarizePortfolio(holdings: HoldingInput[], priceMap: Record<string, PriceInput | undefined>, usdKrw: number): PortfolioSummary {
  if (holdings.some(h => h.currency === 'USD') && !(Number.isFinite(usdKrw) && usdKrw > 0)) {
    throw new Error('usdKrw 가 필요합니다 — 달러 보유가 있는데 환율이 없습니다')
  }
  let totalCost = 0, totalEval = 0, today = 0, prevPriced = 0, coreEval = 0, unpriced = 0
  const rows: HoldingRow[] = holdings.map(h => {
    const fx = h.currency === 'USD' ? usdKrw : 1
    const p = priceMap[h.ticker.toUpperCase()]
    const priced = isPriced(p)
    const cost = h.purchase_price * h.quantity * fx
    const val = (priced ? p.currentPrice : h.purchase_price) * h.quantity * fx
    const todayKrw = priced ? p.change * h.quantity * fx : null
    const role: Role = h.asset_role ?? 'CORE'   // DB 컬럼은 NOT NULL DEFAULT 'CORE'(supabase-asset-role-migration.sql) — null 은 타입 레벨 방어일 뿐
    totalCost += cost; totalEval += val
    if (priced) { today += todayKrw as number; prevPriced += (p.currentPrice - p.change) * h.quantity * fx } else unpriced++
    if (role === 'CORE') coreEval += val
    return {
      id: h.id, ticker: h.ticker, name: h.name, market: h.market, role, priced,
      currentPrice: priced ? p.currentPrice : null, changePct: priced ? p.changePct : null,
      costKrw: cost, evalKrw: val, pnlKrw: val - cost, pnlPct: cost > 0 ? (val - cost) / cost * 100 : null,
      todayKrw, weightPct: 0,
    }
  })
  rows.forEach(r => { r.weightPct = totalEval > 0 ? r.evalKrw / totalEval * 100 : 0 })
  rows.sort((a, b) => b.evalKrw - a.evalKrw)
  const corePct = totalEval > 0 ? coreEval / totalEval * 100 : 0
  const allUnpriced = rows.length > 0 && unpriced === rows.length
  return {
    rows, totalCostKrw: totalCost, totalEvalKrw: totalEval,
    pnlKrw: totalEval - totalCost,
    pnlPct: (totalCost > 0 && !allUnpriced) ? (totalEval - totalCost) / totalCost * 100 : null,
    todayKrw: today, todayPct: prevPriced > 0 ? today / prevPriced * 100 : null,
    corePct, satPct: totalEval > 0 ? 100 - corePct : 0, unpricedCount: unpriced, allUnpriced,
  }
}

/** 오늘의 투자 체크 — 사실만 말하고 팔라고 하지 않는다(HOLD 원칙). ±3%p 안은 균형(스쿨 리그 진단과 같은 폭).
 *  경계는 반올림한 gap 으로 판정한다 — 표시 숫자와 kind 가 서로 다른 말을 하지 않도록. */
export type RebalanceCheck = { kind: 'core-short' | 'sat-short'; gapPp: number } | { kind: 'balanced'; gapPp: number }
export function rebalanceCheck(corePct: number, targetCorePct: number | null): RebalanceCheck | null {
  if (targetCorePct == null || !(targetCorePct > 0)) return null
  const gap = Math.round(targetCorePct - corePct)
  if (Math.abs(gap) <= 3) return { kind: 'balanced', gapPp: Math.abs(gap) }
  return gap > 0 ? { kind: 'core-short', gapPp: gap } : { kind: 'sat-short', gapPp: -gap }
}
