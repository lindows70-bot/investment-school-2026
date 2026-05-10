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
           earningsGrowth:null, dividendYield:null, isEtf:false,
           eps:null, pbr:null, forwardEps:null, payoutRatio:null, annualDividend:null }
}

const NAVER_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
  Referer: 'https://finance.naver.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

// ── Yahoo Finance2 배당 데이터 공통 헬퍼 ────────────────────────────────────
// US 주식/ETF: ticker 그대로  (AAPL, SPY, NVDA ...)
// KR 주식/ETF: ticker + '.KS' (000660.KS, 102110.KS ...)
const DIV_EMPTY = { dividendYield: null, payoutRatio: null, annualDividend: null }

async function fetchDividendFromYahoo(
  ticker: string, market: Market
): Promise<{ dividendYield: number|null; payoutRatio: number|null; annualDividend: number|null }> {
  // 4초 타임아웃 — 병렬 호출 시 야후 느릴 때 핵심 재무데이터 블로킹 방지
  const timeout = new Promise<typeof DIV_EMPTY>(res =>
    setTimeout(() => res(DIV_EMPTY), 4000)
  )
  const fetch = async () => {
    try {
      const yfTicker = market === 'KR' ? `${ticker}.KS` : ticker
      const { default: YahooFinance } = await import('yahoo-finance2')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
      const summary = await yf.quoteSummary(yfTicker, { modules: ['summaryDetail'] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sd: any = summary?.summaryDetail ?? {}
      const pick = (v: unknown) => typeof v === 'number' && isFinite(v) && v > 0 ? v : null
      return {
        dividendYield:  pick(sd.dividendYield)   ?? pick(sd.trailingAnnualDividendYield),
        payoutRatio:    pick(sd.payoutRatio),
        annualDividend: pick(sd.dividendRate)     ?? pick(sd.trailingAnnualDividendRate),
      }
    } catch {
      return DIV_EMPTY
    }
  }
  return Promise.race([fetch(), timeout])
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

/** finance/annual rowList에서 지정 항목의 특정 연도 값 추출 (완전 일치) */
function getAnnualVal(rowList: { title:string; columns: Record<string,{value:string}> }[], title: string, key: string): number | null {
  const row = rowList.find(r => r.title === title)
  return parseNum(row?.columns?.[key]?.value)
}

/** finance/annual rowList에서 부분 일치로 항목 추출 (인코딩 깨짐 대응) */
function getAnnualValLike(rowList: { title:string; columns: Record<string,{value:string}> }[], partial: string, key: string): number | null {
  const row = rowList.find(r => r.title.includes(partial))
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

// ── 공공데이터포털 (data.go.kr) — 국내 ETF 분배금 조회 ──────────────────────
// 발급: https://www.data.go.kr → "금융투자협회 ETF" 검색 → 무료 신청
// 환경변수: DATA_GO_KR_SERVICE_KEY
async function fetchEtfDividendFromPublicData(
  code: string
): Promise<{ dividendYield: number|null; annualDividend: number|null; payoutRatio: number|null }> {
  const empty = { dividendYield: null, annualDividend: null, payoutRatio: null }
  const svcKey = process.env.DATA_GO_KR_SERVICE_KEY
  if (!svcKey) return empty

  try {
    // 시도 1: 금융투자협회(KOFIA) ETF 정보 API (B190021)
    const kofiaRes = await fetch(
      `https://apis.data.go.kr/B190021/getEtfItemInfo/getEtfItemInfo` +
      `?serviceKey=${encodeURIComponent(svcKey)}&numOfRows=1&resultType=json` +
      `&ISU_SRT_CD=${code}`,
      { next: { revalidate: 3600 } }
    )
    if (kofiaRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kData: any = await kofiaRes.json()
      const item = kData?.response?.body?.items?.item
      const it = Array.isArray(item) ? item[0] : item
      if (it) {
        const toN = (v: unknown) => {
          const n = parseFloat(String(v ?? '').replace(/,/g,''))
          return isFinite(n) && n > 0 ? n : null
        }
        // KOFIA ETF 응답 필드: dvdYldRt(배당수익률%), clpr(종가), dvdAmt(배당금)
        const dvdYld = toN(it.dvdYldRt ?? it.dvdYld)
        const dvdAmt = toN(it.dvdAmt ?? it.dvdAmtPerShr)
        return {
          dividendYield:  dvdYld != null ? dvdYld / 100 : null,
          annualDividend: dvdAmt,
          payoutRatio:    null,
        }
      }
    }

    // 시도 2: 한국예탁결제원(KSD) 배당금 정보 (B551660)
    const ksdRes = await fetch(
      `https://apis.data.go.kr/B551660/getDvdInfo/getDvdInfo` +
      `?serviceKey=${encodeURIComponent(svcKey)}&numOfRows=1&resultType=json` +
      `&srtnCd=${code}`,
      { next: { revalidate: 3600 } }
    )
    if (ksdRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kData: any = await ksdRes.json()
      const item = kData?.response?.body?.items?.item
      const it = Array.isArray(item) ? item[0] : item
      if (it) {
        const toN = (v: unknown) => {
          const n = parseFloat(String(v ?? '').replace(/,/g,''))
          return isFinite(n) && n > 0 ? n : null
        }
        return {
          dividendYield:  toN(it.dvdYldRt)  != null ? toN(it.dvdYldRt)! / 100 : null,
          annualDividend: toN(it.dvdAmt ?? it.payAmt),
          payoutRatio:    null,
        }
      }
    }
  } catch (e) {
    console.warn('[PublicData ETF]', (e as Error).message)
  }
  return empty
}

// ── KIS Developer API — 한국 ETF 분배율 조회 ──────────────────────────────
// 앱 등록: https://apiportal.koreainvestment.com/apiservice
// 환경변수: KIS_APP_KEY, KIS_APP_SECRET

const KIS_BASE = 'https://openapi.koreainvestment.com:9443'
// 모듈 레벨 토큰 캐시 (24시간 유효)
let KIS_TOKEN: { value: string; expiresAt: number } | null = null

async function getKisToken(): Promise<string | null> {
  const appKey    = process.env.KIS_APP_KEY
  const appSecret = process.env.KIS_APP_SECRET
  if (!appKey || !appSecret) return null

  // 유효한 캐시가 있으면 재사용
  if (KIS_TOKEN && Date.now() < KIS_TOKEN.expiresAt - 60_000) return KIS_TOKEN.value

  try {
    const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey:     appKey,
        appsecret:  appSecret,
      }),
      next: { revalidate: 0 },
    })
    if (!res.ok) { console.warn('[KIS] 토큰 발급 실패:', res.status); return null }
    const data = await res.json()
    const token      = data.access_token as string
    const expiresIn  = (data.expires_in as number) ?? 86400
    KIS_TOKEN = { value: token, expiresAt: Date.now() + expiresIn * 1000 }
    return token
  } catch (e) { console.warn('[KIS] 토큰 오류:', (e as Error).message); return null }
}

