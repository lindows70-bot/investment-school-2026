// 어닝 결과 문구 SSOT(클라이언트 안전) — '컨센서스 판정'과 '발표 후 주가 반응'을 따로 만든다.
//
// 왜 갈랐나(2026-09-05): 예전엔 두 조각을 ' · ' 로 이어 붙인 summary 한 문자열을 beat 하나로 칠했다.
//   "컨센서스 -3% 미달 · 발표 후 주가 +4.1%" 가 통째로 빨강 → '주가 +4.1%'가 나쁜 것처럼 읽혔다.
//   판정(좋다/나쁘다 = 초록/빨강)과 주가(한국식 = 빨강 상승/파랑 하락)는 축이 다르므로 색도 따로 입혀야 한다.
//   문구 생성을 여기 한 곳에 두어 서버 summary 와 화면 두 조각이 같은 말을 하게 한다(제2원칙).
// earnResults.ts 는 서버 전용(appCache·캔들)이라 브리핑(클라이언트)이 직접 import 할 수 없어 파일을 나눴다.

/** 컨센서스 대비 판정 문구 — beat null 은 '발표 직후 집계 중' */
export function earnVerdictText(beat: boolean | null, surprisePct: number | null): string {
  if (beat === true)  return `컨센서스 ${surprisePct != null ? `+${surprisePct}% ` : ''}상회`
  if (beat === false) return `컨센서스 ${surprisePct != null ? `${surprisePct}% ` : ''}미달`
  return '결과 집계 중(발표 직후)'
}

/** 발표 후 주가 반응 문구 — null 은 아직 새 봉이 없는 상태 */
export function earnReactionText(reactionPct: number | null): string {
  if (reactionPct == null) return '주가 반응 집계 전'
  return `발표 후 주가 ${reactionPct >= 0 ? '+' : ''}${reactionPct}%`
}
