// 위기 신호등 API — 앱이 이미 가진 다섯 화면의 판정(수익률곡선·미국 유동성·위기 레이더·빚투 레이더·공포탐욕)과 설비투자÷번 돈·야데니 모델을 모아
//   lib/crisisSignal 로 등 9개 + VIX 긴 이력 차트를 조립한다(새 외부 원천은 설비투자 분기 자료 · FINRA 미국 신용잔고 · FRED VIX 이력 · 개인 데이터 0). 설계 docs/crisis-signal/plan.md
//   각 화면과 같은 라우트를 불러 같은 캐시·같은 판정을 쓴다 — 신호등 색이 선생님 화면과 달라지지 않게(제2원칙)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildCrisisSignal, type CrisisSignal, type CurveIn, type LiquidityIn, type RadarIn, type LeverageIn, type MoodIn } from '@/lib/crisisSignal'
import { fetchCapexCash, HYPERSCALERS, CAPEX_CASH_KEY, CAPEX_RED_PCT, CAPEX_YELLOW_PCT, type CapexCash } from '@/lib/capexCash'
import { FLAT_PP, RED_MIN_DAYS, HISTORY_MIN_DAYS, SAHM_TRIGGER_PP } from '@/lib/yieldCurve'
import { HY_WARN_PP, HY_BAD_PP, HY_SPIKE_PP } from '@/lib/usLiquidity'
import { fetchUsMargin, US_MARGIN_KEY, US_MARGIN_WINDOW_M, type UsMargin } from '@/lib/usMargin'
import { LEV_DANGER_PCTL, LEV_CAUTION_PCTL, LEV_COMBO_RATIO_PCTL, LEV_COMBO_MARGIN_PCTL } from '@/lib/leverageLevel'
import { fedModelOf, type FedModel } from '@/lib/fedModel'
import { fetchVixHistory, VIX_HISTORY_KEY, type VixHistory } from '@/lib/vixHistory'
import { FACTSET_FWD_KEY } from '@/lib/localRunners'
import { fredObservations } from '@/lib/fred'
import { buildBottomSignals, type Close, type EpsPoint } from '@/lib/bottomSignals'
import { dropOpenDay } from '@/lib/vixHistory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_KEY = 'crisis-signal-v6'   // v6: 바닥 신호 5칸(bottom) · VIX 비슷했던 날 2주 뒤 · v5: 야데니 모델 등 · VIX 긴 이력(vix) · 심리 등의 VIX 를 차트와 같은 값으로 · v4: 미국 빚 문장의 금액 표기 · v3: 미국 빚 등(FINRA 신용잔고) 추가 · 빚 → 한국 빚 · v2: 주식 값 줄의 음수 기호(−) · 날짜 없는 키 — 신선도는 TTL 로(날짜 키는 영구 누적) · 필드·문구가 바뀌면 올린다
const TTL = 3600_000
const STALE_TTL = 48 * 3600_000        // 새로 못 만들 때 보여 줄 마지막 성공분
const US_MARGIN_FAIL_KEY = 'us-margin-fail-v1'   // FINRA 조회 실패 표식(30분) — 날짜 없는 키
const BOTTOM_PX_KEY = 'bottom-prices-v1'   // S&P 500·애플 일봉(바닥 신호) — 날짜 없는 키
const EPS_HIST_KEY = 'fwd-eps-hist-v1'     // 거꾸로 구한 예상이익 주간 적립(한 행 덮어쓰기 · 최근 260주)
const BOTTOM_FROM = '2017-01-01'           // 과거 바닥은 2018년부터 센다 — 52주 고점을 재려고 한 해 앞에서 받는다
const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 자기 호출 — JSON 이 아니면(로그인 페이지 등) 못 가져온 것으로 친다 */
async function pull<T>(base: string, path: string): Promise<T | null> {
  try {
    const r = await fetch(`${base}${path}`, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(45_000) })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    return await r.json() as T
  } catch { return null }
}

/** 설비투자÷번 돈 — 분기 자료라 하루 한 번이면 충분하다(24시간). 목록에서 2곳 이상 빠진 결과는 박제하지 않는다 */
async function getCapexCash(): Promise<CapexCash | null> {
  const cached = await getCache<CapexCash>(CAPEX_CASH_KEY, 24 * 3600_000)
  if (cached) return cached
  const out = await fetchCapexCash()
  if (out && out.count >= HYPERSCALERS.length - 1) await setCache(CAPEX_CASH_KEY, out)
  return out
}

