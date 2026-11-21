// 빚(레버리지) 판정 SSOT(순수 함수) — "융자 잔고 ÷ 예탁금 비율이 최근 이력에서 얼마나 높은 자리인가"로 과열을 가른다
//   한국 빚투 레이더(/api/leverage-radar)의 규칙을 그대로 옮긴 것 — 미국 신용잔고(lib/usMargin)가 같은 잣대를 쓴다(2026-11-22).
//   절대 임계가 아니라 자기 이력 안의 자리(백분위)라, 단위·통화가 달라도 같은 규칙을 쓸 수 있다

export type LeverageLevel = 'stable' | 'caution' | 'danger'

/** 이력 안에서 v 이하인 값의 비율(0~100, 정수) — v 자신도 이력에 들어 있다 */
export const percentileOf = (arr: number[], v: number): number => Math.round((arr.filter(x => x <= v).length / arr.length) * 100)

/** 색을 가르는 자리(백분위) — 화면에 적는 규칙 문장도 이 숫자에서 나온다 */
export const LEV_DANGER_PCTL = 80          // 비율이 이 자리 이상이면 위험
export const LEV_COMBO_RATIO_PCTL = 65     // 비율이 이 자리 이상이면서
export const LEV_COMBO_MARGIN_PCTL = 90    //   잔고 자체가 이 자리 이상이어도 위험
export const LEV_CAUTION_PCTL = 60         // 비율이 이 자리 이상이면 주의

/** 경보: 비율 백분위가 주신호, 잔고 자체 백분위가 보조(둘 다 극단이면 위험) */
export function leverageLevel(ratioPercentile: number, marginPercentile: number): LeverageLevel {
  return ratioPercentile >= LEV_DANGER_PCTL || (ratioPercentile >= LEV_COMBO_RATIO_PCTL && marginPercentile >= LEV_COMBO_MARGIN_PCTL) ? 'danger'
    : ratioPercentile >= LEV_CAUTION_PCTL ? 'caution' : 'stable'
}
