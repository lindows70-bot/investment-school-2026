/**
 * GET /api/lynch-classify?ticker=NVDA&market=US
 *
 * 피터 린치 6대 분류 자동 판별.
 * - US:     Yahoo Finance v8(ETF 판별) + v10(재무) + 하드코딩 테이블 + 기본값
 * - KR:     Naver basic API — industryCodeType 없으면 ETF
 * - CRYPTO: 항상 'na'
 * - ETF:    항상 'na'
 *
 * 응답: { category: LynchKey | 'na' | null, isEtf: boolean, source: string }
 */

import { NextRequest, NextResponse } from 'next/server'

export type LynchKey =
  | 'slow_grower' | 'stalwart' | 'fast_grower'
  | 'cyclical'    | 'turnaround' | 'asset_play'
  | 'na'   // ETF / 암호화폐

export interface ClassifyResult {
  category: LynchKey | null
  isEtf:    boolean
  source:   string
}

// ETF 이름 패턴 (운용사 브랜드 prefix)
const ETF_NAME_RE = /^(TIGER|KODEX|ACE|PLUS|KBSTAR|HANARO|ARIRANG|SOL)\s/i

// ─── 하드코딩 테이블 (Yahoo Finance v10 차단 시 fallback) ───────────────────────
const US_KNOWN: Record<string, LynchKey> = {
  // Fast Growers
  NVDA:'fast_grower', PLTR:'fast_grower', META:'fast_grower',
  AMZN:'fast_grower', TSLA:'fast_grower', GEV:'fast_grower',
  CRWD:'fast_grower', NET:'fast_grower',  SHOP:'fast_grower',
  SNOW:'fast_grower', COIN:'fast_grower', SQ:'fast_grower',
  MRVL:'fast_grower', ARM:'fast_grower',  SMCI:'fast_grower',
  // Stalwarts
  AAPL:'stalwart', MSFT:'stalwart', GOOGL:'stalwart', GOOG:'stalwart',
  JPM:'stalwart',  V:'stalwart',    MA:'stalwart',    JNJ:'stalwart',
  UNH:'stalwart',  PG:'stalwart',   KO:'stalwart',    WMT:'stalwart',
  HD:'stalwart',   COST:'stalwart', ABBV:'stalwart',  LLY:'stalwart',
  NVO:'stalwart',  ASML:'stalwart', TSM:'stalwart',   AVGO:'stalwart',
  // Slow Growers (배당주)
  T:'slow_grower', VZ:'slow_grower', MO:'slow_grower', PM:'slow_grower',
  // Cyclicals
  XOM:'cyclical', CVX:'cyclical', COP:'cyclical',
  F:'cyclical',   GM:'cyclical',  BA:'cyclical',
  CAT:'cyclical', DE:'cyclical',  FCX:'cyclical',
  // Turnarounds
  INTC:'turnaround', SNAP:'turnaround',
  // Asset Plays
  AMT:'asset_play', PLD:'asset_play', SPG:'asset_play',
}

