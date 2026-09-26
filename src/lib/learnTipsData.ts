// '오늘 알려드려요' 입력을 만드는 순수 도우미 — 날짜로 종가 찾기 · 한 번만 사고 판 적 없는 종목 · 산 뒤 수익률 · 비교 지수 고르기
//   ⚠️ 기간은 인덱스로 세지 않는다(CLAUDE.md — CPI 13개월 차분 사고). 봉 배열에 휴장·결측이 있어도 '산 날'을 날짜로 찾는다.
import type { TradeRow, HoldingForLots } from '@/lib/lotsFromTrades'
import { flagOf } from '@/lib/marketFlag'
import { getAssetType } from '@/lib/assetClassifier'

/** 날짜 + 종가만 있으면 된다(techChartData.TechCandle 이 그대로 들어온다) */
export interface DatedClose { date: string; close: number }

export interface SingleBuy {
  ticker: string; name: string; market: string; currency: string
  /** 그 한 번의 매수일(거래 기록) */
  buyDate: string
  /** 보유 평단(내 자산 화면과 같은 값) — 거래 가격과 1% 안에서 같을 때만 여기 온다 */
  buyPrice: number
  quantity: number
}

export interface IndexChoice { symbol: '^KS11' | '^GSPC'; name: '코스피' | '미국 S&P 500' }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
/** 'YYYY-MM-DD' → 1970-01-01 부터 센 날 수(UTC 달력 — 시간대와 무관) */
export const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY_MS
const keyOf = (t: string) => t.trim().toUpperCase()
/** lotsFromTrades 와 같은 수량 비교(상대 1e-6 · 절대 1e-8) */
const sameQty = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-8, 1e-6 * Math.max(Math.abs(a), Math.abs(b)))
/** 거래 가격과 보유 평단이 이만큼(1%) 넘게 다르면 기록을 못 믿는다 — lotsFromTrades.ADJUST_MAX_GAP 과 같은 기준 */
const PRICE_MAX_GAP = 0.01
/** 거래 내역 화면의 자동 복구 행 — 날짜·가격이 실제 거래가 아니다(lotsFromTrades.SYNTHETIC_MEMO) */
const SYNTHETIC_MEMO = '자동 동기화'

/**
 * date 당일 또는 그 전 가장 가까운 봉의 종가 — 배열 순서와 무관하게 날짜로 찾는다.
 * 첫 봉보다 이른 날이거나, 가장 가까운 봉도 maxGapDays(기본 7일)보다 멀면 null(오래된 값으로 대신하지 않는다).
 */
export function closeOnOrBefore(candles: DatedClose[], date: string, maxGapDays = 7): DatedClose | null {
  if (!YMD.test(date)) return null
  let best: DatedClose | null = null
  for (const c of candles) {
    const d = typeof c?.date === 'string' ? c.date.slice(0, 10) : ''
    if (!YMD.test(d) || !(typeof c.close === 'number' && isFinite(c.close) && c.close > 0)) continue
    if (d > date) continue
    if (!best || d > best.date) best = { date: d, close: c.close }
  }
  if (!best || dayNum(date) - dayNum(best.date) > maxGapDays) return null
  return best
}

/**
 * 한 번만 사고 판 적 없는 종목 — 거래 기록이 매수 1건뿐이고, 그 수량이 지금 보유와 같고, 가격이 평단과 1% 안인 것.
 * 나눠 산 종목은 '산 날'이 하나가 아니라 지수와의 비교가 틀리므로 뺀다(보유의 purchase_date 는 첫 매수일일 뿐이다).
 * 같은 티커 보유가 여러 줄이거나 자동 동기화 행이 섞였으면 기록을 못 믿으므로 뺀다.
 * 개별 주식(getAssetType === 'STOCK')만 — ETF 는 상장 시장과 담은 자산의 나라가 달라(TIGER 미국S&P500 = 한국 상장·미국 기업)
 * 국기로 고른 지수와 비교하면 오해를 부른다. 원자재·코인은 비교할 주가지수가 없다.
 */
