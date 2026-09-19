// 🇺🇸 ETF 자금 흐름 API — 스냅샷 역산 순유입 + 캔들 SSOT 거래량·등락. 6h 캐시 · refresh=1(크론 10:30 UTC)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildEtfFlow, ETF_FLOW_KEY, type EtfFlow } from '@/lib/etfFlow'
import { getUsdKrw } from '@/lib/fx'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh') === '1'
  const key = ETF_FLOW_KEY(kstDate())
  if (!refresh) { const c = await getCache<EtfFlow>(key, 6 * 3600_000); if (c) return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store' } }) }
  const usdKrw = await getUsdKrw(url.origin).catch(() => null)
  const out = await buildEtfFlow(usdKrw)
  if (out.items.length >= 30) await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
