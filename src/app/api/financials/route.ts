/**
 * GET /api/financials?ticker=NVDA&market=US
 * GET /api/financials?ticker=005930&market=KR
 *
 * 서버단 직접 크롤링 (CORS 원천 차단, 모바일 UA 위장)
 * 반환: 과거 5년 + 추정 3년 = 8개년 데이터
 */

import { NextRequest, NextResponse } from 'next/server'

// ── 모바일 UA (차단 회피 최적화) ─────────────────────────────────────────────
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'

const fetchOpts = (extra: HeadersInit = {}): RequestInit => ({
  headers: {
    'User-Agent': MOBILE_UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    ...extra,
  },
  next: { revalidate: 1800 },   // 30분 캐시
})

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const toNum = (v: unknown): number | null => {
  if (v == null) return null
  const n = typeof v === 'object' && v !== null && 'raw' in v
    ? (v as { raw: unknown }).raw
    : v
  const f = typeof n === 'number' ? n : parseFloat(String(n).replace(/,/g, ''))
  return isFinite(f) ? f : null
}

const currentYear = () => new Date().getFullYear()

/** 빈 8개년 구조 */
function mkEmpty(ticker: string, market: 'US' | 'KR') {
  const cy = currentYear()
  const years = Array.from({ length: 8 }, (_, i) => {
    const y = cy - 4 + i
    return y >= cy ? `${String(y).slice(2)}(E)` : String(y)
  })
  return {
    ticker, name: ticker,
    currency: market === 'KR' ? 'KRW' : 'USD',
    currentPrice: 0, marketCap: 0, shares: 0,
    currentPER: null as number | null,
    forwardEPS: null as number | null,
    years,
    eps:  Array<number | null>(8).fill(null),
    oi:   Array<number | null>(8).fill(null),
    rev:  Array<number | null>(8).fill(null),
    unit: market === 'KR' ? '억원' : 'B USD',
    error: null as string | null,
  }
}

