'use server'

/**
 * 🤖 Jarvis 어닝콜 애널리스트 — 서버 액션 (비밀병기 4단계)
 *
 * 설계 원칙
 *  ① Zero Cost   : 유료 금융 API 미사용. Yahoo Finance 뉴스 RSS(무료·초경량)만 스크래핑.
 *  ② Lazy Caching: 조회 순간 DB에 없을 때만 1회 스크래핑+AI 분석 → earnings_insights upsert.
 *                  이후 동일 (ticker, quarter)는 DB에서 즉시 반환.
 *  ③ Zero Input  : 학생 입력 0. 종목 상세 진입 시 JarvisInsight가 자동 호출.
 *
 * 흐름: Supabase 조회(있으면 반환) → 없으면 [뉴스 스크래핑 + 실데이터 grounding]
 *       → Gemini(린치 페르소나) 분석 → upsert → 반환
 */

import { createClient as createAdmin } from '@supabase/supabase-js'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface JarvisFacts {
  per?:        number | string | null
  peg?:        number | string | null
  eps?:        number | null
  epsGrowth?:  number | null     // 소수(0.25) 또는 % — 호출부에서 % 정수로 정규화 권장
  forwardEps?: number | null
  lynchLabel?: string | null
  marketCap?:  number | null
  currency?:   string | null
}

export interface JarvisInput {
  ticker: string
  name:   string
  market: string          // 'US' | 'KR' | 'CRYPTO'
  facts?: JarvisFacts
}

export interface JarvisInsight {
  ticker:         string
  quarter:        string
  growthStory:    string
  managementTone: string
  guidance:       string
  sentimentScore: number          // 0~100 (높을수록 긍정/낙관)
  headlines:      string[]        // 분석에 사용한 뉴스 헤드라인 (출처 투명성)
  cached:         boolean         // true=캐시 / false=방금 분석
  status:         'ok' | 'no_key' | 'no_data' | 'error' | 'rate_limited'
  message?:       string
  asOf:           string
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
// in-memory 캐시 (DB 테이블 미생성 시에도 Gemini 재호출 방지 → 무료 한도 보호)
const MEM = new Map<string, { data: JarvisInsight; expiresAt: number }>()
const MEM_TTL = 6 * 3600_000

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** 보고 시점 기준 '가장 최근 보고된 분기' 라벨 (캐시 키로도 사용 — 결정론적) */
function latestReportedQuarter(now = new Date()): string {
  const m = now.getUTCMonth()   // 0=Jan
  const y = now.getUTCFullYear()
  if (m === 0)               return `${y - 1} Q3`   // 1월
  if (m >= 1 && m <= 3)      return `${y - 1} Q4`   // 2~4월
  if (m >= 4 && m <= 6)      return `${y} Q1`       // 5~7월
  if (m >= 7 && m <= 9)      return `${y} Q2`       // 8~10월
  return `${y} Q3`                                  // 11~12월
}

const RSS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Gemini 모델 폴백 체인 — 무료 quota는 '모델별 일일' 분리이므로, 한 모델이 429(소진)면
// 즉시 다음 모델로 넘어간다. (lite 우선: 깔끔한 JSON·저비용 / 2.5-flash는 thinking이라 최후순위)
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
]

