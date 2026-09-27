/**
 * GET /api/exchange-rate
 * 환율 조회 (1시간 서버 캐시). `rate` = USD→KRW(하위호환) + `rates` = 통화별 →KRW 맵(🇪🇺 유럽 종목 매매 플랜 ₩ 환산용)
 *
 * 1순위: **하나은행 매매기준율(네이버 고시)** — 전 통화 같은 회차(`fxHana.ts`). source='hana' + noticeDate(고시일)·noticeRound(회차)
 *        (2026-09-27 사용자 결정: 학생 홈에 앱 환율 1,361 과 하나은행 카드 1,359 가 함께 떠 헷갈렸다 → 앱 기준을 하나은행으로)
 * 2순위: jsdelivr currency-api (무료, USD→전통화 → 크로스 레이트로 EUR/CHF/GBP…→KRW 도출)
 * 3순위: exchangerate-api.com fallback
 * 4순위: **마지막 성공 환율**(app_cache, 30일) — 어제 실제 환율이 몇 달 전 상수보다 항상 낫다
 * 5순위: 상수(최후) — 이 값이 쓰였다면 source='stale-constant' 로 소비측이 알 수 있다
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
import { fetchHanaFx, FX_NEED } from '@/lib/fxHana'

export const revalidate = 3600   // 1시간 ISR 캐시

const LAST_KEY = 'fx-last-good-v1'   // 마지막 성공 환율(전 통화 맵, 하나은행이면 고시일까지) — 외부 원천이 모두 죽은 날의 폴백

// 매매 플랜에서 쓰는 통화(우리 유니버스: KR·US·유럽·🇯🇵일본·🇨🇳중국 접미사 통화). GBp(펜스)는 소비측에서 GBP÷100 처리
//   목록은 fxHana 가 들고 있다 — 원천 감시(verify-market-board-sources)가 같은 목록을 본다
const NEED = FX_NEED

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

/** 2순위 원천 — 실패는 null(throw 하지 않는다: 1순위가 성공하면 이 결과는 버려지므로 거부가 새면 안 된다) */
async function fetchFawaz(): Promise<{ rate: number; rates: Record<string, number> } | null> {
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) return null
    const usd = (await res.json())?.usd
    return usd && typeof usd.krw === 'number' && usd.krw > 0 ? { rate: usd.krw, rates: crossFromUsdBase(usd) } : null
  } catch { return null }
}

export async function GET() {
  // ⏱ 원천마다 3초 — 소비측은 이 라우트를 8초 타임아웃으로 부른다. 외부가 매달리면 last-good 에 닿기 전에 소비측이 먼저 끊고 상수로 떨어진다.
  //    그래서 2순위(fawaz)는 1순위와 **동시에** 출발시킨다 — 원천이 셋이 돼도 최악 대기는 전과 같은 3초 + 3초.
  const fawazP = fetchFawaz()

  // ── 1순위: 하나은행 매매기준율(네이버) ─────────────────────────
  const hana = await fetchHanaFx(NEED, 3000)
  if (hana) {
    const { rate, rates, noticeDate, noticeRound } = hana
    await setCache(LAST_KEY, { rate, rates, noticeDate })   // 성공값 보존 — 다음 장애의 폴백
    return NextResponse.json({ rate, rates, source: 'hana', noticeDate, noticeRound, updatedAt: new Date().toISOString() })
  }

  // ── 2순위: fawazahmed0/currency-api ────────────────────────────
  const fz = await fawazP
  if (fz) {
    await setCache(LAST_KEY, fz)
    return NextResponse.json({ ...fz, source: 'fawazahmed0', updatedAt: new Date().toISOString() })
  }

  // ── 3순위: exchangerate-api.com (USD 베이스 → 동일 크로스) ──────
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) })
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

  // ── 4순위: 마지막 성공 환율(30일) — 며칠 된 실제 환율이 몇 달 된 상수보다 항상 정확하다 ──
  const last = await getCache<{ rate: number; rates: Record<string, number> }>(LAST_KEY, 30 * 86_400_000)
  if (last && typeof last.rate === 'number' && last.rate > 500) {
    return NextResponse.json({ ...last, source: 'last-good', updatedAt: new Date().toISOString() })
  }

  // ── 5순위: 상수(최후) — source 로 소비측이 '이건 오래된 값'임을 알 수 있다 ──
  return NextResponse.json({ rate: USD_KRW_FALLBACK, rates: { USD: USD_KRW_FALLBACK, KRW: 1 }, source: 'stale-constant', updatedAt: new Date().toISOString() })
}
