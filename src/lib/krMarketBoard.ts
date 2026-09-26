// 국내 시장 탭 원천(네이버) — 지수 3종·장중 분봉·투자자별 합계·등락 종목 수·특징종목·업종·주요 뉴스를 읽는 서버 lib
//   원천 실측(2026-09-27, 9/23 마감값): context-notes '시장 탭 Phase 0'. 파싱은 순수 함수로 분리해 scripts/verify-market-board.mjs 가 검증한다.
//   ⚠️ KR 등락은 네이버가 SSOT 다(야후 chartPreviousClose 가 이틀 전 종가라 코스닥 +1.21% 를 +0.98% 로 적었다).
import {
  type Part, okPart, failPart, num, signByCode, downsample, kstCompactToIso, getJson,
} from './marketBoardShared'

export const KR_INDEX_CODES = ['KOSPI', 'KOSDAQ', 'KPI200'] as const
export type KrIndexCode = typeof KR_INDEX_CODES[number]
export type KrMarket = 'KOSPI' | 'KOSDAQ'

// ── 지수 현재값 ───────────────────────────────────────────────────────────
const pos = (v: number | null): number | null => (v != null && v > 0 ? v : null)
export interface KrIndexQuote {
  code: string; name: string
  value: number; change: number | null; changePct: number | null
  open: number | null; high: number | null; low: number | null
  marketStatus: string | null   // 원천 marketStatus(OPEN·CLOSE 등)
  asOf: string | null           // 원천 localTradedAt
}

/** polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ,KPI200 → 지수별 값.
 *  등락 부호는 compareToPreviousPrice.code 로 붙인다(원천 Raw 값이 절댓값일 수 있다) */
export function parseIndexPolling(json: unknown): KrIndexQuote[] {
  const datas = (json as { datas?: unknown } | null)?.datas
  if (!Array.isArray(datas)) return []
  const out: KrIndexQuote[] = []
  for (const d of datas as Record<string, unknown>[]) {
    const value = num(d?.closePriceRaw ?? d?.closePrice)
    const code = typeof d?.itemCode === 'string' ? d.itemCode : null
    if (value == null || !code) continue
    const cc = (d.compareToPreviousPrice as { code?: unknown } | undefined)?.code
    out.push({
      code, name: typeof d.stockName === 'string' ? d.stockName : code,
      value,
      change: signByCode(num(d.compareToPreviousClosePriceRaw ?? d.compareToPreviousClosePrice), cc),
      changePct: signByCode(num(d.fluctuationsRatioRaw ?? d.fluctuationsRatio), cc),
      // 장 시작 전엔 시가·고가·저가가 "0" 으로 온다 — 0 을 값으로 쓰면 '저가 0' 이 된다(없음 = null)
      open: pos(num(d.openPriceRaw ?? d.openPrice)), high: pos(num(d.highPriceRaw ?? d.highPrice)), low: pos(num(d.lowPriceRaw ?? d.lowPrice)),
      marketStatus: typeof d.marketStatus === 'string' ? d.marketStatus : null,
      asOf: typeof d.localTradedAt === 'string' ? d.localTradedAt : null,
    })
  }
  return out
}

// ── 장중 분봉 ─────────────────────────────────────────────────────────────
export interface IntradayPoint { t: number; v: number }   // t = epoch ms
/** api.stock.naver.com/chart/domestic/index/{code}/minute → 점을 max 개 이하로 줄인다(마지막 점 유지). asOf = 마지막 봉 시각 */
export function parseIndexMinute(json: unknown, max = 90): { points: IntradayPoint[]; asOf: string | null } | null {
  if (!Array.isArray(json)) return null
  const pts: IntradayPoint[] = []
  for (const r of json as Record<string, unknown>[]) {
    const iso = kstCompactToIso(r?.localDateTime)
    const v = num(r?.currentPrice)
    if (!iso || v == null) continue
    const t = Date.parse(iso)
    if (Number.isFinite(t)) pts.push({ t, v })
  }
  if (!pts.length) return null
  pts.sort((a, b) => a.t - b.t)
  const last = (json as Record<string, unknown>[]).map(r => kstCompactToIso(r?.localDateTime)).filter(Boolean).sort().pop() ?? null
  return { points: downsample(pts, max), asOf: last }
}

