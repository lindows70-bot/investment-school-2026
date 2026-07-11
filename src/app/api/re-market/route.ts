// 🏠 부동산 시장 대시보드 API — "금리는 집값의 중력" 한 화면(Phase 1)
// 소스: ECOS(KB지수·실거래지수·미분양·기준금리·주담대) + FRED(케이스실러·미 모기지). 전부 실측 검증 항목코드(2026-07-11).
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { ecosSeries } from '@/lib/ecos'

export interface ReMarketResult {
  kpi: {
    baseRate: number | null            // 한은 기준금리(%)
    mortgageRate: number | null        // 주담대 신규취급 금리(%)
    kbAptYoY: number | null            // KB 아파트 매매지수(전국) 전년동월비 %
    unsold: number | null              // 미분양(전국, 호)
    unsoldPercentile: number | null    // 미분양 역사 백분위(2007~, 높을수록 재고 많음)
    asOfKb: string | null; asOfUnsold: string | null
  }
  kbChart: { date: string; sale: number | null; jeonse: number | null; saleSeoul: number | null; baseRate: number | null }[]
  rtChart: { date: string; nation: number | null; seoul: number | null; capital: number | null }[]
  unsoldChart: { date: string; nation: number | null; capital: number | null }[]
  usChart: { date: string; caseShiller: number | null; mortgage: number | null }[]
  asOf: string
}

const ymNow = () => { const d = new Date(Date.now() + 9 * 3600_000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}` }
const fmtYm = (t: string) => `${t.slice(0, 4)}-${t.slice(4, 6)}`
const last = (a: { time: string; value: number }[]) => a.length ? a[a.length - 1] : null

async function fredSeries(id: string, start: string): Promise<{ date: string; value: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&observation_start=${start}`, { signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((o: { value: number }) => isFinite(o.value))
  } catch { return [] }
}

export async function GET() {
  const cacheKey = 're-market-v1'
  const cached = await getCache<ReMarketResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const END = ymNow(), START = '200601'   // 실거래지수 시작(2006-01)에 정렬
  // ECOS 병렬(같은 호스트지만 한은은 관대 — 7콜)
  const [base, mort, kbSale, kbSaleSeoul, kbJeonse, rtN, rtS, rtC, unsN, unsC] = await Promise.all([
    ecosSeries('722Y001', 'M', START, END, '0101000'),   // 기준금리
    ecosSeries('121Y006', 'M', START, END, 'BECBLA0302'), // 주담대(신규취급)
    ecosSeries('901Y062', 'M', START, END, 'P63AC'),      // KB 아파트 매매(전국)
    ecosSeries('901Y062', 'M', START, END, 'P63ACA'),     // KB 아파트 매매(서울)
    ecosSeries('901Y063', 'M', START, END, 'P63AC'),      // KB 아파트 전세(전국)
    ecosSeries('901Y089', 'M', START, END, '100'),        // 실거래가격지수 전국
    ecosSeries('901Y089', 'M', START, END, '200'),        // 서울
    ecosSeries('901Y089', 'M', START, END, '300'),        // 수도권
    ecosSeries('901Y074', 'M', '200701', END, 'I410A'),   // 미분양 전국
    ecosSeries('901Y074', 'M', '200701', END, 'I410R'),   // 미분양 수도권
  ])
  // FRED 미국 축
  const [cs, usMort] = await Promise.all([fredSeries('CSUSHPINSA', '2006-01-01'), fredSeries('MORTGAGE30US', '2006-01-01')])

  if (!kbSale.length && !rtN.length)
    return NextResponse.json({ error: 'ECOS 수집 실패 — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  // 월별 병합 헬퍼
  const map = (a: { time: string; value: number }[]) => new Map(a.map(x => [x.time, x.value]))
  const mBase = map(base), mSaleS = map(kbSaleSeoul), mJeonse = map(kbJeonse)
  const kbChart = kbSale.map(x => ({
    date: fmtYm(x.time), sale: x.value, jeonse: mJeonse.get(x.time) ?? null,
    saleSeoul: mSaleS.get(x.time) ?? null, baseRate: mBase.get(x.time) ?? null,
  }))
  const mRtS = map(rtS), mRtC = map(rtC)
  const rtChart = rtN.map(x => ({ date: fmtYm(x.time), nation: x.value, seoul: mRtS.get(x.time) ?? null, capital: mRtC.get(x.time) ?? null }))
  const mUnsC = map(unsC)
  const unsoldChart = unsN.map(x => ({ date: fmtYm(x.time), nation: x.value, capital: mUnsC.get(x.time) ?? null }))
  // 미 모기지(주간) → 월 평균으로 다운샘플 후 케이스실러(월)와 병합
  const mortByMonth = new Map<string, number[]>()
  for (const o of usMort) { const k = o.date.slice(0, 7); const arr = mortByMonth.get(k) ?? []; arr.push(o.value); mortByMonth.set(k, arr) }
  const usChart = cs.map(o => {
    const k = o.date.slice(0, 7)
    const arr = mortByMonth.get(k)
    return { date: k, caseShiller: o.value, mortgage: arr?.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100 : null }
  })

  // KPI — KB 아파트 YoY · 미분양 역사 백분위(재고 적체 프레임, leverage-radar 패턴)
  const lastKb = last(kbSale)
  const prevYear = lastKb ? kbSale.find(x => x.time === String(Number(lastKb.time) - 100)) : null
  const kbAptYoY = lastKb && prevYear ? Math.round((lastKb.value / prevYear.value - 1) * 1000) / 10 : null
  const lastUns = last(unsN)
  const unsoldPercentile = lastUns
    ? Math.round(unsN.filter(x => x.value <= lastUns.value).length / unsN.length * 100)
    : null

  const result: ReMarketResult = {
    kpi: {
      baseRate: last(base)?.value ?? null,
      mortgageRate: last(mort)?.value ?? null,
      kbAptYoY, unsold: lastUns?.value ?? null, unsoldPercentile,
      asOfKb: lastKb ? fmtYm(lastKb.time) : null, asOfUnsold: lastUns ? fmtYm(lastUns.time) : null,
    },
    kbChart, rtChart, unsoldChart, usChart,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
