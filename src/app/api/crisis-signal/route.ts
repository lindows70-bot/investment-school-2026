// 위기 신호등 API — 앱이 이미 가진 다섯 화면의 판정(수익률곡선·미국 유동성·위기 레이더·빚투 레이더·공포탐욕)과 설비투자÷번 돈을 모아
//   lib/crisisSignal 로 등 8개를 조립한다(새 외부 원천은 설비투자 분기 자료와 FINRA 미국 신용잔고 둘 · 개인 데이터 0). 설계 docs/crisis-signal/plan.md
//   각 화면과 같은 라우트를 불러 같은 캐시·같은 판정을 쓴다 — 신호등 색이 선생님 화면과 달라지지 않게(제2원칙)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildCrisisSignal, type CrisisSignal, type CurveIn, type LiquidityIn, type RadarIn, type LeverageIn, type MoodIn } from '@/lib/crisisSignal'
import { fetchCapexCash, HYPERSCALERS, CAPEX_CASH_KEY, CAPEX_RED_PCT, CAPEX_YELLOW_PCT, type CapexCash } from '@/lib/capexCash'
import { FLAT_PP, RED_MIN_DAYS, HISTORY_MIN_DAYS, SAHM_TRIGGER_PP } from '@/lib/yieldCurve'
import { HY_WARN_PP, HY_BAD_PP, HY_SPIKE_PP } from '@/lib/usLiquidity'
import { fetchUsMargin, US_MARGIN_KEY, US_MARGIN_WINDOW_M, type UsMargin } from '@/lib/usMargin'
import { LEV_DANGER_PCTL, LEV_CAUTION_PCTL, LEV_COMBO_RATIO_PCTL, LEV_COMBO_MARGIN_PCTL } from '@/lib/leverageLevel'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_KEY = 'crisis-signal-v3'   // v3: 미국 빚 등(FINRA 신용잔고) 추가 · 빚 → 한국 빚 · v2: 주식 값 줄의 음수 기호(−) · 날짜 없는 키 — 신선도는 TTL 로(날짜 키는 영구 누적) · 필드·문구가 바뀌면 올린다
const TTL = 3600_000
const STALE_TTL = 48 * 3600_000        // 새로 못 만들 때 보여 줄 마지막 성공분
const US_MARGIN_FAIL_KEY = 'us-margin-fail-v1'   // FINRA 조회 실패 표식(30분) — 날짜 없는 키

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

export async function GET(req: Request) {
  const fresh = await getCache<CrisisSignal>(CACHE_KEY, TTL)
  if (fresh) return NextResponse.json(fresh, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin   // 자기 호출은 공개 주소로(배포 고유 주소는 로그인 보호에 걸린다)
  const [curve, liquidity, radar, leverage, mood, capex, usMargin] = await Promise.all([
    pull<CurveIn>(base, '/api/yield-curve'),
    pull<LiquidityIn>(base, '/api/us-liquidity'),
    pull<RadarIn>(base, '/api/crisis-radar'),
    pull<LeverageIn>(base, '/api/leverage-radar'),
    pull<MoodIn>(base, '/api/cocktail-party'),
    getCapexCash().catch(() => null),
    getUsMargin().catch(() => null),
  ])
  const result = buildCrisisSignal({
    now: new Date().toISOString(), curve, liquidity, radar, usMargin, leverage, mood, capex,
    rules: { flatPp: FLAT_PP, redDays: RED_MIN_DAYS, historyMinDays: HISTORY_MIN_DAYS, sahmPp: SAHM_TRIGGER_PP, hyWarn: HY_WARN_PP, hyBad: HY_BAD_PP, hySpike: HY_SPIKE_PP, capexRed: CAPEX_RED_PCT, capexYellow: CAPEX_YELLOW_PCT, levDanger: LEV_DANGER_PCTL, levCaution: LEV_CAUTION_PCTL, levComboRatio: LEV_COMBO_RATIO_PCTL, levComboMargin: LEV_COMBO_MARGIN_PCTL, usWindowM: US_MARGIN_WINDOW_M },
  })

  // 등을 전부 잰 응답만 캐시한다 — 한 번의 실패가 한 시간짜리 '모름'으로 박제되지 않게(부분실패 캐시 금지)
  if (result.measured === result.total) {
    await setCache(CACHE_KEY, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  }
  // 일부를 못 쟀으면 마지막 성공분이 더 낫다(잰 등이 더 많을 때만) — 낡았다는 사실을 함께 싣는다
  const last = await getCache<CrisisSignal>(CACHE_KEY, STALE_TTL)
  if (last && last.measured > result.measured) return NextResponse.json({ ...last, stale: true }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
