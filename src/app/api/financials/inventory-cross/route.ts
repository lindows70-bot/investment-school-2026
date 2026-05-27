/**
 * GET /api/financials/inventory-cross
 *
 * ◆ 기능: 재고 vs 매출 데드크로스 추적 시스템
 *
 * 피터 린치 원칙:
 *   "재고가 매출보다 빠르게 쌓이기 시작하면 그 기업은 문제가 있는 것입니다.
 *    재고 증가율이 매출 증가율을 2분기 연속 앞지르면 즉시 경계하세요."
 *
 * ◆ 시그널 판정
 *   DANGER  : inventoryYoY > revenueYoY (데드크로스 발생)
 *   WARNING : inventoryYoY <= revenueYoY, but gap < 5% (격차 축소 경보)
 *   HEALTHY : revenueYoY >= inventoryYoY + 5 (안전 여유 확보)
 *
 * ◆ 데이터 소스 전략 (하루 1회 캐싱)
 *   캐시 HIT  → stock_financial_quarters 즉시 반환
 *   캐시 MISS → 외부 API 호출 (현재: 정교한 Mock 데이터)
 *               → US: FMP quarterly financials
 *               → KR: DART 분기보고서
 */

import { NextResponse }          from 'next/server'
import { createServerClient }    from '@supabase/ssr'
import { cookies }               from 'next/headers'
import { getAssetType }          from '@/lib/assetClassifier'

// ════════════════════════════════════════════════════════════
// 재고자산 보유 여부 판별 — 재고 센티넬 분석 대상 필터
//
// 피터 린치의 '재고 vs 매출 데드크로스'는 물리적 재고를 보유한
// 제조업·반도체·하드웨어·소매업에만 적용 가능합니다.
//
// 소프트웨어·금융·인터넷 서비스 등은 재고자산 개념 자체가 없으므로
// 분석 대상에서 자동 제외합니다.
// ════════════════════════════════════════════════════════════

/** 재고자산이 없는 업종 — 소프트웨어·금융·서비스·인터넷 등 */
const NO_INVENTORY_TICKERS = new Set([
  // ── 순수 소프트웨어 ─────────────────────────────────────
  'PLTR','CRM','ADBE','ORCL','NOW','SNOW','WDAY','ZM','DOCU','TWLO',
  'DDOG','CRWD','OKTA','SPLK','VEEV','TEAM','HUBS','BILL','ESTC',
  'NET','CFLT','MDB','GTLB','PATH','ZS','S','SMAR',
  // ── 인터넷·빅테크 서비스 ─────────────────────────────────
  'GOOGL','GOOG','META','MSFT','NFLX','UBER','LYFT','ABNB','SNAP','PINS',
  'TWTR','SPOT','RBLX','U','AI','CPNG','GRAB',
  // ── 금융 (은행·증권·보험·카드) ──────────────────────────
  'JPM','GS','MS','BAC','C','WFC','USB','TFC','PNC','SCHW','IBKR',
  'V','MA','AXP','DFS','COF','PYPL','SQ','AFRM',
  'BRK','BRK.A','BRK.B',
  'BLK','GS','MS','RJF','IVZ','TROW',
  'MET','PRU','AFL','AIG','TRV','CB','AON','MMC','AJG',
  'AMP','PGR','ALL','CNA',
  // ── 통신 서비스 ─────────────────────────────────────────
  'T','VZ','TMUS','CMCSA','CHTR','LUMN',
  // ── 헬스케어 서비스 (제조 아님) ─────────────────────────
  'UNH','CVS','MCK','ABC','CI','HUM','MOH','CNC','ELV',
  // ── 한국 금융·서비스 ─────────────────────────────────────
  '055550','105560','086790','032830','030200','017670','000100',
])

/** 이름에 포함되면 소프트웨어·서비스로 판별 */
const NO_INVENTORY_NAME_KW = [
  'SOFTWARE','CLOUD','SAAS','DIGITAL SERVICES','INTERNET SERVICES',
  'FINANCIAL SERVICES','BANCORP','BANCSHARES','FINANCIAL GROUP',
  'INSURANCE','REINSURANCE',
  'ADVISORY','CONSULTING',
  'STREAMING','SOCIAL NETWORK',
]

