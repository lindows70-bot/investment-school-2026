// 🔍 아파트 단지 리서치 API — 지역(시군구) 실거래 24개월 수집 → 단지 랭킹 → 선택 단지·면적대의 매매/전세 추이 + 밸류 3축
// 밸류: ①전세가율(사용가치 비율) ②고점 대비(단지 최고 실거래 대비) ③지역 벌집 국면(re-honeycomb 캐시 연동) + 주담대 금리 참고(re-market)
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'
import { rtmsTradeMonth, rtmsRentMonth, LAWD_SIDO, LAWD_REGIONS, type AptDeal } from '@/lib/rtms'
import { getSeoulAptMaster, matchAptMaster } from '@/lib/seoulApt'

export interface AptComplex { name: string; dealCount: number; lastPrice: number; lastYm: string; buildYear: number | null }
export interface AptOverview { households: number | null; dongs: number | null; aprv: string | null; park: number | null; parkPerHh: number | null; heat: string | null }
export interface AptDealOut { ym: string; day: number; price: number; area: number; floor: number | null; type: '매매' | '전세' }
export interface AptResearchResult {
  lawd: string; sido: string; months: number
  complexes: AptComplex[]                 // 거래 많은 순 상위 40
  selected: {
    name: string
    areas: { area: number; count: number }[]   // 면적대(반올림 ㎡) 거래 많은 순
    area: number                                // 선택 면적대
    deals: AptDealOut[]                          // 선택 면적대 ±2㎡ 개별 거래(매매+전세)
    monthly: { ym: string; sale: number | null; jeonse: number | null }[]   // 월 중위가(억)
    overview: AptOverview | null                 // 🏢 단지 개요(서울시 공동주택 마스터 — 서울만·의무관리단지만)
    value: {
      saleMed6: number | null; jeonseMed6: number | null   // 최근 6개월 중위(억)
      jeonseRatio: number | null                            // 전세가율 %
      peak: number | null; vsPeak: number | null            // 역대 최고 실거래(억)·고점 대비 %
      regionPhase: string | null                            // 지역 벌집 국면
      mortgageRate: number | null                           // 주담대(참고)
    }
  } | null
  queryMiss?: boolean   // 검색 단지 실거래 미발견 → 1위 폴백 고지
  asOf: string
}

