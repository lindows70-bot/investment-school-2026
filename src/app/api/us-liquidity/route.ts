// 🇺🇸 미국 유동성 한 화면 API — 기존 SSOT(매크로 날씨·수익률곡선·매크로 국면·4계절) 조립 + FRED 대출태도. 6h 캐시 · refresh=1
import { NextResponse } from 'next/server'
import { getUsLiquidity } from '@/lib/usLiquidity'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const url = new URL(req.url)
  const out = await getUsLiquidity(url.origin, url.searchParams.get('refresh') === '1')
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