/** 재고자산이 명확히 존재하는 업종 허용 목록 */
const HAS_INVENTORY_TICKERS = new Set([
  // ── 반도체 (가장 중요한 재고 추적 대상) ────────────────
  'NVDA','AMD','INTC','QCOM','MU','AVGO','TXN','AMAT','LRCX','KLAC',
  'ASML','MRVL','ON','SWKS','QRVO','MPWR','WOLF','ENTG',
  'TSM','ASX',
  // ── 하드웨어·가전 ────────────────────────────────────────
  'AAPL','DELL','HPQ','HPE','NTAP','STX','WDC','SEAGATE',
  'SNX','CDW',
  // ── 자동차 ──────────────────────────────────────────────
  'TSLA','F','GM','STLA','TM','HMC','RIVN','LCID',
  // ── 산업재·제조 ─────────────────────────────────────────
  'GE','GEV','ETN','CAT','DE','HON','MMM','EMR','ROK','ITW',
  'PH','GWW','CMI','PCAR','TEL','AME','FTV','DHR','A',
  // ── 소매·유통 (재고 추적 핵심) ──────────────────────────
  'WMT','TGT','COST','HD','LOW','NKE','LULU','PVH','HBI',
  // ── 소비재·식품음료 ─────────────────────────────────────
  'PG','KO','PEP','CL','CHD','CLX','GIS','CAG','K','CPB',
  'PM','MO','BTI',
  // ── 에너지 장비·소재 ────────────────────────────────────
  'SLB','HAL','BKR','NOV',
  // ── 특수 케이스 (Mock 데이터 포함) ──────────────────────
  'TEM',
  // ── 한국 제조업 ─────────────────────────────────────────
  '000660','005930','005380','000270','066570','006400','009150',
  '051910','207940','068270','010130','006280','003490','011200',
  '034220','042660','329180','000830','001680',
])

export interface InventoryExcluded {
  ticker:  string
  name:    string
  reason:  string   // 제외 사유 설명
}

/**
 * 재고자산 보유 여부 판별 — 센티넬 분석 대상 여부 반환
 * @returns true = 분석 가능 (제조업 등), false = 제외 (소프트웨어·금융 등)
 */
function hasPhysicalInventory(ticker: string, name: string): boolean {
  const t = ticker.toUpperCase()
  const n = name.toUpperCase()

  // 명시적 허용 목록 우선
  if (HAS_INVENTORY_TICKERS.has(t)) return true

  // 명시적 제외 목록
  if (NO_INVENTORY_TICKERS.has(t)) return false

  // 종목명 키워드로 제외 판별
  if (NO_INVENTORY_NAME_KW.some(kw => n.includes(kw))) return false

  // 기본값: 분석 포함 (알 수 없는 종목은 보수적으로 포함하여 추후 데이터로 판별)
  return true
}

/** 제외 사유 메시지 생성 */
function buildExcludeReason(ticker: string, name: string): string {
  const t = ticker.toUpperCase()
  const n = name.toUpperCase()

  if (NO_INVENTORY_TICKERS.has(t)) {
    if (['JPM','GS','MS','BAC','C','WFC','V','MA','AXP','DFS','COF','PYPL',
         'BRK','MET','PRU','AFL','AIG','055550','105560','086790','032830'].some(f => t === f)) {
      return '금융·보험·카드사는 물리적 재고자산이 없어 재고 리스크 분석 대상이 아닙니다.'
    }
    if (['T','VZ','TMUS','CMCSA','CHTR','017670','030200'].some(f => t === f)) {
      return '통신 서비스 기업은 재고자산 개념이 없어 분석 대상에서 제외됩니다.'
    }
    return '소프트웨어·인터넷 서비스 기업은 물리적 재고가 없어 재고 vs 매출 분석을 적용할 수 없습니다.'
  }

  if (NO_INVENTORY_NAME_KW.some(kw => n.includes(kw))) {
    return `종목명 패턴 분석 결과 서비스·금융 기업으로 분류되어 재고 분석에서 제외됩니다.`
  }

  return '재고자산이 없는 업종으로 분류되어 센티넬 분석 대상이 아닙니다.'
}

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
export type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN'

