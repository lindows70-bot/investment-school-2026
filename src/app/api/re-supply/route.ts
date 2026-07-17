// 🏗️ 공급 파이프라인 API — 인허가(ECOS 901Y105)→착공(R-ONE)→준공=입주(R-ONE) 3단계 + 지역별 미분양(ECOS 901Y074)
//    부동산판 주글라르: "3년 전 착공이 오늘의 입주물량". 12개월 이동합으로 표준화 + 역사 백분위 판정(결정론·하드코딩 임계 없음).
//    CLS·ITM은 2026-07-16 전수 실측(전국=시도합 검산·세종 2011 결측 지문) — lib/rone.ts RONE_SUPPLY_CLS.
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { ecosSeries } from '@/lib/ecos'
import { roneSeries, RONE_START_TBL, RONE_COMP_TBL, RONE_SUPPLY_ITM, RONE_SUPPLY_CLS, RONE_PRESALE_TBL, RONE_PRESALE_ITM, RONE_PRESALE_CLS } from '@/lib/rone'

// ECOS 인허가(901Y105)·미분양(901Y074) 지역 항목코드 — 2026-07-16 StatisticItemList 실측
const PERMIT_ITEM: Record<string, string> = {
  전국: 'ALL', 서울: 'SEO', 인천: 'INC', 경기: 'GYE', 부산: 'BUS', 대구: 'DEG', 광주: 'GWA', 대전: 'DEJ',
  울산: 'ULS', 세종: 'SEJ', 강원: 'GAN', 충북: 'CHB', 충남: 'CHN', 전북: 'JNB', 전남: 'JNN', 경북: 'KYB', 경남: 'KYN', 제주: 'JEJ',
}
const UNSOLD_ITEM: Record<string, string> = {
  전국: 'I410A', 서울: 'I410B', 부산: 'I410C', 대구: 'I410D', 인천: 'I410E', 광주: 'I410F', 대전: 'I410G', 울산: 'I410H',
  경기: 'I410I', 강원: 'I410J', 충북: 'I410K', 세종: 'I410L', 전북: 'I410M', 전남: 'I410N', 경북: 'I410O', 경남: 'I410P', 제주: 'I410Q', 충남: 'I410S',
}
const REGIONS = Object.keys(PERMIT_ITEM)   // ⚠️ route는 상수 export 금지(HC_PHASES 교훈) — 내부 전용

export interface SupplyPoint { t: string; p: number | null; b: number | null; s: number | null; c: number | null; u: number | null }  // t=YYYYMM · p=인허가ttm b=분양ttm s=착공ttm c=준공ttm u=미분양(호)
export interface SupplyRegion {
  name: string
  points: SupplyPoint[]                 // 12개월 이동합(인허가·착공·준공) + 미분양 레벨
  latest: {
    permitTtm: number | null; permitPct: number | null      // 인허가 12개월합 · 역사 백분위(낮음=공급 절벽 예고)
    presaleTtm: number | null; presalePct: number | null    // 신규 분양 12개월합 · 백분위(2015-10~ — 분양은 착공 전후 시장에 물량 예고)
    startTtm: number | null; startPct: number | null        // 착공 12개월합 · 백분위(→2~3년 뒤 입주)
    compTtm: number | null; compPct: number | null          // 준공(입주) 12개월합 · 백분위
    unsold: number | null; unsoldPct: number | null         // 미분양 호수 · 백분위(높음=재고 적체)
  }
  verdict: 'cliff' | 'glut' | 'neutral'                     // 절벽 예고/공급 확대/중립 — 인허가·착공 백분위 조합
}
export interface SupplyApi { regions: SupplyRegion[]; asOf: string }

