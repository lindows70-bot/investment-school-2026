/**
 * src/lib/macroPhaseScreener.ts
 * 🌐 매크로 국면 판별 + 퀀트 1차 스크리닝 라이브러리
 *
 * 파이프라인:
 *   FRED(금리·CPI·장단기금리차) + HY 스프레드
 *     → 6개 매크로 국면 자동 판별
 *     → 피터 린치 6대 종목 × 매크로 국면 가중치 매트릭스 적용
 *     → US 15 + KR 10 유니버스 → PEG·FCF·영업마진 스크린
 *     → US 상위 7 + KR 상위 5 = 12종목 최종 전달
 *
 * 모든 PEG는 app_cache(canon-fund:*) SSOT 재활용 (제2원칙 준수)
 * 고평가·해자 시그널 → '탈락' 아닌 플래그로 LLM에 전달 (제미나이 보강 ③)
 */

import { getCache, setCache } from '@/lib/appCache'
import { isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { isFinancialCompany } from '@/lib/assetClassifier'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type MacroPhase =
  | 'stagflation'      // 고물가 + 저성장
  | 'recession_risk'   // 장단기 역전 + 위기 신호
  | 'peak_rate'        // 금리 고점 연착륙
  | 'rate_cut_early'   // 금리 인하 초입 (현재 국면)
  | 'easy_money'       // 저금리 유동성 장세
  | 'neutral'          // 중립

export type LynchCategory = 'fast_grower' | 'stalwart' | 'cyclical' | 'turnaround' | 'asset_play' | 'slow_grower'

export interface MacroData {
  fedRate:    number      // 현재 기준금리 % = FRED FEDFUNDS(EFFR, ≈3.64) — FedWatch와 동일 출처(SSOT)
  cpiYoY:     number      // CPI 전년대비 % (e.g. 3.95)
  yieldCurve: number      // 10Y-2Y %p (양수=정상, 음수=역전)
  hySpread:   number      // HY 스프레드 % (낮을수록 risk-on)
  rateDir:    'cut' | 'hold' | 'hike'   // FedWatch FF선물 net 방향(SSOT) — 국면 판정의 실제 금리 방향
  nextFomc:   string | null             // 다음 FOMC 날짜(ISO) — FedWatch 회의 일정에서(하드코딩 제거)
}

export interface MacroPhaseResult {
  phase:      MacroPhase
  label:      string
  color:      string
  icon:       string
  description: string
}

export interface ScreenedStock {
  ticker:       string
  name:         string
  market:       'US' | 'KR'
  sector:       string | null
  lynchCategory: LynchCategory
  peg:          number | null
  opMargin:     number | null   // 영업이익률 %
  fcfPositive:  boolean
  fcfYield:     number | null   // 💵 FCF 수익률 = FCF/시총 (%) — 주가 대비 현금창출력(버블·하락장 방어력)
  qualityGap:   boolean         // ⚠️ 이익-현금 괴리(영업흑자인데 FCF 적자) = 이익의 질 의심
  price:        number | null
  currency:     'USD' | 'KRW'
  score:        number          // 퀀트 최종 점수 (높을수록 선호)
  flags:        string[]        // 경고 플래그 (탈락 아님, LLM 컨텍스트)
  // 📈 모멘텀 SSOT (Fwd EPS 성장 + 최근 주가 추세) — 사이클 방향
  momentumScore: number         // 0~100 (Fwd EPS 0.6 + 가격추세 0.4)
  fwdEpsDir:    'accel' | 'flat' | 'decline' | 'unknown'
  priceTrend:   'up' | 'side' | 'down' | 'unknown'
  knife:        boolean         // 최근 급락 + 하락추세 = 떨어지는 칼날(매수 추천 제외)
  fwdGrowthPct: number | null   // Fwd EPS 성장률(%)
  priceVs200:   number | null   // 현재가/200일선 − 1 (%)
}

export interface MomentumSignal {
  momentumScore: number
  fwdEpsDir: 'accel' | 'flat' | 'decline' | 'unknown'
  priceTrend: 'up' | 'side' | 'down' | 'unknown'
  knife: boolean
  fwdGrowthPct: number | null
  priceVs200: number | null
}

// ── 스크리닝 유니버스 ──────────────────────────────────────────────────────────
// US 125 + KR 94 = 약 220개(3차 확장 2026-06) → 퀀트 스코어링 → 통합추천/리밸런싱 후보 풀
// 코스닥 성장주(소부장·바이오·로봇) 편입으로 숨은 중소형 10배거 포착 범위 확대
const US_UNIVERSE: { ticker: string; lynch: LynchCategory; name: string }[] = [
  { ticker:'NVDA', lynch:'fast_grower', name:'NVIDIA' },
  { ticker:'MSFT', lynch:'stalwart',   name:'Microsoft' },
  { ticker:'AAPL', lynch:'stalwart',   name:'Apple' },
  { ticker:'GOOGL',lynch:'fast_grower',name:'Alphabet' },
  { ticker:'AMZN', lynch:'fast_grower',name:'Amazon' },
  { ticker:'META', lynch:'fast_grower',name:'Meta' },
  { ticker:'V',    lynch:'stalwart',   name:'Visa' },
  { ticker:'MA',   lynch:'stalwart',   name:'Mastercard' },
  { ticker:'JPM',  lynch:'cyclical',   name:'JPMorgan' },
  { ticker:'JNJ',  lynch:'stalwart',   name:'Johnson & Johnson' },
  { ticker:'KO',   lynch:'slow_grower',name:'Coca-Cola' },
  { ticker:'PLTR', lynch:'fast_grower',name:'Palantir' },
  { ticker:'ETN',  lynch:'cyclical',   name:'Eaton' },
  { ticker:'GEV',  lynch:'fast_grower',name:'GE Vernova' },
  { ticker:'ASML', lynch:'fast_grower',name:'ASML' },
  // ── 코어 풀 확장(2026-06) — 섹터 다변화(헬스케어·필수소비재·산업재·에너지·금융) ──
  { ticker:'LLY',  lynch:'fast_grower',name:'Eli Lilly' },
  { ticker:'UNH',  lynch:'stalwart',   name:'UnitedHealth' },
  { ticker:'ABBV', lynch:'stalwart',   name:'AbbVie' },
  { ticker:'COST', lynch:'stalwart',   name:'Costco' },
  { ticker:'PG',   lynch:'slow_grower',name:'Procter & Gamble' },
  { ticker:'WMT',  lynch:'stalwart',   name:'Walmart' },
  { ticker:'HD',   lynch:'stalwart',   name:'Home Depot' },
  { ticker:'CAT',  lynch:'cyclical',   name:'Caterpillar' },
  { ticker:'XOM',  lynch:'cyclical',   name:'Exxon Mobil' },
  { ticker:'CVX',  lynch:'cyclical',   name:'Chevron' },
  { ticker:'BAC',  lynch:'cyclical',   name:'Bank of America' },
  { ticker:'AVGO', lynch:'fast_grower',name:'Broadcom' },
  { ticker:'CRM',  lynch:'fast_grower',name:'Salesforce' },
  { ticker:'NOW',  lynch:'fast_grower',name:'ServiceNow' },
  { ticker:'AMD',  lynch:'fast_grower',name:'AMD' },
  // ── 코어 풀 2차 확장(2026-06) US 30→60 — 반도체·SW·헬스케어·금융·산업재 폭 확대 ──
  { ticker:'QCOM', lynch:'cyclical',   name:'Qualcomm' },
  { ticker:'TXN',  lynch:'cyclical',   name:'Texas Instruments' },
  { ticker:'MU',   lynch:'cyclical',   name:'Micron' },
  { ticker:'INTC', lynch:'turnaround', name:'Intel' },
  { ticker:'ORCL', lynch:'stalwart',   name:'Oracle' },
  { ticker:'ADBE', lynch:'fast_grower',name:'Adobe' },
  { ticker:'CRWD', lynch:'fast_grower',name:'CrowdStrike' },
  { ticker:'PANW', lynch:'fast_grower',name:'Palo Alto Networks' },
  { ticker:'ANET', lynch:'fast_grower',name:'Arista Networks' },
  { ticker:'MRVL', lynch:'fast_grower',name:'Marvell' },
  { ticker:'NFLX', lynch:'fast_grower',name:'Netflix' },
  { ticker:'DIS',  lynch:'stalwart',   name:'Disney' },
  { ticker:'NKE',  lynch:'stalwart',   name:'Nike' },
  { ticker:'MCD',  lynch:'slow_grower',name:'McDonald’s' },
  { ticker:'TSLA', lynch:'fast_grower',name:'Tesla' },
  { ticker:'MRK',  lynch:'stalwart',   name:'Merck' },
  { ticker:'PFE',  lynch:'slow_grower',name:'Pfizer' },
  { ticker:'TMO',  lynch:'stalwart',   name:'Thermo Fisher' },
  { ticker:'ISRG', lynch:'fast_grower',name:'Intuitive Surgical' },
  { ticker:'ABT',  lynch:'stalwart',   name:'Abbott' },
  { ticker:'GS',   lynch:'cyclical',   name:'Goldman Sachs' },
  { ticker:'MS',   lynch:'cyclical',   name:'Morgan Stanley' },
  { ticker:'WFC',  lynch:'cyclical',   name:'Wells Fargo' },
  { ticker:'SCHW', lynch:'cyclical',   name:'Charles Schwab' },
  { ticker:'BLK',  lynch:'stalwart',   name:'BlackRock' },
  { ticker:'AXP',  lynch:'cyclical',   name:'American Express' },
  { ticker:'BA',   lynch:'turnaround', name:'Boeing' },
  { ticker:'HON',  lynch:'stalwart',   name:'Honeywell' },
  { ticker:'DE',   lynch:'cyclical',   name:'Deere' },
  { ticker:'COP',  lynch:'cyclical',   name:'ConocoPhillips' },
  // ── 3차 확장(2026-06) US 60→120 — 반도체장비·SW·헬스케어·금융·산업재·소비 폭 대확장(숨은 성장주 포착) ──
  { ticker:'LRCX', lynch:'cyclical',   name:'Lam Research' },
  { ticker:'KLAC', lynch:'cyclical',   name:'KLA' },
  { ticker:'AMAT', lynch:'cyclical',   name:'Applied Materials' },
  { ticker:'ADI',  lynch:'cyclical',   name:'Analog Devices' },
  { ticker:'NXPI', lynch:'cyclical',   name:'NXP Semiconductors' },
  { ticker:'ON',   lynch:'cyclical',   name:'ON Semiconductor' },
  { ticker:'MPWR', lynch:'fast_grower',name:'Monolithic Power' },
  { ticker:'TER',  lynch:'cyclical',   name:'Teradyne' },
  { ticker:'ARM',  lynch:'fast_grower',name:'Arm Holdings' },
  { ticker:'SMCI', lynch:'fast_grower',name:'Super Micro' },
  { ticker:'SNPS', lynch:'fast_grower',name:'Synopsys' },
  { ticker:'CDNS', lynch:'fast_grower',name:'Cadence' },
  { ticker:'INTU', lynch:'stalwart',   name:'Intuit' },
  { ticker:'IBM',  lynch:'stalwart',   name:'IBM' },
  { ticker:'CSCO', lynch:'stalwart',   name:'Cisco' },
  { ticker:'ACN',  lynch:'stalwart',   name:'Accenture' },
  { ticker:'UBER', lynch:'fast_grower',name:'Uber' },
  { ticker:'ABNB', lynch:'fast_grower',name:'Airbnb' },
  { ticker:'SHOP', lynch:'fast_grower',name:'Shopify' },
  { ticker:'SNOW', lynch:'fast_grower',name:'Snowflake' },
  { ticker:'DDOG', lynch:'fast_grower',name:'Datadog' },
  { ticker:'NET',  lynch:'fast_grower',name:'Cloudflare' },
  { ticker:'ZS',   lynch:'fast_grower',name:'Zscaler' },
  { ticker:'COIN', lynch:'fast_grower',name:'Coinbase' },
  { ticker:'HOOD', lynch:'fast_grower',name:'Robinhood' },
  { ticker:'VRTX', lynch:'fast_grower',name:'Vertex Pharma' },
  { ticker:'REGN', lynch:'fast_grower',name:'Regeneron' },
  { ticker:'GILD', lynch:'stalwart',   name:'Gilead' },
  { ticker:'AMGN', lynch:'stalwart',   name:'Amgen' },
  { ticker:'BMY',  lynch:'stalwart',   name:'Bristol-Myers' },
  { ticker:'DHR',  lynch:'stalwart',   name:'Danaher' },
  { ticker:'BSX',  lynch:'fast_grower',name:'Boston Scientific' },
  { ticker:'MDT',  lynch:'stalwart',   name:'Medtronic' },
  { ticker:'SYK',  lynch:'stalwart',   name:'Stryker' },
  { ticker:'ELV',  lynch:'stalwart',   name:'Elevance Health' },
  { ticker:'C',    lynch:'cyclical',   name:'Citigroup' },
  { ticker:'USB',  lynch:'cyclical',   name:'US Bancorp' },
  { ticker:'PNC',  lynch:'cyclical',   name:'PNC Financial' },
  { ticker:'COF',  lynch:'cyclical',   name:'Capital One' },
  { ticker:'SPGI', lynch:'stalwart',   name:'S&P Global' },
  { ticker:'ICE',  lynch:'stalwart',   name:'Intercontinental Exchange' },
  { ticker:'CME',  lynch:'stalwart',   name:'CME Group' },
  { ticker:'PGR',  lynch:'stalwart',   name:'Progressive' },
  { ticker:'CB',   lynch:'stalwart',   name:'Chubb' },
  { ticker:'PEP',  lynch:'slow_grower',name:'PepsiCo' },
  { ticker:'SBUX', lynch:'stalwart',   name:'Starbucks' },
  { ticker:'LOW',  lynch:'stalwart',   name:'Lowe’s' },
  { ticker:'TJX',  lynch:'stalwart',   name:'TJX' },
  { ticker:'BKNG', lynch:'fast_grower',name:'Booking' },
  { ticker:'CMG',  lynch:'fast_grower',name:'Chipotle' },
  { ticker:'LULU', lynch:'fast_grower',name:'Lululemon' },
  { ticker:'GE',   lynch:'cyclical',   name:'GE Aerospace' },
  { ticker:'RTX',  lynch:'stalwart',   name:'RTX' },
  { ticker:'LMT',  lynch:'stalwart',   name:'Lockheed Martin' },
  { ticker:'NOC',  lynch:'stalwart',   name:'Northrop Grumman' },
  { ticker:'UNP',  lynch:'cyclical',   name:'Union Pacific' },
  { ticker:'UPS',  lynch:'cyclical',   name:'UPS' },
  { ticker:'EMR',  lynch:'cyclical',   name:'Emerson Electric' },
  { ticker:'SLB',  lynch:'cyclical',   name:'Schlumberger' },
  { ticker:'OXY',  lynch:'cyclical',   name:'Occidental' },
  { ticker:'MPC',  lynch:'cyclical',   name:'Marathon Petroleum' },
  { ticker:'FCX',  lynch:'cyclical',   name:'Freeport-McMoRan' },
  { ticker:'NUE',  lynch:'cyclical',   name:'Nucor' },
  { ticker:'TMUS', lynch:'stalwart',   name:'T-Mobile' },
  { ticker:'CMCSA',lynch:'slow_grower',name:'Comcast' },
]
const KR_UNIVERSE: { ticker: string; lynch: LynchCategory; name: string }[] = [
  { ticker:'005930',lynch:'stalwart',   name:'삼성전자' },
  { ticker:'000660',lynch:'cyclical',   name:'SK하이닉스' },
  { ticker:'035420',lynch:'fast_grower',name:'NAVER' },
  { ticker:'207940',lynch:'fast_grower',name:'삼성바이오로직스' },
  { ticker:'005380',lynch:'cyclical',   name:'현대차' },
  { ticker:'000270',lynch:'cyclical',   name:'기아' },
  { ticker:'035720',lynch:'fast_grower',name:'카카오' },
  { ticker:'068270',lynch:'fast_grower',name:'셀트리온' },
  { ticker:'033780',lynch:'slow_grower',name:'KT&G' },
  { ticker:'005490',lynch:'cyclical',   name:'POSCO홀딩스' },
  // ── 코어 풀 확장(2026-06) — 금융·바이오·방산·2차전지·인터넷 ──
  { ticker:'105560',lynch:'cyclical',   name:'KB금융' },
  { ticker:'055550',lynch:'cyclical',   name:'신한지주' },
  { ticker:'012450',lynch:'fast_grower',name:'한화에어로스페이스' },
  { ticker:'373220',lynch:'fast_grower',name:'LG에너지솔루션' },
  { ticker:'006400',lynch:'cyclical',   name:'삼성SDI' },
  { ticker:'051910',lynch:'cyclical',   name:'LG화학' },
  { ticker:'003670',lynch:'cyclical',   name:'포스코퓨처엠' },
  { ticker:'009540',lynch:'cyclical',   name:'HD한국조선해양' },
  { ticker:'042700',lynch:'cyclical',   name:'한미반도체' },
  { ticker:'196170',lynch:'fast_grower',name:'알테오젠' },
  // ── 코어 풀 2차 확장(2026-06) KR 20→40 — 금융·통신·바이오·소재·조선·전자 폭 확대 ──
  { ticker:'000810',lynch:'stalwart',   name:'삼성화재' },
  { ticker:'086790',lynch:'cyclical',   name:'하나금융지주' },
  { ticker:'316140',lynch:'cyclical',   name:'우리금융지주' },
  { ticker:'015760',lynch:'slow_grower',name:'한국전력' },
  { ticker:'034730',lynch:'stalwart',   name:'SK' },
  { ticker:'017670',lynch:'slow_grower',name:'SK텔레콤' },
  { ticker:'030200',lynch:'slow_grower',name:'KT' },
  { ticker:'066570',lynch:'cyclical',   name:'LG전자' },
  { ticker:'011200',lynch:'cyclical',   name:'HMM' },
  { ticker:'010130',lynch:'cyclical',   name:'고려아연' },
  { ticker:'028260',lynch:'stalwart',   name:'삼성물산' },
  { ticker:'010140',lynch:'cyclical',   name:'삼성중공업' },
  { ticker:'042660',lynch:'cyclical',   name:'한화오션' },
  { ticker:'064350',lynch:'cyclical',   name:'현대로템' },
  { ticker:'247540',lynch:'fast_grower',name:'에코프로비엠' },
  { ticker:'000100',lynch:'stalwart',   name:'유한양행' },
  { ticker:'128940',lynch:'fast_grower',name:'한미약품' },
  { ticker:'326030',lynch:'fast_grower',name:'SK바이오팜' },
  { ticker:'009150',lynch:'cyclical',   name:'삼성전기' },
  { ticker:'018260',lynch:'stalwart',   name:'삼성에스디에스' },
  // ── 3차 확장(2026-06) KR 40→95 — 코스피 중형 + 코스닥 성장주(소부장·바이오·로봇·2차전지 — 숨은 10배거 포착) ──
  { ticker:'032830',lynch:'stalwart',   name:'삼성생명' },
  { ticker:'003550',lynch:'stalwart',   name:'LG' },
  { ticker:'051900',lynch:'stalwart',   name:'LG생활건강' },
  { ticker:'090430',lynch:'cyclical',   name:'아모레퍼시픽' },
  { ticker:'097950',lynch:'stalwart',   name:'CJ제일제당' },
  { ticker:'271560',lynch:'stalwart',   name:'오리온' },
  { ticker:'139480',lynch:'cyclical',   name:'이마트' },
  { ticker:'012330',lynch:'cyclical',   name:'현대모비스' },
  { ticker:'086280',lynch:'cyclical',   name:'현대글로비스' },
  { ticker:'011070',lynch:'cyclical',   name:'LG이노텍' },
  { ticker:'009830',lynch:'cyclical',   name:'한화솔루션' },
  { ticker:'010950',lynch:'cyclical',   name:'S-Oil' },
  { ticker:'096770',lynch:'cyclical',   name:'SK이노베이션' },
  { ticker:'011170',lynch:'cyclical',   name:'롯데케미칼' },
  { ticker:'011780',lynch:'cyclical',   name:'금호석유' },
  { ticker:'161390',lynch:'cyclical',   name:'한국타이어앤테크놀로지' },
  { ticker:'003490',lynch:'cyclical',   name:'대한항공' },
  { ticker:'047810',lynch:'fast_grower',name:'한국항공우주' },
  { ticker:'079550',lynch:'fast_grower',name:'LIG넥스원' },
  { ticker:'267260',lynch:'fast_grower',name:'HD현대일렉트릭' },
  { ticker:'010120',lynch:'fast_grower',name:'LS ELECTRIC' },
  { ticker:'454910',lynch:'fast_grower',name:'두산로보틱스' },
  { ticker:'006800',lynch:'cyclical',   name:'미래에셋증권' },
  { ticker:'016360',lynch:'cyclical',   name:'삼성증권' },
  { ticker:'005940',lynch:'cyclical',   name:'NH투자증권' },
  { ticker:'071050',lynch:'cyclical',   name:'한국금융지주' },
  { ticker:'138040',lynch:'cyclical',   name:'메리츠금융지주' },
  { ticker:'024110',lynch:'cyclical',   name:'기업은행' },
  { ticker:'029780',lynch:'cyclical',   name:'삼성카드' },
  { ticker:'088350',lynch:'cyclical',   name:'한화생명' },
  { ticker:'259960',lynch:'fast_grower',name:'크래프톤' },
  { ticker:'251270',lynch:'fast_grower',name:'넷마블' },
  { ticker:'036570',lynch:'fast_grower',name:'엔씨소프트' },
  { ticker:'352820',lynch:'fast_grower',name:'하이브' },
  // ── 코스닥 성장주(10배거 사냥터 — 소부장·바이오·로봇) ──
  { ticker:'086520',lynch:'fast_grower',name:'에코프로' },
  { ticker:'058470',lynch:'fast_grower',name:'리노공업' },
  { ticker:'240810',lynch:'fast_grower',name:'원익IPS' },
  { ticker:'357780',lynch:'fast_grower',name:'솔브레인' },
  { ticker:'403870',lynch:'fast_grower',name:'HPSP' },
  { ticker:'140860',lynch:'fast_grower',name:'파크시스템스' },
  { ticker:'098460',lynch:'fast_grower',name:'고영' },
  { ticker:'005290',lynch:'fast_grower',name:'동진쎄미켐' },
  { ticker:'039030',lynch:'fast_grower',name:'이오테크닉스' },
  { ticker:'213420',lynch:'fast_grower',name:'덕산네오룩스' },
  { ticker:'036930',lynch:'fast_grower',name:'주성엔지니어링' },
  { ticker:'084370',lynch:'fast_grower',name:'유진테크' },
  { ticker:'095340',lynch:'fast_grower',name:'ISC' },
  { ticker:'348370',lynch:'fast_grower',name:'엔켐' },
  { ticker:'022100',lynch:'fast_grower',name:'포스코DX' },
  { ticker:'277810',lynch:'fast_grower',name:'레인보우로보틱스' },
  { ticker:'145020',lynch:'fast_grower',name:'휴젤' },
  { ticker:'214150',lynch:'fast_grower',name:'클래시스' },
  { ticker:'195940',lynch:'fast_grower',name:'HK이노엔' },
  { ticker:'141080',lynch:'fast_grower',name:'리가켐바이오' },
]

// ── 매크로 국면 × 피터 린치 가중치 매트릭스 (제미나이 보강 ①) ─────────────────
// 값이 높을수록 해당 국면에서 해당 분류에 가점
const LYNCH_MACRO_WEIGHTS: Record<MacroPhase, Record<LynchCategory, number>> = {
  stagflation:    { fast_grower:0.6, stalwart:1.3, cyclical:0.7, turnaround:0.5, asset_play:1.4, slow_grower:1.0 },
  recession_risk: { fast_grower:0.7, stalwart:1.4, cyclical:0.5, turnaround:0.4, asset_play:1.2, slow_grower:1.1 },
  peak_rate:      { fast_grower:1.0, stalwart:1.2, cyclical:0.9, turnaround:0.8, asset_play:1.1, slow_grower:1.0 },
  rate_cut_early: { fast_grower:1.3, stalwart:1.1, cyclical:1.1, turnaround:1.0, asset_play:0.9, slow_grower:0.8 },
  easy_money:     { fast_grower:1.5, stalwart:1.0, cyclical:1.2, turnaround:1.2, asset_play:0.8, slow_grower:0.7 },
  neutral:        { fast_grower:1.0, stalwart:1.0, cyclical:1.0, turnaround:1.0, asset_play:1.0, slow_grower:1.0 },
}

// ── 매크로 국면 판별 알고리즘 ─────────────────────────────────────────────────
export function detectMacroPhase(d: MacroData): MacroPhaseResult {
  const { fedRate, cpiYoY, yieldCurve, hySpread, rateDir } = d
  // 1) 스태그플레이션: 고물가 + HY 스프레드 급등
  if (cpiYoY > 5 && hySpread > 5)
    return { phase:'stagflation', label:'스태그플레이션 우려', color:'#f87171', icon:'🔥', description:'고물가·저성장 복합 위기 — 현금 흐름 우량주·실물 자산주 선호' }
  // 2) 경기침체 위험: 장단기 금리 깊게 역전
  if (yieldCurve < -0.4)
    return { phase:'recession_risk', label:'경기침체 위험 신호', color:'#f87171', icon:'⚠️', description:'장단기 금리 역전 — 방어적 대형 우량주·배당주 선호' }
  // 3) 스태그플레이션 전조: 높은 물가
  if (cpiYoY > 4.5)
    return { phase:'stagflation', label:'인플레 압박 국면', color:'#fb923c', icon:'📈', description:'물가 압박 지속 — 가격 결정력 보유 기업(해자 넓은 대형주) 선호' }
  // 4) 저금리 유동성
  if (fedRate <= 2)
    return { phase:'easy_money', label:'유동성 장세', color:'#22d3ee', icon:'💧', description:'저금리 풍부한 유동성 — 성장주·혁신 기업 강세 국면' }
  // 5) 금리 인하 초입: FedWatch가 '실제 인하 컨센서스'일 때만 (정적 레벨만으로 단정 금지)
  if (rateDir === 'cut' && fedRate > 2 && cpiYoY < 5 && yieldCurve >= 0)
    return { phase:'rate_cut_early', label:'금리 인하 초입', color:'#4ade80', icon:'✂️', description:'FF선물이 인하 사이클 진입을 반영 — 성장주·기술주 리레이팅 기대, 선별적 접근' }
  // 6) 금리 고점·동결: FedWatch가 동결/소폭 인상을 반영(현재 국면). '인하'로 오표기하지 않음
  return {
    phase:'peak_rate', label:'금리 고점·동결', color:'#f59e0b', icon:'🏔️',
    description: rateDir === 'hike'
      ? '시장은 당분간 동결~소폭 인상을 기대 — 이자수익 금융주·FCF 우량주 선호 (점도표상 장기 인하 경로는 참고)'
      : '시장은 당분간 금리 동결을 기대 — 이자수익 금융주·FCF 우량주 선호 (점도표상 장기 인하 경로는 참고)',
  }
}

// ── FRED 데이터 수집 (24h 캐시) ──────────────────────────────────────────────
const FRED_KEY = process.env.FRED_API_KEY
async function fredLatest(series: string, count = 14): Promise<{ date: string; v: number }[]> {
  if (!FRED_KEY) return []
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${count}`
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j?.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) })).filter((o: { v: number }) => isFinite(o.v))
  } catch { return [] }
}

// FedWatch FF선물 컨센서스로 '실제 금리 방향' + '다음 FOMC 날짜' 산출 — FedWatch와 동일 출처(제2원칙)
async function fetchRateDirection(currentRate: number, selfBase?: string): Promise<{ dir: 'cut' | 'hold' | 'hike'; nextFomc: string | null }> {
  if (!selfBase) return { dir: 'hold', nextFomc: null }
  try {
    const r = await fetch(`${selfBase}/api/fedwatch?currentRate=${currentRate.toFixed(4)}`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return { dir: 'hold', nextFomc: null }
    const j = await r.json()
    const meetings: { consensusRate: number | null; date: string }[] = j?.meetings ?? []
    const today = new Date().toISOString().slice(0, 10)
    const nextFomc = meetings.find(m => m?.date && m.date >= today)?.date ?? meetings[0]?.date ?? null
    const last = [...meetings].reverse().find(m => m?.consensusRate != null)   // 가장 먼 회의의 컨센서스
    if (!last || last.consensusRate == null) return { dir: 'hold', nextFomc }
    const net = last.consensusRate - currentRate     // 양수=인상, 음수=인하 (25bp의 절반=0.125 임계)
    const dir: 'cut' | 'hold' | 'hike' = net <= -0.13 ? 'cut' : net >= 0.13 ? 'hike' : 'hold'
    return { dir, nextFomc }
  } catch { return { dir: 'hold', nextFomc: null } }
}

export async function fetchMacroData(selfBase?: string): Promise<MacroData> {
  const cacheKey = 'macro-phase-data-v3'   // v3: FEDFUNDS 기준금리 + FedWatch 방향 + 다음 FOMC 날짜
  const cached = await getCache<MacroData>(cacheKey, 24 * 3600_000)
  if (cached) return cached

  const [fedArr, cpiArr, yc2Arr, yc10Arr, hyArr] = await Promise.all([
    fredLatest('FEDFUNDS', 3),   // EFFR(실효 기준금리 midpoint) — FedWatch currentRate와 동일 출처
    fredLatest('CPIAUCSL', 14),
    fredLatest('DGS2', 3),
    fredLatest('GS10', 3),
    fredLatest('BAMLH0A0HYM2', 3),
  ])
  const fedRate = Math.round((fedArr[0]?.v ?? 3.64) * 100) / 100
  const cpiYoY = cpiArr.length >= 13
    ? Math.round(((cpiArr[0].v - cpiArr[12].v) / cpiArr[12].v) * 1000) / 10
    : 4.0
  const yieldCurve = (yc10Arr[0]?.v != null && yc2Arr[0]?.v != null)
    ? Math.round((yc10Arr[0].v - yc2Arr[0].v) * 100) / 100
    : 0.4
  const hySpread = hyArr[0]?.v ?? 3.0
  const { dir: rateDir, nextFomc } = await fetchRateDirection(fedRate, selfBase)
  const data: MacroData = { fedRate, cpiYoY, yieldCurve, hySpread, rateDir, nextFomc }
  await setCache(cacheKey, data)
  return data
}

// ── 퀀트 스크리닝 ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function numf(v: any): number | null { if (v == null) return null; const n = typeof v === 'object' && 'raw' in v ? v.raw : v; const f = typeof n === 'number' ? n : parseFloat(n); return isFinite(f) ? f : null }

// 📈 모멘텀 SSOT — Fwd EPS 성장 방향 + 최근 주가 추세(50/200일선·52주). Yahoo 모듈 재사용(추가 fetch 0)
//   철학: 같은 경기순환주라도 이익이 '오르는'(반도체 AI) vs '내리는'(에너지 유가급락) 사이클을 가른다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeMomentum(ks: any, fd: any, sd: any, price: number | null, etTrend: any[]): MomentumSignal {
  // ① Fwd EPS 방향 — EPS 리비전(애널리스트가 차기연도 추정치를 올리나/내리나)이 진짜 모멘텀.
  //    ⚠️ forwardEps/trailing 절대비율은 기저효과(저점 회복 기대 선반영)로 왜곡되므로 사용 안 함.
  const ny = (etTrend ?? []).find(t => t?.period === '+1y') ?? (etTrend ?? []).find(t => t?.period === '0y')
  const cur = numf(ny?.epsTrend?.current), ago30 = numf(ny?.epsTrend?.['30daysAgo'])
  let revision: 'up' | 'down' | 'flat' | null = null
  if (cur != null && ago30 != null && ago30 > 0) {
    const chg = (cur - ago30) / Math.abs(ago30)
    revision = chg > 0.005 ? 'up' : chg < -0.005 ? 'down' : 'flat'
  }
  const tg = numf(fd?.earningsGrowth) != null ? (fd.earningsGrowth as number) * 100 : null   // 후행 이익성장(사이클 방향)
  const fwdEps = numf(ks?.forwardEps), trailEps = numf(ks?.trailingEps)
  const fwdGrowthPct = (fwdEps != null && trailEps != null && trailEps > 0) ? Math.round(((fwdEps / trailEps) - 1) * 1000) / 10 : null
  let fwdScore = 0.5, fwdEpsDir: MomentumSignal['fwdEpsDir'] = 'unknown'
  if (revision === 'up') { fwdScore = 0.85; fwdEpsDir = 'accel' }
  else if (revision === 'down') { fwdScore = 0.20; fwdEpsDir = 'decline' }
  else if (tg != null) {
    if (tg >= 15) { fwdScore = 0.75; fwdEpsDir = 'accel' }
    else if (tg <= -10) { fwdScore = 0.30; fwdEpsDir = 'decline' }
    else { fwdScore = 0.50; fwdEpsDir = 'flat' }
  }
  // ⚠️ 후행 이익이 깊은 역성장(≤−10%)이면 리비전 상향은 '회복 기대'일 뿐 → 한 단계 눌러 과신 차단(COP 유가케이스)
  if (revision === 'up' && tg != null && tg <= -10) { fwdScore = 0.55; fwdEpsDir = 'flat' }

  // ② 가격 추세 + ③ 떨어지는 칼날 — 공유 SSOT(위성 스크리너도 동일 정의 사용)
  const { priceTrend, knife, priceVs200 } = priceTrendKnife(ks, sd, price)
  const priceScore = priceTrend === 'up' ? 1.0 : priceTrend === 'down' ? 0.15 : 0.5
  const momentumScore = Math.round((fwdScore * 0.6 + priceScore * 0.4) * 100)   // Fwd EPS 가중↑(가장 중요)
  return { momentumScore, fwdEpsDir, priceTrend, knife, fwdGrowthPct, priceVs200 }
}

// 📉 가격추세·떨어지는 칼날 SSOT — 50/200일선 정렬 + 52주 위치. 통합추천(computeMomentum)·위성 스크리너 공용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function priceTrendKnife(ks: any, sd: any, price: number | null): { priceTrend: MomentumSignal['priceTrend']; knife: boolean; priceVs200: number | null } {
  const ma50 = numf(sd?.fiftyDayAverage), ma200 = numf(sd?.twoHundredDayAverage)
  const w52 = numf(ks?.['52WeekChange']) ?? numf(sd?.fiftyTwoWeekChange)
  const lo = numf(sd?.fiftyTwoWeekLow)
  let priceTrend: MomentumSignal['priceTrend'] = 'unknown', priceVs200: number | null = null
  if (price != null && ma200 != null && ma200 > 0) priceVs200 = Math.round(((price / ma200) - 1) * 1000) / 10
  if (price != null && ma50 != null && ma200 != null) {
    const above50 = price >= ma50, above200 = price >= ma200, ma50Up = ma50 >= ma200
    if (above50 && above200 && ma50Up) priceTrend = 'up'        // 정배열 상승
    else if (!above200 && !ma50Up) priceTrend = 'down'          // 200일선·정배열 모두 깨짐(하락)
    else priceTrend = 'side'                                     // 눌림목/횡보(200일선 위·정배열 유지)
  }
  // 떨어지는 칼날 — 하락추세 + 200일선 8%+ 하회 + (52주 하락 또는 52주 저점 15% 이내). 눌림목은 칼날 아님
  const nearLow = (price != null && lo != null && lo > 0) ? (price <= lo * 1.15) : false
  const knife = priceTrend === 'down' && priceVs200 != null && priceVs200 <= -8 && ((w52 != null && w52 < 0) || nearLow)
  return { priceTrend, knife, priceVs200 }
}

async function screenOne(
  ticker: string, market: 'US' | 'KR', lynch: LynchCategory, name: string, phase: MacroPhase
): Promise<ScreenedStock | null> {
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    const q = await yf.quoteSummary(sym, { modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price', 'assetProfile', 'earningsTrend'] })
    const ks = q?.defaultKeyStatistics ?? {}, fd = q?.financialData ?? {}, sd = q?.summaryDetail ?? {}, pr = q?.price ?? {}
    const peg = numf(ks.pegRatio)
    const opMargin = numf(fd.operatingMargins) != null ? Math.round((fd.operatingMargins as number) * 1000) / 10 : null
    const fcf = numf(fd.freeCashflow)
    const ocf = numf(fd.operatingCashflow)   // 영업현금흐름 — 이익의 질(현금 전환) 척도
    const fcfPositive = fcf != null ? fcf > 0 : true   // 모를 때 긍정 가정
    const marketCap = numf(sd.marketCap) ?? numf(pr.marketCap)
    // 🏦 금융 가드 — 은행·보험·증권은 OCF/FCF가 예금·대출·트레이딩·보험 float으로 출렁여 '이익의 질' 신호가 무의미(이자보상배율·총마진 가드와 동일). FCF 지표 중립 처리
    const isFin = isFinancialCompany(ticker, name, String(q?.assetProfile?.industry || '')) || /financ|bank|insurance/i.test(String(q?.assetProfile?.sector || ''))
    // 💵 FCF 수익률(FCF/시총) — 부호만 보던 것을 '주가 대비 현금창출력'으로.
    // ⚠️ 이익-현금 괴리 = 영업흑자인데 '영업현금흐름(OCF)'까지 마이너스 = 이익이 현금으로 안 들어옴(분식·버블 조기경보).
    //    FCF만 마이너스(OCF는 흑자)는 CAPEX 성장 투자일 수 있어 괴리 아님(재고적체 가드가 NVDA 램프업 제외한 것과 동일 철학).
    const fcfYield = (!isFin && fcf != null && marketCap != null && marketCap > 0) ? Math.round(fcf / marketCap * 1000) / 10 : null
    const qualityGap = !isFin && opMargin != null && opMargin > 0 && ocf != null && ocf < 0
    const fcfNegOcfOk = !isFin && fcf != null && fcf < 0 && ocf != null && ocf > 0   // FCF만 적자·OCF 흑자 = CAPEX 성장(좀비 아님)
    const price = numf(pr.regularMarketPrice) ?? numf(sd.regularMarketPrice)
    const currency = market === 'KR' ? 'KRW' as const : 'USD' as const
    const sector = String(q?.assetProfile?.sector || q?.price?.sector || '—')   // ★ price.sector는 빈값 → assetProfile 우선(섹터 필터·LLM 정확도)

    // 최소 품질 필터 (탈락): 영업이익 -20% 이하만 제거
    if (opMargin != null && opMargin < -20) return null

    // 플래그 (탈락 아닌 정보 — LLM에 전달)
    const flags: string[] = []
    if (peg != null && peg > 2.0) flags.push(`고평가 주의(PEG ${peg.toFixed(1)})`)
    if (qualityGap) flags.push('⚠️ 이익-현금 괴리(영업흑자인데 영업현금흐름 적자 — 이익의 질 의심)')
    else if (fcfNegOcfOk) flags.push('FCF 적자(단 영업현금 흑자 — CAPEX 성장 투자)')
    else if (!fcfPositive) flags.push('FCF 적자')
    if (fcfYield != null && fcfYield >= 5) flags.push(`💵 FCF 수익률 ${fcfYield}%(현금창출력 우수)`)
    if (opMargin != null && opMargin < 0) flags.push('영업손실')
    if (peg != null && peg > 3.0) flags.push('밸류에이션 부담 과중')

    // 퀀트 점수 계산
    const lynchW = LYNCH_MACRO_WEIGHTS[phase][lynch]
    // PEG 낮을수록 ↑ (상한 1.0 — 과거엔 미캡이라 PEG 0.03 등이 1.49로 가치를 인플레). ⚠️ 기저효과(착시 저PEG)면 중립(0.5)
    const earnGrowth = numf(fd.earningsGrowth)   // 소수(1.0=+100%) — isPegBaseEffect 규약과 동일 단위
    const pegScore = isPegBaseEffect(peg, earnGrowth) ? 0.5
      : (peg != null && peg > 0 ? Math.min(1.0, Math.max(0, 1.5 - peg * 0.3)) : 0.5)
    const marginScore = opMargin != null ? Math.min(1, Math.max(0, opMargin / 40)) : 0.3
    // 💵 FCF 점수 — 부호만 → FCF 수익률 등급제. 괴리(OCF 적자)=최저, FCF적자는 OCF 흑자(성장 CAPEX)면 완화·OCF도 적자면 최저
    const fcfScore = isFin ? 0.6                                   // 🏦 금융주는 FCF 무의미 → 중립(FCF로 가감 안 함)
      : qualityGap ? 0.15
      : fcfYield != null && fcfYield >= 0 ? (fcfYield >= 5 ? 1.0 : fcfYield >= 3 ? 0.85 : fcfYield >= 1 ? 0.65 : 0.45)
      : fcfNegOcfOk ? 0.4                                          // 영업현금 흑자인데 CAPEX로 FCF 적자 = 완화(좀비 아님)
      : (fcf != null ? (fcf > 0 ? 0.7 : 0.2) : 0.6)               // FCF·OCF 다 적자=0.2 / 시총만 없으면 부호 / 아예 모르면 0.6
    const score = Math.round((lynchW * 0.35 + pegScore * 0.35 + marginScore * 0.2 + fcfScore * 0.1) * 1000) / 1000

    // 📈 모멘텀(Fwd EPS·가격추세) — 추가 fetch 0, 별도 축으로 노출(downstream 4축 채점·칼날 제외)
    const mom = computeMomentum(ks, fd, sd, price, q?.earningsTrend?.trend ?? [])
    if (mom.fwdEpsDir === 'decline') flags.push('이익 역성장(하강 사이클)')
    if (mom.knife) flags.push('주가 급락 추세(falling knife)')

    return { ticker, name, market, sector, lynchCategory: lynch, peg, opMargin, fcfPositive, fcfYield, qualityGap, price, currency, score, flags, ...mom }
  } catch { return null }
}

export async function runScreener(phase: MacroPhase): Promise<{ us: ScreenedStock[]; kr: ScreenedStock[]; all: ScreenedStock[] }> {
  const all: ScreenedStock[] = []
  // 동시성 8 — 유니버스 ~220종목 확장(2026-06) 대응(120s→300s 함께 상향). Yahoo 스로틀은 screenOne catch + 재시도 패스로 graceful
  const CONC = 8
  const universe = [
    ...US_UNIVERSE.map(s => ({ ...s, market: 'US' as const })),
    ...KR_UNIVERSE.map(s => ({ ...s, market: 'KR' as const })),
  ]
  for (let i = 0; i < universe.length; i += CONC) {
    const batch = universe.slice(i, i + CONC)
    const results = await Promise.all(batch.map(s => screenOne(s.ticker, s.market, s.lynch, s.name, phase).catch(() => null)))
    for (const r of results) if (r) all.push(r)
  }
  // ★ 스로틀 누락 1회 재시도(2026-06) — Yahoo throttle로 빠진 종목(예: 조선주) 복구. 커버리지 완전성↑
  //   (catch→null로 빠진 것만. 첫 패스 ~15s 뒤라 Yahoo 회복 여유. 동시성 4·종목당 80ms 간격)
  const done = new Set(all.map(s => s.ticker))
  const missing = universe.filter(u => !done.has(u.ticker))
  for (let i = 0; i < missing.length; i += 4) {
    const batch = missing.slice(i, i + 4)
    const results = await Promise.all(batch.map(async (s, k) => {
      await new Promise(r => setTimeout(r, k * 80))
      return screenOne(s.ticker, s.market, s.lynch, s.name, phase).catch(() => null)
    }))
    for (const r of results) if (r) all.push(r)
  }
  // 쿼터 확장(US 10 + KR 7 = 17) — 사용자 보유 종목 제외 후 5개 신규 확보에 충분한 버퍼
  const us = all.filter(s => s.market === 'US').sort((a, b) => b.score - a.score).slice(0, 10)
  const kr = all.filter(s => s.market === 'KR').sort((a, b) => b.score - a.score).slice(0, 7)
  return { us, kr, all }   // all = 슬라이스 전 전체 채점(섹터 필터용 — 4계절 매수 후보가 재사용)
}
