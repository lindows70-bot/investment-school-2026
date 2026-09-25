// 종목 검색 API — ?q= 로 한국·미국 주식·ETF(네이버 자동완성)와 코인(업비트)을 함께 찾는다
import { NextResponse } from 'next/server'
import { expandQuery, parseNaverItems, matchUpbit, mergeResults, mergeStockLists, rankCrypto, type UpbitMarket } from '@/lib/stockSearch'

export const dynamic = 'force-dynamic'
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }
let upbitCache: { at: number; list: UpbitMarket[] } | null = null   // 목록은 하루에 몇 번 안 바뀐다 — 6시간

// 실패 시 옛 목록이 있으면 그것을, 없으면 null(= 조회 실패). 실패는 캐시하지 않는다.
async function upbitMarkets(): Promise<UpbitMarket[] | null> {
  if (upbitCache && Date.now() - upbitCache.at < 6 * 3600_000) return upbitCache.list
  try {
    const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return upbitCache?.list ?? null
    const list = await r.json()
    if (!Array.isArray(list)) return upbitCache?.list ?? null
    upbitCache = { at: Date.now(), list: list as UpbitMarket[] }
    return upbitCache.list
  } catch {
    return upbitCache?.list ?? null
  }
}

// 원화 마켓 전체의 24시간 거래대금 — 한 번에 조회. 실패하면 빈 표(정렬만 약해지고 검색은 된다)
async function cryptoVolumes(): Promise<Record<string, number>> {
  try {
    const r = await fetch('https://api.upbit.com/v1/ticker/all?quote_currencies=KRW', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return {}
    const data = await r.json()
    if (!Array.isArray(data)) return {}
    const volume: Record<string, number> = {}
    for (const d of data as { market: string; acc_trade_price_24h: number }[]) {
      if (typeof d?.market === 'string' && d.market.startsWith('KRW-')) volume[d.market.slice(4)] = Number(d.acc_trade_price_24h) || 0
    }
    return volume
  } catch {
    return {}
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function naverItems(eq: string): Promise<any[] | null> {
  try {
    const r = await fetch(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(eq)}&target=stock`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const data = await r.json()
    return Array.isArray(data?.items) ? data.items : null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q')?.trim() ?? '').slice(0, 40)
  if (q.length < 1) return NextResponse.json({ results: [], failed: false, failedSources: [] })
  // 별칭이 일반 종목명과 겹칠 수 있어(에이스침대·쏠리드·타이거일렉) 원문과 별칭을 둘 다 검색한다
  const eq = expandQuery(q)
  const [naverOrig, naverAlias, upbit, volume] = await Promise.all([
    naverItems(q),
    eq !== q ? naverItems(eq) : Promise.resolve(null),
    upbitMarkets(),
    cryptoVolumes(),
  ])
  const stocks = mergeStockLists(parseNaverItems(naverOrig ?? []), parseNaverItems(naverAlias ?? []))
  // 한쪽이라도 실패했는데 결과가 0건이면 '없음'이 아니라 '못 불러옴'이다
  const stocksFailed = (naverOrig === null || (eq !== q && naverAlias === null)) && stocks.length === 0
  const crypto = rankCrypto(matchUpbit(upbit ?? [], q), q, volume)
  const failedSources: string[] = []
  if (stocksFailed) failedSources.push('stocks')
  if (upbit === null) failedSources.push('crypto')
  const results = mergeResults(stocks, crypto, 10)
  return NextResponse.json({ results, failed: failedSources.length > 0, failedSources })
}
