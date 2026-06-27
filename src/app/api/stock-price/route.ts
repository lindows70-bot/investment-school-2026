import { NextRequest, NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────
export type Market    = 'US' | 'KR' | 'CRYPTO'
export type TimeFrame = '1D' | '1W' | '1M' | '1Y'

export interface PricePoint { t: number; v: number }

export interface Candle {
  date:   string
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface Fundamentals {
  pe:             number | 'N/A'
  peg:            number | 'N/A'
  marketCap:      number | null
  volume:         number | null
  high52w:        number | null
  low52w:         number | null
  sector:         string | null
  earningsGrowth: number | null
  dividendYield:  number | null
  isEtf:          boolean
  // 추가 재무 지표
  eps:            number | null
  pbr:            number | null
  forwardEps:     number | null
  payoutRatio:    number | null   // 배당성향 (0.25 = 25%)
  annualDividend: number | null   // 연간 배당금/주 (원화 or USD)
  // ── DCF 자동 분석용 (워렌 버핏 패널) — Yahoo Finance 실데이터 ──
  freeCashflow?:      number | null   // 연간 잉여현금흐름 (통화 원시값: KR=원, US=USD)
  sharesOutstanding?: number | null   // 유통주식수 (주 단위)
  totalDebt?:         number | null   // 총부채 (통화 원시값)
  totalCash?:         number | null   // 현금성자산 (통화 원시값)
  returnOnEquity?:    number | null   // ROE (0.15 = 15%)
  grossMargins?:      number | null   // 매출총이익률 (0.40 = 40%)
  operatingMargins?:  number | null   // 영업이익률 (0.20 = 20%, 음수=영업적자)
  psr?:               number | null   // 주가매출비율 P/S (시총÷TTM매출) — 적자기업·성장주 밸류 척도
}

export interface StockData {
  ticker:       string
  name:         string
  currentPrice: number
  currency:     'USD' | 'KRW'
  change:       number
  changePct:    number
  charts:       Record<TimeFrame, PricePoint[]>
  ohlcCharts:   Record<TimeFrame, Candle[]>
  fundamentals: Fundamentals
  updatedAt:    string
  source:       'live' | 'cache'
  error?:       string
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const CACHE     = new Map<string, { data: StockData; expiresAt: number }>()
const CACHE_TTL = 60_000

function cacheKey(ticker: string, market: Market) { return `${market}:${ticker.toUpperCase()}` }
function getCached(key: string): StockData | null {
  const e = CACHE.get(key)
  if (!e) return null
  return Date.now() < e.expiresAt ? e.data : null
}
function getCachedFallback(key: string) { return CACHE.get(key)?.data ?? null }
function setCache(key: string, data: StockData) {
  CACHE.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}
function nullFundamentals(): Fundamentals {
  return { pe: 'N/A', peg: 'N/A', marketCap: null, volume: null,
           high52w: null, low52w: null, sector: null,
           earningsGrowth: null, dividendYield: null, isEtf: false,
           eps: null, pbr: null, forwardEps: null, payoutRatio: null, annualDividend: null }
}
function nullOhlcCharts(): Record<TimeFrame, Candle[]> {
  return { '1D': [], '1W': [], '1M': [], '1Y': [] }
}

// ═══════════════════════════════════════════════════════════════
// ▌ NAVER 증권 (KR)
// ═══════════════════════════════════════════════════════════════

const NAVER_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':     'application/json, text/plain, */*',
  'Referer':    'https://finance.naver.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function naverFetch(url: string): Promise<Response> {
  return fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 0 } })
}

/** 쉼표·문자열 혼합 숫자 → number */
function parseKrNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/,/g, ''))
  return NaN
}

/** 네이버 폴링 API → 실시간 현재가·등락률
 *
 *  실제 응답 구조 (2024+ 확인):
 *  {
 *    "datas": [{
 *      "itemCode": "360750",
 *      "stockName": "TIGER 미국S&P500",
 *      "closePrice": "26,820",
 *      "compareToPreviousClosePrice": "270",
 *      "fluctuationsRatio": "1.02",
 *      ...
 *    }]
 *  }
 */
