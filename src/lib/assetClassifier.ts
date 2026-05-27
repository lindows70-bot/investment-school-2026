/**
 * assetClassifier.ts — 글로벌 자산 분류 SSOT (Single Source of Truth)
 *
 * ◆ 원칙
 *   이 파일이 전체 시스템에서 자산 유형을 판별하는 유일한 진실 공급원입니다.
 *   컴포넌트/API 어디서도 티커·종목명을 직접 파싱하지 마세요.
 *   오직 getAssetType() 하나만 호출하세요.
 *
 * ◆ 반환 타입
 *   'STOCK'     — 개별 주식 (린치 분석 적용 가능)
 *   'ETF'       — ETF / 인덱스 펀드 (개별 기업 분석 불가)
 *   'CRYPTO'    — 암호화폐 (발행 기업·내부자 없음)
 *   'COMMODITY' — 원자재 / 실물 자산 (EPS 없음)
 */

export type AssetType = 'STOCK' | 'ETF' | 'COMMODITY' | 'CRYPTO'

export interface AssetClassification {
  assetType:     AssetType
  isAnalyzable:  boolean    // true = 피터 린치 분석 가능 (STOCK만 true)
  badgeIcon:     string
  badgeLabel:    string
  lynchGuidance: string
}

// ────────────────────────────────────────────────────────────────────
// ① 암호화폐 — 마켓 코드 + 티커 패턴
// ────────────────────────────────────────────────────────────────────
/** Supabase market 컬럼이 'CRYPTO'이면 무조건 암호화폐 */
const CRYPTO_MARKETS = new Set(['CRYPTO'])

/** 업비트/바이낸스 슬래시 패턴: BTC-KRW, ETH/USDT 등 */
const CRYPTO_TICKER_RE = /^(BTC|ETH|XRP|SOL|DOGE|ADA|MATIC|AVAX|DOT|LTC|LINK|ATOM|NEAR|SAND|MANA|UNI|AAVE|SHIB|TRX|BNB|USDT|USDC|DAI)([-\/].+)?$/i

/** 직접 지정 암호화폐 티커 세트 */
const CRYPTO_TICKERS = new Set([
  'BTC','ETH','XRP','SOL','DOGE','ADA','MATIC','AVAX','DOT','LTC',
  'LINK','ATOM','NEAR','SAND','MANA','UNI','AAVE','SHIB','TRX','BNB',
  'USDT','USDC','DAI','BTCUSDT','ETHUSDT','XRPUSDT',
  // 업비트 KRW 쌍
  'BTC-KRW','ETH-KRW','XRP-KRW','SOL-KRW','DOGE-KRW',
])

// ────────────────────────────────────────────────────────────────────
// ② 원자재 — Yahoo Finance 선물 코드 + 실물 신탁
// ────────────────────────────────────────────────────────────────────
/** Yahoo Finance 선물 코드: GC=F (금), SI=F (은), CL=F (원유) 등 */
const FUTURES_RE = /^(GC|SI|CL|NG|HG|ZC|ZS|ZW|PL|PA|RB|HO|GF|LE|LBS)=F$/i

/** 실물 원자재 ETF / 신탁 티커 */
const COMMODITY_TICKERS = new Set([
  'GLD','IAU','SGOL','BAR',                          // 금
  'SLV','PSLV','SIVR','PHYS',                        // 은·실물
  'USO','UCO','SCO','DBO',                           // 원유
  'UNG','BOIL','KOLD',                               // 천연가스
  'PDBC','DJP','GSG','DBA',                          // 복합 원자재
  'GDX','GDXJ','SIL',                                // 광산 ETF (준원자재)
  'PPLT','PALL',                                      // 백금·팔라듐
  'CPER','COPX',                                      // 구리
])

/** 원자재 신탁 종목명 키워드 */
const COMMODITY_NAME_KW = [
  'GOLD TRUST','SILVER TRUST','OIL FUND','NATURAL GAS',
  'GOLD ETF','SILVER ETF','CRUDE OIL',
  '금 ETF','은 ETF','원유 ETF','원자재 ETF',
  'PHYSICAL GOLD','PHYSICAL SILVER',
  'SPROTT','BULLION',
]

// ────────────────────────────────────────────────────────────────────
// ③ ETF / 인덱스 펀드
// ────────────────────────────────────────────────────────────────────

/**
 * 국내 ETF 브랜드 (운용사별 상품명 접두어)
 * 종목명이 이 문자열로 시작하거나 포함하면 ETF
 *
 * ★ 신규 추가:
 *   PLUS  — 우리자산운용 (Plus K방산, Plus 미국테크 등)
 *   1Q    — 한국투자신탁운용 (1Q 미국우주항공테크 등)
 *   KBSTAR, WOORI — 추가 운용사
 */
const KR_ETF_BRANDS = [
  'TIGER','KODEX','KINDEX','ARIRANG',
  'ACE','SOL ','HANARO','TIMEFOLIO',
  'KOSEF','FOCUS','SMART',
  'PLUS ','1Q ',         // ★ 공백 포함: "Plus K방산", "1Q 미국..." 정확 매칭
  'KBSTAR','WOORI ETF','MAINSTET',
  'KTOP','EDUCABO',
]

/** 전 세계 ETF 종목명 키워드 */
const ETF_GENERIC_KW = [
  'ETF','INDEX FUND','인덱스','지수 추종',
  'S&P500','S&P 500','나스닥 100','NASDAQ 100','다우존스',
  'MSCI','FTSE',
  // 레버리지·인버스는 ETF 서브타입으로 분류
  '레버리지','인버스','2X','3X','ULTRA','PROSHARES',
]

