// 앱 환율 SSOT(/api/exchange-rate) 1순위 원천 — 하나은행 매매기준율(네이버 고시)을 한 번 호출로 여러 통화 같은 회차에서 받는다
//   값: api.stock.naver.com/marketindex/exchange(59개 통화 목록 — 전부 같은 고시 회차 degreeCount)
//   고시일: stock.naver.com/api/securityService/marketindex/exchange/FX_USDKRW/prices 첫 행(목록의 localTradedAt 은 고시 시각이 아니다 —
//           실측 2026-09-27: 목록은 '09-26 05:45' 인데 마지막 고시는 09-23 22:29:59 회차 6255)
//   ⚠️ 엔(JPY)은 100엔당으로 고시된다(실측 864.09) — 앱은 1엔당을 쓰므로 값으로 판별해 나눈다(스케일 규약은 바뀔 수 있다)
//   ⚠️ 주말·휴일엔 마지막 고시가 그대로 온다 — 은행이 지금 쓰는 값이라 '지금 환율'이 맞다. 다만 고시일이 너무 오래되면(원천이 멈춤) 버린다.
import { num, NAVER_HEADERS } from './marketBoardShared'

const LIST_URL = 'https://api.stock.naver.com/marketindex/exchange?page=1&pageSize=60'
const USD_ROWS_URL = 'https://stock.naver.com/api/securityService/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=1'
/** 앱이 쓰는 달러 밖 통화(매매 플랜의 유럽·일본·중국·홍콩 종목) — /api/exchange-rate 의 rates 에 실린다 */
export const FX_NEED = ['EUR', 'CHF', 'GBP', 'HKD', 'DKK', 'SEK', 'JPY', 'CNY'] as const
/** 이보다 오래된 고시는 원천이 멈춘 것으로 본다 — 가장 긴 국내 외환시장 휴장(2025-10-03~09, 7일)보다 넉넉히 */
export const HANA_STALE_DAYS = 10

export interface HanaFx {
  rate: number                      // USD 1달러당 원
  rates: Record<string, number>     // 통화 1단위당 원(KRW:1 포함)
  noticeDate: string | null         // 마지막 고시일(KST 'YYYY-MM-DD') — 확인 못 하면 null(지어내지 않는다)
  noticeRound: number | null        // 그날 고시 회차
}

/** 네이버 환율 목록 → need 통화의 원화 환율(같은 회차). 하나은행 행만 받고, USD 가 없거나 스케일이 틀리면 null */
export function parseHanaList(json: unknown, need: readonly string[]): { rates: Record<string, number>; round: number | null } | null {
  if (!json || typeof json !== 'object') return null
  const j = json as { normalList?: unknown; majorList?: unknown }
  const rows = [j.normalList, j.majorList].filter(Array.isArray).flat() as Record<string, unknown>[]
  const rates: Record<string, number> = { KRW: 1 }
  let round: number | null = null
  for (const r of rows) {
    const m = typeof r?.reutersCode === 'string' ? /^FX_([A-Z]{3})KRW$/.exec(r.reutersCode) : null
    const bank = (r?.stockExchangeType as { code?: unknown } | undefined)?.code
    if (!m || bank !== 'HANA') continue
    const code = m[1]
    if ((code !== 'USD' && !need.includes(code)) || rates[code] != null) continue
    let v = num(r.closePrice)
    if (v == null || v <= 0) continue
    if (code === 'JPY' && v > 100) v = v / 100   // 100엔당 고시 → 1엔당(1엔은 수 원~수십 원대)
    rates[code] = v
    if (code === 'USD') round = num(r.degreeCount)
  }
  const usd = rates.USD
  if (usd == null || usd <= 500 || usd >= 5000) return null   // 원/달러 단위가 아니면 받지 않는다
  return { rates, round }
}

/** USD 일별 고시 첫 행 → 고시일. 그 행 값이 목록의 USD 와 같을 때만(다른 회차면 날짜를 붙이지 않는다) */
export function parseHanaNoticeDate(json: unknown, usd: number): string | null {
  const r = Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined) : undefined
  const d = typeof r?.localTradedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.localTradedAt) ? r.localTradedAt : null
  return d && num(r?.closePrice) === usd ? d : null
}

/** 고시일이 nowMs 기준 HANA_STALE_DAYS 일보다 오래됐나(모르면 false — 날짜를 못 붙인 것만으로 버리지 않는다) */
export function isHanaStale(noticeDate: string | null, nowMs: number): boolean {
  if (!noticeDate) return false
  const t = Date.parse(`${noticeDate}T00:00:00+09:00`)
  return Number.isFinite(t) && nowMs - t > HANA_STALE_DAYS * 86_400_000
}

async function getJsonCached(url: string, timeoutMs: number): Promise<unknown | null> {
  try {
    // 10분 Data Cache — 하나은행은 장중 몇 분마다 새 회차를 고시한다. 이 라우트는 서버·화면이 자주 불러 원천에 매번 가지 않게 묶는다
    const r = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 600 }, signal: AbortSignal.timeout(timeoutMs) })
    return r.ok ? await r.json() : null
  } catch { return null }
}

/** 하나은행 매매기준율 — 못 받았거나 통화가 빠졌거나 고시가 멈췄으면 null(호출부가 다음 원천으로) */
export async function fetchHanaFx(need: readonly string[], timeoutMs: number, nowMs = Date.now()): Promise<HanaFx | null> {
  const [list, usdRows] = await Promise.all([getJsonCached(LIST_URL, timeoutMs), getJsonCached(USD_ROWS_URL, timeoutMs)])
  const p = parseHanaList(list, need)
  // 통화가 하나라도 빠지면 통째로 다음 원천 — 통화마다 원천이 섞이면 교차 환율(유로↔달러)이 어긋난다
  if (!p || need.some(c => p.rates[c] == null)) return null
  const noticeDate = parseHanaNoticeDate(usdRows, p.rates.USD)
  if (isHanaStale(noticeDate, nowMs)) return null
  return { rate: p.rates.USD, rates: p.rates, noticeDate, noticeRound: p.round }
}
