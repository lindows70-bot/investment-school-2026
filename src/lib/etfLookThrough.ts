// 🔬 ETF Look-Through 분해 엔진 SSOT — 구성종목·섹터 비중을 GICS 영문으로 통일해 반환 (app_cache 7일)
// US=Yahoo topHoldings(종목+섹터) · KR=Naver etfAnalysis(국내형=종목+비중, 해외형=종목명만+섹터 완전)
// 가드레일: 기존 STOCK 엔진 무손상 — 분해는 이 별도 레이어에서만. 추정치 금지(비중 없으면 null로 정직 표기)

import { getCache, setCache } from '@/lib/appCache'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'

export interface EtfHolding {
  ticker: string | null    // 6자리/US심볼. 해외주식형 KR ETF는 null(코드 미제공)
  name: string
  weight: number | null    // ETF 내 비중 % (원시값 — 재정규화 안 함). 해외형 KR은 null
}
export interface EtfComposition {
  ticker: string
  name: string
  market: 'US' | 'KR'
  isEquityEtf: boolean             // 주식형 여부(채권/원자재 ETF는 false → 분해 제외)
  isLeveraged: boolean             // 레버리지·인버스(스왑 구조 → 구성종목이 실노출 왜곡, 분해 부적합)
  topHoldings: EtfHolding[]        // 상위 ~10 구성종목
  topWeightSum: number | null     // 상위 종목 비중 합(%) — 나머지는 '기타 분산'
  sectorWeights: { sector: string; weight: number }[]   // GICS 영문 통일(합 ~100)
  usWeight: number                 // 미국 자산 비중 %(KR=countryPortfolioList, US ETF=100) — 시장별 계절 채점용
  holdingsHaveWeights: boolean     // false=해외주식형 KR(섹터만 신뢰)
  weightSource: 'native' | 'twin' | null   // twin=해외형 KR이 표준지수 추종 → US 쌍둥이 ETF 구성 차용
  twinTicker: string | null        // 차용한 US ETF(SPY·QQQ·SOXX 등)
  source: 'yahoo' | 'naver'
  asOf: string
}

const TTL = 7 * 24 * 3600_000   // 구성종목은 천천히 변함 — 7일 캐시

// ── 섹터명 통일 맵(제2원칙) — 4계절 우대섹터(Energy·Basic Materials·…)와 정확히 일치해야 함 ──
const YAHOO_SECTOR: Record<string, string> = {
  technology: 'Technology', communication_services: 'Communication Services',
  consumer_cyclical: 'Consumer Cyclical', consumer_defensive: 'Consumer Defensive',
  financial_services: 'Financial Services', healthcare: 'Healthcare',
  industrials: 'Industrials', energy: 'Energy', basic_materials: 'Basic Materials',
  utilities: 'Utilities', realestate: 'Real Estate',
}
const NAVER_SECTOR: Record<string, string> = {
  IT: 'Technology', COMMUNICATION: 'Communication Services',
  CONSUMER_DISCRETIONARY: 'Consumer Cyclical', CONSUMER_STAPLES: 'Consumer Defensive',
  FINANCIALS: 'Financial Services', HEALTH_CARE: 'Healthcare',
  INDUSTRIALS: 'Industrials', ENERGY: 'Energy', MATERIALS: 'Basic Materials',
  UTILITIES: 'Utilities', REAL_ESTATE: 'Real Estate', UNCLASSIFIED: '기타',
}

// 레버리지·인버스 감지 — 스왑 기반이라 topHoldings가 실노출(2X·-1X)을 왜곡 → 분해 제외 대상
const LEV_NAME = /레버리지|인버스|곱버스|\b[23]X\b|Bull|Bear|Ultra(?:Pro)?\b|Daily\s/i
const LEV_TICKERS = new Set(['TSLL','TSLR','TSLG','TSLS','TSLQ','NVDL','NVDU','NVDX','NVDQ','NVDS','SOXL','SOXS','TQQQ','SQQQ','UPRO','SPXU','AGQ','ZSL','UCO','SCO','BOIL','KOLD','LABU','LABD','FNGU','FNGD','TNA','TZA'])
const isLev = (ticker: string, name: string) => LEV_TICKERS.has(ticker.toUpperCase()) || LEV_NAME.test(name)

