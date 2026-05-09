/**
 * GET /api/stock-info?ticker=005930&market=KR
 *
 * 종목 추가 모달 + 투자분석(PEG 분석)용 재무 데이터 조회
 *
 * 데이터 소스:
 *  KR  : Naver m.stock.naver.com (basic + finance/annual)
 *        → PER, EPS 성장률(다년도), PEG 계산
 *  US  : Naver api.stock.naver.com (overseas)
 *        → stockItemTotalInfos 에서 PER·EPS, finance/annual 에서 순이익 성장률 → PEG
 *  CRYPTO: Upbit 현재가·시총
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Market, Fundamentals } from '@/app/api/stock-price/route'

export interface StockInfo {
  ticker:       string
  name:         string
  market:       Market
  currency:     'USD' | 'KRW'
  fundamentals: Fundamentals
  source:       'live' | 'cache'
  error?:       string
}

const CACHE     = new Map<string, { data: StockInfo; expiresAt: number }>()
const CACHE_TTL = 3_600_000   // 재무 데이터 1시간 캐시

function cKey(ticker: string, market: Market) { return `${market}:${ticker.toUpperCase()}` }

function nullFund(): Fundamentals {
  return { pe:'N/A', peg:'N/A', marketCap:null, volume:null,
           high52w:null, low52w:null, sector:null,
           earningsGrowth:null, dividendYield:null, isEtf:false }
}

const NAVER_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
  Referer: 'https://finance.naver.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

// ── 공통 유틸 ────────────────────────────────────────────────────────────────
const parseNum = (v: unknown): number | null => {
  if (typeof v === 'number') return isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.-]/g, ''))
    return isFinite(n) ? n : null
  }
  return null
}

/** finance/annual rowList에서 지정 항목의 특정 연도 값 추출 */
function getAnnualVal(rowList: { title:string; columns: Record<string,{value:string}> }[], title: string, key: string): number | null {
  const row = rowList.find(r => r.title === title)
  return parseNum(row?.columns?.[key]?.value)
}

/** 다년도 성장률 계산 (직전 2개 실제 연도 비교) */
function calcGrowth(rowList: { title:string; columns: Record<string,{value:string}> }[], title: string, actualKeys: string[]): number | null {
  if (actualKeys.length < 2) return null
  const prev = actualKeys[actualKeys.length - 2]
  const last = actualKeys[actualKeys.length - 1]
  const vPrev = getAnnualVal(rowList, title, prev)
  const vLast = getAnnualVal(rowList, title, last)
  if (vPrev === null || vLast === null) return null
  if (vPrev <= 0) return null   // 적자 기준이면 성장률 의미 없음
  return (vLast - vPrev) / vPrev
}

// ── KR (Naver 모바일 + finance/annual) ─────────────────────────────────────
const KR_INDUSTRY: [RegExp, string][] = [
  [/부동산/, 'Real Estate'],      [/석유|정제|코크스/, 'Energy'],
  [/화학|도료|비료/, 'Basic Materials'], [/철강|금속|1차금속/, 'Basic Materials'],
  [/건설|토목/, 'Industrials'],   [/조선|항공|방위/, 'Industrials'],
  [/운수|창고|물류/, 'Industrials'],[/음식료|식품|담배/, 'Consumer Defensive'],
  [/의류|섬유/, 'Consumer Cyclical'],[/통신/, 'Communication Services'],
  [/전기.가스|전력/, 'Utilities'], [/금융|은행|보험|증권/, 'Financial Services'],
  [/의약품|바이오|제약/, 'Healthcare'],[/소프트웨어|IT서비스/, 'Technology'],
  [/전자부품|반도체/, 'Technology'],[/게임|엔터|방송/, 'Communication Services'],
]
function krSector(name: string | null): string | null {
  if (!name) return null
  for (const [re, sec] of KR_INDUSTRY) if (re.test(name)) return sec
  return null
}

