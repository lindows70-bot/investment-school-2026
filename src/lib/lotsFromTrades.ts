// 거래 기록(매수·매도)을 평균단가법으로 되짚어 월별 자산 흐름용 로트(산 날·판 날)를 만든다 — 보유 수량과 안 맞는 종목은 지금 보유 한 줄로 대신하고 그 사실을 돌려준다
//   규칙은 tradeWrite(planBuy·planSell)와 같다: 매수 = 가중평단, 매도 = 수량만 줄고 평단 그대로, 남은 수량 ≤ 0.0001 이면 전량 매도(보유 행 삭제).
//   매도는 열린 로트 '전부'를 같은 비율로 줄인다 — 그래야 남은 로트들의 원가 합 = 남은 수량 × 평단이 정확히 유지된다(선입선출이면 평단이 바뀐다).
import { heldAt, type PnlLot } from '@/lib/monthlySeries'

/** transactions 한 줄 — Supabase numeric 이 문자열로 올 수도 있어 숫자는 Number() 로 읽는다 */
export interface TradeRow {
  ticker: string; name: string; market: string; currency: string
  type: string                    // 'buy' | 'sell'
  price: number | string; quantity: number | string
  transaction_date: string        // 'YYYY-MM-DD'
  created_at: string
  /** 거래 내역 화면(history/page.tsx)의 '자동 동기화' 행 판별용 — 없으면 사람이 적은 기록으로 본다 */
  memo?: string | null
}
/** 지금 보유 한 줄(useMyPortfolio) — currentPrice 는 '지금 시세'일 때만(지난 캐시 시세는 넘기지 않는다) */
export interface HoldingForLots {
  ticker: string; name: string; market: string; currency: string
  quantity: number; purchase_price: number; purchase_date: string | null
  currentPrice?: number | null
}
export type LotFallbackReason = 'no-trades' | 'mismatch' | 'synthetic'
export interface LotsFromTradesResult {
  lots: PnlLot[]
  /** 거래 기록으로 못 그린 종목 — 보유가 있고 매수일이 있으면 '지금 수량을 처음 산 날부터' 한 로트로 대신 넣었다(보유가 없으면 로트 없음) */
  fallback: { ticker: string; name: string; reason: LotFallbackReason }[]
  /** 거래 기록상 다 팔았고 지금 보유도 없는 종목 — 판 로트(이력)만 들어 있다 */
  soldOut: string[]
  /** 구간으로 묶어도 로트가 상한(라우트 400)을 넘는다 — 호출부는 보내지 말고 '거래가 많아 못 그려요'를 말한다 */
  tooMany: boolean
}

/** tradeWrite.planSell 의 전량 매도 기준 — 이 이하로 남으면 앱이 보유 행을 지웠다(다음 매수는 새 평단으로 시작) */
const FULL_SELL_EPS = 0.0001
/**
 * 거래 내역 화면이 보유와 거래 수량이 어긋나면 '방문한 날짜 · 역산한 가격'으로 매수 행을 끼워 넣는다(history/page.tsx 자동 복구).
 * 그 행이 섞이면 되짚은 수량이 보유와 '만들어서' 맞으므로 대조가 무의미하고, 날짜·가격은 실제 거래가 아니다 → 되짚지 않는다.
 */
const SYNTHETIC_MEMO = '자동 동기화'
/** 기본 상한 = /api/monthly-pnl 이 받는 로트 수 */
const DEFAULT_MAX_LOTS = 400
const YMD = /^\d{4}-\d{2}-\d{2}$/

const keyOf = (t: string) => t.trim().toUpperCase()
/** 수량이 같은가 — 상대 1e-6 · 절대 1e-8(0.1 + 0.2 같은 부동소수 잡음 흡수) */
const sameQty = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-8, 1e-6 * Math.max(Math.abs(a), Math.abs(b)))

interface Seg { date: string; price: number; qty: number; sold: string | null }

/** tradeWrite.roundAvg 와 같은 평단 반올림 — 100 이상은 소수 둘째 자리, 그 아래는 유효숫자 8자리 */
const roundAvg = (n: number) => n >= 100 ? Math.round(n * 100) / 100 : Number(n.toPrecision(8))
/** 평단이 같은가 — 앱이 매수 때마다 반올림해 저장하므로 약간의 차이는 허용(0.006 또는 가격의 1e-6 중 큰 쪽) */
const sameAvg = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.006, 1e-6 * Math.abs(b))

/**
 * 한 종목의 거래를 되짚는다 — 모양이 틀린 거래나 가진 것보다 많이 판 매도가 있으면 null.
 * appAvg = 앱이 보유 행에 저장했을 평단(planBuy 처럼 매수 때마다 roundAvg · 새 보유는 매수가 그대로 · 매도는 그대로)
 * avg2dp = 선생님 AddInvestmentModal 추가 매수 경로처럼 가격과 무관하게 매수마다 소수 둘째 자리로 반올림한 평단(첫 매수가는 그대로)
 */
