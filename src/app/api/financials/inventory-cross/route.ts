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
// 실제 FMP API 연동 — Mock 데이터 완전 제거
// ════════════════════════════════════════════════════════════

interface RawFmpQuarter { date: string; revenue: number; inventory: number }

/** YYYY-MM-DD → 'YY-Q{n}' 분기 코드 변환 */
function dateToQuarterCode(dateStr: string): string {
  const d  = new Date(dateStr)
  const yy = String(d.getFullYear()).slice(-2)
  const q  = Math.ceil((d.getMonth() + 1) / 3)
  return `${yy}-Q${q}`
}

/** YoY % 계산 — prev=0이거나 null이면 null 반환 */
function calcYoY(curr: number, prev: number | undefined): number | null {
  if (!prev || prev === 0) return null
  return parseFloat(((curr - prev) / Math.abs(prev) * 100).toFixed(2))
}

/** FMP 8개 분기 원본 → 최근 4개 분기 + YoY 계산 */
function buildTrendFromFmp(
  raws: RawFmpQuarter[],
  currency: string,
): QuarterData[] {
  // FMP는 최신 순으로 반환 → 역순 정렬 후 처리
  const sorted = [...raws].sort((a, b) => a.date < b.date ? -1 : 1)
  // 최근 4개 분기 (index 4~7) + YoY 비교 기준 (index 0~3)
  const recent4 = sorted.slice(-4)
  const prev4   = sorted.slice(-8, -4)

  return recent4.map((q, i): QuarterData => {
    const prev      = prev4[i]
    const revYoY    = calcYoY(q.revenue,   prev?.revenue)
    const invYoY    = calcYoY(q.inventory, prev?.inventory)
    const signal    = calcSignal(invYoY, revYoY)
    return {
      quarter:      dateToQuarterCode(q.date),
      fiscalDate:   q.date,
      revenue:      currency === 'KRW'
        ? Math.round(q.revenue / 1e8)     // 원화: 원 → 억원
        : Math.round(q.revenue / 1e6),    // USD: 달러 → M$
      inventory:    currency === 'KRW'
        ? Math.round(q.inventory / 1e8)
        : Math.round(q.inventory / 1e6),
      revenueYoY:   revYoY,
      inventoryYoY: invYoY,
      signal,
      gap: calcGap(invYoY, revYoY),
    }
  })
}

type FetchStatus = 'ok' | 'no_key' | 'rate_limit' | 'not_found' | 'error'

interface FmpFetchResult {
  status:   FetchStatus
  quarters: RawFmpQuarter[]
  source:   string
}

/**
 * Yahoo Finance fundamentalsTimeSeries 기반 분기 재무 데이터 조회
 *
 * FMP v3 엔드포인트가 2025-08-31 이후 무료 사용자 차단됨 → Yahoo Finance로 전환
 * yahoo-finance2 라이브러리(v3.14+): fundamentalsTimeSeries API 사용
 *
 * ◆ US 주식: ticker 그대로 (NVDA, ETN, GEV, AAPL ...)
 * ◆ KR 주식: ticker + '.KQ' → '.KS' 순서로 시도
 *   - 000660 → 000660.KQ (실패 시) → 000660.KS (SK하이닉스, KOSPI)
 *   - 189300 → 189300.KQ (인텔리안테크, KOSDAQ)
 */