export interface QuarterData {
  quarter:       string    // 'YY-Q{1-4}' (예: '25-Q1')
  fiscalDate:    string    // ISO date
  revenue:       number    // 매출액 (단위는 unitLabel)
  inventory:     number    // 재고자산
  revenueYoY:    number | null   // YoY % (null = 비교 불가)
  inventoryYoY:  number | null
  signal:        CrossSignal
  gap:           number | null   // inventoryYoY - revenueYoY
}

export interface InventoryCrossResult {
  ticker:        string
  name:          string
  market:        string
  currency:      string
  unitLabel:     string    // 'M$' or '억원'
  signal:        CrossSignal
  gap:           number    // 최신 분기 gap
  latestQuarter: string
  revenueYoY:    number
  inventoryYoY:  number
  consecutiveDanger: number   // 연속 DANGER 분기 수
  trend:         QuarterData[]  // 최근 4개 분기
  lynchAlert:    string    // 린치 스타일 경보 메시지
  dataSource:    'cache' | 'stub' | 'fmp' | 'dart'
}

// ────────────────────────────────────────────────────────────
// 시그널 계산 유틸
// ────────────────────────────────────────────────────────────
function calcSignal(invYoY: number | null, revYoY: number | null): CrossSignal {
  if (invYoY === null || revYoY === null) return 'UNKNOWN'
  const gap = invYoY - revYoY
  if (gap > 0)   return 'DANGER'
  if (gap > -5)  return 'WARNING'
  return 'HEALTHY'
}

function calcGap(invYoY: number | null, revYoY: number | null): number | null {
  if (invYoY === null || revYoY === null) return null
  return parseFloat((invYoY - revYoY).toFixed(2))
}

/** 연속 DANGER 분기 수 계산 (최신 → 과거 방향으로 카운트) */
function countConsecutiveDanger(trend: QuarterData[]): number {
  let count = 0
  for (const q of [...trend].reverse()) {  // 최신 분기부터
    if (q.signal === 'DANGER') count++
    else break
  }
  return count
}

/** 린치 경보 메시지 생성 */
function buildLynchAlert(
  signal:     CrossSignal,
  name:       string,
  gap:        number,
  consecutive: number,
): string {
  if (signal === 'DANGER') {
    const absGap = Math.abs(gap).toFixed(1)
    if (consecutive >= 2) {
      return `"위험 신호! ${name}의 재고가 매출보다 ${absGap}%p 빠르게 쌓이는 상황이 ${consecutive}분기 연속 지속되고 있습니다. ` +
             `린치는 '재고가 2분기 연속으로 매출보다 빠르게 늘어나면 즉시 팔라'고 했습니다. 포지션을 재검토하세요."`
    }
    return `"${name}의 재고 증가율이 매출 증가율을 ${absGap}%p 앞질렀습니다. ` +
           `단 1분기이므로 아직 확정적이지 않지만, 다음 분기에도 이어진다면 린치의 매도 신호입니다."`
  }
  if (signal === 'WARNING') {
    const absGap = Math.abs(gap).toFixed(1)
    return `"${name}는 아직 역전되지 않았지만, 재고와 매출 성장률 격차가 ${absGap}%p로 좁혀졌습니다. ` +
           `데드크로스 전조 단계입니다. 다음 분기 재고 동향을 주시하세요."`
  }
  if (signal === 'HEALTHY') {
    return `"${name}는 매출이 재고보다 건강하게 앞서고 있습니다. ` +
           `린치가 좋아하는 '팔리는 속도 > 쌓이는 속도' 상태입니다. 현 포지션 유지가 적합합니다."`
  }
  return `"${name}의 재고·매출 데이터를 수집 중입니다. 다음 새로고침 때 분석 결과가 업데이트됩니다."`
}

// ════════════════════════════════════════════════════════════
// 정교한 Mock 데이터 (화면 개발 + 테스트용)
// 실제 분기 실적 기반 — 외부 API 연동 시 이 데이터로 검증
// ════════════════════════════════════════════════════════════

type MockQuarterRaw = {
  quarter:    string
  fiscalDate: string
  revenue:    number
  inventory:  number
  revYoY:     number | null
  invYoY:     number | null
}

