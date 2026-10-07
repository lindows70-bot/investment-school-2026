// 주체별 순매매(외국인·기관, KRX) — 순매수·순매도 상위 + Top5 의 '며칠째'·함께 삼·주가 역행을 원천 값으로 계산하는 서버 lib
//   원천: stock.naver.com/api/domestic/market/trend/trendForeignOrg(순위) · m.stock.naver.com/api/stock/{code}/trend(종목별 일별)
//   단위: 순위 원천 accTradeAmount 는 **원** → 억원(÷1e8). 검증: 수량(accTradeVolume) × 가격(nowPrice) 독립 재계산과 ±5% 안(체결가 평균 ≠ 종가).
//   ⚠️ 개인 전체 순위는 원천이 없다(외국인·기관만 — 2026-09-27 investorType 후보 19개 전부 400). 개인은 예전 수급 레이더처럼
//      종목별 일별 수급(individualPureBuyQuant × 종가)을 주요 113종목 캐시(market-flow-kr, 20시 워밍)에서 순위로 만든다 — '주요 종목 안에서'를 화면에 밝힌다.
//   ⚠️ KRX 만 — NXT 체결은 빠진다('KRX 기준').
import { type Part, okPart, failPart, num, kstCompactToIso, getJson } from './marketBoardShared'
import { isLimitBreak, type KrMarket } from './krMarketBoard'
import type { MarketFlowKrResult } from './marketFlowKr'

export type Investor = 'FOREIGNER' | 'ORGANIZATION'
/** 화면이 고르는 주체 — 개인은 원천 순위가 아니라 주요 종목 캐시에서 만든다 */
export type FlowWho = Investor | 'INDIVIDUAL'

export interface FlowRow {
  code: string; name: string
  netEok: number            // 순매수(+)·순매도(−) 금액, 억원
  netQty: number            // 순매수 수량(주)
  price: number | null      // 원천 nowPrice
  changePct: number | null  // 그날 등락률(원천 prevChangeRate)
  volShare: number | null   // 그날 거래량 대비 순매매 수량 비중(%) = |netQty| ÷ dailyTradeVolume
  etf: boolean              // 원천 type === 'EF'
  type: string | null       // 원천 type 원값(ST·EF 등)
  estimated: boolean        // 원천 estimated(장중 잠정치)
  /** 원천 금액이 0(잠정 구간)이라 금액을 수량 × 현재가로 셌다 — 화면이 그 사실을 밝힌다 */
  amountFromQty: boolean
  /** 수량×가격 재계산 대비 금액 비율(1 에 가까워야 원 단위가 맞다) — 단위 검증용 */
  unitRatio: number | null
  /** 주식(type ST)의 그날 등락이 ±30%(KRX 가격제한폭) 밖 — 상장 첫날·정리매매 등. 순위에서 빼지 않고 표시만(특징종목과 같은 규칙).
   *  ETF(EF) 등은 레버리지 배율만큼 제한폭이 넓어 판정하지 않는다(늘 false) */
  priceLimitBreak: boolean
}
export interface FlowRank { bizdate: string | null; buy: FlowRow[]; sell: FlowRow[] }

function parseRow(x: Record<string, unknown>): FlowRow | null {
  const code = typeof x?.itemcode === 'string' ? x.itemcode : null
  const amt = num(x?.accTradeAmount)
  const qty = num(x?.accTradeVolume)
  if (!code || amt == null || qty == null) return null
  const price = num(x.nowPrice)
  const daily = num(x.dailyTradeVolume)
  const chg = num(x.prevChangeRate)
  const recompute = price != null ? qty * price : null
  // 잠정 구간(2026-10-07 실측 16:57 · estimated:true)엔 원천이 금액을 "0" 으로 주고 수량만 준다 — 그대로 쓰면 상위 5가 전부 '0억'.
  //   금액은 수량 × 현재가로 센다(개인 목록과 같은 방식 · 확정치에서 원천 금액과 ±5% 안). 이때 dailyTradeVolume 은 순매수 수량을
  //   되풀이해(삼성 2,512,278 = 순매수 수량 · 실제 총 거래량 16,001,295) 거래량 비중을 낼 수 없다.
  const amountFromQty = amt === 0 && qty !== 0
  if (amountFromQty && recompute == null) return null
  const amount = amountFromQty ? recompute! : amt
  return {
    code, name: typeof x.itemname === 'string' ? x.itemname : code,
    netEok: Math.round(amount / 1e8), netQty: qty, price,
    changePct: chg,
    volShare: !amountFromQty && daily && daily > 0 ? Math.round(Math.abs(qty) / daily * 1000) / 10 : null,
    etf: x.type === 'EF', type: typeof x.type === 'string' ? x.type : null,
    estimated: x.estimated === true,
    amountFromQty,
    unitRatio: !amountFromQty && recompute && recompute !== 0 ? amt / recompute : null,
    priceLimitBreak: x.type === 'ST' && isLimitBreak(chg),
  }
}

