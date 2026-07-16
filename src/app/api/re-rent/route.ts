// 💰 월세·수익률 축 API — 아파트 전월세 전환율(R-ONE A_2024_00157, 임대시장의 금리) vs 주담대 금리(ECOS) 스프레드
//    스프레드 = 전환율 − 주담대: 양수 크면 보증금을 월세로 돌리는 이율이 대출이자보다 높음(임대인 월세 선호 = '전세의 월세화' 압력).
//    판정은 역사 백분위(결정론·하드코딩 임계 없음). ECOS 월세지수(901Y115)는 2024-05 중단·TIME 중복 오염 실측 → 정직 제외.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { ecosSeries } from '@/lib/ecos'
import { roneSeries, RONE_CONV_TBL, RONE_CONV_CLS } from '@/lib/rone'

export interface ReRentApi {
  series: { t: string; 전국: number | null; 서울: number | null; 지방: number | null; 주담대: number | null; 스프레드: number | null }[]  // 2011-01~ (스프레드=전국 전환율−주담대)
  latest: {
    convKor: number | null       // 전국 아파트 전환율 %
    mortgage: number | null      // 주담대 신규취급 %
    spread: number | null        // 스프레드 %p
    spreadPercentile: number | null   // 역사 백분위(높을수록 월세 캐리 여유)
    asOfMonth: string
  }
  regions: { name: string; conv: number; spread: number | null }[]   // 최신월 시도 스냅샷(전환율 높은 순)
  asOf: string
}

const CACHE_KEY = 're-rent-v1'
const rd = (v: number) => Math.round(v * 100) / 100

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  if (!refresh) {
    const hit = await getCache<ReRentApi>(CACHE_KEY, 24 * 3600_000)
    if (hit) return NextResponse.json(hit, { headers: { 'Cache-Control': 'no-store' } })
  }

  const now = new Date(Date.now() + 9 * 3600_000)
  const endYm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const START = '201101'

  // 전환율 3계열(전국·서울·지방) + 시도 스냅샷(CLS 미지정 1콜 — CLS_NM 실명이라 이름으로 직접 매핑) + 주담대
  const snapStart = `${now.getUTCMonth() + 1 <= 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()}${String(((now.getUTCMonth() + 9) % 12) + 1).padStart(2, '0')}`
  const [convKor, convSeoul, convLocal, snap, mort] = await Promise.all([
    roneSeries(RONE_CONV_TBL, RONE_CONV_CLS['전국'], START, endYm, '100001'),
    roneSeries(RONE_CONV_TBL, RONE_CONV_CLS['서울'], START, endYm, '100001'),
    roneSeries(RONE_CONV_TBL, RONE_CONV_CLS['지방'], START, endYm, '100001'),
    roneSeries(RONE_CONV_TBL, null, snapStart, endYm, '100001', 200),
    ecosSeries('121Y006', 'M', START, endYm, 'BECBLA0302'),
  ])

  if (convKor.length < 24 || mort.length < 24)
    return NextResponse.json({ error: '전환율·금리 수집 실패 — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const mKor = new Map(convKor.map(r => [r.time, r.value]))
  const mSeoul = new Map(convSeoul.map(r => [r.time, r.value]))
  const mLocal = new Map(convLocal.map(r => [r.time, r.value]))
  const mMort = new Map(mort.map(r => [r.time, r.value]))
  const months = convKor.map(r => r.time)

  const spreads: number[] = []
  const series = months.map(t => {
    const k = mKor.get(t) ?? null, mo = mMort.get(t) ?? null
    const sp = k != null && mo != null ? rd(k - mo) : null
    if (sp != null) spreads.push(sp)
    return {
      t: `${t.slice(0, 4)}-${t.slice(4)}`,
      전국: k != null ? rd(k) : null,
      서울: mSeoul.has(t) ? rd(mSeoul.get(t)!) : null,
      지방: mLocal.has(t) ? rd(mLocal.get(t)!) : null,
      주담대: mo != null ? rd(mo) : null,
      스프레드: sp,
    }
  })

  const lastT = months[months.length - 1]
  const convNow = mKor.get(lastT) ?? null
  // 주담대는 전환율보다 발행이 빠를 수 있어 전환율 최신월의 금리(없으면 최신값)로 스프레드 산출
  const mortAtLast = mMort.get(lastT) ?? (mort.length ? mort[mort.length - 1].value : null)
  const spreadNow = convNow != null && mortAtLast != null ? rd(convNow - mortAtLast) : null
  const spreadPercentile = spreadNow != null && spreads.length >= 24
    ? Math.round(spreads.filter(s => s <= spreadNow).length / spreads.length * 100) : null

  // 시도 스냅샷 — 최신월 행만, RONE_CONV_CLS에 등재된 시도(전국·수도권·지방 제외)
  const sidoNames = new Set(Object.keys(RONE_CONV_CLS).filter(n => !['전국', '수도권', '지방'].includes(n)))
  const snapLastT = snap.length ? snap[snap.length - 1].time : ''
  const regions = snap
    .filter(r => r.time === snapLastT && sidoNames.has(r.cls))
    .map(r => ({ name: r.cls, conv: rd(r.value), spread: mortAtLast != null ? rd(r.value - mortAtLast) : null }))
    .sort((a, b) => b.conv - a.conv)

  const result: ReRentApi = {
    series,
    latest: { convKor: convNow != null ? rd(convNow) : null, mortgage: mortAtLast != null ? rd(mortAtLast) : null, spread: spreadNow, spreadPercentile, asOfMonth: `${lastT.slice(0, 4)}-${lastT.slice(4)}` },
    regions,
    asOf: new Date().toISOString(),
  }
  // 부분 실패 박제 방지 — 핵심 축 성공 시에만 캐시
  if (convNow != null && mortAtLast != null && regions.length >= 10) await setCache(CACHE_KEY, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
