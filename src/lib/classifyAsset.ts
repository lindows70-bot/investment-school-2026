/**
 * classifyAsset — Core / Satellite 자동 분류(거래 모달·기록 화면·리그용 2분류)
 *
 * 2026-10-18 제2원칙: 예전엔 여기 자체 키워드표(US_INDEX·KR_INDEX·BOND·THEME…)가 있어 AI 리밸런싱의 portfolioRole 과
 * 같은 종목을 다르게 분류했다(GLD 코어 vs 새틀라이트 · RISE 200 코어 vs ?). 이제 둘은 **같은 규칙표**(lib/assetRoleRules)와
 * 같은 자산 판별(assetClassifier.getAssetType)을 쓴다 — portfolioRole 의 5분류를 2분류로 접은 것과 결과가 같다.
 *   CORE      = 채권형 ETF · 광의 지수 ETF(S&P500·나스닥100·KOSPI200·다우·전체시장)
 *   SATELLITE = 개별 주식 · 섹터/테마/원자재 ETF · 암호화폐 · 레버리지/인버스(portfolioRole 은 BLOCKED 로 따로 두지만 2분류에선 새틀라이트)
 * ⚠️ 서버 전용 모듈을 import 하지 않는다(클라이언트 모달이 쓴다) — 유령 유니버스 판별(SATELLITE_GHOST)은 2분류에 영향이 없어 빼도 같다.
 */
import { getAssetType } from '@/lib/assetClassifier'
import { isLeverage, isBond, isBroadIndex, isCommodityLike } from '@/lib/assetRoleRules'

export function classifyAsset(
  ticker: string,
  name:   string,
  market: 'US' | 'KR' | 'CRYPTO',
): 'CORE' | 'SATELLITE' {
  const t = (ticker ?? '').trim(), n = (name ?? '').trim()
  if (isLeverage(t, n)) return 'SATELLITE'                 // 레버리지/인버스는 지수형이어도 코어가 아니다
  const type = getAssetType(t, n, market)
  if (type === 'CRYPTO') return 'SATELLITE'
  if (type === 'ETF') {
    if (isBond(t, n)) return 'CORE'
    if (isCommodityLike(t, n)) return 'SATELLITE'          // 금·은·구리 실물 ETF = 대체자산(portfolioRole 과 동일)
    if (isBroadIndex(t, n)) return 'CORE'
    return 'SATELLITE'                                     // 섹터·테마·협의 지역
  }
  if (type === 'COMMODITY') return 'SATELLITE'
  if (isBond(t, n)) return 'CORE'                          // 채권형이 STOCK 으로 잡힌 예외
  return 'SATELLITE'
}

/**
 * classifyAssetKorean — 한국어 결과 반환 편의 함수
 */
export function classifyAssetKorean(
  ticker: string,
  name:   string,
  market: 'US' | 'KR' | 'CRYPTO',
): { role: 'CORE' | 'SATELLITE'; label: string; reason: string } {
  const role = classifyAsset(ticker, name, market)
  return {
    role,
    label:  role === 'CORE' ? '코어 (Core)' : '새틀라이트 (Satellite)',
    reason: role === 'CORE'
      ? '광의 지수 ETF · 채권형 ETF — 시장 베타·방어 자산으로 자동 분류'
      : '개별 종목 · 섹터/테마/원자재 ETF · 암호화폐 · 레버리지로 자동 분류',
  }
}