/** 글로벌 ETF 대표 티커 (미국·한국) */
const ETF_TICKERS = new Set([
  // 미국 주요 지수 ETF
  'SPY','IVV','VOO','QQQ','VTI','DIA','IWM',
  'EFA','EEM','VWO','AGG','BND','LQD','HYG','SHY',
  // 섹터 SPDR ETF
  'XLK','XLF','XLV','XLE','XLI','XLP','XLU','XLRE','XLY','XLB','XLC',
  // 혁신 ETF
  'ARKK','ARKW','ARKG','ARKF','ARKQ','ARKG',
  // 채권·안전자산 ETF
  'TLT','IEF','SHV','TIP','SCHD','VIG','VYM',
  // 한국 주요 ETF (6자리 코드)
  '069500',  // KODEX 200
  '102110',  // TIGER 200
  '360750',  // TIGER 미국 S&P500
  '133690',  // TIGER 미국나스닥100
  '148070',  // KOSEF 국고채10년
  '229200',  // KODEX 코스닥150
  '252670',  // KODEX 200 선물인버스2X
  '305080',  // TIGER 미국MSCI리츠
  '091160',  // 컨버스 KOSPI
  '114260',  // KODEX 국채3년
  '251340',  // KODEX 아메리카대형주
  '153130',  // KODEX 단기채권
  '458730',  // TIGER Fn반도체
  '462890',  // ACE 미국빅테크TOP7
  '504060',  // PLUS K방산
  '489490',  // 1Q 미국우주항공테크
])

// ────────────────────────────────────────────────────────────────────
// 메인 함수: getAssetType
// ────────────────────────────────────────────────────────────────────
export function getAssetType(
  ticker:  string,
  name:    string,
  market?: string,
): AssetType {
  const t = ticker.trim().toUpperCase()
  const n = name.trim().toUpperCase()
  const m = (market ?? '').trim().toUpperCase()

  // ── 1. 시장 코드 우선 확인 ─────────────────────────────────────
  if (CRYPTO_MARKETS.has(m)) return 'CRYPTO'

  // ── 2. 암호화폐 티커 패턴 ─────────────────────────────────────
  if (CRYPTO_TICKERS.has(t) || CRYPTO_TICKER_RE.test(t)) return 'CRYPTO'

  // ── 3. Yahoo Finance 선물 코드 ────────────────────────────────
  if (FUTURES_RE.test(t)) return 'COMMODITY'

  // ── 4. 원자재 ETF / 신탁 티커 ────────────────────────────────
  if (COMMODITY_TICKERS.has(t)) return 'COMMODITY'

  // ── 5. 원자재 종목명 키워드 ───────────────────────────────────
  if (COMMODITY_NAME_KW.some(kw => n.includes(kw.toUpperCase()))) return 'COMMODITY'

  // ── 6. ETF 직접 지정 티커 세트 ───────────────────────────────
  if (ETF_TICKERS.has(t)) return 'ETF'

  // ── 7. 국내 ETF 브랜드 접두어 (종목명이 브랜드로 시작) ─────────
  //    "TIGER 200", "KODEX 반도체", "PLUS K방산", "1Q 미국..." 등
  if (KR_ETF_BRANDS.some(brand => n.startsWith(brand.toUpperCase()))) return 'ETF'

  // ── 8. 글로벌 ETF 일반 키워드 ────────────────────────────────
  if (ETF_GENERIC_KW.some(kw => n.includes(kw.toUpperCase()))) return 'ETF'

  // ── 9. 개별 주식 (기본값) ─────────────────────────────────────
  return 'STOCK'
}

// ────────────────────────────────────────────────────────────────────
// getAssetClassification — UI 렌더링용 메타데이터 포함 반환
// ────────────────────────────────────────────────────────────────────
export function getAssetClassification(
  ticker:  string,
  name:    string,
  market?: string,
): AssetClassification {
  const assetType = getAssetType(ticker, name, market)

  const META: Record<AssetType, Omit<AssetClassification, 'assetType' | 'isAnalyzable'>> = {
    STOCK: {
      badgeIcon: '📈', badgeLabel: '개별 주식',
      lynchGuidance: '',
    },
    ETF: {
      badgeIcon: '📦', badgeLabel: 'ETF/지수',
      lynchGuidance:
        '💡 피터 린치 가이드: ETF는 분산된 지수 상품이므로 ' +
        '개별 기업 분석법(유령 종목·내부자·PEG)을 적용할 수 없습니다. ' +
        '상단 매크로/인덱스 탭 또는 Core/Satellite 비중 관리 탭을 활용하세요.',
    },
    CRYPTO: {
      badgeIcon: '₿', badgeLabel: '암호화폐',
      lynchGuidance:
        '💡 피터 린치 가이드: 본 자산은 발행 기업과 경영진이 없는 대안 자산입니다. ' +
        '린치의 기업 분석(기관공백·내부자·PEG) 대상이 아닙니다. ' +
        '매크로·가격 추이 관점으로 접근하세요.',
    },
    COMMODITY: {
      badgeIcon: '🪙', badgeLabel: '원자재',
      lynchGuidance:
        '💡 피터 린치 가이드: 본 자산은 발행 기업과 경영진이 없는 대안 자산입니다. ' +
        '린치의 정량 분석(내부자 거래·기관공백) 대상이 아닙니다. ' +
        '수급·거시경제 지표 중심으로 분석하세요.',
    },
  }

  return {
    assetType,
    isAnalyzable: assetType === 'STOCK',
    ...META[assetType],
  }
}
