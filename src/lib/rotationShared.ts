// 🧭 섹터 로테이션 공유 SSOT — 캐시 키·GICS 매핑·주도섹터 축 정규화·최근 캐시 로더
//
// ⚠️ 이 파일이 있는 이유(2026-07-30): SECTOR_TO_ROT 맵과 (score+12)/24 정규화가 **3개 라우트에
//    복붙**돼 있었고(unified-reco·research-verdict·win-lose), 캐시 키 리터럴은 6곳에 흩어져 있었다 —
//    v13→v14 범프 때 reader 6곳을 손으로 고쳐야 했고, 워밍 누락 사고(주도섹터 전멸)의 온상이었다.
//    4번째 소비자(🐎 신고가 레이더)를 만들면서 한 곳으로 모은다.
//    MARKET_FLOW_KR_KEY·blendedPeg 추출과 같은 패턴: **버전업은 이제 이 파일 한 줄이다.**
import { getCache } from './appCache'

/** 섹터 로테이션 일별 캐시 키 — writer(sector-rotation route)·reader 전원이 이것만 쓴다 */
export const SECTOR_ROTATION_KEY = (dateKst: string) => `sector-rotation-v14:${dateKst}`

/** Yahoo GICS 섹터명 → 로테이션 시계 키(GICS 11만 — 테마 6은 종목 중복 소속이라 매핑 제외) */
export const SECTOR_TO_ROT: Record<string, string> = {
  'Technology': 'infotech', 'Financial Services': 'financials', 'Healthcare': 'healthcare',
  'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Energy': 'energy',
  'Industrials': 'industrials', 'Basic Materials': 'materials', 'Communication Services': 'communication',
  'Utilities': 'utilities', 'Real Estate': 'realestate',
}

export type RotQuadShared = 'leading' | 'weakening' | 'lagging' | 'improving'

/** 🧭 주도섹터 축(0~100) — RRG 쏠림점수(0.6 상대강도 + 0.4 모멘텀, %p)를 정규화. 주도(+)→100·이탈(−)→0·중립 50 */
export const rotAxisScore = (score: number) => Math.max(0, Math.min(100, Math.round((score + 12) / 24 * 100)))

/** 최근 N일의 로테이션 캐시에서 섹터별 국면·쏠림 맵을 읽는다(읽기만 — 콜드면 null·재계산 촉발 금지) */
export async function loadRotationBySector(days = 3): Promise<Map<string, { q: RotQuadShared; score: number }> | null> {
  const now = Date.now() + 9 * 3600_000
  for (let i = 0; i < days; i++) {
    const dt = new Date(now - i * 86400_000).toISOString().slice(0, 10)
    try {
      const rot = await getCache<{ items?: { key: string; quadrant: RotQuadShared; score: number }[] }>(SECTOR_ROTATION_KEY(dt), 3 * 24 * 3600_000)
      if (rot?.items?.length) return new Map(rot.items.map(it => [it.key, { q: it.quadrant, score: it.score }]))
    } catch { /* graceful — 다음 날짜 시도 */ }
  }
  return null
}
