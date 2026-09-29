// 투자학교 저울 '내가 가진 줄' — 보유 종목 하나를 저울의 다섯 줄(채권·주식·부동산·금·코인) 중 하나로 나눈다(브라우저에서만 쓴다 — 개인 보유는 서버로 보내지 않는다)
//   1차 분류는 assetClassifier.getAssetType SSOT. ETF 는 이름·티커로 채권·리츠·금을 가려내고 나머지는 주식 ETF 로 본다(이름으로 가른 추정 — 화면에 그렇게 밝힌다).
//   원자재 중 금이 아닌 것(원유·은·구리…)은 저울에 줄이 없어 null — 억지로 끼워 넣지 않는다.
import { getAssetType } from './assetClassifier'   // 상대 경로 — 검증 스크립트가 별칭 없이 컴파일한다
import type { ScaleAsset } from './scale'

const BOND_TICKERS = new Set(['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'TLH', 'IEI', 'BIL', 'SGOV', 'GOVT', 'VGLT', 'VGIT', 'VGSH', 'EDV', 'ZROZ', 'LQD', 'HYG', 'JNK', 'TIP', 'SCHO', 'SCHR', 'SCHZ', 'BNDX', 'EMB', 'MUB'])
const BOND_NAME = /채권|국채|국고채|회사채|단기채|장기채|TREASURY|BOND/i
const REIT_TICKERS = new Set(['VNQ', 'XLRE', 'IYR', 'SCHH', 'O', 'REM', 'VNQI'])
const REIT_NAME = /리츠|REIT|부동산/i
const GOLD_TICKERS = new Set(['GLD', 'IAU', 'SGOL', 'BAR', 'GLDM', 'AAAU', 'GC=F'])
const GOLD_NAME = /금현물|골드|GOLD|(^|[^가-힣])금($|[^가-힣리융])/i

export function scaleAssetOf(ticker: string, name: string, market: string): ScaleAsset | null {
  const t = ticker.trim().toUpperCase()
  const type = getAssetType(ticker, name, market)
  if (type === 'CRYPTO') return 'coin'
  if (GOLD_TICKERS.has(t) || ((type === 'COMMODITY' || type === 'ETF') && GOLD_NAME.test(name))) return 'gold'
  if (type === 'COMMODITY') return null
  if (type === 'ETF') {
    if (BOND_TICKERS.has(t) || BOND_NAME.test(name)) return 'bond'
    if (REIT_TICKERS.has(t) || REIT_NAME.test(name)) return 'realestate'
    return 'stock'
  }
  // 상장 리츠 개별 종목(한국 'OO리츠')은 부동산 줄
  if (REIT_TICKERS.has(t) || /리츠/.test(name)) return 'realestate'
  return 'stock'
}

/** 보유 목록 → 줄마다 종목 수 */
export function countByScaleAsset(holdings: { ticker: string; name: string; market: string }[]): Partial<Record<ScaleAsset, number>> {
  const out: Partial<Record<ScaleAsset, number>> = {}
  for (const h of holdings) {
    const a = scaleAssetOf(h.ticker, h.name, h.market)
    if (a) out[a] = (out[a] ?? 0) + 1
  }
  return out
}
