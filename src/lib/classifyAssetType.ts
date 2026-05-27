/**
 * classifyAssetType — 자산 유형 감지 유틸리티
 *
 * 피터 린치의 6대 분류·기관공백·내부자거래 분석은
 * 오직 '개별 주식(STOCK)'에만 성립한다.
 * ETF·원자재·암호화폐는 발행 기업·경영진이 없으므로 분석 대상에서 제외한다.
 */

export type AssetType = 'STOCK' | 'ETF' | 'COMMODITY' | 'CRYPTO'

export interface AssetClassification {
  assetType:     AssetType
  isAnalyzable:  boolean   // true = 린치 분석 적용 가능 (STOCK만 true)
  badgeIcon:     string
  badgeLabel:    string
  lynchGuidance: string    // 린치 가이드 안내 문구
}

// ── ETF 판별 키워드 & 티커 세트 ──────────────────────────────
const ETF_NAME_KEYWORDS = [
  'TIGER', 'KODEX', 'KINDEX', 'ARIRANG', 'SOL ', 'ACE ', 'HANARO',
  'TIMEFOLIO', 'KOSEF', 'FOCUS', 'TREX',
  'ETF', '인덱스', '지수', 'S&P500', '나스닥', '코스피', '코스닥', '다우',
  'INDEX FUND', 'INDEX ETF', 'SPDR', 'ISHARES', 'VANGUARD', 'INVESCO',
]

const ETF_TICKERS = new Set([
  // US 대표 ETF
  'SPY','QQQ','IVV','VOO','VTI','DIA','IWM','EFA','EEM',
  'TLT','IEF','AGG','BND','LQD','HYG','SHY','IEI',
  'XLK','XLF','XLV','XLE','XLI','XLU','XLP','XLRE',
  'ARKK','ARKW','ARKG','ARKF',
  // 원자재 ETF (여기도 ETF로 분류)
  'GLD','SLV','IAU','PSLV','SIVR','PHYS','SGOL','PPLT',
  'GDX','GDXJ','SLX','COPX',
  // 한국 ETF (종목코드)
  '102110','069500','360750','133690','148070','229200',
  '252670','305080','091160','251340','114260','153130',
])

// ── 원자재 판별 키워드 & 티커 세트 ──────────────────────────
const COMMODITY_KEYWORDS = [
  'GOLD', 'SILVER', 'OIL', 'CRUDE', 'NATURAL GAS',
  'WHEAT', 'CORN', 'COPPER', 'PLATINUM', 'PALLADIUM',
  'PHYSICAL', 'SPROTT', 'TRUST', 'BULLION',
  '금', '은', '원유', '천연가스', '금 ETF', '은 ETF',
]

const COMMODITY_TICKERS = new Set([
  'GLD','SLV','IAU','PSLV','SIVR','PHYS','SGOL','PPLT',
  'USO','UNG','PDBC','DBA','DJP','GSG',
  'GOLD','SILVER',
])

// ────────────────────────────────────────────────────────────
// 메인 분류 함수
// ────────────────────────────────────────────────────────────
export function classifyAssetType(
  ticker:  string,
  name:    string,
  market:  string,
): AssetClassification {
  const tickerU = ticker.toUpperCase()
  const nameU   = name.toUpperCase()
  const mkt     = market.toUpperCase()

  // ── 1. 암호화폐 ──────────────────────────────────────────
  if (mkt === 'CRYPTO') {
    return {
      assetType:    'CRYPTO',
      isAnalyzable: false,
      badgeIcon:    '₿',
      badgeLabel:   '암호화폐',
      lynchGuidance:
        '💡 피터 린치 가이드: 본 자산은 발행 기업과 경영진이 없는 대안 자산입니다. ' +
        '린치의 기업 분석(기관공백·내부자·PEG) 대상이 아닙니다. ' +
        '매크로·가격 추이 관점으로 접근하세요.',
    }
  }

  // ── 2. 원자재 ETF / 실물 원자재 ──────────────────────────
  if (
    COMMODITY_TICKERS.has(tickerU) ||
    COMMODITY_KEYWORDS.some(kw => nameU.includes(kw))
  ) {
    return {
      assetType:    'COMMODITY',
      isAnalyzable: false,
      badgeIcon:    '🪙',
      badgeLabel:   '원자재',
      lynchGuidance:
        '💡 피터 린치 가이드: 본 자산은 발행 기업과 경영진이 없는 대안 자산입니다. ' +
        '린치의 정량 분석(내부자 거래·기관공백) 대상이 아닙니다. ' +
        '수급·거시경제 지표 중심으로 분석하세요.',
    }
  }

  // ── 3. ETF / 인덱스 펀드 ─────────────────────────────────
  if (
    ETF_TICKERS.has(tickerU) ||
    ETF_NAME_KEYWORDS.some(kw => nameU.includes(kw.toUpperCase()))
  ) {
    return {
      assetType:    'ETF',
      isAnalyzable: false,
      badgeIcon:    '📦',
      badgeLabel:   'ETF/지수',
      lynchGuidance:
        '💡 피터 린치 가이드: ETF는 분산된 지수 상품이므로 ' +
        '개별 기업 분석법(유령 종목·내부자·PEG)을 적용할 수 없습니다. ' +
        '상단 매크로/인덱스 탭 또는 Core/Satellite 비중 관리 탭을 활용하세요.',
    }
  }

  // ── 4. 개별 주식 (STOCK) — 린치 분석 적용 가능 ───────────
  return {
    assetType:    'STOCK',
    isAnalyzable: true,
    badgeIcon:    '📈',
    badgeLabel:   '개별 주식',
    lynchGuidance: '',
  }
}
