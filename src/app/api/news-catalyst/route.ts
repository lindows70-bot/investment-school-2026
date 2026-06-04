// 포트폴리오 뉴스 촉매 레이더 API — ticker별 뉴스 수집·Gemini 분석·캐시 서빙
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { getAssetType } from '@/lib/assetClassifier'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type CatalystStatus = 'HOLD_STRONG' | 'OBSERVE' | 'RE_EVALUATE'
export type RiskLevel      = 'LOW' | 'MEDIUM' | 'HIGH'
// 밸류에이션 축(가격) — PEG에서 코드가 결정론적으로 산출(Jarvis 매도 기준 PEG>2.2와 일치)
// LOSS = 적자기업(PEG 무의미) — 영업이익률/ROE 폴백으로 별도 브레이크
export type ValuationTier  = 'CHEAP' | 'FAIR' | 'EXPENSIVE' | 'LOSS' | 'UNKNOWN'

export interface TickerCatalyst {
  ticker:         string
  name:           string
  market:         string
  catalystStatus: CatalystStatus  // 사업/뉴스 축 (thesis 깨는 사건이 있나)
  keyFact:        string          // 가장 중요한 팩트 1문장
  actionGuide:    string          // 피터 린치 행동 가이드 (가치×모멘텀 융합)
  riskLevel:      RiskLevel
  relevantMetric: string          // 연결되는 재무 지표 (예: "영업이익률")
  headlines:      string[]        // 분석에 사용한 헤드라인
  isNoise:        boolean         // 주가 시황성 기사 필터
  peg:            number | null   // PEG SSOT (canonicalFundamentals)
  valuationTier:  ValuationTier   // 가격 축 (고/적정/저평가)
  cachedAt:       string
  fromCache:      boolean
}

/**
 * 밸류에이션 등급 — 가격 축 결정론적 산출 (제2원칙: Jarvis 기준과 일치)
 *  ① 적자 우선 체크: 영업이익률 < -10% (또는 ROE<0 & FCF<0) → LOSS
 *     (CashRunwayTimer 교훈: ROE는 일회성 이익으로 거짓 양수 가능 → 영업이익률이 더 신뢰)
 *  ② PEG>2.2 EXPENSIVE(Jarvis SELL) / ≤1.0 CHEAP / 그 사이 FAIR
 *  ③ PEG 없고 적자 신호도 없음 → UNKNOWN
 */
function valuationOf(peg: number | null, opMargin: number | null, roe: number | null, fcf: number | null): ValuationTier {
  // ① 적자기업 — PEG가 양수여도 영업적자면 LOSS 우선(가격 매력은 함정)
  if (opMargin != null && opMargin < -0.10) return 'LOSS'
  if ((roe != null && roe < 0) && (fcf != null && fcf < 0)) return 'LOSS'
  // ② PEG 기반
  if (peg != null && isFinite(peg) && peg > 0) {
    if (peg > 2.2)  return 'EXPENSIVE'
    if (peg <= 1.0) return 'CHEAP'
    return 'FAIR'
  }
  // ③ PEG 없음 + 적자 신호도 약함
  if ((roe != null && roe < 0) || (opMargin != null && opMargin < 0)) return 'LOSS'
  return 'UNKNOWN'
}

export interface NewsCatalystResult {
  catalysts:   TickerCatalyst[]
  generatedAt: string
  reEvaluateCount: number
}

// ── 뉴스 수집 ─────────────────────────────────────────────────────────────────
const RSS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/** Yahoo Finance RSS — US 종목 (기존 getEarningsInsight 검증 패턴) */
async function fetchYahooRss(ticker: string): Promise<string[]> {
  try {
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`
    const r = await fetch(url, { headers: { 'User-Agent': RSS_UA }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const xml = await r.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 5).map(it => {
      const t = it.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] ?? it.match(/<title>(.*?)<\/title>/)?.[1] ?? ''
      return t.trim()
    }).filter(Boolean)
  } catch { return [] }
}

/** Google News RSS — KR 종목 (무료·무인증) */
async function fetchGoogleNewsRss(name: string): Promise<string[]> {
  try {
    const q = encodeURIComponent(`${name} 실적 주가`)
    const url = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`
    const r = await fetch(url, { headers: { 'User-Agent': RSS_UA }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const xml = await r.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 5).map(it => {
      const t = it.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] ?? it.match(/<title>(.*?)<\/title>/)?.[1] ?? ''
      return t.replace(/ - [^-]+$/, '').trim()  // 미디어명 제거
    }).filter(Boolean)
  } catch { return [] }
}