/** KIS API — 국내 ETF 투자정보 (분배율, 1주당분배금 등) */
async function fetchKisEtfDividend(
  code: string
): Promise<{ dividendYield: number|null; annualDividend: number|null; payoutRatio: number|null }> {
  const empty = { dividendYield: null, annualDividend: null, payoutRatio: null }
  const token  = await getKisToken()
  if (!token) return empty

  const appKey    = process.env.KIS_APP_KEY!
  const appSecret = process.env.KIS_APP_SECRET!

  try {
    // KIS ETF 투자정보 조회 (TR_ID: CTOS5001R)
    const res = await fetch(
      `${KIS_BASE}/uapi/domestic-stock/v1/quotations/etf-issue` +
      `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`,
      {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey':    appKey,
          'appsecret': appSecret,
          'tr_id':     'CTOS5001R',
          'custtype':  'P',
        },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) {
      // 401이면 토큰 만료 → 캐시 초기화 후 재시도
      if (res.status === 401) { KIS_TOKEN = null }
      console.warn('[KIS ETF]', res.status, code)
      return empty
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()

    if (data.rt_cd !== '0') {
      console.warn('[KIS ETF] API 오류:', data.msg1, code)
      return empty
    }

    const output = data.output ?? {}
    const toNum  = (v: unknown) => {
      const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : (typeof v === 'number' ? v : NaN)
      return isFinite(n) && n > 0 ? n : null
    }

    // KIS 응답 필드명 (실제 응답에 따라 다를 수 있음)
    // dnrtn_rt: 분배율(%), shr_psnl_dnrtn_amt: 1주당분배금
    const dnrtnRt  = toNum(output.dnrtn_rt)   // 분배율 %  (예: 1.25)
    const dnrtnAmt = toNum(output.shr_psnl_dnrtn_amt  // 1주당분배금 원화
                       ?? output.per_shr_dnrtn_amt
                       ?? output.dnrtn_amt)

    return {
      dividendYield:  dnrtnRt  != null ? dnrtnRt  / 100 : null,  // % → 소수
      annualDividend: dnrtnAmt ?? null,
      payoutRatio:    null,   // ETF는 배당성향 해당없음
    }
  } catch (e) {
    console.warn('[KIS ETF] 오류:', (e as Error).message, code)
    return empty
  }
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

  // 시가총액은 polling API에서 marketValueFullRaw로 가져옴
  const [basicRes, annualRes, pollingRes] = await Promise.all([
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`,          { headers: NAVER_H, next:{ revalidate:3600 } }),
    fetch(`https://m.stock.naver.com/api/stock/${code}/finance/annual`, { headers: NAVER_H, next:{ revalidate:3600 } }),
    fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`, { headers: NAVER_H, next:{ revalidate:0 } }),
  ])

  if (!basicRes.ok) throw new Error(`네이버 KR 조회 실패 (${basicRes.status}): ${code}`)
  const d = await basicRes.json()
  if (!d?.stockName) throw new Error(`KR 종목 없음: ${code}`)

  const industryName: string | null = d.industryCodeType?.name ?? null
  const sector   = krSector(industryName)

  // 시가총액: polling API의 marketValueFullRaw (raw KRW 원화 값)
  let mc: number | null = null
  if (pollingRes.ok) {
    try {
      const polData = await pollingRes.json()
      const raw = polData?.datas?.[0]?.marketValueFullRaw
      if (raw != null) mc = parseFloat(String(raw).replace(/,/g, ''))
    } catch { /* 무시 */ }
  }

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
  let eps:            number | null = null
  let pbr:            number | null = null
  let forwardEps:     number | null = null
  let payoutRatio:    number | null = null
  let annualDividend: number | null = null

  if (annualRes.ok) {
    try {
      const fin = await annualRes.json()
      type Row = { title:string; columns: Record<string,{value:string}> }
      const rowList: Row[] = fin?.financeInfo?.rowList ?? []
      const trList: { isConsensus:string; key:string }[] = fin?.financeInfo?.trTitleList ?? []

      // 실제 연도 (isConsensus='N') + 컨센서스 연도 (isConsensus='Y') 분리
      const actual    = trList.filter(t => t.isConsensus === 'N').map(t => t.key).sort()
      const consensus = trList.filter(t => t.isConsensus === 'Y').map(t => t.key).sort()
      const lastKey        = actual[actual.length - 1]
      const firstConsensus = consensus[0]   // 가장 가까운 예측 연도

      // PER (가장 최근 실제 연도)
      const perVal = getAnnualVal(rowList, 'PER', lastKey)
      if (perVal !== null && perVal > 0) per = perVal

      // 고/저가 (basic API fallback)
      high52w = typeof d.high52week === 'number' ? d.high52week : null
      low52w  = typeof d.low52week  === 'number' ? d.low52week  : null

      // EPS 성장률: 다양한 항목명 시도 (회사마다 다를 수 있음)
      const epsGrowth = calcGrowth(rowList, 'EPS', actual)
               ?? calcGrowth(rowList, '지배주주순이익', actual)
               ?? calcGrowth(rowList, '당기순이익', actual)
               ?? calcGrowth(rowList, '지배기업주주귀속당기순이익', actual)

      if (epsGrowth !== null) {
        earningsGrowth = epsGrowth
        if (typeof per === 'number' && epsGrowth > 0) {
          peg = parseFloat((per / (epsGrowth * 100)).toFixed(2))
        }
      }

      // EPS (가장 최근 실제 연도)
      const epsVal = getAnnualVal(rowList, 'EPS', lastKey)
      if (epsVal !== null) eps = epsVal

      // Forward EPS (가장 가까운 컨센서스 예측 연도 EPS)
      if (firstConsensus) {
        const fwdVal = getAnnualVal(rowList, 'EPS', firstConsensus)
        if (fwdVal !== null && fwdVal !== 0) forwardEps = fwdVal
      }

      // ── PEG 보완: 음수 성장(전년 역성장)이면 Forward EPS 성장률로 대체 계산 ──
      // (ex. 한화에어로스페이스처럼 기저 효과로 trailing 성장 음수인 경우)
      if (peg === 'N/A' && typeof per === 'number' && per > 0 && firstConsensus && eps != null && eps > 0) {
        const fwdE = getAnnualVal(rowList, 'EPS', firstConsensus)
        if (fwdE != null && fwdE > 0) {
          const fwdGrowth = (fwdE - eps) / eps
          if (fwdGrowth > 0) {
            peg = parseFloat((per / (fwdGrowth * 100)).toFixed(2))
            // forward PEG임을 표시하기 위해 earningsGrowth도 업데이트
            if (earningsGrowth == null || earningsGrowth <= 0) {
              earningsGrowth = fwdGrowth
            }
          }
        }
      }

      // PBR (가장 최근 실제 연도)
      const pbrVal = getAnnualVal(rowList, 'PBR', lastKey)
      if (pbrVal !== null && pbrVal > 0) pbr = pbrVal

      // 배당수익률 — '배당수익률' 행 우선, 없으면 부분매칭
      const dyVal = getAnnualVal(rowList, '배당수익률', lastKey)
               ?? getAnnualValLike(rowList, '배당수익', lastKey)
      if (dyVal !== null) dividendYield = dyVal / 100
      else if (typeof d.dividendYield === 'number') dividendYield = d.dividendYield / 100

      // 배당성향 — '배당성향' 또는 부분매칭
      const payoutVal = getAnnualVal(rowList, '배당성향', lastKey)
                     ?? getAnnualValLike(rowList, '배당성', lastKey)
      if (payoutVal != null && payoutVal > 0) payoutRatio = payoutVal / 100

      // 연간 배당금/주 — 'DPS', '주당배당금', '주당배당' (인코딩 깨짐 대응)
      const dpsVal = getAnnualVal(rowList, 'DPS', lastKey)
                  ?? getAnnualVal(rowList, '주당배당금', lastKey)
                  ?? getAnnualValLike(rowList, '주당배당', lastKey)
      if (dpsVal != null && dpsVal > 0) {
        annualDividend = dpsVal
        // 배당수익률이 없으면 현재가(basic API closePrice) 기반으로 계산
        if (dividendYield == null) {
          const closeP = parseNum(d.closePrice)
          if (closeP != null && closeP > 0) dividendYield = dpsVal / closeP
        }
        // 배당성향 없으면 EPS로 역산
        if (payoutRatio == null && eps != null && eps > 0) {
          payoutRatio = dpsVal / eps
        }
      }

    } catch { /* annual 파싱 실패 → basic 값 사용 */ }
  }

  // basic API PER fallback
  if (per === 'N/A' && typeof d.per === 'number' && d.per > 0) per = d.per

  // ETF이거나 배당 데이터 없으면 다중 소스 폴백
  if (dividendYield == null || (isEtf && annualDividend == null)) {
    if (isEtf) {
      // 국내 ETF 분배금 조회 우선순위:
      // 1) 공공데이터포털 (DATA_GO_KR_SERVICE_KEY)
      // 2) KIS Developer API (KIS_APP_KEY)
      const pubDiv = await fetchEtfDividendFromPublicData(code)
      if (pubDiv.dividendYield  != null) dividendYield  = pubDiv.dividendYield
      if (pubDiv.annualDividend != null) annualDividend = pubDiv.annualDividend
      if (pubDiv.payoutRatio    != null) payoutRatio    = pubDiv.payoutRatio

      // 공공데이터포털 실패 시 KIS API 폴백
      if (dividendYield == null) {
        const kisDiv = await fetchKisEtfDividend(code)
        if (kisDiv.dividendYield  != null) dividendYield  = kisDiv.dividendYield
        if (kisDiv.annualDividend != null) annualDividend = kisDiv.annualDividend
        if (kisDiv.payoutRatio    != null) payoutRatio    = kisDiv.payoutRatio
      }
    }
    // KIS 실패 or 일반 주식: Yahoo Finance (.KS) 폴백
    if (dividendYield == null) {
      const yd = await fetchDividendFromYahoo(code, 'KR')
      if (dividendYield  == null) dividendYield  = yd.dividendYield
      if (payoutRatio    == null) payoutRatio    = yd.payoutRatio
      if (annualDividend == null) annualDividend = yd.annualDividend
    }
  }

  return {
    ticker: code, name: d.stockName as string,
    market: 'KR', currency: 'KRW',
    fundamentals: {
      pe: per, peg, marketCap: mc, volume: null,
      high52w, low52w, sector, earningsGrowth, dividendYield, isEtf,
      eps, pbr, forwardEps, payoutRatio, annualDividend,
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

    const per    = perStr ? parseNum(perStr) : null
    const epsVal = epsStr ? parseNum(epsStr) : null
    const pbrStr = getItem('pbr')
    const pbrVal = pbrStr ? parseNum(pbrStr) : null

    // 시총: USD 백만 단위로 환산 (거친 추정)
    let marketCap: number | null = null
    if (mcStr && mcStr.includes('조')) {
      const m = parseNum(mcStr.replace(/[^0-9.]/g,''))
      if (m) marketCap = m * 1e12 / 1350   // KRW 표기 → USD 추정
    }

    let earningsGrowth: number | null = null
    let peg:            number | 'N/A' = 'N/A'
    let forwardEpsUs:   number | null = null

    if (annualRes.ok && !isEtf) {
      try {
        const fin = await annualRes.json()
        type Row = { title:string; columns: Record<string,{value:string}> }
        const rowList: Row[] = fin?.rowList ?? []
        const trList: { isConsensus:string; key:string }[] = fin?.trTitleList ?? []
        const actual    = trList.filter(t => t.isConsensus === 'N').map(t => t.key).sort()
        const consensus = trList.filter(t => t.isConsensus === 'Y').map(t => t.key).sort()

        // 순이익 성장률 (당기순이익 또는 세후손익)
        const growth = calcGrowth(rowList, '당기순이익', actual)
                    ?? calcGrowth(rowList, '세후손익', actual)

        if (growth !== null) {
          earningsGrowth = growth
          if (per !== null && per > 0 && growth > 0) {
            peg = parseFloat((per / (growth * 100)).toFixed(2))
          }
        }

        // Forward EPS — 컨센서스 연도 EPS (Naver US는 컨센서스 없음 → Yahoo로 fallback)
        const firstConsensusUs = consensus[0]
        if (firstConsensusUs) {
          const fv = getAnnualVal(rowList, 'EPS', firstConsensusUs)
              ?? getAnnualVal(rowList, '세후손익', firstConsensusUs)
          if (fv !== null && fv !== 0) forwardEpsUs = fv
        }
      } catch { /* 무시 */ }
    }

    // PEG가 'N/A'이면 (음수 성장 등) Yahoo에서 직접 pegRatio 보충
    if (peg === 'N/A' && !isEtf) {
      try {
        const { default: YahooFinance } = await import('yahoo-finance2')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
        const summary = await yf.quoteSummary(t, { modules: ['defaultKeyStatistics'] })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pegRaw = (summary as any)?.defaultKeyStatistics?.pegRatio ?? null
        if (typeof pegRaw === 'number' && isFinite(pegRaw) && pegRaw > 0 && pegRaw < 200) {
          peg = parseFloat(pegRaw.toFixed(2))
        }
      } catch { /* 무시 */ }
    }

    // 업종 (Naver US 업종)
    const industryGroup: string | null = d.industryCodeType?.industryGroupKor ?? null

    // forwardEps + 배당 동시 병렬 조회 (3초 타임아웃 — 핵심 재무데이터 절대 블로킹 안 함)
    const [fwdEpsResult, usDivData] = await Promise.all([
      // Forward EPS (yahoo-finance2, 3초 타임아웃)
      forwardEpsUs === null && !isEtf
        ? Promise.race([
            (async () => {
              try {
                const { default: YahooFinance } = await import('yahoo-finance2')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
                const s = await yf.quoteSummary(t, { modules: ['defaultKeyStatistics'] })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const v = (s as any)?.defaultKeyStatistics?.forwardEps ?? null
                return typeof v === 'number' && isFinite(v) ? v : null
              } catch { return null }
            })(),
            new Promise<null>(r => setTimeout(() => r(null), 3000)),
          ])
        : Promise.resolve(forwardEpsUs),
      // 배당 (4초 타임아웃 — fetchDividendFromYahoo 내부에 이미 있음)
      fetchDividendFromYahoo(t, 'US'),
    ])
    if (fwdEpsResult !== null) forwardEpsUs = fwdEpsResult

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
        dividendYield:  usDivData.dividendYield,
        isEtf,
        eps:        epsVal,
        pbr:        pbrVal,
        forwardEps: forwardEpsUs,
        payoutRatio:    usDivData.payoutRatio,
        annualDividend: usDivData.annualDividend,
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

    const name       = qData?.longName ?? qData?.shortName ?? t
    const pe         = sData?.summaryDetail?.trailingPE ?? null
    const pegDirect  = sData?.defaultKeyStatistics?.pegRatio ?? null
    const trailingEps = sData?.defaultKeyStatistics?.trailingEps ?? null
    const fwdEps     = sData?.defaultKeyStatistics?.forwardEps ?? null
    const pbrY       = sData?.defaultKeyStatistics?.priceToBook ?? null
    // earningsGrowth: Yahoo가 % 단위로 반환 (0.18 = 18%)
    // 극단값(>500%) 신규 상장주는 revenueGrowth 대체
    const egRawFull = sData?.financialData?.earningsGrowth ?? null
    const revGrowth = sData?.financialData?.revenueGrowth    ?? null
    const egRaw = (egRawFull !== null && Math.abs(egRawFull) < 5)
      ? egRawFull   // 정상 범위 (500% 미만)
      : revGrowth   // 신규주 fallback → 매출 성장률
    const mcRaw  = sData?.summaryDetail?.marketCap ?? null
    const isEtfY = qData?.quoteType?.toUpperCase() === 'ETF'
    const payoutRatioY    = sData?.summaryDetail?.payoutRatio?.raw ?? sData?.summaryDetail?.payoutRatio ?? null
    const annualDividendY = sData?.summaryDetail?.dividendRate?.raw ?? sData?.summaryDetail?.dividendRate ?? null

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
        eps:        typeof trailingEps === 'number' ? trailingEps : null,
        pbr:        typeof pbrY === 'number' && pbrY > 0 ? +pbrY.toFixed(2) : null,
        forwardEps: typeof fwdEps === 'number' ? fwdEps : null,
        payoutRatio:    typeof payoutRatioY === 'number'    && isFinite(payoutRatioY)    ? payoutRatioY    : null,
        annualDividend: typeof annualDividendY === 'number' && isFinite(annualDividendY) ? annualDividendY : null,
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
      eps: null, pbr: null, forwardEps: null, payoutRatio: null, annualDividend: null,
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