// 해외형 KR ETF의 추종지수 → US 쌍둥이 ETF(구성비중 차용). 표준지수만(정확 매칭 — 레버리지·헤지·커버드콜 변형 제외)
const INDEX_TWIN: [RegExp, string][] = [
  [/^S&P\s*500$/i, 'SPY'],
  [/^NASDAQ\s*100$/i, 'QQQ'],
  [/필라델피아\s*반도체|PHLX\s*Semiconductor/i, 'SOXX'],
  [/^Dow\s*Jones|^다우존스/i, 'DIA'],
  [/^Russell\s*2000|^러셀\s*2000/i, 'IWM'],
]
const twinOf = (baseIndex: string): string | null => {
  const idx = baseIndex.trim()
  for (const [re, t] of INDEX_TWIN) if (re.test(idx)) return t
  return null
}

const NAVER_UA = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  Referer: 'https://m.stock.naver.com',
}
const num = (v: unknown): number | null => { const n = parseFloat(String(v ?? '').replace(/[,%\s]/g, '')); return isFinite(n) ? n : null }

// ── US: Yahoo topHoldings ──────────────────────────────────────────────────────
async function fetchUs(ticker: string): Promise<EtfComposition | null> {
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const q = await yf.quoteSummary(ticker, { modules: ['topHoldings', 'price'] })
    const th = q?.topHoldings
    if (!th) return null
    const holdings: EtfHolding[] = (th.holdings ?? []).map((h: { symbol?: string; holdingName?: string; holdingPercent?: number }) => ({
      ticker: h.symbol ?? null, name: h.holdingName ?? h.symbol ?? '—',
      weight: typeof h.holdingPercent === 'number' ? Math.round(h.holdingPercent * 1000) / 10 : null,
    }))
    // sectorWeightings: [{realestate: 0.02}, {technology: 0.55}, ...] 단일키 객체 배열
    const sectorWeights: { sector: string; weight: number }[] = []
    for (const sw of (th.sectorWeightings ?? []) as Record<string, number>[]) {
      const k = Object.keys(sw)[0]
      if (k && typeof sw[k] === 'number' && sw[k] > 0)
        sectorWeights.push({ sector: YAHOO_SECTOR[k] ?? k, weight: Math.round(sw[k] * 1000) / 10 })
    }
    const weights = holdings.map(h => h.weight).filter((w): w is number => w != null)
    const name = String(q?.price?.longName ?? q?.price?.shortName ?? ticker)
    return {
      ticker, name, market: 'US',
      isEquityEtf: holdings.length > 0,   // 주식 구성종목이 있으면 주식형(채권 ETF는 holdings 빈 경우 多)
      isLeveraged: isLev(ticker, name),
      topHoldings: holdings, topWeightSum: weights.length ? Math.round(weights.reduce((s, w) => s + w, 0) * 10) / 10 : null,
      sectorWeights: sectorWeights.sort((a, b) => b.weight - a.weight),
      usWeight: 100,   // US 상장 ETF는 미국 자산 가정(시장별 계절 채점용)
      holdingsHaveWeights: weights.length > 0, weightSource: weights.length > 0 ? 'native' as const : null, twinTicker: null,
      source: 'yahoo', asOf: new Date().toISOString(),
    }
  } catch { return null }
}

