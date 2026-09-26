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

/** alternative.me 응답 → 기간값. 인덱스 0·1·7·30 = 오늘·어제·7일 전·30일 전(원천이 하루 1행). 없으면 null */
export function parseFng(json: unknown): CryptoFng | null {
  const data = (json as { data?: unknown } | null)?.data
  if (!Array.isArray(data) || data.length === 0) return null
  const at = (i: number) => data[i] as { value?: unknown; value_classification?: unknown; timestamp?: unknown } | undefined
  const now = toNum(at(0)?.value)
  if (now == null) return null
  const cls = at(0)?.value_classification
  return {
    now,
    yesterday: toNum(at(1)?.value),
    weekAgo: toNum(at(7)?.value),
    monthAgo: toNum(at(30)?.value),
    cls: typeof cls === 'string' ? cls : null,
    date: kstDate(at(0)?.timestamp),
  }
}

export async function fetchCryptoFng(limit = 31): Promise<CryptoFng | null> {
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
