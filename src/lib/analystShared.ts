// 🎧 애널리스트 신호 공용 규칙 — EPS 추정치 리비전 판정(노이즈 캔슬러 · 내부자 스캐너가 같은 함수를 쓴다, 제2원칙)
//    2026-09-19: getAnalystSignal.ts 는 'use server' 파일이라 동기 함수를 export 할 수 없어 여기로 뺐다.
export type RevisionSignal = 'up' | 'down' | 'mixed' | null

/** 최근 30일 EPS 추정치 상향/하향 애널리스트 수 → 신호. 한쪽이 다른 쪽의 2배 이상이고 3명 이상일 때만 방향을 말한다. */
export function revisionSignalOf(up: number | null, down: number | null): RevisionSignal {
  if (up == null || down == null) return null
  if (up >= down * 2 && up >= 3) return 'up'
  if (down >= up * 2 && down >= 3) return 'down'
  return 'mixed'
}
