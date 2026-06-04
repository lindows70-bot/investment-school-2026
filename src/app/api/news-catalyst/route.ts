// 포트폴리오 뉴스 촉매 레이더 API — ticker별 뉴스 수집·Gemini 분석·캐시 서빙
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { getAssetType } from '@/lib/assetClassifier'
import { getCanonicalPeg } from '@/lib/canonicalFundamentals'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type CatalystStatus = 'HOLD_STRONG' | 'OBSERVE' | 'RE_EVALUATE'
export type RiskLevel      = 'LOW' | 'MEDIUM' | 'HIGH'
// 밸류에이션 축(가격) — PEG에서 코드가 결정론적으로 산출(Jarvis 매도 기준 PEG>2.2와 일치)
export type ValuationTier  = 'CHEAP' | 'FAIR' | 'EXPENSIVE' | 'UNKNOWN'

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

/** PEG → 밸류에이션 등급 (Jarvis SELL 기준 PEG>2.2와 정확히 일치 — 제2원칙) */
function valuationOf(peg: number | null): ValuationTier {
  if (peg == null || !isFinite(peg) || peg <= 0) return 'UNKNOWN'
  if (peg > 2.2)  return 'EXPENSIVE'   // Jarvis 매도 검토 구간
  if (peg <= 1.0) return 'CHEAP'       // 린치 적정가 이하
  return 'FAIR'
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

async function fetchHeadlines(ticker: string, name: string, market: string): Promise<string[]> {
  if (market === 'KR') {
    const [google, yahoo] = await Promise.all([
      fetchGoogleNewsRss(name || ticker),
      fetchYahooKrRss(ticker),
    ])
    // Google News 우선 (더 많음), Yahoo 보완
    const merged = [...google, ...yahoo]
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

function buildPrompt(ticker: string, name: string, market: string, headlines: string[], peg: number | null, tier: ValuationTier): string {
  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
  const tierKo = tier === 'EXPENSIVE' ? '고평가(비쌈)' : tier === 'CHEAP' ? '저평가(쌈)' : tier === 'FAIR' ? '적정가' : '알 수 없음'
  const valuationLine = peg != null
    ? `PEG=${peg.toFixed(2)} → ${tierKo}${tier === 'EXPENSIVE' ? ' (Jarvis 처방전상 "매도 검토" 구간)' : ''}`
    : 'PEG 데이터 없음 (밸류에이션 판단 보류)'

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
   - [고평가 + 뉴스 호재/견고]: "사업은 견고하나 PEG ${peg != null ? peg.toFixed(2) : ''} 고평가 구간 → 기존 물량은 보유하되 신규 추격매수는 자제하고 분할 익절 타이밍을 재라" (이튼ETN이 이 경우)
   - [고평가 + 뉴스 악재]: "고평가에 악재까지 → 비중 축소·매도를 우선 검토하라"
   - [저평가 + 뉴스 호재/견고]: "린치가 좋아할 진주 — 사업도 좋고 가격도 합리적, 적극 보유/매수 고려"
   - [적정가/PEG불명]: 뉴스 중심으로 판단하되 가격 부담 여부를 한 줄 덧붙여라
반드시 피터 린치 어투로, "좋은 뉴스 = 무조건 매수"가 아님을 가르쳐라.

[나머지 필드]
- keyFact: 헤드라인에 적힌 가장 중요한 사실 1문장 (헤드라인 밖 정보 추가 금지)
- riskLevel: LOW/MEDIUM/HIGH (※고평가면 가격 위험을 반영해 한 단계 높게)
- relevantMetric: 이 뉴스와 가장 관련된 재무 지표 (예: "영업이익률", "매출성장률", "PEG")
- isNoise: 헤드라인이 주가 시황·시장 전체 등락·단순 목표가 변경·다른 종목 위주면 true

keyFact·actionGuide·relevantMetric은 반드시 한국어로 작성하라(영어 헤드라인도 한국어로 요약).
반드시 JSON으로만 응답.`
}

// ── 캐시 키 ───────────────────────────────────────────────────────────────────
// v3: PEG 밸류에이션 축 통합(가치×모멘텀) — 구조 변경으로 무효화
function cacheKey(ticker: string, market: string): string {
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `news-catalyst-v3:${ticker.toUpperCase()}:${market}:${yyyymmdd}`
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

  // 뉴스 + PEG SSOT 병렬 수집 (PEG는 canon-fund 6h 공유 캐시 → 대개 히트)
  const [headlines, peg] = await Promise.all([
    fetchHeadlines(ticker, name, market),
    getCanonicalPeg(ticker, market, base).catch(() => null),
  ])
  const valuationTier = valuationOf(peg)

  // Gemini 분석 (PEG/밸류에이션 컨텍스트 주입)
  const prompt = buildPrompt(ticker, name, market, headlines, peg, valuationTier)
  const result = await callGeminiJSON<GeminiCatalyst>(prompt, CATALYST_SCHEMA, { temperature: 0.3 })

  const now = new Date().toISOString()
  let catalyst: TickerCatalyst

  if (result.ok) {
    catalyst = {
      ticker, name, market,
      catalystStatus: (['HOLD_STRONG', 'OBSERVE', 'RE_EVALUATE'] as const).includes(result.data.catalystStatus) ? result.data.catalystStatus : 'HOLD_STRONG',
      keyFact:        result.data.keyFact        || '최근 중요 뉴스 없음',
      actionGuide:    result.data.actionGuide    || '현재 보유 전략 유지',
      riskLevel:      (['LOW', 'MEDIUM', 'HIGH'] as const).includes(result.data.riskLevel) ? result.data.riskLevel : 'MEDIUM',
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
