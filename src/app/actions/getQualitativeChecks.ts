'use server'

/**
 * 🤖 피터 린치 위저드 STEP 2 자동 진단 (Zero Input)
 *
 * 기존: 학생이 14개 정성 체크리스트를 수동 체크 → 학생들이 모르고 싫어함.
 * 개선: 우리가 이미 가진 신호 + AI로 자동 판정 → 학생은 결과 확인·수정만.
 *
 *  · insider_buying ← getInsiderSignal (DART/EDGAR 실데이터, 하드)
 *  · no_analyst     ← getAnalystSignal (애널리스트 커버리지, 하드)
 *  · 나머지 12개 주관 항목 ← Gemini(회사 지식) 자동 판정 (모델 폴백 체인)
 *
 * Lazy Caching: in-memory 6h. Gemini 한도 소진 시 하드 2개만이라도 자동.
 */

import { getInsiderSignal } from './getInsiderSignal'
import { getAnalystSignal } from './getAnalystSignal'

export type CheckKey =
  | 'boring_name' | 'no_analyst' | 'boring_industry' | 'insider_buying'
  | 'niche_monopoly' | 'repeat_purchase' | 'restructuring' | 'hidden_assets'
  | 'spinoff' | 'recession_proof'
  | 'hot_industry' | 'no_barrier' | 'random_acquisition' | 'customer_concentration'

export interface QualResult {
  checks:  Partial<Record<CheckKey, boolean>>
  reasons: Partial<Record<CheckKey, string>>
  insiderKnown: boolean      // 내부자 데이터 확보 여부 (US·KR)
  analystKnown: boolean
  aiUsed:  boolean           // Gemini 판정 성공 여부
  status:  'ok' | 'partial' | 'error'
  asOf:    string
}

// ── Gemini 자동 판정 대상 (주관적 12개) ─────────────────────────────────────
const SUBJECTIVE: { key: CheckKey; q: string }[] = [
  { key: 'boring_name',        q: '회사 이름이 따분하거나 우스꽝스러운가 (대중이 무관심)?' },
  { key: 'boring_industry',    q: '대중이 기피·혐오하는 사양 업종인가 (폐기물·장례·담배 등)?' },
  { key: 'niche_monopoly',     q: '틈새시장을 규제·특허·입지·브랜드로 사실상 독점하는가?' },
  { key: 'repeat_purchase',    q: '소비자가 반복 구매하는 소비재 성격인가 (면도기·의약품·음료)?' },
  { key: 'restructuring',      q: '현재 구조조정·비용절감·사업재편이 진행 중인가?' },
  { key: 'hidden_assets',      q: '부동산·특허·브랜드 등 장부에 안 잡힌 숨은 자산이 있는가?' },
  { key: 'spinoff',            q: '최근(수년 내) 모기업에서 스핀오프(분사)된 기업인가?' },
  { key: 'recession_proof',    q: '불경기에도 수요가 거의 안 변하는 제품/서비스인가 (식품·의약·공공)?' },
  { key: 'hot_industry',       q: '매스컴이 매일 떠드는 핫한 인기 업종인가 (AI·반도체·2차전지 등)?' },
  { key: 'no_barrier',         q: '경쟁사 난립으로 진입장벽이 거의 없는가?' },
  { key: 'random_acquisition', q: '핵심과 무관한 무분별한 타 업종 M&A를 진행 중인가?' },
  { key: 'customer_concentration', q: '주요 고객 1~2개사에 매출 50% 이상이 집중되는가?' },
]

const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash']

const CACHE = new Map<string, { data: QualResult; expiresAt: number }>()
const CACHE_TTL = 6 * 3600_000

