/**
 * GET /api/market-indices
 * S&P500 / NASDAQ / KOSPI / KOSDAQ 지수 실시간 조회
 * 캐시: 5분 (교육용 — 실시간 불필요)
 */

// 빌드 시 정적 생성 금지 — 무거운 외부 fetch가 빌드 타임아웃을 내고(2026-08-01 실측: SEC·Yahoo 지연으로 빌드 실패) 데이터가 빌드 시점에 박제된다
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchKrIndices, fetchKrIndexMinute, type KrIndexQuote, type IntradayPoint } from '@/lib/krMarketBoard'
import type { Part } from '@/lib/marketBoardShared'

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
      const high      = (meta.regularMarketDayHigh ?? value)    as number
      const low       = (meta.regularMarketDayLow  ?? value)    as number

      // 인트라데이 1분봉 차트 (동일 응답에서 무료로 추출!)
      const timestamps: number[]      = result?.timestamp ?? []
      const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
      // ⚠️ meta.regularMarketOpen 은 지수 응답에 존재하지 않는다(실측 3/3 undefined).
      //    폴백으로 prevClose 를 쓰면 "시가"가 전일종가로 표시되고, 갭 하락일엔
      //    시가 > 고가 라는 물리적으로 불가능한 값이 화면에 나온다(닛케이·KOSPI 실사고).
      //    실제 시가는 같은 응답의 1분봉 open 첫 값 — 추가 호출 없이 얻는다.
      const opens: (number | null)[] = result?.indicators?.quote?.[0]?.open ?? []
      const firstOpen = opens.find(v => v != null && isFinite(v as number)) as number | undefined
      const firstClose = closes.find(v => v != null && isFinite(v as number)) as number | undefined
      const open = (meta.regularMarketOpen as number | undefined)
        ?? firstOpen ?? firstClose ?? prevClose
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

// ─── KOSPI·KOSDAQ 값은 네이버(KR 등락 SSOT)로 ───────────────────────
// ⚠️ 야후 ^KQ11 의 chartPreviousClose 가 휴장 뒤 이틀 전 종가(836.27)라 코스닥 +1.21% 를 +0.98% 로 적었다(2026-09-23 실측).
//    값·등락·시가/고가/저가와 장중 차트를 네이버 polling·분봉으로 덮는다. 네이버가 실패하면 예전처럼 야후 값을 그대로 쓴다.
function withNaver(yahoo: IndexData | null, id: string, name: string, q: KrIndexQuote | undefined, minute: Part<IntradayPoint[]>): IndexData | null {
  if (!q) return yahoo
  const change = q.change ?? yahoo?.change ?? 0
  return {
    id, name, currency: 'KRW',
    value: q.value,
    change,
    changePct: q.changePct ?? yahoo?.changePct ?? 0,
    isUp: change >= 0,
    open: q.open ?? yahoo?.open ?? q.value,
    high: q.high ?? yahoo?.high ?? q.value,
    low: q.low ?? yahoo?.low ?? q.value,
    chartData: minute.ok && minute.data.length ? minute.data : (yahoo?.chartData ?? []),
    updatedAt: new Date().toISOString(),
  }
}

// ─── Route handler ────────────────────────────────────────────────
export async function GET() {
  const cacheKey = 'indices'
  const cached   = CACHE.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } })
  }

  const [sp500, nasdaq, dowjones, nikkei, kospiYf, kosdaqYf, naverQ, kospiMin, kosdaqMin] = await Promise.all([
    fetchYahooIndex('^GSPC',  'sp500',    'S&P 500'),
    fetchYahooIndex('^IXIC',  'nasdaq',   'NASDAQ'),
    fetchYahooIndex('^DJI',   'dowjones', '다우존스'),
    fetchYahooIndex('^N225',  'nikkei',   '닛케이225', 'JPY'),
    fetchYahooIndex('^KS11',  'kospi',    'KOSPI',     'KRW'),  // 네이버 실패 시 폴백
    fetchYahooIndex('^KQ11',  'kosdaq',   'KOSDAQ',    'KRW'),  // 네이버 실패 시 폴백
    fetchKrIndices(),
    fetchKrIndexMinute('KOSPI', 400),    // 1분봉 해상도 유지(야후 1분봉과 같은 촘촘함, 동시호가 포함)
    fetchKrIndexMinute('KOSDAQ', 400),
  ])
  const nq = (code: string) => naverQ.ok ? naverQ.data.find(x => x.code === code) : undefined
  const kospi = withNaver(kospiYf, 'kospi', 'KOSPI', nq('KOSPI'), kospiMin)
  const kosdaq = withNaver(kosdaqYf, 'kosdaq', 'KOSDAQ', nq('KOSDAQ'), kosdaqMin)

  const results = [sp500, nasdaq, dowjones, nikkei, kospi, kosdaq].filter((d): d is IndexData => d !== null)

  if (results.length > 0) {
    CACHE.set(cacheKey, { data: results, expiresAt: Date.now() + CACHE_TTL })
  }

  return NextResponse.json(results, { headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' } })
}