async function fetchFmpQuarterly(
  ticker: string,
  market: string,
): Promise<FmpFetchResult> {
  const code     = ticker.replace(/\.(KS|KQ)$/i, '')
  const suffixes = market === 'KR' ? ['.KQ', '.KS', ''] : ['']

  for (const suffix of suffixes) {
    const yTicker = code + suffix
    try {
      // yahoo-finance2 라이브러리 동적 임포트 (서버사이드 only)
      const { default: YahooFinance } = await import('yahoo-finance2')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

      // balance-sheet: inventory 데이터
      // financials: totalRevenue 데이터
      const period1 = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

      const [balData, finData] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yf.fundamentalsTimeSeries(yTicker, { module: 'balance-sheet', period1 }) as Promise<any[]>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yf.fundamentalsTimeSeries(yTicker, { module: 'financials',    period1 }) as Promise<any[]>,
      ])

      const balArr = Array.isArray(balData) ? balData : Object.values(balData)
      const finArr = Array.isArray(finData) ? finData : Object.values(finData)

      if (!finArr.length || finArr.length < 2) continue

      // 날짜 기준으로 재고 + 매출 매핑
      const quarters: RawFmpQuarter[] = finArr
        .slice(0, 8)
        .map(fin => {
          const finDate  = fin.date instanceof Date ? fin.date.toISOString().slice(0, 10) : String(fin.date ?? '').slice(0, 10)
          // 같은 날짜의 balance sheet 항목 매칭 (±5일 허용)
          const finTime  = new Date(finDate).getTime()
          const matchBal = balArr.find(b => {
            const bDate = b.date instanceof Date ? b.date.toISOString().slice(0, 10) : String(b.date ?? '').slice(0, 10)
            return Math.abs(new Date(bDate).getTime() - finTime) < 5 * 86400 * 1000
          })
          return {
            date:      finDate,
            revenue:   Number(fin.totalRevenue   ?? 0),
            inventory: Number(matchBal?.inventory ?? 0),
          }
        })
        .filter(q => q.date && q.revenue > 0)

      if (quarters.length < 2) continue

      return { status: 'ok', quarters, source: `yahoo${suffix}` }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // "Not Found" → 해당 suffix가 맞지 않음, 다음 suffix 시도
      if (msg.includes('Not Found') || msg.includes('404') || msg.toLowerCase().includes('no data')) continue
      console.error(`[inventory-cross] Yahoo Finance 오류 ${yTicker}:`, msg.slice(0, 120))
      continue
    }
  }

  return { status: 'not_found', quarters: [], source: 'yahoo' }
}

/** FMP 결과 + holding 정보 → InventoryCrossResult 조립 */
function buildResultFromFmp(
  ticker: string,
  name:   string,
  market: string,
  fmpRes: FmpFetchResult,
): InventoryCrossResult {
  const currency  = market === 'KR' ? 'KRW' : 'USD'
  const unitLabel = market === 'KR' ? '억원' : 'M$'
  const trend     = buildTrendFromFmp(fmpRes.quarters, currency)
  const latest    = trend[trend.length - 1]
  const signal    = latest?.signal     ?? 'UNKNOWN'
  const gap       = latest?.gap        ?? 0
  const consec    = countConsecutiveDanger(trend)

  return {
    ticker, name, market, currency, unitLabel,
    signal, gap,
    latestQuarter:     latest?.quarter      ?? '',
    revenueYoY:        latest?.revenueYoY   ?? 0,
    inventoryYoY:      latest?.inventoryYoY ?? 0,
    consecutiveDanger: consec,
    trend,
    lynchAlert: fmpRes.status === 'ok'
      ? buildLynchAlert(signal, name, gap, consec)
      : fmpRes.status === 'no_key'
        ? `"FMP_API_KEY 환경변수가 설정되지 않아 ${name}의 분기 재무제표를 조회할 수 없습니다. Vercel 환경변수 설정을 확인해주세요."`
        : fmpRes.status === 'rate_limit'
          ? `"FMP API 일일 호출 한도(250회) 초과. 내일 자동으로 갱신됩니다. 오늘 조회는 캐시가 없어 대기 중입니다."`
          : `"${name}의 분기 재무제표 API 조회에 실패했습니다. FMP 미지원 티커이거나 네트워크 오류일 수 있습니다. 잠시 후 새로고침해주세요."`,
    dataSource:        (fmpRes.source as 'fmp' | 'cache' | 'stub' | 'dart'),
  }
}

/**
 * 제외 사유 메시지 정교화
 * - 제조기업인데 API 실패 → "재무제표 API 로딩 실패"
 * - 소프트웨어 기업으로 판단 → "재고 없는 기업"
 */
