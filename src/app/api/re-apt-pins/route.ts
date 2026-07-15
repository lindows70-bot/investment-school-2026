// 🗺️ 서울 단지 핀 API — 서울시 공동주택 마스터(OpenAptInfo·좌표)에서 선택 구의 세대수 상위 단지 핀 반환(7일 캐시 재사용·외부 콜 0에 수렴)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { LAWD_REGIONS } from '@/lib/rtms'
import { getSeoulAptMaster } from '@/lib/seoulApt'

export interface AptPin { name: string; dong: string; lng: number; lat: number; hh: number | null; aprv: string | null }

export async function GET(req: Request) {
  const lawd = (new URL(req.url).searchParams.get('lawd') ?? '').trim()
  const region = LAWD_REGIONS.find(r => r.lawd === lawd && r.sido === '서울')
  if (!region) return NextResponse.json({ pins: [] }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    const master = await getSeoulAptMaster()
    const pins: AptPin[] = master
      .filter(m => m.gu === region.name)
      .sort((a, b) => (b.hh ?? 0) - (a.hh ?? 0))
      .slice(0, 18)
      .map(m => ({ name: m.name, dong: m.dong, lng: m.lng, lat: m.lat, hh: m.hh, aprv: m.aprv }))
    return NextResponse.json({ pins, gu: region.name }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ pins: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
