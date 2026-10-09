// 스쿨 리그 주간 순위 스냅샷 — 키·타입 SSOT(크론이 쓰고, 리그 API 가 '지난주 순위'를 붙일 때 읽는다)
//   2026-10-09(학생 복귀 2단계): 순위 이력 저장소가 없어 '지난주보다 ↑2' 같은 변화를 못 보여줬다. 월요일 06:30 KST 에 한 장씩 남긴다.
//   ⛔ 추정 금지 — 스냅샷이 두 장 이상일 때만 변화를 말한다. 금액은 넣지 않는다(리그 원칙 · 수익률·순위만).

/** 주간 스냅샷(날짜 키) — PURGE_RULES 에 400일 보존으로 등록돼 있다(캐시날짜예외: 순위 이력은 날짜가 뜻을 가진다 · 1주 1행) */
export const LEAGUE_SNAP_KEY = (dateKst: string) => `league-snap-v1:${dateKst}`
/** 최신 두 장 묶음(날짜 없는 키) — 리그 API 는 이것만 읽는다(목록 조회 없이 한 번에) */
export const LEAGUE_SNAP_LATEST_KEY = 'league-snap-latest-v1'

export interface LeagueSnapRow {
  userId: string
  name: string
  rank: number            // 1부터 · 등록했고 수익률이 계산된 학생만(학생 리그 화면과 같은 순서 규칙)
  totalReturn: number     // 총수익률 %(실현 포함 · studentTotalReturn SSOT)
  holdingCount: number
}
export interface LeagueSnap { date: string; rows: LeagueSnapRow[] }
export interface LeagueSnapLatest { current: LeagueSnap; previous: LeagueSnap | null }

/** 리그 응답(students)에서 순위표를 만든다 — 학생 리그 화면(/s/league)과 **같은 규칙**: 등록 + 수익률 있음 · 수익률 내림차순 · 같으면 원래 순서(가입 순) */
export function rankRows(students: { userId: string; name: string; isRegistered: boolean; totalReturn: number | null; holdingCount: number }[]): LeagueSnapRow[] {
  return students
    .filter(s => s.isRegistered && typeof s.totalReturn === 'number' && Number.isFinite(s.totalReturn))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (b.s.totalReturn as number) - (a.s.totalReturn as number) || a.i - b.i)
    .map(({ s }, idx) => ({ userId: s.userId, name: s.name, rank: idx + 1, totalReturn: s.totalReturn as number, holdingCount: s.holdingCount }))
}