const nowYm = () => { const d = new Date(Date.now() + 9 * 3600_000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}` }

// 12개월 이동합 — 결측 달이 있으면 그 창은 null(정직)
function ttm(series: Map<string, number>, months: string[]): (number | null)[] {
  return months.map((m, i) => {
    if (i < 11) return null
    let sum = 0
    for (let k = i - 11; k <= i; k++) {
      const v = series.get(months[k])
      if (v == null) return null
      sum += v
    }
    return sum
  })
}
const pctOf = (arr: (number | null)[], v: number | null): number | null => {
  if (v == null) return null
  const hist = arr.filter((x): x is number => x != null)
  if (hist.length < 24) return null
  return Math.round(hist.filter(x => x <= v).length / hist.length * 100)
}

export async function GET() {
  const cacheKey = 're-supply-v3'   // v3: 분양세대수(T244633134461863) 4번째 축 추가
  const cached = await getCache<SupplyApi>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const end = nowYm()
  const regions: SupplyRegion[] = []
  const queue = [...REGIONS]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const name = queue.shift()
      if (!name) break
      try {
        const [permits, presales, starts, comps, unsold] = await Promise.all([
          ecosSeries('901Y105', 'M', '200701', end, PERMIT_ITEM[name]),
          roneSeries(RONE_PRESALE_TBL, RONE_PRESALE_CLS[name], '201510', end, RONE_PRESALE_ITM),   // 분양은 2015-10~(테이블 시작)
          roneSeries(RONE_START_TBL, RONE_SUPPLY_CLS[name], '201101', end, RONE_SUPPLY_ITM),
          roneSeries(RONE_COMP_TBL, RONE_SUPPLY_CLS[name], '201101', end, RONE_SUPPLY_ITM),
          ecosSeries('901Y074', 'M', '200701', end, UNSOLD_ITEM[name]),
        ])
        // ⚠️ ECOS 인허가(901Y105)는 '연초부터 누계' 시리즈(실측: 2025-12=379,834 → 2026-01=16,531 리셋) → 월별 차분으로 변환(1월은 그대로)
        const pm = new Map<string, number>()
        const sorted = [...permits].sort((a, b) => a.time.localeCompare(b.time))
        for (let i = 0; i < sorted.length; i++) {
          const cur = sorted[i]
          const prev = i > 0 && sorted[i - 1].time.slice(0, 4) === cur.time.slice(0, 4) ? sorted[i - 1].value : 0
          const monthly = cur.value - prev
          if (monthly >= 0) pm.set(cur.time, monthly)   // 음수(정정 공시)는 결측 처리(정직)
        }
        const bm = new Map(presales.map(x => [x.time, x.value]))
        const sm = new Map(starts.map(x => [x.time, x.value]))
        const cm = new Map(comps.map(x => [x.time, x.value]))
        const um = new Map(unsold.map(x => [x.time, x.value]))
        const months = Array.from(new Set([...Array.from(pm.keys()), ...Array.from(sm.keys()), ...Array.from(cm.keys())])).sort()
        if (months.length < 24) continue
        // 분양 ttm은 분양 자체 월축(2015-10~)으로 — 전체 months에 넣으면 시작 전 구간이 전부 null 창이 됨(정상)
        const pT = ttm(pm, months), bT = ttm(bm, months), sT = ttm(sm, months), cT = ttm(cm, months)
        const points: SupplyPoint[] = months.map((t, i) => ({ t, p: pT[i], b: bT[i], s: sT[i], c: cT[i], u: um.get(t) ?? null }))
        const lastOf = (a: (number | null)[]) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null }
        const uArr = points.map(x => x.u)
        const latest = {
          permitTtm: lastOf(pT), permitPct: pctOf(pT, lastOf(pT)),
          presaleTtm: lastOf(bT), presalePct: pctOf(bT, lastOf(bT)),
          startTtm: lastOf(sT), startPct: pctOf(sT, lastOf(sT)),
          compTtm: lastOf(cT), compPct: pctOf(cT, lastOf(cT)),
          unsold: lastOf(uArr), unsoldPct: pctOf(uArr, lastOf(uArr)),
        }
        // 판정(결정론) — 미래 공급의 씨앗(인허가·착공)이 역사 하위 25% 이하면 절벽 예고 / 상위 75% 이상이면 공급 확대
        const verdict: SupplyRegion['verdict'] =
          latest.permitPct != null && latest.startPct != null && latest.permitPct <= 25 && latest.startPct <= 25 ? 'cliff'
            : latest.permitPct != null && latest.startPct != null && latest.permitPct >= 75 && latest.startPct >= 75 ? 'glut'
              : 'neutral'
        regions.push({ name, points, latest, verdict })
      } catch { /* 지역 단위 graceful */ }
    }
  }))

  if (regions.length < 10)
    return NextResponse.json({ error: '공급 데이터 수집 실패 — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  regions.sort((a, b) => REGIONS.indexOf(a.name) - REGIONS.indexOf(b.name))
  const result: SupplyApi = { regions, asOf: new Date().toISOString() }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