const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const eok = (manwon: number) => Math.round(manwon / 1000) / 10   // 만원 → 억(소수1)

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const lawd = (sp.get('lawd') ?? '').trim()
  const aptQ = (sp.get('apt') ?? '').trim()
  const areaQ = parseFloat(sp.get('area') ?? '')
  if (!/^\d{5}$/.test(lawd)) return NextResponse.json({ error: '지역(LAWD 5자리)을 지정해주세요.' }, { status: 400 })

  const MONTHS = 24
  const now = new Date(Date.now() + 9 * 3600_000)
  const yms: string[] = []
  for (let k = 0; k < MONTHS; k++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1))
    yms.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  // 월별 수집(캐시 우선 — 과거월은 대부분 캐시 히트). 동시성 6
  const trades: AptDeal[] = [], rents: AptDeal[] = []
  const queue = [...yms]
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (;;) {
      const ym = queue.shift()
      if (!ym) break
      const [t, r] = await Promise.all([rtmsTradeMonth(lawd, ym), rtmsRentMonth(lawd, ym)])
      trades.push(...t); rents.push(...r)
    }
  }))
  if (!trades.length)
    return NextResponse.json({ error: '실거래 데이터가 없습니다 — 지역 코드를 확인하거나 잠시 후 재시도.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  // 단지 랭킹(매매 거래 수 기준 상위 40)
  // ⚠️ 그룹 키 = '법정동 + 단지명' — 같은 이름 아파트가 동마다 존재(송파 '대림': 오금동/문정동 등이 섞이면 13억·24억이 한 차트에)
  const keyOf = (d: AptDeal) => `${d.dong} ${d.aptNm}`.trim()
  const byApt = new Map<string, AptDeal[]>()
  for (const d of trades) { const k = keyOf(d); const a = byApt.get(k) ?? []; a.push(d); byApt.set(k, a) }
  const complexes: AptComplex[] = Array.from(byApt.entries()).map(([name, ds]) => {
    const last = ds.reduce((b, x) => (x.ym + String(x.day).padStart(2, '0')) > (b.ym + String(b.day).padStart(2, '0')) ? x : b)
    return { name, dealCount: ds.length, lastPrice: eok(last.price!), lastYm: `${last.ym.slice(0, 4)}-${last.ym.slice(4)}`, buildYear: last.buildYear }
  }).sort((a, b) => b.dealCount - a.dealCount).slice(0, 40)

  // 선택 단지(미지정 시 1위) — 정확 일치 → 부분 일치(거래 많은 순) 순으로 해석('오금동 대림'·'대림' 검색 지원)
  let selName = complexes[0]?.name
  let queryMiss = false   // 검색어가 있는데 실거래 미발견(재건축 멸실·표기 차이) → 1위 폴백을 정직하게 고지
  if (aptQ) {
    if (byApt.has(aptQ)) selName = aptQ
    else {
      // 양방향 부분일치 — 지도 핀(마스터 표기 '래미안대치팰리스1단지')이 RTMS 표기('래미안대치팰리스')보다 길어도 매칭
      const q = aptQ.replace(/\s+/g, '')
      const hits = Array.from(byApt.entries())
        .map(([k, arr]) => { const k2 = k.replace(/\s+/g, ''); return { k, n: arr.length, score: k2 === q ? 3 : k2.includes(q) ? 2 : q.includes(k2) ? 1 : 0 } })
        .filter(h => h.score > 0)
        .sort((a, b) => b.score - a.score || b.n - a.n)
      if (hits.length) selName = hits[0].k
      else queryMiss = true
    }
  }
  let selected: AptResearchResult['selected'] = null
  if (selName) {
    const selTrades = byApt.get(selName) ?? []
    const selRents = rents.filter(d => keyOf(d) === selName && (d.monthlyRent ?? 0) === 0)   // 전세만(월세 제외 — v1 정직 한정)
    // 면적대(반올림 ㎡) 거래 많은 순
    const areaCnt = new Map<number, number>()
    for (const d of selTrades) { const a = Math.round(d.area); areaCnt.set(a, (areaCnt.get(a) ?? 0) + 1) }
    const areas = Array.from(areaCnt.entries()).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count).slice(0, 6)
    const selArea = isFinite(areaQ) && areas.some(a => Math.abs(a.area - areaQ) <= 2) ? areaQ : (areas[0]?.area ?? 0)
    const inBand = (d: AptDeal) => Math.abs(d.area - selArea) <= 2
    const bandT = selTrades.filter(inBand), bandR = selRents.filter(inBand)
    // 월 중위가
    const monthly = [...yms].reverse().map(ym => ({
      ym: `${ym.slice(0, 4)}-${ym.slice(4)}`,
      sale: med(bandT.filter(d => d.ym === ym).map(d => d.price!)),
      jeonse: med(bandR.filter(d => d.ym === ym).map(d => d.deposit!)),
    })).map(m => ({ ym: m.ym, sale: m.sale != null ? eok(m.sale) : null, jeonse: m.jeonse != null ? eok(m.jeonse) : null }))
    // 밸류 3축
    const last6 = yms.slice(0, 6)
    const saleMed6 = med(bandT.filter(d => last6.includes(d.ym)).map(d => d.price!))
    const jeonseMed6 = med(bandR.filter(d => last6.includes(d.ym)).map(d => d.deposit!))
    const peakMan = bandT.length ? Math.max(...bandT.map(d => d.price!)) : null
    // 지역 벌집 국면(캐시 읽기만 — 콜드면 null graceful)
    let regionPhase: string | null = null
    try {
      const hc = await getCache<{ regions: { name: string; phaseName: string }[] }>('re-honeycomb-v2', 3 * 86400_000)
      regionPhase = hc?.regions.find(r => r.name === LAWD_SIDO[lawd.slice(0, 2)])?.phaseName ?? null
    } catch { /* graceful */ }
    let mortgageRate: number | null = null
    try {
      const rm = await getCache<{ kpi: { mortgageRate: number | null } }>('re-market-v2', 3 * 86400_000)
      mortgageRate = rm?.kpi.mortgageRate ?? null
    } catch { /* graceful */ }
    // 🏢 단지 개요 — 서울시 공동주택 마스터 매칭(서울만·의무관리단지만 존재, 미매칭 시 null 정직)
    let overview: AptOverview | null = null
    if (lawd.startsWith('11')) {
      try {
        const master = await getSeoulAptMaster()
        const guName = LAWD_REGIONS.find(r => r.lawd === lawd)?.name ?? ''
        const parts = selName.split(' ')
        const m = matchAptMaster(master, guName, parts[0], parts.slice(1).join(' '))
        if (m) overview = {
          households: m.hh, dongs: m.dongs, aprv: m.aprv, park: m.park,
          parkPerHh: m.hh && m.park ? Math.round(m.park / m.hh * 100) / 100 : null, heat: m.heat,
        }
      } catch { /* graceful */ }
    }
    const deals: AptDealOut[] = [
      ...bandT.map(d => ({ ym: `${d.ym.slice(0, 4)}-${d.ym.slice(4)}`, day: d.day, price: eok(d.price!), area: d.area, floor: d.floor, type: '매매' as const })),
      ...bandR.map(d => ({ ym: `${d.ym.slice(0, 4)}-${d.ym.slice(4)}`, day: d.day, price: eok(d.deposit!), area: d.area, floor: d.floor, type: '전세' as const })),
    ].sort((a, b) => (b.ym + String(b.day).padStart(2, '0')).localeCompare(a.ym + String(a.day).padStart(2, '0')))
    selected = {
      name: selName, areas, area: selArea, deals: deals.slice(0, 400), monthly, overview,
      value: {
        saleMed6: saleMed6 != null ? eok(saleMed6) : null,
        jeonseMed6: jeonseMed6 != null ? eok(jeonseMed6) : null,
        jeonseRatio: saleMed6 && jeonseMed6 ? Math.round(jeonseMed6 / saleMed6 * 1000) / 10 : null,
        peak: peakMan != null ? eok(peakMan) : null,
        vsPeak: peakMan && saleMed6 ? Math.round((saleMed6 / peakMan - 1) * 1000) / 10 : null,
        regionPhase, mortgageRate,
      },
    }
  }

  const result: AptResearchResult = {
    lawd, sido: LAWD_SIDO[lawd.slice(0, 2)] ?? '', months: MONTHS, complexes, selected, queryMiss, asOf: new Date().toISOString(),
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
