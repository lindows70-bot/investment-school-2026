'use server'

/**
 * ⚔️ 피터 린치의 쇼핑몰 — Sector Peer X-Ray (킬러 기능 9단계)
 *
 * 린치: "업황이 좋아질 거라 확신하면, 그 업종에서 가장 싸고 탄탄한 1등을 사라."
 * 개별 종목에 매몰된 '우물 안 개구리' 시야를 깨고, 동종 경쟁사와 나란히 상대평가.
 *
 *  · 피어: Yahoo `recommendationsbysymbol` (무료)
 *  · 지표: PEG · 영업이익률 · 부채비율(부채/시총) (yahoo-finance2 quoteSummary)
 *
 * Lazy Caching: in-memory 6h · US 위주 (KR 피어는 데이터 빈약 → graceful)
 * PEG는 SSOT(canonicalFundamentals→stock-info)로 통일 — 동일 종목은 분석화면·브리핑과 같은 PEG.
 */

import { headers } from 'next/headers'
import { getCanonicalPeg } from '@/lib/canonicalFundamentals'

export interface PeerMetric {
  ticker:    string
  name:      string
  industry:  string | null    // 업종 (동일업종만 직접 비교)
  sameInd:   boolean          // 대상과 동일 업종인가
  peg:       number | null
  opMargin:  number | null    // 영업이익률 %
  debtRatio: number | null    // 부채/시총 %
  mcapUsd:   number | null    // USD 통일 시가총액 (체급 비교용 · 대략 환산)
  isTarget:  boolean
}

export interface SectorPeerResult {
  ticker:    string
  source:    'curated' | 'yahoo'   // curated=글로벌 GICS 맵 / yahoo=행동기반 폴백
  targetIndustry: string | null
  sameIndCount:   number       // 동일 업종 경쟁사 수
  peers:     PeerMetric[]      // 대상 종목 포함, 가성비순(PEG↑) 정렬
  bestValue: string | null     // 가장 싸고 탄탄한 종목 티커
  verdict:   'hold_best' | 'consider_rotate' | 'neutral' | 'early_stage'
  rivalTicker: string | null   // 대상보다 더 싸고 탄탄한 '동일업종' 경쟁사(있으면)
  lynchComment: string
  status:    'ok' | 'none' | 'unsupported' | 'error'
  message?:  string
  asOf:      string
}

const CACHE = new Map<string, { data: SectorPeerResult; expiresAt: number }>()
const CACHE_TTL = 6 * 3600_000
const num = (v: unknown) => typeof v === 'number' && isFinite(v) ? v : null
// 체급(시총) 비교용 대략 환율 — 비율 지표는 환율 무관이지만 '시총 체급'만 USD로 통일해 글로벌 1등과 비교
const USDKRW_APPROX = 1380