/** 미국 신용잔고 — 월 1회 나오는 통계라 하루 한 번이면 충분하다(24시간). FINRA 가 막히거나 형식이 바뀐 날은 마지막 성공분(45일 — 다음 달 발표 전까지)으로 */
async function getUsMargin(): Promise<UsMargin | null> {
  const cached = await getCache<UsMargin>(US_MARGIN_KEY, 24 * 3600_000)
  if (cached) return cached
  // 방금 실패했으면 30분은 다시 두드리지 않는다 — FINRA 가 막힌 날 홈을 열 때마다 타임아웃까지 기다리게 된다
  const failed = await getCache<{ at: string }>(US_MARGIN_FAIL_KEY, 30 * 60_000)
  if (!failed) {
    const out = await fetchUsMargin()
    if (out) { await setCache(US_MARGIN_KEY, out); return out }
    await setCache(US_MARGIN_FAIL_KEY, { at: new Date().toISOString() })
  }
  return await getCache<UsMargin>(US_MARGIN_KEY, 45 * 86_400_000)
}

/** 야데니 모델 입력 — 선행 PER 은 위기 레이더·저울과 같은 FactSet 캐시(선생님 PC 러너가 주 1회 적재 · 30일 유효), 10년 금리는 FRED DGS10 최신 */
async function getFedModel(): Promise<FedModel | null> {
  const [fwd, y10] = await Promise.all([
    getCache<{ fwd: number; date: string }>(FACTSET_FWD_KEY, 30 * 86_400_000),
    fredObservations('DGS10', { sort_order: 'desc', limit: 10 }, { timeoutMs: 15_000 }).catch(() => []),
  ])
  const y = y10[0]
  return fwd && y ? fedModelOf({ fwdPe: fwd.fwd, fwdDate: fwd.date, y10: y.v, y10Date: y.date }) : null
}

/** VIX 긴 이력 — 하루 한 번 종가가 늘 뿐이라 6시간이면 충분하다. 실패하면 마지막 성공분(3일) */
async function getVix(): Promise<VixHistory | null> {
  const cached = await getCache<VixHistory>(VIX_HISTORY_KEY, 6 * 3600_000)
  if (cached) return cached
  const out = await fetchVixHistory()
  if (out) { await setCache(VIX_HISTORY_KEY, out); return out }
  return await getCache<VixHistory>(VIX_HISTORY_KEY, 3 * 86_400_000)
}

/** 야후 일봉 종가(뉴욕 날짜 · 진행 중인 오늘 봉 제외) — S&P 500·애플. 실패 = 빈 배열 */
async function yahooCloses(symbol: string, from: string): Promise<Close[]> {
  try {
    const p1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000), p2 = Math.floor(Date.now() / 1000)
    const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return []
    const res = (await r.json())?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? [], close: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
    const rows = ts.flatMap((t, i) => { const c = close[i]; return typeof c === 'number' && Number.isFinite(c) && c > 0 ? [{ date: NY_DATE.format(new Date(t * 1000)), v: c }] : [] })
    return dropOpenDay(rows).map(x => ({ date: x.date, c: x.v }))
  } catch { return [] }
}