function buildExcludeReasonV2(
  ticker:      string,
  name:        string,
  fetchStatus: FetchStatus,
  inventorySum: number,
): string {
  const t  = ticker.toUpperCase()
  const isKnownManufacturer = HAS_INVENTORY_TICKERS.has(t)

  switch (fetchStatus) {
    case 'no_key':
      return 'FMP_API_KEY 환경변수가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.'
    case 'rate_limit':
      return 'FMP API 일일 호출 한도(250회) 초과. 내일 자동으로 갱신됩니다.'
    case 'error':
      return `분기 재무제표 API 네트워크 오류. 잠시 후 새로고침해주세요.`
    case 'not_found':
      if (isKnownManufacturer) {
        return `${name}는 제조업 기업이나 FMP에서 분기 재무제표를 찾을 수 없습니다. 티커 형식 오류이거나 FMP 미지원 종목일 수 있습니다.`
      }
      return `FMP에서 ${name}의 재무제표를 찾을 수 없습니다.`
    default:
      // status === 'ok' but inventory = 0
      if (isKnownManufacturer && inventorySum === 0) {
        return `${name}는 제조업 기업이나 FMP 재고자산 데이터가 0입니다. FMP 데이터 품질 이슈이거나 재무제표 항목명 불일치일 수 있습니다.`
      }
      return '최근 4개 분기 재고자산 합계가 0입니다. 소프트웨어·금융·서비스 기업으로 자동 제외됩니다.'
  }
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

  // 오늘 updated된 캐시를 가져옴 (복수 분기 포함)
  // note: 4개 미만이면 아래에서 MISS로 판정해 재조회
  const { data: cachedRows } = await sbAdmin
    .from('stock_financial_quarters')
    .select('*')
    .in('ticker', tickers)
    .gte('updated_at', `${todayISO}T00:00:00Z`)
    .order('ticker')
    .order('quarter', { ascending: true })

  // ── 캐시 HIT 판정: 오늘 날짜 + 4개 이상 분기 보유 시만 HIT ──
  // 이유: 이전에 1개 분기만 저장된 스텁 데이터는 YoY 계산 불가 → MISS 처리
  const rowsByTicker = new Map<string, typeof cachedRows extends (infer U)[] | null ? U[] : never[]>()
  for (const row of (cachedRows ?? [])) {
    const arr = rowsByTicker.get(row.ticker) ?? []
    arr.push(row)
    rowsByTicker.set(row.ticker, arr)
  }
  // 4개 분기 미만 캐시 → MISS (API 재호출 필요)
  const cachedTickers = new Set(
    Array.from(rowsByTicker.entries())
      .filter(([, rows]) => rows.length >= 4)
      .map(([ticker]) => ticker)
  )
  const missTickers = tickers.filter(t => !cachedTickers.has(t))

  // ── 5. 캐시 MISS → 외부 API 또는 Mock 데이터 ─────────────
  const freshResults: InventoryCrossResult[] = []
  const cacheUpsertRows: object[]           = []

  // FMP API 병렬 호출 (캐시 MISS 종목)
  const fmpFetchMap = new Map<string, FmpFetchResult>()
  await Promise.all(
    missTickers.map(async ticker => {
      const holding = stockHoldings.find(h => h.ticker.toUpperCase() === ticker)
      if (!holding) return
      const res = await fetchFmpQuarterly(ticker, holding.market ?? 'US')
      fmpFetchMap.set(ticker, res)
    })
  )

  for (const ticker of missTickers) {
    const holding = stockHoldings.find(h => h.ticker.toUpperCase() === ticker)
    if (!holding) continue

    const fmpRes   = fmpFetchMap.get(ticker) ?? { status: 'error' as FetchStatus, quarters: [], source: 'fmp' }
    const result   = buildResultFromFmp(ticker, holding.name, holding.market ?? 'US', fmpRes)

    freshResults.push(result)

    // 캐시 저장용 행 준비 — 전체 4개 분기 저장 (YoY 계산에 필요)
    // 이전 버그: 최신 1개만 저장 → 캐시 HIT 시 YoY 계산 불가 → UNKNOWN
    const now = new Date().toISOString()
    for (const q of result.trend) {
      cacheUpsertRows.push({
        ticker:        result.ticker,
        quarter:       q.quarter,
        company_name:  result.name,
        market:        result.market,
        currency:      result.currency,
        unit_label:    result.unitLabel,
        fiscal_date:   q.fiscalDate || null,
        revenue:       q.revenue,
        inventory:     q.inventory,
        revenue_yoy:   q.revenueYoY,
        inventory_yoy: q.inventoryYoY,
        signal:        q.signal,
        gap:           q.gap,
        data_source:   result.dataSource,
        updated_at:    now,
      })
    }
  }

  // ── 6. 기존 스텁 캐시 삭제 + 신규 데이터 Upsert ────────────
  // missTickers의 기존 캐시를 모두 삭제한 후 새 4분기 데이터를 저장
  // (이전 1-row 스텁 데이터가 남아있으면 4개 미만 판정 → 무한 MISS 방지)
  if (missTickers.length > 0) {
    const { error: delErr } = await sbAdmin
      .from('stock_financial_quarters')
      .delete()
      .in('ticker', missTickers)
    if (delErr) console.warn('[inventory-cross] 기존 캐시 삭제 실패:', delErr)
  }

  if (cacheUpsertRows.length > 0) {
    const { error: upsertErr } = await sbAdmin
      .from('stock_financial_quarters')
      .upsert(cacheUpsertRows, { onConflict: 'ticker,quarter' })
    if (upsertErr) console.error('[inventory-cross] cache upsert 실패:', upsertErr)
  }

  // ── 7. 캐시 HIT 종목 → 결과 변환 ─────────────────────────
  const cachedResults: InventoryCrossResult[] = []
  for (const ticker of Array.from(cachedTickers)) {
    const rows = (rowsByTicker.get(ticker) ?? [])
      .slice()
      .sort((a, b) => a.quarter < b.quarter ? -1 : 1)

    if (rows.length < 4) continue  // 4개 미만은 건너뜀 (위에서 MISS로 처리됨)

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
  const rawResults = [...freshResults, ...cachedResults]
    .sort((a, b) => ORDER[a.signal] - ORDER[b.signal] || b.gap - a.gap)

  // ── 8-b. 데이터 기반 배제 — Race Condition 방지 원칙 ────────
  //
  // ★ 핵심 규칙:
  //   API 실패(no_key / rate_limit / error / not_found) → results에 UNKNOWN으로 유지
  //   API 성공 + inventory = 0 → 실제 재고 없는 기업 → excludedFromAnalysis
  //
  // 이유: API 실패 상태를 "재고 없는 기업"으로 오해하면
  //       SK하이닉스·ETN·GEV 같은 제조업 종목이 전부 탈락하는 버그 발생
  //
  const shouldExclude = (r: InventoryCrossResult): boolean => {
    const fmpRes = fmpFetchMap.get(r.ticker)

    // ① API 결과 없거나 실패 → 절대 탈락 금지 (데이터 로딩 실패일 뿐)
    if (!fmpRes || fmpRes.status !== 'ok') return false

    // ② API 성공 → 실제 재고 데이터가 하나라도 있으면 유지
    if (r.trend.some(q => (q.inventory ?? 0) > 0)) return false

    // ③ API 성공 + 재고 = 0 → 진짜 재고 없는 기업 (소프트웨어·금융 등)
    return true
  }

  const allResults = rawResults.filter(r => !shouldExclude(r))

  // 탈락 종목(API 성공 + inventory=0 케이스만) → excludedFromAnalysis 병합
  const dataExcluded: InventoryExcluded[] = rawResults
    .filter(shouldExclude)
    .map(r => {
      const fmpRes  = fmpFetchMap.get(r.ticker)
      const invSum  = r.trend.reduce((s, q) => s + (q.inventory ?? 0), 0)
      return {
        ticker: r.ticker,
        name:   r.name,
        reason: buildExcludeReasonV2(r.ticker, r.name, fmpRes?.status as FetchStatus ?? 'ok', invSum),
      }
    })

  // 하드코딩 사전 제외 + 데이터 기반 사후 제외 통합
  const finalExcluded = [...excludedFromAnalysis, ...dataExcluded]

  // ── 9. 요약 통계 ──────────────────────────────────────────
  const summary = {
    danger:  allResults.filter(r => r.signal === 'DANGER').length,
    warning: allResults.filter(r => r.signal === 'WARNING').length,
    healthy: allResults.filter(r => r.signal === 'HEALTHY').length,
    unknown: allResults.filter(r => r.signal === 'UNKNOWN').length,
  }

  return NextResponse.json({
    results:              allResults,
    excludedFromAnalysis: finalExcluded,  // 사전(heuristic) + 사후(data) 제외 통합
    summary,
    source:  freshResults.length > 0 && cachedResults.length === 0 ? 'fresh' : 'mixed',
    meta: {
      totalHoldings:   allStockHoldings.length,  // 전체 주식 보유 수
      analyzable:      stockHoldings.length,      // 재고 분석 가능 수
      excluded:        finalExcluded.length,
      analyzed:        allResults.filter(r => r.signal !== 'UNKNOWN').length,
      cacheHit:        cachedResults.length,
      cacheMiss:       freshResults.length,
      updatedAt:       new Date().toISOString(),
    },
  })
}
