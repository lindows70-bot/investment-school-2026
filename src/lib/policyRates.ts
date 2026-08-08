// 🏦 주요국 정책금리 폴백 SSOT — 중앙은행 정책금리는 공개 무료 API가 없다(미국만 FRED 라이브).
//
// ⚠️ 왜 SSOT로 뺐나(2026-08-08): 같은 15개국 테이블이 `api/macro-data/route.ts`와 `macro-hub/page.tsx`에
//    **값까지 완전히 동일하게 복붙**돼 있었다. 한쪽만 갱신하면 조용히 갈라져, 같은 지표가 화면마다
//    다른 값을 보이게 된다(제2원칙 위반). 갱신은 이제 이 파일 한 곳만 고치면 된다.
//
// ⛔ 제1원칙 예외: 이건 '정적 참조 데이터'다(라이브 소스가 존재하지 않음). 대신 기준일을 함께 노출해
//    화면이 "언제 기준 값인지"를 학생에게 밝힐 수 있게 한다 — 출처 없는 숫자는 두지 않는다.
export const POLICY_RATE_AS_OF = '2026-07-19'

/** ISO3 → 정책금리(%). 기준일 POLICY_RATE_AS_OF · 수동 갱신(연 수회) */
export const POLICY_RATES: Record<string, number> = {
  USA: 3.63, KOR: 2.75, JPN: 0.50, CHN: 3.10, DEU: 2.65,
  GBR: 4.50, FRA: 2.65, IND: 6.25, BRA: 13.25, AUS: 4.10,
  CAN: 2.75, RUS: 21.0, TUR: 42.5, SAU: 5.00, ZAF: 7.75,
}
