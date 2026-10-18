// 업비트 공개 API 공용 fetcher — 7곳(stock-price·stock-info·coin-lab·market-catalyst·stock-price-history·monthlyPnl·upbitMarket)이 각자 부르던 것을 하나로(2026-10-18 6차 점검).
//   ⚠️ 업비트 시세 API 는 IP 당 초당 10회(그룹별). 한 곳(stock-price)만 간격을 벌리고 429 를 재시도했고 나머지는 그냥 불렀다 —
//   같은 인스턴스에서 코인 4종 차트 + 홈 시세가 겹치면 429 가 났다(2026-09-29 /s/coin 실측: 4종 중 2종 직선). 여기서 전부 같은 줄에 세운다.
//   ①호출 시작 간격 120ms(초당 약 8회) ②429 면 1초 뒤 한 번 더 ③Accept JSON · no-store · 타임아웃. 실패는 호출부 관례대로 Response/null.
const BASE = 'https://api.upbit.com/v1'
const GAP_MS = 120
let nextAt = 0

/** 경로+쿼리(`/ticker?markets=KRW-BTC`) → Response. 네트워크 오류는 throw(호출부가 try 로 받는다) */
export async function upbitFetch(pathAndQuery: string, opts: { timeoutMs?: number; retry?: boolean } = {}): Promise<Response> {
  const { timeoutMs = 10_000, retry = true } = opts
  const now = Date.now()
  const wait = Math.max(0, nextAt - now)
  nextAt = Math.max(now, nextAt) + GAP_MS
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  const res = await fetch(`${BASE}${pathAndQuery}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  if (res.status === 429 && retry) {
    await new Promise(r => setTimeout(r, 1000))
    return upbitFetch(pathAndQuery, { timeoutMs, retry: false })
  }
  return res
}

/** JSON 으로 — HTTP 오류·네트워크 오류·비배열은 null(빈 배열과 구분: 빈 배열은 '거래 없음') */
export async function upbitJson<T = unknown>(pathAndQuery: string, opts: { timeoutMs?: number } = {}): Promise<T | null> {
  try {
    const r = await upbitFetch(pathAndQuery, opts)
    if (!r.ok) return null
    return await r.json() as T
  } catch { return null }
}

/** 티커 → 업비트 마켓 코드(XRP → KRW-XRP · 이미 KRW- 면 그대로) */
export const upbitMarketOf = (ticker: string) => `KRW-${ticker.toUpperCase().replace(/^KRW-/, '')}`
