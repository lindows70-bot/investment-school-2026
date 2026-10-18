// 코어·새틀라이트 역할 판정의 **순수 규칙표**(서버·클라이언트 공용) — portfolioRole(서버 · 5분류)과 classifyAsset(기록 모달 · 2분류)이 각자 키워드표를 들고
//   같은 종목을 다르게 분류했다(2026-10-18 제2원칙 6차 점검: GLD 가 한쪽은 코어·한쪽은 새틀라이트). 표는 여기 한 곳, 둘 다 import 한다.
//   ⚠️ 이 파일은 서버 전용 모듈(appCache·supabase)을 import 하지 않는다 — 거래 모달(클라이언트)이 쓴다.
const up = (s: string) => (s ?? '').toUpperCase()
export const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '')

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

// 원자재/실물 — 대체자산(새틀라이트)
const COMMODITY_KW = ['구리', '은(', '실물', 'SILVER', 'GOLD', 'COPPER', 'PLATINUM', '원자재', '귀금속', 'PHYSICAL']

export const isLeverage = (t: string, n: string) => LEVERAGE_TICKERS.has(up(t)) || LEVERAGE_KR.has(code6(t)) || LEVERAGE_NAME_KW.some(kw => up(n).includes(kw))
export const isBond = (t: string, n: string) => BOND_TICKERS.has(up(t)) || BOND_KR.has(code6(t)) || BOND_NAME_KW.some(kw => up(n).includes(kw))
export const isBroadIndex = (t: string, n: string) => BROAD_INDEX_TICKERS.has(up(t)) || BROAD_INDEX_KR.has(code6(t)) || BROAD_INDEX_NAME_KW.some(kw => up(n).includes(kw)) || /\b200\b/.test(n)
export const isCommodityLike = (_t: string, n: string) => COMMODITY_KW.some(kw => up(n).includes(up(kw)))
export const isBtc = (t: string, n: string) => /\bBTC\b/.test(up(t)) || up(n).includes('BITCOIN') || up(n).includes('비트코인')
