// 🗺️ 서울 단지 핀 API — 서울시 공동주택 마스터(OpenAptInfo·좌표) × 최근 12개월 실거래 캐시 조인
//    조인 이유: 마스터엔 재건축 멸실 단지(개포주공1단지)·통합 표기(압구정현대아파트) 잔존 → 거래 있는 단지만 핀 + 클릭 시 정확한 RTMS 그룹 키 전달.
//    외부 콜 0(마스터 7일 캐시 + 거래 월별 캐시 재사용 — data.go.kr/서울시 쿼터 보호). 미수집 구는 마스터 상위 그대로(베스트 에포트).
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LAWD_REGIONS, type AptDeal } from '@/lib/rtms'
import { getSeoulAptMaster } from '@/lib/seoulApt'

export interface AptPin { name: string; dong: string; lng: number; lat: number; hh: number | null; aprv: string | null; query: string; deals: number }

const norm = (s: string) => s.replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/아파트$/, '')

export async function GET(req: Request) {
  const lawd = (new URL(req.url).searchParams.get('lawd') ?? '').trim()
  const region = LAWD_REGIONS.find(r => r.lawd === lawd && r.sido === '서울')
  if (!region) return NextResponse.json({ pins: [] }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    const master = (await getSeoulAptMaster()).filter(m => m.gu === region.name)

    // 최근 12개월 거래 캐시(있는 만큼만) → RTMS 그룹 키('동 단지명')별 거래수
    const dealCnt = new Map<string, number>()
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && svc) {
        const db = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (u: RequestInfo | URL, o?: RequestInit) => fetch(u, { ...o, cache: 'no-store' }) } })
        const now = new Date(Date.now() + 9 * 3600_000)
        const keys: string[] = []
        for (let k = 0; k < 12; k++) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1))
          keys.push(`rtms-trade-v2:${lawd}:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
        }
        const { data } = await db.from('app_cache').select('payload').in('key', keys)
        for (const row of data ?? []) if (Array.isArray(row.payload))
          for (const dl of row.payload as AptDeal[]) {
            const k = `${dl.dong} ${dl.aptNm}`.trim()
            dealCnt.set(k, (dealCnt.get(k) ?? 0) + 1)
          }
      }
    } catch { /* graceful — 조인 없이 마스터만 */ }

    let pins: AptPin[]
    if (dealCnt.size) {
      // 조인: 같은 법정동 + 단지명 양방향 포함 → 거래 최다 RTMS 키를 핀 클릭 쿼리로
      pins = master.map(m => {
        const mn = norm(m.name)
        let best: { k: string; n: number } | null = null
        for (const [k, n] of Array.from(dealCnt.entries())) {
          const sp = k.indexOf(' ')
          const dong = k.slice(0, sp), nm = norm(k.slice(sp + 1))
          if (dong !== m.dong || !nm || !(mn.includes(nm) || nm.includes(mn))) continue
          if (!best || n > best.n) best = { k, n }
        }
        return best ? { name: m.name, dong: m.dong, lng: m.lng, lat: m.lat, hh: m.hh, aprv: m.aprv, query: best.k, deals: best.n } : null
      }).filter((p): p is AptPin => p != null)
        .sort((a, b) => (b.hh ?? 0) - (a.hh ?? 0)).slice(0, 18)
    } else {
      pins = master.sort((a, b) => (b.hh ?? 0) - (a.hh ?? 0)).slice(0, 18)
        .map(m => ({ name: m.name, dong: m.dong, lng: m.lng, lat: m.lat, hh: m.hh, aprv: m.aprv, query: `${m.dong} ${m.name.replace(/아파트$/, '')}`, deals: 0 }))
    }
    return NextResponse.json({ pins, gu: region.name }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ pins: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
