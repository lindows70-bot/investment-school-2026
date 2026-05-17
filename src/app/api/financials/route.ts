/**
 * GET /api/financials?ticker=NVDA&market=US
 * GET /api/financials?ticker=005930&market=KR
 *
 * 최일 가치분석용 재무 데이터 조회
 * - 과거 5년(실적) + 향후 3년(추정) = 8개년
 * - EPS / 영업이익 / 매출액
 */

import { NextRequest, NextResponse } from 'next/server'

const YF_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}
const NAVER_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Accept: 'application/json',
  Referer: 'https://finance.naver.com/',
}

const raw = (obj: Record<string, { raw?: number }>, k: string): number | null =>
  obj?.[k]?.raw != null ? obj[k].raw! : null

// ── US (Yahoo Finance) ──────────────────────────────────────────────────────
async function fetchUS(ticker: string) {
  const t = ticker.toUpperCase()
  const modules = [
    'incomeStatementHistory',
    'earningsTrend',
    'earningsHistory',
    'defaultKeyStatistics',
    'financialData',
    'summaryDetail',
  ].join(',')

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=${modules}`
  const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`YF ${res.status}`)
  const json = await res.json()
  const r = json?.quoteSummary?.result?.[0]
  if (!r) throw new Error('YF: no result')

  const stats = r.defaultKeyStatistics ?? {}
  const fin   = r.financialData          ?? {}
  const det   = r.summaryDetail          ?? {}

  const shares = raw(stats, 'sharesOutstanding') ?? 1
  const name   = t

  // ── 과거 EPS (earningsHistory)
  const epsHistory: { year: number; eps: number | null }[] = []
  const ehArr = r.earningsHistory?.earningsInfo ?? []
  ehArr.forEach((e: Record<string, { raw?: number; fmt?: string }>) => {
    const dateStr = e?.fiscalDateEnding?.fmt ?? ''
    const year = dateStr ? parseInt(dateStr.slice(0, 4)) : 0
    if (year >= 2018 && year <= 2024) {
      // accumulate by year (quarterly → annual)
      const existing = epsHistory.find(x => x.year === year)
      const v = raw(e as Record<string, { raw?: number }>, 'epsActual')
      if (existing) {
        existing.eps = (existing.eps ?? 0) + (v ?? 0)
      } else {
        epsHistory.push({ year, eps: v })
      }
    }
  })
  // fallback: trailingEps for most recent year
  const trailingEps = raw(stats, 'trailingEps')

  // ── 과거 영업이익 · 매출 (incomeStatementHistory)
  const incArr = r.incomeStatementHistory?.incomeStatementHistory ?? []
  const incomeMap: Record<number, { oi: number | null; rev: number | null }> = {}
  incArr.forEach((e: Record<string, { raw?: number }>) => {
    const yr = e?.endDate?.raw ? new Date((e.endDate.raw as number) * 1000).getFullYear() : 0
    if (yr >= 2018) {
      incomeMap[yr] = {
        oi:  raw(e, 'ebit'),
        rev: raw(e, 'totalRevenue'),
      }
    }
  })

  // ── 미래 추정 (earningsTrend)
  const trendArr = r.earningsTrend?.trend ?? []
  const trendMap: Record<string, { eps: number | null; rev: number | null }> = {}
  trendArr.forEach((e: { period: string; earningsEstimate: Record<string, { raw?: number }>; revenueEstimate: Record<string, { raw?: number }> }) => {
    trendMap[e.period] = {
      eps: raw(e.earningsEstimate, 'avg'),
      rev: raw(e.revenueEstimate, 'avg'),
    }
  })

  const currentYear = new Date().getFullYear()
  const forwardEps  = raw(stats, 'forwardEps') ?? trendMap['0y']?.eps ?? null

  // ── 연도별 배열 조합 (8년: 현재-4 ~ 현재+3)
  const baseYear = currentYear - 4
  const years: string[] = []
  const eps:   (number | null)[] = []
  const oi:    (number | null)[] = []
  const rev:   (number | null)[] = []

  for (let i = 0; i < 8; i++) {
    const y = baseYear + i
    const isEstimate = y > currentYear - 1
    years.push(isEstimate ? `${String(y).slice(2)}(E)` : String(y))

    if (!isEstimate) {
      const epsH = epsHistory.find(x => x.year === y)
      eps.push(epsH?.eps ?? (y === currentYear - 1 ? trailingEps : null))
      oi.push((incomeMap[y]?.oi ?? null) !== null ? (incomeMap[y].oi! / 1e6) : null)  // → M
      rev.push((incomeMap[y]?.rev ?? null) !== null ? (incomeMap[y].rev! / 1e6) : null)
    } else {
      const delta = y - currentYear
      const periodMap: Record<number, string> = { 0: '0y', 1: '+1y', 2: '+2y' }
      const pd = periodMap[delta]
      eps.push(pd ? (trendMap[pd]?.eps ?? (delta === 0 ? forwardEps : null)) : null)
      oi.push(null)   // YF doesn't provide forward OI easily
      rev.push(pd ? (trendMap[pd]?.rev != null ? trendMap[pd].rev! / 1e6 : null) : null)
    }
  }

  return {
    ticker: t,
    name,
    currency: 'USD' as const,
    currentPrice: raw(fin, 'currentPrice') ?? raw(det, 'previousClose') ?? 0,
    marketCap:    raw(det, 'marketCap') ?? 0,
    shares,
    currentPER:   raw(det, 'trailingPE') ?? raw(det, 'forwardPE') ?? null,
    forwardEPS:   forwardEps,
    years,
    eps,
    oi,    // million USD
    rev,   // million USD
    unit:  'M USD',
  }
}

// ── KR (Naver) ──────────────────────────────────────────────────────────────
async function fetchKR(code: string) {
  const [annualRes, forecastRes, basicRes] = await Promise.all([
    fetch(`https://api.stock.naver.com/stock/${code}/finance/annual`, { headers: NAVER_HEADERS, next: { revalidate: 3600 } }),
    fetch(`https://api.stock.naver.com/stock/${code}/finance/forecast`, { headers: NAVER_HEADERS, next: { revalidate: 3600 } }).catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, { headers: NAVER_HEADERS, next: { revalidate: 3600 } }),
  ])

  if (!annualRes.ok) throw new Error(`Naver annual ${annualRes.status}`)
  const annualJson  = await annualRes.json()
  const forecastJson = forecastRes?.ok ? await forecastRes.json() : null
  const basicJson   = basicRes.ok ? await basicRes.json() : {}

  type NaverRow = { title: string; columns: Record<string, { value: string }> }
  const rowList: NaverRow[]    = annualJson?.financeInfo?.rowList    ?? []
  const trTitles: { key: string; isConsensus: string }[] = annualJson?.financeInfo?.trTitleList ?? []
  const forecastRows: NaverRow[] = forecastJson?.financeInfo?.rowList ?? []
  const forecastTitles: { key: string }[] = forecastJson?.financeInfo?.trTitleList ?? []

  const toNum = (s: string): number | null => {
    const n = parseFloat(s.replace(/,/g, ''))
    return isFinite(n) ? n : null
  }
  const getVal = (rows: NaverRow[], title: string, key: string) => {
    const row = rows.find(r => r.title === title || r.title.includes(title))
    return row ? toNum(row.columns?.[key]?.value ?? '') : null
  }

  // 실제 연도 키
  const actualKeys  = trTitles.filter(t => t.isConsensus === 'N').map(t => t.key).sort()
  const fcKeys      = forecastTitles.map(t => t.key).sort()

  const currentYear = new Date().getFullYear()
  const years: string[] = []
  const eps:   (number | null)[] = []
  const oi:    (number | null)[] = []
  const rev:   (number | null)[] = []

  // 과거 5년
  for (let i = 4; i >= 0; i--) {
    const y = currentYear - 1 - i
    const key = actualKeys.find(k => k.startsWith(String(y))) ?? null
    years.push(String(y))
    eps.push(key ? getVal(rowList, 'EPS', key) : null)
    oi.push(key  ? getVal(rowList, '영업이익', key) : null)
    rev.push(key ? getVal(rowList, '매출액', key) : null)
  }

  // 미래 3년 추정
  for (let i = 1; i <= 3; i++) {
    const y = currentYear + i - 1
    const fKey = fcKeys.find(k => k.startsWith(String(y))) ?? null
    years.push(`${String(y).slice(2)}(E)`)
    eps.push(fKey  ? getVal(forecastRows, 'EPS', fKey) : null)
    oi.push(fKey   ? getVal(forecastRows, '영업이익', fKey) : null)
    rev.push(fKey  ? getVal(forecastRows, '매출액', fKey) : null)
  }

  const closeP = typeof basicJson.closePrice === 'string'
    ? parseFloat(basicJson.closePrice.replace(/,/g, '')) : 0
  const mcRaw = basicJson.marketValueFullRaw
  const mc = typeof mcRaw === 'number' ? mcRaw : 0

  return {
    ticker: code,
    name:   basicJson.stockName ?? code,
    currency: 'KRW' as const,
    currentPrice: closeP,
    marketCap: mc,
    shares: mc > 0 && closeP > 0 ? Math.round(mc / closeP) : 0,
    currentPER: typeof basicJson.per === 'number' ? basicJson.per : null,
    forwardEPS: null as number | null,
    years,
    eps,
    oi,    // 억원
    rev,   // 억원
    unit:  '억원',
  }
}

// ── Route ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.trim()
  const market = (req.nextUrl.searchParams.get('market') ?? 'US').toUpperCase()

  if (!ticker) return NextResponse.json({ error: '티커 필요' }, { status: 400 })

  try {
    const data = market === 'KR' ? await fetchKR(ticker) : await fetchUS(ticker)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[financials]', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