async function krInfo(ticker: string): Promise<StockInfo> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '')

  const [basicRes, annualRes] = await Promise.all([
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`,          { headers: NAVER_H, next:{ revalidate:3600 } }),
    fetch(`https://m.stock.naver.com/api/stock/${code}/finance/annual`, { headers: NAVER_H, next:{ revalidate:3600 } }),
  ])

  if (!basicRes.ok) throw new Error(`네이버 KR 조회 실패 (${basicRes.status}): ${code}`)
  const d = await basicRes.json()
  if (!d?.stockName) throw new Error(`KR 종목 없음: ${code}`)

  const industryName: string | null = d.industryCodeType?.name ?? null
  const sector   = krSector(industryName)
  const mc       = typeof d.marketValue === 'number' ? d.marketValue : null

  // ETF 판별: 종목명에 운용사 브랜드 포함 여부 (industryCodeType은 일반주도 undefined라 신뢰 불가)
  const KR_ETF_BRANDS = ['TIGER','KODEX','ACE','PLUS','KBSTAR','HANARO','ARIRANG','SOL','RISE','1Q','ETF']
  const stockNameUpper = (d.stockName as string ?? '').toUpperCase()
  const isEtf = KR_ETF_BRANDS.some(b => stockNameUpper.includes(b))

  let per: number | 'N/A' = 'N/A'
  let peg: number | 'N/A' = 'N/A'
  let earningsGrowth: number | null = null
  let dividendYield:  number | null = null
  let high52w: number | null = null
  let low52w:  number | null = null

  if (annualRes.ok) {
    try {
      const fin = await annualRes.json()
      type Row = { title:string; columns: Record<string,{value:string}> }
      const rowList: Row[] = fin?.financeInfo?.rowList ?? []
      const trList: { isConsensus:string; key:string }[] = fin?.financeInfo?.trTitleList ?? []

      // 실제 연도만 (isConsensus='N'), 오름차순
      const actual = trList.filter(t => t.isConsensus === 'N').map(t => t.key).sort()
      const lastKey = actual[actual.length - 1]

      // PER (가장 최근 실제 연도)
      const perVal = getAnnualVal(rowList, 'PER', lastKey)
      if (perVal !== null && perVal > 0) per = perVal

      // 고/저가 (basic API fallback)
      high52w = typeof d.high52week === 'number' ? d.high52week : null
      low52w  = typeof d.low52week  === 'number' ? d.low52week  : null

      // EPS 성장률: 당기순이익 기준 (EPS 항목 없을 때 대체)
      const epsGrowth = calcGrowth(rowList, 'EPS', actual)
               ?? calcGrowth(rowList, '지배주주순이익', actual)
               ?? calcGrowth(rowList, '당기순이익', actual)

      if (epsGrowth !== null) {
        earningsGrowth = epsGrowth
        if (typeof per === 'number' && epsGrowth > 0) {
          peg = parseFloat((per / (epsGrowth * 100)).toFixed(2))
        }
      }

      // 배당수익률
      const dyVal = getAnnualVal(rowList, '배당수익률', lastKey)
      if (dyVal !== null) dividendYield = dyVal / 100
      else if (typeof d.dividendYield === 'number') dividendYield = d.dividendYield / 100

    } catch { /* annual 파싱 실패 → basic 값 사용 */ }
  }

  // basic API PER fallback
  if (per === 'N/A' && typeof d.per === 'number' && d.per > 0) per = d.per

  return {
    ticker: code, name: d.stockName as string,
    market: 'KR', currency: 'KRW',
    fundamentals: {
      pe: per, peg, marketCap: mc, volume: null,
      high52w, low52w, sector, earningsGrowth, dividendYield, isEtf,
    },
    source: 'live',
  }
}

// ── US (Naver 해외주식 api.stock.naver.com) ──────────────────────────────────
// NASDAQ: TICKER.O  NYSE: TICKER.N  또는 접미사 없이 바로 TICKER (GEV, 일부 신규주)
const US_SUFFIXES = ['', '.O', '.N', '.OQ', '.AS']