// ════════════════════════════════════════════════════════════
//  US — Yahoo Finance v10 직접 크롤링
// ════════════════════════════════════════════════════════════
async function fetchUS(ticker: string) {
  const result = mkEmpty(ticker, 'US')
  const t = ticker.toUpperCase()

  try {
    // ── v10 quoteSummary ─────────────────────────────────────
    const modules = [
      'incomeStatementHistory',
      'earningsTrend',
      'financialData',
      'defaultKeyStatistics',
      'summaryDetail',
      'earningsHistory',
    ].join(',')

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=${modules}&lang=en-US&region=US`

    const res = await fetch(url, fetchOpts({
      Referer: 'https://finance.yahoo.com/',
      Origin:  'https://finance.yahoo.com',
    })).catch(() => null)

    if (!res?.ok) throw new Error(`Yahoo HTTP ${res?.status ?? 'unreachable'}`)

    const json = await res.json().catch(() => null)
    const data = json?.quoteSummary?.result?.[0]
    if (!data) throw new Error('Yahoo: 빈 응답')

    // ── 기본 정보 ────────────────────────────────────────────
    const fin   = data.financialData         ?? {}
    const det   = data.summaryDetail         ?? {}
    const stats = data.defaultKeyStatistics  ?? {}

    result.name         = t
    result.currentPrice = toNum(fin.currentPrice ?? det.previousClose) ?? 0
    result.marketCap    = toNum(det.marketCap) ?? 0
    result.shares       = toNum(stats.sharesOutstanding) ?? 0
    result.currentPER   = toNum(det.trailingPE ?? det.forwardPE)
    result.forwardEPS   = toNum(stats.forwardEps)

    // ── 과거 실적: incomeStatementHistory ────────────────────
    // [0]=최근년도 … [3]=4년전 (내림차순)
    const incArr: unknown[] = data.incomeStatementHistory?.incomeStatementHistory ?? []
    const incMap = new Map<number, { oi: number | null; rev: number | null }>()

    for (const row of incArr) {
      const r = row as Record<string, unknown>
      const yr = r.endDate
        ? new Date((toNum(r.endDate) ?? 0) * 1000).getFullYear()
        : null
      if (!yr) continue
      incMap.set(yr, {
        oi:  toNum((r.ebit as Record<string,unknown>)?.raw ?? r.ebit),
        rev: toNum((r.totalRevenue as Record<string,unknown>)?.raw ?? r.totalRevenue),
      })
    }

    // ── 과거 EPS: earningsHistory ────────────────────────────
    const ehArr: unknown[] = data.earningsHistory?.earningsInfo ?? []
    const epsMapQ = new Map<number, number>()  // 분기 합산 → 연간

    for (const row of ehArr) {
      const r    = row as Record<string, { fmt?: string; raw?: number }>
      const date = r.fiscalDateEnding?.fmt ?? ''
      const yr   = date ? parseInt(date.slice(0, 4)) : 0
      if (!yr) continue
      const eps = toNum(r.epsActual)
      if (eps != null) epsMapQ.set(yr, (epsMapQ.get(yr) ?? 0) + eps)
    }

    // ── 미래 추정: earningsTrend ─────────────────────────────
    const trendArr: unknown[] = data.earningsTrend?.trend ?? []
    const trendMap = new Map<string, { eps: number | null; rev: number | null }>()

    for (const row of trendArr) {
      const r   = row as Record<string, unknown>
      const per = r.period as string
      if (!per) continue
      trendMap.set(per, {
        eps: toNum((r.earningsEstimate as Record<string,unknown>)?.avg ?? null),
        rev: toNum((r.revenueEstimate  as Record<string,unknown>)?.avg ?? null),
      })
    }

    // ── 8개년 배열 조립 ──────────────────────────────────────
    const cy    = currentYear()
    const base  = cy - 4  // 4년 전 ~ 현재-1=실적, 현재~+2=추정

    for (let i = 0; i < 8; i++) {
      const y     = base + i
      const isEst = y >= cy

      if (!isEst) {
        // 과거 실적
        const oi  = incMap.get(y)
        const rev = incMap.get(y)
        // YF 단위: USD (절대값). B USD로 변환
        result.oi[i]  = oi?.oi  != null ? +(oi.oi  / 1e9).toFixed(2) : null
        result.rev[i] = rev?.rev != null ? +(rev.rev / 1e9).toFixed(2) : null

        // EPS: 연간 합산 or trailingEps(최근년도)
        const eps = epsMapQ.get(y)
        if (eps != null) {
          result.eps[i] = +eps.toFixed(2)
        } else if (y === cy - 1) {
          result.eps[i] = toNum(stats.trailingEps) ?? null
        }
      } else {
        // 미래 추정
        const delta  = y - cy   // 0 = 현재년, 1 = 내년, 2 = 2년 후
        const period = delta === 0 ? '0y' : delta === 1 ? '+1y' : null
        const td     = period ? trendMap.get(period) : null

        result.eps[i] = td?.eps ?? (delta === 0 ? result.forwardEPS : null)
        result.oi[i]  = null   // YF 미래 OI 미제공
        result.rev[i] = td?.rev != null ? +(td.rev / 1e9).toFixed(2) : null
      }
    }

  } catch (e) {
    result.error = `US 조회 실패: ${(e as Error).message}`
    console.error('[financials/US]', e)
  }

  return result
}

// ════════════════════════════════════════════════════════════
//  KR — 네이버 증권 모바일 API
// ════════════════════════════════════════════════════════════
async function fetchKR(code: string) {
  const result = mkEmpty(code, 'KR')

  try {
    // ── 기본 정보 ────────────────────────────────────────────
    const basicRes = await fetch(
      `https://m.stock.naver.com/api/stock/${code}/basic`,
      fetchOpts()
    ).catch(() => null)

    if (basicRes?.ok) {
      const b = await basicRes.json().catch(() => ({}))
      result.name         = b.stockName ?? code
      // closePrice는 "284,000" 형태의 문자열일 수 있음
      result.currentPrice = toNum(String(b.closePrice ?? '0').replace(/,/g, '')) ?? 0
      result.marketCap    = toNum(b.marketValueFullRaw ?? b.marketValue?.replace?.(/,/g, '')) ?? 0
      result.currentPER   = toNum(b.per) ?? null

      if (result.currentPrice > 0 && result.marketCap > 0) {
        result.shares = Math.round(result.marketCap / result.currentPrice)
      }
    }

    // ── 연간 확정 실적 ────────────────────────────────────────
    const [annRes, fcRes] = await Promise.allSettled([
      fetch(`https://api.stock.naver.com/stock/${code}/finance/annual`,  fetchOpts()),
      fetch(`https://api.stock.naver.com/stock/${code}/finance/forecast`, fetchOpts()),
    ])

    type NaverRow = { title: string; columns: Record<string, { value: string }> }

    // 확정 데이터 파싱
    const actMap = new Map<string, { eps: number | null; oi: number | null; rev: number | null }>()
    let actualKeys: string[] = []

    if (annRes.status === 'fulfilled' && annRes.value?.ok) {
      const ann = await annRes.value.json().catch(() => null)
      const rows: NaverRow[]  = ann?.financeInfo?.rowList    ?? []
      const cols: { key: string; isConsensus: string }[] = ann?.financeInfo?.trTitleList ?? []

      actualKeys = cols.filter(c => c.isConsensus === 'N').map(c => c.key)

      for (const key of actualKeys) {
        const get = (title: string) => {
          const row = rows.find(r => r.title === title || r.title?.includes(title))
          return row ? toNum(row.columns?.[key]?.value) : null
        }
        actMap.set(key, {
          eps: get('EPS'),
          oi:  get('영업이익'),
          rev: get('매출액'),
        })
      }
    }

    // 추정 데이터 파싱
    const fcMap = new Map<string, { eps: number | null; oi: number | null; rev: number | null }>()
    let fcKeys: string[] = []

    if (fcRes.status === 'fulfilled' && fcRes.value?.ok) {
      const fc   = await fcRes.value.json().catch(() => null)
      const rows: NaverRow[] = fc?.financeInfo?.rowList    ?? []
      const cols: { key: string }[] = fc?.financeInfo?.trTitleList ?? []

      fcKeys = cols.map(c => c.key)

      for (const key of fcKeys) {
        const get = (title: string) => {
          const row = rows.find(r => r.title === title || r.title?.includes(title))
          return row ? toNum(row.columns?.[key]?.value) : null
        }
        fcMap.set(key, {
          eps: get('EPS'),
          oi:  get('영업이익'),
          rev: get('매출액'),
        })
      }
    }

    // ── 8개년 배열 조립 ──────────────────────────────────────
    // 네이버 영업이익·매출 단위: 억원 (EPS: 원)
    // oi/rev 는 억원 그대로 반환 (프론트에서 표시, 주당계산시 ×1e8)
    const cy   = currentYear()
    const base = cy - 4

    for (let i = 0; i < 8; i++) {
      const y     = base + i
      const isEst = y >= cy

      if (!isEst) {
        const key = actualKeys.find(k => k.startsWith(String(y)))
        const d   = key ? actMap.get(key) : null
        result.eps[i] = d?.eps  ?? null
        result.oi[i]  = d?.oi   ?? null
        result.rev[i] = d?.rev  ?? null
      } else {
        const key = fcKeys.find(k => k.startsWith(String(y)))
        const d   = key ? fcMap.get(key) : null
        result.eps[i] = d?.eps  ?? null
        result.oi[i]  = d?.oi   ?? null
        result.rev[i] = d?.rev  ?? null
      }
    }

  } catch (e) {
    result.error = `KR 조회 실패: ${(e as Error).message}`
    console.error('[financials/KR]', e)
  }

  return result
}

// ── Route Handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams
  const ticker = sp.get('ticker')?.trim().toUpperCase() ?? ''
  const market = (sp.get('market')?.toUpperCase() ?? 'US') as 'US' | 'KR'

  if (!ticker) {
    return NextResponse.json({ ...mkEmpty('', 'US'), error: '티커를 입력하세요' }, { status: 400 })
  }

  try {
    const data = market === 'KR' ? await fetchKR(ticker) : await fetchUS(ticker)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (e) {
    console.error('[financials] fatal:', e)
    return NextResponse.json({ ...mkEmpty(ticker, market), error: `서버 오류: ${(e as Error).message}` })
  }
}
