/**
 * GET /api/stock-info?ticker=005930&market=KR
 *
 * 종목 추가 모달용 빠른 조회 엔드포인트:
 *  - 차트 데이터 없이 종목명·섹터·기초 지표만 반환 → stock-price 보다 빠름
 *  - KR  : 네이버 모바일 API  (6자리 코드)
 *  - US  : Yahoo Finance quoteSummary
 *  - CRYPTO: CoinGecko simple/price
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Market, Fundamentals } from '@/app/api/stock-price/route'

// ─── Response type ────────────────────────────────────────────────────────────
export interface StockInfo {
  ticker:       string
  name:         string
  market:       Market
  currency:     'USD' | 'KRW'
  fundamentals: Fundamentals
  source:       'live' | 'cache'
  error?:       string
}

// ─── In-process cache (1분) ───────────────────────────────────────────────────
const CACHE     = new Map<string, { data: StockInfo; expiresAt: number }>()
const CACHE_TTL = 60_000

function key(ticker: string, market: Market) { return `${market}:${ticker.toUpperCase()}` }

function nullFund(): Fundamentals {
  return { pe: 'N/A', peg: 'N/A', marketCap: null, volume: null,
           high52w: null, low52w: null, sector: null,
           earningsGrowth: null, dividendYield: null, isEtf: false }
}

// ─── Naver headers ────────────────────────────────────────────────────────────
const NAVER_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
  Referer: 'https://finance.naver.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

// ─── Yahoo Finance headers ────────────────────────────────────────────────────
const YF_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}

// ─── 한국 산업 분류 → Lynch 섹터 키워드 ──────────────────────────────────────
function krIndustryToSector(name: string | null): string | null {
  if (!name) return null
  if (/부동산/.test(name))                                 return 'Real Estate'
  if (/석유|정제|코크스|연탄/.test(name))                  return 'Energy'
  if (/화학|도료|비료|합성수지/.test(name))                 return 'Basic Materials'
  if (/철강|금속|1차금속/.test(name))                      return 'Basic Materials'
  if (/건설|토목/.test(name))                              return 'Industrials'
  if (/조선|항공|방위/.test(name))                         return 'Industrials'
  if (/운수|창고|물류/.test(name))                         return 'Industrials'
  if (/음식료|식품|음료|담배/.test(name))                  return 'Consumer Defensive'
  if (/의류|섬유/.test(name))                              return 'Consumer Cyclical'
  if (/통신/.test(name))                                   return 'Communication Services'
  if (/전기·가스|전력|가스공급/.test(name))                return 'Utilities'
  if (/금융|은행|저축|보험|증권|투자/.test(name))           return 'Financial Services'
  if (/의약품|바이오|의료기기|제약/.test(name))             return 'Healthcare'
  if (/소프트웨어|IT서비스|정보기술/.test(name))            return 'Technology'
  if (/전자부품|반도체|컴퓨터|통신장비/.test(name))         return 'Technology'
  if (/게임|엔터|방송|영상|음악/.test(name))                return 'Communication Services'
  return name   // 매핑 없으면 원문 반환
}

// ─── KR (Naver) ───────────────────────────────────────────────────────────────
async function krInfo(ticker: string): Promise<StockInfo> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '')

  // 종목 기본 정보
  const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
    headers: NAVER_H, next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`네이버 종목 정보 조회 실패 (${res.status}): ${code}`)

  const d = await res.json()
  if (!d?.stockName) throw new Error(`종목 코드를 찾을 수 없습니다: ${code}`)

  const per = typeof d.per === 'number' ? d.per : null
  const dy  = typeof d.dividendYield === 'number' ? d.dividendYield / 100 : null
  const mc  = typeof d.marketValue   === 'number' ? d.marketValue         : null
  const eps = typeof d.eps           === 'number' ? d.eps                 : null

  const industryName: string | null = d.industryCodeType?.name ?? null
  const sector = krIndustryToSector(industryName)

  return {
    ticker:   code,
    name:     d.stockName as string,
    market:   'KR',
    currency: 'KRW',
    fundamentals: {
      pe:             per ?? 'N/A',
      peg:            'N/A',
      marketCap:      mc,
      volume:         null,
      high52w:        typeof d.high52week === 'number' ? d.high52week : null,
      low52w:         typeof d.low52week  === 'number' ? d.low52week  : null,
      sector,
      earningsGrowth: eps != null && eps < 0 ? -0.5 : null,
      dividendYield:  dy,
      isEtf:          false,
    },
    source: 'live',
  }
}

// ─── US (Yahoo Finance v8 chart — v7/v10은 401 차단됨) ───────────────────────
//
// 실제 테스트 결과:
//   v7 quote API  → 401 Unauthorized (차단됨)
//   v10 quoteSummary → 401 Invalid Crumb (차단됨)
//   v8 chart API  → 200 OK ✓  (query1 / query2 모두 동작)
//
// 전략: query1 v8 → query2 v8 → Alpha Vantage (이름 전용)
async function yfV8Meta(ticker: string) {
  const t = ticker.toUpperCase()
  const path = `v8/finance/chart/${encodeURIComponent(t)}?range=1d&interval=1m&includePrePost=false`

  // query1 시도, 실패 시 query2로 fallback
  for (const host of ['query1', 'query2'] as const) {
    try {
      const res = await fetch(`https://${host}.finance.yahoo.com/${path}`, {
        headers: YF_H, next: { revalidate: 0 },
      })
      if (!res.ok) continue

      const json = await res.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) continue

      return {
        name:         (meta.longName ?? meta.shortName ?? t) as string,
        currentPrice: meta.regularMarketPrice as number,
        prevClose:    (meta.chartPreviousClose ?? meta.regularMarketPrice) as number,
        currency:     (meta.currency ?? 'USD') as string,
        // v8 meta에는 PE가 없으므로 null
        trailingPE:   null as number | null,
        marketCap:    null as number | null,
        isEtf:        (meta.instrumentType ?? '').toUpperCase() === 'ETF',
        exchangeName: (meta.exchangeName ?? '') as string,
      }
    } catch { /* 다음 host 시도 */ }
  }

  // 마지막 fallback: Alpha Vantage SYMBOL_SEARCH (이름만)
  try {
    const avRes = await fetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(t)}&apikey=demo`,
      { next: { revalidate: 0 } }
    )
    if (avRes.ok) {
      const avJson = await avRes.json()
      const match  = (avJson?.bestMatches ?? []).find(
        (m: Record<string, string>) => m['1. symbol']?.toUpperCase() === t
      )
      if (match) {
        return {
          name:         match['2. name'] as string,
          currentPrice: 0,
          prevClose:    0,
          currency:     'USD',
          trailingPE:   null as number | null,
          marketCap:    null as number | null,
          isEtf:        (match['3. type'] ?? '').toUpperCase() === 'ETF',
          exchangeName: match['4. region'] as string ?? '',
        }
      }
    }
  } catch { /* Alpha Vantage도 실패 */ }

  throw new Error(`종목을 찾을 수 없습니다: ${t} (Yahoo Finance가 현재 응답하지 않습니다)`)
}

async function usInfo(ticker: string): Promise<StockInfo> {
  const t    = ticker.toUpperCase()
  const meta = await yfV8Meta(t)

  return {
    ticker:   t,
    name:     meta.name,
    market:   'US',
    currency: 'USD',
    fundamentals: {
      pe:             meta.trailingPE ?? 'N/A',
      peg:            'N/A',
      marketCap:      meta.marketCap,
      volume:         null,
      high52w:        null,
      low52w:         null,
      sector:         null,   // v8에서 섹터 제공 안 함
      earningsGrowth: null,
      dividendYield:  null,
      isEtf:          meta.isEtf,
    },
    source: 'live',
  }
}

// ─── CRYPTO (Upbit) — 원화(KRW) 기준 ─────────────────────────────────────────
// 업비트 마켓 코드: KRW-BTC, KRW-XRP, ...

/** 업비트 마켓 전체 목록 캐시 (서버 인스턴스 내 재사용) */
let _upbitMarketCache: { market: string; korean_name: string; english_name: string }[] | null = null
let _upbitMarketCacheAt = 0

async function getUpbitMarkets() {
  if (_upbitMarketCache && Date.now() - _upbitMarketCacheAt < 3_600_000) {
    return _upbitMarketCache  // 1시간 캐시
  }
  const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
    headers: { Accept: 'application/json' }, next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  _upbitMarketCache = await res.json()
  _upbitMarketCacheAt = Date.now()
  return _upbitMarketCache
}

async function cryptoInfo(ticker: string): Promise<StockInfo> {
  const t      = ticker.toUpperCase().replace(/^KRW-/, '')
  const market = `KRW-${t}`

  // 1) 업비트 현재가로 종목 존재 여부 확인
  const tickerRes = await fetch(
    `https://api.upbit.com/v1/ticker?markets=${market}`,
    { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
  )
  if (!tickerRes.ok) throw new Error(`업비트 조회 실패 (${tickerRes.status}): ${market}`)

  const arr = await tickerRes.json()
  const d   = arr?.[0]
  if (!d?.trade_price) throw new Error(`업비트에서 찾을 수 없습니다: ${market}`)

  // 2) 마켓 목록에서 영문 이름 가져오기
  const markets = await getUpbitMarkets()
  const meta    = markets?.find(m => m.market === market)
  const name    = meta?.english_name ?? meta?.korean_name ?? t

  return {
    ticker:   t,
    name,
    market:   'CRYPTO',
    currency: 'KRW',          // ← KRW
    fundamentals: {
      pe: 'N/A', peg: 'N/A',
      marketCap:      null,
      volume:         d.acc_trade_volume_24h ?? null,
      high52w:        d.high_price ?? null,
      low52w:         d.low_price  ?? null,
      sector:         null, earningsGrowth: null, dividendYield: null, isEtf: false,
    },
    source: 'live',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ticker = searchParams.get('ticker')?.trim()
  const market = (searchParams.get('market')?.toUpperCase() ?? 'US') as Market

  if (!ticker)
    return NextResponse.json({ error: '티커를 입력해주세요.' }, { status: 400 })
  if (!['US', 'KR', 'CRYPTO'].includes(market))
    return NextResponse.json({ error: 'market은 US | KR | CRYPTO 중 하나여야 합니다.' }, { status: 400 })

  const k = key(ticker, market)

  // 캐시 히트
  const cached = CACHE.get(k)
  if (cached && Date.now() < cached.expiresAt)
    return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT', 'Cache-Control': 'no-store' } })

  try {
    let info: StockInfo

    if (market === 'KR')     info = await krInfo(ticker)
    else if (market === 'US') info = await usInfo(ticker)
    else                      info = await cryptoInfo(ticker)

    CACHE.set(k, { data: info, expiresAt: Date.now() + CACHE_TTL })

    return NextResponse.json(info, { headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' } })

  } catch (err) {
    // 폴백: 만료된 캐시라도 반환
    const stale = CACHE.get(k)
    if (stale)
      return NextResponse.json(
        { ...stale.data, source: 'cache', error: (err as Error).message },
        { headers: { 'X-Cache': 'FALLBACK', 'Cache-Control': 'no-store' } }
      )

    // 에러 응답
    const msg = (err as Error).message
    return NextResponse.json(
      {
        ticker, market, error: msg,
        name: null, fundamentals: nullFund(), source: 'live',
      },
      { status: 502 }
    )
  }
}