/** trendForeignOrg 응답 → 순매수·순매도 목록 */
export function parseTrendForeignOrg(json: unknown): FlowRank | null {
  const s = (json as { sections?: { buyRankList?: unknown; sellRankList?: unknown } } | null)?.sections
  if (!s || !Array.isArray(s.buyRankList) || !Array.isArray(s.sellRankList)) return null
  const buy = (s.buyRankList as Record<string, unknown>[]).map(parseRow).filter((r): r is FlowRow => r != null)
  const sell = (s.sellRankList as Record<string, unknown>[]).map(parseRow).filter((r): r is FlowRow => r != null)
  const first = (s.buyRankList as Record<string, unknown>[])[0] ?? (s.sellRankList as Record<string, unknown>[])[0]
  return { bizdate: kstCompactToIso(first?.bizdateTo), buy, sell }
}

// ── 종목별 일별 추이 → 연속일 ─────────────────────────────────────────────
/** 종목별 추이 요청 행 수(영업일) — '며칠째'는 이만큼까지만 센다 */
export const TREND_ROWS = 30
export interface TrendDay { date: string; foreign: number | null; organ: number | null; individual: number | null }
/** m.stock.naver.com/api/stock/{code}/trend → 날짜 내림차순 일별 순매수 수량 */
export function parseStockTrend(json: unknown): TrendDay[] | null {
  if (!Array.isArray(json)) return null
  const out: TrendDay[] = []
  for (const r of json as Record<string, unknown>[]) {
    const date = kstCompactToIso(r?.bizdate)
    if (!date) continue
    out.push({ date, foreign: num(r.foreignerPureBuyQuant), organ: num(r.organPureBuyQuant), individual: num(r.individualPureBuyQuant) })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** 기준일(bizdate)부터 거슬러 같은 방향이 이어진 날 수. +n = n일째 순매수, −n = n일째 순매도, 0 = 그날 0.
 *  기준일 행이 없으면 null(장중엔 오늘 행이 아직 없을 수 있다 — 어제부터 세면 '며칠째'가 거짓이 된다).
 *  capped = 요청한 행(requested)을 다 받았고 끝까지 이어졌다(실제로는 더 길 수 있다). 받은 행이 요청보다 적으면
 *  그게 상장 이후 전부라 capped 가 아니다(상장 첫날 종목이 '1일째+'로 보이지 않게) */
export function streakFrom(days: TrendDay[], bizdate: string, who: 'foreign' | 'organ' | 'individual', requested = TREND_ROWS): { n: number; capped: boolean } | null {
  const i0 = days.findIndex(d => d.date === bizdate)
  if (i0 < 0) return null
  const v0 = days[i0][who]
  if (v0 == null) return null
  if (v0 === 0) return { n: 0, capped: false }
  const sign = Math.sign(v0)
  let n = 0
  for (let i = i0; i < days.length; i++) {
    const v = days[i][who]
    if (v == null || Math.sign(v) !== sign) return { n: sign * n, capped: false }
    n++
  }
  return { n: sign * n, capped: days.length >= requested }
}

export interface FlowTopRow extends FlowRow {
  foreignStreak: { n: number; capped: boolean } | null
  organStreak: { n: number; capped: boolean } | null
  individualStreak: { n: number; capped: boolean } | null
  /** 그날 외국인·기관이 함께 순매수(buy) / 함께 순매도(sell) / 함께가 아님(false) — 종목별 일별 원천으로 판정.
   *  null = 그날 추이 행이 없어 모름('함께 아님'과 다르다) */
  together: 'buy' | 'sell' | false | null
  /** 주가 역행: 내렸는데 순매수(순매수 목록) · 올랐는데 순매도(순매도 목록). 등락률이 없으면 null */
  contrarian: boolean | null
}

/** 순위 행 + 그 종목의 일별 추이 → Top 행(연속일·함께·역행). trend 가 없으면 연속일·함께는 null */
export function enrichTop(row: FlowRow, days: TrendDay[] | null, bizdate: string | null): FlowTopRow {
  const day = days && bizdate ? days.find(d => d.date === bizdate) ?? null : null
  const together = day && day.foreign != null && day.organ != null
    ? day.foreign > 0 && day.organ > 0 ? 'buy' : day.foreign < 0 && day.organ < 0 ? 'sell' : false
    : null
  const c = row.changePct
  return {
    ...row,
    foreignStreak: days && bizdate ? streakFrom(days, bizdate, 'foreign') : null,
    organStreak: days && bizdate ? streakFrom(days, bizdate, 'organ') : null,
    individualStreak: days && bizdate ? streakFrom(days, bizdate, 'individual') : null,
    together,
    contrarian: c == null ? null : (row.netQty > 0 && c < 0) || (row.netQty < 0 && c > 0),
  }
}

// ── 가져오기(서버) ────────────────────────────────────────────────────────
const SRC_RANK = 'naver stock.naver.com trendForeignOrg(KRX·DAY)'
export const SRC_TREND = 'naver m.stock stock trend'

export async function fetchFlowRank(investor: Investor, mk: KrMarket, size = 10, timeoutMs = 8000): Promise<Part<FlowRank>> {
  const u = `https://stock.naver.com/api/domestic/market/trend/trendForeignOrg?investorType=${investor}&tradeType=KRX&marketType=${mk}&startIdx=0&pageSize=${size}&periodType=DAY`
  const r = await getJson(u, { timeoutMs })
  if (!r.ok) return failPart(r.reason, SRC_RANK)
  const p = parseTrendForeignOrg(r.json)
  if (!p) return failPart('목록 형식이 다름', SRC_RANK)
  return okPart(p, p.bizdate, SRC_RANK)
}

export async function fetchStockTrend(code: string, rows = TREND_ROWS, timeoutMs = 6000): Promise<TrendDay[] | null> {
  const r = await getJson(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/trend?pageSize=${rows}`, { timeoutMs })
  return r.ok ? parseStockTrend(r.json) : null
}

export interface FlowBoardSide { buy: FlowTopRow[]; sell: FlowTopRow[]; trendFailed: number }
/** 한 시장·한 주체의 순매수·순매도 Top N + 연속일. trends 는 호출부가 종목코드로 모아 한 번씩만 부른 결과 */
export function buildFlowSide(rank: FlowRank, trends: Map<string, TrendDay[] | null>, top = 5): FlowBoardSide {
  let trendFailed = 0
  const pick = (rows: FlowRow[]) => rows.slice(0, top).map(r => {
    const t = trends.get(r.code) ?? null
    if (!t) trendFailed++
    return enrichTop(r, t, rank.bizdate)
  })
  return { buy: pick(rank.buy), sell: pick(rank.sell), trendFailed }
}

/** 개인 순위의 출처·범위 — 응답에 그대로 싣는다 */
export const INDIVIDUAL_NOTE = '개인 순매매 종목 순위는 원천(네이버)이 제공하지 않습니다. 앱의 주요 종목(수급 레이더 유니버스, 코스피·코스닥 대형주) 안에서 종목별 일별 수급(개인 순매수 수량 × 종가)으로 만든 순위입니다 — 시장 전체 순위가 아닙니다.'
export const SRC_INDIVIDUAL = 'app market-flow-kr(주요 종목 캐시 · naver m.stock stock trend 합산)'

/** 주요 종목 캐시(market-flow-kr) → 한 시장의 개인 순매수·순매도 상위. 금액 = 그날 개인 순매수 수량 × 종가(원천 individual.d1, 원).
 *  netQty 는 금액 ÷ 종가로 되돌린다(d1 이 그 곱이라 정확). 거래량 대비 비중(volShare)은 캐시에 그날 거래량이 없어 null */
export function buildIndividualRank(mf: MarketFlowKrResult, mk: KrMarket, size = 10): FlowRank {
  const rows = (mf.entries ?? [])
    .filter(e => e.market === mk && e.individual && Number.isFinite(e.individual.d1) && e.close > 0)
    .map<FlowRow>(e => {
      const amt = e.individual!.d1
      return {
        code: e.ticker, name: e.name, netEok: Math.round(amt / 1e8), netQty: Math.round(amt / e.close), price: e.close,
        changePct: e.changePct, volShare: null, etf: false, type: 'ST', estimated: false, amountFromQty: false, unitRatio: null,
        priceLimitBreak: isLimitBreak(e.changePct),
      }
    })
  const buy = rows.filter(r => r.netEok > 0).sort((a, b) => b.netEok - a.netEok).slice(0, size)
  const sell = rows.filter(r => r.netEok < 0).sort((a, b) => a.netEok - b.netEok).slice(0, size)
  return { bizdate: mf.dataDate || null, buy, sell }
}
