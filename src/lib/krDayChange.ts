// 국내 종목 당일 등락률 SSOT — 네이버 종목별 trend 행의 '전일 대비'(compareToPreviousClosePrice)로 계산한다(네이버 표시값과 같은 식)
//   ⚠️ 이전 행의 closePrice 로 나누지 마라 — 그 값은 공식 전일 종가가 아니다(2026-09-27 실측: 삼성전자 9/22 행 277,500 vs 공식 276,500 →
//      앱 +3.24% vs 네이버 +3.62%, 엘앤에프 +0.18% vs +1.01%). 넥스트레이드 애프터마켓까지 반영된 값으로 보인다.
//   식: 등락률 = 전일 대비 ÷ (오늘 종가 − 전일 대비). 전일 대비가 없으면 추정하지 않고 null.

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** trend 행 하나 → 당일 등락률 %(소수 1자리). 부호는 원천 값의 부호를 따르되, 하락·하한 코드(5·4)인데 양수로 오면 음수로 고친다 */
export function krDayChangePct(row: { closePrice?: unknown; compareToPreviousClosePrice?: unknown; compareToPreviousPrice?: unknown } | null | undefined): number | null {
  if (!row) return null
  const close = num(row.closePrice)
  let diff = num(row.compareToPreviousClosePrice)
  if (close == null || close <= 0 || diff == null) return null
  const code = (row.compareToPreviousPrice as { code?: unknown } | undefined)?.code
  if ((code === '5' || code === '4') && diff > 0) diff = -diff
  const prev = close - diff
  if (prev <= 0) return null
  return Math.round((diff / prev) * 1000) / 10
}
