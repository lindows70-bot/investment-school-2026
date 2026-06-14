// 🏛️ 규제 레이더 — 암호화폐 관련 법안/규제를 신호등(친화/중립/규제)으로. "코인 가격은 기술이 아니라 法이 움직인다"
// Zero Cost: Google News RSS(무인증) → Gemini가 신호등 분류 + 1줄 투자관점 + 관련 코인. 환각 가드(헤드라인에 있는 것만) · 6h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export type RegImpact = 'green' | 'yellow' | 'red'
export interface RegBill {
  title: string          // 법안/규제 명(한국어)
  impact: RegImpact      // green=유동성 유입·제도권 편입 / yellow=논의중·불확실 / red=규제강화·유동성 차단
  status: string         // 계류/상원 통과/시행/논의 등
  summary: string        // 투자자 관점 1줄
  assets: string[]       // 관련 코인(BTC·ETH·SOL·XRP·스테이블코인 등)
}
export interface RegulationResult {
  climate: RegImpact     // 전반 규제 기후
  climateText: string
  bills: RegBill[]
  asOf: string
}

async function googleNews(query: string, take: number, lang: 'ko' | 'en'): Promise<string[]> {
  try {
    const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=ko&gl=KR&ceid=KR:ko'
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    return Array.from(xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)).map(m => m[1].trim()).filter(t => t && !/Google 뉴스/i.test(t)).slice(1, 1 + take)
  } catch { return [] }
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    climate: { type: 'STRING', enum: ['green', 'yellow', 'red'] },
    climateText: { type: 'STRING' },
    bills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title:   { type: 'STRING' },
          impact:  { type: 'STRING', enum: ['green', 'yellow', 'red'] },
          status:  { type: 'STRING' },
          summary: { type: 'STRING' },
          assets:  { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'impact', 'status', 'summary', 'assets'],
      },
    },
  },
  required: ['climate', 'climateText', 'bills'],
}

export async function GET() {
  const cacheKey = `crypto-regulation-v1:${kstDate()}`
  const cached = await getCache<RegulationResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [enReg, enBill, koReg] = await Promise.all([
    googleNews('crypto regulation OR SEC crypto OR stablecoin law when:45d', 10, 'en'),
    googleNews('CLARITY Act OR GENIUS Act OR digital asset bill Congress when:60d', 8, 'en'),
    googleNews('가상자산 규제 법안 OR 클래리티 법안 OR 스테이블코인 규제 when:45d', 8, 'ko'),
  ])
  const headlines = Array.from(new Set([...enBill, ...enReg, ...koReg])).slice(0, 26)
  if (headlines.length === 0) return NextResponse.json({ error: 'no_news' }, { status: 200 })

  const prompt = `너는 투자학교의 AI 규제 분석관이다. 아래 실제 뉴스 헤드라인을 근거로, 지금 암호화폐 시장에 중요한 '규제/법안' 이슈를 신호등으로 정리하라.

[오늘 헤드라인]
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

[규칙 — 절대 엄수]
- 헤드라인에 실제로 있는 법안·규제만 다뤄라. 헤드라인에 없는 법안·조항·날짜·표결결과를 지어내지 마라(불확실하면 status를 '논의 중'으로).
- bills: 시장에 영향이 큰 순서로 최대 5개. 각 항목:
  · title: 법안/규제명(한국어, 예: 클래리티 법안(CLARITY Act), 스테이블코인 규제(GENIUS Act))
  · impact: 'green'(제도권 편입·유동성 유입 호재) / 'yellow'(논의 중·불확실) / 'red'(규제 강화·유동성 차단 악재)
  · status: 계류/상원 통과/하원 표결/시행/소송 등 헤드라인 근거 상태
  · summary: "이 법이 시장 유동성을 막을지 열지" 관점의 투자자용 1줄(한국어)
  · assets: 직접 관련 코인 배열(예: ["BTC","ETH","SOL","XRP","스테이블코인"]). 전체 시장이면 ["전체"]
- climate: 전반 규제 기후 신호등(green/yellow/red), climateText: 한 줄 요약(한국어).
- 학생 교육 톤: 법률용어 최소화, "법이 유동성을 막느냐 여느냐"로 단순화. 전부 한국어.`

  const g = await callGeminiJSON<{ climate: RegImpact; climateText: string; bills: RegBill[] }>(prompt, SCHEMA, { temperature: 0.3 })
  if (!g.ok || !g.data) return NextResponse.json({ error: 'ai_failed' }, { status: 200 })

  const result: RegulationResult = {
    climate: g.data.climate ?? 'yellow',
    climateText: g.data.climateText ?? '',
    bills: (g.data.bills ?? []).slice(0, 5),
    asOf: new Date().toISOString(),
  }
  if (result.bills.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
