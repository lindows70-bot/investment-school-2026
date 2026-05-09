/**
 * GET /api/exchange-rate
 * USD → KRW 환율 조회 (1시간 서버 캐시)
 *
 * 1순위: jsdelivr currency-api (무료, 인증 불필요)
 * 2순위: exchangerate-api.com fallback
 * 3순위: 기본값 1,350
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600   // 1시간 ISR 캐시

export async function GET() {
  // ── 1순위: fawazahmed0/currency-api ────────────────────────────
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      { next: { revalidate: 3600 } }
    )
    if (res.ok) {
      const data = await res.json()
      const rate = data?.usd?.krw
      if (typeof rate === 'number' && rate > 0) {
        return NextResponse.json({
          rate,
          source:    'fawazahmed0',
          updatedAt: new Date().toISOString(),
        })
      }
    }
  } catch { /* 다음 소스 시도 */ }

  // ── 2순위: exchangerate-api.com ────────────────────────────────
  try {
    const res = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD',
      { next: { revalidate: 3600 } }
    )
    if (res.ok) {
      const data = await res.json()
      const rate = data?.rates?.KRW
      if (typeof rate === 'number' && rate > 0) {
        return NextResponse.json({
          rate,
          source:    'exchangerate-api',
          updatedAt: new Date().toISOString(),
        })
      }
    }
  } catch { /* 다음 소스 시도 */ }

  // ── 3순위: 기본값 ───────────────────────────────────────────────
  return NextResponse.json({
    rate:      1_350,
    source:    'fallback',
    updatedAt: new Date().toISOString(),
  })
}
