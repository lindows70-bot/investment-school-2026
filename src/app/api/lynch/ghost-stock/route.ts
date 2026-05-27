/**
 * GET /api/lynch/ghost-stock
 *
 * ◆ 데이터 파이프라인 (하루 1회 캐싱 전략)
 *
 *  1) Supabase Auth → 로그인 학생 식별
 *  2) investments 테이블 → 보유 종목 ticker 리스트 조회
 *  3) ghost_stock_cache → 오늘 날짜 캐시 확인
 *     ├─ 캐시 HIT  → 즉시 반환 (외부 API 호출 없음)
 *     └─ 캐시 MISS → 외부 API 호출 → Ghost Score 계산 → Upsert → 반환
 *
 * ◆ 외부 API 연동 계획 (현재: 스터브 + 가상 연산)
 *  - 기관 애널리스트 수: FMP /v4/analyst-estimates 또는 Yahoo Finance v10
 *  - 내부자 거래 (US): SEC Edgar EDGAR Submissions API
 *  - 내부자 거래 (KR): DART OpenAPI majorstock 엔드포인트
 */

import { NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import { classifyAssetType }         from '@/lib/classifyAssetType'

// ── 타입 정의 ────────────────────────────────────────────────
interface GhostCacheRow {
  ticker:                  string
  company_name:            string
  lynch_type:              string
  market:                  string
  analyst_count:           number
  analyst_change:          number
  inst_ownership:          number
  insider_buy_count:       number
  insider_sell_count:      number
  insider_buy_amt:         string
  insider_sell_amt:        string
  last_activity:           string
  last_activity_days:      number
  ghost_score:             number
  ghost_grade:             string
  lynch_verdict:           string
  analyst_comment:         string
  insider_comment:         string
  updated_at:              string
}

// ── 유령 스코어 계산 (0~100) ─────────────────────────────────
function calcGhostScore(
  analystCount:  number,
  insiderBuys:   number,
  insiderSells:  number,
  instOwnership: number,
): number {
  // 기관 커버리지 (40pt): 낮을수록 고득점
  const coverScore =
    analystCount <= 3  ? 40 :
    analystCount <= 7  ? 35 :
    analystCount <= 15 ? 22 :
    analystCount <= 25 ? 12 : 4

  // 내부자 순매수 (40pt)
  const net = insiderBuys - insiderSells
  const insiderScore =
    net >= 4  ? 40 :
    net >= 2  ? 30 :
    net >= 1  ? 20 :
    net === 0 ? 10 : 0

  // 기관 보유 비중 (20pt): 낮을수록 대규모 유입 여지
  const instScore =
    instOwnership < 25 ? 20 :
    instOwnership < 50 ? 14 :
    instOwnership < 75 ? 7  : 2

  return Math.min(100, coverScore + insiderScore + instScore)
}

// ── 유령 등급 계산 ────────────────────────────────────────────
function calcGhostGrade(
  analystCount: number,
  insiderBuys:  number,
  insiderSells: number,
): string {
  const net = insiderBuys - insiderSells
  if (analystCount <= 5  && net > 0)  return 'diamond'
  if (analystCount <= 10 && net >= 0) return 'pearl'
  if (analystCount <= 20)             return 'radar'
  if (analystCount <= 35)             return 'hotspot'
  return 'crowded'
}

// ── 린치 버딕트 자동 생성 ─────────────────────────────────────
function generateLynchVerdict(
  grade:        string,
  ticker:       string,
  analystCount: number,
  insiderNet:   number,
): string {
  if (grade === 'diamond') {
    return `"바로 이겁니다! 고작 ${analystCount}명의 애널리스트만 보는 월가의 사각지대인데, 임원들이 자기 돈으로 쓸어 담고 있습니다. 심봤습니다! 린치가 평생 찾던 그 종목입니다."`
  }
  if (grade === 'pearl') {
    return `"아직 소형 커버리지(${analystCount}명)에 내부자 매수 신호가 잡힙니다. 린치라면 이 초기 발굴 신호를 절대 놓치지 않습니다. 소문이 퍼지기 전에 선점하세요."`
  }
  if (grade === 'radar') {
    return `"중간 커버리지(${analystCount}명) 구간입니다. ${insiderNet > 0 ? '내부자 소규모 매수가 있어 미약한 긍정 신호이지만' : '내부자 동향도 중립적이라'} 아직 적극적 진입 전 모니터링이 적합합니다."`
  }
  if (grade === 'hotspot') {
    return `"${analystCount}명이 주목하는 인기 종목입니다. 린치가 좋아하는 소외 구간과는 거리가 있습니다. 우량하더라도 숨겨진 진주는 아닙니다."`
  }
  return `"${ticker}는 월가의 총아입니다. ${analystCount}명이 샅샅이 들여다보니 개인 투자자의 정보 이점이 없습니다. 린치 공식의 유령 종목과 정반대입니다."`
}

// ── [스터브] 기관 애널리스트 커버리지 조회 ───────────────────
// ★ 실제 연동 시 아래 주석 해제 후 구현
//   · US: FMP   - GET https://financialmodelingprep.com/api/v3/analyst-estimates/{ticker}?apikey={FMP_KEY}
//   · US: Yahoo - GET https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=recommendationTrend
//   · KR: 한국IR협의회 또는 네이버 증권 리서치 (비공식 크롤링)
async function fetchAnalystCoverage(
  ticker: string,
  market: string,
): Promise<{ count: number; change: number; instOwnership: number }> {
  // ── TODO: FMP analyst coverage 실제 호출 ──────────────────
  // const FMP_KEY = process.env.FMP_API_KEY
  // try {
  //   const res = await fetch(
  //     `https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${ticker}?limit=1&apikey=${FMP_KEY}`,
  //     { next: { revalidate: 86400 } }
  //   )
  //   const data = await res.json()
  //   return {
  //     count: data[0]?.analystNumber ?? 5,
  //     change: data[0]?.strongBuy ? 1 : 0,
  //     instOwnership: 40,
  //   }
  // } catch { /* fallback */ }

  // ── 가상 연산 (FMP 연동 전 임시) ─────────────────────────
  // KR 소형주는 일반적으로 커버리지 낮음 (1~10명 수준)
  // US 대형주는 20~50명 수준
  const seed = ticker.charCodeAt(0) + ticker.charCodeAt(ticker.length - 1)
  const base  = market === 'KR'
    ? (seed % 12) + 1
    : (seed % 40) + 3
  return {
    count:         base,
    change:        (seed % 5) - 2,                   // -2 ~ +2
    instOwnership: market === 'KR' ? 20 + (seed % 40) : 30 + (seed % 50),
  }
}

// ── [스터브] 내부자 거래 데이터 조회 ─────────────────────────
// ★ 실제 연동 시 아래 주석 해제 후 구현
//   · US: SEC EDGAR  - https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt={3m_ago}&forms=4
//   · US: FMP        - GET https://financialmodelingprep.com/api/v4/insider-trading?symbol={ticker}&limit=20&apikey={FMP_KEY}
//   · KR: DART       - https://opendart.fss.or.kr/api/majorstock.json?crtfc_key={DART_KEY}&corp_code={corpCode}
async function fetchInsiderTrading(
  ticker: string,
  market: string,
): Promise<{
  buyCount:         number
  sellCount:        number
  buyAmt:           string
  sellAmt:          string
  lastActivity:     string
  lastActivityDays: number
}> {
  // ── TODO: FMP insider trading 실제 호출 ─────────────────
  // const FMP_KEY = process.env.FMP_API_KEY
  // try {
  //   const res = await fetch(
  //     `https://financialmodelingprep.com/api/v4/insider-trading?symbol=${ticker}&limit=20&apikey=${FMP_KEY}`,
  //     { next: { revalidate: 86400 } }
  //   )
  //   const rows = await res.json()
  //   const buys  = rows.filter((r: any) => r.transactionType === 'P-Purchase')
  //   const sells = rows.filter((r: any) => r.transactionType === 'S-Sale')
  //   const buyAmt  = buys.reduce((s: number, r: any) => s + (r.price * r.securitiesTransacted), 0)
  //   const sellAmt = sells.reduce((s: number, r: any) => s + (r.price * r.securitiesTransacted), 0)
  //   return {
  //     buyCount: buys.length, sellCount: sells.length,
  //     buyAmt:  buyAmt  > 0 ? `$${(buyAmt  / 1e6).toFixed(1)}M` : '$0',
  //     sellAmt: sellAmt > 0 ? `$${(sellAmt / 1e6).toFixed(1)}M` : '$0',
  //     lastActivity:     buys.length > 0 ? `임원 ${buys.length}명 장내 매수` : '최근 변동 없음',
  //     lastActivityDays: 7,
  //   }
  // } catch { /* fallback */ }

  // ── 가상 연산 (실제 API 연동 전 임시) ────────────────────
  const seed      = ticker.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const buyCount  = seed % 5
  const sellCount = (seed + 2) % 3
  const curr      = market === 'KR' ? '₩' : '$'
  const buyAmtNum = buyCount  > 0 ? ((seed % 10) + 1) * 0.5 : 0
  const sellAmtNum= sellCount > 0 ? ((seed % 6)  + 1) * 0.3 : 0

  return {
    buyCount,
    sellCount,
    buyAmt:           buyCount  > 0 ? `${curr}${buyAmtNum.toFixed(1)}M`  : `${curr}0`,
    sellAmt:          sellCount > 0 ? `${curr}${sellAmtNum.toFixed(1)}M` : `${curr}0`,
    lastActivity:     buyCount > 0
      ? `임원 ${buyCount}명 장내 매수 확인`
      : sellCount > 0
        ? `임원 ${sellCount}명 장내 매도 확인`
        : '최근 3개월 내부자 거래 없음',
    lastActivityDays: (seed % 28) + 1,
  }
}

// ── 단일 종목 Ghost 데이터 빌드 (API 호출 + 계산) ───────────
async function buildGhostRecord(
  ticker:    string,
  name:      string,
  market:    string,
  lynchType: string,
): Promise<Omit<GhostCacheRow, 'updated_at'>> {
  const [coverage, insider] = await Promise.all([
    fetchAnalystCoverage(ticker, market),
    fetchInsiderTrading(ticker, market),
  ])

  const score = calcGhostScore(
    coverage.count, insider.buyCount, insider.sellCount, coverage.instOwnership,
  )
  const grade = calcGhostGrade(coverage.count, insider.buyCount, insider.sellCount)
  const net   = insider.buyCount - insider.sellCount

  const analystComment =
    coverage.count <= 5
      ? `${coverage.count}명 초소형 커버리지 — 월가 사각지대. 기관 비중 ${coverage.instOwnership.toFixed(0)}%로 대규모 유입 여지 충분.`
      : coverage.count <= 15
        ? `${coverage.count}명 소형 커버리지 — 아직 발굴 초기 단계. 기관 비중 ${coverage.instOwnership.toFixed(0)}%.`
        : `${coverage.count}명 중·대형 커버리지 — 이미 시장의 레이더 안에 있습니다. 기관 비중 ${coverage.instOwnership.toFixed(0)}%.`

  const insiderComment =
    net > 0
      ? `최근 3개월 내부자 순매수 ${insider.buyCount}건(${insider.buyAmt}). ${insider.sellCount > 0 ? `매도 ${insider.sellCount}건(${insider.sellAmt}) 있으나` : '매도 없이'} 순매수 우세.`
      : net < 0
        ? `최근 3개월 내부자 순매도 우세 — 매도 ${insider.sellCount}건(${insider.sellAmt}) vs 매수 ${insider.buyCount}건(${insider.buyAmt}). 경계 필요.`
        : `최근 3개월 내부자 변동 없음. 중립 상태.`

  return {
    ticker,
    company_name:       name,
    lynch_type:         lynchType || '미분류',
    market,
    analyst_count:      coverage.count,
    analyst_change:     coverage.change,
    inst_ownership:     coverage.instOwnership,
    insider_buy_count:  insider.buyCount,
    insider_sell_count: insider.sellCount,
    insider_buy_amt:    insider.buyAmt,
    insider_sell_amt:   insider.sellAmt,
    last_activity:      insider.lastActivity,
    last_activity_days: insider.lastActivityDays,
    ghost_score:        score,
    ghost_grade:        grade,
    lynch_verdict:      generateLynchVerdict(grade, ticker, coverage.count, net),
    analyst_comment:    analystComment,
    insider_comment:    insiderComment,
  }
}

// ── GET 핸들러 ────────────────────────────────────────────────
export async function GET() {
  const cookieStore = await cookies()

  // ── 1. 인증 클라이언트 — 로그인 학생 식별 ──────────────────
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 2. 서비스 롤 클라이언트 — 캐시 읽기/쓰기 ──────────────
  const { createClient: createSbAdmin } = await import('@supabase/supabase-js')
  const sbAdmin = createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── 3. 학생 보유 종목 조회 ──────────────────────────────────
  const { data: holdings, error: holdingsErr } = await sbAdmin
    .from('investments')
    .select('ticker, name, market, lynch_category')
    .eq('user_id', user.id)

  if (holdingsErr) {
    return NextResponse.json({ error: holdingsErr.message }, { status: 500 })
  }
  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ records: [], source: 'empty' })
  }

  // ── 3-b. 자산 유형 분류 — 비주식은 Ghost 분석에서 제외 ─────
  // ETF·암호화폐·원자재는 기업 경영진·애널리스트 개념이 없으므로
  // ghost_stock_cache에 저장하지 않고 'excluded' 목록으로 분리 반환
  const equityHoldings = holdings.filter(h => {
    const clf = classifyAssetType(h.ticker, h.name, h.market ?? 'US')
    return clf.isAnalyzable   // STOCK만 true
  })
  const excludedHoldings = holdings.filter(h => {
    const clf = classifyAssetType(h.ticker, h.name, h.market ?? 'US')
    return !clf.isAnalyzable
  }).map(h => {
    const clf = classifyAssetType(h.ticker, h.name, h.market ?? 'US')
    return {
      ticker:       h.ticker.toUpperCase(),
      name:         h.name,
      assetType:    clf.assetType,
      badgeIcon:    clf.badgeIcon,
      badgeLabel:   clf.badgeLabel,
      lynchGuidance: clf.lynchGuidance,
    }
  })

  const tickers = equityHoldings.map(h => h.ticker.toUpperCase())

  if (tickers.length === 0) {
    return NextResponse.json({
      records:  [],
      excluded: excludedHoldings,
      source:   'empty',
    })
  }

  // ── 4. 캐시 확인 (오늘 날짜 기준) ─────────────────────────
  const todayISO = new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'

  const { data: cachedRows } = await sbAdmin
    .from('ghost_stock_cache')
    .select('*')
    .in('ticker', tickers)

  // 캐시 HIT = updated_at이 오늘 날짜인 행
  const hitMap   = new Map<string, GhostCacheRow>()
  const missTickerSet = new Set<string>(tickers)

  for (const row of (cachedRows ?? [])) {
    const rowDate = (row.updated_at as string).slice(0, 10)
    if (rowDate === todayISO) {
      hitMap.set(row.ticker, row as GhostCacheRow)
      missTickerSet.delete(row.ticker)
    }
  }

  // ── 5. 캐시 MISS → 외부 API 호출 후 Upsert ────────────────
  const newRows: Omit<GhostCacheRow, 'updated_at'>[] = []

  if (missTickerSet.size > 0) {
    const missList = equityHoldings.filter(h => missTickerSet.has(h.ticker.toUpperCase()))

    const built = await Promise.allSettled(
      missList.map(h =>
        buildGhostRecord(
          h.ticker.toUpperCase(),
          h.name,
          h.market ?? 'US',
          h.lynch_category ?? '',
        )
      )
    )

    for (const result of built) {
      if (result.status === 'fulfilled') {
        newRows.push(result.value)
      }
    }

    if (newRows.length > 0) {
      // Upsert: ticker PK 기준, updated_at 자동 갱신
      await sbAdmin
        .from('ghost_stock_cache')
        .upsert(
          newRows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
          { onConflict: 'ticker' }
        )
    }
  }

  // ── 6. 최종 레코드 조합 (캐시 HIT + 신규 MISS) ────────────
  const allRecords: GhostCacheRow[] = [
    ...Array.from(hitMap.values()),
    ...newRows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
  ]

  // 포트폴리오 순서 기반 정렬 (ghost_score 내림차순)
  allRecords.sort((a, b) => b.ghost_score - a.ghost_score)

  const hitCount  = hitMap.size
  const missCount = newRows.length

  return NextResponse.json({
    records:  allRecords,
    excluded: excludedHoldings,   // 비주식 자산 목록 (ETF·CRYPTO·COMMODITY)
    source:   hitCount > 0 && missCount === 0 ? 'cache' : 'partial',
    meta: {
      totalHoldings:   holdings.length,
      equityCount:     equityHoldings.length,
      excludedCount:   excludedHoldings.length,
      cacheHit:        hitCount,
      cacheMiss:       missCount,
      updatedAt:       new Date().toISOString(),
    },
  })
}