export function singleBuyHoldings(trades: TradeRow[], holdings: HoldingForLots[]): SingleBuy[] {
  const byTicker = new Map<string, TradeRow[]>()
  for (const t of trades) {
    if (typeof t?.ticker !== 'string' || !t.ticker.trim()) continue
    const k = keyOf(t.ticker)
    const arr = byTicker.get(k)
    if (arr) arr.push(t); else byTicker.set(k, [t])
  }
  const holdCount = new Map<string, number>()
  for (const h of holdings) holdCount.set(keyOf(h.ticker), (holdCount.get(keyOf(h.ticker)) ?? 0) + 1)

  const out: SingleBuy[] = []
  for (const h of holdings) {
    const k = keyOf(h.ticker)
    if (holdCount.get(k) !== 1) continue
    if (getAssetType(h.ticker, h.name ?? '', h.market) !== 'STOCK') continue
    const trs = byTicker.get(k) ?? []
    if (trs.length !== 1) continue                       // 기록 없음 · 나눠 삼 · 판 적 있음
    const t = trs[0]
    if (t.type !== 'buy') continue
    if (typeof t.memo === 'string' && t.memo.includes(SYNTHETIC_MEMO)) continue
    const price = Number(t.price), qty = Number(t.quantity), date = String(t.transaction_date ?? '').slice(0, 10)
    if (!YMD.test(date) || !(price > 0) || !(qty > 0) || !isFinite(price) || !isFinite(qty)) continue
    if (!(h.quantity > 0) || !sameQty(qty, h.quantity)) continue
    if (!(h.purchase_price > 0) || Math.abs(price - h.purchase_price) / h.purchase_price > PRICE_MAX_GAP) continue
    out.push({ ticker: h.ticker, name: h.name, market: h.market, currency: h.currency, buyDate: date, buyPrice: h.purchase_price, quantity: h.quantity })
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/** 산 뒤 수익률(%) — 둘 중 하나라도 양수가 아니면 null(시세 없음을 0% 로 만들지 않는다) */
export function returnSince(buyPrice: number, currentPrice: number | null | undefined): number | null {
  if (!(typeof buyPrice === 'number' && isFinite(buyPrice) && buyPrice > 0)) return null
  if (!(typeof currentPrice === 'number' && isFinite(currentPrice) && currentPrice > 0)) return null
  return (currentPrice / buyPrice - 1) * 100
}

/**
 * 비교할 지수 — 국기 SSOT(flagOf: 티커 접미사 → 6자리 숫자 → market) 가 🇰🇷 이면 코스피, 🇺🇸 이면 미국 S&P 500, 그 밖(🇯🇵·🇳🇱·코인 등)은 null.
 * ETF 는 singleBuyHoldings 가 미리 뺀다(한국 상장 해외 ETF 가 🇰🇷 → 코스피로 비교되는 오해 방지).
 * ⚠️ 한계: ① 코스닥 종목도 코스피와 비교된다(티커로 시장을 못 가른다 — 화면 본문에 '코스피 기준'을 적는다).
 *    ② 접미사 없는 미국 상장 외국 기업(ADR: 쉘 SHEL 등)은 origin 을 안 받으므로 🇺🇸 로 보고 S&P 500 과 비교된다.
 */
export function indexFor(ticker: string, market: string): IndexChoice | null {
  const f = flagOf(market, ticker)
  return f === '🇰🇷' ? { symbol: '^KS11', name: '코스피' } : f === '🇺🇸' ? { symbol: '^GSPC', name: '미국 S&P 500' } : null
}

/**
 * 봉이 완성됐나 — techChartData.dropIncompleteBar 와 같은 규칙을 순수하게 다시 쓴 것(그 파일은 appCache 를 불러 여기서 못 쓴다).
 * 봉 날짜의 마감 + 35분(KR 20:00 KST NXT 애프터마켓 → 11:35Z · US 16:00 ET(EST) → 21:35Z)이 지나야 완성. 규칙을 바꾸면 둘 다 바꿔라.
 * 지수 세션: ^KS11 = KR(봉 날짜가 KST), ^GSPC = US.
 */
export function isBarComplete(date: string, session: 'KR' | 'US', nowMs: number): boolean {
  const closeUtc = Date.parse(session === 'KR' ? `${date.slice(0, 10)}T11:35:00Z` : `${date.slice(0, 10)}T21:35:00Z`)
  return isFinite(closeUtc) && nowMs >= closeUtc
}

export interface VsIndexRow {
  ticker: string; name: string; market: string
  buyDate: string
  /** 내 수익률 — 지금 시세 기준 */
  returnPct: number
  indexName: string
  indexReturnPct: number
  /** 지수 시작 봉 날짜(산 날 또는 그 직전 거래일) */
  indexStartDate: string
  /** 지수 끝 봉 날짜(오늘 또는 그 직전 거래일) */
  endDate: string
  /** 끝 봉이 완성된 종가인가 — false 면 오늘 진행 중인 봉이라 '종가'라고 부르지 않는다 */
  endComplete: boolean
}

/**
 * vsIndex 입력 한 줄 — 산 날 지수 종가(그날 또는 직전 거래일)부터 가장 최근 봉까지의 지수 수익률.
 * ⚠️ 일봉만 넣어라(tech-chart tf=D). 주봉은 봉 날짜가 주 첫날이라 날짜로 찾으면 다른 주의 종가를 집는다.
 * 오늘 진행 중인 봉은 버리지 않고 '완성 아님'(endComplete=false)으로 표시한다 — 내 수익률이 지금 시세라
 * 지수 끝을 어제 종가로 자르면 두 수익률의 끝 시점이 하루 어긋난다. 화면은 그때 '종가' 대신 날짜 기준만 적는다.
 * 산 날이 오늘이거나 미래 · 시세 없음 · 지수 봉을 날짜로 못 찾으면 null.
 * 내 수익률은 체결가 기준이고 지수 시작은 그날 종가 기준이다(같은 날 안의 차이는 남는다).
 */
export function buildVsIndexRow(
  b: SingleBuy, currentPrice: number | null | undefined, idx: IndexChoice, dailyIndexCandles: DatedClose[], todayKst: string, nowMs: number,
): VsIndexRow | null {
  if (!YMD.test(todayKst) || !(b.buyDate < todayKst)) return null
  const own = returnSince(b.buyPrice, currentPrice)
  if (own == null) return null
  const start = closeOnOrBefore(dailyIndexCandles, b.buyDate)
  const end = closeOnOrBefore(dailyIndexCandles, todayKst)
  if (!start || !end || !(end.date > start.date)) return null
  return {
    ticker: b.ticker, name: b.name, market: b.market, buyDate: b.buyDate, returnPct: own,
    indexName: idx.name, indexReturnPct: (end.close / start.close - 1) * 100,
    indexStartDate: start.date, endDate: end.date,
    endComplete: isBarComplete(end.date, idx.symbol === '^KS11' ? 'KR' : 'US', nowMs),
  }
}
