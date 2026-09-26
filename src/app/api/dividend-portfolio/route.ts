/**
 * GET /api/dividend-portfolio
 *
 * 💵 배당 인컴 랩 — 배당 종목 유니버스(US+KR) 배당 프로필 배치 + 환율(USDKRW).
 *   포트폴리오 배분·월배당·미래 프로젝션 계산은 클라이언트에서(슬라이더 즉시 반응).
 *   per-ticker 캐시(dividendProfile.DIV_PROFILE_KEY)를 익스플로러와 공유(제2원칙 — 키는 상수 SSOT).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { fetchUsdKrw } from '@/lib/fx'   // 💱 환율 SSOT — 예전엔 야후 KRW=X 를 직접 받아 다른 화면과 환율이 갈렸다(제2원칙)
import { getCache, setCache } from '@/lib/appCache'
import { getDividendProfile, DIV_PROFILE_KEY, type DividendProfile } from '@/lib/dividendProfile'
import { DIVIDEND_UNIVERSE } from '@/lib/dividendUniverse'

export interface DividendPortfolioData {
  status: 'ok' | 'error'
  stocks: DividendProfile[]
  usdKrw: number
  /** 이번 환율이 실제 환율인가(fx.ts readUsdKrw). 저장본은 live 일 때만 쓰이므로 true — 이 필드가 없는 옛 저장본(야후 환율)은 읽지 않는다 */
  fxLive?: boolean
  asOf: string
}

export async function GET(req: Request) {
  const cacheKey = 'dividend-portfolio-v2'   // 🗓️ 날짜 없는 키 + 오늘(KST)만(옛 키는 UTC 날짜였다) — 날짜 키는 영구 누적 · v2: 프로필에 preferred 필드 추가(DIV_PROFILE_KEY v8→v9와 함께 범프)
  const cached = await getCache<DividendPortfolioData>(cacheKey, 12 * 3600_000, { sameKstDay: true })
  // fxLive 가 없는 저장본 = 야후 환율로 만든 옛 문서 → 읽지 않고 같은 키에 새로 쓴다(키 범프와 같은 효과 · 정리 규칙 UNDATED('dividend-portfolio-v2') 유지)
  if (cached?.fxLive === true) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const [fx, stocks] = await Promise.all([
    fetchUsdKrw(base),
    // 동시성 6으로 유니버스 배치 — per-ticker 캐시(익스플로러와 공유) 우선
    (async () => {
      const out: DividendProfile[] = []
      const queue = [...DIVIDEND_UNIVERSE]
      await Promise.all(Array.from({ length: 6 }, async () => {
        for (; ;) {
          const u = queue.shift(); if (!u) break
          const pk = DIV_PROFILE_KEY(u.ticker, u.market)   // 키는 SSOT — writer(익스플로러)와 어긋나면 옛 값을 읽는다
          let p = await getCache<DividendProfile>(pk, 48 * 3600_000)
          if (!p) {
            p = await getDividendProfile(u.ticker, u.market)
            if (p.dividendYield != null || p.payoutRatio != null) await setCache(pk, p)
          }
          out.push(p)
        }
      }))
      return out
    })(),
  ])

  const okCount = stocks.filter(s => s.dividendYield != null).length
  const usdKrw = Math.round(fx.rate * 100) / 100   // 표기 자릿수는 예전과 같게(소수 둘째 자리) — 이 값은 표기 전용
  const result: DividendPortfolioData = { status: okCount >= 10 ? 'ok' : 'error', stocks, usdKrw, fxLive: fx.live, asOf: new Date().toISOString() }
  if (okCount >= 10 && fx.live) await setCache(cacheKey, result)   // 절반 이상 성공 + 실제 환율일 때만 캐시(부분 실패 박제 방지)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
