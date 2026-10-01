// 투자학교 저울 API — 다섯 자산 × 세 질문 칸을 기존 원천에서 모아 lib/scale 로 조립한다(새 외부 원천 0, 개인 데이터 0)
//   원천(전부 다른 화면과 같은 SSOT·같은 캐시를 먼저 읽는다 — 저울 숫자가 채권·위기 레이더·부동산·코인 화면과 달라지지 않게):
//   채권 = bonds-v8 캐시의 realYield(없으면 buildRealYield) · 주식 = FactSet 로컬 러너 캐시(FACTSET_FWD_KEY)
//   부동산 = re-market 캐시 kpi(RE_MARKET_KEY · 없으면 /api/re-market) · 금 = getTechCandles('GC=F') + 물가 뺀 이자 · 코인 = alternative.me 공포·탐욕
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildRealYield, type RealYieldResult } from '@/lib/realYield'
import { fetchDfii10Avg10, fetchM2Yoy, fetchMortgageAvg10 } from '@/lib/fredScaleInputs'   // 채권·금 ② 비교 기준(10년 평균) · 코인 ③ M2
import { FACTSET_FWD_KEY } from '@/lib/localRunners'
import { getTechCandles, dropIncompleteBar } from '@/lib/techChartData'
import { fetchCryptoFng } from '@/lib/cryptoFng'
import { buildScale, goldPoints, chipsOf, diffChips, rollSnap, type ScaleInput, type ScaleResult, type ChipSnap } from '@/lib/scale'
import type { ReMarketResult } from '@/app/api/re-market/route'
import { RE_MARKET_KEY } from '@/lib/reMarketKey'
import { getRegionSeasons } from '@/lib/regionSeason'
import { SCALE_HIST_KEY, snapOf, addSnap, type ScaleSnap } from '@/lib/scaleScore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_KEY = 'scale-v7'   // v7: 부동산 ② 칩(주담대 금리 10년 평균) · v6: 채권·금 ② 칩(DFII10 10년 평균) + 코인 ③ M2 문장 · v5: 줄 끝 코어·위성 꼬리표(tail) · v4: changes·changedSince(오늘 바뀐 칸) · v3: ③ 순풍·보통·역풍 칩(선생님 승인 원칙) · v2: ③ 계절 칸 + 주담대(기준월) — 필드·내용이 바뀌면 키를 올린다   // 날짜 없는 키 — 신선도는 TTL 로(날짜 키는 영구 누적)
const TTL = 3600_000
// 칩 스냅샷 — 날짜 없는 키 한 행을 덮어쓴다(오늘 칩 + 비교 기준이 될 지난 날 칩). 날짜 키는 영구 누적이라 쓰지 않는다
const SNAP_KEY = 'scale-chips-v1'
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const cached = await getCache<ScaleResult>(CACHE_KEY, TTL)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const origin = new URL(req.url).origin
  const [realYield, factset, kbRaw, gold, fng, seasons, avg10, m2, mortAvg10] = await Promise.all([
    (async (): Promise<RealYieldResult | null> => {
      const b = await getCache<{ realYield: RealYieldResult | null }>('bonds-v8', 6 * 3600_000, { sameKstDay: true })
      return b?.realYield ?? await buildRealYield().catch(() => null)
    })(),
    getCache<{ fwd: number; avg5: number | null; avg10: number | null; date: string }>(FACTSET_FWD_KEY, 30 * 24 * 3600_000),
    (async (): Promise<ScaleInput['kb']> => {
      let rm = await getCache<ReMarketResult>(RE_MARKET_KEY, 12 * 3600_000)
      if (!rm) rm = await fetch(`${origin}/api/re-market`, { cache: 'no-store', signal: AbortSignal.timeout(40_000) }).then(r => r.ok ? r.json() : null).catch(() => null)
      const k = rm?.kpi
      if (!(k && typeof k.kbAptYoY === 'number' && k.asOfKb)) return null
      // 주담대는 기준월이 있을 때만 싣는다(이름표 없는 숫자 금지)
      const mortgage = typeof k.mortgageRate === 'number' && k.asOfMortgage ? { v: k.mortgageRate, asOf: k.asOfMortgage } : null
      return { yoy: k.kbAptYoY, asOf: k.asOfKb, mortgage }
    })(),
    getTechCandles('GC=F', 'US', 'D').then(c => goldPoints(dropIncompleteBar(c, 'US'))).catch(() => null),
    fetchCryptoFng(),
    getRegionSeasons(origin).catch(() => null),
    fetchDfii10Avg10().catch(() => null),
    fetchM2Yoy().catch(() => null),
    fetchMortgageAvg10().catch(() => null),
  ])
  const kb = kbRaw && kbRaw.mortgage ? { ...kbRaw, mortgage: { ...kbRaw.mortgage, avg10: mortAvg10 } } : kbRaw

  const result = buildScale({
    today: kstToday(),
    realYield: realYield ? { nominal: realYield.nominal, real: realYield.real, bei: realYield.bei, avg10 } : null,
    factset, kb, gold, fng, m2,
    season: seasons ? {
      us: { quad: seasons.quad.US, cliMonth: seasons.meta.cli.US.month, cliOk: seasons.meta.cli.US.ok },
      kr: { quad: seasons.quad.KR, cliMonth: seasons.meta.cli.KR.month, cliOk: seasons.meta.cli.KR.ok },
      cpiYoY: seasons.cpiYoY, cpiMonth: seasons.meta.cpiMonth, cpiOk: seasons.meta.cpiOk,
      rateDir: seasons.rateDir, rateDirOk: seasons.meta.rateDirOk, nextFomc: seasons.meta.nextFomc,
    } : null,
  })
  // 한 칸이라도 원천이 비어 쉬면 캐시하지 않는다 — 한 번의 실패가 한 시간짜리 빈칸이 되지 않게(부분실패 박제 금지)
  const anyHold = result.rows.some(r => r.cells.some(c => c.status === 'hold'))
  // 오늘 바뀐 칸 — 칩만 비교. 스냅샷은 칸이 다 찬 결과로만 넘긴다(쉬는 칸이 있는 날의 칩으로 기준을 바꾸지 않게)
  const now = chipsOf(result)
  const snap = await getCache<ChipSnap>(SNAP_KEY, 400 * 86400_000)
  const next = rollSnap(snap, kstToday(), now)
  result.changes = diffChips(next.prevChips, now, result.rows)
  result.changedSince = next.prevDay
  // 보조 재료(10년 평균·M2)가 빠진 응답은 캐시하지 않는다 — 한 번의 FRED 실패가 한 시간짜리 '비교 기준 없음'으로 박제되지 않게(부분실패 캐시 금지)
  if (!anyHold) { await setCache(SNAP_KEY, next); if (avg10 && m2 && (mortAvg10 || !kb?.mortgage)) await setCache(CACHE_KEY, result) }
  // 채점표 적립 — 오늘 한 장(불변). ③ 다섯 칸이 모두 칩으로 판정된 날만(간절기·재료 폴백이면 적지 않는다). 소급 없음(docs/scale/scoring-plan.md)
  try {
    const seasonsValid = result.rows.every(r => r.cells[2].status === 'ok' && !!r.cells[2].chip)
    const stockChip = result.rows.find(r => r.asset === 'stock')?.cells[1].chip ?? null
    const snap = seasons ? snapOf(kstToday(), seasons.quad.US, seasons.quad.KR, seasonsValid, stockChip, fng?.now ?? null) : null
    if (snap) {
      const hist = (await getCache<ScaleSnap[]>(SCALE_HIST_KEY, 3650 * 86400_000)) ?? []
      const nextHist = addSnap(hist, snap)
      if (nextHist) await setCache(SCALE_HIST_KEY, nextHist)
    }
  } catch { /* 채점표는 부가 기능 — 실패해도 저울 응답은 그대로 */ }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
