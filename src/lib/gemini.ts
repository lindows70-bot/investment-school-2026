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

/**
 * 한국어 프로즈 문체 지침 — humanizer 스킬(KatFishNet 연구·40 패턴)의 상위 offender만 압축.
 * 모든 프로즈 필드에 자동 부착(callGeminiJSON). 학생이 읽는 서술을 번역투 아닌 자연스러운 한국어로.
 * ⚠️ 문체만 교정 — 숫자·판정·사실·근거는 절대 바꾸지 말 것(humanizer 4대 철칙과 동일).
 */
export const KO_STYLE = `[한국어 문체 지침 — 서술 필드에만 적용, 숫자·판정·사실은 절대 불변]
- 번역투 금지: "~에 대해", "~을 통해", "~되어진다/~되어집니다", "~에 있어서", "~에 다름 아니다" 대신 자연스러운 동사로.
- 접속사 남발 금지: "그리고/그러나/또한/따라서"로 문장을 줄줄이 잇지 말 것. 짧게 끊어라.
- 나열체 금지: "첫째·둘째·셋째", "~들"(복수형) 남발, 세 항목 기계적 병렬을 피하고 흐르는 산문으로.
- AI 상투어 금지: "중요하다·핵심적·효과적·지속가능한·혁신적·주목할 만한" 같은 공허한 수식어 대신 구체적으로.
- 쉼표 과다 금지(영어식 쉼표 배치). 명사 나열보다 동사·형용사로 리듬을 살려라.
- 문장 끝은 마침표로. 문장 끝에 콜론(:) 쓰지 말 것.`

export type GeminiResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; reason: 'no_key' | 'no_paid_key' | 'rate_limited' | 'error' }

/**
 * 🔐 개인 데이터(학생 보유 종목·손익·비중)를 담은 프롬프트는 **유료 키로만** 보낸다.
 *
 * 왜: Google Gemini API 약관이 무료 티어("Unpaid Services")에 대해 이렇게 적는다 —
 *   · "Google uses the content you submit … to provide, improve, and develop Google products"
 *   · "human reviewers may read, annotate, and process your API input and output"
 *   · "**Do not submit sensitive, confidential, or personal information** to the Unpaid Services"
 * 유료 티어는 반대로 "prompts … are not used to improve our products"가 명시돼 있다.
 * 그런데 ai-rebalance·hq-briefing 이 종목명+종목별 손익%+포트 비중을 무료 키로 보내고 있었다
 * (2026-08-16 전수 점검 — 나머지 12개 LLM 경로는 공개 시장·재무 데이터라 무관).
 *
 * ⛔ **fail-closed** — 유료 키가 없으면 무료 키로 흘려보내지 않고 그냥 실패시킨다.
 *    호출부는 이미 결정론 폴백이 있어 화면이 깨지지 않는다. 토스 `assertTossOwner` 와 같은 원칙:
 *    개인 데이터 경계는 '되도록'이 아니라 '못 넘어가게' 막는다.
 * 💰 비용: 실측 프롬프트 ai-rebalance 3,122 · hq-briefing 2,018 토큰 → 학생 7명 기준 **월 약 300원**
 *    (flash-lite 유료 $0.10/M 입력 · $0.40/M 출력). 유료 계정에 얹히는 수준이라 사실상 무시 가능.
 */
const paidKey = () => process.env.GEMINI_PAID_API_KEY || null

/**
 * 프롬프트 + responseSchema(JSON)로 Gemini 호출 → 파싱된 객체 반환.
 * @param schema Gemini responseSchema (type:'OBJECT' …)
 * @param opts.personal 개인 데이터 포함 여부 — true 면 유료 키 전용(없으면 fail-closed)
 */
export async function callGeminiJSON<T>(
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>,
  opts: { temperature?: number; personal?: boolean } = {}
): Promise<GeminiResult<T>> {
  // 🔐 개인 데이터면 유료 키만 — 무료 키 폴백 금지(약관상 학습·사람 검토 대상이 된다)
  const key = opts.personal ? paidKey() : process.env.GEMINI_API_KEY
  if (!key) return { ok: false, reason: opts.personal ? 'no_paid_key' : 'no_key' }

  const body = JSON.stringify({
    // 문체 지침을 프롬프트 끝에 부착(내용 규칙 뒤 → 사실·판정 가드 우선 유지)
    contents: [{ parts: [{ text: `${prompt}\n\n${KO_STYLE}` }] }],
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