// ── Gemini 호출 (모델 폴백 체인, 구조화 JSON) ────────────────────────────────
async function aiAssess(name: string, ticker: string): Promise<{ checks: Partial<Record<CheckKey, boolean>>; reasons: Partial<Record<CheckKey, string>> } | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const props = SUBJECTIVE.map(s => `- ${s.key}: ${s.q}`).join('\n')
  const prompt = `너는 피터 린치식 종목 분석가야. ${name}(${ticker})에 대해 아래 정성 항목 각각이 '명백히 해당되면 true, 아니거나 불확실하면 false'로 보수적으로 판정해.
추측으로 true 남발 금지 — 잘 알려진 사실에 근거할 때만 true.

[판정 항목]
${props}

각 항목을 boolean으로, 그리고 true인 항목만 reasons에 한 줄(20자 내외) 근거를 넣어 JSON으로만 답해:
{ "checks": { "boring_name": false, ... 12개 모두 ... }, "reasons": { "<true인 키>": "근거" } }`

  const schemaProps: Record<string, { type: string }> = {}
  for (const s of SUBJECTIVE) schemaProps[s.key] = { type: 'BOOLEAN' }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          checks:  { type: 'OBJECT', properties: schemaProps },
          reasons: { type: 'OBJECT' },
        },
        required: ['checks'],
      },
    },
  })

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      )
      if (res.status === 429 || res.status >= 500 || !res.ok) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = await res.json()
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!txt) continue
      const parsed = JSON.parse(txt)
      if (!parsed?.checks) continue
      return { checks: parsed.checks, reasons: parsed.reasons ?? {} }
    } catch { /* 다음 모델 */ }
  }
  return null
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export async function getQualitativeChecks(input: { ticker: string; name?: string; market?: string }): Promise<QualResult> {
  const ticker = input.ticker.trim().toUpperCase()
  const name = input.name || ticker
  // market 보강: 6자리 숫자면 KR로 추론 (검색어가 한글명이어도 코드로 보정)
  const market = input.market || (/^\d{6}$/.test(ticker) ? 'KR' : 'US')
  const asOf = new Date().toISOString()

  // ★ 개별 주식만 — ETF·코인·원자재는 정성 진단 자체를 건너뜀
  const { getAssetType } = await import('@/lib/assetClassifier')
  if (getAssetType(ticker, name, market) !== 'STOCK') {
    return { checks: {}, reasons: {}, insiderKnown: false, analystKnown: false, aiUsed: false, status: 'error', asOf }
  }

  const hit = CACHE.get(ticker)
  if (hit && Date.now() < hit.expiresAt) return hit.data

  // ① 하드 데이터(내부자·애널리스트) + ② AI 동시
  const [insider, analyst, ai] = await Promise.all([
    getInsiderSignal({ ticker, market, name }).catch(() => null),
    getAnalystSignal({ ticker, name, market }).catch(() => null),
    aiAssess(name, ticker),
  ])

  const checks: Partial<Record<CheckKey, boolean>> = {}
  const reasons: Partial<Record<CheckKey, string>> = {}

  // AI 결과(주관 12개) 먼저 반영
  if (ai) {
    for (const s of SUBJECTIVE) {
      const v = ai.checks[s.key]
      if (typeof v === 'boolean') checks[s.key] = v
      if (v && ai.reasons[s.key]) reasons[s.key] = String(ai.reasons[s.key])
    }
  }

  // ★ 하드 데이터로 2개 항목 강제(덮어쓰기) — AI보다 실데이터 우선
  const insiderKnown = !!insider && (insider.status === 'ok' || insider.status === 'none')
  if (insiderKnown) {
    checks.insider_buying = insider!.status === 'ok' && insider!.hasBuys
    if (checks.insider_buying) {
      const cur = insider!.currency === 'KRW' ? '₩' : '$'
      reasons.insider_buying = `내부자 ${insider!.buyerCount}명 장내매수${insider!.cluster ? '(클러스터)' : ''}`
      void cur
    }
  }

  const analystKnown = !!analyst && (analyst.status === 'ok' || analyst.status === 'none')
  if (analystKnown) {
    if (analyst!.status === 'none') { checks.no_analyst = true; reasons.no_analyst = '애널리스트 커버리지 거의 없음' }
    else {
      const cov = analyst!.source === 'naver' ? (analyst!.reportCount ?? 0) : (analyst!.analysts ?? 0)
      checks.no_analyst = cov > 0 && cov <= 3
      if (checks.no_analyst) reasons.no_analyst = `커버 ${cov}곳뿐 — 숨겨진 진주 신호`
    }
  }

  const status: QualResult['status'] = ai ? 'ok' : (insiderKnown || analystKnown) ? 'partial' : 'error'
  const result: QualResult = { checks, reasons, insiderKnown, analystKnown, aiUsed: !!ai, status, asOf }

  if (status !== 'error') CACHE.set(ticker, { data: result, expiresAt: Date.now() + CACHE_TTL })
  return result
}
