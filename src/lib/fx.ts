// 💱 환율 SSOT 헬퍼 — 서버 라우트가 원/달러 환산에 쓸 라이브 환율(/api/exchange-rate).
//    ⚠️ 제1원칙: USD_KRW 상수를 코드에 박으면 환율이 움직이는 순간 거짓말이 된다
//    (2026-08-01 실측: 하드코딩 1,350 vs 실제 1,445 = 7% 과소 표기 → 같은 화면의 현금 포지션 카드와 수치가 어긋남).
//    폴백은 조회 실패 시에만 쓰고, 값이 폴백인지 라이브인지 호출부가 알 필요가 있으면 fetchUsdKrw를 쓴다.
export const USD_KRW_FALLBACK = 1350

/** 라이브 환율(실패 시 폴백) */
export async function getUsdKrw(base: string, timeoutMs = 8000): Promise<number> {
  return (await fetchUsdKrw(base, timeoutMs)).rate
}

/** 라이브 환율 + 출처(폴백 여부) */
export async function fetchUsdKrw(base: string, timeoutMs = 8000): Promise<{ rate: number; live: boolean }> {
  try {
    const r = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (r.ok) {
      const j = await r.json()
      if (typeof j?.rate === 'number' && j.rate > 500) return { rate: j.rate, live: true }
    }
  } catch { /* 폴백 */ }
  return { rate: USD_KRW_FALLBACK, live: false }
}
