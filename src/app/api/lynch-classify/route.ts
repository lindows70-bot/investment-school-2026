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
  // 적자 매출 고성장 신생기업 (AI·양자·바이오) → 빠른성장주
  TEM:'fast_grower', IONQ:'fast_grower', RGTI:'fast_grower', QBTS:'fast_grower',
  RXRX:'fast_grower', SOUN:'fast_grower', RKLB:'fast_grower',
  // Fast Growers (추가)
  VRT:'fast_grower', ANET:'fast_grower', NOW:'fast_grower', PANW:'fast_grower',
  // Stalwarts
  AAPL:'stalwart', MSFT:'stalwart', GOOGL:'stalwart', GOOG:'stalwart',
  JPM:'stalwart',  V:'stalwart',    MA:'stalwart',    JNJ:'stalwart',
  UNH:'stalwart',  PG:'stalwart',   KO:'stalwart',    WMT:'stalwart',
  HD:'stalwart',   COST:'stalwart', ABBV:'stalwart',  LLY:'stalwart',
  NVO:'stalwart',  ASML:'stalwart', TSM:'stalwart',   AVGO:'stalwart',
  ORCL:'stalwart', CRM:'stalwart',  ADBE:'stalwart',  ACN:'stalwart',
  // Slow Growers (통신·유틸리티·고배당)
  T:'slow_grower', VZ:'slow_grower', MO:'slow_grower', PM:'slow_grower',
  TMUS:'slow_grower', NEE:'slow_grower', DUK:'slow_grower', SO:'slow_grower',
  // Cyclicals (반도체·철강·자동차 추가)
  MU:'cyclical', NUE:'cyclical', X:'cyclical',
  // Cyclicals (에너지·반도체·소재·산업재)
  XOM:'cyclical', CVX:'cyclical', COP:'cyclical', OXY:'cyclical',
  SLB:'cyclical', HAL:'cyclical',
  F:'cyclical',   GM:'cyclical',  BA:'cyclical',
  CAT:'cyclical', DE:'cyclical',  FCX:'cyclical',
  TXN:'cyclical', COHR:'cyclical', ON:'cyclical', QCOM:'cyclical',
  // Turnarounds (적자 회생)
  INTC:'turnaround', SNAP:'turnaround', PLUG:'turnaround', FCEL:'turnaround',
  // Asset Plays
  AMT:'asset_play', PLD:'asset_play', SPG:'asset_play',
}

const KR_KNOWN: Record<string, LynchKey> = {
  // 대형 우량주
  '055550':'stalwart',    // 신한지주
  '105560':'stalwart',    // KB금융
  '012330':'stalwart',    // 현대모비스
  '028260':'stalwart',    // 삼성물산
  '034730':'stalwart',    // SK
  '000810':'stalwart',    // ★ 삼성화재 (대형 보험 우량주)
  '032830':'stalwart',    // ★ 삼성생명 (대형 보험 우량주)
  '316140':'stalwart',    // ★ 우리금융지주
  // 저성장주 (통신·유틸리티·고배당)
  '017670':'slow_grower', // ★ SK텔레콤 (통신)
  '030200':'slow_grower', // ★ KT (통신)
  '032640':'slow_grower', // ★ LG유플러스 (통신)
  '015760':'slow_grower', // ★ 한국전력 (유틸리티)
  '036460':'slow_grower', // ★ 한국가스공사 (유틸리티)
  // 경기 순환주 (반도체·철강·화학·가전·자동차·조선)
  '005930':'cyclical',    // ★ 삼성전자 (반도체 = 메모리 사이클, 시총 무관 경기순환)
  '000660':'cyclical',    // SK하이닉스 (반도체)
  '066570':'cyclical',    // ★ LG전자 (가전 = 경기민감)
  '005380':'cyclical',    // ★ 현대차 (자동차 = 경기민감)
  '005385':'cyclical',    // ★ 현대차2우B (우선주도 동일)
  '005387':'cyclical',    // ★ 현대차3우B
  '000270':'cyclical',    // 기아 (자동차)
  '042660':'cyclical',    // 한화오션 (조선)
  '042700':'cyclical',    // 한미반도체 (반도체장비 = 경기민감)
  '005490':'cyclical',    // ★ POSCO홀딩스 (철강)
  '051910':'cyclical',    // ★ LG화학 (화학 = 경기민감)
  '011170':'cyclical',    // ★ 롯데케미칼 (화학)
  '006400':'cyclical',    // ★ 삼성SDI (배터리 = 경기민감)
  '009150':'cyclical',    // ★ 삼성전기 (전자부품)
  '010140':'cyclical',    // 삼성중공업 (조선)
  '034020':'cyclical',    // 두산에너빌리티 (발전설비)
  '000150':'cyclical',    // 두산 (중공업 지주)
  '010120':'cyclical',    // LS ELECTRIC (전력기기)
  // 빠른 성장주
  '035420':'fast_grower', // NAVER
  '207940':'fast_grower', // 삼성바이오로직스
  '068270':'fast_grower', // 셀트리온
  '012450':'fast_grower', // 한화에어로스페이스 (방산 고성장)
  '278470':'fast_grower', // 에이피알 (K뷰티 고성장)
  '440110':'fast_grower', // 파두 (AI칩 팹리스 신생 — 적자 매출고성장)
  // 회생 기업주
  '035720':'turnaround',  // 카카오
  // 자산 보유주
  '017960':'asset_play',  // 한국카본 (특수소재)
  // 저성장주
  '010170':'slow_grower', // 대한광통신 (통신인프라 안정성장)
  '189300':'fast_grower', // 인텔리안테크 (위성안테나 성장)
  // 반도체 밸류체인 (소재·기판·장비) → 메모리 사이클 영향 = 경기순환주
  '007660':'cyclical',    // ★ 이수페타시스 (반도체 PCB 기판)
  '077360':'cyclical',    // ★ 덕산하이메탈 (반도체 소재)
}

