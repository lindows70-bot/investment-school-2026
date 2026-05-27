/**
 * classifyAssetType.ts — 하위 호환 래퍼 (Deprecated)
 *
 * ⚠️  이 파일은 하위 호환성을 위해 유지됩니다.
 *     새 코드에서는 반드시 아래를 직접 사용하세요:
 *
 *     import { getAssetType, getAssetClassification } from '@/lib/assetClassifier'
 *
 * 내부적으로 SSOT인 assetClassifier.ts를 호출합니다.
 */

export type { AssetType } from './assetClassifier'
export { getAssetType, getAssetClassification } from './assetClassifier'

import { getAssetClassification } from './assetClassifier'

// 기존 인터페이스 유지 (하위 호환)
export interface AssetClassification {
  assetType:     import('./assetClassifier').AssetType
  isAnalyzable:  boolean
  badgeIcon:     string
  badgeLabel:    string
  lynchGuidance: string
}

/**
 * @deprecated 새 코드에서는 getAssetClassification() 을 직접 사용하세요.
 */
export function classifyAssetType(
  ticker:  string,
  name:    string,
  market?: string,
): AssetClassification {
  return getAssetClassification(ticker, name, market)
}
