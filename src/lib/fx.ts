// 💱 환율 SSOT 헬퍼 — 서버 라우트가 원/달러 환산에 쓸 라이브 환율(/api/exchange-rate).
//    ⚠️ 제1원칙: USD_KRW 상수를 코드에 박으면 환율이 움직이는 순간 거짓말이 된다
//    (2026-08-01 실측: 하드코딩 1,350 vs 실제 1,445 = 7% 과소 표기 → 같은 화면의 현금 포지션 카드와 수치가 어긋남).
//    폴백은 조회 실패 시에만 쓰고, 값이 폴백인지 라이브인지 호출부가 알 필요가 있으면 fetchUsdKrw를 쓴다.
//    ⚠️ 이 상수는 **최후 수단**이다 — /api/exchange-rate 가 외부 2소스 실패 시 '마지막 성공 환율'(app_cache 30일)을
//       먼저 쓰므로, 여기까지 내려오는 건 앱이 30일 넘게 환율을 한 번도 못 받은 경우뿐이다.
//       ⛔ 클라이언트도 자체 숫자(1380 등)를 쓰지 말고 이 상수를 import 하라 — 화면마다 환율이 다르면 같은 종목의
//          원화 환산액이 표마다 어긋난다(실측 2026-08-08: 1350 vs 1380 이 6파일에 공존).
export const USD_KRW_FALLBACK = 1400

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
