// FRED(세인트루이스 연준) 관측치 공용 fetcher — 라우트 9곳·lib 9곳이 각자 URL 을 조립하던 것을 한 곳으로(2026-10-18 5차 점검 · SSOT).
//   같은 엔드포인트를 18가지로 부르면서 캐시 옵션이 없는 곳(Next Data Cache 박제 위험)·타임아웃이 제각각·결측('.') 처리가 달랐다.
//   여기서는 ①키 없으면 빈 결과 ②cache:'no-store' ③타임아웃 ④결측·NaN 제거만 한다. **정렬은 FRED 가 준 순서 그대로**(desc 를 준 호출부는 [0]이 최신이라 기대한다).
//   값의 뜻·단위 해석(units=pc1 등)은 호출부 몫 — 기간 계산은 인덱스 산술이 아니라 FRED units 로(CLAUDE.md CPI 함정).
export interface FredObs { date: string; v: number }
export type FredParams = Record<string, string | number | undefined>

const BASE = 'https://api.stlouisfed.org/fred/series/observations'

function buildUrl(series: string, key: string, params: FredParams, extra: string): string {
  const q = new URLSearchParams({ series_id: series, api_key: key, file_type: 'json' })
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  return `${BASE}?${q.toString()}${extra}`
}

/** 원본 JSON(observations 에 value 문자열 그대로 — '.' 포함). 키 없음·실패·HTTP 오류 = null.
 *  extra = 옛 호출부가 쓰던 '&units=pc1' 같은 쿼리 조각(그대로 뒤에 붙인다) */
export async function fredRaw(series: string, params: FredParams = {}, opts: { extra?: string; timeoutMs?: number } = {}): Promise<{ observations?: { date: string; value: string }[]; [k: string]: unknown } | null> {
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const r = await fetch(buildUrl(series, key, params, opts.extra ?? ''), { cache: 'no-store', signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

/** 숫자 관측치만(결측 '.'·NaN 제거) — 실패는 빈 배열(호출부 관례) */
export async function fredObservations(series: string, params: FredParams = {}, opts: { extra?: string; timeoutMs?: number } = {}): Promise<FredObs[]> {
  const j = await fredRaw(series, params, opts)
  return (j?.observations ?? [])
    .map(o => ({ date: String(o.date), v: parseFloat(o.value) }))
    .filter(o => Number.isFinite(o.v))
}
