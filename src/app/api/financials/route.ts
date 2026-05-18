/**
 * GET /api/financials?ticker=NVDA&market=US
 * GET /api/financials?ticker=005930&market=KR
 *
 * ─── 데이터 소스 ─────────────────────────────────────────────────────────────
 *  US:  1순위 Financial Modeling Prep (FMP) → 2순위 Yahoo Finance (yahoo-finance2)
 *  KR:  1순위 DART OpenAPI (역사적 실적)   → 2순위 Naver 증권 (현재가·추정치)
 *       현재가·PER·발행주식수는 Naver에서 항상 가져옴
 *
 * ─── 단위 ─────────────────────────────────────────────────────────────────────
 *  US:  operatingIncome·revenue = M USD,  eps = $/주
 *  KR:  operatingIncome·revenue = 억원,   eps = 원/주
 *
 * ─── 환경 변수 ────────────────────────────────────────────────────────────────
 *  FMP_API_KEY  : financialmodelingprep.com (무료 250회/일)
 *  DART_API_KEY : opendart.fss.or.kr        (무료 10,000회/일)
 */
export const dynamic    = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

// ── 환경 변수 ─────────────────────────────────────────────────────────────────
const FMP_KEY  = process.env.FMP_API_KEY  ?? ''
const DART_KEY = process.env.DART_API_KEY ?? ''

// ── 모바일 UA (Naver 봇 차단 우회) ──────────────────────────────────────────
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

// ── 숫자 변환: 실패 시 0 ─────────────────────────────────────────────────────
function toNum(v: unknown): number {
  if (v == null) return 0
  const raw =
    typeof v === 'object' && v !== null && 'raw' in v
      ? (v as { raw: unknown }).raw
      : v
  const f = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[,()]/g, ''))
  return isFinite(f) ? f : 0
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
//  FMP 헬퍼 — Financial Modeling Prep Stable Income Statement API
//
//  ※ 2025년 8월 이후 FMP API 변경사항:
//     구 endpoint: /api/v3/income-statement/{ticker} (Legacy, 유료 전환)
//     신 endpoint: /stable/income-statement?symbol={ticker}&period=annual
//     필드명 변경: epsdiluted → epsDiluted, calendarYear 제거 → fiscalYear 사용
//     무료 플랜: limit 최대 5 (5개년 데이터)
// ════════════════════════════════════════════════════════════════════════════════
type FMPRow = {
  fiscalYear:      string   // "2025", "2024", ...
  period:          string   // "FY" (연간) | "Q1" 등
  eps:             number   // 기본 EPS
  epsDiluted:      number   // 희석 EPS (우선 사용)
  operatingIncome: number   // 영업이익 (USD, raw)
  revenue:         number   // 매출액 (USD, raw)
  date:            string
}

