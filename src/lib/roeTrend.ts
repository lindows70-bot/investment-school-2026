// 📈 ROE 추세 SSOT — "지금 좋은 회사"와 "좋아지고 있는 회사"를 가른다
//
// 왜 만들었나(손주부 인터뷰 2026-08-08): 앱은 ROE의 **절대 수준**만 봤다(15% 넘으면 가점).
// 그래서 3.5%→−17%→26.8%→35.6% 로 되살아난 SK하이닉스와 40%를 조용히 유지하는 코카콜라를
// 같은 방식으로 평가했다. 인터뷰의 지적: "ROE가 낮았는데 지금 급등하는 기업을 더 선호한다 —
// 현재 주가에 아직 반영되지 않았을 확률이 높으니까."
//
// ⚠️ Phase 0 실측이 설계를 두 번 바꿨다(docs/roe-trend/plan.md):
//  ① 절대 수준으로 등급을 매기면 안 된다 — 애플 ROE 197%·156%(자사주 매입으로 자기자본이 극소).
//     판정은 **방향**으로만 하고 절대값은 화면에 병기만 한다(roeInflated 가드와 같은 이유).
//  ② '평균 대비 개선'만 보면 꺾인 종목이 통과한다 — 엔비디아 19.8→69.2→91.9→**76.3**은
//     평균 대비 +16%p 개선이지만 최신이 전년보다 낮다. → `최신 ≥ 직전연도` 조건을 넣는다.
//
// ⛔ 점수 미반영 — 배지·근거 전용. 전향적 표본이 쌓이기 전에 점수에 넣지 않는다(앱 관례).
import { getCache, setCache } from '@/lib/appCache'

export type RoeTrendKind = 'improving' | 'deteriorating' | 'stable' | 'na'

export interface RoeYear { y: string; roe: number }
export interface RoeTrendResult {
  kind: RoeTrendKind
  years: RoeYear[]
  latest: number | null
  prevAvg: number | null        // 직전 연도들의 평균(최신 제외)
  deltaPp: number | null        // 최신 − 이전평균 (%p)
  note: string | null           // 학생 언어 한 줄(stable/na 는 null)
}

const NA: RoeTrendResult = { kind: 'na', years: [], latest: null, prevAvg: null, deltaPp: null, note: null }
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)
const r1 = (n: number) => Math.round(n * 10) / 10

/** 📈 ROE 방향 판정 — 순수 함수(결정론).
 *  임계 ±5%p 는 기존 해자 침식(총마진 −5%p)과 같은 잣대다. 실측 검증(2026-08-08):
 *  개선 SK하이닉스 +31.2%p·카니발 +44.7%p·마이크론 +13.8%p / 안정 코카콜라 −0.5%p·MSFT −2.3%p. */
export function assessRoeTrend(years: RoeYear[]): RoeTrendResult {
  const ys = [...years].sort((a, b) => a.y.localeCompare(b.y))
  if (ys.length < 3) return { ...NA, years: ys }
  const latest = ys[ys.length - 1].roe
  const prev = ys[ys.length - 2].roe
  const before = ys.slice(0, -1).map(x => x.roe)
  const prevAvg = r1(before.reduce((s, x) => s + x, 0) / before.length)
  const deltaPp = r1(latest - prevAvg)
  const base = { years: ys, latest: r1(latest), prevAvg, deltaPp }
  const nY = ys.length

  // 개선 — 꺾이지 않았고(최신 ≥ 직전연도) 과거 평균을 뚜렷이 넘어섰고 절대 수준도 최소선(10%) 이상
  if (latest >= prev && deltaPp >= 5 && latest >= 10) {
    return { ...base, kind: 'improving',
      note: `자본효율(ROE)이 좋아지는 중 — ${nY}년 평균 ${prevAvg}%였는데 최근 ${r1(latest)}%입니다(+${deltaPp}%p). 아직 주가에 덜 반영됐을 수 있어요` }
  }
  // 악화 — 꺾였고 과거 평균보다 뚜렷이 낮다
  if (latest <= prev && prevAvg - latest >= 5) {
    return { ...base, kind: 'deteriorating',
      note: `자본효율(ROE)이 나빠지는 중 — ${nY}년 평균 ${prevAvg}%였는데 최근 ${r1(latest)}%입니다(${deltaPp}%p). 경쟁이 심해졌는지 확인하세요` }
  }
  return { ...base, kind: 'stable', note: null }
}

/** 연간 ROE 시계열 수집 — buffettSell 과 같은 FTS annual 창(5년)을 쓴다. 캐시 24h(연간 재무는 분기에 한 번 바뀐다). */
export async function getRoeTrend(ticker: string, market: 'KR' | 'US'): Promise<RoeTrendResult> {
  const cacheKey = `roe-trend-v1:${ticker}:${market}`
  const cached = await getCache<RoeTrendResult>(cacheKey, 24 * 3600_000)
  if (cached) return cached
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'], validation: { logErrors: false } })
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    const p1 = new Date(); p1.setFullYear(p1.getFullYear() - 6)
    const period1 = p1.toISOString().slice(0, 10)
    const [fin, bs] = await Promise.all([
      yf.fundamentalsTimeSeries(sym, { period1, type: 'annual', module: 'financials' }).catch(() => null),
      yf.fundamentalsTimeSeries(sym, { period1, type: 'annual', module: 'balance-sheet' }).catch(() => null),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fa: any[] = Array.isArray(fin) ? fin : (fin?.timeSeries ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ba: any[] = Array.isArray(bs) ? bs : (bs?.timeSeries ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dt = (r: any) => (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10)
    // ⚠️ 자기자본 필드명이 종목마다 다르다 — 폴백 체인(이름 추측 금지·실측 확인)
    const eqMap = new Map<string, number | null>(
      ba.map(r => [dt(r), num(r.stockholdersEquity) ?? num(r.totalEquityGrossMinorityInterest) ?? num(r.commonStockEquity)]),
    )
    const years: RoeYear[] = fa.map(r => {
      const d = dt(r)
      // ⚠️ netIncome 이 없고 netIncomeContinuousOperations 만 오는 종목이 있다(실측: NVDA·MU·AAPL·CCL·TSM·KO)
      const ni = num(r.netIncome) ?? num(r.netIncomeCommonStockholders) ?? num(r.netIncomeContinuousOperations)
      const eq = eqMap.get(d)
      return ni != null && eq != null && eq > 0 ? { y: d.slice(0, 4), roe: r1(ni / eq * 100) } : null
    }).filter((x): x is RoeYear => x != null)

    const out = assessRoeTrend(years)
    await setCache(cacheKey, out)
    return out
  } catch { return NA }
}
