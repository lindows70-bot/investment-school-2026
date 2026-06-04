// 포트폴리오 뉴스 촉매 레이더 API — ticker별 뉴스 수집·Gemini 분석·캐시 서빙
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { getAssetType } from '@/lib/assetClassifier'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type CatalystStatus = 'HOLD_STRONG' | 'OBSERVE' | 'RE_EVALUATE'
export type RiskLevel      = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TickerCatalyst {
  ticker:         string
  name:           string
  market:         string
  catalystStatus: CatalystStatus
  keyFact:        string          // 가장 중요한 팩트 1문장
  actionGuide:    string          // 피터 린치 행동 가이드
  riskLevel:      RiskLevel
  relevantMetric: string          // 연결되는 재무 지표 (예: "영업이익률")
  headlines:      string[]        // 분석에 사용한 헤드라인
  isNoise:        boolean         // 주가 시황성 기사 필터
  cachedAt:       string
  fromCache:      boolean
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

function buildPrompt(ticker: string, name: string, market: string, headlines: string[]): string {
  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
  return `너는 피터 린치처럼 생각하는 투자 교육자다. 아래 뉴스 헤드라인들을 분석해 학생 투자자가 지금 무엇을 해야 하는지 판단하라.

[종목]
티커: ${ticker}
이름: ${name || ticker}
시장: ${market}

[최근 뉴스 헤드라인]
${headlineText || '(수집된 헤드라인 없음)'}

[분석 지침]
1. catalystStatus 판정:
   - HOLD_STRONG: 핵심 사업 모델 변화 없음, 일시적 노이즈, 계속 보유 권장
   - OBSERVE: 중요한 변화 징후, 추가 지표 모니터링 필요
   - RE_EVALUATE: 투자 thesis를 다시 검토해야 할 중요 사건 발생

2. keyFact: 이 뉴스에서 가장 중요한 사실 1문장 (학생이 원문 안 읽어도 핵심 파악)
3. actionGuide: 피터 린치 스타일로 학생이 지금 무엇을 해야 하는지 1~2문장
4. riskLevel: 현재 뉴스가 포트폴리오에 가져오는 리스크 수준
5. relevantMetric: 이 뉴스와 가장 관련된 재무 지표 (예: "영업이익률", "매출성장률", "부채비율", "EPS")
6. isNoise: 주가 시황, 시장 전체 등락, 단순 목표가 변경만 다루는 기사면 true

뉴스가 없거나 매우 빈약하면: catalystStatus=HOLD_STRONG, isNoise=true, keyFact="최근 중요 뉴스 없음"으로.
반드시 JSON으로만 응답.`
}

// ── 캐시 키 ───────────────────────────────────────────────────────────────────
function cacheKey(ticker: string, market: string): string {
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `news-catalyst:${ticker.toUpperCase()}:${market}:${yyyymmdd}`
}

// ── 단일 ticker 분석 ──────────────────────────────────────────────────────────
async function analyzeTicker(
  ticker: string,
  name: string,
  market: string
): Promise<TickerCatalyst> {
  const key = cacheKey(ticker, market)

  // L2 캐시 확인
  const cached = await getCache<TickerCatalyst>(key, 3 * 3600_000)
  if (cached) return { ...cached, fromCache: true }

  // 뉴스 수집
  const headlines = await fetchHeadlines(ticker, name, market)

  // Gemini 분석
  const prompt = buildPrompt(ticker, name, market, headlines)
  const result = await callGeminiJSON<GeminiCatalyst>(prompt, CATALYST_SCHEMA, { temperature: 0.3 })

  const now = new Date().toISOString()
  let catalyst: TickerCatalyst

  if (result.ok) {
    catalyst = {
      ticker, name, market,
      catalystStatus: result.data.catalystStatus ?? 'HOLD_STRONG',
      keyFact:        result.data.keyFact        || '최근 중요 뉴스 없음',
      actionGuide:    result.data.actionGuide    || '현재 보유 전략 유지',
      riskLevel:      result.data.riskLevel      ?? 'LOW',
      relevantMetric: result.data.relevantMetric || '영업이익률',
      headlines:      headlines.slice(0, 3),
      isNoise:        result.data.isNoise        ?? false,
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
      headlines:      headlines.slice(0, 3),
      isNoise:        false,
      cachedAt: now,
      fromCache: false,
    }
  }

  await setCache(key, catalyst)
  return catalyst
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: Request) {
  // 인증 확인
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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
      batch.map(({ ticker, name, market }) => analyzeTicker(ticker, name, market))
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