function replay(trades: TradeRow[]): { open: Seg[]; closed: Seg[]; appAvg: number; avg2dp: number } | null {
  const open: Seg[] = [], closed: Seg[] = []
  let appAvg = 0, avg2dp = 0
  for (const t of trades) {
    const price = Number(t.price), qty = Number(t.quantity), date = String(t.transaction_date ?? '').slice(0, 10)
    if (!YMD.test(date) || !(price > 0) || !(qty > 0) || !isFinite(price) || !isFinite(qty)) return null
    if (t.type === 'buy') {
      const held = open.reduce((s, l) => s + l.qty, 0)
      appAvg = open.length === 0 ? price : roundAvg((held * appAvg + qty * price) / (held + qty))
      avg2dp = open.length === 0 ? price : Math.round(((held * avg2dp + qty * price) / (held + qty)) * 100) / 100
      open.push({ date, price, qty, sold: null })
      continue
    }
    if (t.type !== 'sell') return null
    const total = open.reduce((s, l) => s + l.qty, 0)
    if (!(total > 0) || (qty > total && !sameQty(qty, total))) return null   // 가진 것보다 많이 팔았다 — 기록이 빠졌다
    const remaining = total - qty
    if (remaining <= FULL_SELL_EPS) {
      // 전량 매도 — 앱은 보유 행을 지웠다. 자투리까지 이 날 판 것으로 닫는다
      for (const l of open) closed.push({ ...l, sold: date })
      open.length = 0
      continue
    }
    const f = qty / total
    for (const l of open) {
      const soldQty = l.qty * f
      closed.push({ date: l.date, price: l.price, qty: soldQty, sold: date })
      l.qty -= soldQty
    }
  }
  return { open, closed, appAvg, avg2dp }
}

/** 같은 종목·산 날·판 날·가격인 로트를 합친다(수량 합) */
function mergeSame(lots: PnlLot[]): PnlLot[] {
  const m = new Map<string, PnlLot>()
  for (const l of lots) {
    const k = `${l.ticker}|${l.purchase_date}|${l.sold_date ?? ''}|${l.purchase_price}`
    const prev = m.get(k)
    if (prev) prev.quantity += l.quantity
    else m.set(k, { ...l })
  }
  return Array.from(m.values())
}

/**
 * 상한을 넘을 때만 — 종목마다 '월말 상태(보유 수량·원가 합)가 같은 연속 구간'을 로트 하나로 바꾼다.
 * 월별 계산(monthlySeries)은 월말마다 들고 있는 로트의 수량 합·원가 합만 쓰므로 결과가 바뀌지 않는다
 * (평가액 = 종가×Σq, 누적손익 = 종가×Σq − Σ원가). 로트 수는 종목별 '거래가 있었던 달' 수 이하로 묶인다.
 * 산 날 = 구간 첫 달의 가장 이른 실제 매수일(없으면 그 달 1일 — 크립토 시세 수집 시작점이 앞당겨지지 않게),
 * 판 날 = 구간이 끝난 다음 달 1일(계속 들고 있으면 없음).
 */
function compactByInterval(lots: PnlLot[]): PnlLot[] {
  const byT = new Map<string, PnlLot[]>()
  for (const l of lots) { const arr = byT.get(l.ticker); if (arr) arr.push(l); else byT.set(l.ticker, [l]) }
  const out: PnlLot[] = []
  byT.forEach((ls, ticker) => {
    const { market, currency } = ls[0]
    const cp = ls.find(l => !l.sold_date)?.currentPrice ?? null
    const events = Array.from(new Set(ls.map(l => l.purchase_date.slice(0, 7))
      .concat(ls.filter(l => l.sold_date).map(l => (l.sold_date as string).slice(0, 7))))).sort()
    let cur: { q: number; c: number; date: string } | null = null
    const close = (sold: string | null) => {
      if (cur) out.push({ ticker, market, currency, quantity: cur.q, purchase_price: cur.c / cur.q, purchase_date: cur.date, sold_date: sold, currentPrice: sold ? null : cp })
    }
    for (const m of events) {
      const held = ls.filter(l => heldAt(l, m))
      const q = held.reduce((s, l) => s + l.quantity, 0)
      const c = held.reduce((s, l) => s + l.quantity * l.purchase_price, 0)
      if (cur && sameQty(q, cur.q) && sameQty(c, cur.c)) continue          // 상태가 그대로면 구간을 늘린다
      close(`${m}-01`)
      const bought = held.filter(l => l.purchase_date.slice(0, 7) === m).map(l => l.purchase_date).sort()
      cur = q > 0 ? { q, c, date: bought[0] ?? `${m}-01` } : null
    }
    close(null)
  })
  return out
}