// ── 글로벌 GICS 동종업계 피어 맵 (Yahoo industry 문자열 → 대표 글로벌 종목 US+KR) ──
// 비율 지표(PEG·영업이익률·부채/시총)는 통화 무관 → 환율 변환 없이 KR↔US 직접 비교
const CURATED: Record<string, string[]> = {
  'Semiconductors':               ['NVDA', 'AMD', 'TSM', 'MU', 'INTC', 'AVGO', 'QCOM', 'TXN', '000660.KS'],
  'Consumer Electronics':         ['AAPL', '005930.KS', 'SONY'],
  'Auto Manufacturers':           ['TSLA', 'TM', 'F', 'GM', 'HMC', 'RIVN', '005380.KS', '000270.KS'],
  'Software - Infrastructure':    ['MSFT', 'ORCL', 'PLTR', 'NOW', 'PANW', 'CRWD', 'DDOG', 'SNOW', 'NET'],
  'Software - Application':        ['CRM', 'ADBE', 'INTU', 'SAP', 'SHOP', 'TEAM'],
  'Internet Content & Information':['GOOG', 'META', 'BIDU', '035420.KS', '035720.KS'],
  'Internet Retail':              ['AMZN', 'BABA', 'PDD', 'MELI', 'CPNG'],
  'Banks - Diversified':          ['JPM', 'BAC', 'WFC', 'C', 'HSBC', '105560.KS', '055550.KS', '086790.KS'],
  'Aerospace & Defense':          ['LMT', 'RTX', 'BA', 'GD', 'NOC', '012450.KS', '047810.KS', '079550.KS'],
  'Drug Manufacturers - General': ['JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'NVS', 'AZN', '207940.KS'],
  'Biotechnology':                ['AMGN', 'GILD', 'VRTX', 'REGN', 'MRNA', 'BIIB'],
  'Beverages - Non-Alcoholic':    ['KO', 'PEP', 'MNST', 'KDP'],
  'Entertainment':                ['DIS', 'NFLX', 'WBD', 'PARA', 'SPOT'],
  'Credit Services':              ['V', 'MA', 'AXP', 'PYPL', 'SOFI'],
  'Steel':                        ['NUE', 'STLD', 'X', '005490.KS'],
  'Electronic Components':        ['APH', 'TEL', 'GLW', '009150.KS', '011070.KS'],
  'Oil & Gas E&P':                ['COP', 'OXY', 'EOG', 'DVN', 'FANG', 'HES', 'CTRA'],
  'Oil & Gas Integrated':         ['XOM', 'CVX', 'BP', 'SHEL', 'TTE', 'EQNR'],
  // 한국 중공업 전용 그룹 (Yahoo가 조선→Aerospace&Defense 등으로 오분류 → 티커 오버라이드)
  'KR-Shipbuilding':              ['010140.KS', '329180.KS', '042660.KS', '010620.KS', '009540.KS'],
  'KR-PowerEquip':                ['034020.KS', '267260.KS', '298040.KS', '010120.KS', '103590.KS'],
}

// ── 티커 단위 업종 오버라이드 — Yahoo 오분류 보정 (한국 조선·전력기기) ──────────
const TICKER_GROUP: Record<string, string> = {
  '010140': 'KR-Shipbuilding', '329180': 'KR-Shipbuilding', '042660': 'KR-Shipbuilding', '010620': 'KR-Shipbuilding', '009540': 'KR-Shipbuilding',  // 삼성중공업·HD현대중공업·한화오션·HD현대미포·HD한국조선해양
  '034020': 'KR-PowerEquip', '267260': 'KR-PowerEquip', '298040': 'KR-PowerEquip', '010120': 'KR-PowerEquip', '103590': 'KR-PowerEquip',           // 두산에너빌리티·HD현대일렉트릭·효성중공업·LS ELECTRIC·일진전기
}
const GROUP_LABEL: Record<string, string> = {
  'KR-Shipbuilding': '한국 조선·중공업',
  'KR-PowerEquip':   '한국 전력기기·중전기',
}

// ── Yahoo 피어 목록 ──────────────────────────────────────────────────────────
async function fetchPeers(symbol: string): Promise<string[]> {
  for (const host of ['query2', 'query1']) {
    try {
      const res = await fetch(`https://${host}.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await res.json()
      const list = j?.finance?.result?.[0]?.recommendedSymbols ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syms = list.map((x: any) => String(x.symbol)).filter(Boolean)
      if (syms.length) return syms.slice(0, 4)
    } catch { /* next host */ }
  }
  return []
}

// ── 종목별 비교지표 ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchMetric(yf: any, symbol: string, isTarget: boolean, base?: string): Promise<PeerMetric | null> {
  try {
    const s = await yf.quoteSummary(symbol, { modules: ['financialData', 'summaryDetail', 'defaultKeyStatistics', 'price', 'assetProfile'] })
    const fd = s?.financialData ?? {}, sd = s?.summaryDetail ?? {}, ks = s?.defaultKeyStatistics ?? {}, pr = s?.price ?? {}, ap = s?.assetProfile ?? {}
    // ⭐ PEG는 SSOT(stock-info, 분석화면과 동일)로 통일 — 동일 종목 전 화면 일치. 실패 시 Yahoo 폴백.
    let peg = await getCanonicalPeg(symbol, undefined, base)
    if (peg == null) {
      peg = num(ks.pegRatio)
      if (peg == null) {
        const pe = num(sd.trailingPE), g = num(fd.earningsGrowth)
        if (pe != null && g != null && g > 0) peg = +(pe / (g * 100)).toFixed(2)
      }
    }
    const opMargin  = num(fd.operatingMargins) != null ? +(fd.operatingMargins * 100).toFixed(1) : null
    const mc = num(sd.marketCap) ?? num(ks.enterpriseValue)
    const debtRatio = (num(fd.totalDebt) != null && mc) ? Math.round((fd.totalDebt / mc) * 100) : null
    // 체급 비교: 시총을 USD로 통일 (KRW면 대략 환산) — 글로벌 1등 대비 국내 기업 위치를 한눈에
    const currency = String(pr.currency || sd.currency || (/\.(KS|KQ)$/i.test(symbol) ? 'KRW' : 'USD')).toUpperCase()
    const mcapUsd = mc != null ? Math.round(currency === 'KRW' ? mc / USDKRW_APPROX : mc) : null
    const name = String(pr.shortName || pr.longName || symbol).replace(/\.(KS|KQ)$/i, '')
    const industry = ap.industry ? String(ap.industry) : null
    return { ticker: symbol.replace(/\.(KS|KQ)$/i, ''), name, industry, sameInd: false, peg, opMargin, debtRatio, mcapUsd, isTarget }
  } catch { return null }
}

export async function getSectorPeers(input: { ticker: string; name?: string; market: string }): Promise<SectorPeerResult> {
  const ticker = input.ticker.trim().toUpperCase()
  const market = input.market
  const asOf = new Date().toISOString()
  const empty = (status: SectorPeerResult['status'], message?: string): SectorPeerResult => ({
    ticker, source: 'curated', targetIndustry: null, sameIndCount: 0, peers: [], bestValue: null, verdict: 'neutral', rivalTicker: null, lynchComment: '', status, message, asOf,
  })

  // 개별 주식만 (백스톱)
  const { getAssetType } = await import('@/lib/assetClassifier')
  if (getAssetType(ticker, input.name ?? '', market) !== 'STOCK') return empty('unsupported', '개별 주식만 지원합니다.')

  const hit = CACHE.get(ticker)
  if (hit && Date.now() < hit.expiresAt) return hit.data

  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
    // PEG SSOT(stock-info) 호출용 base — 요청 호스트(서버액션)
    let base: string | undefined
    try { const h = headers(); const host = h.get('host'); if (host) base = `${h.get('x-forwarded-proto') ?? 'https'}://${host}` } catch { /* base 없으면 Yahoo 폴백 */ }
    // KR은 .KS(코스피)→.KQ(코스닥) 폴백 — 코스닥 종목이 .KS로만 시도하면 실패
    const codeK = ticker.replace(/\D/g, '')
    const symTries = market === 'KR' ? [`${codeK}.KS`, `${codeK}.KQ`] : [ticker]

    // ① 대상 먼저 조회 → 업종 파악
    let targetMetric: PeerMetric | null = null
    let yfSym = symTries[0]
    for (const sym of symTries) { const m = await fetchMetric(yf, sym, true, base); if (m) { targetMetric = m; yfSym = sym; if (m.industry) break } }
    if (!targetMetric) return empty('error', '종목 정보를 불러오지 못했습니다.')

    // ★ 티커 오버라이드(한국 조선·전력기기) 우선 → 없으면 Yahoo 업종
    const code6 = ticker.replace(/\D/g, '').slice(-6)
    const groupKey = (market === 'KR' && TICKER_GROUP[code6]) ? TICKER_GROUP[code6] : null
    let targetIndustry = groupKey ? GROUP_LABEL[groupKey] : targetMetric.industry

    // ② 피어 소스 결정: (오버라이드 그룹 ‖ 큐레이션 GICS 맵) 우선, 없으면 Yahoo 행동기반 폴백
    const curatedKey = groupKey ?? targetMetric.industry
    const curatedList = curatedKey && CURATED[curatedKey] ? CURATED[curatedKey] : null
    let source: 'curated' | 'yahoo' = 'curated'
    let peerSyms: string[]
    if (curatedList) {
      peerSyms = curatedList.filter(s =>
        s.toUpperCase() !== yfSym.toUpperCase() &&
        s.replace(/\.(KS|KQ)$/i, '').toUpperCase() !== ticker
      ).slice(0, 8)
    } else {
      source = 'yahoo'
      peerSyms = await fetchPeers(yfSym)
    }
    if (!peerSyms.length) return empty('none', market === 'KR' ? '국내 종목은 동종업계 비교 데이터가 제한적입니다.' : '동종업계(피어) 데이터를 찾지 못했습니다.')

    // ③ 피어 지표 동시 조회
    const peerMetrics = await Promise.all(peerSyms.map(p => fetchMetric(yf, p, false, base)))
    const peers = [targetMetric, ...peerMetrics].filter((m): m is PeerMetric => m != null && (m.peg != null || m.opMargin != null))
    const target = peers.find(p => p.isTarget)
    if (!target || peers.length < 2) return empty('none', '비교 가능한 경쟁사 데이터가 부족합니다.')

    // 오버라이드 그룹이면 표시 업종을 그룹 라벨로 통일 (Yahoo 오분류 가림)
    if (groupKey) { targetIndustry = GROUP_LABEL[groupKey]; for (const p of peers) p.industry = GROUP_LABEL[groupKey] }

    // 동일업종 판정: curated=큐레이션이 곧 동일업종(전부 true) / yahoo=Yahoo industry 일치만
    for (const p of peers) p.sameInd = p.isTarget ? true : (source === 'curated' ? true : (!!targetIndustry && p.industry === targetIndustry))
    const sameIndPeers = peers.filter(p => !p.isTarget && p.sameInd)
    const sameIndCount = sameIndPeers.length

    // 가성비순(PEG 오름차순, null은 뒤로) 정렬
    peers.sort((a, b) => {
      const pa = a.peg != null && a.peg > 0 ? a.peg : 999
      const pb = b.peg != null && b.peg > 0 ? b.peg : 999
      return pa - pb
    })

    // ★ '더 싸고 더 탄탄한' 경쟁사 — 반드시 동일 업종일 때만 (소프트웨어 vs 반도체 오판 방지)
    const rival = sameIndPeers.filter(p =>
      p.peg != null && p.peg > 0 && target.peg != null && target.peg > 0 && p.peg < target.peg
      && p.opMargin != null && target.opMargin != null && p.opMargin >= target.opMargin)
      .sort((a, b) => (a.peg ?? 999) - (b.peg ?? 999))[0] ?? null

    // 동일업종 중 PEG 최저
    const sameIndSorted = sameIndPeers.concat(target).filter(p => p.peg != null && p.peg > 0).sort((a, b) => (a.peg! - b.peg!))
    const bestValue = sameIndSorted[0]?.ticker ?? null

    // ★ 초기(이익 없는) 기업: PEG 없음 + 영업적자 → PEG·이익률 비교 무의미
    const earlyStage = (target.peg == null || target.peg <= 0) && (target.opMargin == null || target.opMargin < 0)
    const profitablePeers = sameIndPeers.filter(p => p.opMargin != null && p.opMargin > 0)

    const verdict: SectorPeerResult['verdict'] =
      earlyStage ? 'early_stage'
      : sameIndCount === 0 ? 'neutral'
      : rival ? 'consider_rotate'
      : (bestValue === target.ticker ? 'hold_best' : 'neutral')

    const lynchComment =
      earlyStage
        ? (profitablePeers.length > 0
            ? `${target.name}은 아직 영업이익을 못 내는 단계라 PEG·이익률로 비교하긴 일러. 그런데 같은 업종엔 이미 흑자를 내는 ${profitablePeers[0].name} 같은 기업이 있어 — 네 종목이 그 자리까지 갈 수 있는지가 핵심이야. 지금은 PEG가 아니라 매출 성장률·현금 런웨이(생존 기간)로 평가해.`
            : `${target.name}을 포함한 이 업종은 아직 다 같이 이익을 못 내는 초기 단계야. PEG·영업이익률 비교는 의미가 없어 — 매출 성장 속도·현금 런웨이·기술 진척으로 봐야 해. '될 놈'을 고르는 게임이라 변동성이 크다는 것도 명심해.`)
      : sameIndCount === 0
        ? `참고: Yahoo가 보여준 종목들은 ${target.name}과(와) 업종이 달라(예: ${peers.find(p => !p.isTarget && p.industry)?.industry ?? '타 업종'}) PEG·이익률 직접 비교는 의미가 약해. 같은 업종 경쟁사가 잡히지 않아 상대평가는 참고만 하고, 회사 자체의 실적을 봐.`
      : verdict === 'consider_rotate' && rival
        ? `네가 산 ${target.name}(PEG ${target.peg?.toFixed(2)})도 나쁘진 않아. 그런데 같은 업종 ${rival.name}은 PEG ${rival.peg?.toFixed(2)}로 더 싸면서 영업이익률(${rival.opMargin}%)까지 더 높아. 굳이 비싼 쪽을 고집할 이유가 있을까? 같은 업종이면 더 싸고 탄탄한 1등을 사는 게 린치식이야.`
      : verdict === 'hold_best'
        ? `좋은 선택이야! ${target.name}은 같은 업종 경쟁사 중 PEG가 가장 낮아(가장 저평가). 린치가 말한 "업종 내 가장 싸고 탄탄한 기업"에 가깝지. 영업이익률·부채도 1등인지 같이 확인해.`
        : `${target.name}은 같은 업종 경쟁사와 비교해 가성비가 평범한 편이야. 이 표에서 '더 싸면서 더 잘 버는' 동일업종 기업이 없는지 직접 비교해봐.`

    const result: SectorPeerResult = { ticker, source, targetIndustry, sameIndCount, peers, bestValue, verdict, rivalTicker: rival?.ticker ?? null, lynchComment, status: 'ok', asOf }
    CACHE.set(ticker, { data: result, expiresAt: Date.now() + CACHE_TTL })
    return result
  } catch (e) {
    console.warn('[sector-peers]', (e as Error).message)
    return empty('error', '동종업계 비교 데이터를 불러오지 못했습니다.')
  }
}
