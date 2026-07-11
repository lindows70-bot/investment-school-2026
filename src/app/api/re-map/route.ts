// 🗺️ 서울 자치구 지도 요약 API — 캐시에 이미 수집된 실거래만으로 구별 평당가 히트맵(외부 API 콜 0 — data.go.kr 일 1,000콜 한도 보호)
// ⚠️ 키별 getCache 75회 병렬은 서버리스에서 일부가 조용히 실패(강남만 성공) → 단일 in() 일괄 조회로 설계
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

  // 필요한 키 75개를 한 번에 조회(graceful — 실패 시 전 구 미수집 표시)
  const byKey = new Map<string, AptDeal[]>()
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && svc) {
      const db = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
      const keys = seoul.flatMap(r => yms.map(ym => `rtms-trade-v2:${r.lawd}:${ym}`))
      const { data } = await db.from('app_cache').select('key, payload').in('key', keys)
      for (const row of data ?? []) if (Array.isArray(row.payload)) byKey.set(row.key as string, row.payload as AptDeal[])
    }
  } catch { /* graceful */ }

  const out: GuSummary[] = seoul.map(r => {
    const perArea: number[] = []
    let cached = false
    for (const ym of yms) {
      const deals = byKey.get(`rtms-trade-v2:${r.lawd}:${ym}`)
      if (!deals) continue
      cached = true
      for (const d of deals) if (d.price && d.area) perArea.push(d.price / d.area)
    }
    const pyeong = perArea.length >= 5 ? Math.round(med(perArea) * 3.3058 / 10000 * 100) / 100 : null
    return { lawd: r.lawd, name: r.name, pyeong, count: perArea.length, cached }
  })
  return NextResponse.json({ regions: out, asOf: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
