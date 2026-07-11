// 🗺️ 서울 자치구 지도 요약 API — 캐시에 이미 수집된 실거래만으로 구별 평당가 히트맵(외부 API 콜 0 — data.go.kr 일 1,000콜 한도 보호)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'
import { LAWD_REGIONS, type AptDeal } from '@/lib/rtms'

export interface GuSummary {
  lawd: string; name: string
  pyeong: number | null   // 최근 3개월 매매 ㎡당 중위가 × 3.3058 = 평당가(억, 소수2)
  count: number            // 표본 거래 수
  cached: boolean          // 수집된 적 있는 구인지(false = 클릭 시 첫 수집)
}

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export async function GET() {
  const now = new Date(Date.now() + 9 * 3600_000)
  const yms: string[] = []
  for (let k = 0; k < 3; k++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1))
    yms.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const seoul = LAWD_REGIONS.filter(r => r.sido === '서울')
  const out: GuSummary[] = await Promise.all(seoul.map(async r => {
    const perArea: number[] = []
    let cached = false
    for (const ym of yms) {
      // 과거월 캐시 TTL(30일)보다 넉넉히 — 지도는 있는 캐시를 최대한 활용(재수집 안 함)
      const deals = await getCache<AptDeal[]>(`rtms-trade-v2:${r.lawd}:${ym}`, 45 * 86400_000).catch(() => null)
      if (!deals) continue
      cached = true
      for (const d of deals) if (d.price && d.area) perArea.push(d.price / d.area)
    }
    const pyeong = perArea.length >= 5 ? Math.round(med(perArea) * 3.3058 / 10000 * 100) / 100 : null
    return { lawd: r.lawd, name: r.name, pyeong, count: perArea.length, cached }
  }))
  return NextResponse.json({ regions: out, asOf: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