const KR_KNOWN: Record<string, LynchKey> = {
  // 대형 우량주
  '005930':'stalwart',    // 삼성전자
  '051910':'stalwart',    // LG화학
  '006400':'stalwart',    // 삼성SDI
  '005380':'stalwart',    // 현대차
  '055550':'stalwart',    // 신한지주
  '105560':'stalwart',    // KB금융
  '012330':'stalwart',    // 현대모비스
  '028260':'stalwart',    // 삼성물산
  '034730':'stalwart',    // SK
  // 경기 순환주
  '000660':'cyclical',    // SK하이닉스
  '000270':'cyclical',    // 기아
  '010140':'cyclical',    // 삼성중공업 (조선 = 경기순환)
  '034020':'cyclical',    // 두산에너빌리티 (발전설비 = 경기순환)
  '000150':'cyclical',    // 두산 (중공업 지주 = 경기순환)
  '010120':'cyclical',    // LS ELECTRIC (전력기기 = 경기순환)
  // 빠른 성장주
  '035420':'fast_grower', // NAVER
  '207940':'fast_grower', // 삼성바이오로직스
  '068270':'fast_grower', // 셀트리온
  '012450':'fast_grower', // 한화에어로스페이스 (방산 고성장)
  '007660':'fast_grower', // 이수페타시스 (PCB 고성장)
  '440110':'fast_grower', // 파두 (AI칩 팹리스)
  '278470':'fast_grower', // 에이피알 (K뷰티 고성장)
  // 회생 기업주
  '035720':'turnaround',  // 카카오
  // 자산 보유주
  '017960':'asset_play',  // 한국카본 (특수소재)
  // 완만한 성장주
  '010170':'slow_grower', // 대한광통신 (통신인프라 안정성장)
  '077360':'fast_grower', // 덕산하이메탈 (반도체소재 성장)
  '189300':'fast_grower', // 인텔리안테크 (위성안테나 성장)
}

// 알려진 ETF 티커 (KRW 기준 + US)
const KNOWN_ETF = new Set([
  '360750','133690','102110','449450','229200','069500',  // 국내 ETF 코드
  'SPY','QQQ','IWM','DIA','VTI','VOO','ARKK','SOXL',     // 미국 ETF
  'GLD','SLV','USO',
])

// ─── 분류 알고리즘 ─────────────────────────────────────────────────────────────
const CYCLICAL_SECTORS = ['Energy','Basic Materials','Materials','Industrials','Consumer Cyclical']

function classify(p: {
  pe: number|null; peg: number|null
  earningsGrowth: number|null; dividendYield: number|null
  marketCap: number|null; sector: string|null
}): { category: LynchKey; confidence: 'high'|'low' } {

  const { pe, peg, earningsGrowth: eg, dividendYield: dy, marketCap: mc, sector } = p
  const isLargeCap = (mc ?? 0) > 10_000_000_000

  if (sector === 'Real Estate')                              return { category:'asset_play', confidence:'high' }
  if ((pe !== null && pe < 0) || (eg !== null && eg < -0.1)) return { category:'turnaround',  confidence:'high' }
  if (sector && CYCLICAL_SECTORS.some(s => sector.includes(s))) return { category:'cyclical', confidence:'high' }
  if (eg !== null && eg >= 0.20)                             return { category:'fast_grower', confidence:'high' }
  if (eg !== null && eg >= 0.10 && isLargeCap)               return { category:'stalwart',   confidence:'high' }
  if (dy !== null && dy > 0.015 && (eg === null || eg < 0.1)) return { category:'slow_grower',confidence:'high' }

  if (peg !== null) {
    if (peg < 0)                        return { category:'turnaround',  confidence:'low' }
    if (peg < 1)                        return { category:'fast_grower', confidence:'low' }
    if (peg <= 2 && isLargeCap)         return { category:'stalwart',    confidence:'low' }
  }

  // 기본값: 대형주 → stalwart, 소형주 → fast_grower
  return { category: isLargeCap ? 'stalwart' : 'fast_grower', confidence:'low' }
}

// ─── fetch with 5초 타임아웃 ───────────────────────────────────────────────────
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 5000) {
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(tid)
    return res
  } catch (e) {
    clearTimeout(tid)
    throw e
  }
}

// ─── US (Yahoo Finance) ────────────────────────────────────────────────────────
const YF_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}

