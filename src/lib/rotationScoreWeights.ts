// 섹터 쏠림점수의 가중치 — 계산(sector-rotation 라우트)과 학생 화면 설명문('1달 흐름 60% · 1주 흐름 40%')이 같은 값을 본다(2026-10-18: 화면에 (60%)(40%) 가 글자로 박혀 있었다)
//   rotationShared 는 서버 전용(appCache)이라 클라이언트가 못 읽어 따로 둔다. 비율 합은 1
export const ROT_SCORE_W = { rs: 0.6, mom: 0.4 } as const   // rs = 1달 peer 대비 상대강도 · mom = 1주 peer 대비 모멘텀
export const rotWeightPct = (w: number) => `${Math.round(w * 100)}%`
