// 린치 고정 분류표(SSOT) — 종목 등록 때의 분류(lynch-classify)와 추천 스크리너 유니버스가 같은 표를 본다
//   2026-10-01: 같은 종목의 분류가 lynch-classify 와 macroPhaseScreener 두 곳에 따로 적혀 있었고, 겹치는 94종 중 25종이 달랐다
//   (삼성전자가 보유 화면에선 경기순환주, 추천 계산에선 우량주). 이 표가 기준이다 — DB lynch_category 와 어긋남 0종(실측).
//   분류를 바꿀 땐 여기 한 곳만 고친다. 검증: scripts/verify-lynch-known.mjs(야간).

export type LynchKnownKey = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play'

// ─── 고정 분류표 — 폴백이 아니라 **우선**이다(lynch-classify 가 이 표를 먼저 보고, 있으면 재무를 묻지 않는다 · 2026-10-03 결정). 낡은 값 점검 2026-10-09: docs/history/2026-10.md ───
export const US_KNOWN: Record<string, LynchKnownKey> = {
  // Fast Growers
  NVDA:'fast_grower', PLTR:'fast_grower', META:'fast_grower',
  AMZN:'fast_grower', TSLA:'fast_grower', GEV:'fast_grower',
  CRWD:'fast_grower', NET:'fast_grower',  SHOP:'fast_grower',
  SNOW:'fast_grower', COIN:'fast_grower', SQ:'fast_grower',
  MRVL:'fast_grower', ARM:'fast_grower',  SMCI:'fast_grower',
  // 적자 매출 고성장 신생기업 (AI·양자·바이오) → 빠른성장주
  TEM:'fast_grower', IONQ:'fast_grower', RGTI:'fast_grower', QBTS:'fast_grower',
  RXRX:'fast_grower', SOUN:'fast_grower', RKLB:'fast_grower',
  // Fast Growers (추가)
  VRT:'fast_grower', ANET:'fast_grower', NOW:'fast_grower', PANW:'fast_grower',
  // Stalwarts
  AAPL:'stalwart', MSFT:'stalwart', GOOGL:'stalwart', GOOG:'stalwart',
  JPM:'stalwart',  V:'stalwart',    MA:'stalwart',    JNJ:'stalwart',
  UNH:'stalwart',  PG:'stalwart',   KO:'stalwart',    WMT:'stalwart',
  HD:'stalwart',   COST:'stalwart', ABBV:'stalwart',  LLY:'stalwart',
  NVO:'stalwart',  ASML:'stalwart', TSM:'stalwart',   AVGO:'stalwart',
  ORCL:'stalwart', CRM:'stalwart',  ADBE:'stalwart',  ACN:'stalwart',
  // Slow Growers (통신·유틸리티·고배당)
  T:'slow_grower', VZ:'slow_grower', MO:'slow_grower', PM:'slow_grower',
  TMUS:'slow_grower', NEE:'slow_grower', DUK:'slow_grower', SO:'slow_grower',
  // Cyclicals (반도체·철강·자동차 추가)
  MU:'cyclical', NUE:'cyclical', X:'cyclical',
  // Cyclicals (에너지·반도체·소재·산업재)
  XOM:'cyclical', CVX:'cyclical', COP:'cyclical', OXY:'cyclical',
  SLB:'cyclical', HAL:'cyclical',
  F:'cyclical',   GM:'cyclical',  BA:'cyclical',
  CAT:'cyclical', DE:'cyclical',  FCX:'cyclical',
  TXN:'cyclical', COHR:'cyclical', ON:'cyclical', QCOM:'cyclical',
  // Turnarounds (적자 회생)
  INTC:'turnaround', SNAP:'turnaround', PLUG:'turnaround', FCEL:'turnaround',
  // Asset Plays
  AMT:'asset_play', PLD:'asset_play', SPG:'asset_play',
}