// 알려진 ETF 티커 (KRW 기준 + US)
const KNOWN_ETF = new Set([
  '360750','133690','102110','449450','229200','069500',  // 국내 ETF 코드
  'SPY','QQQ','IWM','DIA','VTI','VOO','ARKK','SOXL',     // 미국 ETF
  'GLD','SLV','USO',
])

// ─── 분류 알고리즘 (정밀화: 섹터 우선 + 기본값 stalwart) ────────────────────────
//
// 피터 린치 6대 분류 기준:
//  - slow_grower : 통신·유틸리티 (안정 배당, 저성장) — SK텔레콤, 한국전력
//  - cyclical    : 반도체·철강·화학·가전·자동차·조선·에너지 (이익 변동 큼) — LG전자, SK하이닉스
//  - stalwart    : 거대 시총 + 견고한 성장(10~15%) — 삼성화재, 오라클
//  - fast_grower : EPS/매출 20%+ 고성장 테크·바이오 — 엔비디아, 버티브
//  - turnaround  : 적자(PE<0, eg<-10%)
//  - asset_play  : 부동산·리츠

// 경기민감(사이클) 섹터 — 이익 변동성이 큰 업종
const CYCLICAL_SECTORS = [
  'Energy', 'Basic Materials', 'Materials', 'Industrials', 'Consumer Cyclical',
  'Semiconductors', 'Consumer Durables', 'Steel', 'Chemical', 'Auto',
]
// 저성장(안정 배당) 섹터 — 통신·유틸리티
const SLOW_SECTORS = ['Telecommunications', 'Telecom', 'Utilities', 'Utility']