async function usInfo(ticker: string): Promise<StockInfo> {
  const t = ticker.toUpperCase()

  for (const suffix of US_SUFFIXES) {
    const code = `${t}${suffix}`
    const [basicRes, annualRes] = await Promise.all([
      fetch(`https://api.stock.naver.com/stock/${code}/basic`,          { headers: NAVER_H, next:{ revalidate:3600 } }),
      fetch(`https://api.stock.naver.com/stock/${code}/finance/annual`, { headers: NAVER_H, next:{ revalidate:3600 } }),
    ])
    if (!basicRes.ok) continue

    const d = await basicRes.json()
    const name: string = d.stockNameEng ?? d.stockName ?? t
    const isEtf: boolean = d.isEtf === true || d.isEtfAmerica === true

    // stockItemTotalInfos → PER, EPS, 시총, 52주 고/저
    type Item = { code:string; value:string }
    const items: Item[] = d.stockItemTotalInfos ?? []
    const getItem = (c: string) => items.find(i => i.code === c)?.value ?? null

    const perStr = getItem('per')   // "43.74배"
    const epsStr = getItem('eps')   // "4.92"
    const mcStr  = getItem('marketValue')  // "5조 2,294억 USD"
    const h52Str = getItem('highPriceOf52Weeks')
    const l52Str = getItem('lowPriceOf52Weeks')

    const per = perStr ? parseNum(perStr) : null
    // eps는 향후 활용 예정 (현재 미사용)
    void (epsStr ? parseNum(epsStr) : null)

    // 시총: USD 백만 단위로 환산 (거친 추정)
    let marketCap: number | null = null
    if (mcStr && mcStr.includes('조')) {
      const m = parseNum(mcStr.replace(/[^0-9.]/g,''))
      if (m) marketCap = m * 1e12 / 1350   // KRW 표기 → USD 추정
    }

    let earningsGrowth: number | null = null
    let peg: number | 'N/A' = 'N/A'

    if (annualRes.ok && !isEtf) {
      try {
        const fin = await annualRes.json()
        type Row = { title:string; columns: Record<string,{value:string}> }
        const rowList: Row[] = fin?.rowList ?? []
        const trList: { isConsensus:string; key:string }[] = fin?.trTitleList ?? []
        const actual = trList.filter(t => t.isConsensus === 'N').map(t => t.key).sort()

        // 순이익 성장률 (당기순이익 또는 세후손익)
        const growth = calcGrowth(rowList, '당기순이익', actual)
                    ?? calcGrowth(rowList, '세후손익', actual)

        if (growth !== null) {
          earningsGrowth = growth
          if (per !== null && per > 0 && growth > 0) {
            peg = parseFloat((per / (growth * 100)).toFixed(2))
          }
        }
      } catch { /* 무시 */ }
    }

    // 업종 (Naver US 업종)
    const industryGroup: string | null = d.industryCodeType?.industryGroupKor ?? null

    return {
      ticker: t, name, market: 'US', currency: 'USD',
      fundamentals: {
        pe:             per ?? 'N/A',
        peg,
        marketCap,
        volume:         null,
        high52w:        h52Str ? parseNum(h52Str) : null,
        low52w:         l52Str ? parseNum(l52Str) : null,
        sector:         industryGroup,
        earningsGrowth,
        dividendYield:  null,
        isEtf,
      },
      source: 'live',
    }
  }

  // ── Naver 모든 suffix 실패 → yahoo-finance2 v3 fallback (GEV 등 신규 상장주) ──
  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })

    const [quote, summary] = await Promise.allSettled([
      yf.quote(t),
      yf.quoteSummary(t, { modules: ['summaryDetail','defaultKeyStatistics','financialData'] }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qData: any = quote.status === 'fulfilled' ? quote.value : null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sData: any = summary.status === 'fulfilled' ? summary.value : null

    const name    = qData?.longName ?? qData?.shortName ?? t
    const pe      = sData?.summaryDetail?.trailingPE ?? null
    const pegDirect = sData?.defaultKeyStatistics?.pegRatio ?? null
    // earningsGrowth: Yahoo가 % 단위로 반환 (0.18 = 18%)
    // 극단값(>500%) 신규 상장주는 revenueGrowth 대체
    const egRawFull = sData?.financialData?.earningsGrowth ?? null
    const revGrowth = sData?.financialData?.revenueGrowth    ?? null
    const egRaw = (egRawFull !== null && Math.abs(egRawFull) < 5)
      ? egRawFull   // 정상 범위 (500% 미만)
      : revGrowth   // 신규주 fallback → 매출 성장률
    const mcRaw  = sData?.summaryDetail?.marketCap ?? null
    const isEtfY = qData?.quoteType?.toUpperCase() === 'ETF'

    // PEG: Yahoo 직접값 → 재계산 순서
    let finalPeg: number | 'N/A' = 'N/A'
    if (typeof pegDirect === 'number' && pegDirect > 0 && pegDirect < 50) {
      finalPeg = parseFloat(pegDirect.toFixed(2))         // Yahoo PEG 직접 사용
    } else if (pe !== null && pe > 0 && egRaw !== null && egRaw > 0) {
      finalPeg = parseFloat((pe / (egRaw * 100)).toFixed(2))  // 재계산
    }

    return {
      ticker: t, name, market: 'US', currency: 'USD',
      fundamentals: {
        pe:             pe ?? 'N/A',
        peg:            finalPeg,
        marketCap:      mcRaw ?? null,
        volume:         null,
        high52w:        qData?.fiftyTwoWeekHigh ?? null,
        low52w:         qData?.fiftyTwoWeekLow  ?? null,
        sector:         qData?.sector ?? null,
        earningsGrowth: egRaw ?? null,
        dividendYield:  sData?.summaryDetail?.dividendYield ?? null,
        isEtf:          isEtfY,
      },
      source: 'live',
    }
  } catch (yfErr) {
    console.warn(`[stock-info] yahoo-finance2 fallback 실패: ${t}`, (yfErr as Error).message)
  }

  // 완전 실패 → 이름만 반환
  return {
    ticker: t, name: t, market: 'US', currency: 'USD',
    fundamentals: nullFund(),
    source: 'live', error: `재무 데이터를 가져올 수 없습니다: ${t}`,
  }
}

// ── CRYPTO (Upbit) ────────────────────────────────────────────────────────────
async function cryptoInfo(ticker: string): Promise<StockInfo> {
  const t      = ticker.toUpperCase()
  const market = `KRW-${t}`
  const res    = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`, { headers:{ Accept:'application/json' }, next:{ revalidate:0 } })
  if (!res.ok) throw new Error(`업비트 조회 실패 (${res.status}): ${market}`)
  const arr = await res.json()
  const d   = arr?.[0]
  if (!d?.trade_price) throw new Error(`업비트 데이터 없음: ${market}`)

  // 업비트 마켓 목록에서 이름
  let name = t
  try {
    const mRes = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { headers:{ Accept:'application/json' }, next:{ revalidate:3600 } })
    if (mRes.ok) {
      const markets: { market:string; english_name:string; korean_name:string }[] = await mRes.json()
      const found = markets.find(m => m.market === market)
      if (found) name = found.english_name ?? found.korean_name ?? t
    }
  } catch { /* ignore */ }

  return {
    ticker: t, name, market: 'CRYPTO', currency: 'KRW',
    fundamentals: {
      pe:'N/A', peg:'N/A',
      marketCap: d.acc_trade_price_24h ?? null,
      volume:    d.acc_trade_volume_24h ?? null,
      high52w:   d.highest_52_week_price ?? null,
      low52w:    d.lowest_52_week_price  ?? null,
      sector: null, earningsGrowth: null, dividendYield: null, isEtf: false,
    },
    source: 'live',
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ticker = searchParams.get('ticker')?.trim()
  const market = (searchParams.get('market')?.toUpperCase() ?? 'US') as Market

  if (!ticker) return NextResponse.json({ error:'티커를 입력해주세요.' }, { status:400 })
  if (!['US','KR','CRYPTO'].includes(market))
    return NextResponse.json({ error:'market은 US|KR|CRYPTO' }, { status:400 })

  const k = cKey(ticker, market)
  const cached = CACHE.get(k)
  if (cached && Date.now() < cached.expiresAt)
    return NextResponse.json(cached.data, { headers:{ 'X-Cache':'HIT','Cache-Control':'no-store' } })

  try {
    let info: StockInfo
    if (market === 'KR')     info = await krInfo(ticker)
    else if (market === 'US') info = await usInfo(ticker)
    else                      info = await cryptoInfo(ticker)

    CACHE.set(k, { data: info, expiresAt: Date.now() + CACHE_TTL })
    return NextResponse.json(info, { headers:{ 'X-Cache':'MISS','Cache-Control':'no-store' } })

  } catch (err) {
    const stale = CACHE.get(k)
    if (stale) return NextResponse.json({ ...stale.data, source:'cache', error:(err as Error).message }, { headers:{ 'X-Cache':'FALLBACK','Cache-Control':'no-store' } })
    return NextResponse.json({ error:(err as Error).message, ticker, market }, { status:502 })
  }
}
