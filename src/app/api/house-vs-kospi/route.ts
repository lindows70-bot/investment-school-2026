// 🏠⚔️📈 주택 vs 코스피 API — 30년 가격 레이스(KOSPI지수 vs KB 아파트지수, 가격끼리 공정 비교) + 주택 시가총액(291Y524) 보조
//    ⚠️ 코스피 '시가총액' 시리즈는 ECOS에 없음(실측) → 시총 vs 시총 비교 불가. 지수 비교가 공정(시총은 신축 재고 증가 포함이라 가격과 다름 — 캐비엇으로 명시)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { ecosSeries } from '@/lib/ecos'

export interface HouseVsKospiApi {
  series: { y: number; kospi: number | null; aptKor: number | null; aptSeoul: number | null }[]   // 연말 원값(재기준은 클라 — 구간 토글)
  houseCap: { y: number; kor: number | null; seoul: number | null }[]   // 주택시가총액(조원, 연말)
  latestYear: number
  asOf: string
}

const CACHE_KEY = 'house-vs-kospi-v1'

async function ecosRaw(stat: string, cycle: string, start: string, end: string, item: string, limit = 10000) {
  const key = process.env.ECOS_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/${limit}/${stat}/${cycle}/${start}/${end}/${item}`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j?.StatisticSearch?.row ?? [])
      .map((x: { TIME: string; DATA_VALUE: string }) => ({ t: String(x.TIME), v: parseFloat(x.DATA_VALUE) }))
      .filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  if (!refresh) {
    const hit = await getCache<HouseVsKospiApi>(CACHE_KEY, 7 * 86400_000)
    if (hit) return NextResponse.json(hit, { headers: { 'Cache-Control': 'no-store' } })
  }

  const nowY = new Date(Date.now() + 9 * 3600_000).getUTCFullYear()
  const endYm = `${nowY}12`
  // KOSPI 일별(1995~, ~8천 행 1콜) + KB 아파트 매매지수(전국·서울, 월) + 주택시가총액(연)
  const [kospiD, aptKorM, aptSeoulM, capKor, capSeoul] = await Promise.all([
    ecosRaw('802Y001', 'D', '19950101', `${nowY}1231`, '0001000'),
    ecosSeries('901Y062', 'M', '199501', endYm, 'P63AC'),
    ecosSeries('901Y062', 'M', '199501', endYm, 'P63ACA'),
    ecosRaw('291Y524', 'A', '1995', String(nowY), 'REG00', 100),
    ecosRaw('291Y524', 'A', '2010', String(nowY), 'REG11', 100),
  ])
  if (kospiD.length < 1000 || aptKorM.length < 100)
    return NextResponse.json({ error: '수집 실패 — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  // 연말 값 추출 — KOSPI는 연도별 마지막 거래일, 아파트는 12월(최신 연도는 마지막 발행월)
  const kospiByY = new Map<number, number>()
  for (const x of kospiD) kospiByY.set(+x.t.slice(0, 4), x.v)   // 정렬 순회라 마지막 값이 연말
  const aptYear = (rows: { time: string; value: number }[]) => {
    const m = new Map<number, number>()
    for (const x of rows) m.set(+x.time.slice(0, 4), x.value)
    return m
  }
  const akY = aptYear(aptKorM), asY = aptYear(aptSeoulM)

  const series: HouseVsKospiApi['series'] = []
  for (let y = 1995; y <= nowY; y++) {
    const k = kospiByY.get(y), a = akY.get(y), s = asY.get(y)
    if (k == null && a == null) continue
    series.push({ y, kospi: k ?? null, aptKor: a ?? null, aptSeoul: s ?? null })
  }
  const capS = new Map(capSeoul.map((x: { t: string; v: number }) => [+x.t, x.v]))
  const houseCap = capKor.map((x: { t: string; v: number }) => ({
    y: +x.t,
    kor: Math.round(x.v / 100) / 10,                                        // 십억원 → 조원
    seoul: capS.has(+x.t) ? Math.round((capS.get(+x.t) as number) / 100) / 10 : null,
  }))

  const result: HouseVsKospiApi = { series, houseCap, latestYear: nowY, asOf: new Date().toISOString() }
  if (series.length >= 25 && houseCap.length >= 20) await setCache(CACHE_KEY, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
