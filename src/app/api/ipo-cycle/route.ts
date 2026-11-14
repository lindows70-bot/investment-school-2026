// 🚀 IPO 하이프 사이클 — 신규 상장 혁신주의 6단계 수명주기(HYPE→REALITY→PAIN→SMART MONEY→RECOVERY→UPTREND).
// ⚠️ 제미나이 안의 '가상 슬라이더' 대신, 실제 상장주를 상장 첫날 종가·일봉 종가 실데이터로 곡선 위에 자동 매핑(제1원칙).
//    목록·판정식은 src/lib/ipoCycle.ts(불변식 scripts/verify-ipo-cycle.mjs 와 같은 표). 상장 대기 목록(IPO_WATCH)은 여기서 야후 검색으로 감지한다.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { IPO_UNIVERSE, IPO_WATCH, US_EXCHANGES, buildIpoStock, type DailyBar, type IpoEntry, type IpoStock, type IpoCycleResult } from '@/lib/ipoCycle'

export type { Phase, IpoStock, IpoCycleResult } from '@/lib/ipoCycle'   // 화면이 이 경로에서 타입을 가져온다(기존 import 유지)

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const UA = { 'User-Agent': 'Mozilla/5.0' }

// ⭐ 상장일~현재로 정확히 잘라 받는다(period1/period2) — range=max 는 옛 동명 티커(SPCX 옛 SPAC ETF 등) 이력을 섞는다.
//    일봉(2026-11-14): 주봉 종가는 고점을 낮게 잡아 낙폭이 얕게 나왔다. 6년치도 1,500봉 남짓이라 한 번에 받는다
async function daily(ticker: string, ipoTs: number): Promise<{ rows: DailyBar[]; firstTrade: number | null }> {
  const p1 = Math.floor(ipoTs) - 3 * 86400, p2 = Math.floor(Date.now() / 1000)
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${p1}&period2=${p2}&interval=1d`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
      if (!r.ok) continue
      const res = (await r.json())?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []; const cl: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const rows = ts.map((t, i) => ({ ts: t, c: cl[i] })).filter((x): x is DailyBar => x.c != null && x.c > 0)
      if (rows.length > 0) return { rows, firstTrade: typeof res?.meta?.firstTradeDate === 'number' ? res.meta.firstTradeDate : null }
    } catch { /* 다음 host */ }
  }
  return { rows: [], firstTrade: null }
}

/** 🔭 상장 대기 목록 감지 — 야후 검색에 '미국 거래소 · 보통주 · 이름 일치 · since 이후 첫 거래'인 티커가 생겼으면 목록에 얹는다.
 *  검색·시세가 실패하면 그 이름만 건너뛴다(없는 것으로 치지 않는다 — 다음 계산이 다시 본다) */
async function detectNewListings(known: Set<string>): Promise<(IpoEntry & { auto: true })[]> {
  const found = await Promise.all(IPO_WATCH.map(async w => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(w.q)}&quotesCount=8&newsCount=0`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(8_000) })
      if (!r.ok) return null
      const quotes: { symbol?: string; quoteType?: string; exchange?: string; shortname?: string; longname?: string }[] = (await r.json())?.quotes ?? []
      const hit = quotes.find(x => x.quoteType === 'EQUITY' && !!x.exchange && US_EXCHANGES.has(x.exchange) && !!x.symbol && /^[A-Z]{1,5}$/.test(x.symbol) && w.match.test(`${x.shortname ?? ''} ${x.longname ?? ''}`))
      if (!hit?.symbol || known.has(hit.symbol)) return null
      const sinceTs = Date.parse(w.since) / 1000
      const { firstTrade } = await daily(hit.symbol, sinceTs)
      if (firstTrade == null || firstTrade < sinceTs) return null   // 대기 시작 전부터 거래되던 티커 = 다른 회사
      return { ticker: hit.symbol, name: w.name, ipo: new Date(firstTrade * 1000).toISOString().slice(0, 10), auto: true as const }
    } catch { return null }
  }))
  return found.filter((x): x is IpoEntry & { auto: true } => x != null)
}

export async function GET() {
  // v5(2026-11-14): 기준가 첫 주 종가→첫날 종가 · 고점·저점 주봉→일봉 · ipoBarDate·lastBar·priceDate·auto 필드 · LUNR·SPCX 상장일 정정 · 목록 +3 · 상장 대기 자동 감지
  // v6(2026-11-14): 상장 9개월 전은 매집으로 분류하지 않는다(SMART_MIN_MONTHS) — 스페이스X·세레브라스가 매집 → 자각
  const cacheKey = 'ipo-cycle-v6'
  const cached = await getCache<IpoCycleResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const nowSec = Date.now() / 1000
  const autos = await detectNewListings(new Set(IPO_UNIVERSE.map(u => u.ticker)))
  const entries: (IpoEntry & { auto?: boolean })[] = [...IPO_UNIVERSE, ...autos]
  const results = await Promise.all(entries.map(async u => {
    const { rows } = await daily(u.ticker, Date.parse(u.ipo) / 1000)
    return buildIpoStock(u, rows, nowSec)
  }))
  const stocks = results.filter((r): r is IpoStock => r != null).sort((a, b) => a.curveX - b.curveX)

  const priceDate = stocks.length ? stocks.map(s => s.lastBar).sort().at(-1) ?? null : null
  const result: IpoCycleResult = { stocks, asOf: new Date().toISOString(), priceDate }
  // 정식 목록의 대부분이 왔을 때만 캐시(부분실패 박제 금지) — 야후가 몇 종목만 준 결과를 12시간 얼리지 않는다
  if (stocks.filter(s => !s.auto).length >= Math.ceil(IPO_UNIVERSE.length * 0.8)) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