async function fetchFMPIncomeStatement(ticker: string): Promise<Map<number, { eps: number; oi: number; rev: number }>> {
  const result = new Map<number, { eps: number; oi: number; rev: number }>()
  if (!FMP_KEY) {
    console.warn('[FMP] API 키 없음 (FMP_API_KEY). Yahoo Finance fallback 사용.')
    return result
  }

  try {
    // 신규 stable 엔드포인트 (무료 플랜 limit=5)
    const url =
      `https://financialmodelingprep.com/stable/income-statement` +
      `?symbol=${encodeURIComponent(ticker)}&period=annual&limit=5&apikey=${FMP_KEY}`

    const res = await fetch(url, { cache: 'no-store' })

    if (res.status === 402) {
      console.warn('[FMP] 402 결제 필요 — 플랜 한도 초과 또는 엔드포인트 제한')
      return result
    }
    if (!res.ok) {
      console.warn('[FMP] HTTP', res.status)
      return result
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: FMPRow[] | { 'Error Message'?: string; error?: string } | any = await res.json()

    if (!Array.isArray(data)) {
      console.warn('[FMP] 비배열 응답:', JSON.stringify(data).slice(0, 150))
      return result
    }

    for (const row of data as FMPRow[]) {
      if (row.period !== 'FY') continue      // 연간 데이터만

      // fiscalYear: "2025" 형식
      const yr = parseInt(String(row.fiscalYear ?? ''), 10)
      if (!yr || yr < 2000) continue

      // 희석 EPS 우선, 없으면 기본 EPS
      const eps = typeof row.epsDiluted === 'number' && row.epsDiluted !== 0
        ? row.epsDiluted
        : (typeof row.eps === 'number' ? row.eps : 0)

      const oi  = typeof row.operatingIncome === 'number' ? row.operatingIncome : 0
      const rev = typeof row.revenue          === 'number' ? row.revenue          : 0

      result.set(yr, {
        eps,
        oi:  oi  !== 0 ? +(oi  / 1e6).toFixed(2) : 0,   // USD → M USD
        rev: rev > 0   ? +(rev / 1e6).toFixed(2) : 0,   // USD → M USD
      })
    }

    console.log('[FMP] 수신 연도:', Array.from(result.keys()).sort().join(', '),
      '| EPS 샘플:', Array.from(result.entries()).slice(-1).map(([y,v]) => `${y}:${v.eps}`)[0])
  } catch (e) {
    console.warn('[FMP] 오류:', (e as Error).message)
  }
  return result
}

// ════════════════════════════════════════════════════════════════════════════════
//  Yahoo Finance 헬퍼 — FMP 폴백용 (추정치 + 현재가 등)
// ════════════════════════════════════════════════════════════════════════════════
async function getYF(): Promise<unknown> {
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
}

// ════════════════════════════════════════════════════════════════════════════════
//  DART 헬퍼 — OpenAPI 연결재무제표 (사업보고서)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 종목코드(6자리) → DART 고유번호(corp_code)
 *
 * DART company.json 은 corp_code → 회사정보 조회용이라 stock_code 검색 불가.
 * 대신 list.json 에 stock_code 파라미터를 사용하면 공시 목록에서 corp_code 추출 가능.
 * ※ list.json은 corp_code 없이 stock_code만 쓸 경우 3개월 이내 날짜 범위만 허용.
 */
async function getDARTCorpCode(stockCode: string): Promise<string | null> {
  if (!DART_KEY) {
    console.warn('[DART] API 키 없음 (DART_API_KEY). Naver fallback 사용.')
    return null
  }
  try {
    // 오늘 기준 최근 3개월 범위로 공시 목록 조회 → corp_code 추출
    const now    = new Date()
    const end    = now.toISOString().slice(0, 10).replace(/-/g, '')
    const bgn    = new Date(now.setMonth(now.getMonth() - 2))
      .toISOString().slice(0, 10).replace(/-/g, '')

    const url =
      `https://opendart.fss.or.kr/api/list.json` +
      `?crtfc_key=${DART_KEY}&stock_code=${stockCode}` +
      `&bgn_de=${bgn}&end_de=${end}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null

    const d = await res.json()
    if (d.status !== '000' || !Array.isArray(d.list) || d.list.length === 0) {
      // 최근 공시가 없는 경우 날짜 범위를 1년으로 확장해서 재시도
      const bgn2 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10).replace(/-/g, '')
      const url2 =
        `https://opendart.fss.or.kr/api/list.json` +
        `?crtfc_key=${DART_KEY}&stock_code=${stockCode}&bgn_de=${bgn2}`
      const res2 = await fetch(url2, { cache: 'no-store' })
      if (!res2.ok) return null
      const d2 = await res2.json()
      if (d2.status !== '000' || !Array.isArray(d2.list) || d2.list.length === 0) {
        console.warn('[DART] corp_code 조회 실패 (공시 없음):', stockCode)
        return null
      }
      const corpCode2 = d2.list[0].corp_code
      console.log('[DART] corp_code (확장 검색):', corpCode2, '→', d2.list[0].corp_name)
      return corpCode2 ?? null
    }

    const corpCode = d.list[0].corp_code
    console.log('[DART] corp_code:', corpCode, '→', d.list[0].corp_name)
    return corpCode ?? null
  } catch (e) {
    console.warn('[DART] corp_code 오류:', (e as Error).message)
    return null
  }
}

/**
 * DART fnlttSinglAcntAll — 단일 사업연도 연결재무제표 파싱
 * bsns_year 기준으로 당기(thstrm)·전기(frmtrm)·전전기(bfefrmtrm) 3개년 반환
 *
 * ※ 단위 정책 (실제 API 응답 기준으로 검증됨):
 *    - 매출액/영업이익: DART는 원(KRW) 단위 그대로 제출 → ÷1e8 = 억원
 *      예) 삼성 2024 영업이익 32,725,961,000,000원 ÷ 1e8 = 327,260억원 ✓
 *    - 주당순이익(EPS): 원/주 단위 그대로 사용 (변환 없음)
 *      예) 삼성 2024 EPS 4,950원/주 ✓
 */
