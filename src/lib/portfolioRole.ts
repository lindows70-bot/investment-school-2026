// 코어-새틀라이트 자산 역할 분류 SSOT — 전 보유자산을 5분류+BLOCKED로 단일 매핑(MECE)
//  AI 리밸런싱이 ETF·채권·BTC·주식·유령을 하나의 자산 위계로 보고 캡·밴드를 통제하기 위한 기반.
import { getAssetType } from '@/lib/assetClassifier'
import { SATELLITE_UNIVERSE } from '@/lib/satelliteScreener'

export type AssetRole =
  | 'CORE_INDEX'        // 지수/섹터 ETF — 시장 베타(코어)
  | 'CORE_BOND'         // 채권형 — 방어(코어)
  | 'SATELLITE_BTC'     // 비트코인(전략 암호) — 캡 10%
  | 'SATELLITE_GHOST'   // 유령/10배거 소외주 — 캡 10%
  | 'SATELLITE_GENERAL' // 일반 개별주·주도섹터·대체자산
  | 'BLOCKED'           // 레버리지/인버스·비BTC 알트 — 코어·새틀라이트 어디에도 부적합

export interface RoleResult { role: AssetRole; group: 'CORE' | 'SATELLITE' | 'BLOCKED'; label: string; reason: string }

const up = (s: string) => (s ?? '').toUpperCase()
const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '')

