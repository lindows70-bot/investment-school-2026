// 미국 시장 탭 원천 — 네이버 해외 종목 순위(상승·하락·거래량·거래대금·시총)와 SPY·QQQ 장중(야후 5분봉)을 읽는 서버 lib
//   원천 실측(2026-09-27, 미국 9/25 마감값): 순위 목록은 **주식만**(ETF 없음) 나오고, 상승 1위가 시총 2천만 달러짜리(+309%)였다
//   → 초소형주·상장 직후·권리/유닛을 걸러내고 걸러낸 개수를 싣는다. 목록엔 기준 시각 필드가 없다(asOf null — 지어내지 않는다).
import { type Part, okPart, failPart, num, downsample, getJson } from './marketBoardShared'
import type { IntradayPoint, MoverList } from './krMarketBoard'

export const US_MOVER_KINDS = ['up', 'down', 'quantTop', 'priceTop', 'marketValue'] as const
export type UsMoverKind = typeof US_MOVER_KINDS[number]

/** 시총 3억 달러 미만(마이크로캡)은 거른다 — 2026-10-09 사용자 확정(9/27 임시값 그대로) */
export const US_MIN_CAP_USD = 300_000_000
/** 상장일(listedAt)이 기준 시각에서 7일 안이면 '상장 직후'로 거른다(목록에 거래일 필드가 없어 '첫날'을 정확히 못 가린다) — 2026-10-09 사용자 확정 */
export const US_NEW_LISTING_DAYS = 7

export interface UsMover {
  symbol: string; name: string; nameEng: string | null; exchange: string | null
  price: number | null; changePct: number | null
  marketCapUsd: number | null
  listedAt: string | null
  industry: string | null
  fund: boolean   // 원천 업종이 '폐쇄형 펀드'(목록에 ETF 는 없지만 펀드가 섞인다)
}

/** stock.naver.com/api/foreign/market/stock/global → 거른 뒤 limit 개. nowMs 는 상장 직후 판정 기준 */
export function parseUsMovers(json: unknown, nowMs: number, limit = 10,
  opts: { minCapUsd?: number; newListingDays?: number } = {}): MoverList<UsMover> | null {
  if (!Array.isArray(json)) return null
  const minCap = opts.minCapUsd ?? US_MIN_CAP_USD
  const newDays = opts.newListingDays ?? US_NEW_LISTING_DAYS
  const filtered = { smallCap: 0, newListing: 0, rightsUnits: 0 }
  const items: UsMover[] = []
  for (const s of json as Record<string, unknown>[]) {
    const symbol = typeof s?.symbolCode === 'string' ? s.symbolCode.trim() : null
    if (!symbol) continue
    // 'PNAQ RT'·'VACI U' — 스팩 권리·유닛·워런트는 보통주가 아니다(원천 심볼에 공백 + 접미사)
    if (/\s/.test(symbol)) { filtered.rightsUnits++; continue }
    const listedAt = typeof s.listedAt === 'string' ? s.listedAt : null
    const lt = listedAt ? Date.parse(listedAt) : NaN
    if (Number.isFinite(lt) && nowMs - lt < newDays * 86_400_000) { filtered.newListing++; continue }
    const cap = num(s.marketValue)
    if (cap == null || cap < minCap) { filtered.smallCap++; continue }
    if (items.length >= limit) continue
    const ex = (s.stockExchangeType as { code?: unknown } | undefined)?.code
    const industry = typeof s.reutersIndustryName === 'string' ? s.reutersIndustryName : null
    items.push({
      symbol,
      name: typeof s.koreanCodeName === 'string' && s.koreanCodeName ? s.koreanCodeName : symbol,
      nameEng: typeof s.englishCodeName === 'string' ? s.englishCodeName : null,
      exchange: typeof ex === 'string' ? ex : null,
      price: num(s.closePrice ?? s.currentPrice), changePct: num(s.fluctuationsRatio),
      marketCapUsd: cap, listedAt, industry, fund: industry === '폐쇄형 펀드',
    })
  }
  return { items, scanned: (json as unknown[]).length, filtered, marketStatus: null }
}