async function naverQuote(code: string) {
  const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`
  const res = await naverFetch(url)
  if (!res.ok) throw new Error(`네이버 시세 조회 실패 (${res.status})`)

  const json = await res.json()

  // 응답 구조 두 가지 모두 지원
  // - 신형: json.datas[0]
  // - 구형: json.result.areas[0].datas[0]
  const data = json?.datas?.[0]
            ?? json?.result?.areas?.[0]?.datas?.[0]
            ?? json?.result?.datas?.[0]

  if (!data) {
    console.error('[naverQuote] 알 수 없는 응답 구조:', JSON.stringify(json).slice(0, 200))
    throw new Error('네이버 시세 데이터 없음')
  }

  const closePrice = parseKrNum(data.closePrice ?? data.nv ?? data.close)
  const change     = parseKrNum(data.compareToPreviousClosePrice ?? data.cv ?? data.change ?? 0)
  const changePct  = parseKrNum(data.fluctuationsRatio ?? data.cr ?? data.changeRate ?? 0)
  const name: string = data.stockName ?? data.nm ?? data.name ?? code

  if (!isFinite(closePrice) || closePrice === 0) {
    throw new Error(`네이버 현재가 파싱 실패 (closePrice=${data.closePrice}, nv=${data.nv})`)
  }

  return { name, closePrice, change, changePct }
}

/** 네이버 모바일 API → 종목 기본 정보 (종목명·섹터·PER·배당 등) */
async function naverBasic(code: string) {
  const url = `https://m.stock.naver.com/api/stock/${code}/basic`
  const res = await naverFetch(url)
  if (!res.ok) return null

  const json = await res.json()
  return json ?? null
}

/** 네이버 fchart XML → PricePoint[]
 *
 *  엔드포인트: https://fchart.stock.naver.com/sise.nhn
 *  응답 XML 형식:
 *    <item data="YYYYMMDD|시가|고가|저가|종가|거래량" />
 *
 *  timeframe 파라미터: day / week / month
 *  count: 반환할 캔들 수
 */
async function naverChart(code: string, tf: TimeFrame): Promise<PricePoint[]> {
  const tfMap: Record<TimeFrame, { timeframe: string; count: number }> = {
    '1D': { timeframe: 'day',   count: 60 },    // 최근 60 거래일(~3개월)
    '1W': { timeframe: 'week',  count: 60 },    // 최근 60 주(~14개월)
    '1M': { timeframe: 'month', count: 60 },    // 최근 60 개월(5년)
    '1Y': { timeframe: 'month', count: 120 },   // 최근 120 개월(10년) → 1Y 최장
  }
  const { timeframe, count } = tfMap[tf]

  const url =
    `https://fchart.stock.naver.com/sise.nhn` +
    `?symbol=${code}&timeframe=${timeframe}&count=${count}&requestType=0`

  const res = await naverFetch(url)
  if (!res.ok) throw new Error(`네이버 차트 조회 실패 (${res.status})`)

  // EUC-KR XML이지만 data 속성 값은 ASCII 숫자·날짜만 포함
  const xml = await res.text()

  // <item data="YYYYMMDD|open|high|low|close|volume" /> 파싱
  const points: PricePoint[] = []
  const itemRe = /data="([^"]+)"/g
  let m: RegExpExecArray | null

  while ((m = itemRe.exec(xml)) !== null) {
    const parts = m[1].split('|')
    if (parts.length < 5) continue

    const dateStr = parts[0]   // "20260423"
    const close   = parseFloat(parts[4])
    if (!close || !isFinite(close)) continue

    const y  = parseInt(dateStr.slice(0, 4))
    const mo = parseInt(dateStr.slice(4, 6)) - 1
    const d  = parseInt(dateStr.slice(6, 8) || '1')
    const t  = Date.UTC(y, mo, d) + 9 * 3_600_000  // KST 기준

    if (isFinite(t)) points.push({ t, v: close })
  }

  return points
}

