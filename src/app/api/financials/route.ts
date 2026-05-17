/**
 * GET /api/financials?ticker=NVDA&market=US
 * GET /api/financials?ticker=005930&market=KR
 *
 * 최일 가치분석용 재무 데이터 조회
 * - 과거 실적 4~5년 + 향후 3년 추정 = 총 8개년
 * - EPS / 영업이익 / 매출액
 * - 전체 try-catch 방어 → API 실패 시 빈 구조 반환 (앱 크래시 방지)
 */

import { NextRequest, NextResponse } from 'next/server'

// ── 공통 헤더 (브라우저 위장) ─────────────────────────────────────────────────
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// (YF_HEADERS는 yahoo-finance2 라이브러리가 내부 처리하므로 Naver 전용만 사용)
const NAVER_HEADERS: HeadersInit = {
  'User-Agent': BROWSER_UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://m.stock.naver.com/',
}

// ── 빈 결과 구조 (API 실패 시 반환) ─────────────────────────────────────────
function emptyResult(ticker: string, market: string) {
  const currentYear = new Date().getFullYear()
  const baseYear = currentYear - 4
  const years = Array.from({ length: 8 }, (_, i) => {
    const y = baseYear + i
    return y >= currentYear ? `${String(y).slice(2)}(E)` : String(y)
  })
  return {
    ticker,
    name: ticker,
    currency: market === 'KR' ? 'KRW' : 'USD',
    currentPrice: 0,
    marketCap: 0,
    shares: 0,
    currentPER: null as number | null,
    forwardEPS: null as number | null,
    years,
    eps:  Array(8).fill(null),
    oi:   Array(8).fill(null),
    rev:  Array(8).fill(null),
    unit: market === 'KR' ? '억원' : 'M USD',
    error: null as string | null,
  }
}

// ── 숫자 변환 헬퍼 ────────────────────────────────────────────────────────────
const safeRaw = (obj: unknown, key: string): number | null => {
  if (!obj || typeof obj !== 'object') return null
  const v = (obj as Record<string, { raw?: number }>)[key]?.raw
  return typeof v === 'number' && isFinite(v) ? v : null
}
const safeNum = (v: unknown): number | null => {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  return isFinite(n) ? n : null
}

