// 종목 검색 API — ?q= 로 한국·미국 주식·ETF(네이버 자동완성)와 코인(업비트)을 함께 찾는다
import { NextResponse } from 'next/server'
import { expandQuery, parseNaverItems, matchUpbit, mergeResults, mergeStockLists, rankCrypto } from '@/lib/stockSearch'
// 업비트 목록(6시간)·거래대금(60초) 캐시는 시장 탭 코인 특징종목과 함께 쓴다
import { upbitMarkets, upbitVolumes as cryptoVolumes } from '@/lib/upbitMarket'

export const dynamic = 'force-dynamic'
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }
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
