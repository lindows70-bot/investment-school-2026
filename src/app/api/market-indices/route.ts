/**
 * GET /api/market-indices
 * S&P500 / NASDAQ / KOSPI / KOSDAQ 지수 실시간 조회
 * 캐시: 5분 (교육용 — 실시간 불필요)
 */

import { NextResponse } from 'next/server'

export interface IndexData {
  id:        string    // 'sp500' | 'nasdaq' | 'dowjones' | 'nikkei' | 'kospi' | 'kosdaq'
  name:      string    // 표시 이름
  value:     number    // 현재 지수 값
  change:    number    // 전일 대비 변화량
  changePct: number    // 전일 대비 변화율 (%)
  isUp:      boolean
  currency:  'USD' | 'KRW' | 'JPY'
  open:      number    // 시가
  high:      number    // 고가
  low:       number    // 저가
  chartData: { t: number; v: number }[]  // 인트라데이 1분봉
  updatedAt: string
}

const CACHE = new Map<string, { data: IndexData[]; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000   // 5분

// ─── Yahoo Finance 미국/한국/일본 지수 ───────────────────────────
const YF_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}

async function fetchYahooIndex(
  ticker: string, id: string, name: string,
  currency: 'USD' | 'JPY' | 'KRW' = 'USD'
): Promise<IndexData | null> {
  for (const host of ['query1', 'query2'] as const) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1m&includePrePost=false`
      const res = await fetch(url, { headers: YF_H, next: { revalidate: 0 } })
      if (!res.ok) continue

      const json   = await res.json()
      const result = json?.chart?.result?.[0]
      const meta   = result?.meta
      if (!meta?.regularMarketPrice) continue

      const value     = meta.regularMarketPrice   as number
      const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? value) as number
      const change    = value - prevClose
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
      const open      = (meta.regularMarketOpen    ?? prevClose) as number
      const high      = (meta.regularMarketDayHigh ?? value)    as number
      const low       = (meta.regularMarketDayLow  ?? value)    as number

      // 인트라데이 1분봉 차트 (동일 응답에서 무료로 추출!)
      const timestamps: number[]      = result?.timestamp ?? []
      const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
      const chartData = timestamps
        .map((t, i) => ({ t: t * 1000, v: closes[i] }))
        .filter((p): p is { t: number; v: number } =>
          p.v !== null && p.v !== undefined && isFinite(p.v as number)
        )

      return {
        id, name, value, change, changePct, isUp: change >= 0,
        currency, open, high, low, chartData,
        updatedAt: new Date().toISOString(),
      }
    } catch { continue }
  }
  return null
}

// ─── Route handler ────────────────────────────────────────────────
export async function GET() {
  const cacheKey = 'indices'
  const cached   = CACHE.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } })
  }

  const [sp500, nasdaq, dowjones, nikkei, kospi, kosdaq] = await Promise.all([
    fetchYahooIndex('^GSPC',  'sp500',    'S&P 500'),
    fetchYahooIndex('^IXIC',  'nasdaq',   'NASDAQ'),
    fetchYahooIndex('^DJI',   'dowjones', '다우존스'),
    fetchYahooIndex('^N225',  'nikkei',   '닛케이225', 'JPY'),
    fetchYahooIndex('^KS11',  'kospi',    'KOSPI',     'KRW'),  // Naver→Yahoo로 교체 (차트 지원)
    fetchYahooIndex('^KQ11',  'kosdaq',   'KOSDAQ',    'KRW'),  // Naver→Yahoo로 교체 (차트 지원)
  ])

  const results = [sp500, nasdaq, dowjones, nikkei, kospi, kosdaq].filter((d): d is IndexData => d !== null)

  if (results.length > 0) {
    CACHE.set(cacheKey, { data: results, expiresAt: Date.now() + CACHE_TTL })
  }

  return NextResponse.json(results, { headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' } })
}