// ── 투자자별 합계 · 등락 종목 수 ─────────────────────────────────────────────
/** 단위: 억원(원천 dealTrendInfo — 네이버 화면 라벨 '억원'). 개인·외국인·기관 */
export interface InvestorTotals { bizdate: string | null; personal: number | null; foreign: number | null; institutional: number | null }
export interface UpDownCount { upper: number | null; rise: number | null; steady: number | null; fall: number | null; lower: number | null }

/** m.stock.naver.com/api/index/{KOSPI|KOSDAQ}/integration → dealTrendInfo·upDownStockInfo.
 *  ⚠️ 등락 수는 시장 전체 종목의 오늘 등락이다 — 앱 market-breadth(148종·200일선)와 다른 지표라 섞지 않는다 */
export function parseIntegration(json: unknown): { investors: InvestorTotals | null; upDown: UpDownCount | null } {
  const j = json as { dealTrendInfo?: Record<string, unknown>; upDownStockInfo?: Record<string, unknown> } | null
  const d = j?.dealTrendInfo
  const investors: InvestorTotals | null = d
    ? {
        bizdate: kstCompactToIso(d.bizdate),
        personal: num(d.personalValue), foreign: num(d.foreignValue), institutional: num(d.institutionalValue),
      }
    : null
  const u = j?.upDownStockInfo
  const upDown: UpDownCount | null = u
    ? { upper: num(u.upperCount), rise: num(u.riseCount), steady: num(u.steadyCount), fall: num(u.fallCount), lower: num(u.lowerCount) }
    : null
  return {
    investors: investors && (investors.personal != null || investors.foreign != null || investors.institutional != null) ? investors : null,
    upDown: upDown && [upDown.rise, upDown.fall, upDown.steady].some(v => v != null) ? upDown : null,
  }
}

// ── 특징종목 ──────────────────────────────────────────────────────────────
export const KR_MOVER_KINDS = ['up', 'down', 'quantTop', 'priceTop', 'high52week'] as const
export type KrMoverKind = typeof KR_MOVER_KINDS[number]

/** KRX 가격제한폭 ±30%(주식) — 주식이 이걸 넘는 등락은 가격제한폭이 없는 날에만 나온다:
 *  상장 첫날·거래 재개·재상장(기준가가 새로 정해진 날)과 정리매매. 원천에 상장일 필드가 없어(m.stock 목록·integration 모두 실측 없음) 이 규칙으로 판정한다.
 *  ⛔ **주식에만** 쓴다 — 레버리지 ETF/ETN 은 제한폭이 배율만큼 넓다(2X = ±60%). 2X ETF +45% 는 정상 거래다.
 *  ⚠️ 한계: 상장 첫날이라도 등락이 ±30% 안이면(공모가 대비 +20% 등) 걸러지지 않는다 */
export const KR_PRICE_LIMIT_PCT = 30
/** 주식 등락이 가격제한폭 밖인가(반올림 여유 0.05%p) — 호출부가 '주식인지' 먼저 가린다 */
export const isLimitBreak = (pct: number | null): boolean => pct != null && Math.abs(pct) > KR_PRICE_LIMIT_PCT + 0.05

export interface KrMover {
  code: string; name: string
  price: number | null; changePct: number | null
  tradeValueEok: number | null   // 거래대금(억원) — 원천 accumulatedTradingValueRaw(원) ÷ 1e8
  marketCapEok: number | null    // 시가총액(억원) — 원천 marketValueRaw(원) ÷ 1e8
  etp: 'ETF' | 'ETN' | null      // 원천 stockEndType
  asOf: string | null            // 원천 localTradedAt
}
export interface MoverList<T> {
  items: T[]
  scanned: number                           // 원천에서 받은 줄 수
  filtered: Record<string, number>          // 걸러낸 사유별 개수
  marketStatus: string | null
}

