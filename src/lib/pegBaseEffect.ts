// PEG 기저효과 의심 판정(순수 함수) — 서버 의존이 없어 클라이언트 화면도 같은 기준을 쓴다(canonicalFundamentals 가 다시 내보낸다)

/**
 * ⚠️ 기저효과 의심 판정(공통 SSOT) — 작년 이익 붕괴 후 회복으로 성장률이 100%↑ 튀면
 * PEG=PER÷G가 0에 수렴(저평가 착시, 린치의 경기순환주 함정). BP 0.01 사건의 일반화.
 * 섹터피어 X-Ray·맞춤추천·통합추천·수급랭킹이 동일 기준으로 판정한다(제2원칙).
 * growth = 소수(1.0 = +100%).
 */
export function isPegBaseEffect(peg: number | null, growth: number | null): boolean {
  return peg != null && peg > 0 && peg < 0.3 && growth != null && growth > 1.0
}
