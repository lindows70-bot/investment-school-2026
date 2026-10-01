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

/** 성장률이 %(100 = +100%) 단위인 화면용 — 기준은 위와 같다 */
export function isPegBaseEffectPct(peg: number | null | undefined, growthPct: number | null | undefined): boolean {
  return isPegBaseEffect(peg ?? null, growthPct != null ? growthPct / 100 : null)
}

// 분석 화면 공용 문구 — 화면마다 다른 말을 하지 않게 한 곳에서(2026-10-01: 가드가 PEG 한 칸에만 있어 같은 패널의 이익선은 '저평가(매수 영역)'라고 말하고 있었다)
export const PEG_JUMP_LABEL = '⚠️ 기저효과 착시'
export const PEG_JUMP_DESC = '이익이 한 해에 두 배 넘게 뛴 구간이라 저평가 근거로 쓸 수 없습니다(린치의 경기순환 함정)'
