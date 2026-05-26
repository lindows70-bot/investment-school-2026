/**
 * classifyAsset — Core / Satellite 자동 분류 판별 함수
 *
 * ◆ 분류 기준
 *  CORE (지수형 ETF · 우량 채권)
 *   - 미국 대표 지수: S&P500, SPY, VOO, IVV, 나스닥, NASDAQ, QQQ, 다우, DIA
 *   - 한국 대표 지수: 코스피, KOSPI, 코스닥, KOSDAQ, "200" 포함 (레버리지·인버스 제외)
 *   - 우량 채권형: 국채, Treasury, TLT, IEF, AGG, BND
 *   ※ 단, 종목명/티커에 "레버리지" 또는 "인버스"가 포함되면 SATELLITE 강제 분류
 *
 *  SATELLITE (개별 주식 · 테마 ETF · 암호화폐)
 *   - 위 CORE 조건에 해당하지 않는 모든 종목
 *   - market === 'CRYPTO' 는 무조건 SATELLITE
 *
 * @param ticker - 종목 코드 (예: "NVDA", "005930", "BTC")
 * @param name   - 종목명  (예: "NVIDIA", "삼성전자", "비트코인")
 * @param market - 시장 구분 ('US' | 'KR' | 'CRYPTO')
 * @returns 'CORE' | 'SATELLITE'
 */
export function classifyAsset(
  ticker: string,
  name:   string,
  market: 'US' | 'KR' | 'CRYPTO',
): 'CORE' | 'SATELLITE' {
  // ── 암호화폐 → 무조건 SATELLITE ──────────────────────────────
  if (market === 'CRYPTO') return 'SATELLITE'

  const t   = ticker.toUpperCase().trim()
  const n   = name.toUpperCase().trim()
  const combined = `${t} ${n}`   // 티커 + 종목명 합산 검색

  // ── 레버리지 · 인버스 → SATELLITE 강제 분류 ──────────────────
  // (지수형이더라도 레버·인버스는 투기 목적)
  const INVERSE_KEYWORDS = ['레버리지', 'LEVERAGE', '2X', '3X', 'INVERSE', '인버스', 'SHORT', 'BEAR']
  if (INVERSE_KEYWORDS.some(k => combined.includes(k))) return 'SATELLITE'

  // ── CORE 판별 키워드 ──────────────────────────────────────────

  // 1) 미국 대표 지수 ETF
  const US_INDEX = [
    'S&P500', 'S&P 500', 'SPY', 'VOO', 'IVV',
    'NASDAQ', '나스닥', 'QQQ', 'QQQA',
    '다우', 'DOW', 'DIA',
    'DJIA', 'MSCI', 'WORLD', 'ACWI',
    // TIGER/KODEX 미국 지수 ETF 이름 패턴
    '미국S&P', '미국나스닥', '미국NASDAQ',
  ]
  if (US_INDEX.some(k => combined.includes(k))) return 'CORE'

  // 2) 한국 대표 지수 ETF
  const KR_INDEX = [
    'KOSPI', '코스피', 'KOSDAQ', '코스닥',
    'KRX', 'KODEX 200', 'TIGER 200', 'ACE 200',
    'KBSTAR 200', 'HANARO 200', 'SOL 200', 'RISE 200',
  ]
  if (KR_INDEX.some(k => combined.includes(k))) return 'CORE'

  // "200" 포함 KR 티커 (6자리 KR 코드는 제외 — 개별 주식)
  // TIGER/KODEX/ACE 등 ETF 브랜드 + "200" 조합만 CORE
  const ETF_BRANDS = ['TIGER', 'KODEX', 'ACE', 'KBSTAR', 'HANARO', 'ARIRANG', 'SOL', 'RISE', '1Q', 'PLUS']
  const hasEtfBrand = ETF_BRANDS.some(b => combined.includes(b))

  if (hasEtfBrand && combined.includes('200')) return 'CORE'

  // 3) 우량 채권형 ETF / 펀드
  const BOND_KEYWORDS = [
    '국채', 'TREASURY', 'BOND', 'TLT', 'IEF', 'AGG', 'BND',
    'SGOV', 'SHY', 'VGSH', 'GOVT',
    '국고채', '채권', '액티브채권',
    '국고채30', '장기채', 'KODEX국고채', 'TIGER국채',
  ]
  if (BOND_KEYWORDS.some(k => combined.includes(k))) return 'CORE'

  // 4) 글로벌 분산 지수 ETF (대형 우량 ETF 브랜드 + 지수 패턴)
  // VOO, IVV, SCHB, VTI, CSPX 등 직접 티커 매칭
  const DIRECT_CORE_TICKERS = [
    'VOO', 'VTI', 'VT', 'SCHB', 'SCHA', 'SCHX',
    'IVV', 'CSPX', 'GLD', // 금 ETF는 CORE로 취급 (실물 자산)
    'PSLV', // 은 ETF
    'IAU', 'GDX',
    // 국내 S&P·나스닥 ETF 티커
    '102110', // TIGER 200
    '069500', // KODEX 200
    '360750', // TIGER 미국S&P500
    '133690', // TIGER 미국나스닥100
    '379800', // KODEX 미국S&P500
    '305720', // KODEX 미국나스닥100
  ]
  if (DIRECT_CORE_TICKERS.includes(t)) return 'CORE'

  // 5) ETF 브랜드가 있고 섹터 테마가 아닌 경우 CORE (넓은 분산 지수)
  //    단, 특정 섹터·테마 ETF는 SATELLITE로 유지
  const THEME_SATELLITE_KEYWORDS = [
    // 테마·섹터 → SATELLITE
    'AI', 'ROBOT', '로봇', '반도체', 'SEMICONDUCTOR',
    '바이오', 'BIO', 'HEALTH', 'BIOTECH', 'IBB',
    '방산', 'DEFENSE', 'K방산', 'AEROSPACE',
    '에너지', 'ENERGY', 'OIL', 'CLEAN',
    'EV', '전기차', 'BATTERY', '배터리',
    '우주', 'SPACE', '항공', 'AVIATION',
    '게임', 'GAME', '메타버스', 'METAVERSE',
    '리츠', 'REIT', '부동산',
    '중국', 'CHINA', '인도', 'INDIA', '항셍', 'HANG SENG',
    '일본', 'JAPAN', '니케이', 'NIKKEI',
    'XBI', 'XLK', 'XLE', 'XLF', 'XLV', 'ARKK', 'ARKG',
    'PLTR', 'TEM', 'GEV', 'ETN', 'IBB', 'XBI',
    '코리아AI', 'K-AI', '원자력', 'NUCLEAR',
    '구리', 'COPPER', '원자재', 'COMMODITY',
    '차이나', '항셍테크', '홍콩',
  ]
  if (hasEtfBrand && THEME_SATELLITE_KEYWORDS.some(k => combined.includes(k))) return 'SATELLITE'

  // 6) ETF 브랜드는 있지만 위에서 CORE로 분류되지 않은 경우 → 보수적으로 SATELLITE
  //    (분류 불명확한 ETF는 사용자가 수동 오버라이드 하도록)

  // 기본값: SATELLITE (개별주식, 불명확 ETF, 테마ETF)
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
      ? '지수형 ETF · 채권 · 분산 투자 자산으로 자동 분류'
      : '개별 종목 · 테마 ETF · 암호화폐로 자동 분류',
  }
}
