/**
 * GET /api/exchange-rate
 * 환율 조회 (1시간 서버 캐시). `rate` = USD→KRW(하위호환) + `rates` = 통화별 →KRW 맵(🇪🇺 유럽 종목 매매 플랜 ₩ 환산용)
 *
 * 1순위: jsdelivr currency-api (무료, USD→전통화 → 크로스 레이트로 EUR/CHF/GBP…→KRW 도출, 추가 fetch 0)
 * 2순위: exchangerate-api.com fallback
 * 3순위: 기본값 1,350
 */

// 빌드 시 정적 생성 금지 — 무거운 외부 fetch가 빌드 타임아웃을 내고(2026-08-01 실측: SEC·Yahoo 지연으로 빌드 실패) 데이터가 빌드 시점에 박제된다
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export const revalidate = 3600   // 1시간 ISR 캐시

// 매매 플랜에서 쓰는 통화(우리 유니버스: KR·US·유럽·🇯🇵일본·🇨🇳중국 접미사 통화). GBp(펜스)는 소비측에서 GBP÷100 처리
const NEED = ['EUR', 'CHF', 'GBP', 'HKD', 'DKK', 'SEK', 'JPY', 'CNY'] as const

// currency-api usd.json({ usd: { krw, eur, chf, ... } }) → { USD:krw, EUR:krw/eur, ... } (각 통화 1단위당 KRW)
function crossFromUsdBase(usd: Record<string, number>): Record<string, number> {
  const krw = usd.krw
  const rates: Record<string, number> = { USD: krw, KRW: 1 }
  for (const code of NEED) {
    const per = usd[code.toLowerCase()]
    if (typeof per === 'number' && per > 0) rates[code] = krw / per
  }
  return rates
}

export async function GET() {
  // ── 1순위: fawazahmed0/currency-api ────────────────────────────
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      { next: { revalidate: 3600 } }
    )
    if (res.ok) {
      const data = await res.json()
      const usd = data?.usd
      if (usd && typeof usd.krw === 'number' && usd.krw > 0) {
        return NextResponse.json({ rate: usd.krw, rates: crossFromUsdBase(usd), source: 'fawazahmed0', updatedAt: new Date().toISOString() })
      }
    }
  } catch { /* 다음 소스 시도 */ }

  // ── 2순위: exchangerate-api.com (USD 베이스 → 동일 크로스) ──────
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      const r = data?.rates
      if (r && typeof r.KRW === 'number' && r.KRW > 0) {
        const rates: Record<string, number> = { USD: r.KRW, KRW: 1 }
        for (const code of NEED) if (typeof r[code] === 'number' && r[code] > 0) rates[code] = r.KRW / r[code]
        return NextResponse.json({ rate: r.KRW, rates, source: 'exchangerate-api', updatedAt: new Date().toISOString() })
      }
    }
  } catch { /* 다음 소스 시도 */ }

  // ── 3순위: 기본값(USD만) ────────────────────────────────────────
  return NextResponse.json({ rate: 1_350, rates: { USD: 1_350, KRW: 1 }, source: 'fallback', updatedAt: new Date().toISOString() })
}