// 레버리지/인버스 — 코어(시장베타)도 새틀라이트(알파)도 아닌 '도박' → 차단
const LEVERAGE_NAME_KW = ['레버리지', '인버스', '곱버스', '2X', '3X', 'ULTRA', 'ULTRASHORT', 'DAILY', 'BULL', 'BEAR', 'PROSHARES ULTRA', 'DIREXION']
const LEVERAGE_TICKERS = new Set(['TSLL', 'TSLR', 'TSLG', 'TSLS', 'TSLQ', 'NVDL', 'NVDU', 'NVDX', 'NVDQ', 'NVDS', 'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 'UPRO', 'SPXL', 'SPXS', 'TNA', 'TZA', 'AAPU', 'AAPD', 'MSFU', 'GGLL', 'AMZU', 'METU', 'CONL', 'MSTU', 'MSTX', 'AGQ', 'ZSL', 'BITX', 'BITU'])
const LEVERAGE_KR = new Set(['252670'])

// 채권형 — 이름·티커
const BOND_NAME_KW = ['채권', '국고채', '국채', '회사채', '단기채', '종합채', 'BOND', 'TREASURY', 'AGGREGATE']
const BOND_TICKERS = new Set(['TLT', 'IEF', 'SHY', 'SHV', 'AGG', 'BND', 'LQD', 'TIP', 'GOVT', 'BNDX', 'EMB'])
const BOND_KR = new Set(['148070', '114260', '153130', '439870'])

// 광의 지수(시장 베타=코어) — S&P500·나스닥100·KOSPI200·다우·전체시장. 그 외 ETF(섹터/테마/원자재/협의지역)는 새틀라이트 프록시
const BROAD_INDEX_NAME_KW = ['S&P500', 'S&P 500', 'S&P100', '나스닥100', '나스닥 100', 'NASDAQ100', 'NASDAQ 100', 'NASDAQ-100', 'KOSPI200', 'KOSPI 200', '코스피200', '코스피 200', '다우', 'DOW JONES', 'TOTAL MARKET', 'TOTAL STOCK', 'ACWI', 'WORLD INDEX', 'WIDEMOAT', 'WIDE MOAT', '동일가중']
const BROAD_INDEX_TICKERS = new Set(['SPY', 'IVV', 'VOO', 'VTI', 'QQQ', 'QQQM', 'DIA', 'IWM', 'VT', 'ACWI', 'SPLG'])
const BROAD_INDEX_KR = new Set(['069500', '102110', '360750', '133690', '229200', '251340', '309230', '0069M0'])
const isBroadIndex = (t: string, n: string) => BROAD_INDEX_TICKERS.has(up(t)) || BROAD_INDEX_KR.has(code6(t)) || BROAD_INDEX_NAME_KW.some(kw => up(n).includes(kw)) || /\b200\b/.test(n)

// 원자재/실물 — 대체자산(새틀라이트)
const COMMODITY_KW = ['구리', '은(', '실물', 'SILVER', 'GOLD', 'COPPER', 'PLATINUM', '원자재', '귀금속', 'PHYSICAL']
const isCommodityLike = (t: string, n: string) => COMMODITY_KW.some(kw => up(n).includes(up(kw)))

const isLeverage = (t: string, n: string) => LEVERAGE_TICKERS.has(up(t)) || LEVERAGE_KR.has(code6(t)) || LEVERAGE_NAME_KW.some(kw => up(n).includes(kw))
const isBond = (t: string, n: string) => BOND_TICKERS.has(up(t)) || BOND_KR.has(code6(t)) || BOND_NAME_KW.some(kw => up(n).includes(kw))
const isBtc = (t: string, n: string) => /\bBTC\b/.test(up(t)) || up(n).includes('BITCOIN') || up(n).includes('비트코인')
const GHOST_CODES = new Set(SATELLITE_UNIVERSE.map(s => up(s.market === 'KR' ? code6(s.ticker) : s.ticker)))
const isGhost = (t: string, market: string) => GHOST_CODES.has(up(market === 'KR' ? code6(t) : t))

const META: Record<AssetRole, { group: RoleResult['group']; label: string }> = {
  CORE_INDEX:        { group: 'CORE', label: '코어·인덱스' },
  CORE_BOND:         { group: 'CORE', label: '코어·채권' },
  SATELLITE_BTC:     { group: 'SATELLITE', label: '새틀라이트·BTC' },
  SATELLITE_GHOST:   { group: 'SATELLITE', label: '새틀라이트·유령' },
  SATELLITE_GENERAL: { group: 'SATELLITE', label: '새틀라이트·일반' },
  BLOCKED:           { group: 'BLOCKED', label: '정책 부적합' },
}

export function classifyAssetRole(ticker: string, name: string, market: string): RoleResult {
  const t = ticker ?? '', n = name ?? '', mk = market ?? 'US'
  const wrap = (role: AssetRole, reason: string): RoleResult => ({ role, ...META[role], reason })

  // ① 레버리지/인버스 — 최우선 차단(자산군 무관)
  if (isLeverage(t, n)) return wrap('BLOCKED', '레버리지/인버스 상품 — 장기 보유 시 변동성 잠식, 코어·새틀라이트 어디에도 부적합. 정리 권장')

  const type = getAssetType(t, n, mk)

  // ② 암호화폐 — BTC만 허용, 그 외 알트는 정책 차단
  if (type === 'CRYPTO') {
    if (isBtc(t, n)) return wrap('SATELLITE_BTC', '비트코인 — 전략 암호 자산(캡 10%)')
    return wrap('BLOCKED', '비(非)비트코인 알트코인 — 정책상 암호 자산은 BTC만 허용. 정리 권장')
  }

  // ③ ETF — 채권형=코어·채권 / 광의 지수=코어·인덱스 / 원자재·섹터·테마=새틀라이트 프록시
  if (type === 'ETF') {
    if (isBond(t, n)) return wrap('CORE_BOND', '채권형 ETF — 방어 코어')
    if (isCommodityLike(t, n)) return wrap('SATELLITE_GENERAL', '원자재/실물 ETF — 대체자산(새틀라이트)')
    if (isBroadIndex(t, n)) return wrap('CORE_INDEX', '광의 지수 ETF(S&P500·나스닥100·KOSPI200 등) — 시장 베타 코어')
    return wrap('SATELLITE_GENERAL', '섹터/테마 ETF — 주도섹터 프록시(새틀라이트)')
  }

  // ④ 원자재(은·구리 등) — 대체자산으로 새틀라이트 일반에 편입
  if (type === 'COMMODITY') return wrap('SATELLITE_GENERAL', '원자재/실물 — 대체자산(새틀라이트 일반)')

  // ⑤ 채권형이 STOCK로 잡힌 예외 보정
  if (isBond(t, n)) return wrap('CORE_BOND', '채권형 — 방어 코어')

  // ⑥ 개별주 — 유령 유니버스면 유령, 아니면 일반
  if (isGhost(t, mk)) return wrap('SATELLITE_GHOST', '유령/10배거 소외주(캡 10%)')
  return wrap('SATELLITE_GENERAL', '개별주식/주도섹터 — 새틀라이트 일반')
}
