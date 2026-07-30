/**
 * GET /api/ultra-dividend
 *
 * 🔥 초고배당(초고위험) 유니버스 배당 프로필 배치 — 배당 인컴 랩 하단 섹션.
 *   계산은 lib/dividendProfile.ts(SSOT) 재사용 · per-ticker 캐시(div-explorer-v7:*) 익스플로러와 공유(제2원칙).
 *   커버드콜/옵션 ETF 중 Yahoo 분배율 0(YieldMax·Roundhill류)은 targetYield(운용사 목표·변동) 참고치로 대체 + estimated 플래그.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getDividendProfile, type DividendProfile } from '@/lib/dividendProfile'
import { ULTRA_UNIVERSE, type UltraTier } from '@/lib/ultraDividendUniverse'

export interface UltraDividendItem extends DividendProfile {
  tier: UltraTier
  sector: string
  ultraNote: string
  yieldEstimated: boolean   // 라이브 분배율 대신 운용사 목표치 사용(YieldMax류)
  targetLabel: string | null
}

export interface UltraDividendData {
  status: 'ok' | 'error'
  items: UltraDividendItem[]
  asOf: string
}

export async function GET() {
  const dateKey = new Date().toISOString().slice(0, 10)
  const cacheKey = `ultra-dividend-v3:${dateKey}`   // v3: 유니버스 확장(모기지리츠·BDC·MLP·YieldMax·KR커버드콜 추가)
  const cached = await getCache<UltraDividendData>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const items: UltraDividendItem[] = []
  const queue = [...ULTRA_UNIVERSE]
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (; ;) {
      const u = queue.shift(); if (!u) break
      const pk = `div-explorer-v7:${u.ticker}:${u.market}`
      let p = await getCache<DividendProfile>(pk, 48 * 3600_000)
      if (!p) {
        p = await getDividendProfile(u.ticker, u.market)
        if (p.dividendYield != null || p.payoutRatio != null) await setCache(pk, p)
      }
      // 라이브 분배율이 없거나 0인데 운용사 목표치가 있으면 참고치로 대체(YieldMax류)
      let yieldEstimated = false
      let dividendYield = p.dividendYield
      if ((dividendYield == null || dividendYield <= 0) && u.targetYield != null) {
        dividendYield = u.targetYield
        yieldEstimated = true
      }
      items.push({
        ...p,
        dividendYield,
        tier: u.tier,
        sector: u.sector,
        ultraNote: u.note,
        yieldEstimated,
        targetLabel: u.targetLabel ?? null,
      })
    }
  }))

  // 유니버스 순서 유지(config 순서)
  items.sort((a, b) => ULTRA_UNIVERSE.findIndex(u => u.ticker === a.ticker) - ULTRA_UNIVERSE.findIndex(u => u.ticker === b.ticker))
  const okCount = items.filter(s => s.dividendYield != null).length
  const result: UltraDividendData = { status: okCount >= 6 ? 'ok' : 'error', items, asOf: new Date().toISOString() }
  if (okCount >= 6) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