const MOCK_DATA: Record<string, {
  name:      string
  market:    string
  currency:  string
  unitLabel: string
  quarters:  MockQuarterRaw[]
}> = {

  // ── SK하이닉스 (000660) — DANGER 시나리오 ──────────────────
  // 반도체 업황 사이클: HBM 공급 확대 국면에서 재고 급증
  '000660': {
    name: 'SK하이닉스', market: 'KR', currency: 'KRW', unitLabel: '억원',
    quarters: [
      // 기준 분기 (YoY 없음)
      { quarter: '24-Q1', fiscalDate: '2024-03-31', revenue: 128_613, inventory: 146_720,
        revYoY: null, invYoY: null },
      // 실적 회복세 but 재고 더 빠르게 증가
      { quarter: '24-Q2', fiscalDate: '2024-06-30', revenue: 167_234, inventory: 158_340,
        revYoY: 124.8, invYoY: 72.4 },
      { quarter: '24-Q3', fiscalDate: '2024-09-30', revenue: 175_650, inventory: 178_900,
        revYoY: 94.2, invYoY: 82.3 },
      // 매출 증가 둔화 + 재고 급증 → DANGER 시작
      { quarter: '24-Q4', fiscalDate: '2024-12-31', revenue: 192_080, inventory: 198_340,
        revYoY: 37.5, invYoY: 68.9 },
      // 최신 분기: 명백한 DANGER
      { quarter: '25-Q1', fiscalDate: '2025-03-31', revenue: 178_560, inventory: 231_450,
        revYoY: 38.8, invYoY: 57.7 },
    ],
  },

  // ── NVIDIA (NVDA) — WARNING 시나리오 ──────────────────────
  // AI 데이터센터 수요로 매출 폭증 but 재고도 빠르게 추격 중
  'NVDA': {
    name: 'NVIDIA Corporation', market: 'US', currency: 'USD', unitLabel: 'M$',
    quarters: [
      { quarter: '24-Q1', fiscalDate: '2024-04-28', revenue: 26_044, inventory: 5_282,
        revYoY: null, invYoY: null },
      { quarter: '24-Q2', fiscalDate: '2024-07-28', revenue: 30_040, inventory: 5_921,
        revYoY: 122.4, invYoY: 95.1 },
      { quarter: '24-Q3', fiscalDate: '2024-10-27', revenue: 35_082, inventory: 6_675,
        revYoY: 93.6, invYoY: 115.3 },  // 재고 YoY 급등
      { quarter: '24-Q4', fiscalDate: '2025-01-26', revenue: 39_331, inventory: 7_471,
        revYoY: 77.9, invYoY: 76.1 },   // 격차 1.8% → WARNING
      // 최신: 격차 2.3% → WARNING 지속
      { quarter: '25-Q1', fiscalDate: '2025-04-27', revenue: 44_062, inventory: 8_274,
        revYoY: 69.2, invYoY: 71.5 },   // 역전 직전 경보
    ],
  },

  // ── Apple (AAPL) — HEALTHY 시나리오 ───────────────────────
  // 성숙 소비재 기업의 교과서적 재고 관리
  'AAPL': {
    name: 'Apple Inc.', market: 'US', currency: 'USD', unitLabel: 'M$',
    quarters: [
      { quarter: '24-Q1', fiscalDate: '2023-12-30', revenue: 119_575, inventory: 6_511,
        revYoY: null, invYoY: null },
      { quarter: '24-Q2', fiscalDate: '2024-03-30', revenue: 90_753,  inventory: 6_232,
        revYoY: 4.3,  invYoY: -8.6 },
      { quarter: '24-Q3', fiscalDate: '2024-06-29', revenue: 85_777,  inventory: 7_286,
        revYoY: 4.9,  invYoY: -3.2 },
      { quarter: '24-Q4', fiscalDate: '2024-09-28', revenue: 94_930,  inventory: 6_382,
        revYoY: 6.1,  invYoY: -12.4 },
      // 최신: 매출↑ + 재고↓ → 모범적 HEALTHY
      { quarter: '25-Q1', fiscalDate: '2024-12-28', revenue: 124_300, inventory: 7_050,
        revYoY: 4.0,  invYoY: -5.1 },
    ],
  },
}