/** m.stock.naver.com/api/stocks/{kind}/{KOSPI|KOSDAQ} → 이상치(가격제한폭 밖)를 걸러 limit 개 */
export function parseKrMovers(json: unknown, limit = 10): MoverList<KrMover> | null {
  const j = json as { stocks?: unknown; marketStatus?: unknown } | null
  if (!Array.isArray(j?.stocks)) return null
  const rows = j!.stocks as Record<string, unknown>[]
  let limitBreak = 0
  const items: KrMover[] = []
  for (const s of rows) {
    const code = typeof s?.itemCode === 'string' ? s.itemCode : null
    if (!code) continue
    const cc = (s.compareToPreviousPrice as { code?: unknown } | undefined)?.code
    const changePct = signByCode(num(s.fluctuationsRatio), cc)
    const end = typeof s.stockEndType === 'string' ? s.stockEndType.toLowerCase() : ''
    const etp = end === 'etf' ? 'ETF' : end === 'etn' ? 'ETN' : null
    if (etp == null && isLimitBreak(changePct)) { limitBreak++; continue }
    if (items.length >= limit) continue
    const tv = num(s.accumulatedTradingValueRaw)
    const mv = num(s.marketValueRaw)
    items.push({
      code, name: typeof s.stockName === 'string' ? s.stockName : code,
      price: num(s.closePriceRaw ?? s.closePrice), changePct,
      tradeValueEok: tv != null ? Math.round(tv / 1e8) : null,
      marketCapEok: mv != null ? Math.round(mv / 1e8) : null,
      etp,
      asOf: typeof s.localTradedAt === 'string' ? s.localTradedAt : null,
    })
  }
  return {
    items, scanned: rows.length,
    filtered: { priceLimitBreak: limitBreak },
    marketStatus: typeof j!.marketStatus === 'string' ? j!.marketStatus : null,
  }
}

/** 목록의 기준 시각 = 종목 localTradedAt 중 가장 늦은 값(목록 자체엔 시각 필드가 없다) */
export const latestAsOf = (items: { asOf: string | null }[]): string | null =>
  items.map(i => i.asOf).filter((x): x is string => !!x).sort().pop() ?? null

// ── 업종 ─────────────────────────────────────────────────────────────────
export interface KrIndustry {
  no: number; name: string; changePct: number | null
  count: number | null; rise: number | null; fall: number | null; steady: number | null
  /** 업종 등락이 ±30% 를 넘는다 = 가격제한폭 밖 종목(상장 첫날·정리매매 등)이 섞였다 — 시총가중 평균은 구성 종목 등락 범위를 못 넘는다(업종은 주식만) */
  limitBreakSuspect: boolean
}
/** m.stock.naver.com/api/stocks/industry → 업종(시총가중 등락률 — 테마는 단순평균이라 공식이 다르다) */
export function parseIndustry(json: unknown): { items: KrIndustry[]; marketStatus: string | null; total: number | null } | null {
  const j = json as { groups?: unknown; marketStatus?: unknown; totalCount?: unknown } | null
  if (!Array.isArray(j?.groups)) return null
  const items: KrIndustry[] = []
  for (const g of j!.groups as Record<string, unknown>[]) {
    const no = num(g?.no); const name = typeof g?.name === 'string' ? g.name : null
    if (no == null || !name) continue
    const changePct = num(g.changeRate)
    items.push({
      no, name, changePct,
      count: num(g.totalCount), rise: num(g.riseCount), fall: num(g.fallCount), steady: num(g.steadyCount),
      limitBreakSuspect: isLimitBreak(changePct),
    })
  }
  return { items, marketStatus: typeof j!.marketStatus === 'string' ? j!.marketStatus : null, total: num(j!.totalCount) }
}

// ── 주요 뉴스 ─────────────────────────────────────────────────────────────
export interface KrNews { title: string; office: string | null; officeId: string; articleId: string; datetime: string | null; url: string }
const decodeEntities = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** m.stock.naver.com/front-api/news/category?category=mainnews → 원문 제목·언론사·시각·링크(officeId+articleId 로 조립) */
export function parseMainNews(json: unknown): KrNews[] | null {
  const j = json as { isSuccess?: unknown; result?: unknown } | null
  if (!Array.isArray(j?.result)) return null
  const out: KrNews[] = []
  for (const n of j!.result as Record<string, unknown>[]) {
    const officeId = typeof n?.officeId === 'string' ? n.officeId : null
    const articleId = typeof n?.articleId === 'string' ? n.articleId : null
    const raw = typeof n?.titleFull === 'string' && n.titleFull ? n.titleFull : typeof n?.title === 'string' ? n.title : null
    if (!officeId || !articleId || !raw) continue
    out.push({
      title: decodeEntities(raw), office: typeof n.officeName === 'string' ? n.officeName : null,
      officeId, articleId, datetime: kstCompactToIso(n.datetime),
      url: `https://n.news.naver.com/mnews/article/${officeId}/${articleId}`,
    })
  }
  return out
}

