/**
 * GET /api/stock-price-history?ticker=X&market=Y
 *
 * 피터 린치 이익선 차트 전용 — 연도별 평균 주가 반환 (최근 5년)
 *
 * US:  Yahoo Finance v8  range=5y interval=1mo → 60개 월봉
 * KR:  Naver fchart      timeframe=month count=60 → 60개 월봉
 *
 * 응답: { yearPrices: { '2021': 137.5, '2022': 155.2, ... } }
 */

import { NextRequest, NextResponse } from 'next/server'

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:   'application/json, text/plain, */*',
  Referer:  'https://finance.yahoo.com/',
  Origin:   'https://finance.yahoo.com',
}

// ── US: Yahoo v8 5년 월봉 → 연도별 평균가 ────────────────────────
async function getUsYearPrices(ticker: string): Promise<Record<string, number>> {
  for (const host of ['query1', 'query2'] as const) {
    try {
      const url =
        `https://${host}.finance.yahoo.com/v8/finance/chart/` +
        `${encodeURIComponent(ticker)}?range=5y&interval=1mo&includePrePost=false`

      const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } })
      if (!res.ok) continue

      const json   = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) continue

      const timestamps: number[]          = result.timestamp ?? []
      const closes: (number | null)[]     = result.indicators?.quote?.[0]?.close ?? []
      const adjCloses: (number | null)[]  = result.indicators?.adjclose?.[0]?.adjclose ?? []

      const yearMap: Record<string, number[]> = {}

      for (let i = 0; i < timestamps.length; i++) {
        // adjclose 우선, fallback close
        const v = (adjCloses[i] ?? closes[i])
        if (v == null || !isFinite(v) || v <= 0) continue
        const yr = new Date(timestamps[i] * 1000).getFullYear().toString()
        if (!yearMap[yr]) yearMap[yr] = []
        yearMap[yr].push(v)
      }

      const yearPrices: Record<string, number> = {}
      Object.entries(yearMap).forEach(([yr, prices]) => {
        yearPrices[yr] = prices.reduce((a, b) => a + b, 0) / prices.length
      })
      return yearPrices

    } catch { /* 다음 host */ }
  }
  return {}
}

// ── KR: Naver fchart 60개월 → 연도별 평균가 ─────────────────────
async function getKrYearPrices(ticker: string): Promise<Record<string, number>> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '')
  const url  =
    `https://fchart.stock.naver.com/sise.nhn` +
    `?symbol=${code}&timeframe=month&count=60&requestType=0`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return {}
    const xml = await res.text()

    const yearMap: Record<string, number[]> = {}
    const re = /data="([^"]+)"/g
    let m: RegExpExecArray | null

    while ((m = re.exec(xml)) !== null) {
      const parts = m[1].split('|')
      if (parts.length < 5) continue
      const dateStr = parts[0]   // YYYYMMDD
      const close   = parseFloat(parts[4])
      if (!close || !isFinite(close) || close <= 0) continue
      const yr = dateStr.slice(0, 4)
      if (!yearMap[yr]) yearMap[yr] = []
      yearMap[yr].push(close)
    }

    const yearPrices: Record<string, number> = {}
    Object.entries(yearMap).forEach(([yr, prices]) => {
      yearPrices[yr] = prices.reduce((a, b) => a + b, 0) / prices.length
    })
    return yearPrices

  } catch { return {} }
}

// ── CRYPTO: 업비트 월봉(KRW) 72개월 → 연도별 평균가 ───────────────
// 무료·무인증 공개 API. 월봉은 1회 호출로 6년치(=72개) 반환 → 페이지네이션 불필요
async function getCryptoYearPrices(ticker: string): Promise<Record<string, number>> {
  const market = `KRW-${ticker.toUpperCase().replace(/^KRW-/, '')}`
  try {
    const res = await fetch(`https://api.upbit.com/v1/candles/months?market=${market}&count=72`, { next: { revalidate: 3600 } })
    if (!res.ok) return {}
    const arr = await res.json() as { candle_date_time_kst: string; trade_price: number }[]
    const yearMap: Record<string, number[]> = {}
    for (const c of arr) {
      const close = c.trade_price
      if (!close || !isFinite(close) || close <= 0) continue
      const yr = c.candle_date_time_kst.slice(0, 4)
      if (!yearMap[yr]) yearMap[yr] = []
      yearMap[yr].push(close)
    }
    const yearPrices: Record<string, number> = {}
    Object.entries(yearMap).forEach(([yr, prices]) => { yearPrices[yr] = prices.reduce((a, b) => a + b, 0) / prices.length })
    return yearPrices
  } catch { return {} }
}

// ── GET 핸들러 ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ticker = searchParams.get('ticker')?.trim()
  const market = (searchParams.get('market')?.toUpperCase() ?? 'US') as string

  if (!ticker) {
    return NextResponse.json({ error: 'ticker 파라미터 필요' }, { status: 400 })
  }

  try {
    let yearPrices: Record<string, number> = {}

    if (market === 'KR') {
      yearPrices = await getKrYearPrices(ticker)
    } else if (market === 'US') {
      yearPrices = await getUsYearPrices(ticker)
    } else if (market === 'CRYPTO') {
      yearPrices = await getCryptoYearPrices(ticker)   // 업비트 월봉(KRW)
    }

    return NextResponse.json(
      { yearPrices },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    return NextResponse.json(
      { yearPrices: {}, error: (e as Error).message },
      { status: 500 }
    )
  }
}
