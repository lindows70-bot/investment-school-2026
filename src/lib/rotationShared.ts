// 🧭 섹터 로테이션 공유 SSOT — 캐시 키·GICS 매핑·주도섹터 축 정규화·최근 캐시 로더
//
// ⚠️ 이 파일이 있는 이유(2026-07-30): SECTOR_TO_ROT 맵과 (score+12)/24 정규화가 **3개 라우트에
//    복붙**돼 있었고(unified-reco·research-verdict·win-lose), 캐시 키 리터럴은 6곳에 흩어져 있었다 —
//    v13→v14 범프 때 reader 6곳을 손으로 고쳐야 했고, 워밍 누락 사고(주도섹터 전멸)의 온상이었다.
//    4번째 소비자(🐎 신고가 레이더)를 만들면서 한 곳으로 모은다.
//    MARKET_FLOW_KR_KEY·blendedPeg 추출과 같은 패턴: **버전업은 이제 이 파일 한 줄이다.**
import { getCache } from './appCache'

/** 섹터 로테이션 일별 캐시 키 — writer(sector-rotation route)·reader 전원이 이것만 쓴다 */
// v15: 사분면 판정을 원값 기준으로(반올림 0.0 이 '과열'로 뒤집히던 결함) — quadrant 가 바뀌므로
//      이 키를 읽는 6곳(통합추천·종합판정·승패해부·타점워처·ETF대안)의 주도섹터 축까지 함께 갱신된다.
export const SECTOR_ROTATION_KEY = (dateKst: string) => `sector-rotation-v15:${dateKst}`

/** Yahoo GICS 섹터명 → 로테이션 시계 키(GICS 11만 — 테마 6은 종목 중복 소속이라 매핑 제외) */
export const SECTOR_TO_ROT: Record<string, string> = {
  'Technology': 'infotech', 'Financial Services': 'financials', 'Healthcare': 'healthcare',
  'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Energy': 'energy',
  'Industrials': 'industrials', 'Basic Materials': 'materials', 'Communication Services': 'communication',
  'Utilities': 'utilities', 'Real Estate': 'realestate',
}

export type RotQuadShared = 'leading' | 'weakening' | 'lagging' | 'improving'

/** 🧭 주도섹터 축(0~100) — RRG 쏠림점수(0.6 상대강도 + 0.4 모멘텀, %p)를 정규화. 주도(+)→100·이탈(−)→0·중립 50
 *
 *  ⚠️ 정규화 폭을 ±12 → ±8 로 좁혔다(2026-08-08 실측): 실제 섹터 score 분포가 **−8.2~+7.2(SD 3.6)**
 *  뿐이라 ±12 가정으로는 0~100 중 가운데 15.8~80 구간만 써서 축의 변별력을 3분의 1쯤 버리고 있었다.
 *  ±8 로 좁히면 같은 분포가 0~100 을 거의 다 쓴다(축 실효 기여 1.50 → 2.25 로 회복).
 *  ⛔ 더 좁히지 않는 이유: 분포가 좁아지는 국면(섹터 간 차이가 실제로 없는 날)에 0/100 극단이
 *     남발되면 "차이가 없는데 차이가 있다"고 말하게 된다. ±8 은 실측 범위를 딱 덮는 선이다. */
export const rotAxisScore = (score: number) => Math.max(0, Math.min(100, Math.round((score + 8) / 16 * 100)))

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
