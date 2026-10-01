import { NextRequest, NextResponse } from 'next/server'
import { parseNaverBasics } from '@/lib/naverIntegration'   // 📊 국내 기본 지표(PER·EPS·배당·시총·52주) — basic 에서 사라져 integration 으로
import { naverUpjongMap, industryNameOf, upjongToGics } from '@/lib/naverUpjong'   // 🏷️ 국내 업종 SSOT(stock-info·승패 해부실과 같은 표)

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
  /** 국내 PER 의 이익 기준 — 'ttm' 최근 4분기(네이버 화면과 같은 값) · 'fy-now' 지금 주가 ÷ 직전 결산 EPS(폴백). 미국은 없음(trailing) */
  peBasis?:       'ttm' | 'fy-now' | null
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
  /** 💵 선행 PSR — PSR × TTM매출 ÷ 미래 회계연도 예상매출(같은 Yahoo 응답 내 비율). 🇺🇸 US 전용(KR 은 Yahoo 추정치 신뢰 불가) */
  fwdPsr?:            number | null
  fwdPsrFy?:          number | null   // 그 예상매출의 회계연도(예: 2026) — 화면 병기용
  /** 📈 `earningsGrowth` 가 **무엇의 성장률인가**. 'eps'=이익 · 'revenue'=매출(폴백) · 'fwd-eps'=전망EPS 기반.
   *  ⚠️ 이 필드가 없던 시절 화면이 전부 "EPS 성장률"로 라벨링했는데, **Yahoo 폴백 경로**(네이버가 커버 못 하는
   *  신규 상장주)에서 earningsGrowth 결측·극단값(|eg|≥5)이면 **매출 성장률로 대체**되고 있었다.
   *  실측 2026-08-16: IONQ 286.8% 가 'EPS 성장률'로 표시(프로덕션 14종 중 1종 — US 주력은 네이버 재무라 정상).
   *  ⚠️ 범위를 넓게 적지 마라 — 처음엔 Yahoo 를 직접 쳐서 OXY 도 해당된다고 봤으나, 프로덕션은 네이버
   *     우선이라 OXY 는 정상 EPS(−38.1%)였다. **앱이 실제로 타는 경로로 재야 한다.**
   *  폴백 자체는 합리적이지만 라벨이 안 따라가면 학생은 이익과 매출을 같은 잣대로 읽는다. */
  growthSource?:      'eps' | 'revenue' | 'fwd-eps' | null
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
/** 일부를 폴백(현재가 직선)으로 채운 응답 — 캐시하지 않는다(다음 요청이 스스로 낫게). 응답 모양은 그대로 */
const PARTIAL = new WeakSet<StockData>()
function setCache(key: string, data: StockData) {
  if (PARTIAL.has(data)) return
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
    '1Y': { timeframe: 'month', count: 120 },   // 월봉 120 (10년, 증권사 '월' 장기 뷰)
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

  // 1Y: 월봉 → 분기 다운샘플(매 3번째 점) 후 최근 60개 — 캔들(분기봉)과 동일 기간
  if (tf === '1Y') {
    const q = points.filter((_, i) => (points.length - 1 - i) % 3 === 0)
    return q.slice(-60)
  }
  return points
}

