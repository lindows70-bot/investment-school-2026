// 학생 간단 모드 화면(내 자산·종목 상세·기록하기·히트맵·홈)이 함께 쓰는 숫자 표기 SSOT — 원화·달러·부호·등락률·등락 색·수량·지수 포인트
import { TK } from '@/lib/theme'

const MINUS = '−'   // 음수 부호는 하이픈(-)이 아니라 수학 기호 '−'
const sign = (n: number) => n > 0 ? '+' : n < 0 ? MINUS : ''

/** 원화 — 100원 이상은 정수, 1~100원 미만은 소수 둘째 자리까지, 1원 미만(소액 코인)은 유효숫자 8자리 */
export function won(n: number): string {
  const a = Math.abs(n)
  const s = a >= 100 ? n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    : a >= 1 ? n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
    : n.toLocaleString('ko-KR', { maximumSignificantDigits: 8 })
  return `${s}원`
}

/** 달러 — 항상 소수 둘째 자리($12.50) */
export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** 종목 통화대로 — USD 가 아니면(값 없음 포함) 원화 */
export const money = (n: number, currency: 'USD' | 'KRW' | null) => currency === 'USD' ? usd(n) : won(n)

/** 차트 축 눈금용 만원 단위 — 29,985,275 → '2,999만'(반올림). 1만 원 미만은 won() 그대로 */
export const manWon = (n: number) => Math.abs(n) >= 10_000 ? `${Math.round(n / 10_000).toLocaleString('ko-KR')}만` : won(n)

/** 부호 붙은 원화 — 0 은 부호 없이 '0원' */
export const signWon = (n: number) => `${sign(n)}${won(Math.abs(n))}`

/** 지수 포인트 — 소수 둘째 자리(2,650.31) */
export const points = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 등락률 — 보합(±0.05% 안)은 '0.0%'(−0.0%·+0.0% 방지, upDown 회색 경계와 같음) */
export const pct = (n: number) => Math.abs(n) < 0.05 ? '0.0%' : `${sign(n)}${Math.abs(n).toFixed(1)}%`

/** 한국식 등락 색 — 오름 빨강 · 내림 파랑 · 보합(±0.05% 안)과 값 없음은 회색 */
export const upDown = (n: number | null) => n == null || Math.abs(n) < 0.05 ? TK.sub : n > 0 ? TK.red400 : TK.blue400

/** 수량 — 부동소수 잡음 없이 소수 8자리까지(끝 0 제거) + 코인은 '개', 나머지는 '주' */
export const qtyText = (q: number, market: string) => `${q.toLocaleString('ko-KR', { maximumFractionDigits: 8 })}${market === 'CRYPTO' ? '개' : '주'}`
