// 🇺🇸 애널리스트 리레이팅 API — 유니버스 미국 종목 + 내부자 통과 종목의 30일 등급 변경·EPS 리비전 스캔. 일별 캐시 · 07:10 KST 크론 refresh=1
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildAnalystRerating, ANALYST_RERATING_KEY, type AnalystRerating } from '@/lib/analystRerating'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh') === '1'
  const key = ANALYST_RERATING_KEY(kstDate())
  if (!refresh) { const c = await getCache<AnalystRerating>(key, 12 * 3600_000); if (c) return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store' } }) }
  const out = await buildAnalystRerating()
  if ('error' in out) return NextResponse.json(out, { status: 200 })
  if (out.okCount >= out.scanned * 0.7) await setCache(key, out)   // 부분실패 박제 금지
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