/** 바닥 신호 재료 — S&P 500·애플 일봉(2017년부터 · 6시간 캐시) + 주마다 적립하는 '거꾸로 구한 예상이익' */
async function getBottomInputs(): Promise<{ spx: Close[]; aapl: Close[]; epsHist: EpsPoint[] }> {
  let px = await getCache<{ spx: Close[]; aapl: Close[] }>(BOTTOM_PX_KEY, 6 * 3600_000)
  if (!px) {
    const [spx, aapl] = await Promise.all([yahooCloses('^GSPC', BOTTOM_FROM), yahooCloses('AAPL', BOTTOM_FROM)])
    if (spx.length > 1000 && aapl.length > 1000) { px = { spx, aapl }; await setCache(BOTTOM_PX_KEY, px) }
    else px = await getCache<{ spx: Close[]; aapl: Close[] }>(BOTTOM_PX_KEY, 3 * 86_400_000) ?? { spx, aapl }
  }
  // 예상이익 적립 — FactSet 기준일이 새로 나오면 그날(이하 최근) S&P 500 종가 ÷ 선행 PER 을 한 줄 더한다(전향적 적립 · 소급 없음)
  const hist = (await getCache<EpsPoint[]>(EPS_HIST_KEY, 3650 * 86_400_000)) ?? []
  const fwd = await getCache<{ fwd: number; date: string }>(FACTSET_FWD_KEY, 30 * 86_400_000)
  if (fwd && typeof fwd.fwd === 'number' && fwd.fwd > 5 && /^\d{4}-\d{2}-\d{2}$/.test(fwd.date) && !hist.some(h => h.date === fwd.date)) {
    const at = px.spx.filter(x => x.date <= fwd.date).pop()
    // 그날 종가가 열흘 넘게 묵었으면(자료 구멍) 적지 않는다 — 다른 날 값을 그날 이름으로 남기지 않게
    if (at && Date.parse(fwd.date) - Date.parse(at.date) <= 10 * 86_400_000) {
      const next = [...hist, { date: fwd.date, eps: Math.round(at.c / fwd.fwd * 100) / 100 }].sort((a, b) => a.date < b.date ? -1 : 1).slice(-260)
      await setCache(EPS_HIST_KEY, next)
      return { ...px, epsHist: next }
    }
  }
  return { ...px, epsHist: hist }
}

export async function GET(req: Request) {
  const fresh = await getCache<CrisisSignal>(CACHE_KEY, TTL)
  if (fresh) return NextResponse.json(fresh, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin   // 자기 호출은 공개 주소로(배포 고유 주소는 로그인 보호에 걸린다)
  const [curve, liquidity, radar, leverage, mood, capex, usMargin, fedModel, vix, breadth, bottomIn] = await Promise.all([
    pull<CurveIn>(base, '/api/yield-curve'),
    pull<LiquidityIn>(base, '/api/us-liquidity'),
    pull<RadarIn>(base, '/api/crisis-radar'),
    pull<LeverageIn>(base, '/api/leverage-radar'),
    pull<MoodIn>(base, '/api/cocktail-party'),
    getCapexCash().catch(() => null),
    getUsMargin().catch(() => null),
    getFedModel().catch(() => null),
    getVix().catch(() => null),
    pull<{ us?: { pctAbove50?: number; n?: number; series?: { date: string }[] } }>(base, '/api/market-breadth'),
    getBottomInputs().catch(() => ({ spx: [] as Close[], aapl: [] as Close[], epsHist: [] as EpsPoint[] })),
  ])
  const result = buildCrisisSignal({
    now: new Date().toISOString(), curve, liquidity, radar, usMargin, fedModel, vix, leverage, mood, capex,
    rules: { flatPp: FLAT_PP, redDays: RED_MIN_DAYS, historyMinDays: HISTORY_MIN_DAYS, sahmPp: SAHM_TRIGGER_PP, hyWarn: HY_WARN_PP, hyBad: HY_BAD_PP, hySpike: HY_SPIKE_PP, capexRed: CAPEX_RED_PCT, capexYellow: CAPEX_YELLOW_PCT, levDanger: LEV_DANGER_PCTL, levCaution: LEV_CAUTION_PCTL, levComboRatio: LEV_COMBO_RATIO_PCTL, levComboMargin: LEV_COMBO_MARGIN_PCTL, usWindowM: US_MARGIN_WINDOW_M },
  })

  const us = breadth?.us
  result.bottom = bottomIn.spx.length > 300 ? buildBottomSignals({
    mood, vix, spx: bottomIn.spx, aapl: bottomIn.aapl, epsHist: bottomIn.epsHist, sahm: curve?.sahm ?? null, since: '2018-01-01',
    breadth: us ? { pctAbove50: us.pctAbove50, n: us.n, date: us.series?.[us.series.length - 1]?.date } : null,
  }) : null

  // 등을 전부 잰 응답(+ VIX 차트)만 캐시한다 — 한 번의 실패가 한 시간짜리 '모름'으로 박제되지 않게(부분실패 캐시 금지)
  if (result.measured === result.total && result.vix && result.bottom) {
    await setCache(CACHE_KEY, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  }
  // 일부를 못 쟀으면 마지막 성공분이 더 낫다(잰 등이 더 많을 때만) — 낡았다는 사실을 함께 싣는다
  const last = await getCache<CrisisSignal>(CACHE_KEY, STALE_TTL)
  if (last && last.measured > result.measured) return NextResponse.json({ ...last, stale: true }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