export const KR_KNOWN: Record<string, LynchKnownKey> = {
  // 대형 우량주
  '055550':'stalwart',    // 신한지주
  '035720':'stalwart',    // 카카오 (최근 4분기 EPS +783원 흑자·시총 약 14.9조. 2026-10-01 turnaround 에서 옮김 — 회생이 끝난 대형주)
  '105560':'stalwart',    // KB금융
  '012330':'stalwart',    // 현대모비스
  '028260':'stalwart',    // 삼성물산
  '034730':'stalwart',    // SK
  '000810':'stalwart',    // ★ 삼성화재 (대형 보험 우량주)
  '032830':'stalwart',    // ★ 삼성생명 (대형 보험 우량주)
  '316140':'stalwart',    // ★ 우리금융지주
  // 저성장주 (통신·유틸리티·고배당)
  '017670':'slow_grower', // ★ SK텔레콤 (통신)
  '030200':'slow_grower', // ★ KT (통신)
  '032640':'slow_grower', // ★ LG유플러스 (통신)
  '015760':'slow_grower', // ★ 한국전력 (유틸리티)
  '036460':'slow_grower', // ★ 한국가스공사 (유틸리티)
  // 경기 순환주 (반도체·철강·화학·가전·자동차·조선)
  '005930':'cyclical',    // ★ 삼성전자 (반도체 = 메모리 사이클, 시총 무관 경기순환)
  '000660':'cyclical',    // SK하이닉스 (반도체)
  '066570':'cyclical',    // ★ LG전자 (가전 = 경기민감)
  '005380':'cyclical',    // ★ 현대차 (자동차 = 경기민감)
  '005385':'cyclical',    // ★ 현대차2우B (우선주도 동일)
  '005387':'cyclical',    // ★ 현대차3우B
  '000270':'cyclical',    // 기아 (자동차)
  '042660':'cyclical',    // 한화오션 (조선)
  '042700':'cyclical',    // 한미반도체 (반도체장비 = 경기민감)
  '005490':'cyclical',    // ★ POSCO홀딩스 (철강)
  '051910':'cyclical',    // ★ LG화학 (화학 = 경기민감)
  '011170':'cyclical',    // ★ 롯데케미칼 (화학)
  '006400':'cyclical',    // ★ 삼성SDI (배터리 = 경기민감)
  '009150':'cyclical',    // ★ 삼성전기 (전자부품)
  '010140':'cyclical',    // 삼성중공업 (조선)
  '034020':'cyclical',    // 두산에너빌리티 (발전설비)
  '000150':'cyclical',    // 두산 (중공업 지주)
  '010120':'cyclical',    // LS ELECTRIC (전력기기)
  // 빠른 성장주
  '035420':'fast_grower', // NAVER
  '207940':'fast_grower', // 삼성바이오로직스
  '068270':'fast_grower', // 셀트리온
  '012450':'fast_grower', // 한화에어로스페이스 (방산 고성장)
  '278470':'fast_grower', // 에이피알 (K뷰티 고성장)
  '440110':'fast_grower', // 파두 (AI칩 팹리스 신생 — 적자지만 매출 225→435→924억으로 해마다 약 두 배(네이버 연간 재무 2023~2025). 미국 쪽 '적자 매출 고성장 신생기업 → 고성장주' 방침과 같은 기준)
  // 회생 기업주
  '010170':'turnaround',  // 대한광통신 (최근 4분기 EPS −166원 적자·무배당. 2026-10-01 slow_grower 에서 옮김)
  // 자산 보유주
  '017960':'asset_play',  // 한국카본 (특수소재)
  // 저성장주
  '189300':'fast_grower', // 인텔리안테크 (위성안테나 성장)
  // 반도체 밸류체인 (소재·기판·장비) → 메모리 사이클 영향 = 경기순환주
  '007660':'cyclical',    // ★ 이수페타시스 (반도체 PCB 기판)
  '077360':'cyclical',    // ★ 덕산하이메탈 (반도체 소재)
}

/** 고정표에 있으면 그 분류, 없으면 null. 국내는 .KS/.KQ 접미사를 떼고 찾는다 */
export function knownLynch(ticker: string, market: 'US' | 'KR'): LynchKnownKey | null {
  return (market === 'KR' ? KR_KNOWN[ticker.replace(/\.(KS|KQ)$/i, '')] : US_KNOWN[ticker.toUpperCase()]) ?? null
}