// ── 가져오기(서버) ────────────────────────────────────────────────────────
const SRC = {
  poll: 'naver polling(realtime index)',
  minute: 'naver api.stock chart minute',
  integ: 'naver m.stock index integration',
  movers: 'naver m.stock stocks',
  industry: 'naver m.stock industry',
  news: 'naver m.stock front-api mainnews',
}

export async function fetchKrIndices(): Promise<Part<KrIndexQuote[]>> {
  const r = await getJson(`https://polling.finance.naver.com/api/realtime/domestic/index/${KR_INDEX_CODES.join(',')}`)
  if (!r.ok) return failPart(r.reason, SRC.poll)
  const q = parseIndexPolling(r.json)
  if (!q.length) return failPart('응답에 지수 값이 없음', SRC.poll)
  return okPart(q, q.map(x => x.asOf).filter((x): x is string => !!x).sort().pop() ?? null, SRC.poll)
}

export async function fetchKrIndexMinute(code: KrIndexCode, max = 90): Promise<Part<IntradayPoint[]>> {
  const r = await getJson(`https://api.stock.naver.com/chart/domestic/index/${code}/minute`)
  if (!r.ok) return failPart(r.reason, SRC.minute)
  const p = parseIndexMinute(r.json, max)
  if (!p) return failPart('분봉 없음', SRC.minute)
  return okPart(p.points, p.asOf, SRC.minute)
}

export async function fetchKrIntegration(mk: KrMarket): Promise<Part<{ investors: InvestorTotals | null; upDown: UpDownCount | null }>> {
  const r = await getJson(`https://m.stock.naver.com/api/index/${mk}/integration`)
  if (!r.ok) return failPart(r.reason, SRC.integ)
  const p = parseIntegration(r.json)
  if (!p.investors && !p.upDown) return failPart('투자자별·등락 수가 응답에 없음', SRC.integ)
  return okPart(p, p.investors?.bizdate ?? null, SRC.integ)
}

export async function fetchKrMovers(kind: KrMoverKind, mk: KrMarket, limit = 10): Promise<Part<MoverList<KrMover>>> {
  // 걸러낼 몫을 생각해 limit 의 3배를 받는다(최대 40)
  const r = await getJson(`https://m.stock.naver.com/api/stocks/${kind}/${mk}?page=1&pageSize=${Math.min(40, limit * 3)}`)
  if (!r.ok) return failPart(r.reason, SRC.movers)
  const p = parseKrMovers(r.json, limit)
  if (!p) return failPart('목록 형식이 다름', SRC.movers)
  return okPart(p, latestAsOf(p.items), SRC.movers)
}

export async function fetchKrIndustry(limit = 79): Promise<Part<{ items: KrIndustry[]; marketStatus: string | null; total: number | null }>> {
  const r = await getJson(`https://m.stock.naver.com/api/stocks/industry?page=1&pageSize=${limit}`)
  if (!r.ok) return failPart(r.reason, SRC.industry)
  const p = parseIndustry(r.json)
  if (!p) return failPart('목록 형식이 다름', SRC.industry)
  return okPart(p, null, SRC.industry)   // 원천에 기준 시각 필드가 없다 — 지어내지 않는다
}

export async function fetchKrMainNews(size = 10): Promise<Part<KrNews[]>> {
  const r = await getJson(`https://m.stock.naver.com/front-api/news/category?category=mainnews&page=1&pageSize=${Math.max(10, size)}`)
  if (!r.ok) return failPart(r.reason, SRC.news)
  const p = parseMainNews(r.json)
  if (!p) return failPart('목록 형식이 다름', SRC.news)
  return okPart(p.slice(0, size), p.map(x => x.datetime).filter((x): x is string => !!x).sort().pop() ?? null, SRC.news)
}
