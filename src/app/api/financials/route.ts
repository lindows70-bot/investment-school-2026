/**
 * GET /api/financials?ticker=NVDA&market=US
 * GET /api/financials?ticker=005930&market=KR
 *
 * ─── Next.js 캐시 완전 비활성화 ─────────────────────────────────────────────
 */
export const dynamic    = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

// yahoo-finance2: 다른 API routes 와 동일하게 동적 import (HMR 충돌 방지)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getYF(): Promise<any> {
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
}

// ── 모바일 User-Agent (네이버 봇 차단 우회) ──────────────────────────────────
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// ── 연도 키 배열 생성 ─────────────────────────────────────────────────────────
// cy=2026 → ["2021","2022","2023","2024","2025","2026E","2027E","2028E"]
function makeYearKeys(cy = new Date().getFullYear()): string[] {
  return Array.from({ length: 8 }, (_, i) => {
    const y = cy - 5 + i
    return y >= cy ? `${y}E` : String(y)
  })
}

// ── 숫자 변환 헬퍼: 어떤 타입이든 number, 실패 시 0 ──────────────────────────
function toNum(v: unknown): number {
  if (v == null) return 0
  const raw =
    typeof v === 'object' && v !== null && 'raw' in v
      ? (v as { raw: unknown }).raw
      : v
  const f = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''))
  return isFinite(f) ? f : 0
}

// ── 네이버 컬럼 키 → 연도 추출 ────────────────────────────────────────────────
// "202312" → year: 2023
// "202412" → year: 2024
// isEst 는 isConsensus 값으로 별도 판단 (키 자체에 'E' 없음)
function extractNaverYear(key: string): number | null {
  const m = key.match(/^(\d{4})/)
  if (!m) return null
  const yr = parseInt(m[1], 10)
  return yr > 2000 && yr < 2100 ? yr : null
}

// ── 빈 응답 뼈대 ─────────────────────────────────────────────────────────────
function makeShell(ticker: string, market: 'US' | 'KR') {
  const yearKeys = makeYearKeys()
  const financials: Record<string, { eps: number; operatingProfit: number; revenue: number }> = {}
  yearKeys.forEach(y => { financials[y] = { eps: 0, operatingProfit: 0, revenue: 0 } })
  return {
    success:      false as boolean,
    error:        null  as string | null,
    ticker,
    companyName:  ticker,
    currency:     (market === 'KR' ? 'KRW' : 'USD') as 'KRW' | 'USD',
    // KR: 영업이익·매출은 억원 단위로 반환 (프론트에서 ×1e8 → 적정주가 계산)
    // US: M USD 단위
    unit:         market === 'KR' ? '억원' : 'M USD',
    currentPrice: 0,
    marketCap:    0,
    shares:       0,
    currentPER:   0,
    yearKeys,
    financials,
  }
}

