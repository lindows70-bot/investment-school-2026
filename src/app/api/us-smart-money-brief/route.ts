// 🇺🇸 미국 스마트머니 한 줄 요약 — 브리핑에 붙이는 **가벼운** 요약(캐시만 읽고 계산·외부 호출 0).
//    ⚠️ 브리핑은 이미 12개 라우트를 부른다(대시보드 42개 동시 호출 사고) → 무거운 3개를 각각 부르지 않고 여기서 한 번에.
//    캐시가 차갑면 그 사실을 그대로 돌려준다(없음 ≠ 못 불러옴).
import { NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'
import { INSIDER_MARKET_KEY } from '@/lib/insiderMarket'
import type { InsiderMarket } from '@/lib/insiderMarketShared'
import { US_LIQUIDITY_KEY, type UsLiquidity } from '@/lib/usLiquidity'
import { ANALYST_RERATING_KEY, type AnalystRerating } from '@/lib/analystRerating'
import { ETF_FLOW_KEY, type EtfFlow } from '@/lib/etfFlow'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

const kstDate = (off = 0) => new Date(Date.now() + 9 * 3600_000 - off * 86400_000).toISOString().slice(0, 10)
/** 오늘 캐시가 없으면 어제 것까지 본다(크론 직전 시간대) */
async function recent<T>(key: (d: string) => string, ttlMs: number): Promise<T | null> {
  return (await getCache<T>(key(kstDate(0)), ttlMs)) ?? (await getCache<T>(key(kstDate(1)), ttlMs))
}

export async function GET() {
  const [liq, ins, an, etf] = await Promise.all([
    recent<UsLiquidity>(US_LIQUIDITY_KEY, 36 * 3600_000),
    recent<InsiderMarket>(INSIDER_MARKET_KEY, 36 * 3600_000),
    recent<AnalystRerating>(ANALYST_RERATING_KEY, 36 * 3600_000),
    recent<EtfFlow>(ETF_FLOW_KEY, 36 * 3600_000),
  ])
  return NextResponse.json({
    weather: liq ? { emoji: liq.weather?.emoji ?? '', label: liq.weather?.label ?? '', answer: liq.answer } : null,
    insider: ins ? { clusters: ins.items.filter(i => i.cluster).length, total: ins.items.length, topSector: ins.sectors[0] ? `${ins.sectors[0].icon} ${ins.sectors[0].ko}` : null } : null,
    rerating: an ? { real: an.items.filter(i => i.verdict === 'rerating').length, down: an.items.filter(i => i.verdict === 'downgrade').length, top: an.items.find(i => i.verdict === 'rerating')?.name ?? null } : null,
    etf: etf ? { days: etf.daysCollected, hasFlow: etf.items.some(i => i.flow1w != null) } : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