// ────────────────────────────────────────────────────────────
// Mock 데이터 → InventoryCrossResult 변환
// ────────────────────────────────────────────────────────────
function buildResultFromMock(
  ticker: string,
  mock: typeof MOCK_DATA[string],
): InventoryCrossResult {
  // 첫 분기(기준 분기) 제외하고 YoY가 있는 분기만 사용
  const validQuarters = mock.quarters.filter(q => q.revYoY !== null)

  const trend: QuarterData[] = validQuarters.map(q => {
    const signal = calcSignal(q.invYoY, q.revYoY)
    return {
      quarter:      q.quarter,
      fiscalDate:   q.fiscalDate,
      revenue:      q.revenue,
      inventory:    q.inventory,
      revenueYoY:   q.revYoY,
      inventoryYoY: q.invYoY,
      signal,
      gap: calcGap(q.invYoY, q.revYoY),
    }
  })

  const latest     = trend[trend.length - 1]
  const signal     = latest?.signal     ?? 'UNKNOWN'
  const gap        = latest?.gap        ?? 0
  const consecutive = countConsecutiveDanger(trend)

  return {
    ticker,
    name:          mock.name,
    market:        mock.market,
    currency:      mock.currency,
    unitLabel:     mock.unitLabel,
    signal,
    gap,
    latestQuarter: latest?.quarter       ?? '',
    revenueYoY:    latest?.revenueYoY    ?? 0,
    inventoryYoY:  latest?.inventoryYoY  ?? 0,
    consecutiveDanger: consecutive,
    trend,
    lynchAlert:    buildLynchAlert(signal, mock.name, gap, consecutive),
    dataSource:    'stub',
  }
}

// ────────────────────────────────────────────────────────────
// [스터브] 외부 API 호출 함수
// ────────────────────────────────────────────────────────────