/** KR OHLC 캔들 데이터 (네이버 차트 XML → Candle[]) */
async function naverOhlcChart(code: string, tf: TimeFrame): Promise<Candle[]> {
  // ★ 탭별 서로 다른 timeframe — 전 탭 ~60캔들로 통일(증권사 차트처럼 촘촘)
  //   1D : day   × 60  → 일봉 60 (약 3개월)
  //   1W : week  × 60  → 주봉 60 (약 14개월)
  //   1M : month × 60  → 월봉 60 (5년)
  //   1Y : month × 120 → 월봉 120 (10년, 최장)
  // naverChart(라인차트)와 동일한 timeframe 구분 정책 사용
  const tfMap: Record<TimeFrame, { timeframe: string; count: number }> = {
    '1D': { timeframe: 'day',   count: 60 },
    '1W': { timeframe: 'week',  count: 60 },
    '1M': { timeframe: 'month', count: 60 },
    '1Y': { timeframe: 'month', count: 120 },
  }
  const { timeframe, count } = tfMap[tf]
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=${timeframe}&count=${count}&requestType=0`

  try {
    const res = await naverFetch(url)
    if (!res.ok) return []
    const xml = await res.text()

    const candles: Candle[] = []
    const re = /data="([^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const p = m[1].split('|')
      if (p.length < 6) continue
      const ds     = p[0]  // YYYYMMDD or YYYYMMDDHHII
      const open   = parseFloat(p[1])
      const high   = parseFloat(p[2])
      const low    = parseFloat(p[3])
      const close  = parseFloat(p[4])
      const volume = parseFloat(p[5])
      if (!isFinite(close) || close <= 0) continue
      candles.push({
        date:   `${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`,
        open:   isFinite(open)   && open   > 0 ? open   : close,
        high:   isFinite(high)   && high   > 0 ? high   : close,
        low:    isFinite(low)    && low    > 0 ? low    : close,
        close,
        volume: isFinite(volume) ? volume : 0,
      })
    }
    return candles
  } catch { return [] }
}

/** 한국 산업 분류명 → 피터 린치 섹터 키워드 */
function krSectorToLynchSector(industryName: string | null): string | null {
  if (!industryName) return null
  const n = industryName

  if (/부동산/.test(n))                                  return 'Real Estate'
  if (/석유|정제|코크스|연탄/.test(n))                   return 'Energy'
  if (/화학|도료|비료|합성수지/.test(n))                  return 'Basic Materials'
  if (/철강|금속|1차금속|주물/.test(n))                   return 'Basic Materials'
  if (/건설|토목/.test(n))                               return 'Industrials'
  if (/조선|항공|방위/.test(n))                          return 'Industrials'
  if (/운수|창고|물류|항만/.test(n))                     return 'Industrials'
  if (/음식료|식품|음료|담배/.test(n))                   return 'Consumer Defensive'
  if (/의류|섬유|봉제/.test(n))                          return 'Consumer Cyclical'
  if (/통신/.test(n))                                   return 'Communication Services'
  if (/전기·가스|전력|가스공급/.test(n))                 return 'Utilities'
  if (/금융|은행|저축/.test(n))                          return 'Financial Services'
  if (/보험/.test(n))                                   return 'Financial Services'
  if (/증권|투자/.test(n))                               return 'Financial Services'
  if (/의약품|바이오|의료기기|제약/.test(n))              return 'Healthcare'
  if (/소프트웨어|IT서비스|정보기술/.test(n))             return 'Technology'
  if (/전자부품|반도체|컴퓨터|통신장비/.test(n))          return 'Technology'
  if (/게임|엔터|방송|영상|음악/.test(n))                 return 'Communication Services'

  return null
}

/** 네이버 기본정보 → Fundamentals */
async function naverFundamentals(code: string): Promise<Fundamentals> {
  const basic = await naverBasic(code)
  if (!basic) return nullFundamentals()

  const per = typeof basic.per === 'number'  ? basic.per  : null
  const eps = typeof basic.eps === 'number'  ? basic.eps  : null
  const dy  = typeof basic.dividendYield === 'number' ? basic.dividendYield / 100 : null
  const mc  = typeof basic.marketValue === 'number'   ? basic.marketValue : null

  const industryName: string | null = basic.industryCodeType?.name ?? null
  const sector = krSectorToLynchSector(industryName) ?? industryName

  // 간단한 성장률 추정: EPS가 양수면 기본 성장 가정, 음수면 회생
  // 실제 YoY EPS 성장률은 별도 API 필요 — 여기서는 null 처리
  const earningsGrowth = eps != null && eps < 0 ? -0.5 : null

  return {
    pe:             per != null ? per : 'N/A',
    peg:            'N/A',
    marketCap:      mc,
    volume:         null,
    high52w:        typeof basic.high52week === 'number' ? basic.high52week : null,
    low52w:         typeof basic.low52week  === 'number' ? basic.low52week  : null,
    sector,
    earningsGrowth,
    dividendYield:  dy,
    isEtf:          false,
    eps:        null,
    pbr:        null,
    forwardEps: null,
    payoutRatio:    null,   // Naver에서 배당성향 별도 미제공
    annualDividend: null,
  }
}

/** KR 전체 조회 (네이버 증권) */
async function fetchKrStock(ticker: string): Promise<StockData> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '')   // 혹시 .KS/.KQ가 붙어 오면 제거

  const [quoteRes, chartResults, ohlcResults, fund] = await Promise.all([
    naverQuote(code),
    Promise.allSettled([
      naverChart(code, '1D'),
      naverChart(code, '1W'),
      naverChart(code, '1M'),
      naverChart(code, '1Y'),
    ]),
    Promise.allSettled([
      naverOhlcChart(code, '1D'),
      naverOhlcChart(code, '1W'),
      naverOhlcChart(code, '1M'),
      naverOhlcChart(code, '1Y'),   // ← 1Y 추가
    ]),
    naverFundamentals(code),
  ])

  const [r1D, r1W, r1M, r1Y] = chartResults
  const charts: Record<TimeFrame, PricePoint[]> = {
    '1D': r1D.status === 'fulfilled' ? r1D.value : [],
    '1W': r1W.status === 'fulfilled' ? r1W.value : [],
    '1M': r1M.status === 'fulfilled' ? r1M.value : [],
    '1Y': r1Y.status === 'fulfilled' ? r1Y.value : [],
  }

  const [o1D, o1W, o1M, o1Y] = ohlcResults
  const ohlcCharts: Record<TimeFrame, Candle[]> = {
    '1D': o1D.status === 'fulfilled' ? o1D.value : [],
    '1W': o1W.status === 'fulfilled' ? o1W.value : [],
    '1M': o1M.status === 'fulfilled' ? o1M.value : [],
    '1Y': o1Y.status === 'fulfilled' ? o1Y.value : [],  // ← 1Y 실제 데이터
  }

  return {
    ticker:       code,
    name:         quoteRes.name,
    currentPrice: quoteRes.closePrice,
    currency:     'KRW',
    change:       quoteRes.change,
    changePct:    quoteRes.changePct,
    charts,
    ohlcCharts,
    fundamentals: fund,
    updatedAt:    new Date().toISOString(),
    source:       'live',
  }
}

// ═══════════════════════════════════════════════════════════════
// ▌ YAHOO FINANCE (US)
// ═══════════════════════════════════════════════════════════════

const YF_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin:  'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}

// KR(네이버)과 동일한 캔들 입도 정책 — 1D=일봉 / 1W=주봉 / 1M·1Y=월봉. 두 시장 차트 일관성(제2원칙).
const YF_RANGE: Record<TimeFrame, { range: string; interval: string; take: number }> = {
  // 증권사 차트처럼 전 탭 ~60캔들로 통일(촘촘하게). 1Y만 120(최장·차별화)
  '1D': { range: '6mo', interval: '1d',  take: 60 },   // 일봉 60 (약 3개월)
  '1W': { range: '2y',  interval: '1wk', take: 60 },   // 주봉 60 (약 14개월)
  '1M': { range: '6y',  interval: '1mo', take: 60 },   // 월봉 60 (약 5년)
  '1Y': { range: 'max', interval: '1mo', take: 120 },  // 월봉 120 (약 10년)
}

// v8 chart: query1 → query2 순서로 fallback (v7/v10은 401 차단)
async function yfChartFetch(ticker: string, qs: string): Promise<Response | null> {
  for (const host of ['query1', 'query2'] as const) {
    try {
      const res = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${qs}`,
        { headers: YF_HEADERS, next: { revalidate: 0 } }
      )
      if (res.ok) return res
    } catch { /* 다음 host */ }
  }
  return null
}

