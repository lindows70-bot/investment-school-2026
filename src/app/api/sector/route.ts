// 🧬 테마·섹터 분석 API — ?key=quantum|ai-semi → computeSector. 공개 6h 캐시(섹터별)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { computeSector, type SectorResult } from '@/lib/sectorEngine'
import { SECTORS, sectorCacheKey } from '@/lib/sectorConfigs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? 'quantum'
  const cfg = SECTORS[key]
  if (!cfg) return NextResponse.json({ error: 'unknown_sector' }, { status: 400 })

  // 🗓️ 날짜 없는 키 + 오늘(KST)만 — sector-rotation 의 loadSector 와 같은 키(둘을 함께 바꾼다)
  const cacheKey = sectorCacheKey(key) as string   // v3: hi52(52주 신고가 위치) 필드 추가 · 유니버스 지문 포함(키 SSOT = sectorConfigs)
  const cached = await getCache<SectorResult>(cacheKey, 6 * 3600_000, { sameKstDay: true })
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const result = await computeSector(cfg)
  // 핵심(앵커 시계열) 성공 시에만 캐시
  const anchorOk = result.stocks.find(s => s.ticker === cfg.anchor)?.spark?.length
  if (anchorOk && anchorOk > 10) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