// ════════════════════════════════════════════════════════════════════════════════
//  US — yahoo-finance2 v3 (크럼·쿠키·429 자동 처리)
// ════════════════════════════════════════════════════════════════════════════════
async function fetchUS(ticker: string) {
  const result = makeShell(ticker, 'US')

  console.log('[fetchUS] 조회 시작:', ticker)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d: any

  try {
    const yf = await getYF()
    d = await yf.quoteSummary(ticker, {
      modules: [
        'incomeStatementHistory',
        'earningsTrend',
        'earningsHistory',
        'defaultKeyStatistics',
        'summaryDetail',
        'financialData',
      ],
    })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    console.error('[fetchUS] 오류:', msg)
    if (msg.includes('No fundamentals') || msg.includes('Not Found') || msg.includes('404')) {
      throw new Error(
        `"${ticker}"은(는) Yahoo Finance에 존재하지 않는 티커입니다. ` +
        '정확한 영문 대문자 티커를 입력해 주세요 (예: NVDA, AAPL, MSFT).'
      )
    }
    if (msg.includes('429') || msg.includes('Too Many')) {
      throw new Error('Yahoo Finance 일시적 접근 제한. 잠시 후 다시 시도해 주세요.')
    }
    throw new Error(`Yahoo Finance 조회 실패: ${msg}`)
  }

  if (!d) throw new Error(`"${ticker}" 데이터를 찾을 수 없습니다.`)

  // ── 기본 정보 ────────────────────────────────────────────────────────────
  const stats = d.defaultKeyStatistics ?? {}
  const det   = d.summaryDetail         ?? {}
  const finD  = d.financialData         ?? {}

  result.companyName  = ticker
  result.currentPrice = toNum(finD?.currentPrice   ?? det?.previousClose)
  result.marketCap    = toNum(det?.marketCap)
  result.shares       = toNum(stats?.sharesOutstanding)
  result.currentPER   = toNum(det?.trailingPE ?? det?.forwardPE)
  result.success      = true

  const cy       = new Date().getFullYear()
  const yearKeys = makeYearKeys(cy)
  result.yearKeys = yearKeys

  const sharesOut = result.shares > 0 ? result.shares : 1

  // ── 연간 실적: incomeStatementHistory ────────────────────────────────────
  // Yahoo Finance Nov 2024 이후 ebit/operatingIncome = 0 (deprecated)
  // 현재 유효 필드: totalRevenue, netIncome 만 신뢰
  const isRows: Array<{
    endDate: Date
    totalRevenue: number
    netIncome: number
  }> = d?.incomeStatementHistory?.incomeStatementHistory ?? []

  // year → { rev(M USD), netIncome(USD) }
  const histByYear = new Map<number, { rev: number; netIncome: number }>()

  for (const row of isRows) {
    try {
      const yr  = row.endDate instanceof Date
        ? row.endDate.getFullYear()
        : new Date(toNum(row.endDate) * 1000).getFullYear()
      const rev = typeof row.totalRevenue === 'number' ? row.totalRevenue : 0
      const ni  = typeof row.netIncome    === 'number' ? row.netIncome    : 0
      if (yr > 2000) {
        histByYear.set(yr, {
          rev: rev > 0 ? +(rev / 1e6).toFixed(2) : 0,
          netIncome: ni,
        })
      }
    } catch { /* 건너뜀 */ }
  }

  // ── EPS 분기 합산: earningsHistory ───────────────────────────────────────
  // v3 타입: .history 배열, quarter=Date 객체, epsActual=직접 number
  const ehRows: Array<{
    quarter: Date | null
    epsActual: number | null
  }> = d?.earningsHistory?.history ?? []

  const epsByYear = new Map<number, number>()

  for (const row of ehRows) {
    try {
      if (!row.quarter || typeof row.epsActual !== 'number') continue
      const yr = row.quarter instanceof Date
        ? row.quarter.getFullYear()
        : new Date(String(row.quarter)).getFullYear()
      if (yr > 2000 && isFinite(row.epsActual)) {
        epsByYear.set(yr, (epsByYear.get(yr) ?? 0) + row.epsActual)
      }
    } catch { /* 건너뜀 */ }
  }

  // ── 미래 추정: earningsTrend ─────────────────────────────────────────────
  // v3 타입: period="0y"|"+1y"|"+2y", earningsEstimate.avg/revenueEstimate.avg=number
  const trRows: Array<{
    period: string
    earningsEstimate: { avg: number | null }
    revenueEstimate:  { avg: number | null }
  }> = d?.earningsTrend?.trend ?? []

  const trendMap = new Map<string, { eps: number; rev: number }>()

  for (const row of trRows) {
    try {
      const period = row.period ?? ''
      if (!period) continue
      const epsVal = row.earningsEstimate?.avg ?? 0
      const revVal = row.revenueEstimate?.avg  ?? 0
      trendMap.set(period, {
        eps: typeof epsVal === 'number' && isFinite(epsVal) ? epsVal : 0,
        rev: typeof revVal === 'number' && revVal > 0
          ? +(revVal / 1e6).toFixed(2) : 0,
      })
    } catch { /* 건너뜀 */ }
  }

  console.log('[fetchUS] histByYear:', Array.from(histByYear.keys()))
  console.log('[fetchUS] epsByYear:', Array.from(epsByYear.entries()))
  console.log('[fetchUS] trendMap:', Array.from(trendMap.keys()))

  // ── 8개년 financials 조립 ─────────────────────────────────────────────────
  const fin: typeof result.financials = {}

  for (const key of yearKeys) {
    const isEst = key.endsWith('E')
    const yr    = parseInt(key, 10)

    if (!isEst) {
      const hist = histByYear.get(yr)

      // EPS 우선순위:
      // 1) earningsHistory 분기 합산 (실제 분기별 EPS)
      // 2) netIncome ÷ sharesOutstanding (Yahoo API 폐기 이후 근사값)
      // 3) trailingEps (가장 최근 확정 연도 override)
      const epsFromHist   = epsByYear.get(yr)
      const epsFromNI     = hist?.netIncome && hist.netIncome > 0
        ? +(hist.netIncome / sharesOut).toFixed(2)
        : 0
      const epsBase       = typeof epsFromHist === 'number' && epsFromHist !== 0
        ? +(epsFromHist).toFixed(2)
        : epsFromNI

      const isMostRecent  = hist && yr === Math.max(...Array.from(histByYear.keys()))
      const trailingEps   = toNum(stats?.trailingEps)
      const finalEps      = (isMostRecent && trailingEps > 0) ? trailingEps : epsBase

      fin[key] = {
        eps:             finalEps,
        operatingProfit: 0,    // Yahoo Nov 2024 이후 ebit 데이터 미제공
        revenue:         hist?.rev ?? 0,
      }
    } else {
      // 추정 연도: delta=0→"0y", 1→"+1y", 2→"+2y"
      const delta   = yr - cy
      const pMap: Record<number, string> = { 0: '0y', 1: '+1y', 2: '+2y' }
      const td      = trendMap.get(pMap[delta] ?? '')
      const fwdEps  = toNum(stats?.forwardEps)
      fin[key] = {
        eps:             td?.eps && td.eps > 0 ? td.eps : (delta === 0 ? fwdEps : 0),
        operatingProfit: 0,
        revenue:         td?.rev ?? 0,
      }
    }
  }

  console.log('[fetchUS] EPS 결과:', yearKeys.map(k => `${k}:${fin[k].eps}`).join(', '))

  result.financials = fin
  return result
}