async function yfChart(ticker: string, tf: TimeFrame): Promise<PricePoint[]> {
  const { range, interval, take } = YF_RANGE[tf]
  const res = await yfChartFetch(ticker, `range=${range}&interval=${interval}&includePrePost=false`)
  if (!res) throw new Error(`YF chart 조회 실패: ${ticker}`)

  const result = (await res.json())?.chart?.result?.[0]
  if (!result)  throw new Error('YF chart 응답 없음')

  const timestamps: number[]      = result.timestamp ?? []
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
  const points: PricePoint[]      = []

  for (let i = 0; i < timestamps.length; i++) {
    const v = closes[i]
    if (v != null && isFinite(v)) points.push({ t: timestamps[i] * 1000, v })
  }
  return points.slice(-take)   // 최근 N개만 (KR과 동일 개수)
}

/** US OHLC 캔들 데이터 (Yahoo Finance v8 → Candle[]) */
async function yfOhlcChart(ticker: string, tf: TimeFrame): Promise<Candle[]> {
  // KR과 동일 입도 정책(일/주/월봉) — 라인차트(yfChart)와 같은 YF_RANGE 사용(SSOT)
  const { range, interval, take } = YF_RANGE[tf]
  try {
    const res = await yfChartFetch(ticker, `range=${range}&interval=${interval}&includePrePost=false`)
    if (!res || !res.ok) return []
    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return []

    const ts:  number[]        = result.timestamp       ?? []
    const q                    = result.indicators?.quote?.[0] ?? {}
    const opens:   (number|null)[] = q.open   ?? []
    const highs:   (number|null)[] = q.high   ?? []
    const lows:    (number|null)[] = q.low    ?? []
    const closes:  (number|null)[] = q.close  ?? []
    const volumes: (number|null)[] = q.volume ?? []

    return ts
      .map((t, i) => {
        const close = closes[i]
        if (close == null || !isFinite(close) || close <= 0) return null
        const d = new Date(t * 1000)
        return {
          date:   d.toISOString().slice(0, 10),
          open:   isFinite(opens[i]   ?? NaN) && (opens[i]   ?? 0) > 0 ? opens[i]!   : close,
          high:   isFinite(highs[i]   ?? NaN) && (highs[i]   ?? 0) > 0 ? highs[i]!   : close,
          low:    isFinite(lows[i]    ?? NaN) && (lows[i]    ?? 0) > 0 ? lows[i]!    : close,
          close,
          volume: isFinite(volumes[i] ?? NaN) ? (volumes[i] ?? 0) : 0,
        } as Candle
      })
      .filter((c): c is Candle => c !== null)
      .slice(-take)   // 최근 N개만 (KR과 동일 개수)
  } catch { return [] }
}