/** RSS XML → { title, desc }[] (의존성 없이 정규식 파싱) */
function stripTag(seg: string, tag: string): string {
  const m = seg.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return ''
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Yahoo Finance 뉴스 RSS 스크래핑 (초경량, 무료) — 어닝 키워드 우선 필터 */
async function scrapeHeadlines(ticker: string, market: string): Promise<string[]> {
  // KR 종목은 .KS 접미사로 Yahoo 심볼 구성
  const sym = market === 'KR' ? `${ticker}.KS` : ticker
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`
  let xml = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': RSS_UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      next: { revalidate: 1800 } as RequestInit['next'],
    })
    if (res.ok) xml = await res.text()
  } catch { /* 네트워크 실패 → 빈 결과 */ }
  if (!xml) return []

  const items: { title: string; desc: string }[] = []
  for (const block of xml.split('<item>').slice(1)) {
    const seg = block.split('</item>')[0]
    const title = stripTag(seg, 'title')
    const desc  = stripTag(seg, 'description')
    if (title && !/Latest Financial News/i.test(title)) items.push({ title, desc })
  }

  // 어닝 관련 헤드라인 우선
  const KW = /earnings|quarter|revenue|profit|guidance|results|EPS|fiscal|beat|miss|sales|outlook|forecast|margin|dividend|실적|분기|매출|영업이익|가이던스/i
  const earnings = items.filter(it => KW.test(`${it.title} ${it.desc}`))
  const picked = (earnings.length >= 2 ? earnings : items).slice(0, 8)

  return picked.map(it => {
    const d = it.desc && it.desc !== it.title ? ` — ${it.desc.slice(0, 180)}` : ''
    return `${it.title}${d}`
  })
}

/** 팩트 한 줄 요약 (AI grounding) */
function factLine(f?: JarvisFacts): string {
  if (!f) return '재무 데이터 없음'
  const parts: string[] = []
  if (f.lynchLabel)              parts.push(`린치분류=${f.lynchLabel}`)
  if (f.per != null && f.per !== 'N/A')  parts.push(`PER=${f.per}`)
  if (f.peg != null && f.peg !== 'N/A')  parts.push(`PEG=${f.peg}`)
  if (f.eps != null)             parts.push(`EPS=${f.eps}`)
  if (f.epsGrowth != null)       parts.push(`예상EPS성장률=${(Math.abs(f.epsGrowth) <= 5 ? f.epsGrowth * 100 : f.epsGrowth).toFixed(1)}%`)
  if (f.forwardEps != null)      parts.push(`전망EPS=${f.forwardEps}`)
  if (f.marketCap != null)       parts.push(`시총=${(f.marketCap / 1e9).toFixed(1)}B`)
  return parts.length ? parts.join(' · ') : '재무 데이터 없음'
}

// ── Gemini 호출 (REST, SDK 없음) ─────────────────────────────────────────────
interface GeminiOut { growthStory: string; managementTone: string; guidance: string; sentimentScore: number }

async function analyzeWithGemini(
  input: JarvisInput, quarter: string, headlines: string[]
): Promise<GeminiOut | 'rate_limited' | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const newsBlock = headlines.length
    ? headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : '(이 종목의 최근 어닝 관련 뉴스를 찾지 못함 — 재무 팩트 위주로 분석)'

  const prompt = `너는 전설적인 투자자 '피터 린치'야. 후배 개인투자자(투자학교 학생)에게 ${input.name}(${input.ticker})의 ${quarter} 실적을 친근한 멘토 말투로 들려줘.

[반드시 지킬 톤]
- "이번 실적을 린치의 시각에서 분석해 봤어," 처럼 친근한 구어체로.
- 딱딱한 숫자 나열 금지. 숫자 뒤에 숨은 '실적의 스토리'를 들려줘.
- 모르거나 데이터가 부족하면 솔직하게 "자료가 부족해 추정해보면" 식으로. 절대 지어내지 마.
- 한국어. 각 항목 2~3문장. 매수/매도 직접 권유 금지(교육용).

[종목 팩트]
${factLine(input.facts)}

[최근 뉴스 헤드라인]
${newsBlock}

아래 JSON 스키마로만 답해(여는 말/마크다운 금지):
{
  "growthStory":    "성장 스토리 — 지금 이 회사가 어떤 성장 국면인지, 린치식 분류 관점에서. 텐배거 가능성/성장 동력 또는 둔화 신호.",
  "managementTone": "경영진 태도 — 뉴스·실적에서 읽히는 경영진의 자신감/태도. 추정이면 추정이라 명시.",
  "guidance":       "다음 분기 가이던스 — 향후 전망과 학생이 체크해야 할 핵심 포인트.",
  "sentimentScore": 0~100 정수 (실적·전망 종합 낙관도, 높을수록 긍정)
}`

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          growthStory:    { type: 'STRING' },
          managementTone: { type: 'STRING' },
          guidance:       { type: 'STRING' },
          sentimentScore: { type: 'INTEGER' },
        },
        required: ['growthStory', 'managementTone', 'guidance', 'sentimentScore'],
      },
    },
  })

  // 모델 폴백 체인: 한 모델이 429(일일 무료 한도 소진)거나 5xx면 다음 모델로.
  // (무료 quota는 모델별 분리 → 한 모델 막혀도 다른 모델로 계속 분석 가능)
  let attempts = 0, rateLimited = 0
  for (const model of GEMINI_MODELS) {
    attempts++
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      )
      if (res.status === 429) { rateLimited++; continue }   // 이 모델 소진 → 다음 모델
      if (res.status >= 500)  { continue }                  // 일시 과부하 → 다음 모델
      if (!res.ok) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = await res.json()
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!txt) continue                                    // 빈 응답(thinking 토큰 소진 등) → 다음 모델
      const parsed = JSON.parse(txt) as GeminiOut
      if (!parsed?.growthStory) continue
      parsed.sentimentScore = Math.max(0, Math.min(100, Math.round(Number(parsed.sentimentScore) || 50)))
      return parsed
    } catch { /* 다음 모델 */ }
  }
  // 모든 시도가 429였다면 한도 초과로 안내(자동 재시도 트리거), 아니면 일반 실패
  return rateLimited === attempts ? 'rate_limited' : null
}

// ── 메인 서버 액션 ───────────────────────────────────────────────────────────
export async function getEarningsInsight(input: JarvisInput): Promise<JarvisInsight> {
  const ticker  = input.ticker.trim().toUpperCase()
  const quarter = latestReportedQuarter()
  const base = { ticker, quarter, headlines: [] as string[], asOf: new Date().toISOString() }
  const memKey = `${ticker}:${quarter}`

  // ⓪ in-memory 캐시 (DB 테이블 없어도 Gemini 재호출 방지)
  const mem = MEM.get(memKey)
  if (mem && Date.now() < mem.expiresAt) return { ...mem.data, cached: true }

  // ① Supabase 캐시 조회 (있으면 즉시 반환)
  let db: ReturnType<typeof adminClient> | null = null
  try {
    db = adminClient()
    const { data, error } = await db
      .from('earnings_insights')
      .select('summary_text, sentiment_score, created_at')
      .eq('ticker', ticker).eq('quarter', quarter)
      .maybeSingle()
    if (!error && data) {
      const s = JSON.parse(data.summary_text)
      const cachedResult: JarvisInsight = {
        ...base,
        growthStory:    s.growthStory ?? '',
        managementTone: s.managementTone ?? '',
        guidance:       s.guidance ?? '',
        sentimentScore: data.sentiment_score ?? 50,
        headlines:      s.headlines ?? [],
        cached:         true,
        status:         'ok',
        asOf:           data.created_at ?? base.asOf,
      }
      MEM.set(memKey, { data: cachedResult, expiresAt: Date.now() + MEM_TTL })
      return cachedResult
    }
  } catch { /* 테이블 미존재/네트워크 → 아래로 진행 (graceful) */ }

  // ② 캐시 없음 → 뉴스 스크래핑 (Zero Cost)
  const headlines = await scrapeHeadlines(ticker, input.market)

  // ③ Gemini 린치 분석
  const ai = await analyzeWithGemini(input, quarter, headlines)
  if (ai === 'rate_limited') {
    // 무료 RPM 한도 초과 — 캐시하지 않음(잠시 후 자동 재시도되도록)
    return {
      ...base, headlines,
      growthStory: '', managementTone: '', guidance: '', sentimentScore: 50,
      cached: false, status: 'rate_limited',
      message: '지금 분석 요청이 몰려 잠시 대기 중입니다(무료 AI 분당 한도). 20초쯤 뒤 새로고침하면 분석돼요.',
    }
  }
  if (!ai) {
    const noKey = !process.env.GEMINI_API_KEY
    return {
      ...base, headlines,
      growthStory: '', managementTone: '', guidance: '', sentimentScore: 50,
      cached: false,
      status: noKey ? 'no_key' : 'error',
      message: noKey
        ? 'GEMINI_API_KEY가 설정되지 않아 분석을 수행할 수 없습니다.'
        : '분석 엔진 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }

  // ④ DB upsert (table 없으면 조용히 skip — 페이지는 정상)
  try {
    if (db) {
      await db.from('earnings_insights').upsert({
        ticker, quarter,
        summary_text: JSON.stringify({
          growthStory: ai.growthStory, managementTone: ai.managementTone,
          guidance: ai.guidance, headlines,
        }),
        sentiment_score: ai.sentimentScore,
      }, { onConflict: 'ticker,quarter' })
    }
  } catch { /* 캐시 저장 실패는 치명적 아님 */ }

  // ⑤ 반환 (+ in-memory 캐시 저장)
  const result: JarvisInsight = {
    ...base, headlines,
    growthStory:    ai.growthStory,
    managementTone: ai.managementTone,
    guidance:       ai.guidance,
    sentimentScore: ai.sentimentScore,
    cached:         false,
    status:         'ok',
  }
  MEM.set(memKey, { data: result, expiresAt: Date.now() + MEM_TTL })
  return result
}
