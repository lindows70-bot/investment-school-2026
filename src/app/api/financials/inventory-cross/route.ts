/**
 * GET /api/financials/inventory-cross
 *
 * ◆ 국가별 이원화 데이터 수집 파이프라인 (무료, 무제한)
 *
 *  미국 주식 (영문 티커: NVDA, ETN, GEV ...)
 *    → yahoo-finance2 라이브러리 fundamentalsTimeSeries API
 *    → balance-sheet 모듈: 재고자산(inventory) 분기별
 *    → financials 모듈:   매출액(totalRevenue) 분기별
 *
 *  한국 주식 (6자리 숫자 티커: 000660, 189300 ...)
 *    → 네이버 페이 증권 PC 버전 HTML 스크래핑 (fetch + cheerio)
 *    → URL: finance.naver.com/item/coinfo.naver?code=&target=finsum_more
 *    → 분기 재무제표 테이블에서 매출액 + 재고자산 행 파싱
 *
 *  공통 출력 포맷: { quarter:'24-Q3', revenue:N, inventory:N, revenueYoY:%, inventoryYoY:% }
 */

import { NextResponse }       from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies }            from 'next/headers'
import { getAssetType }       from '@/lib/assetClassifier'

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
export type CrossSignal = 'DANGER' | 'WARNING' | 'HEALTHY' | 'UNKNOWN'
type FetchStatus = 'ok' | 'not_found' | 'error'

export interface QuarterData {
  quarter:       string
  fiscalDate:    string
  revenue:       number    // 억원 or M$
  inventory:     number
  revenueYoY:    number | null
  inventoryYoY:  number | null
  signal:        CrossSignal
  gap:           number | null
}

export interface InventoryCrossResult {
  ticker:           string
  name:             string
  market:           string
  currency:         string
  unitLabel:        string
  signal:           CrossSignal
  gap:              number
  latestQuarter:    string
  revenueYoY:       number
  inventoryYoY:     number
  consecutiveDanger: number
  trend:            QuarterData[]
  lynchAlert:       string
  dataSource:       string
}

export interface InventoryExcluded {
  ticker:  string
  name:    string
  reason:  string
}

interface RawQuarter { date: string; revenue: number; inventory: number }