// ── KR: Naver etfAnalysis ─────────────────────────────────────────────────────
async function fetchKr(code6: string): Promise<EtfComposition | null> {
  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code6}/etfAnalysis`, { headers: NAVER_UA, signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return null
    const j = await r.json()
    const top = (j.etfTop10MajorConstituentAssets ?? []) as { itemCode?: string; itemName?: string; etfWeight?: string }[]
    const holdings: EtfHolding[] = top.map(h => ({
      ticker: h.itemCode && /^\d{6}$/.test(h.itemCode) ? h.itemCode : null,
      name: h.itemName ?? '—',
      weight: num(h.etfWeight),   // 해외주식형은 "-" → null(추정 금지)
    }))
    const sectorWeights = ((j.sectorPortfolioList ?? []) as { detailTypeCode?: string; weight?: number }[])
      .filter(s => typeof s.weight === 'number' && s.weight > 0)
      .map(s => ({ sector: NAVER_SECTOR[s.detailTypeCode ?? ''] ?? (s.detailTypeCode ?? '기타'), weight: s.weight as number }))
      .sort((a, b) => b.weight - a.weight)
    const equity = ((j.assetPortfolioList ?? []) as { detailTypeCode?: string; weight?: number }[])
      .find(a => a.detailTypeCode === 'EQUITY')?.weight ?? 0
    const usWeight = ((j.countryPortfolioList ?? []) as { detailTypeCode?: string; weight?: number }[])
      .find(c => c.detailTypeCode === 'US')?.weight ?? 0
    let weights = holdings.map(h => h.weight).filter((w): w is number => w != null)
    const name = String(j.itemName ?? code6)
    let finalHoldings = holdings, weightSource: 'native' | 'twin' | null = weights.length > 0 ? 'native' : null
    let twinTicker: string | null = null
    // 해외형(비중 미제공)이 표준지수 추종이면 → US 쌍둥이 ETF 구성비중 차용(추정 아닌 동일지수 실측값)
    if (weights.length === 0 && !isLev(code6, name)) {
      const twin = twinOf(String(j.etfBaseIndex ?? ''))
      if (twin) {
        const tc = await fetchUs(twin)
        if (tc?.holdingsHaveWeights) {
          finalHoldings = tc.topHoldings
          weights = finalHoldings.map(h => h.weight).filter((w): w is number => w != null)
          weightSource = 'twin'; twinTicker = twin
        }
      }
    }
    return {
      ticker: code6, name, market: 'KR',
      isEquityEtf: equity >= 60,   // 주식 비중 60%↑ = 주식형(채권·원자재·혼합형 제외)
      isLeveraged: isLev(code6, name),
      topHoldings: finalHoldings, topWeightSum: weights.length ? Math.round(weights.reduce((s, w) => s + w, 0) * 10) / 10 : null,
      sectorWeights, usWeight, holdingsHaveWeights: weights.length > 0, weightSource, twinTicker,
      source: 'naver', asOf: new Date().toISOString(),
    }
  } catch { return null }
}

/** ETF 구성 분해(SSOT). 종목별 app_cache 7일 — 모든 기능이 같은 캐시 공유 */
export async function getEtfComposition(ticker: string, market?: string): Promise<EtfComposition | null> {
  const t = ticker.trim().toUpperCase().replace(/\.(KS|KQ)$/i, '')
  // ⚠️ KR 코드는 숫자 6자리뿐 아니라 신형 영숫자 코드(0131V0 등)도 존재 — \D 제거 금지(코드 파괴)
  const isKrCode = /^\d[0-9A-Z]{5}$/.test(t) && /\d{2}/.test(t)   // 숫자로 시작하는 6자 영숫자
  const isKr = (market ?? '').toUpperCase() === 'KR' || isKrCode
  const code = t   // 영숫자 코드 그대로 사용(네이버 API가 0131V0 형식 직접 수용 — 실측 확인)
  const mkt: 'US' | 'KR' = isKr ? 'KR' : 'US'
  const cacheKey = `etf-comp-v4:${code}:${mkt}`   // v4: 쌍둥이 지수 차용(weightSource·twinTicker)
  const cached = await getCache<EtfComposition>(cacheKey, TTL)
  if (cached) return cached
  const result = mkt === 'KR' ? await fetchKr(code) : await fetchUs(code)
  if (result && (result.topHoldings.length > 0 || result.sectorWeights.length > 0)) await setCache(cacheKey, result)
  return result
}

/** 💎 합산 PEG(SSOT) — 이미 fetch한 composition에서 상위 구성종목 canonical PEG(SSOT) 가중평균.
 *  커버리지(합산 포함 비중 / 상위 비중 합)가 40%↑일 때만 반환(반쪽 평균 과신 방지).
 *  ⚠️ portfolio-xray Phase 4와 동일 로직 — 이 함수를 단일 출처로 공유(제2원칙: 같은 ETF=같은 합산 PEG). */
export async function blendedPegFromComposition(c: EtfComposition, base?: string): Promise<{ peg: number; coverage: number } | null> {
  if (!c.holdingsHaveWeights || c.topWeightSum == null) return null
  const withTicker = c.topHoldings.filter(t => t.ticker && t.weight != null)
  const cfs = await Promise.all(withTicker.map(t =>
    getCanonicalFundamentals(t.ticker!, /^\d{6}$/.test(t.ticker!) ? 'KR' : 'US', base).catch(() => null)))
  let pegW = 0, wSum = 0
  withTicker.forEach((t, k) => {
    const peg = cfs[k]?.peg
    if (peg != null && peg > 0 && peg <= 10) { pegW += peg * t.weight!; wSum += t.weight! }   // 음수·극단값 제외
  })
  const covPct = Math.round(wSum / c.topWeightSum * 1000) / 10
  if (wSum > 0 && covPct >= 40) return { peg: Math.round(pegW / wSum * 100) / 100, coverage: covPct }
  return null
}

/** 💎 합산 PEG — 티커로 composition을 fetch한 뒤 계산(단독 호출용, 예: ETF 분산 대안). */
export async function getBlendedPeg(ticker: string, market?: string, base?: string): Promise<{ peg: number; coverage: number } | null> {
  const c = await getEtfComposition(ticker, market)
  if (!c) return null
  return blendedPegFromComposition(c, base)
}
