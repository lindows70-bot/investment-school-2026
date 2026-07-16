// 🫧 부동산 심화 게이지 API — ①적정성지수(가격 vs 전세·금리 근본가치, 주금공 방법론) ②M2 vs 서울아파트(1986~, 구·신계열 접합) ③매매수급지수(R-ONE) ④소비심리지수(국토연구원, 2011~)
// 데이터 전부 2026-07-11 실측 확정: M2 구계열 101Y004(1986~)·신계열 161Y006(2003.10~) BBHA00 / KB 매매 901Y062 P63ACA·전세 901Y063 P64ACA / 수급 A_2024_00076(서울 CLS=500008)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { ecosSeries } from '@/lib/ecos'
import { roneSeries, RONE_PSY_TBL, RONE_PSY_CLS } from '@/lib/rone'

export interface GaugePoint { t: string; [k: string]: number | string | null }
export interface ReGaugeResult {
  bubble: {
    series: { t: string; sale: number; fund: number; gap: number }[]   // 재기준 100 · gap %
    gapNow: number; gapPercentile: number                                // 현재 괴리·역사 백분위
    verdict: 'hot' | 'warm' | 'neutral' | 'cool'
    rateNow: number | null; base: string
  } | null
  m2: {
    series: { t: string; m2: number; apt: number }[]   // 1986-01=100 재기준(로그축용)
    m2Multiple: number; aptMultiple: number             // 1986 대비 배수
    spliceNote: string
  } | null
  sentiment: {
    series: { t: string; 전국: number | null; 서울: number | null; 수도권: number | null; 지방권: number | null }[]
    latest: { name: string; value: number }[]
    asOfMonth: string
  } | null
  psyche: {
    series: { t: string; 전국: number | null; 서울: number | null; 수도권: number | null; 지방: number | null }[]   // 2011-07~ 15년
    latest: { name: string; value: number }[]     // 최신월 시도 전체 스냅샷
    national: number | null                        // 전국 최신
    phase: '상승국면' | '보합국면' | '하강국면' | null   // 부동산원 공식 3국면(<95 하강 / 95~115 보합 / ≥115 상승)
    asOfMonth: string
  } | null
  asOf: string
}

