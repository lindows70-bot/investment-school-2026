// 현재 매크로 계절(US·KR 4계절) 공용 산출 — 통합추천·내종목수급·의사결정 스냅샷이 같은 SSOT 사용
//
// ⚠️ 2026-08-09: 국면 계산 자체는 **lib/regionSeason 으로 옮겼다**(5개 지역 지원).
//    여기는 US/KR 만 필요한 6개 소비자를 위한 얇은 어댑터다 — 공식을 여기 복제해두면
//    지역 확장·임계값 변경 때 두 곳이 갈린다(오늘 하이네켄 계절 80 vs 55 가 정확히 그 사고였다).
import { type Quadrant } from '@/lib/seasonNavigator'
import { getRegionSeasons } from '@/lib/regionSeason'

export interface CurrentSeason {
  usQuad: Quadrant
  krQuad: Quadrant
  cpiYoY: number
  rateDir: 'cut' | 'hold' | 'hike'
}

/** US·KR 국면만 필요한 호출부용 어댑터. 계산은 regionSeason SSOT 하나뿐이다.
 *  (CLI·HICP 는 12~24h 공유 캐시라 지역이 늘어도 추가 비용은 사실상 없다) */
export async function getCurrentSeason(base: string): Promise<CurrentSeason> {
  const s = await getRegionSeasons(base)
  return { usQuad: s.quad.US, krQuad: s.quad.KR, cpiYoY: s.cpiYoY, rateDir: s.rateDir }
}
