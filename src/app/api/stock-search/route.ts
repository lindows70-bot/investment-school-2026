// 종목 검색 API — ?q= 로 한국·미국 주식·ETF(네이버 자동완성)와 코인(업비트)을 함께 찾는다
import { NextResponse } from 'next/server'
import { expandQuery, parseNaverItems, matchUpbit, mergeResults, rankCrypto, type UpbitMarket } from '@/lib/stockSearch'

export const dynamic = 'force-dynamic'
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }
let upbitCache: { at: number; list: UpbitMarket[] } | null = null   // 목록은 하루에 몇 번 안 바뀐다 — 6시간

async function upbitMarkets(): Promise<UpbitMarket[]> {
  if (upbitCache && Date.now() - upbitCache.at < 6 * 3600_000) return upbitCache.list
  const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
  if (!r.ok) return upbitCache?.list ?? []
  const list = (await r.json()) as UpbitMarket[]
  upbitCache = { at: Date.now(), list }
  return list
}

async function cryptoVolumes(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}
  try {
    const markets = tickers.map(t => `KRW-${t}`).join(',')
    const r = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return {}
    const data = (await r.json()) as { market: string; acc_trade_price_24h: number }[]
    const volume: Record<string, number> = {}
    for (const d of data) volume[d.market.slice(4)] = d.acc_trade_price_24h
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
    return data?.items ?? []
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ results: [] })
  const eq = expandQuery(q)
  const [naver, upbit] = await Promise.all([
    naverItems(eq),
    upbitMarkets().catch(() => [] as UpbitMarket[]),
  ])
  const cryptoMatches = matchUpbit(upbit, q).slice(0, 20)
  const volume = await cryptoVolumes(cryptoMatches.map(c => c.ticker))
  const results = mergeResults(parseNaverItems(naver ?? []), rankCrypto(cryptoMatches, q, volume), 10)
  return NextResponse.json({ results, failed: naver === null })
}