const CACHE_KEY = 're-gauge-v2'   // v2: ④ 소비심리지수(psyche) 추가
const pct = (v: number) => Math.round(v * 10) / 10

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  if (!refresh) {
    const hit = await getCache<ReGaugeResult>(CACHE_KEY, 24 * 3600_000)
    if (hit) return NextResponse.json(hit, { headers: { 'Cache-Control': 'no-store' } })
  }

  const now = new Date(Date.now() + 9 * 3600_000)
  const endYm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  const [saleL, jeonseL, rate, m2Old, m2New, ...supRows] = await Promise.all([
    ecosSeries('901Y062', 'M', '198601', endYm, 'P63ACA'),   // KB 서울아파트 매매지수
    ecosSeries('901Y063', 'M', '198601', endYm, 'P64ACA'),   // KB 서울아파트 전세지수
    ecosSeries('121Y006', 'M', '200401', endYm, 'BECBLA0302'), // 주담대 금리
    ecosSeries('101Y004', 'M', '198601', '200310', 'BBHA00'),  // M2 구계열
    ecosSeries('161Y006', 'M', '200310', endYm, 'BBHA00'),     // M2 신계열
    roneSeries('A_2024_00076', 500001, '201801', endYm, '100001'),  // 수급 전국
    roneSeries('A_2024_00076', 500008, '201801', endYm, '100001'),  // 서울
    roneSeries('A_2024_00076', 500002, '201801', endYm, '100001'),  // 수도권
    roneSeries('A_2024_00076', 500003, '201801', endYm, '100001'),  // 지방권
  ])
  // ④ 주택시장 소비심리지수(2011-07~, 국토연구원 설문 — 부동산원 수급지수와 별개 축) — CLS 맵은 lib/rone RONE_PSY_CLS(실측)
  //   장기 4계열(전국·서울·수도권·지방, pSize 200) + 시도 스냅샷은 CLS 미지정 1콜(최근 3개월 전 지역 행)
  const psyStart = '201107'
  const snapStart = `${now.getUTCMonth() + 1 <= 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()}${String(((now.getUTCMonth() + 9) % 12) + 1).padStart(2, '0')}`
  const [psyKor, psySeoul, psyCap, psyLocal, psySnap] = await Promise.all([
    roneSeries(RONE_PSY_TBL, RONE_PSY_CLS['전국'], psyStart, endYm, '10001'),
    roneSeries(RONE_PSY_TBL, RONE_PSY_CLS['서울'], psyStart, endYm, '10001'),
    roneSeries(RONE_PSY_TBL, RONE_PSY_CLS['수도권'], psyStart, endYm, '10001'),
    roneSeries(RONE_PSY_TBL, RONE_PSY_CLS['지방'], psyStart, endYm, '10001'),
    roneSeries(RONE_PSY_TBL, null, snapStart, endYm, '10001', 600),   // 시도 스냅샷(CLS 미필터)
  ])

  // ── ① 적정성지수(주금공 프레임): 근본가치 ∝ 임대료(전세) ÷ 할인율(주담대) ──
  // ⚠️ 기준시점 민감(보고서 자체 비판) → 절대 gap이 아니라 '역사 백분위'로 판정
  let bubble: ReGaugeResult['bubble'] = null
  {
    const saleMap = new Map(saleL.map(r => [r.time, r.value]))
    const jeonMap = new Map(jeonseL.map(r => [r.time, r.value]))
    const rateMap = new Map(rate.map(r => [r.time, r.value]))
    const months = rate.map(r => r.time).filter(t => saleMap.has(t) && jeonMap.has(t))
    if (months.length >= 60) {
      const base = months[0]
      const s0 = saleMap.get(base)!, f0 = jeonMap.get(base)! / rateMap.get(base)!
      const series = months.map(t => {
        const sale = saleMap.get(t)! / s0 * 100
        const fund = (jeonMap.get(t)! / rateMap.get(t)!) / f0 * 100
        return { t: `${t.slice(0, 4)}-${t.slice(4)}`, sale: pct(sale), fund: pct(fund), gap: pct((sale / fund - 1) * 100) }
      })
      const gaps = series.map(x => x.gap)
      const gapNow = gaps[gaps.length - 1]
      const below = gaps.filter(g => g <= gapNow).length
      const gapPercentile = Math.round(below / gaps.length * 100)
      const verdict = gapPercentile >= 85 ? 'hot' : gapPercentile >= 65 ? 'warm' : gapPercentile <= 20 ? 'cool' : 'neutral'
      bubble = { series, gapNow, gapPercentile, verdict, rateNow: rate[rate.length - 1]?.value ?? null, base: `${base.slice(0, 4)}-${base.slice(4)}` }
    }
  }

  // ── ② M2 vs 서울아파트(1986~) — 구·신계열 접합(2003-10 겹침 비율) ──
  let m2: ReGaugeResult['m2'] = null
  {
    const oldAt = m2Old.find(r => r.time === '200310')?.value
    const newAt = m2New.find(r => r.time === '200310')?.value
    if (oldAt && newAt && saleL.length) {
      const factor = newAt / oldAt
      const spliced = [
        ...m2Old.filter(r => r.time < '200310').map(r => ({ time: r.time, value: r.value * factor })),
        ...m2New.map(r => ({ time: r.time, value: r.value })),
      ]
      const m2Map = new Map(spliced.map(r => [r.time, r.value]))
      const months = saleL.map(r => r.time).filter(t => m2Map.has(t))
      const base = months[0]
      const a0 = saleL.find(r => r.time === base)!.value, mBase = m2Map.get(base)!
      const series = months.map(t => ({
        t: `${t.slice(0, 4)}-${t.slice(4)}`,
        m2: pct(m2Map.get(t)! / mBase * 100),
        apt: pct(saleL.find(r => r.time === t)!.value / a0 * 100),
      }))
      const last = series[series.length - 1]
      m2 = {
        series, m2Multiple: Math.round(last.m2 / 100 * 10) / 10, aptMultiple: Math.round(last.apt / 100 * 10) / 10,
        spliceNote: '구계열(1986~2003.9)을 2003.10 겹침 비율로 신계열에 접합',
      }
    }
  }

  // ── ③ 매매수급지수(부동산원) — 100 기준 매수자/매도자 우위 ──
  let sentiment: ReGaugeResult['sentiment'] = null
  {
    const names = ['전국', '서울', '수도권', '지방권'] as const
    const maps = supRows.map(rows => new Map(rows.map(r => [r.time, r.value])))
    const months = Array.from(new Set(supRows.flatMap(rows => rows.map(r => r.time)))).sort()
    if (months.length) {
      const series = months.map(t => {
        const row: { t: string; 전국: number | null; 서울: number | null; 수도권: number | null; 지방권: number | null } =
          { t: `${t.slice(0, 4)}-${t.slice(4)}`, 전국: null, 서울: null, 수도권: null, 지방권: null }
        names.forEach((n, i) => { const v = maps[i].get(t); if (v != null) row[n] = pct(v) })
        return row
      })
      const lastT = months[months.length - 1]
      const latest = names.map((n, i) => ({ name: n, value: pct(maps[i].get(lastT) ?? NaN) })).filter(x => isFinite(x.value))
      sentiment = { series, latest, asOfMonth: `${lastT.slice(0, 4)}-${lastT.slice(4)}` }
    }
  }

  // ── ④ 주택시장 소비심리지수 — 공식 3국면(<95 하강 / 95~115 보합 / ≥115 상승) ──
  let psyche: ReGaugeResult['psyche'] = null
  {
    const names = ['전국', '서울', '수도권', '지방'] as const
    const seriesRows = [psyKor, psySeoul, psyCap, psyLocal]
    const maps = seriesRows.map(rows => new Map(rows.map(r => [r.time, r.value])))
    const months = Array.from(new Set(seriesRows.flatMap(rows => rows.map(r => r.time)))).sort()
    if (months.length) {
      const series = months.map(t => {
        const row: { t: string; 전국: number | null; 서울: number | null; 수도권: number | null; 지방: number | null } =
          { t: `${t.slice(0, 4)}-${t.slice(4)}`, 전국: null, 서울: null, 수도권: null, 지방: null }
        names.forEach((n, i) => { const v = maps[i].get(t); if (v != null) row[n] = pct(v) })
        return row
      })
      const lastT = months[months.length - 1]
      const national = maps[0].get(lastT) != null ? pct(maps[0].get(lastT)!) : null
      // 시도 스냅샷: CLS 미필터 응답에서 최신월 행만 — RONE_PSY_CLS 역맵으로 지역명 부여('소계' 행이라 CLS_ID가 유일 식별자)
      const idToName = new Map(Object.entries(RONE_PSY_CLS).map(([n, id]) => [String(id), n]))
      const snapLastT = psySnap.length ? psySnap[psySnap.length - 1].time : ''
      const latest = psySnap
        .filter(r => r.time === snapLastT && idToName.has(r.clsId))
        .map(r => ({ name: idToName.get(r.clsId)!, value: pct(r.value) }))
        .sort((a, b) => b.value - a.value)
      const phase = national == null ? null : national < 95 ? '하강국면' as const : national < 115 ? '보합국면' as const : '상승국면' as const
      psyche = { series, latest, national, phase, asOfMonth: `${lastT.slice(0, 4)}-${lastT.slice(4)}` }
    }
  }

  const result: ReGaugeResult = { bubble, m2, sentiment, psyche, asOf: new Date().toISOString() }
  // 부분 실패 박제 방지 — 4축 모두 성공 시에만 캐시
  if (bubble && m2 && sentiment && psyche) await setCache(CACHE_KEY, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
