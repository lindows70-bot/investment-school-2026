// 🏛️ 규제 레이더 — 암호화폐 관련 법안/규제를 신호등(친화/중립/규제)으로. "코인 가격은 기술이 아니라 法이 움직인다"
// Zero Cost: Google News RSS(무인증) → Gemini가 신호등 분류 + 1줄 투자관점 + 관련 코인. 환각 가드(헤드라인에 있는 것만) · 6h 캐시
//   2026-09-30: 항목마다 근거 헤드라인 번호(srcIdx)를 필수로 받아 서버가 범위를 검증하고, 못 대면 버린다(연준 디코더와 같은 가드 — "N개를 뽑아라"는 곧 "없으면 지어내라"다).
//   통과한 근거는 sources(제목·기사 링크)로 화면에 병기해 학생이 직접 대조한다. 링크는 구글 뉴스 리다이렉트(원문으로 넘어간다)
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
  sources: { title: string; url: string }[]   // 근거 헤드라인(서버가 srcIdx 범위 검증 후 채움 · 최대 3)
}
export interface RegulationResult {
  climate: RegImpact     // 전반 규제 기후
  climateText: string
  bills: RegBill[]
  asOf: string
}

type Headline = { title: string; url: string }
/** 구글 뉴스 RSS — <item> 단위로 제목과 링크를 짝지어 읽는다(제목만 모으면 링크를 못 단다) */
async function googleNews(query: string, take: number, lang: 'ko' | 'en'): Promise<Headline[]> {
  try {
    const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=ko&gl=KR&ceid=KR:ko'
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    const out: Headline[] = []
    for (const m of Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))) {
      const title = m[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? ''
      const url = m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ''
      if (title && /^https?:\/\//.test(url) && !/Google 뉴스/i.test(title)) out.push({ title, url })
      if (out.length >= take) break
    }
    return out
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
          srcIdx:  { type: 'ARRAY', items: { type: 'INTEGER' } },
        },
        required: ['title', 'impact', 'status', 'summary', 'assets', 'srcIdx'],
      },
    },
  },
  required: ['climate', 'climateText', 'bills'],
}

export async function GET() {
  const cacheKey = `crypto-regulation-v3:${kstDate()}`   // v3: sources(근거 헤드라인·링크) 추가 + srcIdx 가드 · v2: GENIUS Act 시행 전용 쿼리 + 통과법 포함 지시
  const cached = await getCache<RegulationResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [enReg, enBill, enGenius, koReg] = await Promise.all([
    googleNews('crypto regulation OR SEC crypto OR stablecoin law when:45d', 10, 'en'),
    googleNews('CLARITY Act OR digital asset market structure bill Congress when:90d', 7, 'en'),
    googleNews('GENIUS Act stablecoin implementation OR Treasury OCC when:120d', 6, 'en'),  // 작년 통과·시행 핵심 스테이블코인 법
    googleNews('가상자산 규제 법안 OR 클래리티 법안 OR 스테이블코인 지니어스법 when:60d', 7, 'ko'),
  ])
  const seen = new Set<string>()
  const headlines = [...enBill, ...enGenius, ...enReg, ...koReg].filter(h => (seen.has(h.title) ? false : (seen.add(h.title), true))).slice(0, 28)
  if (headlines.length === 0) return NextResponse.json({ error: 'no_news' }, { status: 200 })

  const prompt = `너는 투자학교의 AI 규제 분석관이다. 아래 실제 뉴스 헤드라인을 근거로, 지금 암호화폐 시장에 중요한 '규제/법안' 이슈를 신호등으로 정리하라.

[오늘 헤드라인]
${headlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

[규칙 — 절대 엄수]
- 헤드라인에 실제로 있는 법안·규제만 다뤄라. 헤드라인에 없는 법안·조항·날짜·표결결과를 지어내지 마라(불확실하면 status를 '논의 중'으로).
- bills: 시장에 영향이 큰 순서로 최대 5개. 각 항목:
  · title: 법안/규제명(한국어, 예: 클래리티 법안(CLARITY Act), 스테이블코인 규제(GENIUS Act))
  · impact: 'green'(제도권 편입·유동성 유입 호재) / 'yellow'(논의 중·불확실) / 'red'(규제 강화·유동성 차단 악재)
  · status: 계류/상원 통과/하원 표결/시행/소송 등 헤드라인 근거 상태. ⭐ GENIUS Act(스테이블코인 법)처럼 이미 통과·시행된 핵심 법도 시행·이행(implementation) 헤드라인이 있으면 status='시행'으로 반드시 포함하라(통과됐다고 빼지 말 것 — 시행 세부가 시장에 영향).
  · summary: "이 법이 시장 유동성을 막을지 열지" 관점의 투자자용 1줄(한국어)
  · assets: 직접 관련 코인 배열(예: ["BTC","ETH","SOL","XRP","스테이블코인"]). 전체 시장이면 ["전체"]
  · srcIdx: 이 항목의 근거가 된 헤드라인 번호 배열(위 목록의 번호, 1~${headlines.length}). 근거 헤드라인이 없으면 그 항목을 만들지 마라 — 근거 없는 항목은 서버가 버린다.
- climate: 전반 규제 기후 신호등(green/yellow/red), climateText: 한 줄 요약(한국어).
- 학생 교육 톤: 법률용어 최소화, "법이 유동성을 막느냐 여느냐"로 단순화. 전부 한국어.`

  type RawBill = Omit<RegBill, 'sources'> & { srcIdx?: unknown }
  const g = await callGeminiJSON<{ climate: RegImpact; climateText: string; bills: RawBill[] }>(prompt, SCHEMA, { temperature: 0.3 })
  if (!g.ok || !g.data) return NextResponse.json({ error: 'ai_failed' }, { status: 200 })

  // srcIdx 가드 — 범위 안의 번호만 인정하고, 하나도 못 대면 항목을 버린다(가드는 번호가 유효한지만 본다 — 그 헤드라인이 문장을 뒷받침하는지는 학생이 링크로 대조)
  const bills: RegBill[] = (g.data.bills ?? []).flatMap(b => {
    const idx = Array.isArray(b.srcIdx) ? Array.from(new Set(b.srcIdx.map(n => Math.trunc(Number(n))).filter(n => Number.isInteger(n) && n >= 1 && n <= headlines.length))) : []
    if (idx.length === 0) return []
    const { srcIdx: _drop, ...rest } = b   // eslint-disable-line @typescript-eslint/no-unused-vars
    return [{ ...rest, sources: idx.slice(0, 3).map(n => headlines[n - 1]) }]
  }).slice(0, 5)
  const result: RegulationResult = {
    climate: g.data.climate ?? 'yellow',
    climateText: g.data.climateText ?? '',
    bills,
    asOf: new Date().toISOString(),
  }
  if (result.bills.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
