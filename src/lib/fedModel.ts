// 야데니 모델(연준 모델) — 주식의 예상이익 수익률(1 ÷ 선행 PER)과 미국 10년 국채 금리를 견준다(위기 신호등 '야데니 모델' 등 · 2026-11-22 사용자 요청)
//   에드 야데니가 1997년 연준 보고서의 그림을 보고 'Fed's Stock Valuation Model'이라 이름 붙인 원래 식만 쓴다.
//   ⚠️ 야데니가 뒤에 고친 식(장기 이익 성장 전망을 넣는 식)은 그 전망치의 무료 원천이 없어 쓰지 않는다 — 지어내지 않는다
//   입력은 다른 화면과 같은 원천 — 선행 PER = FactSet 주간 값(위기 레이더·저울과 같은 캐시) · 10년 금리 = FRED DGS10

export interface FedModel {
  fwdPe: number; fwdDate: string       // 선행 PER(배) · FactSet 기준일
  y10: number; y10Date: string         // 10년 국채 금리(%) · FRED 기준일
  eyPct: number                        // 예상이익 수익률 = 100 ÷ 선행 PER
  gapPp: number                        // 예상이익 수익률 − 10년 금리(%p) — 양수면 주식이 국채보다 더 준다
  fairPe: number                       // 모델이 말하는 제값 PER = 100 ÷ 10년 금리
  vsFairPct: number                    // 지금 PER 이 제값보다 몇 % 높은가(음수 = 낮다)
  cheap: boolean                       // 모델 정의 그대로 — 예상이익 수익률 ≥ 10년 금리면 주식이 상대적으로 싸다
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

/** 순수 계산 — 값이 상식 범위 밖이면 null(선행 PER 5~60배 · 금리 0~20%) */
export function fedModelOf(inp: { fwdPe: unknown; fwdDate: unknown; y10: unknown; y10Date: unknown }): FedModel | null {
  const { fwdPe, y10, fwdDate, y10Date } = inp
  if (typeof fwdPe !== 'number' || typeof y10 !== 'number' || !(fwdPe > 5 && fwdPe < 60) || !(y10 > 0 && y10 < 20)) return null
  if (typeof fwdDate !== 'string' || typeof y10Date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fwdDate) || !/^\d{4}-\d{2}-\d{2}/.test(y10Date)) return null
  const ey = 100 / fwdPe, fair = 100 / y10
  return {
    fwdPe, fwdDate: fwdDate.slice(0, 10), y10, y10Date: y10Date.slice(0, 10),
    eyPct: r2(ey), gapPp: r2(ey - y10), fairPe: r1(fair), vsFairPct: r1((fwdPe / fair - 1) * 100), cheap: ey >= y10,
  }
}