// ═══════════════════════════════════════════════════════════════
//  US — yahoo-finance2 (서버사이드 라이브러리, CORS 없음)
// ═══════════════════════════════════════════════════════════════
async function fetchUS(ticker: string) {
  const result = emptyResult(ticker, 'US')

  try {
    // 방법 1: yahoo-finance2 라이브러리 사용 (가장 안정적)
    const { default: yf } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yfinance = new (yf as any)({ suppressNotices: ['yahooSurvey'] })

    const [summary, historical] = await Promise.allSettled([
      yfinance.quoteSummary(ticker, {
        modules: [
          'defaultKeyStatistics',
          'financialData',
          'summaryDetail',
          'earningsTrend',
          'incomeStatementHistory',
          'earningsHistory',
        ],
      }),
      yfinance.historical(ticker, {
        period1: `${new Date().getFullYear() - 5}-01-01`,
        period2: new Date().toISOString().slice(0, 10),
        interval: '1mo',
      }),
    ])

    if (summary.status === 'rejected') {
      result.error = `Yahoo Finance 조회 실패: ${summary.reason?.message ?? 'unknown'}`
      return result
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = summary.value ?? {}
    const stats  = s.defaultKeyStatistics ?? {}
    const fin    = s.financialData         ?? {}
    const det    = s.summaryDetail         ?? {}

    result.name         = ticker
    result.currentPrice = fin.currentPrice?.raw ?? det.previousClose?.raw ?? 0
    result.marketCap    = det.marketCap?.raw ?? 0
    result.shares       = stats.sharesOutstanding?.raw ?? 0
    result.currentPER   = det.trailingPE?.raw ?? det.forwardPE?.raw ?? null
    result.forwardEPS   = stats.forwardEps?.raw ?? null

    const currentYear = new Date().getFullYear()
    const baseYear    = currentYear - 4

    // 과거 실적 — incomeStatementHistory
    const incomeArr = s.incomeStatementHistory?.incomeStatementHistory ?? []
    const incomeMap: Record<number, { oi: number | null; rev: number | null }> = {}
    for (const row of incomeArr) {
      const yr = row?.endDate?.raw ? new Date(row.endDate.raw * 1000).getFullYear() : null
      if (yr && yr >= baseYear) {
        incomeMap[yr] = {
          oi:  safeRaw(row, 'ebit'),
          rev: safeRaw(row, 'totalRevenue'),
        }
      }
    }

    // 과거 EPS — earningsHistory (연간 합산)
    const epsMap: Record<number, number> = {}
    const ehArr = s.earningsHistory?.earningsInfo ?? []
    for (const row of ehArr) {
      const dateStr = row?.fiscalDateEnding?.fmt ?? ''
      const yr = dateStr ? parseInt(dateStr.slice(0, 4)) : 0
      if (yr >= baseYear && yr <= currentYear) {
        const v = row?.epsActual?.raw
        if (typeof v === 'number') epsMap[yr] = (epsMap[yr] ?? 0) + v
      }
    }
    // trailing EPS fallback
    const trailingEps = stats.trailingEps?.raw ?? null

    // 미래 추정 — earningsTrend
    const trendMap: Record<string, { eps: number | null; rev: number | null }> = {}
    for (const row of (s.earningsTrend?.trend ?? [])) {
      trendMap[row.period ?? ''] = {
        eps: row.earningsEstimate?.avg?.raw ?? null,
        rev: row.revenueEstimate?.avg?.raw ?? null,
      }
    }

    // 8년 배열 조합
    for (let i = 0; i < 8; i++) {
      const y         = baseYear + i
      const isEst     = y >= currentYear
      result.years[i] = isEst ? `${String(y).slice(2)}(E)` : String(y)

      if (!isEst) {
        result.eps[i] = epsMap[y] != null ? Math.round(epsMap[y] * 100) / 100
                      : (y === currentYear - 1 ? trailingEps : null)
        const oi  = incomeMap[y]?.oi
        const rev = incomeMap[y]?.rev
        result.oi[i]  = oi  != null ? Math.round(oi  / 1e4) / 100 : null   // → M
        result.rev[i] = rev != null ? Math.round(rev / 1e4) / 100 : null
      } else {
        const delta = y - currentYear
        const periodMap: Record<number, string> = { 0: '0y', 1: '+1y', 2: '+2y' }
        const pd = periodMap[delta] ?? ''
        result.eps[i] = trendMap[pd]?.eps ?? (delta === 0 ? result.forwardEPS : null)
        result.oi[i]  = null
        result.rev[i] = trendMap[pd]?.rev != null
          ? Math.round(trendMap[pd].rev! / 1e4) / 100 : null
      }
    }

    // 히스토리컬로 현재가 보완
    if (result.currentPrice === 0 && historical.status === 'fulfilled') {
      const last = historical.value?.at(-1)
      if (last?.close) result.currentPrice = last.close
    }

  } catch (e) {
    result.error = `US 데이터 파싱 오류: ${(e as Error).message}`
    console.error('[financials/US]', e)
  }

  return result
}

// ═══════════════════════════════════════════════════════════════
//  KR — Naver Finance (네이버 모바일 API)
// ═══════════════════════════════════════════════════════════════
async function fetchKR(code: string) {
  const result = emptyResult(code, 'KR')

  try {
    // 기본 정보
    const basicRes = await fetch(
      `https://m.stock.naver.com/api/stock/${code}/basic`,
      { headers: NAVER_HEADERS, next: { revalidate: 3600 } }
    ).catch(() => null)

    if (basicRes?.ok) {
      const basic = await basicRes.json().catch(() => ({}))
      result.name         = basic.stockName ?? code
      result.currentPrice = safeNum(basic.closePrice?.replace?.(/,/g, '') ?? basic.closePrice) ?? 0
      result.marketCap    = safeNum(basic.marketValueFullRaw) ?? 0
      if (result.currentPrice > 0 && result.marketCap > 0) {
        result.shares = Math.round(result.marketCap / result.currentPrice)
      }
      result.currentPER = safeNum(basic.per) ?? null
    }

    // 연간 재무 (과거)
    const annualRes = await fetch(
      `https://api.stock.naver.com/stock/${code}/finance/annual`,
      { headers: NAVER_HEADERS, next: { revalidate: 3600 } }
    ).catch(() => null)

    // 컨센서스 (미래)
    const fcRes = await fetch(
      `https://api.stock.naver.com/stock/${code}/finance/forecast`,
      { headers: NAVER_HEADERS, next: { revalidate: 3600 } }
    ).catch(() => null)

    type NaverRow = { title: string; columns: Record<string, { value: string }> }
    type TrTitle  = { key: string; isConsensus: string }

    let actualKeys:  string[] = []
    let fcKeys:      string[] = []
    let rowList:     NaverRow[] = []
    let fcRowList:   NaverRow[] = []

    if (annualRes?.ok) {
      const json = await annualRes.json().catch(() => null)
      rowList    = json?.financeInfo?.rowList    ?? []
      actualKeys = (json?.financeInfo?.trTitleList as TrTitle[] ?? [])
        .filter(t => t.isConsensus === 'N').map(t => t.key).sort()
    }

    if (fcRes?.ok) {
      const json  = await fcRes.json().catch(() => null)
      fcRowList   = json?.financeInfo?.rowList   ?? []
      fcKeys      = (json?.financeInfo?.trTitleList ?? []).map((t: TrTitle) => t.key).sort()
    }

    const getVal = (rows: NaverRow[], titleKw: string, key: string): number | null => {
      const row = rows.find(r => r.title === titleKw || r.title?.includes(titleKw))
      if (!row) return null
      return safeNum(row.columns?.[key]?.value)
    }

    const currentYear = new Date().getFullYear()
    const baseYear    = currentYear - 4

    for (let i = 0; i < 8; i++) {
      const y     = baseYear + i
      const isEst = y >= currentYear
      result.years[i] = isEst ? `${String(y).slice(2)}(E)` : String(y)

      if (!isEst) {
        const key = actualKeys.find(k => k.startsWith(String(y))) ?? null
        result.eps[i] = key ? getVal(rowList, 'EPS', key) : null
        result.oi[i]  = key ? getVal(rowList, '영업이익', key) : null
        result.rev[i] = key ? getVal(rowList, '매출액', key) : null
      } else {
        const fk = fcKeys.find(k => k.startsWith(String(y))) ?? null
        result.eps[i] = fk ? getVal(fcRowList, 'EPS', fk) : null
        result.oi[i]  = fk ? getVal(fcRowList, '영업이익', fk) : null
        result.rev[i] = fk ? getVal(fcRowList, '매출액', fk) : null
      }
    }

  } catch (e) {
    result.error = `KR 데이터 파싱 오류: ${(e as Error).message}`
    console.error('[financials/KR]', e)
  }

  return result
}

// ── Route Handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.trim()?.toUpperCase()
  const market = (req.nextUrl.searchParams.get('market') ?? 'US').toUpperCase() as 'US' | 'KR'

  if (!ticker) {
    return NextResponse.json(
      { ...emptyResult('', 'US'), error: '티커를 입력하세요' },
      { status: 400 }
    )
  }

  try {
    const data = market === 'KR' ? await fetchKR(ticker) : await fetchUS(ticker)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (e) {
    console.error('[financials] fatal:', e)
    return NextResponse.json(
      { ...emptyResult(ticker, market), error: `서버 오류: ${(e as Error).message}` }
    )
  }
}