// ════════════════════════════════════════════════════════════════════════════════
//  KR — 네이버 증권 모바일 API (m.stock.naver.com)
//
//  ※ 영업이익·매출 단위 정책:
//     Naver API 원본 → 억원 단위
//     프론트엔드 적정주가 계산: oi_억원 × 1e8 ÷ shares = 원/주
//     따라서 백엔드는 억원 그대로 반환, 프론트에서 ×1e8 처리
// ════════════════════════════════════════════════════════════════════════════════
async function fetchKR(code: string) {
  const result = makeShell(code, 'KR')

  const naverOpt: RequestInit = {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      Referer: 'https://m.stock.naver.com/',
    },
    cache: 'no-store',
  }

  // ── 기본 정보 (현재가·PER·시가총액) ──────────────────────────────────────
  let basicRes: Response
  try {
    basicRes = await fetch(
      `https://m.stock.naver.com/api/stock/${code}/basic`,
      naverOpt
    )
  } catch (e) {
    throw new Error(`네이버 증권 네트워크 오류: ${(e as Error).message}`)
  }

  if (basicRes.status === 404) {
    throw new Error(
      `"${code}"은(는) 네이버 증권에 없는 종목코드입니다. ` +
      '6자리 숫자를 정확히 입력해 주세요 (예: 005930, 000660, 035420).'
    )
  }
  if (!basicRes.ok) {
    throw new Error(`네이버 증권 basic API HTTP ${basicRes.status} 오류`)
  }

  let b: Record<string, unknown>
  try { b = await basicRes.json() } catch {
    throw new Error('네이버 증권 기본 정보 파싱 실패')
  }

  if (!b.stockName) {
    throw new Error(`"${code}" 종목 기본 정보 없음. 종목코드를 다시 확인해 주세요.`)
  }

  result.companyName  = String(b.stockName)
  result.currentPrice = parseFloat(String(b.closePrice ?? '0').replace(/,/g, '')) || 0
  result.marketCap    = toNum(b.marketValueFullRaw)
  result.currentPER   = toNum(b.per)
  if (result.currentPrice > 0 && result.marketCap > 0) {
    result.shares = Math.round(result.marketCap / result.currentPrice)
  }
  result.success = true

  console.log('[fetchKR] 기본 정보:', result.companyName, '현재가:', result.currentPrice)

  // ── 연간 재무 (확정 + 컨센서스 추정) ─────────────────────────────────────
  // m.stock.naver.com/api/stock/{code}/finance/annual 한 개 엔드포인트에
  // isConsensus:'N' (확정) 과 isConsensus:'Y' (추정) 이 모두 포함됨
  const annRes = await fetch(
    `https://m.stock.naver.com/api/stock/${code}/finance/annual`,
    naverOpt
  ).catch(() => null)

  if (!annRes?.ok) {
    // 재무 데이터 없어도 기본 정보는 이미 성공했으니 빈 financials 반환
    console.warn('[fetchKR] annual API 실패:', annRes?.status)
    result.yearKeys = makeYearKeys()
    result.yearKeys.forEach(y => { result.financials[y] = { eps: 0, operatingProfit: 0, revenue: 0 } })
    return result
  }

  type NaverRow  = { title: string; columns: Record<string, { value: string }> }
  type NaverMeta = { key: string; isConsensus?: string }

  let ann: { financeInfo?: { rowList?: NaverRow[]; trTitleList?: NaverMeta[] } } | null = null
  try { ann = await annRes.json() } catch { ann = null }

  const rows = ann?.financeInfo?.rowList    ?? []
  const cols = ann?.financeInfo?.trTitleList ?? []

  console.log('[fetchKR] 컬럼 목록:', cols.map(c => `${c.key}(${c.isConsensus})`).join(', '))

  // ── 셀 값 추출 헬퍼 ──────────────────────────────────────────────────────
  // rows 배열에서 title 이 일치하는 행을 찾아 특정 연도 컬럼의 value 반환
  const getCell = (title: string, colKey: string): number => {
    try {
      const row = rows.find(r =>
        r.title === title || r.title?.startsWith(title) || r.title?.includes(title)
      )
      if (!row) return 0
      const raw = row.columns?.[colKey]?.value
      if (!raw || raw.trim() === '-' || raw.trim() === '') return 0
      return parseFloat(raw.replace(/,/g, '')) || 0
    } catch { return 0 }
  }

  // ── 확정·추정 데이터를 연도별 Map 으로 분류 ──────────────────────────────
  // actByYear: isConsensus=N (확정)  /  fcByYear: isConsensus=Y (추정)
  const actByYear = new Map<number, { eps: number; oi: number; rev: number }>()
  const fcByYear  = new Map<number, { eps: number; oi: number; rev: number }>()

  for (const col of cols) {
    const yr = extractNaverYear(col.key)
    if (!yr) continue

    const entry = {
      eps: getCell('EPS',    col.key),   // 원/주
      oi:  getCell('영업이익', col.key),  // 억원
      rev: getCell('매출액',  col.key),   // 억원
    }

    if (col.isConsensus === 'N') {
      actByYear.set(yr, entry)
    } else {
      // isConsensus = 'Y' → 컨센서스 추정치
      fcByYear.set(yr, entry)
    }
  }

  console.log('[fetchKR] actByYear 연도:', Array.from(actByYear.keys()))
  console.log('[fetchKR] fcByYear 연도:', Array.from(fcByYear.keys()))

  // ── 8개년 financials 조립 ─────────────────────────────────────────────────
  const cy       = new Date().getFullYear()
  const yearKeys = makeYearKeys(cy)
  const fin: typeof result.financials = {}

  for (const key of yearKeys) {
    const isEst = key.endsWith('E')
    const yr    = parseInt(key, 10)

    if (!isEst) {
      const d = actByYear.get(yr)
      fin[key] = {
        eps:             d?.eps ?? 0,
        // 억원 단위 그대로 반환 → 프론트엔드에서 ×1e8 / shares = 원/주 계산
        operatingProfit: d?.oi  ?? 0,
        revenue:         d?.rev ?? 0,
      }
    } else {
      const d = fcByYear.get(yr)
      fin[key] = {
        eps:             d?.eps ?? 0,
        operatingProfit: d?.oi  ?? 0,
        revenue:         d?.rev ?? 0,
      }
    }
  }

  console.log('[fetchKR] EPS 결과:', yearKeys.map(k => `${k}:${fin[k].eps}`).join(', '))

  result.financials = fin
  result.yearKeys   = yearKeys
  return result
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams
  const ticker = (sp.get('ticker') ?? '').trim().toUpperCase()
  const market = ((sp.get('market') ?? 'US').toUpperCase()) as 'US' | 'KR'

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('조회 요청 티커:', ticker, '/ 시장:', market)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (!ticker) {
    return NextResponse.json(
      { ...makeShell('', 'US'), error: '티커를 입력해 주세요.' },
      { status: 400 }
    )
  }

  try {
    const data = market === 'KR' ? await fetchKR(ticker) : await fetchUS(ticker)
    console.log(`[route] 완료 success:${data.success} 종목:${data.companyName}`)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (e) {
    const msg =
      (e as Error).message ||
      '해당 종목의 실시간 재무 데이터를 가져오는 데 실패했습니다. 티커를 다시 확인해 주세요.'
    console.error('[route] 오류:', msg)
    return NextResponse.json(
      { ...makeShell(ticker, market), success: false, error: msg },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
