// ⚖️ 6축 가중치 SSOT — 시장별로 다르다(2026-08-08 감사 · docs/axis-weights/context-notes.md)
//
// ⚠️ route.ts 에 두지 않는 이유: Next.js App Router 는 route 파일의 임의 export 를 금지한다
//    (GET/POST/revalidate 등 정해진 것만). 가중치는 화면·문서도 참조해야 하므로 lib 으로 뺀다.
//
// 🌍 해외 — 일별 투자자별 매매동향 공개 자료가 **없다**(프록시 커버리지·선택 편향 문제로 2026-08-08 수급 0%).
// 🇰🇷 KR — 실데이터는 있으나 **예측력이 없다**(2026-08-14 확정, docs/axis-weights/context-notes.md):
//    ① 신호 5차 검증(단기·중장기·단독/분산·코스닥·앱 공식 소급 — 신호 정의 30개·표본 최대 28만 봉)에서
//       전부 기각 — 매번 반대 신호(쌍매도)가 본신호와 같은 성적.
//    ② 앱의 krSupply 점수 ↔ 60봉 수익 상관 **0.0057**(353종) — 랭킹 입력으로 정보량 없음.
//    ③ 코스피 지수 레벨도 동행(당일 상관 0.470)일 뿐 예측은 0±(20일→60일은 오히려 −0.38) —
//       "외인 따라 오른다"는 같은 날 함께 움직이는 것이지 미리 알려주는 것이 아니다.
//    → KR 도 해외와 동일 처리: 수급 0% + 가치·모멘텀 5%p씩 재배분.
//    ⛔ 수급 정보를 버리는 게 아니다 — 수급 레이더·배지·카드의 수급 바는 **참고로 계속 노출**한다. 점수만 뺀다.
//    🔬 전향 교차 확인: 축별 성적표 적립(10/8 첫 채점)이 같은 질문에 독립적으로 답한다 — 다르게 나오면 되돌린다.
//
// 재배분을 가치·모멘텀에 준 근거(실효 기여도 = 가중치 × 표준편차, 유니버스 647종 실측):
//   가치 SD 22.9 · 모멘텀 SD 23.5 로 변별력 최상위이고 상관 −0.178 로 낮아 서로 보완적이다.
export const W_KR = { season: 0.15, value: 0.30, quality: 0.20, supply: 0.00, momentum: 0.25, rotation: 0.10 }
export const W_GLOBAL = { season: 0.15, value: 0.30, quality: 0.20, supply: 0.00, momentum: 0.25, rotation: 0.10 }
export type AxisWeights = typeof W_KR

/** 시장별 가중치 — isKr 기준(EU·JP·CN 도 일별 수급 공개가 없어 GLOBAL 을 쓴다) */
export const wOf = (isKr: boolean): AxisWeights => (isKr ? W_KR : W_GLOBAL)
