// 🇺🇸 ETF 자금 흐름 API — 스냅샷 역산 순유입 + 캔들 SSOT 거래량·등락. 6h 캐시 · refresh=1(크론 10:30 UTC)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildEtfFlow, ETF_FLOW_KEY, type EtfFlow } from '@/lib/etfFlow'
import { fetchUsdKrw } from '@/lib/fx'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh') === '1'
  const key = ETF_FLOW_KEY(kstDate())
  if (!refresh) { const c = await getCache<EtfFlow>(key, 6 * 3600_000); if (c) return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store' } }) }
  const { rate: usdKrw, live: fxLive } = await fetchUsdKrw(url.origin)
  const out = await buildEtfFlow(usdKrw)
  // 원화 환산(순유입 ○억원)이 고정 환율이면 박제하지 않는다 — 다음 요청이 실제 환율로 다시 만든다
  const cached = out.items.length >= 30 && fxLive
  if (cached) await setCache(key, out)
  // cached·fxLive 는 이번 응답에만(저장본 out 에는 없음 — 캐시 스키마 불변). 크론 로그에서 '돌았지만 저장 안 함'을 가른다
  return NextResponse.json({ ...out, cached, fxLive }, { headers: { 'Cache-Control': 'no-store' } })
}