/** KR OHLC 캔들 데이터 (네이버 차트 XML → Candle[]) */
async function naverOhlcChart(code: string, tf: TimeFrame): Promise<Candle[]> {
  // ★ 탭별 서로 다른 timeframe — 전 탭 60캔들로 통일(증권사 차트처럼 촘촘)
  //   1D : day   × 60   → 일봉 60 (약 3개월)
  //   1W : week  × 60   → 주봉 60 (약 14개월)
  //   1M : month × 60  → 월봉 60 (5년)
  //   1Y : month × 120 → 월봉 120 (10년, 증권사 '월' 장기 뷰). 어린 종목은 가용 전체.
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
  // 업종 — basic 의 industryCodeType 은 사라졌다(2026-09-30 실측). integration.industryCode → 업종 표(lib/naverUpjong) → 야후 11개 섹터
  const [basic, integ, upjong] = await Promise.all([
    naverBasic(code),
    naverFetch(`https://m.stock.naver.com/api/stock/${code}/integration`).then(r => (r.ok ? r.json() : null)).catch(() => null),
    naverUpjongMap(),
  ])
  const integIndustry = industryNameOf(integ, upjong)
  // 기본 지표 — integration.totalInfos 우선, 옛 basic 필드는 돌아오면 폴백(2026-10-01 실측: basic 에서 per·eps·배당·시총·52주가 전부 사라져 국내 지표가 통째로 null 이었다)
  const nb = parseNaverBasics(integ)
  if (!basic && !integ) return { ...nullFundamentals(), sector: upjongToGics(integIndustry) }
  const old = basic ?? {}

  const per = nb.per ?? (typeof old.per === 'number' && old.per > 0 ? old.per : null)
  const eps = nb.eps ?? (typeof old.eps === 'number' ? old.eps : null)
  const dy  = nb.dividendYield ?? (typeof old.dividendYield === 'number' ? old.dividendYield / 100 : null)
  const mc  = nb.marketCap ?? (typeof old.marketValue === 'number' ? old.marketValue : null)

  const industryName: string | null = integIndustry ?? old.industryCodeType?.name ?? null
  const sector = upjongToGics(industryName) ?? krSectorToLynchSector(industryName) ?? industryName

  // 간단한 성장률 추정: EPS가 양수면 기본 성장 가정, 음수면 회생
  // 실제 YoY EPS 성장률은 별도 API 필요 — 여기서는 null 처리
  const earningsGrowth = eps != null && eps < 0 ? -0.5 : null

  return {
    pe:             per != null ? per : 'N/A',
    peg:            'N/A',
    marketCap:      mc,
    volume:         null,
    high52w:        nb.high52w ?? (typeof old.high52week === 'number' ? old.high52week : null),
    low52w:         nb.low52w  ?? (typeof old.low52week  === 'number' ? old.low52week  : null),
    sector,
    earningsGrowth,
    dividendYield:  dy,
    isEtf:          false,
    eps,
    pbr:        nb.pbr,
    forwardEps: null,
    payoutRatio:    null,   // Naver에서 배당성향 별도 미제공
    annualDividend: nb.annualDividend,
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
  // 1Y: 증권사 '월' 뷰처럼 월봉 장기. range=max는 야후가 불규칙 → 15y로 깔끔한 월봉.
  //     어린 종목(GEV)은 가용 전체(28개월), 노장은 최근 120개월(10년)
  '1Y': { range: '15y', interval: '1mo', take: 120 },  // 월봉 최대 120 (약 10년)
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

    const candles: Candle[] = ts
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
    return candles.slice(-take)   // 최근 N개만 (KR과 동일 개수)
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

// ⚠️ 업비트 시세 API 는 IP 당 초당 10회(그룹별)다. 코인 4종을 한 번에 부르면 예전엔 코인당 8회 × 4 = 32회가 동시에 나가
//    SOL·XRP 차트가 429 로 떨어지고 현재가 직선으로 채워진 채 60초 캐시에 들어갔다(2026-09-29 /s/coin 실측 — 4종 중 2종 직선).
//    → 호출 시작 간격을 벌리고(초당 약 8회), 429 면 1초 뒤 한 번 더 부른다. 요청 수도 코인당 5회로 줄였다(아래 fetchCrypto).
const UPBIT_GAP_MS = 120
let upbitNext = 0
async function upbitGet(url: string, retry = true): Promise<Response> {
  const now = Date.now()
  const wait = Math.max(0, upbitNext - now)
  upbitNext = Math.max(now, upbitNext) + UPBIT_GAP_MS
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  const res = await fetch(url, { headers: UPBIT_H, next: { revalidate: 0 } })
  if (res.status === 429 && retry) {
    await new Promise(r => setTimeout(r, 1000))
    return upbitGet(url, false)
  }
  return res
}

/** 업비트 현재가 조회 */
async function upbitQuote(ticker: string) {
  const market = upbitMarket(ticker)
  const res = await upbitGet(`https://api.upbit.com/v1/ticker?markets=${market}`)
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

/** 업비트 캔들 원본 — 최신이 먼저(내림차순)로 온다. 실패는 null(빈 배열과 구분: 빈 배열은 '거래 없음') */
interface UpbitCandle { timestamp: number; trade_price: number; opening_price: number; high_price: number; low_price: number; candle_acc_trade_volume?: number; candle_date_time_kst?: string }
async function upbitCandles(path: string, market: string, count: number): Promise<UpbitCandle[] | null> {
  try {
    const res = await upbitGet(`https://api.upbit.com/v1/candles/${path}?market=${market}&count=${count}`)
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data as UpbitCandle[] : null
  } catch { return null }
}
/** 캔들 → 선(과거→최신). last = 마지막 N개만 */
function toLine(c: UpbitCandle[], last?: number): PricePoint[] {
  const pts = [...c].reverse().map(x => ({ t: x.timestamp, v: x.trade_price })).filter(p => p.v > 0 && isFinite(p.t))
  return last ? pts.slice(-last) : pts
}
/** 캔들 → OHLC(과거→최신) */
function toOhlc(c: UpbitCandle[], last?: number): Candle[] {
  const out = [...c].reverse().map(d => ({
    date:   String(d.candle_date_time_kst ?? '').slice(0, 10),
    open:   d.opening_price,
    high:   d.high_price,
    low:    d.low_price,
    close:  d.trade_price,
    volume: d.candle_acc_trade_volume ?? 0,
  })).filter(c => isFinite(c.close) && c.close > 0)
  return last ? out.slice(-last) : out
}

async function fetchCrypto(ticker: string): Promise<StockData> {
  const market = upbitMarket(ticker)
  // 코인당 5회 — 예전 8회(선 3 + 캔들 4 + 시세)에서 일봉 셋(7·30·40·90개)을 90개 한 번으로 합쳤다(같은 엔드포인트의 앞부분이라 값이 같다)
  //   선: 1D=시간봉 24 · 1W=일봉 최근 7 · 1M=일봉 최근 30 / 캔들: 1D=10분봉 72(≈12시간) · 1W=일봉 40 · 1M=일봉 90 · 1Y=주봉 52
  const [hourly, min10, days, weeks, quote] = await Promise.all([
    upbitCandles('minutes/60', market, 24),
    upbitCandles('minutes/10', market, 72),
    upbitCandles('days', market, 90),
    upbitCandles('weeks', market, 52),
    upbitQuote(ticker),
  ])

  const l1D = hourly ? toLine(hourly) : []
  const l1W = days ? toLine(days, 7) : []
  const l1M = days ? toLine(days, 30) : []
  // 빈 선은 현재가 직선으로 채운다(기존 화면 호환) — 대신 그 응답은 캐시하지 않는다
  const partial = !l1D.length || !l1W.length || !l1M.length

  const data: StockData = {
    ticker:       ticker.toUpperCase(),
    name:         ticker.toUpperCase(),
    currentPrice: quote.currentPrice,
    currency:     'KRW',           // ← USD → KRW
    change:       quote.change,
    changePct:    quote.changePct,
    charts: {
      '1D': l1D.length ? l1D : flatLine(quote.currentPrice, 24),
      '1W': l1W.length ? l1W : flatLine(quote.currentPrice, 7),
      '1M': l1M.length ? l1M : flatLine(quote.currentPrice, 30),
      '1Y': [],
    },
    ohlcCharts: {
      '1D': min10 ? toOhlc(min10) : [],
      '1W': days ? toOhlc(days, 40) : [],
      '1M': days ? toOhlc(days) : [],
      '1Y': weeks ? toOhlc(weeks) : [],
    },
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
  if (partial || !min10 || !days || !weeks) PARTIAL.add(data)
  return data
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
