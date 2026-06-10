/**
 * src/lib/gemini.ts — Gemini JSON 호출 공용 헬퍼 (서버 전용)
 *
 * 무료 quota는 '모델별 일일' 분리 → 한 모델이 429(소진)/5xx면 다음 모델로 폴백.
 * 모두 graceful: 키 없음/한도소진/에러는 예외 던지지 않고 reason 반환 → 호출부가 폴백.
 *
 * (getEarningsInsight의 검증된 모델 체인을 신규 코드용으로 추출)
 */

// lite 우선(깔끔한 JSON·저비용) / 2.5-flash는 thinking이라 최후순위
export const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
]

export type GeminiResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; reason: 'no_key' | 'rate_limited' | 'error' }

/**
 * 프롬프트 + responseSchema(JSON)로 Gemini 호출 → 파싱된 객체 반환.
 * @param schema Gemini responseSchema (type:'OBJECT' …)
 */
export async function callGeminiJSON<T>(
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>,
  opts: { temperature?: number } = {}
): Promise<GeminiResult<T>> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { ok: false, reason: 'no_key' }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.5,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  })

  let attempts = 0, rateLimited = 0
  for (const model of GEMINI_MODELS) {
    attempts++
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store' }
      )
      if (res.status === 429) { rateLimited++; continue }   // 이 모델 소진 → 다음
      if (res.status >= 500) continue                       // 일시 과부하 → 다음
      if (!res.ok) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = await res.json()
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!txt) continue                                    // 빈 응답 → 다음
      const parsed = JSON.parse(txt) as T
      return { ok: true, data: parsed, model }
    } catch { /* 다음 모델 */ }
  }
  return { ok: false, reason: rateLimited === attempts ? 'rate_limited' : 'error' }
}
