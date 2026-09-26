// 코인 공포·탐욕 지수(alternative.me)를 지금·어제·1주 전·1달 전 값으로 읽는 공개 데이터 lib
//   원천 실측(2026-09-26): data 는 최신순, value 는 문자열 정수, timestamp 는 유닉스 '초'(UTC 자정 = 그날 기준일)

export interface CryptoFng {
  now: number | null
  yesterday: number | null
  weekAgo: number | null
  monthAgo: number | null
  cls: string | null    // 원천 분류(value_classification) — 번역은 화면에서
  date: string | null   // data[0] 기준일(KST 'YYYY-MM-DD')
}

const toNum = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

const kstDate = (ts: unknown): string | null => {
  const sec = toNum(ts)
  if (sec == null) return null
  return new Date((sec + 9 * 3600) * 1000).toISOString().slice(0, 10)
}

const DAY = 86400

/** alternative.me 응답 → 기간값. 어제·1주·1달 전은 줄 번호가 아니라 '날짜'로 찾는다 —
 *  원천 이력에 빠진 날이 실제로 있어(2024-10-26 등) data[7] 이 8일 전이 될 수 있다(CPI 인덱스 산술 사고와 같은 모양).
 *  정확히 그날이 없으면 이웃 날로 메우지 않고 null. */
export function parseFng(json: unknown): CryptoFng | null {
  const data = (json as { data?: unknown } | null)?.data
  if (!Array.isArray(data) || data.length === 0) return null
  type Row = { value?: unknown; value_classification?: unknown; timestamp?: unknown }
  const first = data[0] as Row | undefined
  const now = toNum(first?.value)
  if (now == null) return null
  const byTs = new Map<number, number | null>()
  data.forEach((row: Row | undefined) => {
    const ts = toNum(row?.timestamp)
    if (ts != null && !byTs.has(ts)) byTs.set(ts, toNum(row?.value))
  })
  const ts0 = toNum(first?.timestamp)
  const daysAgo = (n: number): number | null => (ts0 == null ? null : byTs.get(ts0 - n * DAY) ?? null)
  const cls = first?.value_classification
  return {
    now,
    yesterday: daysAgo(1),
    weekAgo: daysAgo(7),
    monthAgo: daysAgo(30),
    cls: typeof cls === 'string' ? cls : null,
    date: kstDate(first?.timestamp),
  }
}

/** limit 40 — 빠진 날이 한두 개 있어도 30일 전 행이 받은 범위 안에 들도록 여유를 둔다 */
export async function fetchCryptoFng(limit = 40): Promise<CryptoFng | null> {
  try {
    const r = await fetch(`https://api.alternative.me/fng/?limit=${limit}&format=json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    return parseFng(await r.json())
  } catch {
    return null
  }
}
