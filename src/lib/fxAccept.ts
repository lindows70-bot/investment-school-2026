// 학생 화면 환율 채택 규칙 SSOT — /api/exchange-rate 응답을 '지금 환율'로 믿을 수 있을 때만 숫자로 돌려준다

/**
 * 환율 응답 → 쓸 수 있는 USD/KRW 또는 null(못 가져옴).
 * 환율 라우트는 모든 원천이 죽으면 고정 상수(source 'stale-constant')를 주는데, 그건 지금 환율이 아니므로 받지 않는다.
 * 500 미만은 단위·스케일이 틀린 값으로 본다.
 */
export function acceptFx(resp: unknown): number | null {
  if (!resp || typeof resp !== 'object') return null
  const { rate, source } = resp as { rate?: unknown; source?: unknown }
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 500 && source !== 'stale-constant' ? rate : null
}
