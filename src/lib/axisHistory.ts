// 📐 축별 성적 적립 SSOT — "6축 중 **어느 축이 실제로 맞았나**"를 전향적으로 채점하기 위한 스토어·채점기
//
// 왜 필요한가: 앱은 6축에 가중치(가치 25%·퀄리티 20%…)를 주는데, 그 배분이 옳은지 말해주는 데이터가 없었다.
//   2026-08-09 가중치 검토에서 수익률 최적화를 시도했다가 **역인과**로 무효 판정했다(가치 판정에 가격
//   파생 성분이 있어 "많이 오른 종목 = 오늘 불통과"가 된다). 소급이 막혔으므로 **전향적 적립만이 유일한 길**이다.
//   ROE 추세 백테스트(같은 날)도 같은 결론이었다 — 소급이 유효한 건 가격 비의존 성분뿐이다.
//
// ⛔ 지어내지 않는다: 표본이 적으면 '적립 중'이라고 말한다(가짜 정밀 금지·표본 10 미만은 통계가 아니라 일화).
// ⛔ 이 채점 결과로 가중치를 자동 조정하지 않는다. 사람이 보고 판단할 근거를 쌓는 것까지가 여기 역할이다.
export const AXIS_HIST_KEY = 'axis-history-v1'

export type AxisKey = 'value' | 'quality' | 'momentum' | 'rotation' | 'supply' | 'season'

export const AXIS_META: { key: AxisKey; label: string }[] = [
  { key: 'value', label: '💎 가치' },
  { key: 'quality', label: '🏰 퀄리티' },
  { key: 'momentum', label: '📈 모멘텀' },
  { key: 'rotation', label: '🧭 주도섹터' },
  { key: 'supply', label: '💰 수급' },
  { key: 'season', label: '🌦️ 계절' },
]

export interface AxisHistEntry {
  date: string
  ticker: string
  name: string
  market: 'KR' | 'US'
  /** 'pick' = 추천 본목록 · 'ref' = 지역 참고(순위 무관) — 참고까지 담아야 축 값의 분산이 생긴다
   *  (본목록만 쌓으면 전부 고득점이라 "높은 축이 좋았나"를 물을 대조군이 없다) */
  slot: 'pick' | 'ref'
  axes: Record<AxisKey, number>
  combined: number
}

export interface AxisGrade {
  key: AxisKey
  label: string
  /** 채점 가능 표본(30일 경과) */
  n: number
  /** 상위 1/3 평균 30일 수익률 % */
  topAvg: number | null
  /** 하위 1/3 평균 30일 수익률 % */
  botAvg: number | null
  /** 상위 − 하위 (%p) — 이게 양수라야 "그 축이 높을수록 좋았다"고 말할 수 있다 */
  spreadPp: number | null
  /** 상위 1/3 중 상승 비율 % */
  topWin: number | null
  /** ⚠️ 표본이 기준(30건) 미만이면 true — 화면은 수치 대신 '적립 중'을 보여야 한다 */
  thin: boolean
}

/** 축별 채점 — 각 축의 **상위 1/3 vs 하위 1/3** 이후 수익률을 비교한다.
 *  ⚠️ 절대 임계(≥70 등)를 쓰지 않는 이유: 축마다 분포가 딴판이다(계절은 55·80·100 계단, 가치는 0~100 연속).
 *     같은 '70점'이 축마다 다른 백분위라 축 간 비교가 무의미해진다. 분위수는 분포에 무관하게 공정하다.
 *  ⚠️ 시장 대비가 아니라 **표본 내부 비교**다 — 같은 날 같은 목록에서 뽑히므로 국면이 자동으로 상쇄된다. */
export function gradeAxes(rows: { axes: Record<AxisKey, number>; ret: number | null }[], minSample = 30): AxisGrade[] {
  const scored = rows.filter(r => r.ret != null) as { axes: Record<AxisKey, number>; ret: number }[]
  const r1 = (x: number) => Math.round(x * 10) / 10
  const avg = (a: number[]) => (a.length ? r1(a.reduce((s, x) => s + x, 0) / a.length) : null)

  return AXIS_META.map(({ key, label }) => {
    const n = scored.length
    if (n < 6) return { key, label, n, topAvg: null, botAvg: null, spreadPp: null, topWin: null, thin: true }
    const sorted = [...scored].sort((a, b) => a.axes[key] - b.axes[key])
    const cut = Math.floor(n / 3)
    const bot = sorted.slice(0, cut).map(x => x.ret)
    const top = sorted.slice(n - cut).map(x => x.ret)
    const topAvg = avg(top), botAvg = avg(bot)
    return {
      key, label, n, topAvg, botAvg,
      spreadPp: topAvg != null && botAvg != null ? r1(topAvg - botAvg) : null,
      topWin: top.length ? Math.round(top.filter(x => x > 0).length / top.length * 100) : null,
      thin: n < minSample,
    }
  })
}