async function classifyUS(ticker: string): Promise<ClassifyResult> {
  const t = ticker.toUpperCase()

  // 알려진 ETF 즉시 반환
  if (KNOWN_ETF.has(t)) return { category: 'na', isEtf: true, source: 'known-etf' }

  // 하드코딩 테이블 우선 확인
  if (US_KNOWN[t]) return { category: US_KNOWN[t], isEtf: false, source: 'hardcoded' }

  // v8 chart — ETF 판별
  let isEtf = false
  for (const host of ['query1','query2'] as const) {
    try {
      const res = await fetchWithTimeout(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1d&interval=1d`,
        { headers: YF_H, next: { revalidate: 3600 } as RequestInit['next'] }
      )
      if (!res.ok) continue
      const meta = (await res.json())?.chart?.result?.[0]?.meta
      if (meta) {
        const longName: string = meta.longName ?? meta.shortName ?? ''
        isEtf = (meta.instrumentType ?? '').toUpperCase() === 'ETF'
             || ETF_NAME_RE.test(longName)
             || /ETF|Fund(?!amental)|Index Fund/i.test(longName)
        break
      }
    } catch { /* timeout → next host */ }
  }

  if (isEtf) return { category: 'na', isEtf: true, source: 'yf-v8-etf' }

  // v10 quoteSummary — 재무 데이터 (401 빈번하므로 best-effort)
  let pe:             number|null = null
  let peg:            number|null = null
  let earningsGrowth: number|null = null
  let dividendYield:  number|null = null
  let marketCap:      number|null = null
  let sector:         string|null = null
  let source = 'yf-default'

  const modules = 'financialData,defaultKeyStatistics,summaryDetail,summaryProfile'
  for (const host of ['query2','query1'] as const) {
    try {
      const res = await fetchWithTimeout(
        `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=${modules}`,
        { headers: YF_H, next: { revalidate: 3600 } as RequestInit['next'] }
      )
      if (!res.ok) continue
      const r = (await res.json())?.quoteSummary?.result?.[0]
      if (!r) continue
      const raw = (o: Record<string, { raw?: number }>, k: string): number|null => o[k]?.raw ?? null
      const fin = r.financialData ?? {}; const stats = r.defaultKeyStatistics ?? {}
      const det = r.summaryDetail  ?? {}; const prof = r.summaryProfile       ?? {}
      earningsGrowth = raw(fin, 'earningsGrowth') ?? raw(fin, 'revenueGrowth')
      dividendYield  = raw(det, 'dividendYield')  ?? raw(det, 'trailingAnnualDividendYield')
      marketCap      = raw(det, 'marketCap')
      peg            = raw(stats,'pegRatio')
      pe             = raw(det, 'trailingPE') ?? raw(det, 'forwardPE')
      sector         = (prof.sector as string|null) ?? null
      source         = `yf-v10-${host}`
      break
    } catch { /* timeout → next host */ }
  }

  const { category, confidence } = classify({ pe, peg, earningsGrowth, dividendYield, marketCap, sector })
  return { category, isEtf: false, source: `${source}(${confidence})` }
}

// ─── KR (Naver) ────────────────────────────────────────────────────────────────
const NAVER_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Referer: 'https://finance.naver.com/',
}

const KR_INDUSTRY: [RegExp, string][] = [
  [/부동산/,'Real Estate'],      [/석유|정제|코크스/,'Energy'],
  [/화학|도료|비료/,'Basic Materials'], [/철강|금속|1차금속/,'Basic Materials'],
  [/건설|토목/,'Industrials'],   [/조선|항공|방위/,'Industrials'],
  [/운수|창고|물류/,'Industrials'],[/음식료|식품|담배/,'Consumer Defensive'],
  [/의류|섬유/,'Consumer Cyclical'],[/통신/,'Communication Services'],
  [/전기.가스|전력/,'Utilities'], [/금융|은행|보험|증권/,'Financial Services'],
  [/의약품|바이오|제약/,'Healthcare'],[/소프트웨어|IT서비스/,'Technology'],
  [/전자부품|반도체/,'Technology'],[/게임|엔터|방송/,'Communication Services'],
]

async function classifyKR(ticker: string): Promise<ClassifyResult> {
  const code = ticker.replace(/\.(KS|KQ)$/i, '')

  // 알려진 ETF 코드 즉시 반환
  if (KNOWN_ETF.has(code)) return { category: null, isEtf: true, source: 'known-etf' }

  // 하드코딩 테이블 우선 확인
  if (KR_KNOWN[code]) return { category: KR_KNOWN[code], isEtf: false, source: 'hardcoded' }

  try {
    const res = await fetchWithTimeout(
      `https://m.stock.naver.com/api/stock/${code}/basic`,
      { headers: NAVER_H, next: { revalidate: 3600 } as RequestInit['next'] }
    )
    if (!res.ok) throw new Error(`naver ${res.status}`)
    const d = await res.json()
    if (!d) throw new Error('naver empty')

    // ── ETF 판별: stockEndType='etf' 또는 ETF 브랜드명 ──────────────────
    // (industryCodeType은 일반 주식도 null이므로 ETF 판별에 사용 불가!)
    const stockName: string = d.stockName ?? ''
    const stockEndType: string = d.stockEndType ?? ''
    if (stockEndType === 'etf' || ETF_NAME_RE.test(stockName))
      return { category: 'na', isEtf: true, source: 'naver-etf' }

    // ── 업종(sector) 추출: industryCodeType.name 또는 종목명 패턴 매칭 ──
    const industryName: string|null = d.industryCodeType?.name ?? null
    let sector: string|null = industryName
      ? (KR_INDUSTRY.find(([re]) => re.test(industryName))?.[1] ?? null)
      : null

    // industryCodeType 없는 경우: 종목명·업종으로 추가 추론
    if (!sector) {
      if (/조선|중공업/.test(stockName))   sector = 'Industrials'
      else if (/항공|방위|에어로/.test(stockName)) sector = 'Industrials'
      else if (/반도체|하이닉스|메모리/.test(stockName)) sector = 'Technology'
      else if (/바이오|제약|의약/.test(stockName)) sector = 'Healthcare'
      else if (/에너지|전력|원자력/.test(stockName)) sector = 'Utilities'
      else if (/통신|광통신/.test(stockName)) sector = 'Communication Services'
      else if (/카본|소재|화학/.test(stockName)) sector = 'Basic Materials'
      else if (/금융|은행|보험/.test(stockName)) sector = 'Financial Services'
      // KR_KNOWN 테이블에서 fallback
      if (!sector && KR_KNOWN[code]) {
        return { category: KR_KNOWN[code], isEtf: false, source: 'kr-known-table' }
      }
    }

    const per = typeof d.per === 'number' ? d.per : null
    const eps = typeof d.eps === 'number' ? d.eps : null
    const dy  = typeof d.dividendYield === 'number' ? d.dividendYield / 100 : null
    // marketValue가 없을 경우 closePrice × 상장주식수로 추정 불가 → null 허용
    const mc  = typeof d.marketValue   === 'number' ? d.marketValue
              : typeof d.marketValueFullRaw === 'number' ? d.marketValueFullRaw
              : null

    // EPS 음수면 turnaround 후보
    const earningsGrowth = eps !== null && eps < 0 ? -0.5 : null

    const { category, confidence } = classify({ pe:per, peg:null, earningsGrowth, dividendYield:dy, marketCap:mc, sector })
    return { category, isEtf: false, source: `naver(${confidence})` }
  } catch {
    // Naver 실패 → 기본값 반환
    return { category: 'stalwart', isEtf: false, source: 'naver-fallback' }
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ticker = searchParams.get('ticker')?.trim()
  const market = (searchParams.get('market')?.toUpperCase() ?? 'US') as 'US'|'KR'|'CRYPTO'

  if (!ticker)
    return NextResponse.json({ error: '티커를 입력해주세요.' }, { status: 400 })

  if (market === 'CRYPTO')
    return NextResponse.json({ category: 'na', isEtf: false, source: 'crypto' } satisfies ClassifyResult)

  const result = market === 'KR' ? await classifyKR(ticker) : await classifyUS(ticker)
  console.log(`[Lynch] ${market}:${ticker} →`, result.category ?? '(ETF/null)', `(${result.source})`)

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
