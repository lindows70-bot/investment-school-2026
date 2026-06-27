// 🧬 테마·섹터 분석 API — ?key=quantum|ai-semi → computeSector. 공개 6h 캐시(섹터별)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { computeSector, type SectorResult } from '@/lib/sectorEngine'
import { SECTORS } from '@/lib/sectorConfigs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? 'quantum'
  const cfg = SECTORS[key]
  if (!cfg) return NextResponse.json({ error: 'unknown_sector' }, { status: 400 })

  const cacheKey = `sector-v1:${key}:${kstDate()}`
  const cached = await getCache<SectorResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const result = await computeSector(cfg)
  // 핵심(앵커 시계열) 성공 시에만 캐시
  const anchorOk = result.stocks.find(s => s.ticker === cfg.anchor)?.spark?.length
  if (anchorOk && anchorOk > 10) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
