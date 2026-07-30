/**
 * GET /api/dividend-portfolio
 *
 * 💵 배당 인컴 랩 — 배당 종목 유니버스(US+KR) 배당 프로필 배치 + 환율(USDKRW).
 *   포트폴리오 배분·월배당·미래 프로젝션 계산은 클라이언트에서(슬라이더 즉시 반응).
 *   per-ticker 캐시(div-explorer-v7:*)를 익스플로러와 공유(제2원칙).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getDividendProfile, type DividendProfile } from '@/lib/dividendProfile'
import { DIVIDEND_UNIVERSE } from '@/lib/dividendUniverse'

export interface DividendPortfolioData {
  status: 'ok' | 'error'
  stocks: DividendProfile[]
  usdKrw: number
  asOf: string
}

async function fetchUsdKrw(): Promise<number> {
  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
    const q = await yf.quote('KRW=X')
    const r = q?.regularMarketPrice
    if (typeof r === 'number' && r > 500 && r < 3000) return Math.round(r * 100) / 100
  } catch { /* 폴백 */ }
  return 1380
}

export async function GET() {
  const dateKey = new Date().toISOString().slice(0, 10)
  const cacheKey = `dividend-portfolio-v1:${dateKey}`
  const cached = await getCache<DividendPortfolioData>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [usdKrw, stocks] = await Promise.all([
    fetchUsdKrw(),
    // 동시성 6으로 유니버스 배치 — per-ticker 캐시(익스플로러와 공유) 우선
    (async () => {
      const out: DividendProfile[] = []
      const queue = [...DIVIDEND_UNIVERSE]
      await Promise.all(Array.from({ length: 6 }, async () => {
        for (; ;) {
          const u = queue.shift(); if (!u) break
          const pk = `div-explorer-v7:${u.ticker}:${u.market}`
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
  const result: DividendPortfolioData = { status: okCount >= 10 ? 'ok' : 'error', stocks, usdKrw, asOf: new Date().toISOString() }
  if (okCount >= 10) await setCache(cacheKey, result)   // 절반 이상 성공 시만 캐시(부분 실패 박제 방지)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