/** KR 종목도 Yahoo KS/KQ RSS 시도 */
async function fetchYahooKrRss(ticker: string): Promise<string[]> {
  const suffixes = [`${ticker}.KS`, `${ticker}.KQ`]
  for (const sym of suffixes) {
    const headlines = await fetchYahooRss(sym)
    if (headlines.length > 0) return headlines
  }
  return []
}

/** 네이버 증권 종목별 뉴스 — KR 종목 (종목코드 직결, 가장 종목 특화) */
async function fetchNaverNews(ticker: string): Promise<string[]> {
  try {
    const stock6 = ticker.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '')
    if (stock6.length !== 6) return []
    const url = `https://m.stock.naver.com/api/news/stock/${stock6}?pageSize=10&page=1`
    const r = await fetch(url, { headers: { 'User-Agent': RSS_UA, Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const groups = await r.json() as Array<{ items?: Array<{ title?: string }> }>
    const titles: string[] = []
    for (const g of groups ?? [])
      for (const it of g.items ?? [])
        if (it.title) titles.push(
          it.title
            .replace(/<[^>]+>/g, '')                    // HTML 태그 제거
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .trim()
        )
    return titles.slice(0, 6)
  } catch { return [] }
}

async function fetchHeadlines(ticker: string, name: string, market: string): Promise<string[]> {
  if (market === 'KR') {
    const [naver, google, yahoo] = await Promise.all([
      fetchNaverNews(ticker),
      fetchGoogleNewsRss(name || ticker),
      fetchYahooKrRss(ticker),
    ])
    // 네이버·Google을 번갈아 인터리브(대형주는 네이버 거시뉴스, 소형주는 네이버 특화 → 둘 다 반영)
    // → Yahoo(백업)
    const interleaved: string[] = []
    for (let i = 0; i < Math.max(naver.length, google.length); i++) {
      if (naver[i]) interleaved.push(naver[i])
      if (google[i]) interleaved.push(google[i])
    }
    const merged = [...interleaved, ...yahoo]
    const seen = new Set<string>()
    return merged.filter(h => { if (seen.has(h)) return false; seen.add(h); return true }).slice(0, 6)
  }
  return fetchYahooRss(ticker)
}

// ── Gemini 분석 ───────────────────────────────────────────────────────────────
interface GeminiCatalyst {
  catalystStatus: CatalystStatus
  keyFact:        string
  actionGuide:    string
  riskLevel:      RiskLevel
  relevantMetric: string
  isNoise:        boolean
}

const CATALYST_SCHEMA = {
  type: 'OBJECT',
  properties: {
    catalystStatus: { type: 'STRING', enum: ['HOLD_STRONG', 'OBSERVE', 'RE_EVALUATE'] },
    keyFact:        { type: 'STRING' },
    actionGuide:    { type: 'STRING' },
    riskLevel:      { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    relevantMetric: { type: 'STRING' },
    isNoise:        { type: 'BOOLEAN' },
  },
  required: ['catalystStatus', 'keyFact', 'actionGuide', 'riskLevel', 'relevantMetric', 'isNoise'],
}

function buildPrompt(ticker: string, name: string, market: string, headlines: string[], peg: number | null, tier: ValuationTier, opMargin: number | null): string {
  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
  const tierKo = tier === 'EXPENSIVE' ? '고평가(비쌈)' : tier === 'CHEAP' ? '저평가(쌈)' : tier === 'FAIR' ? '적정가' : tier === 'LOSS' ? '영업적자(밸류 함정 주의)' : '알 수 없음'
  const omStr = opMargin != null ? ` · 영업이익률 ${(opMargin * 100).toFixed(1)}%` : ''
  const valuationLine = tier === 'LOSS'
    ? `영업적자 기업${omStr} — PEG/저PEG는 무의미하다. 현금 소진·자본 잠식 리스크가 본질. (Jarvis 처방전상 "매도 검토" 가능 구간)`
    : peg != null
      ? `PEG=${peg.toFixed(2)} → ${tierKo}${tier === 'EXPENSIVE' ? ' (Jarvis 처방전상 "매도 검토" 구간)' : ''}${omStr}`
      : `PEG 데이터 없음 (밸류에이션 판단 보류)${omStr}`

  return `너는 피터 린치처럼 생각하는 투자 교육자다. 아래 뉴스 헤드라인과 밸류에이션 상태를 종합해 학생 투자자가 지금 무엇을 해야 하는지 판단하라.

[종목]
티커: ${ticker}
이름: ${name || ticker}
시장: ${market}

[현재 밸류에이션 상태 — 다른 분석 엔진이 계산한 값]
${valuationLine}

[최근 뉴스 헤드라인 — 사실 근거는 이것뿐이다]
${headlineText || '(수집된 헤드라인 없음)'}

[⛔ 절대 규칙 — 위반 금지]
- keyFact·actionGuide의 '사실'은 위 헤드라인에 실제로 적힌 내용에서만 도출하라. 헤드라인에 없는 구체적 사실(특정 기업명·금액·계약·수치)을 사전 지식으로 지어내는 것은 엄격히 금지한다. (밸류에이션 수치는 위에 주어진 PEG만 사용)
- 위 헤드라인들이 이 종목(${ticker}) 고유의 내용이 아니라 시장 전반·다른 종목·일반론(예: "AI 주식 백만장자", "시장 경보")뿐이라면: isNoise=true, catalystStatus=HOLD_STRONG, keyFact="${name || ticker} 고유의 중요 뉴스 없음 (시장 전반 기사만 존재)"로 정직하게 답하라. 절대 그럴듯한 뉴스를 창작하지 마라.

[catalystStatus = '사업/뉴스 축'만 판정 (가격은 보지 마라)]
   - HOLD_STRONG: 핵심 사업 모델·thesis 변화 없음 (호재이거나 노이즈)
   - OBSERVE: 중요한 변화 징후, 추가 지표 모니터링 필요
   - RE_EVALUATE: 투자 thesis를 다시 검토해야 할 악재·구조적 사건 (헤드라인에 명시적 근거 있을 때만)
   ※ 밸류에이션이 비싸다는 이유로 catalystStatus를 낮추지 마라. 그건 actionGuide에서 다룬다.

[actionGuide = '가치 × 모멘텀' 융합 진단 (여기서 가격을 반드시 반영)]
다음 매트릭스를 따라 학생에게 균형 잡힌 행동을 1~3문장으로 제시하라:
   - [영업적자(LOSS) + 뉴스 호재]: ⚠️ 가장 조심할 경우. "기술·매출 성장은 고무적이나 아직 영업적자(현금 소진) 기업이다. 좋은 뉴스에 취해 추격매수하지 말고, 흑자 전환·현금 런웨이를 먼저 확인하라. 린치는 '아직 증명되지 않은 회생주'엔 신중했다" (Tempus TEM이 이 경우)
   - [영업적자(LOSS) + 뉴스 악재]: "적자에 악재까지 → 비중 축소·손절 기준을 명확히 하라"
   - [고평가 + 뉴스 호재/견고]: "사업은 견고하나 PEG ${peg != null ? peg.toFixed(2) : ''} 고평가 구간 → 기존 물량은 보유하되 신규 추격매수는 자제하고 분할 익절 타이밍을 재라" (이튼ETN이 이 경우)
   - [고평가 + 뉴스 악재]: "고평가에 악재까지 → 비중 축소·매도를 우선 검토하라"
   - [저평가 + 뉴스 호재/견고]: "린치가 좋아할 진주 — 사업도 좋고 가격도 합리적, 적극 보유/매수 고려"
   - [적정가/PEG불명]: 뉴스 중심으로 판단하되 가격 부담 여부를 한 줄 덧붙여라
반드시 피터 린치 어투로, "좋은 뉴스 = 무조건 매수"가 아님을 가르쳐라. 특히 적자기업은 절대 '진주'라고 부르지 마라.

[나머지 필드]
- keyFact: 헤드라인에 적힌 가장 중요한 사실 1문장 (헤드라인 밖 정보 추가 금지)
- riskLevel: LOW/MEDIUM/HIGH (※고평가·영업적자면 가격/재무 위험을 반영해 한 단계 높게)
- relevantMetric: 이 뉴스와 가장 관련된 재무 지표 (예: "영업이익률", "매출성장률", "PEG")
- isNoise: 헤드라인이 주가 시황·시장 전체 등락·단순 목표가 변경·다른 종목 위주면 true

keyFact·actionGuide·relevantMetric은 반드시 한국어로 작성하라(영어 헤드라인도 한국어로 요약).
반드시 JSON으로만 응답.`
}

// ── 캐시 키 ───────────────────────────────────────────────────────────────────
// v5: 네이버 증권 뉴스 추가(KR) — 소스 변경으로 무효화
function cacheKey(ticker: string, market: string): string {
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `news-catalyst-v5:${ticker.toUpperCase()}:${market}:${yyyymmdd}`
}

// ── 단일 ticker 분석 ──────────────────────────────────────────────────────────
async function analyzeTicker(
  ticker: string,
  name: string,
  market: string,
  base: string
): Promise<TickerCatalyst> {
  const key = cacheKey(ticker, market)

  // L2 캐시 확인
  const cached = await getCache<TickerCatalyst>(key, 3 * 3600_000)
  if (cached) return { ...cached, fromCache: true }

  // 뉴스 + 재무 SSOT 병렬 수집 (canon-fund 6h 공유 캐시 → 대개 히트)
  const [headlines, fund] = await Promise.all([
    fetchHeadlines(ticker, name, market),
    getCanonicalFundamentals(ticker, market, base).catch(() => null),
  ])
  const peg = fund?.peg ?? null
  const valuationTier = valuationOf(peg, fund?.opMargin ?? null, fund?.roe ?? null, fund?.fcf ?? null)

  // Gemini 분석 (밸류에이션·수익성 컨텍스트 주입)
  const prompt = buildPrompt(ticker, name, market, headlines, peg, valuationTier, fund?.opMargin ?? null)
  const result = await callGeminiJSON<GeminiCatalyst>(prompt, CATALYST_SCHEMA, { temperature: 0.3 })

  const now = new Date().toISOString()
  let catalyst: TickerCatalyst

  if (result.ok) {
    let riskLevel: RiskLevel = (['LOW', 'MEDIUM', 'HIGH'] as const).includes(result.data.riskLevel) ? result.data.riskLevel : 'MEDIUM'
    // 적자기업은 본질적으로 위험 — 저위험으로 안심시키지 않도록 최소 중위험 보정
    if (valuationTier === 'LOSS' && riskLevel === 'LOW') riskLevel = 'MEDIUM'
    catalyst = {
      ticker, name, market,
      catalystStatus: (['HOLD_STRONG', 'OBSERVE', 'RE_EVALUATE'] as const).includes(result.data.catalystStatus) ? result.data.catalystStatus : 'HOLD_STRONG',
      keyFact:        result.data.keyFact        || '최근 중요 뉴스 없음',
      actionGuide:    result.data.actionGuide    || '현재 보유 전략 유지',
      riskLevel,
      relevantMetric: result.data.relevantMetric || '영업이익률',
      headlines:      headlines.slice(0, 5),
      isNoise:        result.data.isNoise        ?? false,
      peg, valuationTier,
      cachedAt: now,
      fromCache: false,
    }
  } else {
    // Gemini 실패 시 폴백 — 뉴스만 표시
    catalyst = {
      ticker, name, market,
      catalystStatus: 'OBSERVE',
      keyFact:        headlines[0] || '뉴스 수집 완료 (AI 분석 대기)',
      actionGuide:    '뉴스를 직접 확인하세요',
      riskLevel:      'MEDIUM',
      relevantMetric: '—',
      headlines:      headlines.slice(0, 5),
      isNoise:        false,
      peg, valuationTier,
      cachedAt: now,
      fromCache: false,
    }
  }

  await setCache(key, catalyst)
  return catalyst
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  // 인증 확인
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // PEG SSOT(stock-info) 내부 호출용 절대 URL
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  // 사용자 보유 종목 조회
  const { data: holdings } = await supabase
    .from('investments')
    .select('ticker, name, market')
    .eq('user_id', user.id)

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ catalysts: [], generatedAt: new Date().toISOString(), reEvaluateCount: 0 })
  }

  // 개별주식만 필터 (ETF·코인·원자재 제외)
  const stocks = holdings.filter(h =>
    getAssetType(h.ticker, h.name ?? '', h.market ?? 'US') === 'STOCK'
  )

  // ticker 디듀프
  const uniqMap = new Map<string, { ticker: string; name: string; market: string }>()
  for (const h of stocks) {
    const k = `${h.ticker.toUpperCase()}|${h.market ?? 'US'}`
    if (!uniqMap.has(k)) uniqMap.set(k, { ticker: h.ticker, name: h.name ?? '', market: h.market ?? 'US' })
  }

  // 동시성 3으로 분석 (Gemini quota 보호)
  const entries = Array.from(uniqMap.values())
  const results: TickerCatalyst[] = []

  for (let i = 0; i < entries.length; i += 3) {
    const batch = entries.slice(i, i + 3)
    const batchResults = await Promise.all(
      batch.map(({ ticker, name, market }) => analyzeTicker(ticker, name, market, base))
    )
    results.push(...batchResults)
  }

  // RE_EVALUATE 먼저, 그 다음 OBSERVE, 마지막 HOLD_STRONG
  const ORDER: Record<CatalystStatus, number> = { RE_EVALUATE: 0, OBSERVE: 1, HOLD_STRONG: 2 }
  results.sort((a, b) => ORDER[a.catalystStatus] - ORDER[b.catalystStatus])

  const reEvaluateCount = results.filter(r => r.catalystStatus === 'RE_EVALUATE').length

  return NextResponse.json(
    { catalysts: results, generatedAt: new Date().toISOString(), reEvaluateCount },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