async function yfQuote(ticker: string) {
  // v8 chart meta에서 종목명·가격 추출 (가장 신뢰성 높음)
  const res  = await yfChartFetch(ticker, 'range=1d&interval=1m&includePrePost=false')
  if (!res)  throw new Error(`Yahoo Finance 종목 조회 실패: ${ticker}`)

  const meta = (await res.json())?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error(`${ticker} 시세 데이터 없음`)

  return {
    name:         (meta.longName ?? meta.shortName ?? ticker) as string,
    currentPrice: meta.regularMarketPrice as number,
    prevClose:    (meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice) as number,
    isEtf:        (meta.instrumentType ?? '').toUpperCase() === 'ETF',
  }
}

// v10 quoteSummary는 401 차단이므로 optional — 실패 시 nullFundamentals 반환
async function yfFundamentals(ticker: string): Promise<Fundamentals> {
  const modules = 'defaultKeyStatistics%2CsummaryDetail%2CsummaryProfile%2CfinancialData'
  for (const host of ['query2', 'query1'] as const) {
    try {
      const res = await fetch(
        `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`,
        { headers: YF_HEADERS, next: { revalidate: 0 } }
      )
      if (!res.ok) continue   // 401이면 건너뜀

      const r = (await res.json())?.quoteSummary?.result?.[0]
      if (!r) continue

      const stats   = r.defaultKeyStatistics ?? {}
      const detail  = r.summaryDetail        ?? {}
      const profile = r.summaryProfile       ?? {}
      const finance = r.financialData        ?? {}
      const raw     = (obj: Record<string, { raw?: number }>, k: string): number | null => obj[k]?.raw ?? null

      const pe  = raw(detail, 'trailingPE') ?? raw(detail, 'forwardPE')
      const peg = raw(stats,  'pegRatio')
      const isEtf = (stats.quoteType ?? '').toUpperCase() === 'ETF' || !!(r.fundFamily)

      // v10에서 배당 데이터 없으면 yahoo-finance2로 보충
      let dyYield      = raw(detail, 'dividendYield')  ?? raw(detail, 'trailingAnnualDividendYield')
      let dyPayout     = raw(detail, 'payoutRatio')
      let dyAnnualDiv  = raw(detail, 'dividendRate')   ?? raw(detail, 'trailingAnnualDividendRate')

      if ((dyYield == null || dyPayout == null) && !isEtf) {
        try {
          const { default: YahooFinance } = await import('yahoo-finance2')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
          const ySum = await yf.quoteSummary(ticker, { modules: ['summaryDetail'] })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sd: any = ySum?.summaryDetail ?? {}
          const pick = (v: unknown) => typeof v === 'number' && isFinite(v) && v > 0 ? v : null
          if (dyYield     == null) dyYield     = pick(sd.dividendYield)   ?? pick(sd.trailingAnnualDividendYield)
          if (dyPayout    == null) dyPayout    = pick(sd.payoutRatio)
          if (dyAnnualDiv == null) dyAnnualDiv = pick(sd.dividendRate)    ?? pick(sd.trailingAnnualDividendRate)
        } catch { /* 무시 */ }
      }

      return {
        pe:             pe  != null ? pe  : 'N/A',
        peg:            peg != null ? peg : 'N/A',
        marketCap:      raw(detail,  'marketCap'),
        volume:         raw(detail,  'volume') ?? raw(detail, 'averageVolume'),
        high52w:        raw(detail,  'fiftyTwoWeekHigh'),
        low52w:         raw(detail,  'fiftyTwoWeekLow'),
        sector:         (profile.sector as string | null) ?? null,
        earningsGrowth: raw(finance, 'earningsGrowth') ?? raw(finance, 'revenueGrowth'),
        dividendYield:  dyYield,
        payoutRatio:    dyPayout,
        annualDividend: dyAnnualDiv,
        isEtf,
        eps:        raw(stats, 'trailingEps'),
        pbr:        raw(stats, 'priceToBook'),
        forwardEps: raw(stats, 'forwardEps'),
      }
    } catch { /* 다음 host */ }
  }
  // v10 모두 실패 → fundamentals 없이 진행 (이름·가격에는 영향 없음)
  return nullFundamentals()
}

