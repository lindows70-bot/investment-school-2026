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
 * ◆ 데이터 소스 (2026-07-30 실데이터 전환 — 스터브·가상 연산 전량 제거)
 *  - 커버리지: US=Yahoo numberOfAnalystOpinions / KR=네이버 리포트 건수(getAnalystSignal SSOT)
 *  - 내부자:   getInsiderSignal SSOT (US=SEC EDGAR Form4 장내매수 / KR=DART) — 장내매수만 추적
 *  - 기관 보유: US=Yahoo heldPercentInstitutions / KR=무료 소스 부재 → 중립 처리(정직)
 */

// 빌드 시 정적 생성 금지 — 무거운 외부 fetch가 빌드 타임아웃을 내고(2026-08-01 실측: SEC·Yahoo 지연으로 빌드 실패) 데이터가 빌드 시점에 박제된다
export const dynamic = 'force-dynamic'
export const maxDuration = 120   // 🔍 미보유 발굴 콜드 스캔(24종 × 커버리지+내부자) 여유

import { NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import { getAssetClassification }     from '@/lib/assetClassifier'
import { getCache, setCache }         from '@/lib/appCache'
import { SAT_SCORE_KEY, type SatelliteScore } from '@/lib/satelliteScreener'
import { getInsiderSignal }           from '@/app/actions/getInsiderSignal'
import { getAnalystSignal }           from '@/app/actions/getAnalystSignal'

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
  instOwnership: number | null,   // null = 데이터 없음(KR) → 중립 배점
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

  // 기관 보유 비중 (20pt): 낮을수록 대규모 유입 여지 — 미확인(KR)은 중립 7pt
  const instScore =
    instOwnership == null ? 7 :
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

// ══════════════════════════════════════════════════════════════
// 기관 커버리지 이원화 아키텍처
//   KR 주식 → 네이버 컨센서스 크롤링 + 한국 대형주 정확값 테이블
//   US 주식 → FMP / Yahoo Finance numberOfAnalystOpinions
// ══════════════════════════════════════════════════════════════

/** 티커가 한국 주식인지 판별 (6자리 숫자 or .KS/.KQ 접미사) */
function isKoreanTicker(ticker: string): boolean {
  return /^\d{6}$/.test(ticker) || /\.(KS|KQ)$/i.test(ticker)
}

// ────────────────────────────────────────────────────────────
// 커버리지 — 실데이터 SSOT (2026-07-30: 하드코딩 테이블·숫자합 추정 전량 제거)
//   US: Yahoo financialData.numberOfAnalystOpinions + heldPercentInstitutions
//   KR: getAnalystSignal 네이버 리포트 건수(최근 3개월) — 텐배거 언더커버리지와 동일 관례
//   실패 시 throw → Promise.allSettled가 그 종목을 정직 생략(가짜 행 금지)
// ────────────────────────────────────────────────────────────
async function fetchAnalystCoverage(
  ticker: string,
  market: string,
): Promise<{ count: number; change: number; instOwnership: number | null }> {
  const isKr = market === 'KR' || isKoreanTicker(ticker)

  if (isKr) {
    const code = ticker.replace(/\.(KS|KQ)$/i, '')
    const sig  = await getAnalystSignal({ ticker: code, market: 'KR' })
    // reportCount 0 = 최근 3개월 리포트 없음(진짜 소외) — 실데이터. null만 실패로 간주
    if (typeof sig?.reportCount !== 'number') throw new Error(`KR coverage unavailable: ${ticker}`)
    // KR 기관 보유율은 무료 소스 부재 → null(중립 배점·코멘트 생략)
    return { count: sig.reportCount, change: 0, instOwnership: null }
  }

  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
  const qs = await yf.quoteSummary(ticker, { modules: ['financialData', 'defaultKeyStatistics'] })
  const n    = qs?.financialData?.numberOfAnalystOpinions
  const held = qs?.defaultKeyStatistics?.heldPercentInstitutions
  if (typeof n !== 'number') throw new Error(`US coverage unavailable: ${ticker}`)
  return {
    count:         n,
    change:        0,   // 전분기 대비 증감은 무료 시계열 부재 — 0(무표시)로 정직 처리
    instOwnership: typeof held === 'number' ? Math.round(held * 100) : null,
  }
}

// ────────────────────────────────────────────────────────────
// 내부자 거래 — getInsiderSignal SSOT (US=SEC EDGAR Form4 코드 P / KR=DART 장내매수)
//   ⚠️ 장내매수만 추적(매도·보상성 지급 미포함) — sellCount는 0 고정, 코멘트에 명시
// ────────────────────────────────────────────────────────────
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
  cluster:          boolean
}> {
  const sig = await getInsiderSignal({ ticker, market })

  if (sig.status === 'error') {
    return {
      buyCount: 0, sellCount: 0, buyAmt: '—', sellAmt: '—',
      lastActivity: '내부자 데이터 일시 미확인', lastActivityDays: 0, cluster: false,
    }
  }

  const buys     = sig.buys ?? []
  const buyCount = buys.length
  const fmtAmt = (v: number) =>
    sig.currency === 'KRW'
      ? (v >= 1e8 ? `₩${(v / 1e8).toFixed(1)}억` : `₩${Math.round(v / 1e4).toLocaleString()}만`)
      : `$${(v / 1e6).toFixed(1)}M`

  let lastActivity = '최근 90일 임원 장내매수 없음'
  let lastDays = 0
  if (buyCount > 0) {
    const dates  = buys.map(b => b.date).filter(Boolean).sort()
    const latest = dates[dates.length - 1]
    lastDays = Math.max(0, Math.round((Date.now() - new Date(latest).getTime()) / 86400000))
    lastActivity = `임원 ${sig.buyerCount}명 장내매수 ${buyCount}건${sig.cluster ? ' (클러스터·고확신)' : ''}`
  }

  return {
    buyCount,
    sellCount: 0,                                          // 매도 미추적(장내매수 전용 SSOT)
    buyAmt:    buyCount > 0 ? fmtAmt(sig.totalValue) : (sig.currency === 'KRW' ? '₩0' : '$0'),
    sellAmt:   '—',
    lastActivity,
    lastActivityDays: lastDays,
    cluster: sig.cluster,
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

  const isKr = market === 'KR' || isKoreanTicker(ticker)
  const unit = isKr ? '건의 증권사 리포트(최근 3개월)' : '명의 애널리스트'
  const instTail = coverage.instOwnership != null ? ` 기관 비중 ${coverage.instOwnership.toFixed(0)}%.` : ''
  const analystComment =
    coverage.count <= 5
      ? `${coverage.count}${unit} — 시장의 사각지대.${instTail || ' 기관 유입 전 초기 구간일 수 있습니다.'}`
      : coverage.count <= 15
        ? `${coverage.count}${unit} — 아직 발굴 초기 단계.${instTail}`
        : `${coverage.count}${unit} — 이미 시장의 레이더 안에 있습니다.${instTail}`

  const insiderComment =
    net > 0
      ? `최근 90일 공시 기준 임원 장내매수 ${insider.buyCount}건(${insider.buyAmt})${insider.cluster ? ' — 서로 다른 내부자 2명 이상 매수(고확신)' : ''}. ※ 장내매수만 집계(매도·보상성 지급 미포함).`
      : `최근 90일 임원 장내매수 공시 없음(EDGAR·DART 기준). ※ 매도는 미추적.`

  return {
    ticker,
    company_name:       name,
    lynch_type:         lynchType || '미분류',
    market,
    analyst_count:      coverage.count,
    analyst_change:     coverage.change,
    inst_ownership:     coverage.instOwnership ?? -1,   // -1 = 미확인(KR) — 패널이 '—' 처리
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

// ── 🔍 미보유 유령 발굴 — 위성 풀(중소형 100종·매일 크론 채점) 상위에서 유령 3축 스캔 ──────────
//    린치 유령 철학("기관이 발견하기 전에")의 발굴판 — 보유 점검만으론 반쪽(2026-08-01 사용자 지적).
//    유니버스 기반이라 **전 학생 공유 일일 캐시**(개인 데이터 없음). 서빙 시 각자 보유분만 제외.
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

async function buildDiscovery(): Promise<Omit<GhostCacheRow, 'updated_at'>[]> {
  const key = `ghost-discovery-v1:${kstDate()}`
  const cached = await getCache<Omit<GhostCacheRow, 'updated_at'>[]>(key, 24 * 3600_000)
  if (cached?.length) return cached

  const sat = (await getCache<SatelliteScore[]>(SAT_SCORE_KEY, 2 * 24 * 3600_000)) ?? []
  if (!sat.length) return []   // 위성 크론 콜드 — 정직하게 빈 목록(가짜 후보 금지)
  const cands = sat.filter(x => !x.knife).sort((a, b) => b.tenScore - a.tenScore).slice(0, 24)

  const out: Omit<GhostCacheRow, 'updated_at'>[] = []
  const q = [...cands]
  async function worker() {
    while (q.length) {
      const c = q.shift(); if (!c) break
      try { out.push(await buildGhostRecord(c.ticker.toUpperCase(), c.name, c.market, '')) }
      catch { /* 커버리지 미확인 종목은 정직 생략(가짜 행 금지) */ }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  out.sort((a, b) => b.ghost_score - a.ghost_score)
  const top = out.slice(0, 12)
  if (top.length >= 5) await setCache(key, top)   // 과반 실패 박제 금지
  return top
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

  // 🔍 발굴 스캔은 보유 분석과 독립 — 먼저 발사하고 응답 직전에 회수(워터폴 방지)
  const discoveryP = buildDiscovery().catch(() => [] as Omit<GhostCacheRow, 'updated_at'>[])

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
    const clf = getAssetClassification(h.ticker, h.name, h.market ?? 'US')
    return clf.isAnalyzable   // STOCK만 true
  })
  const excludedHoldings = holdings.filter(h => {
    const clf = getAssetClassification(h.ticker, h.name, h.market ?? 'US')
    return !clf.isAnalyzable
  }).map(h => {
    const clf = getAssetClassification(h.ticker, h.name, h.market ?? 'US')
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

  const heldSet = new Set(holdings.map(h => String(h.ticker).toUpperCase()))
  const discovery = (await discoveryP).filter(d => !heldSet.has(d.ticker.toUpperCase()))

  return NextResponse.json({
    records:  allRecords,
    discovery,                    // 🔍 미보유 유령 발굴(위성 풀 상위 · 전 학생 공유 캐시 · 내 보유 제외)
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
