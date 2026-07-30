/**
 * GET /api/country-vol
 * 🌪️ 국가별 시장 변동성 — 지수 실현변동성·자국 5년 백분위·급변동일(사이드카/서킷브레이커 프록시)
 *   계산은 lib/countryVol.ts(SSOT)·6h 캐시. 공개(인증 불필요) — 종목 배지·매매 플랜 갭 경고·전용 패널 공용.
 *   ⛔ 추천 점수·선정에 미반영(리스크 맥락 레이어).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { computeCountryVol } from '@/lib/countryVol'

export async function GET() {
  const r = await computeCountryVol()
  if (!r) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
