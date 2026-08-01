// 💰 현금 포지션 SSOT — 학생이 등록한 현금(원화·달러) vs 자산 평가액 → 실제 현금 비중
//    현금은 앱이 알아낼 원천이 없는 유일한 자산이라 직접 입력(Zero-Input 원칙의 명시적 예외).
//    평가액은 기존 SSOT 재사용(stock-price 배치 40청크 + currency 환산 + 라이브 실패 시 원가 폴백 — ai-rebalance 0% 붕괴 교훈).
//    ⛔ "현금 늘려라/줄여라" 지시 아님 — 막스 권장 밴드 대비 위치 관측만.

export interface CashInput { krw: number; usd: number; memo?: string | null; updatedAt?: string | null }

export interface CashPosition {
  krw: number
  usd: number
  cashKrw: number            // 현금 합계(원화 환산)
  assetKrw: number           // 주식·ETF·코인 평가액(원화)
  totalKrw: number
  cashPct: number            // 현금 비중 %
  usdKrw: number
  priceOk: number            // 라이브 가격 성공 종목수
  costFallback: number       // 원가 폴백 종목수(정직 표기)
  memo: string | null
  updatedAt: string | null
  band: { min: number; max: number } | null       // 막스 권장 현금 밴드(marks-cycle SSOT)
  temp: number | null                              // 막스 탐욕 온도
  verdict: 'aggressive' | 'inband' | 'defensive' | null   // 밴드 대비 위치
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 막스 온도 → 권장 현금 밴드 (브리핑·MarksCycle과 동일 관례 — 여기가 SSOT) */
export function cashBandOf(temp: number): { min: number; max: number } {
  if (temp >= 75) return { min: 30, max: 40 }
  if (temp >= 58) return { min: 20, max: 30 }
  if (temp >= 42) return { min: 15, max: 25 }
  if (temp >= 25) return { min: 10, max: 20 }
  return { min: 10, max: 15 }
}

/** 보유 자산 평가액(원화) — 라이브 가격 우선·실패 시 원가 폴백 */
export async function evaluateAssets(rows: any[], base: string, usdKrw: number): Promise<{ assetKrw: number; priceOk: number; costFallback: number }> {
  const priceMap = new Map<string, { price: number; krw: boolean }>()
  for (let i = 0; i < rows.length; i += 40) {
    try {
      const chunk = rows.slice(i, i + 40)
      const pr = await fetch(`${base}/api/stock-price`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(h => ({ ticker: h.ticker, market: h.market ?? 'US' }))),
        signal: AbortSignal.timeout(30_000),
      })
      if (pr.ok) {
        const arr = await pr.json() as Array<{ ticker: string; currentPrice: number; currency: string }>
        for (const d of arr) priceMap.set(String(d.ticker).toUpperCase(), { price: Number(d.currentPrice) || 0, krw: d.currency === 'KRW' })
      }
    } catch { /* graceful — 해당 청크는 원가 폴백 */ }
  }
  let assetKrw = 0, priceOk = 0, costFallback = 0
  for (const h of rows) {
    const qty = Number(h.quantity) || 0
    if (qty <= 0) continue
    const pm = priceMap.get(String(h.ticker).toUpperCase())
    if (pm && pm.price > 0) {
      assetKrw += pm.price * qty * (pm.krw ? 1 : usdKrw)   // currency 기준 환산(크립토 KRW 폭증 방지)
      priceOk++
    } else {
      const isKrw = h.currency ? h.currency === 'KRW' : (h.market === 'KR')
      assetKrw += (Number(h.purchase_price) || 0) * qty * (isKrw ? 1 : usdKrw)
      costFallback++
    }
  }
  return { assetKrw, priceOk, costFallback }
}

export function buildCashPosition(
  cash: CashInput,
  assets: { assetKrw: number; priceOk: number; costFallback: number },
  usdKrw: number,
  temp: number | null,
): CashPosition {
  const krw = Number(cash.krw) || 0
  const usd = Number(cash.usd) || 0
  const cashKrw = krw + usd * usdKrw
  const totalKrw = assets.assetKrw + cashKrw
  const cashPct = totalKrw > 0 ? Math.round((cashKrw / totalKrw) * 1000) / 10 : 0
  const band = temp != null ? cashBandOf(temp) : null
  const verdict: CashPosition['verdict'] = band == null ? null
    : cashPct < band.min ? 'aggressive'
    : cashPct > band.max ? 'defensive'
    : 'inband'
  return {
    krw, usd, cashKrw: Math.round(cashKrw), assetKrw: Math.round(assets.assetKrw), totalKrw: Math.round(totalKrw),
    cashPct, usdKrw, priceOk: assets.priceOk, costFallback: assets.costFallback,
    memo: cash.memo ?? null, updatedAt: cash.updatedAt ?? null, band, temp, verdict,
  }
}