function classify(p: {
  pe: number|null; peg: number|null
  earningsGrowth: number|null; dividendYield: number|null
  marketCap: number|null; sector: string|null
}): { category: LynchKey; confidence: 'high'|'low' } {

  const { pe, peg, earningsGrowth: eg, dividendYield: dy, marketCap: mc, sector } = p
  const isLargeCap = (mc ?? 0) > 5_000_000_000   // 5B (KR 대형주 포함하도록 완화)

  // ① 부동산·리츠 → 자산주
  if (sector === 'Real Estate' || (sector ?? '').includes('REIT'))
    return { category:'asset_play', confidence:'high' }

  // ② 명확한 적자(PER 음수 또는 이익 -10% 이하) → 회생주
  if ((pe !== null && pe < 0) || (eg !== null && eg < -0.1))
    return { category:'turnaround', confidence:'high' }

  // ③ 저성장주: 통신·유틸리티 섹터 (안정적 배당, 저성장)
  if (sector && SLOW_SECTORS.some(s => sector.includes(s)))
    return { category:'slow_grower', confidence:'high' }

  // ④ 경기민감주: 사이클 섹터
  if (sector && CYCLICAL_SECTORS.some(s => sector.includes(s))) {
    // ★ 반도체·조선/기자재는 시총·성장률 무관 무조건 경기순환주
    //   (메모리 슈퍼사이클·조선 발주 사이클 특성 — 삼성전자·SK하이닉스 포함)
    const isHardCyclical = /Semicon|반도체|조선|중공업|기자재/.test(sector)
    if (isHardCyclical) return { category:'cyclical', confidence:'high' }
    // 그 외 사이클 섹터: 초고성장(25%+)이면 빠른성장주
    if (eg !== null && eg >= 0.25) return { category:'fast_grower', confidence:'high' }
    return { category:'cyclical', confidence:'high' }
  }

  // ⑤ 빠른 성장주: EPS/매출 성장률 20%+ (테크·바이오·소프트웨어)
  if (eg !== null && eg >= 0.20)
    return { category:'fast_grower', confidence:'high' }

  // ⑥ 대형우량주: 큰 시총 (이익 5~20% 또는 데이터 없는 대형주)
  if (isLargeCap) {
    // 고배당 + 저성장이면 저성장주로
    if (dy !== null && dy > 0.03 && (eg === null || eg < 0.05))
      return { category:'slow_grower', confidence:'low' }
    return { category:'stalwart', confidence: eg !== null ? 'high' : 'low' }
  }

  // ⑦ 중소형 고배당 → 저성장주
  if (dy !== null && dy > 0.03 && (eg === null || eg < 0.05))
    return { category:'slow_grower', confidence:'low' }

  // ⑧ PEG 폴백
  if (peg !== null) {
    if (peg < 0)                return { category:'turnaround',  confidence:'low' }
    if (peg < 0.8)              return { category:'fast_grower', confidence:'low' }
    if (peg <= 2)               return { category: isLargeCap ? 'stalwart' : 'cyclical', confidence:'low' }
  }

  // ⑨ 기본값: stalwart (★ 과거 fast_grower 남발 버그 수정 — 데이터 부족 시 안전하게 우량주로)
  return { category: 'stalwart', confidence:'low' }
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
  [/부동산|리츠/,'Real Estate'],
  [/통신|텔레콤/,'Telecommunications'],         // ★ 통신 → 저성장주
  [/전기.가스|전력|원자력|발전|유틸|난방|수도/,'Utilities'], // ★ 유틸리티 → 저성장주
  [/반도체/,'Semiconductors'],                  // ★ 반도체 → 경기민감
  [/석유|정제|코크스/,'Energy'],
  [/화학|도료|비료/,'Chemical'],                // ★ 화학 → 경기민감
  [/철강|금속|1차금속/,'Steel'],                // ★ 철강 → 경기민감
  [/자동차|자동차부품/,'Auto'],                 // ★ 자동차 → 경기민감
  [/가전|디스플레이|전자제품/,'Consumer Durables'], // ★ 가전 → 경기민감
  [/조선|중공업/,'Industrials'],   [/건설|토목/,'Industrials'],
  [/항공|방위|방산/,'Industrials'],[/운수|창고|물류/,'Industrials'],
  [/기계|장비/,'Industrials'],
  [/음식료|식품|담배/,'Consumer Defensive'],
  [/의류|섬유/,'Consumer Cyclical'],
  [/금융|은행|보험|증권|화재|생명/,'Financial Services'],
  [/의약품|바이오|제약/,'Healthcare'],
  [/소프트웨어|IT서비스|인터넷/,'Technology'],
  [/전자부품/,'Consumer Durables'],
  [/게임|엔터|방송|미디어/,'Communication Services'],
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

    // industryCodeType 없는 경우: 종목명으로 추가 추론 (정밀화)
    if (!sector) {
      if (/텔레콤|유플러스|통신/.test(stockName))          sector = 'Telecommunications'  // 통신 → 저성장
      else if (/전력|한전|가스|발전|원자력|난방|수도/.test(stockName)) sector = 'Utilities'   // 유틸 → 저성장
      else if (/하이닉스|반도체|메모리/.test(stockName))     sector = 'Semiconductors'       // 반도체 → 경기민감
      else if (/전자|가전|디스플레이/.test(stockName))       sector = 'Consumer Durables'    // 가전 → 경기민감
      else if (/자동차|현대차|기아|모비스|타이어/.test(stockName)) sector = 'Auto'              // 자동차 → 경기민감
      else if (/포스코|철강|금속/.test(stockName))          sector = 'Steel'                // 철강 → 경기민감
      else if (/케미칼|화학/.test(stockName))               sector = 'Chemical'             // 화학 → 경기민감
      else if (/조선|중공업/.test(stockName))               sector = 'Industrials'
      else if (/항공|방위|에어로/.test(stockName))           sector = 'Industrials'
      else if (/바이오|제약|의약/.test(stockName))           sector = 'Healthcare'
      else if (/광통신/.test(stockName))                    sector = 'Telecommunications'
      else if (/카본|소재/.test(stockName))                 sector = 'Chemical'
      else if (/화재|생명|손해|보험/.test(stockName))        sector = 'Financial Services'   // 보험 → 우량주
      else if (/금융|은행|지주|증권/.test(stockName))        sector = 'Financial Services'
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