/**
 * US 주식: FMP Quarterly Income Statement + Balance Sheet
 * TODO: 실제 연동
 *   https://financialmodelingprep.com/api/v3/income-statement/{ticker}?period=quarter&limit=8&apikey={KEY}
 *   https://financialmodelingprep.com/api/v3/balance-sheet-statement/{ticker}?period=quarter&limit=8&apikey={KEY}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchUsQuarterlyData(ticker: string) {
  // const KEY = process.env.FMP_API_KEY
  // if (!KEY) return null
  // try {
  //   const [incomeRes, balanceRes] = await Promise.all([
  //     fetch(`https://financialmodelingprep.com/api/v3/income-statement/${ticker}?period=quarter&limit=8&apikey=${KEY}`),
  //     fetch(`https://financialmodelingprep.com/api/v3/balance-sheet-statement/${ticker}?period=quarter&limit=8&apikey=${KEY}`)
  //   ])
  //   const income  = await incomeRes.json()
  //   const balance = await balanceRes.json()
  //   // ... 분기별 revenue + inventory 추출 및 YoY 계산
  // } catch { return null }
  return null
}

/**
 * KR 주식: DART 분기보고서 재무상태표 + 포괄손익계산서
 * TODO: 실제 연동
 *   DART corp_code 조회 후 → /api/fnlttSinglAcntAll.json
 *   revenue     = 손익계산서 '매출액' 행
 *   inventory   = 재무상태표 '재고자산' 행
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchKrQuarterlyData(ticker: string) {
  // const DART_KEY = process.env.DART_API_KEY
  // if (!DART_KEY) return null
  // ... DART API 구현
  return null
}

// ════════════════════════════════════════════════════════════
// GET 핸들러
// ════════════════════════════════════════════════════════════
export async function GET() {
  const cookieStore = await cookies()

  // ── 1. 인증 확인 ────────────────────────────────────────
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    },
  )

  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 2. 서비스 롤 클라이언트 ─────────────────────────────
  const { createClient: mkAdmin } = await import('@supabase/supabase-js')
  const sbAdmin = mkAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── 3. 포트폴리오 내 주식(STOCK) 종목만 조회 ─────────────
  const { data: holdings, error: holdErr } = await sbAdmin
    .from('investments')
    .select('ticker, name, market')
    .eq('user_id', user.id)

  if (holdErr) {
    return NextResponse.json({ error: holdErr.message }, { status: 500 })
  }

  // STOCK 자산만 필터 (ETF·CRYPTO·COMMODITY 제외)
  const allStockHoldings = (holdings ?? []).filter(h =>
    getAssetType(h.ticker, h.name, h.market ?? 'US') === 'STOCK'
  )

  // 재고자산이 없는 업종(소프트웨어·금융·서비스 등) 제외 — 2차 필터
  const stockHoldings = allStockHoldings.filter(h =>
    hasPhysicalInventory(h.ticker, h.name)
  )

  // 제외된 종목 목록 (UI 안내용)
  const excludedFromAnalysis: InventoryExcluded[] = allStockHoldings
    .filter(h => !hasPhysicalInventory(h.ticker, h.name))
    .map(h => ({
      ticker: h.ticker.toUpperCase(),
      name:   h.name,
      reason: buildExcludeReason(h.ticker, h.name),
    }))

  if (stockHoldings.length === 0) {
    return NextResponse.json({
      results:              [],
      excludedFromAnalysis,
      summary:              { danger: 0, warning: 0, healthy: 0, unknown: 0 },
      source:               'empty',
      message:              excludedFromAnalysis.length > 0
        ? '현재 포트폴리오에 재고 리스크를 추적할 제조업/하드웨어 종목이 없습니다.'
        : '포트폴리오에 분석 가능한 주식이 없습니다.',
    })
  }

  const tickers = stockHoldings.map(h => h.ticker.toUpperCase())

  // ── 4. 캐시 확인 (오늘 날짜 기준, 최근 4개 분기) ──────────
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data: cachedRows } = await sbAdmin
    .from('stock_financial_quarters')
    .select('*')
    .in('ticker', tickers)
    .gte('updated_at', `${todayISO}T00:00:00Z`)
    .order('ticker')
    .order('quarter', { ascending: false })

  // 오늘 캐시가 있는 ticker 세트
  const cachedTickers = new Set((cachedRows ?? []).map(r => r.ticker))
  const missTickers   = tickers.filter(t => !cachedTickers.has(t))

  // ── 5. 캐시 MISS → 외부 API 또는 Mock 데이터 ─────────────
  const freshResults: InventoryCrossResult[] = []
  const cacheUpsertRows: object[]           = []

  for (const ticker of missTickers) {
    const holding = stockHoldings.find(h => h.ticker.toUpperCase() === ticker)
    if (!holding) continue

    let result: InventoryCrossResult | null = null

    // ① Mock 데이터 (알려진 종목 — 개발/테스트용)
    if (MOCK_DATA[ticker]) {
      result = buildResultFromMock(ticker, MOCK_DATA[ticker])
    }
    // ② 실제 외부 API 호출 (TODO: 연동 시 활성화)
    // else if (holding.market === 'KR') {
    //   const raw = await fetchKrQuarterlyData(ticker)
    //   if (raw) result = buildResultFromExternal(ticker, holding.name, raw)
    // } else {
    //   const raw = await fetchUsQuarterlyData(ticker)
    //   if (raw) result = buildResultFromExternal(ticker, holding.name, raw)
    // }

    // ③ 연동 미완료 종목 → UNKNOWN 처리
    if (!result) {
      result = {
        ticker,
        name:          holding.name,
        market:        holding.market ?? 'US',
        currency:      holding.market === 'KR' ? 'KRW' : 'USD',
        unitLabel:     holding.market === 'KR' ? '억원' : 'M$',
        signal:        'UNKNOWN',
        gap:           0,
        latestQuarter: '',
        revenueYoY:    0,
        inventoryYoY:  0,
        consecutiveDanger: 0,
        trend:         [],
        lynchAlert:    `"${holding.name}의 분기별 재고·매출 데이터를 수집 중입니다. 외부 API 연동 후 분석이 시작됩니다."`,
        dataSource:    'stub',
      }
    }

    freshResults.push(result)

    // 캐시 저장용 행 준비 (최신 분기만)
    if (result.trend.length > 0) {
      const latest = result.trend[result.trend.length - 1]
      cacheUpsertRows.push({
        ticker:        result.ticker,
        quarter:       latest.quarter,
        company_name:  result.name,
        market:        result.market,
        currency:      result.currency,
        unit_label:    result.unitLabel,
        fiscal_date:   latest.fiscalDate || null,
        revenue:       latest.revenue,
        inventory:     latest.inventory,
        revenue_yoy:   latest.revenueYoY,
        inventory_yoy: latest.inventoryYoY,
        signal:        latest.signal,
        gap:           latest.gap,
        data_source:   result.dataSource,
        updated_at:    new Date().toISOString(),
      })
    }
  }

  // ── 6. 캐시 Upsert ────────────────────────────────────────
  if (cacheUpsertRows.length > 0) {
    const { error: upsertErr } = await sbAdmin
      .from('stock_financial_quarters')
      .upsert(cacheUpsertRows, { onConflict: 'ticker,quarter' })
    if (upsertErr) console.error('[inventory-cross] cache upsert 실패:', upsertErr)
  }

  // ── 7. 캐시 HIT 종목 → 결과 변환 ─────────────────────────
  const cachedResults: InventoryCrossResult[] = []
  for (const ticker of Array.from(cachedTickers)) {
    const rows = (cachedRows ?? [])
      .filter(r => r.ticker === ticker)
      .sort((a, b) => a.quarter < b.quarter ? -1 : 1)

    if (rows.length === 0) continue

    const latest = rows[rows.length - 1]
    const holding = stockHoldings.find(h => h.ticker.toUpperCase() === ticker)

    const trend: QuarterData[] = rows.map(r => ({
      quarter:      r.quarter,
      fiscalDate:   r.fiscal_date ?? '',
      revenue:      Number(r.revenue),
      inventory:    Number(r.inventory),
      revenueYoY:   r.revenue_yoy   !== null ? Number(r.revenue_yoy)   : null,
      inventoryYoY: r.inventory_yoy !== null ? Number(r.inventory_yoy) : null,
      signal:       (r.signal as CrossSignal) ?? 'UNKNOWN',
      gap:          r.gap !== null ? Number(r.gap) : null,
    }))

    const consecutive = countConsecutiveDanger(trend)
    const signal      = (latest.signal as CrossSignal) ?? 'UNKNOWN'
    const gap         = latest.gap !== null ? Number(latest.gap) : 0

    cachedResults.push({
      ticker,
      name:          latest.company_name || holding?.name || ticker,
      market:        latest.market   || 'US',
      currency:      latest.currency || 'USD',
      unitLabel:     latest.unit_label || 'M$',
      signal,
      gap,
      latestQuarter: latest.quarter,
      revenueYoY:    latest.revenue_yoy   !== null ? Number(latest.revenue_yoy)   : 0,
      inventoryYoY:  latest.inventory_yoy !== null ? Number(latest.inventory_yoy) : 0,
      consecutiveDanger: consecutive,
      trend,
      lynchAlert:    buildLynchAlert(signal, latest.company_name || ticker, gap, consecutive),
      dataSource:    'cache',
    })
  }

  // ── 8. 최종 결과 조합 + 정렬 (DANGER → WARNING → HEALTHY) ──
  const ORDER: Record<CrossSignal, number> = {
    DANGER: 0, WARNING: 1, HEALTHY: 2, UNKNOWN: 3,
  }
  const allResults = [...freshResults, ...cachedResults]
    .sort((a, b) => ORDER[a.signal] - ORDER[b.signal] || b.gap - a.gap)

  // ── 9. 요약 통계 ──────────────────────────────────────────
  const summary = {
    danger:  allResults.filter(r => r.signal === 'DANGER').length,
    warning: allResults.filter(r => r.signal === 'WARNING').length,
    healthy: allResults.filter(r => r.signal === 'HEALTHY').length,
    unknown: allResults.filter(r => r.signal === 'UNKNOWN').length,
  }

  return NextResponse.json({
    results:              allResults,
    excludedFromAnalysis,   // 소프트웨어·금융 등 제외 종목 목록
    summary,
    source:  freshResults.length > 0 && cachedResults.length === 0 ? 'fresh' : 'mixed',
    meta: {
      totalHoldings:   allStockHoldings.length,  // 전체 주식 보유 수
      analyzable:      stockHoldings.length,      // 재고 분석 가능 수
      excluded:        excludedFromAnalysis.length,
      analyzed:        allResults.filter(r => r.signal !== 'UNKNOWN').length,
      cacheHit:        cachedResults.length,
      cacheMiss:       freshResults.length,
      updatedAt:       new Date().toISOString(),
    },
  })
}
