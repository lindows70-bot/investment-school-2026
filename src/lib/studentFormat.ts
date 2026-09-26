// 학생 간단 모드 화면(내 자산·종목 상세·기록하기·히트맵·홈·시장)이 함께 쓰는 숫자 표기 SSOT — 원화·달러·부호·등락률·등락 색·수량·지수 포인트·억원·환율
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

/** 차트 축 눈금용 만원 단위 — 29,985,275 → '2,999만'(반올림). 1만 원 미만은 won() 그대로. 음수 부호는 pct·signWon 과 같은 '−' */
export const manWon = (n: number) => {
  const a = Math.abs(n)
  const body = a >= 10_000 ? `${Math.round(a / 10_000).toLocaleString('ko-KR')}만` : won(a)
  return n < 0 ? `${MINUS}${body}` : body
}

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

/** 억원 금액 — 억 단위로 반올림, 1조 이상은 '1조 4,649억'(조 아래가 0이면 '2조'), 음수 부호는 '−'. 부호 없는 양수(거래대금 등) */
export function eok(n: number): string {
  const r = Math.round(Math.abs(n))
  const jo = Math.floor(r / 10_000)
  const rest = r % 10_000
  const body = jo > 0 ? `${jo.toLocaleString('ko-KR')}조${rest ? ` ${rest.toLocaleString('ko-KR')}억` : ''}` : `${rest.toLocaleString('ko-KR')}억`
  return n < 0 && r > 0 ? `${MINUS}${body}` : body
}

/** 부호 붙은 억원 — 순매수 +, 순매도 −. 반올림해 0억이면 부호 없이 '0억' */
export const signEok = (n: number) => {
  const r = Math.round(n)
  return `${sign(r)}${eok(Math.abs(r))}`
}

/** 환율(원/달러) — 고시값 그대로 소수 둘째 자리(1,359.00원) */
export const fxWon = (n: number) => `${n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원`

/** 큰 달러 금액(시가총액) — 1조 달러 이상은 '4.3조 달러'(소수 한 자리까지), 1억 달러 이상은 '3,500억 달러', 그 밑은 usd() */
export function usdBig(n: number): string {
  const a = Math.abs(n)
  const body = a >= 1e12 ? `${(a / 1e12).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}조 달러`
    : a >= 1e8 ? `${Math.round(a / 1e8).toLocaleString('ko-KR')}억 달러`
    : usd(a)
  return n < 0 ? `${MINUS}${body}` : body
}

/** 부호 붙은 환율 차이(원) — 소수 둘째 자리, 음수 부호 '−', 0 은 부호 없이 */
export const signFx = (n: number) => {
  const r = Math.round(n * 100) / 100
  return `${sign(r)}${fxWon(Math.abs(r))}`
}