// ── SPY·QQQ 장중(야후 chart range=1d interval=5m) ──────────────────────────
export interface UsEtfIntraday {
  symbol: string
  price: number; prevClose: number | null; change: number | null; changePct: number | null
  points: IntradayPoint[]
  asOf: string | null                          // 원천 meta.regularMarketTime
  marketStatus: 'OPEN' | 'CLOSED' | null       // 원천 currentTradingPeriod.regular 와 nowMs 비교
}
export function parseYahooIntraday(json: unknown, nowMs: number, max = 90): UsEtfIntraday | null {
  const res = (json as { chart?: { result?: unknown[] } } | null)?.chart?.result?.[0] as Record<string, unknown> | undefined
  const meta = res?.meta as Record<string, unknown> | undefined
  const price = num(meta?.regularMarketPrice)
  if (!meta || price == null) return null
  // previousClose(전 거래일 정규장 종가)를 먼저 — chartPreviousClose 는 휴장 뒤 이틀 전 값이 올 수 있다(코스닥 실사고)
  const prevClose = num(meta.previousClose) ?? num(meta.chartPreviousClose)
  const change = prevClose != null ? price - prevClose : null
  const ts = Array.isArray(res?.timestamp) ? (res!.timestamp as unknown[]) : []
  const quote = ((res?.indicators as { quote?: { close?: unknown[] }[] } | undefined)?.quote?.[0]?.close) ?? []
  const pts: IntradayPoint[] = []
  ts.forEach((t, i) => {
    const sec = num(t); const v = num(quote[i])
    if (sec != null && v != null) pts.push({ t: sec * 1000, v })
  })
  const rmt = num(meta.regularMarketTime)
  const reg = (meta.currentTradingPeriod as { regular?: { start?: unknown; end?: unknown } } | undefined)?.regular
  const st = num(reg?.start), en = num(reg?.end)
  return {
    symbol: typeof meta.symbol === 'string' ? meta.symbol : '',
    price, prevClose, change,
    changePct: prevClose ? (change as number) / prevClose * 100 : null,
    points: downsample(pts, max),
    asOf: rmt != null ? new Date(rmt * 1000).toISOString() : null,
    marketStatus: st != null && en != null ? (nowMs >= st * 1000 && nowMs < en * 1000 ? 'OPEN' : 'CLOSED') : null,
  }
}

// ── 가져오기(서버) ────────────────────────────────────────────────────────
const SRC_MOVERS = 'naver stock.naver.com foreign global(usa)'
const SRC_YF = 'yahoo chart 5m'
const YF_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json',
}

export async function fetchUsMovers(kind: UsMoverKind, limit = 10): Promise<Part<MoverList<UsMover>>> {
  // 상승·하락 1~100위는 대부분 초소형주다(실측: 100개 중 3억 달러↑ 15개) — 100개를 받아 거른다
  const size = kind === 'marketValue' ? 30 : 100
  const r = await getJson(`https://stock.naver.com/api/foreign/market/stock/global?nation=usa&tradeType=ALL&orderType=${kind}&startIdx=0&pageSize=${size}`)
  if (!r.ok) return failPart(r.reason, SRC_MOVERS)
  const p = parseUsMovers(r.json, Date.now(), limit)
  if (!p) return failPart('목록 형식이 다름', SRC_MOVERS)
  return okPart(p, null, SRC_MOVERS)   // 원천 목록에 기준 시각 필드가 없다
}

export async function fetchUsEtfIntraday(symbol: 'SPY' | 'QQQ'): Promise<Part<UsEtfIntraday>> {
  let last = '응답 없음'
  for (const host of ['query1', 'query2'] as const) {
    const r = await getJson(`https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=5m&includePrePost=false`, { headers: YF_H })
    if (!r.ok) { last = r.reason; continue }
    const p = parseYahooIntraday(r.json, Date.now())
    if (p) return okPart({ ...p, symbol }, p.asOf, SRC_YF)
    last = '가격 없음'
  }
  return failPart(last, SRC_YF)
}
