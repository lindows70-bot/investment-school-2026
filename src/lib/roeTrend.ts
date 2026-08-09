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
//
// 🔬 소급 백테스트 결론(2026-08-09) — **점수 승격 기각.** 아래 ROE_TREND_BACKTEST 참조.
//   인터뷰의 가설("ROE가 급등하는 기업은 아직 주가에 덜 반영됐다")은 우리 표본에서 지지되지 않았다.
//   문구도 그에 맞춰 고쳤다 — 검증되지 않은 주장을 학생 화면에 남겨두면 그게 가짜 정밀이다.
import { getCache, setCache } from '@/lib/appCache'

export type RoeTrendKind = 'improving' | 'deteriorating' | 'stable' | 'na'

/** 🔬 소급 백테스트 성적 — 숫자를 문구에 흩뿌리지 않고 여기 한 곳에 둔다(백테스트 관례).
 *  방법: 유니버스 등간격 층화 표본 → 최신 회계연도를 **빼고** 판정(룩어헤드 차단) →
 *        판정에 쓴 마지막 회계연도 종료 +4개월(공시 지연)부터 12개월 수익률 → 같은 표본 평균 대비 초과분.
 *  4단 해부: ①종목 분산 ✅ ②섹터 점유 24% ✅ ③시점 분산 ❌ ④이상치 제거 — improving 사망.
 *  ⚠️ 가장 큰 한계: Yahoo 연간 재무가 **정확히 4년**뿐이라(실측 208/208종·6년 이상 0%)
 *     판정에 3년을 쓰면 코호트를 하나밖에 못 만든다. 다년 교차 검증이 데이터상 불가능하다. */
export const ROE_TREND_BACKTEST = {
  sample: 285,              // 판정 가능 관측 수(320종 표본 중)
  startMonth: '2025-05',    // 사실상 단일 시점 — 12월 결산이 대부분이라 구조적으로 뭉친다
  improvingN: 43,
  improvingEdgePp: -5.2,    // 상하위 10% 절사 후 초과분(원 +6.8%p 는 소수 대박이 만든 것 — 중위는 기준선보다 낮았다)
  deterioratingN: 69,
  deterioratingEdgePp: 21.8,// 절사 후에도 생존했으나 ③시점 분산 미통과 → 승격 불가
  verdict: 'not_promoted',
} as const

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
    // ⚠️ 예전 문구는 "아직 주가에 덜 반영됐을 수 있어요"였다 — 소급 확인에서 **반증됐다**(초과 −5.2%p).
    //    좋은 회사라는 사실과 싼 주식이라는 주장은 다르다. 후자는 근거가 없으면 쓰지 않는다.
    return { ...base, kind: 'improving',
      note: `자본효율(ROE)이 좋아지는 중 — ${nY}년 평균 ${prevAvg}%였는데 최근 ${r1(latest)}%입니다(+${deltaPp}%p). 다만 소급 확인(${ROE_TREND_BACKTEST.sample}종·${ROE_TREND_BACKTEST.startMonth} 시작 1개 시점)에선 이런 종목들이 이후 1년간 시장 평균보다 더 오르지는 않았습니다 — 좋은 회사라는 뜻이지 싼 주식이라는 뜻은 아닙니다` }
  }
  // 악화 — 꺾였고 과거 평균보다 뚜렷이 낮다
  if (latest <= prev && prevAvg - latest >= 5) {
    return { ...base, kind: 'deteriorating',
      note: `자본효율(ROE)이 나빠지는 중 — ${nY}년 평균 ${prevAvg}%였는데 최근 ${r1(latest)}%입니다(${deltaPp}%p). 경쟁이 심해졌는지 확인하세요. 다만 이것만으로 파는 근거는 아닙니다 — 같은 소급 확인에서 ROE가 꺾인 구간이 오히려 반등의 출발점인 경우가 많았습니다(시점이 하나뿐이라 일반화는 못 합니다)` }
  }
  return { ...base, kind: 'stable', note: null }
}

/** 연간 ROE 시계열 수집 — buffettSell 과 같은 FTS annual 창(5년)을 쓴다. 캐시 24h(연간 재무는 분기에 한 번 바뀐다). */
export async function getRoeTrend(ticker: string, market: 'KR' | 'US'): Promise<RoeTrendResult> {
  const cacheKey = `roe-trend-v2:${ticker}:${market}`   // v2: 📉 note 문구 교체(소급 백테스트 반증 반영 — 스키마 동일이라 훅이 못 잡는다)
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