async function fetchDARTYear(
  corpCode: string,
  bsnsYear: number
): Promise<Map<number, { rev: number; oi: number; eps: number }>> {
  const result = new Map<number, { rev: number; oi: number; eps: number }>()
  if (!DART_KEY) return result

  try {
    const url =
      `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
      `?crtfc_key=${DART_KEY}&corp_code=${corpCode}` +
      `&bsns_year=${bsnsYear}&reprt_code=11011&fs_div=CFS`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return result

    const d = await res.json()
    if (d.status !== '000' || !Array.isArray(d.list)) return result

    type DARTRow = Record<string, string>
    const rows = d.list as DARTRow[]

    // 당기·전기·전전기 3개 기간 처리
    const periods = [
      { key: 'thstrm',    yearAdj:  0 },
      { key: 'frmtrm',    yearAdj: -1 },
      { key: 'bfefrmtrm', yearAdj: -2 },
    ]

    for (const row of rows) {
      if (row.sj_div !== 'IS') continue   // 손익계산서(IS)만

      const nm = row.account_nm ?? ''
      const id = row.account_id ?? ''

      // 해당하는 계정인지 확인
      const isRevenue =
        id.includes('Revenue') ||
        nm.includes('매출액') ||
        nm.startsWith('수익(')
      const isOI =
        id.includes('OperatingIncome') ||
        id.includes('OperatingProfit') ||
        nm.includes('영업이익') ||
        nm.includes('영업손익')
      const isEPS =
        id.includes('EarningsPerShare') ||
        id.includes('BasicEarnings') ||
        nm.includes('주당순이익') ||
        nm.includes('기본주당이익') ||
        nm.includes('주당이익')

      if (!isRevenue && !isOI && !isEPS) continue

      for (const { key, yearAdj } of periods) {
        const yr = bsnsYear + yearAdj
        if (yr < 2018) continue

        const rawStr = (row[`${key}_amount`] ?? '').replace(/,/g, '').replace(/\(([^)]+)\)/, '-$1')
        const val = parseFloat(rawStr)
        if (!isFinite(val)) continue

        const cur = result.get(yr) ?? { rev: 0, oi: 0, eps: 0 }

        if (isRevenue && cur.rev === 0) {
          // 매출액: 원(KRW) → 억원 (÷1e8)
          cur.rev = val > 0 ? Math.round(val / 1e8) : 0
        }
        if (isOI && cur.oi === 0) {
          // 영업이익: 원(KRW) → 억원 (÷1e8), 손실은 음수로 허용
          cur.oi = Math.round(val / 1e8)
        }
        if (isEPS && cur.eps === 0) {
          // 기본주당순이익: 원/주 단위 그대로 (변환 없음)
          cur.eps = val
        }

        result.set(yr, cur)
      }
    }
  } catch (e) {
    console.warn('[DART] fetchDARTYear 오류:', (e as Error).message)
  }

  return result
}

/**
 * DART 5개년 연결재무제표 수집
 * - 2회 호출: bsns_year=cy → cy, cy-1, cy-2 / bsns_year=cy-2 → cy-2, cy-3, cy-4
 */
async function fetchDARTFinancials(
  corpCode: string
): Promise<Map<number, { rev: number; oi: number; eps: number }>> {
  const cy = new Date().getFullYear()
  const merged = new Map<number, { rev: number; oi: number; eps: number }>()

  // 병렬 조회
  const [recent, older] = await Promise.all([
    fetchDARTYear(corpCode, cy),
    fetchDARTYear(corpCode, cy - 2),
  ])

  for (const [yr, v] of [...Array.from(older), ...Array.from(recent)]) {   // recent 가 older 를 덮어씀
    const prev = merged.get(yr)
    if (!prev) {
      merged.set(yr, { ...v })
    } else {
      // 최신 데이터(recent)가 더 신뢰할 수 있으므로 0이 아닌 값 우선
      merged.set(yr, {
        rev: v.rev !== 0 ? v.rev : prev.rev,
        oi:  v.oi  !== 0 ? v.oi  : prev.oi,
        eps: v.eps !== 0 ? v.eps : prev.eps,
      })
    }
  }

  console.log('[DART] 수집 연도:', Array.from(merged.keys()).sort().join(', '))
  return merged
}

// ════════════════════════════════════════════════════════════════════════════════
//  US 통합 fetch
//  FMP(실적+영업이익+EPS) + Yahoo(현재가·PER·주식수·미래추정)
// ════════════════════════════════════════════════════════════════════════════════
async function fetchUS(ticker: string) {
  const result = makeShell(ticker, 'US')

  // ── 1. FMP: 역사적 실적 (EPS·영업이익·매출) ─────────────────────────────
  const fmpData = await fetchFMPIncomeStatement(ticker)
  const hasFMP  = fmpData.size > 0

  // ── 2. Yahoo Finance: 현재가·PER·주식수·미래 추정 ────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let yf: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d:  any = null

  try {
    yf = await getYF()
    d  = await yf.quoteSummary(ticker, {
      modules: [
        'earningsTrend',
        'earningsHistory',
        'defaultKeyStatistics',
        'summaryDetail',
        'financialData',
        // FMP가 없을 때 역사적 데이터 폴백용
        ...(hasFMP ? [] : ['incomeStatementHistory']),
      ],
    })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (!hasFMP) {
      if (msg.includes('Not Found') || msg.includes('404')) {
        throw new Error(`"${ticker}"은(는) 존재하지 않는 티커입니다.`)
      }
      throw new Error(`데이터 조회 실패: ${msg}`)
    }
    // FMP 데이터가 있으면 Yahoo 실패해도 계속 진행 (추정치는 없어도 됨)
    console.warn('[fetchUS] Yahoo 오류 (FMP 데이터 사용 계속):', msg)
  }

  // ── 기본 정보 (Yahoo) ────────────────────────────────────────────────────
  const stats = d?.defaultKeyStatistics ?? {}
  const det   = d?.summaryDetail         ?? {}
  const finD  = d?.financialData         ?? {}

  result.companyName  = ticker
  result.currentPrice = toNum(finD?.currentPrice ?? det?.previousClose)
  result.marketCap    = toNum(det?.marketCap)

  // 발행주식수: 시가총액÷현재가 역산 (멀티클래스 주식 GOOGL 등 대응)
  const rawPrice  = toNum(finD?.currentPrice ?? det?.previousClose)
  const rawMktCap = toNum(det?.marketCap)
  const impliedSh = toNum(stats?.impliedSharesOutstanding)
  const mkCapSh   = rawPrice > 0 && rawMktCap > 0 ? Math.round(rawMktCap / rawPrice) : 0
  result.shares   = impliedSh > 0 ? impliedSh : mkCapSh > 0 ? mkCapSh : toNum(stats?.sharesOutstanding)

  result.currentPER = toNum(det?.trailingPE ?? det?.forwardPE)
  result.success    = true

  // FMP 데이터가 없을 때 Yahoo incomeStatementHistory 폴백
  if (!hasFMP && d?.incomeStatementHistory) {
    const sharesOut = result.shares > 0 ? result.shares : 1
    const isRows: Array<{ endDate: Date; totalRevenue: number; netIncome: number }> =
      d.incomeStatementHistory?.incomeStatementHistory ?? []

    for (const row of isRows) {
      try {
        const yr  = row.endDate instanceof Date
          ? row.endDate.getFullYear()
          : new Date(toNum(row.endDate) * 1000).getFullYear()
        const rev = typeof row.totalRevenue === 'number' ? row.totalRevenue : 0
        const ni  = typeof row.netIncome    === 'number' ? row.netIncome    : 0
        const eps = ni > 0 ? +(ni / sharesOut).toFixed(2) : 0
        fmpData.set(yr, {
          eps,
          oi:  0,
          rev: rev > 0 ? +(rev / 1e6).toFixed(2) : 0,
        })
      } catch { /* 건너뜀 */ }
    }
  }

  // TTM 영업이익 (financialData.operatingMargins × totalRevenue)
  const ttmOpMargin = toNum(finD?.operatingMargins)
  const ttmRevenue  = toNum(finD?.totalRevenue)
  const ttmOI       = ttmOpMargin > 0 && ttmRevenue > 0
    ? +(ttmOpMargin * ttmRevenue / 1e6).toFixed(2) : 0

  // ── EPS 분기 합산: earningsHistory ──────────────────────────────────────
  const ehRows: Array<{ quarter: Date | null; epsActual: number | null }> =
    d?.earningsHistory?.history ?? []
  const epsByYearYF = new Map<number, number>()
  for (const row of ehRows) {
    try {
      if (!row.quarter || typeof row.epsActual !== 'number') continue
      const yr = row.quarter instanceof Date
        ? row.quarter.getFullYear()
        : new Date(String(row.quarter)).getFullYear()
      if (yr > 2000 && isFinite(row.epsActual)) {
        epsByYearYF.set(yr, (epsByYearYF.get(yr) ?? 0) + row.epsActual)
      }
    } catch { /* 건너뜀 */ }
  }

  // ── 미래 추정: earningsTrend ─────────────────────────────────────────────
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
        rev: typeof revVal === 'number' && revVal > 0 ? +(revVal / 1e6).toFixed(2) : 0,
      })
    } catch { /* 건너뜀 */ }
  }

  // ── 8개년 financials 조립 ─────────────────────────────────────────────────
  const cy       = new Date().getFullYear()
  const yearKeys = makeYearKeys(cy)
  result.yearKeys = yearKeys

  const trailingEps = toNum(stats?.trailingEps)
  const maxActualYr = fmpData.size > 0
    ? Math.max(...Array.from(fmpData.keys()))
    : 0

  const fin: typeof result.financials = {}

  for (const key of yearKeys) {
    const isEst = key.endsWith('E')
    const yr    = parseInt(key, 10)

    if (!isEst) {
      const fmp = fmpData.get(yr)

      // EPS 우선순위: FMP dilutedEPS > Yahoo earningsHistory > trailingEps(최근년)
      const epsYF    = epsByYearYF.get(yr)
      const epsBase  = fmp?.eps && fmp.eps !== 0
        ? fmp.eps
        : (typeof epsYF === 'number' ? +(epsYF).toFixed(2) : 0)
      const isMostRecent = yr === maxActualYr
      const finalEps = (isMostRecent && trailingEps > 0 && epsBase === 0)
        ? trailingEps : epsBase

      // 영업이익: FMP operatingIncome → TTM 폴백(최근년만)
      const oi = fmp?.oi && fmp.oi > 0
        ? fmp.oi
        : (isMostRecent ? ttmOI : 0)

      fin[key] = {
        eps:             finalEps,
        operatingProfit: oi,
        revenue:         fmp?.rev ?? 0,
      }
    } else {
      // 추정 연도지만 FMP에 실제 데이터가 있는 경우 → 확정 실적으로 우선 처리
      // (비12월 결산 종목: NVDA=1월말, AAPL=9월말 등 FY가 다음해로 기록됨)
      const fmpActual = fmpData.get(yr)
      if (fmpActual && (fmpActual.eps !== 0 || fmpActual.rev > 0)) {
        fin[key] = {
          eps:             fmpActual.eps,
          operatingProfit: fmpActual.oi,
          revenue:         fmpActual.rev,
        }
      } else {
        // 실제 FMP 데이터 없음 → Yahoo earningsTrend 추정치 사용
        const delta  = yr - cy
        const pMap: Record<number, string> = { 0: '0y', 1: '+1y', 2: '+2y' }
        const td     = trendMap.get(pMap[delta] ?? '')
        const fwdEps = toNum(stats?.forwardEps)
        fin[key] = {
          eps:             td?.eps && td.eps > 0 ? td.eps : (delta === 0 ? fwdEps : 0),
          operatingProfit: 0,
          revenue:         td?.rev ?? 0,
        }
      }
    }
  }

  console.log('[fetchUS] FMP 사용:', hasFMP, '| EPS 결과:', yearKeys.map(k => `${k}:${fin[k].eps}`).join(','))
  result.financials = fin
  return result
}

// ════════════════════════════════════════════════════════════════════════════════
//  KR 통합 fetch
//  DART(역사적 실적) + Naver(현재가·PER·주식수·컨센서스 추정)
// ════════════════════════════════════════════════════════════════════════════════
async function fetchKR(code: string) {
  const result = makeShell(code, 'KR')

  const naverOpt: RequestInit = {
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://m.stock.naver.com/' },
    cache: 'no-store',
  }

  // ── 1. Naver basic: 현재가 ────────────────────────────────────────────────
  let basicOk = false
  try {
    const basicRes = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, naverOpt)
    if (basicRes.status === 404) {
      throw new Error(`"${code}"은(는) 네이버 증권에 없는 종목코드입니다.`)
    }
    if (!basicRes.ok) throw new Error(`Naver basic HTTP ${basicRes.status}`)
    const b = await basicRes.json()
    if (!b.stockName) throw new Error(`"${code}" 기본 정보 없음`)
    result.companyName  = String(b.stockName)
    result.currentPrice = parseFloat(String(b.closePrice ?? '0').replace(/,/g, '')) || 0
    result.success = true
    basicOk = true
  } catch (e) {
    throw new Error((e as Error).message)
  }

  // ── 2. Naver integration: PER·시가총액·발행주식수 ────────────────────────
  try {
    const intRes = await fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, naverOpt)
    if (intRes.ok) {
      const intData = await intRes.json().catch(() => null)
      const infos: Array<{ code: string; value?: string }> = intData?.totalInfos ?? []
      const perItem = infos.find(i => i.code === 'per')
      const mcItem  = infos.find(i => i.code === 'marketValue')
      if (perItem?.value) result.currentPER = parseFloat(perItem.value.replace(/[^0-9.]/g, '')) || 0
      if (mcItem?.value) {
        const s = mcItem.value.replace(/,/g, '')
        let mc = 0
        const jo  = s.match(/([\d]+)조/);  if (jo)  mc += parseInt(jo[1],  10) * 1_000_000_000_000
        const eok = s.match(/([\d]+)억/);  if (eok) mc += parseInt(eok[1], 10) * 100_000_000
        result.marketCap = mc
      }
      if (result.marketCap > 0 && result.currentPrice > 0) {
        result.shares = Math.round(result.marketCap / result.currentPrice)
      }
    }
  } catch { /* PER/shares 없어도 계속 */ }

  if (!basicOk) return result

  // ── 3. DART: 역사적 실적 (사업보고서 기반) ───────────────────────────────
  const dartData = new Map<number, { rev: number; oi: number; eps: number }>()
  let usedDART = false

  if (DART_KEY) {
    const corpCode = await getDARTCorpCode(code)
    if (corpCode) {
      const dartRaw = await fetchDARTFinancials(corpCode)
      if (dartRaw.size > 0) {
        for (const [yr, v] of Array.from(dartRaw)) dartData.set(yr, v)
        usedDART = true
      }
    }
  }

  // ── 4. Naver annual: 폴백 또는 컨센서스 추정치 ──────────────────────────
  type NaverRow  = { title: string; columns: Record<string, { value: string }> }
  type NaverMeta = { key: string; isConsensus?: string }

  const actByYear = new Map<number, { eps: number; oi: number; rev: number }>()
  const fcByYear  = new Map<number, { eps: number; oi: number; rev: number }>()

  try {
    const annRes = await fetch(`https://m.stock.naver.com/api/stock/${code}/finance/annual`, naverOpt)
    if (annRes.ok) {
      let ann: { financeInfo?: { rowList?: NaverRow[]; trTitleList?: NaverMeta[] } } | null = null
      try { ann = await annRes.json() } catch { ann = null }

      const rows = ann?.financeInfo?.rowList    ?? []
      const cols = ann?.financeInfo?.trTitleList ?? []

      const getCell = (title: string, key: string): number => {
        try {
          const row = rows.find(r => r.title === title || r.title?.includes(title))
          if (!row) return 0
          const raw = row.columns?.[key]?.value
          if (!raw || raw.trim() === '-') return 0
          return parseFloat(raw.replace(/,/g, '')) || 0
        } catch { return 0 }
      }

      // 연도 키에서 4자리 연도 추출
      const extractYr = (key: string): number | null => {
        const m = key.match(/^(\d{4})/); return m ? parseInt(m[1], 10) : null
      }

      for (const col of cols) {
        const yr = extractYr(col.key)
        if (!yr) continue
        const entry = {
          eps: getCell('EPS',    col.key),
          oi:  getCell('영업이익', col.key),
          rev: getCell('매출액',  col.key),
        }
        if (col.isConsensus === 'N') actByYear.set(yr, entry)
        else                         fcByYear.set(yr, entry)
      }
    }
  } catch { /* Naver 폴백 실패 무시 */ }

  // ── 5. 컨센서스 아웃라이어 필터 (Naver 추정치 6배 초과 제거) ─────────────
  const lastActEps = Array.from(actByYear.values()).map(v => v.eps).filter(v => v > 0).at(-1) ?? 0
  const lastActOI  = Array.from(actByYear.values()).map(v => v.oi).filter(v => v > 0).at(-1)  ?? 0
  const lastActRev = Array.from(actByYear.values()).map(v => v.rev).filter(v => v > 0).at(-1) ?? 0

  // 아웃라이어 필터: 항목별로 임계값 분리
  //   EPS  : 8배 허용 — 반도체 사이클은 4~7배 급등도 실제 발생 (삼성 2026E 6.43배 통과)
  //   OI   : 6배 허용 — 영업이익률 50% 초과는 물리적 불가능 (삼성 2026E OI 7.9배 제거 유지)
  //   Rev  : 8배 허용 — 매출 2배 정도는 가능
  const filterOutlier = (val: number, base: number, maxMult = 6): number => {
    if (base <= 0 || val <= 0) return val
    if (val / base > maxMult) {
      console.warn(`[KR] 컨센서스 아웃라이어 제거: ${val} (base=${base}, ${(val/base).toFixed(1)}x > ${maxMult}x)`)
      return 0
    }
    return val
  }

  // ── 6. 8개년 financials 조립 ──────────────────────────────────────────────
  // 실적: DART 우선 → Naver actByYear 폴백
  // 추정: Naver fcByYear (컨센서스 아웃라이어 필터 적용)
  const cy       = new Date().getFullYear()
  const yearKeys = makeYearKeys(cy)
  const fin: typeof result.financials = {}

  for (const key of yearKeys) {
    const isEst = key.endsWith('E')
    const yr    = parseInt(key, 10)

    if (!isEst) {
      const dart  = dartData.get(yr)
      const naver = actByYear.get(yr)

      // 실적 EPS: DART 우선 → Naver 폴백
      const eps = (dart?.eps && dart.eps !== 0)
        ? dart.eps
        : (naver?.eps ?? 0)

      // 영업이익/매출: DART 우선 → Naver 폴백
      const oi  = (dart?.oi  && dart.oi  !== 0) ? dart.oi  : (naver?.oi  ?? 0)
      const rev = (dart?.rev && dart.rev !== 0) ? dart.rev : (naver?.rev ?? 0)

      fin[key] = { eps, operatingProfit: oi, revenue: rev }
    } else {
      // 추정치: Naver 컨센서스 (아웃라이어 필터 적용)
      const fc = fcByYear.get(yr)
      fin[key] = {
        eps:             filterOutlier(fc?.eps ?? 0, lastActEps, 8),  // EPS: 8배 허용
        operatingProfit: filterOutlier(fc?.oi  ?? 0, lastActOI,  6),  // OI:  6배 유지 (OI마진 50%+ 불가)
        revenue:         filterOutlier(fc?.rev ?? 0, lastActRev, 8),  // Rev: 8배 허용
      }
    }
  }

  console.log('[fetchKR] DART 사용:', usedDART, '| EPS 결과:', yearKeys.map(k => `${k}:${fin[k].eps}`).join(','))
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
  console.log('조회 요청:', ticker, '/', market)
  console.log('FMP 키:', FMP_KEY ? '✓' : '✗ (없음)', '| DART 키:', DART_KEY ? '✓' : '✗ (없음)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (!ticker) {
    return NextResponse.json(
      { ...makeShell('', 'US'), error: '티커를 입력해 주세요.' },
      { status: 400 }
    )
  }

  try {
    const data = market === 'KR' ? await fetchKR(ticker) : await fetchUS(ticker)
    console.log(`완료 success:${data.success} 종목:${data.companyName}`)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (e) {
    const msg = (e as Error).message || '데이터를 가져오는 데 실패했습니다. 티커를 다시 확인해 주세요.'
    console.error('오류:', msg)
    return NextResponse.json(
      { ...makeShell(ticker, market), success: false, error: msg },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
