/**
 * GET /api/exchange-rate
 * 환율 조회 (1시간 서버 캐시). `rate` = USD→KRW(하위호환) + `rates` = 통화별 →KRW 맵(🇪🇺 유럽 종목 매매 플랜 ₩ 환산용)
 *
 * 1순위: jsdelivr currency-api (무료, USD→전통화 → 크로스 레이트로 EUR/CHF/GBP…→KRW 도출, 추가 fetch 0)
 * 2순위: exchangerate-api.com fallback
 * 3순위: **마지막 성공 환율**(app_cache, 30일) — 어제 실제 환율이 몇 달 전 상수보다 항상 낫다
 * 4순위: 상수(최후) — 이 값이 쓰였다면 source='stale-constant' 로 소비측이 알 수 있다
 *
 * ⚠️ 왜 캐시 폴백을 넣었나(2026-08-08): 상수 1,350 이 실제 1,407 대비 4.1% 과소였고,
 *    같은 앱 안에서 1350/1380 두 폴백이 갈라져 화면마다 다른 환율이 쓰일 수 있었다.
 *    상수를 갱신하는 건 시간이 지나면 또 틀린다 — 마지막 성공값을 쓰면 오차가 '조회 실패 기간'만큼만 쌓인다.
 */

// 빌드 시 정적 생성 금지 — 무거운 외부 fetch가 빌드 타임아웃을 내고(2026-08-01 실측: SEC·Yahoo 지연으로 빌드 실패) 데이터가 빌드 시점에 박제된다
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { USD_KRW_FALLBACK } from '@/lib/fx'

export const revalidate = 3600   // 1시간 ISR 캐시

const LAST_KEY = 'fx-last-good-v1'   // 마지막 성공 환율(전 통화 맵) — 외부 소스 2곳이 모두 죽은 날의 폴백

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
        const rates = crossFromUsdBase(usd)
        await setCache(LAST_KEY, { rate: usd.krw, rates })   // 성공값 보존 — 다음 장애의 폴백
        return NextResponse.json({ rate: usd.krw, rates, source: 'fawazahmed0', updatedAt: new Date().toISOString() })
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
        await setCache(LAST_KEY, { rate: r.KRW, rates })
        return NextResponse.json({ rate: r.KRW, rates, source: 'exchangerate-api', updatedAt: new Date().toISOString() })
      }
    }
  } catch { /* 다음 소스 시도 */ }

  // ── 3순위: 마지막 성공 환율(30일) — 며칠 된 실제 환율이 몇 달 된 상수보다 항상 정확하다 ──
  const last = await getCache<{ rate: number; rates: Record<string, number> }>(LAST_KEY, 30 * 86_400_000)
  if (last && typeof last.rate === 'number' && last.rate > 500) {
    return NextResponse.json({ ...last, source: 'last-good', updatedAt: new Date().toISOString() })
  }

  // ── 4순위: 상수(최후) — source 로 소비측이 '이건 오래된 값'임을 알 수 있다 ──
  return NextResponse.json({ rate: USD_KRW_FALLBACK, rates: { USD: USD_KRW_FALLBACK, KRW: 1 }, source: 'stale-constant', updatedAt: new Date().toISOString() })
}
