// ⚖️ 6축 가중치 SSOT — 시장별로 다르다(2026-08-08 감사 · docs/axis-weights/context-notes.md)
//
// ⚠️ route.ts 에 두지 않는 이유: Next.js App Router 는 route 파일의 임의 export 를 금지한다
//    (GET/POST/revalidate 등 정해진 것만). 가중치는 화면·문서도 참조해야 하므로 lib 으로 뺀다.
//
// 🇰🇷 KR — 외국인·기관 **일별 순매수**가 공개된다. 실데이터라 수급 축 10% 유지.
// 🌍 그 외 — 일별 투자자별 매매동향 공개 자료가 **없다**. 프록시(MFI·내부자·13F)로 대신해 왔는데
//    실측에서 두 가지 문제가 드러났다:
//      ① 커버리지 — US 469종 중 **상위 25종만** 조회하고 나머지 444종(94.7%)은 50(중립) 고정
//      ② 선택 편향 — 그 25종을 고르는 preRank 가 수급을 뺀 4축이라, **이미 상위권인 종목만**
//         수급 점수를 추가로 받아 격차가 벌어졌다
//    → 수급 축을 빼고 그 10%를 가치·모멘텀에 5%p씩 재배분.
//    ⛔ 프록시 정보를 버리는 게 아니다 — MFI·내부자·13F 는 **배지로 계속 노출**한다. 점수만 뺀다
//       (WHAT/WHEN 분리와 같은 철학: 검증 안 된 재료는 점수가 아니라 근거로).
//
// 재배분을 가치·모멘텀에 준 근거(실효 기여도 = 가중치 × 표준편차, 유니버스 647종 실측):
//   가치 SD 22.9 · 모멘텀 SD 23.5 로 변별력 최상위이고 상관 −0.178 로 낮아 서로 보완적이다.
//   평균 이동도 거의 없다 — US 중앙값(가치 47·모멘텀 55) 기준 27.75 → 27.85 로 KR 대비 균형 유지.
//   대신 US 내부 변별력이 커진다(우수 종목 +2.5 · 부진 종목 −1.75).
export const W_KR = { season: 0.15, value: 0.25, quality: 0.20, supply: 0.10, momentum: 0.20, rotation: 0.10 }
export const W_GLOBAL = { season: 0.15, value: 0.30, quality: 0.20, supply: 0.00, momentum: 0.25, rotation: 0.10 }
export type AxisWeights = typeof W_KR

/** 시장별 가중치 — isKr 기준(EU·JP·CN 도 일별 수급 공개가 없어 GLOBAL 을 쓴다) */
export const wOf = (isKr: boolean): AxisWeights => (isKr ? W_KR : W_GLOBAL)