async function fetchUsStock(ticker: string): Promise<StockData> {
  const t = ticker.toUpperCase()

  const [chartResults, ohlcResults, quote, fund] = await Promise.all([
    Promise.allSettled([yfChart(t, '1D'), yfChart(t, '1W'), yfChart(t, '1M'), yfChart(t, '1Y')]),
    Promise.allSettled([yfOhlcChart(t, '1D'), yfOhlcChart(t, '1W'), yfOhlcChart(t, '1M'), yfOhlcChart(t, '1Y')]),
    yfQuote(t),
    yfFundamentals(t),
  ])

  const [r1D, r1W, r1M, r1Y] = chartResults
  const charts: Record<TimeFrame, PricePoint[]> = {
    '1D': r1D.status === 'fulfilled' ? r1D.value : [],
    '1W': r1W.status === 'fulfilled' ? r1W.value : [],
    '1M': r1M.status === 'fulfilled' ? r1M.value : [],
    '1Y': r1Y.status === 'fulfilled' ? r1Y.value : [],
  }
  const change    = quote.currentPrice - quote.prevClose
  const changePct = quote.prevClose > 0 ? (change / quote.prevClose) * 100 : 0

  const [uo1D, uo1W, uo1M, uo1Y] = ohlcResults
  const ohlcCharts: Record<TimeFrame, Candle[]> = {
    '1D': uo1D.status === 'fulfilled' ? uo1D.value : [],
    '1W': uo1W.status === 'fulfilled' ? uo1W.value : [],
    '1M': uo1M.status === 'fulfilled' ? uo1M.value : [],
    '1Y': uo1Y.status === 'fulfilled' ? uo1Y.value : [],
  }

  // yfQuote의 isEtf로 fundamentals.isEtf 덮어쓰기
  const fundamentals = { ...fund, isEtf: fund.isEtf || quote.isEtf }

  return {
    ticker: t, name: quote.name,
    currentPrice: quote.currentPrice, currency: 'USD',
    change, changePct, charts, ohlcCharts, fundamentals,
    updatedAt: new Date().toISOString(), source: 'live',
  }
}

// ═══════════════════════════════════════════════════════════════
// ▌ UPBIT (CRYPTO) — 원화(KRW) 기준
// ═══════════════════════════════════════════════════════════════

const UPBIT_H: HeadersInit = { Accept: 'application/json' }

/** 티커 → 업비트 마켓 코드  e.g. XRP → KRW-XRP */
function upbitMarket(ticker: string) {
  return `KRW-${ticker.toUpperCase().replace(/^KRW-/, '')}`
}

/** flat-line 폴백: 현재가 기준 N포인트 직선 */
function flatLine(price: number, points = 24): PricePoint[] {
  const now  = Date.now()
  const step = 3_600_000
  return Array.from({ length: points }, (_, i) => ({
    t: now - (points - 1 - i) * step,
    v: price,
  }))
}