export function lotsFromTrades(trades: TradeRow[], holdings: HoldingForLots[], opts?: { maxLots?: number }): LotsFromTradesResult {
  const maxLots = opts?.maxLots ?? DEFAULT_MAX_LOTS
  const byTicker = new Map<string, TradeRow[]>()
  for (const t of trades) {
    if (typeof t?.ticker !== 'string' || !t.ticker.trim()) continue
    const k = keyOf(t.ticker)
    const arr = byTicker.get(k)
    if (arr) arr.push(t); else byTicker.set(k, [t])
  }
  // 같은 티커 보유가 여러 줄이면(옛 데이터) 합친다 — 수량 합·가중평단·가장 이른 매수일. 첫 줄만 보면 나머지 수량이 '안 맞음'으로 둔갑한다
  const holdMap = new Map<string, HoldingForLots>()
  for (const h of holdings) {
    const k = keyOf(h.ticker)
    const prev = holdMap.get(k)
    if (!prev) { holdMap.set(k, { ...h }); continue }
    const q = prev.quantity + h.quantity
    const dates = [prev.purchase_date, h.purchase_date].filter((d): d is string => typeof d === 'string' && YMD.test(d.slice(0, 10))).sort()
    holdMap.set(k, {
      ...prev, quantity: q,
      purchase_price: q > 0 ? (prev.quantity * prev.purchase_price + h.quantity * h.purchase_price) / q : prev.purchase_price,
      purchase_date: dates[0] ?? prev.purchase_date,
      currentPrice: prev.currentPrice ?? h.currentPrice ?? null,
    })
  }

  const lots: PnlLot[] = []
  const fallback: LotsFromTradesResult['fallback'] = []
  const soldOut: string[] = []
  // 지금 보유 한 줄로 대신 — '지금 수량을 처음 산 날부터 가졌다'는 예전 가정. 매수일이 없으면 못 그린다(호출부가 따로 알린다)
  const holdingLot = (k: string, h: HoldingForLots) => {
    if (typeof h.purchase_date !== 'string' || !YMD.test(h.purchase_date.slice(0, 10))) return
    lots.push({ ticker: k, market: h.market, currency: h.currency, purchase_price: h.purchase_price, quantity: h.quantity, purchase_date: h.purchase_date.slice(0, 10), sold_date: null, currentPrice: h.currentPrice ?? null })
  }

  const keys = Array.from(new Set(Array.from(byTicker.keys()).concat(Array.from(holdMap.keys())))).sort()
  for (const k of keys) {
    const h = holdMap.get(k) ?? null
    const trs = byTicker.get(k)
    if (!trs?.length) {
      if (h) { fallback.push({ ticker: k, name: h.name, reason: 'no-trades' }); holdingLot(k, h) }
      continue
    }
    // 거래일 순, 같은 날이면 적은 순(created_at). sort 는 안정 정렬이라 둘 다 같으면 받은 순서
    const sorted = trs.slice().sort((a, b) =>
      String(a.transaction_date).localeCompare(String(b.transaction_date)) || String(a.created_at).localeCompare(String(b.created_at)))
    const last = sorted[sorted.length - 1]
    const name = h?.name ?? last.name
    if (sorted.some(t => typeof t.memo === 'string' && t.memo.includes(SYNTHETIC_MEMO))) {
      fallback.push({ ticker: k, name, reason: 'synthetic' })
      if (h) holdingLot(k, h)
      continue
    }
    const r = replay(sorted)
    const openQty = r ? r.open.reduce((s, l) => s + l.qty, 0) : NaN
    // 수량만 맞고 평단이 다르면(보유를 손으로 고친 경우 등) 로트 가격이 보유와 달라 '넣은 돈'이 위 카드와 어긋난다 → 대조에 평단도 넣는다.
    // 비교 대상은 정확한 가중평단과 앱이 반올림해 저장했을 평단 두 가지(tradeWrite 규칙 · AddInvestmentModal 의 늘 둘째 자리) — 매수마다 반올림이 쌓인다
    const exactAvg = r && openQty > 0 ? r.open.reduce((s, l) => s + l.qty * l.price, 0) / openQty : NaN
    const avgOk = !h || (r != null && openQty > 0 && (sameAvg(exactAvg, h.purchase_price) || sameAvg(r.appAvg, h.purchase_price) || sameAvg(r.avg2dp, h.purchase_price)))
    if (!r || !sameQty(openQty, h?.quantity ?? 0) || !avgOk) {
      fallback.push({ ticker: k, name, reason: 'mismatch' })
      if (h) holdingLot(k, h)
      continue
    }
    const market = h?.market ?? last.market, currency = h?.currency ?? last.currency
    for (const s of r.closed) lots.push({ ticker: k, market, currency, purchase_price: s.price, quantity: s.qty, purchase_date: s.date, sold_date: s.sold, currentPrice: null })
    if (h) {
      for (const s of r.open) lots.push({ ticker: k, market, currency, purchase_price: s.price, quantity: s.qty, purchase_date: s.date, sold_date: null, currentPrice: h.currentPrice ?? null })
    } else {
      soldOut.push(k)   // 남은 수량 ≈ 0 — 열린 로트는 부동소수 자투리뿐이라 넣지 않는다
    }
  }

  let out = mergeSame(lots.filter(l => l.quantity > 0))
  if (out.length > maxLots) out = compactByInterval(out)
  out.sort((a, b) => a.ticker.localeCompare(b.ticker) || a.purchase_date.localeCompare(b.purchase_date) || (a.sold_date ?? '9').localeCompare(b.sold_date ?? '9'))
  return { lots: out, fallback, soldOut, tooMany: out.length > maxLots }
}
