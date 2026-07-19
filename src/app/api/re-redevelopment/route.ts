// 🏗️ 서울 정비사업(재건축·재개발) 레이더 — upisRebuild 라이브(6,581 고시 → 4,066 구역) 집계
//    서울 부동산 핵심 가격변수. 자치구별 활성 구역·유형분포·최근 신규지정/해제. 추진단계는 라이브 API 부재(2차 xlsx 확장)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

const KEY = () => process.env.SEOUL_API_KEY ?? null
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 서울 25개 자치구(파싱 오염 필터 화이트리스트)
const SEOUL_GU = ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구']

interface Zone { rgn: string; gu: string | null; typeGroup: string; status: string; date: string; pos: string; area: number | null }
export interface RedevelopResult {
  asOf: string; totalZones: number; activeZones: number
  districts: { gu: string; count: number; redev: number; rebuild: number; urban: number; resid: number }[]
  typeDist: { group: string; count: number }[]
  recentNew: { rgn: string; gu: string | null; typeGroup: string; date: string; pos: string }[]
  recentCancelled: { rgn: string; gu: string | null; typeGroup: string; date: string }[]
  zones: Zone[]   // 활성 구역(검색용)
}

const typeGroupOf = (s: string): string =>
  /재건축/.test(s) ? '재건축' : /재개발/.test(s) ? '재개발' : /도시환경/.test(s) ? '도시환경정비' : /주거환경/.test(s) ? '주거환경' : '기타'
const dateOf = (code: string): string => { const m = /(\d{8})/.exec(code || ''); const d = m ? m[1] : ''; return d && d !== '99999999' ? d : '' }

export async function GET() {
  const key = KEY()
  if (!key) return NextResponse.json({ error: 'SEOUL_API_KEY 미설정' }, { status: 500 })
  const cacheKey = `re-redevelop-v1:${kstDate()}`
  const cached = await getCache<RedevelopResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // upisRebuild 7페이지(1,000건씩) 수집
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = []
  for (let i = 1; i <= 6581; i += 1000) {
    try {
      const r = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/upisRebuild/${i}/${i + 999}/`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      const j = await r.json()
      const rows = j?.upisRebuild?.row
      if (Array.isArray(rows)) raw.push(...rows)
    } catch { /* 페이지 실패는 건너뜀 */ }
  }
  if (raw.length < 1000) return NextResponse.json({ error: '정비사업 데이터 수집 실패' }, { status: 503 })

  // 동→구 맵을 데이터에서 학습(구 명시된 지번에서) — 88%가 LOGVM='서울특별시'라 PSTN_NM 파싱이 유일 경로
  const dong2gu = new Map<string, string>()
  for (const r of raw) {
    const m = /^\s*([가-힣]+구)\s+([가-힣0-9]+동|[가-힣0-9]+가|[가-힣]+리)/.exec(r.PSTN_NM || '')
    if (m && SEOUL_GU.includes(m[1]) && !dong2gu.has(m[2])) dong2gu.set(m[2], m[1])
  }
  const guOf = (pos: string): string | null => {
    const m = /^\s*([가-힣]+구)\s/.exec(pos || ''); if (m && SEOUL_GU.includes(m[1])) return m[1]
    const m2 = /^\s*([가-힣0-9]+동|[가-힣0-9]+가|[가-힣]+리)/.exec(pos || ''); if (m2 && dong2gu.has(m2[1])) return dong2gu.get(m2[1])!
    return null
  }

  // 구역별(PRJC_CD) 최신 고시 → 현재 상태
  const byProj = new Map<string, Zone>()
  for (const r of raw) {
    const d = dateOf(r.RPT_MNG_CD)
    const z: Zone = { rgn: r.RGN_NM || '', gu: guOf(r.PSTN_NM || ''), typeGroup: typeGroupOf(r.SCLSF || ''), status: r.RPT_TYPE || '', date: d, pos: r.PSTN_NM || '', area: r.AREA_EXS ? Math.round(parseFloat(r.AREA_EXS)) || null : null }
    const cur = byProj.get(r.PRJC_CD)
    if (!cur || d > cur.date) byProj.set(r.PRJC_CD, z)
  }
  const zones = Array.from(byProj.values())
  const active = zones.filter(z => !['폐지', '실효', '무효'].includes(z.status))

  // 자치구별 집계(활성)
  const dmap = new Map<string, { count: number; redev: number; rebuild: number; urban: number; resid: number }>()
  for (const g of SEOUL_GU) dmap.set(g, { count: 0, redev: 0, rebuild: 0, urban: 0, resid: 0 })
  for (const z of active) {
    if (!z.gu) continue; const e = dmap.get(z.gu); if (!e) continue
    e.count++
    if (z.typeGroup === '재개발') e.redev++
    else if (z.typeGroup === '재건축') e.rebuild++
    else if (z.typeGroup === '도시환경정비') e.urban++
    else if (z.typeGroup === '주거환경') e.resid++
  }
  const districts = SEOUL_GU.map(g => ({ gu: g, ...dmap.get(g)! }))

  // 유형 분포(활성)
  const tg = new Map<string, number>()
  for (const z of active) tg.set(z.typeGroup, (tg.get(z.typeGroup) || 0) + 1)
  const typeDist = Array.from(tg.entries()).map(([group, count]) => ({ group, count })).sort((a, b) => b.count - a.count)

  // 최근 신규 지정(신설) / 해제(폐지·실효)
  const recentNew = active.filter(z => z.status === '신설' && z.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
    .map(z => ({ rgn: z.rgn, gu: z.gu, typeGroup: z.typeGroup, date: z.date, pos: z.pos }))
  const recentCancelled = zones.filter(z => ['폐지', '실효'].includes(z.status) && z.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
    .map(z => ({ rgn: z.rgn, gu: z.gu, typeGroup: z.typeGroup, date: z.date }))

  const result: RedevelopResult = {
    asOf: kstDate(), totalZones: zones.length, activeZones: active.length,
    districts, typeDist, recentNew, recentCancelled,
    zones: active.map(z => ({ ...z })),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