interface FetchResult {
  status:   FetchStatus
  quarters: RawQuarter[]
  source:   string
  errorMsg?: string
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
function countConsecutiveDanger(trend: QuarterData[]): number {
  let n = 0
  for (const q of [...trend].reverse()) { if (q.signal === 'DANGER') n++; else break }
  return n
}
function dateToQ(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  const yy  = String(dt.getFullYear()).slice(-2)
  const q   = Math.ceil((dt.getMonth() + 1) / 3)
  return `${yy}-Q${q}`
}
function yoy(curr: number, prev: number | undefined): number | null {
  if (!prev || prev === 0) return null
  return parseFloat(((curr - prev) / Math.abs(prev) * 100).toFixed(2))
}

/** 8개 분기 원본 → 최근 4개 YoY 계산 (currency별 단위 변환)
 *  ★ 방어 코드:
 *   - 전년 동기 데이터 없으면 YoY = null (NaN 전파 방지)
 *   - NVDA 같은 비표준 회계연도: 날짜 ±45일 유연 매칭
 *   - 개별 분기 계산 에러 시 try-catch로 격리
 */
function buildTrend(raws: RawQuarter[], currency: string): QuarterData[] {
  if (!Array.isArray(raws) || raws.length === 0) return []

  // 날짜 오름차순 정렬
  const sorted = [...raws]
    .filter(q => q.date && q.revenue > 0)
    .sort((a, b) => a.date < b.date ? -1 : 1)

  const recent = sorted.slice(-4)
  const older  = sorted.slice(0, -4)  // 전년 동기 후보군

  return recent.map((q): QuarterData => {
    try {
      const toUnit = (v: number) => currency === 'KRW' ? v : Math.round(v / 1e6)
      const rev = toUnit(Number(q.revenue   ?? 0))
      const inv = toUnit(Number(q.inventory ?? 0))

      // 전년 동기 유연 매칭: ±45일 범위 내 가장 가까운 날짜
      const qMs = new Date(q.date).getTime()
      const oneYearMs = 365 * 86400_000
      const prevCandidates = older.filter(p => {
        const diff = Math.abs(new Date(p.date).getTime() - (qMs - oneYearMs))
        return diff < 45 * 86400_000   // ±45일
      })
      const p = prevCandidates.length > 0
        ? prevCandidates.sort((a, b) => {
            const da = Math.abs(new Date(a.date).getTime() - (qMs - oneYearMs))
            const db = Math.abs(new Date(b.date).getTime() - (qMs - oneYearMs))
            return da - db
          })[0]
        : undefined  // 전년 동기 없음 → YoY = null

      const pRev = p ? toUnit(Number(p.revenue   ?? 0)) : undefined
      const pInv = p ? toUnit(Number(p.inventory ?? 0)) : undefined

      const revYoY = yoy(rev, pRev)
      const invYoY = yoy(inv, pInv)
      const signal = calcSignal(invYoY, revYoY)

      return {
        quarter:      dateToQ(q.date),
        fiscalDate:   q.date,
        revenue:      rev,
        inventory:    inv,
        revenueYoY:   revYoY,
        inventoryYoY: invYoY,
        signal,
        gap:          calcGap(invYoY, revYoY),
      }
    } catch (err) {
      // 개별 분기 계산 오류 → UNKNOWN으로 처리 (전체 중단 금지)
      console.error(`[inventory-cross] buildTrend 분기 오류 (${q.date}):`, err)
      return {
        quarter:      dateToQ(q.date), fiscalDate: q.date,
        revenue:      0, inventory: 0,
        revenueYoY:   null, inventoryYoY: null,
        signal:       'UNKNOWN', gap: null,
      }
    }
  })
}

// ════════════════════════════════════════════════════════════
// ① 미국 주식: yahoo-finance2 fundamentalsTimeSeries
// ════════════════════════════════════════════════════════════
async function fetchUsQuarterly(ticker: string): Promise<FetchResult> {
  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf     = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
    // ★ 4년치 데이터 요청 — YoY 계산에는 8개 분기(2년)가 필요
    //   2.5년 → Yahoo Finance가 5~7분기만 반환 → 전년 동기 없음 → YoY=null → 차트 공백
    //   4년 요청 시 12~16분기 반환 → 안정적 YoY 계산 가능
    const since  = new Date(Date.now() - 4 * 365 * 86400 * 1000).toISOString().slice(0, 10)

    // ★ Promise.allSettled: 한쪽 실패해도 다른 쪽 데이터 활용 (전체 크래시 방지)
    console.log(`[inventory-cross] US Yahoo 조회 시작: ${ticker}`)
    const [balResult, finResult] = await Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yf.fundamentalsTimeSeries(ticker, { module: 'balance-sheet', period1: since }) as Promise<any[]>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yf.fundamentalsTimeSeries(ticker, { module: 'financials',    period1: since }) as Promise<any[]>,
    ])

    if (balResult.status === 'rejected') {
      console.error(`[inventory-cross] ${ticker} balance-sheet 오류:`, balResult.reason?.message ?? balResult.reason)
    }
    if (finResult.status === 'rejected') {
      console.error(`[inventory-cross] ${ticker} financials 오류:`, finResult.reason?.message ?? finResult.reason)
      return { status: 'error', quarters: [], source: 'yahoo-us',
        errorMsg: `financials 조회 실패: ${finResult.reason?.message ?? '알 수 없는 오류'}` }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balArr: any[] = balResult.status === 'fulfilled'
      ? (Array.isArray(balResult.value) ? balResult.value : Object.values(balResult.value as object))
      : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finRaw = (finResult as PromiseFulfilledResult<any>).value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finArr: any[] = Array.isArray(finRaw) ? finRaw : Object.values(finRaw as object)

    const balList = balArr
    const finList = finArr

    if (!finList.length) return { status: 'not_found', quarters: [], source: 'yahoo-us' }

    const quarters: RawQuarter[] = finList.map(fin => {
      const dRaw   = fin.date
      const dStr   = dRaw instanceof Date
        ? dRaw.toISOString().slice(0, 10)
        : String(dRaw ?? '').slice(0, 10)
      const finMs  = new Date(dStr).getTime()
      // 날짜 ±7일 범위로 대차대조표 매칭
      const matchB = balList.find(b => {
        const bd = b.date instanceof Date
          ? b.date.toISOString().slice(0, 10)
          : String(b.date ?? '').slice(0, 10)
        return Math.abs(new Date(bd).getTime() - finMs) < 7 * 86400_000
      })
      return {
        date:      dStr,
        revenue:   Number(fin.totalRevenue   ?? 0),
        inventory: Number(matchB?.inventory  ?? 0),
      }
    }).filter(q => q.date && q.revenue > 0)

    if (quarters.length < 4) return { status: 'not_found', quarters: [], source: 'yahoo-us' }

    return { status: 'ok', quarters, source: 'yahoo-us' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[inventory-cross] US Yahoo 오류 ${ticker}:`, msg.slice(0, 120))
    return { status: 'error', quarters: [], source: 'yahoo-us', errorMsg: msg }
  }
}

// ════════════════════════════════════════════════════════════
// ② 한국 주식: 네이버 페이 증권 HTML 스크래핑 (fetch + cheerio)
// ════════════════════════════════════════════════════════════
const NAVER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer':         'https://finance.naver.com/',
}

/** 숫자 문자열 → 억원 단위 숫자 변환 ("12,861" → 12861, "-" → 0) */
function parseKrNumber(s: string): number {
  const clean = s.replace(/[,\s]/g, '').trim()
  if (!clean || clean === '-' || clean === 'N/A') return 0
  return parseFloat(clean) || 0
}

/** 네이버 증권 스크래핑 실제 로직 (내부 함수) */
async function _naverScrapingCore(code: string): Promise<FetchResult> {
  const url = `https://finance.naver.com/item/coinfo.naver?code=${code}&target=finsum_more`
  console.log(`[inventory-cross] KR 네이버 스크래핑 시작: ${code}`)

  // HTTP fetch (cache: no-store 로 next 캐시 간섭 방지)
  const res = await fetch(url, { headers: NAVER_HEADERS, cache: 'no-store' })
  if (!res.ok) {
    console.error(`[inventory-cross] ${code} 네이버 HTTP ${res.status}`)
    return { status: 'not_found', quarters: [], source: 'naver', errorMsg: `HTTP ${res.status}` }
  }

  // EUC-KR → 문자열 변환
  const rawBuf = await res.arrayBuffer()
  let html: string
  try { html = new TextDecoder('euc-kr').decode(rawBuf) }
  catch { html = new TextDecoder('utf-8').decode(rawBuf) }

  // cheerio 파싱
  const { load } = await import('cheerio')
  const $        = load(html)
  const table    = $('table.tb_type1_ifrs, table.tb_type1').first()

  if (!table.length) {
    // HTML 구조 로깅 (디버깅용)
    const snippet = html.slice(0, 500).replace(/\s+/g, ' ')
    console.error(`[inventory-cross] ${code} 재무테이블 미발견. HTML 앞 500자: ${snippet}`)
    return { status: 'not_found', quarters: [], source: 'naver', errorMsg: '재무 테이블 없음' }
  }

  // 분기 헤더 추출 (예: "2024.03" → "2024-03-31")
  const headers: string[] = []
  table.find('thead th').each((_, el) => {
    const text = $(el).text().trim()
    if (/^\d{4}[./]\d{2}$/.test(text)) {
      const [yr, mo] = text.split(/[./]/)
      const lastDay  = new Date(parseInt(yr), parseInt(mo), 0).getDate()
      headers.push(`${yr}-${mo.padStart(2,'0')}-${lastDay}`)
    }
  })
  console.log(`[inventory-cross] ${code} 분기 헤더:`, headers)

  if (headers.length < 2) {
    return { status: 'not_found', quarters: [], source: 'naver', errorMsg: `분기 헤더 부족 (${headers.length}개)` }
  }

  // 행 데이터 추출
  const extractRow = (keywords: string[]): number[] => {
    let vals: number[] = []
    table.find('tr').each((_, row) => {
      const th   = $(row).find('th').first().text().trim()
      const isOk = keywords.some(kw => th.includes(kw))
      if (isOk) {
        const cells: number[] = []
        $(row).find('td').each((_, td) => { cells.push(parseKrNumber($(td).text())) })
        if (cells.length > 0) vals = cells
      }
    })
    return vals
  }

  const revenues    = extractRow(['매출액', '매출'])
  const inventories = extractRow(['재고자산', '재고'])
  console.log(`[inventory-cross] ${code} 매출 ${revenues.length}개, 재고 ${inventories.length}개`)

  if (revenues.length < 2) {
    return { status: 'not_found', quarters: [], source: 'naver',
      errorMsg: `매출액 데이터 부족 (${revenues.length}개)` }
  }

  // 분기 조립 (최대 8개)
  const count = Math.min(headers.length, revenues.length, 8)
  const quarters: RawQuarter[] = []
  for (let i = 0; i < count; i++) {
    const rev = revenues[i]
    const inv = inventories.length > i ? inventories[i] : 0
    if (rev > 0) quarters.push({ date: headers[i], revenue: rev, inventory: inv })
  }

  if (quarters.length < 2) {
    return { status: 'not_found', quarters: [], source: 'naver',
      errorMsg: `유효 분기 부족 (${quarters.length}개)` }
  }

  console.log(`[inventory-cross] ${code} 스크래핑 성공 — ${quarters.length}분기`)
  return { status: 'ok', quarters, source: 'naver' }
}

/** 네이버 증권 스크래핑 — Promise.race 8초 타임아웃으로 무한 pending 완전 차단 */
async function fetchKrNaverQuarterly(ticker: string): Promise<FetchResult> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '').padStart(6, '0')

  // ★ Promise.race: 8초 안에 응답 없으면 무조건 timeout 결과 반환
  //   AbortController 단독으로는 Vercel 서버리스 환경에서 발화 안 됨
  const TIMEOUT_MS = 8_000
  const timeout = new Promise<FetchResult>(resolve =>
    setTimeout(() => {
      console.error(`[inventory-cross] ${code} 네이버 타임아웃 (${TIMEOUT_MS}ms)`)
      resolve({ status: 'error', quarters: [], source: 'naver', errorMsg: `타임아웃 ${TIMEOUT_MS}ms` })
    }, TIMEOUT_MS)
  )

  const scraping = _naverScrapingCore(code).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[inventory-cross] ${code} 네이버 스크래핑 예외:`, msg.slice(0, 200))
    return { status: 'error' as const, quarters: [], source: 'naver', errorMsg: msg }
  })

  return Promise.race([scraping, timeout])
}

// ════════════════════════════════════════════════════════════
// 라우터: US/KR 판별 후 해당 파이프라인 호출
// ════════════════════════════════════════════════════════════
function isKoreanStock(ticker: string, market: string): boolean {
  return market === 'KR' || /^\d{6}$/.test(ticker.replace(/\.(KS|KQ)$/i, ''))
}

async function fetchQuarterly(ticker: string, market: string): Promise<FetchResult> {
  if (isKoreanStock(ticker, market)) {
    return fetchKrNaverQuarterly(ticker)
  }
  // US 주식 — yahoo-finance2 fundamentalsTimeSeries
  // .KQ/.KS 접미사 없는 US 티커 그대로 사용
  const t = ticker.replace(/\.(KS|KQ)$/i, '')
  return fetchUsQuarterly(t)
}

// ────────────────────────────────────────────────────────────
// 최종 결과 객체 조립
// ────────────────────────────────────────────────────────────
function buildResult(
  ticker: string, name: string, market: string,
  res: FetchResult,
): InventoryCrossResult {
  const currency  = isKoreanStock(ticker, market) ? 'KRW' : 'USD'
  const unitLabel = currency === 'KRW' ? '억원' : 'M$'
  const trend     = res.status === 'ok' ? buildTrend(res.quarters, currency) : []
  const latest    = trend[trend.length - 1]
  const signal    = latest?.signal     ?? 'UNKNOWN'
  const gap       = latest?.gap        ?? 0
  const consec    = countConsecutiveDanger(trend)

  // 에러 사유별 린치 메시지
  const lynchAlert = res.status === 'ok'
    ? buildLynchAlert(signal, name, gap, consec)
    : res.status === 'not_found'
      ? `"${name}의 분기 재고·매출 데이터를 수집할 수 없었습니다. 해당 종목의 재무 공시가 아직 업데이트되지 않았거나 지원되지 않는 형식일 수 있습니다."`
      : `"${name}의 재무 데이터 API 조회 중 오류가 발생했습니다. (${res.errorMsg ?? '알 수 없는 오류'}) 잠시 후 새로고침해주세요."`

  return {
    ticker, name, market, currency, unitLabel,
    signal, gap,
    latestQuarter:     latest?.quarter      ?? '',
    revenueYoY:        latest?.revenueYoY   ?? 0,
    inventoryYoY:      latest?.inventoryYoY ?? 0,
    consecutiveDanger: consec,
    trend,
    lynchAlert,
    dataSource:        res.source,
  }
}

function buildLynchAlert(signal: CrossSignal, name: string, gap: number, consec: number): string {
  const abs = Math.abs(gap).toFixed(1)
  if (signal === 'DANGER') {
    return consec >= 2
      ? `"위험! ${name}의 재고가 매출보다 ${abs}%p 빠르게 쌓이는 상황이 ${consec}분기 연속 지속 중. 린치는 '2분기 연속 역전 시 즉시 매도'를 원칙으로 합니다."`
      : `"${name}의 재고 증가율이 매출을 ${abs}%p 앞질렀습니다. 단 1분기이므로 추세를 지켜보되, 다음 분기도 역전 시 매도를 검토하세요."`
  }
  if (signal === 'WARNING') {
    return `"${name}는 아직 역전되지 않았지만 격차가 ${abs}%p로 좁혀졌습니다. 재고 동향을 집중 모니터링 하세요."`
  }
  if (signal === 'HEALTHY') {
    return `"${name}는 매출이 재고보다 건강하게 앞서고 있습니다. 린치가 선호하는 '팔리는 속도 > 쌓이는 속도' 상태입니다."`
  }
  return `"${name}의 분기 재고·매출 데이터를 분석 중입니다."`
}

// ────────────────────────────────────────────────────────────
// 하드코딩 없는 업종별 제외 판별 (비제조업 필터)
// ────────────────────────────────────────────────────────────
const NO_INVENTORY_TICKERS = new Set([
  'PLTR','CRM','ADBE','ORCL','NOW','SNOW','WDAY','ZM','DDOG','CRWD','NET',
  'GOOGL','GOOG','META','MSFT','NFLX','UBER','LYFT','ABNB','SNAP',
  'JPM','GS','MS','BAC','C','WFC','V','MA','AXP','PYPL',
  'BRK','T','VZ','TMUS','UNH','CVS',
  '055550','105560','086790','032830','030200','017670',
])
const NO_INVENTORY_NAME_KW = [
  'SOFTWARE','CLOUD','SAAS','INTERNET','FINANCIALS','BANCORP','INSURANCE','ADVISORY',
  'STREAMING','소프트웨어','핀테크','금융','보험','증권','통신',
]

function isNoInventoryCompany(ticker: string, name: string): boolean {
  const t = ticker.toUpperCase()
  const n = name.toUpperCase()
  if (NO_INVENTORY_TICKERS.has(t)) return true
  if (NO_INVENTORY_NAME_KW.some(kw => n.includes(kw))) return true
  return false
}

function getExcludeReason(
  ticker: string, name: string,
  fetchStatus: FetchStatus, inventorySum: number,
): string {
  if (isNoInventoryCompany(ticker, name)) {
    return '소프트웨어·금융·서비스 기업은 물리적 재고자산이 없어 분석 대상이 아닙니다.'
  }
  if (fetchStatus === 'error') {
    return `${name} 재무데이터 API 조회 오류. 잠시 후 새로고침해주세요.`
  }
  if (fetchStatus === 'not_found') {
    return `${name} 분기 재무제표를 수집할 수 없었습니다. FnGuide 데이터 미제공 종목이거나 재무 공시 지연 상태일 수 있습니다.`
  }
  if (inventorySum === 0) {
    return '4개 분기 재고자산 합계가 0입니다. API 데이터 이상 또는 소프트웨어 기업으로 추정됩니다.'
  }
  return '재고자산 데이터를 확인할 수 없습니다.'
}

// ════════════════════════════════════════════════════════════
// GET 핸들러
// ════════════════════════════════════════════════════════════
export async function GET() {
  const cookieStore = await cookies()

  // ── 1. 인증 ────────────────────────────────────────────────
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
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 2. Supabase 서비스 롤 ────────────────────────────────
  const { createClient: mkAdmin } = await import('@supabase/supabase-js')
  const sbAdmin = mkAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── 3. 포트폴리오 주식(STOCK) 조회 ──────────────────────
  const { data: holdings, error: holdErr } = await sbAdmin
    .from('investments')
    .select('ticker, name, market')
    .eq('user_id', user.id)

  if (holdErr) return NextResponse.json({ error: holdErr.message }, { status: 500 })

  // STOCK 자산만 (ETF·CRYPTO·COMMODITY 제외)
  const allStocks = (holdings ?? []).filter(h =>
    getAssetType(h.ticker, h.name, h.market ?? 'US') === 'STOCK'
  )

  // 사전 제외: 알려진 비제조업 (소프트웨어·금융 등)
  const analyzeHoldings = allStocks.filter(h => !isNoInventoryCompany(h.ticker, h.name))
  const heuristicExcluded: InventoryExcluded[] = allStocks
    .filter(h => isNoInventoryCompany(h.ticker, h.name))
    .map(h => ({ ticker: h.ticker, name: h.name, reason: getExcludeReason(h.ticker, h.name, 'ok', 0) }))

  if (analyzeHoldings.length === 0) {
    return NextResponse.json({
      results: [], excludedFromAnalysis: heuristicExcluded,
      summary: { danger:0, warning:0, healthy:0, unknown:0 },
      source: 'empty',
      message: heuristicExcluded.length > 0
        ? '현재 포트폴리오에 재고 리스크를 추적할 제조업/하드웨어 종목이 없습니다.'
        : '포트폴리오에 분석 가능한 주식이 없습니다.',
    })
  }

  const tickers  = analyzeHoldings.map(h => h.ticker.toUpperCase())
  const todayISO = new Date().toISOString().slice(0, 10)

  // ── 4. Supabase 캐시 확인 (오늘 날짜 + 4개 이상 분기) ────
  const { data: cachedRows } = await sbAdmin
    .from('stock_financial_quarters')
    .select('*')
    .in('ticker', tickers)
    .gte('updated_at', `${todayISO}T00:00:00Z`)
    .order('ticker')
    .order('quarter', { ascending: true })

  // 4개 이상 분기 보유 시만 HIT
  const rowsByTicker = new Map<string, typeof cachedRows extends (infer U)[] | null ? U[] : never[]>()
  for (const row of (cachedRows ?? [])) {
    const arr = rowsByTicker.get(row.ticker) ?? []
    arr.push(row)
    rowsByTicker.set(row.ticker, arr)
  }
  const cachedTickers = new Set(
    Array.from(rowsByTicker.entries())
      .filter(([, rows]) => rows.length >= 4)
      .map(([t]) => t)
  )
  const missTickers = tickers.filter(t => !cachedTickers.has(t))

  // ── 5. MISS → 이원화 파이프라인 병렬 호출 ───────────────
  const fetchMap = new Map<string, FetchResult>()
  const fetchSettled = await Promise.allSettled(
    missTickers.map(async ticker => {
      const h = analyzeHoldings.find(x => x.ticker.toUpperCase() === ticker)
      if (!h) return
      try {
        const res = await fetchQuarterly(ticker, h.market ?? 'US')
        fetchMap.set(ticker, res)
        console.log(`[inventory-cross] ${ticker} 완료: status=${res.status} quarters=${res.quarters.length} source=${res.source}`)
      } catch (err: unknown) {
        // ★ try-catch: 개별 종목 에러가 전체 allSettled를 오염시키지 않도록 격리
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[inventory-cross] ${ticker} 예외 발생:`, msg)
        fetchMap.set(ticker, { status: 'error', quarters: [], source: 'unknown', errorMsg: msg })
      }
    })
  )
  // rejected된 Promise 로그 (try-catch 밖 예외)
  fetchSettled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[inventory-cross] missTickers[${i}] (${missTickers[i]}) 예외 탈출:`, r.reason)
    }
  })

  // ── 6. freshResults 조립 + 캐시 저장 ─────────────────────
  const freshResults: InventoryCrossResult[] = []
  const cacheRows: object[] = []

  for (const ticker of missTickers) {
    const h   = analyzeHoldings.find(x => x.ticker.toUpperCase() === ticker)
    if (!h) continue
    const res = fetchMap.get(ticker) ?? { status: 'error' as FetchStatus, quarters: [], source: 'unknown' }
    freshResults.push(buildResult(ticker, h.name, h.market ?? 'US', res))

    // 전체 4개 분기 저장 (YoY 계산용)
    if (res.status === 'ok') {
      const result  = freshResults[freshResults.length - 1]
      const now     = new Date().toISOString()
      for (const q of result.trend) {
        cacheRows.push({
          ticker, quarter: q.quarter,
          company_name: result.name, market: result.market,
          currency: result.currency, unit_label: result.unitLabel,
          fiscal_date: q.fiscalDate || null,
          revenue: q.revenue, inventory: q.inventory,
          revenue_yoy: q.revenueYoY, inventory_yoy: q.inventoryYoY,
          signal: q.signal, gap: q.gap,
          data_source: result.dataSource, updated_at: now,
        })
      }
    }
  }

  // 기존 스텁 캐시 삭제 후 새 데이터 저장
  if (missTickers.length > 0) {
    await sbAdmin.from('stock_financial_quarters').delete().in('ticker', missTickers)
  }
  if (cacheRows.length > 0) {
    const { error: uErr } = await sbAdmin
      .from('stock_financial_quarters')
      .upsert(cacheRows, { onConflict: 'ticker,quarter' })
    if (uErr) console.error('[inventory-cross] 캐시 저장 실패:', uErr)
  }

  // ── 7. 캐시 HIT → 결과 변환 ──────────────────────────────
  const cachedResults: InventoryCrossResult[] = []
  for (const ticker of Array.from(cachedTickers)) {
    const rows = (rowsByTicker.get(ticker) ?? []).slice()
      .sort((a, b) => a.quarter < b.quarter ? -1 : 1)
    if (rows.length < 4) continue

    const latest = rows[rows.length - 1]
    const h      = analyzeHoldings.find(x => x.ticker.toUpperCase() === ticker)
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
    const consec   = countConsecutiveDanger(trend)
    const signal   = (latest.signal as CrossSignal) ?? 'UNKNOWN'
    const gap      = latest.gap !== null ? Number(latest.gap) : 0
    cachedResults.push({
      ticker, name: latest.company_name || h?.name || ticker,
      market: latest.market || 'US', currency: latest.currency || 'USD',
      unitLabel: latest.unit_label || 'M$',
      signal, gap, latestQuarter: latest.quarter,
      revenueYoY:    latest.revenue_yoy   !== null ? Number(latest.revenue_yoy)   : 0,
      inventoryYoY:  latest.inventory_yoy !== null ? Number(latest.inventory_yoy) : 0,
      consecutiveDanger: consec, trend,
      lynchAlert:   buildLynchAlert(signal, latest.company_name || ticker, gap, consec),
      dataSource:   'cache',
    })
  }

  // ── 8. Hard Filter: API 성공 + 재고=0 → 제외 ─────────────
  const ORDER: Record<CrossSignal, number> = { DANGER:0, WARNING:1, HEALTHY:2, UNKNOWN:3 }
  const rawResults = [...freshResults, ...cachedResults]
    .sort((a, b) => ORDER[a.signal] - ORDER[b.signal] || b.gap - a.gap)

  const shouldExclude = (r: InventoryCrossResult): boolean => {
    const fr = fetchMap.get(r.ticker)
    if (!fr || fr.status !== 'ok') return false   // API 실패 → 탈락 금지 (UNKNOWN 유지)
    return !r.trend.some(q => (q.inventory ?? 0) > 0)  // 성공했는데 재고=0 → 제외
  }
  const allResults    = rawResults.filter(r => !shouldExclude(r))
  const dataExcluded: InventoryExcluded[] = rawResults.filter(shouldExclude).map(r => {
    const fr     = fetchMap.get(r.ticker)
    const invSum = r.trend.reduce((s, q) => s + (q.inventory ?? 0), 0)
    return { ticker: r.ticker, name: r.name, reason: getExcludeReason(r.ticker, r.name, fr?.status ?? 'ok', invSum) }
  })
  const finalExcluded = [...heuristicExcluded, ...dataExcluded]

  // ── 9. 요약 통계 ──────────────────────────────────────────
  const summary = {
    danger:  allResults.filter(r => r.signal === 'DANGER').length,
    warning: allResults.filter(r => r.signal === 'WARNING').length,
    healthy: allResults.filter(r => r.signal === 'HEALTHY').length,
    unknown: allResults.filter(r => r.signal === 'UNKNOWN').length,
  }

  return NextResponse.json({
    results:              allResults,
    excludedFromAnalysis: finalExcluded,
    summary,
    source: freshResults.length > 0 ? 'fresh' : 'cache',
    meta: {
      totalHoldings: allStocks.length,
      analyzable:    analyzeHoldings.length,
      excluded:      finalExcluded.length,
      analyzed:      allResults.filter(r => r.signal !== 'UNKNOWN').length,
      cacheHit:      cachedResults.length,
      cacheMiss:     freshResults.length,
      pipeline:      '미국:yahoo-finance2 / 한국:네이버증권-스크래핑',
      updatedAt:     new Date().toISOString(),
    },
  })
}