/** 업비트 현재가 조회 */
async function upbitQuote(ticker: string) {
  const market = upbitMarket(ticker)
  const res = await fetch(
    `https://api.upbit.com/v1/ticker?markets=${market}`,
    { headers: UPBIT_H, next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`업비트 시세 조회 실패 (${res.status}): ${market}`)

  const arr = await res.json()
  const d   = arr?.[0]
  if (!d?.trade_price) throw new Error(`업비트 데이터 없음: ${market}`)

  return {
    currentPrice: d.trade_price     as number,
    change:       d.signed_change_price as number,
    // signed_change_rate는 소수 (0.006...) → % 로 변환
    changePct:    (d.signed_change_rate as number) * 100,
    volume:       d.acc_trade_volume_24h as number | null,
  }
}

/** 업비트 캔들 → PricePoint[]
 *  업비트 응답은 최신 데이터 먼저(내림차순) → reverse()로 오름차순 정렬
 */
async function upbitChart(ticker: string, tf: TimeFrame): Promise<PricePoint[]> {
  const market = upbitMarket(ticker)

  // 1D: 1시간봉 24개 / 1W: 일봉 7개 / 1M: 일봉 30개
  const url =
    tf === '1D'
      ? `https://api.upbit.com/v1/candles/minutes/60?market=${market}&count=24`
      : `https://api.upbit.com/v1/candles/days?market=${market}&count=${tf === '1W' ? 7 : 30}`

  const res = await fetch(url, { headers: UPBIT_H, next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`업비트 차트 조회 실패 (${res.status}): ${market} ${tf}`)

  const candles: { timestamp: number; trade_price: number }[] = await res.json()
  if (!Array.isArray(candles)) return []

  return candles
    .reverse()                               // 최신→과거 순서를 과거→최신으로
    .map(c => ({ t: c.timestamp, v: c.trade_price }))
    .filter(p => p.v > 0 && isFinite(p.t))
}

/** CRYPTO OHLC 캔들 데이터 (업비트 → Candle[]) */
async function upbitOhlcChart(ticker: string, tf: TimeFrame): Promise<Candle[]> {
  const market = upbitMarket(ticker)
  // 캔들 밀도 최적화
  const url =
    tf === '1D' ? `https://api.upbit.com/v1/candles/minutes/10?market=${market}&count=72`  // 10분봉 72개 ≈ 12시간
    : tf === '1W' ? `https://api.upbit.com/v1/candles/days?market=${market}&count=40`      // 일봉 40개
    : tf === '1Y' ? `https://api.upbit.com/v1/candles/weeks?market=${market}&count=52`     // 주봉 52개
    : `https://api.upbit.com/v1/candles/days?market=${market}&count=90`                    // 1M: 일봉 90개

  try {
    const res = await fetch(url, { headers: UPBIT_H, next: { revalidate: 0 } })
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    if (!Array.isArray(data)) return []

    return data
      .reverse()   // 업비트: 최신→과거 순, 과거→최신으로 뒤집기
      .map(d => ({
        date:   String(d.candle_date_time_kst ?? '').slice(0, 10),
        open:   d.opening_price  as number,
        high:   d.high_price     as number,
        low:    d.low_price      as number,
        close:  d.trade_price    as number,
        volume: d.candle_acc_trade_volume as number ?? 0,
      }))
      .filter((c: Candle) => isFinite(c.close) && c.close > 0)
  } catch { return [] }
}

async function fetchCrypto(ticker: string): Promise<StockData> {
  const [chartResults, ohlcResults, quote] = await Promise.all([
    Promise.allSettled([
      upbitChart(ticker, '1D'),
      upbitChart(ticker, '1W'),
      upbitChart(ticker, '1M'),
    ]),
    Promise.allSettled([
      upbitOhlcChart(ticker, '1D'),
      upbitOhlcChart(ticker, '1W'),
      upbitOhlcChart(ticker, '1M'),
      upbitOhlcChart(ticker, '1Y'),
    ]),
    upbitQuote(ticker),
  ])
  const [r1D, r1W, r1M] = chartResults

  const to1D = r1D.status === 'fulfilled' && r1D.value.length > 0
    ? r1D.value : flatLine(quote.currentPrice, 24)
  const to1W = r1W.status === 'fulfilled' && r1W.value.length > 0
    ? r1W.value : flatLine(quote.currentPrice, 7)
  const to1M = r1M.status === 'fulfilled' && r1M.value.length > 0
    ? r1M.value : flatLine(quote.currentPrice, 30)

  const [co1D, co1W, co1M, co1Y] = ohlcResults
  const ohlcCharts: Record<TimeFrame, Candle[]> = {
    '1D': co1D.status === 'fulfilled' ? co1D.value : [],
    '1W': co1W.status === 'fulfilled' ? co1W.value : [],
    '1M': co1M.status === 'fulfilled' ? co1M.value : [],
    '1Y': co1Y.status === 'fulfilled' ? co1Y.value : [],
  }

  return {
    ticker:       ticker.toUpperCase(),
    name:         ticker.toUpperCase(),
    currentPrice: quote.currentPrice,
    currency:     'KRW',           // ← USD → KRW
    change:       quote.change,
    changePct:    quote.changePct,
    charts:       { '1D': to1D, '1W': to1W, '1M': to1M, '1Y': [] },
    ohlcCharts,
    fundamentals: {
      pe: 'N/A', peg: 'N/A',
      marketCap: null, volume: quote.volume,
      high52w: null, low52w: null,
      sector: null, earningsGrowth: null, dividendYield: null, isEtf: false,
      eps: null, pbr: null, forwardEps: null, payoutRatio: null, annualDividend: null,
    },
    updatedAt: new Date().toISOString(),
    source:    'live',
  }
}

// ═══════════════════════════════════════════════════════════════
// ▌ Route handlers
// ═══════════════════════════════════════════════════════════════

async function resolveData(ticker: string, market: Market): Promise<StockData> {
  if (market === 'CRYPTO') return fetchCrypto(ticker)
  if (market === 'KR')     return fetchKrStock(ticker)
  return fetchUsStock(ticker)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ticker = searchParams.get('ticker')?.trim()
  const market = (searchParams.get('market')?.toUpperCase() ?? 'US') as Market

  if (!ticker)
    return NextResponse.json({ error: '티커를 입력해주세요.' }, { status: 400 })
  if (!['US', 'KR', 'CRYPTO'].includes(market))
    return NextResponse.json({ error: 'market은 US | KR | CRYPTO 중 하나여야 합니다.' }, { status: 400 })

  const key = cacheKey(ticker, market)
  const hit = getCached(key)
  if (hit) return NextResponse.json(hit, { headers: { 'X-Cache': 'HIT', 'Cache-Control': 'no-store' } })

  try {
    const data = await resolveData(ticker, market)
    setCache(key, data)
    return NextResponse.json(data, { headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' } })
  } catch (err) {
    const fallback = getCachedFallback(key)
    if (fallback)
      return NextResponse.json(
        { ...fallback, source: 'cache', error: (err as Error).message },
        { headers: { 'X-Cache': 'FALLBACK', 'Cache-Control': 'no-store' } }
      )
    return NextResponse.json(
      { error: (err as Error).message, ticker, market },
      { status: 502 }
    )
  }
}

export async function POST(req: NextRequest) {
  let body: { ticker: string; market: Market }[]
  try   { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON 파싱 오류' }, { status: 400 }) }

  if (!Array.isArray(body) || !body.length)
    return NextResponse.json({ error: '요청 본문은 비어있지 않은 배열이어야 합니다.' }, { status: 400 })
  if (body.length > 50)
    return NextResponse.json({ error: '한 번에 최대 50개 티커까지 조회 가능합니다.' }, { status: 400 })

  const results = await Promise.all(
    body.map(async ({ ticker, market }) => {
      const key = cacheKey(ticker, market)
      const hit = getCached(key)
      if (hit) return { ...hit, source: 'cache' as const }
      try {
        const data = await resolveData(ticker, market)
        setCache(key, data)
        return data
      } catch (err) {
        const fallback = getCachedFallback(key)
        if (fallback) return { ...fallback, source: 'cache' as const, error: (err as Error).message }
        return {
          ticker, name: ticker, error: (err as Error).message,
          source: 'live' as const, currentPrice: 0, currency: 'USD' as const,
          change: 0, changePct: 0,
          charts: { '1D': [], '1W': [], '1M': [], '1Y': [] },
          ohlcCharts: nullOhlcCharts(),
          fundamentals: nullFundamentals(),
          updatedAt: new Date().toISOString(),
        } satisfies StockData
      }
    })
  )

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
