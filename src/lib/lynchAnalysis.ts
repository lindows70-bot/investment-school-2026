/**
 * lynchAnalysis.ts — 피터 린치 분석 SSOT (Single Source of Truth)
 *
 * 이 파일이 Lynch 분석의 유일한 진실 소스입니다.
 * MacroTerminalDashboard / LynchLineTerminal / MacroStressTester 등
 * 모든 컴포넌트는 여기서 export된 함수를 사용해야 합니다.
 *
 * 처리하는 엣지 케이스:
 *  - 적자 기업 (EPS ≤ 0)
 *  - PE = "N/A" / null / undefined / 0
 *  - EPS 이상값 (API 단위 오류: SK하이닉스 ₩298,495 같은 사례)
 *  - Multiple 상한 무제한 (PLTR PE=161 → 252배 계산됨)
 *  - 카테고리 미분류 (null / na / undefined)
 *  - KR vs US 시장별 보수적 보정
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. 상수 정의
// ────────────────────────────────────────────────────────────────────────────

/** 피터 린치 6대 카테고리 영문 키 */
export type LynchCategoryKey =
  | 'fast_grower' | 'stalwart' | 'slow_grower'
  | 'cyclical'    | 'turnaround' | 'asset_play' | 'na'

/** 카테고리별 기본 멀티플 (PEG=1, 성장률 = 적정 PER) */
export const LYNCH_MULTIPLE_DEFAULT: Record<LynchCategoryKey, number> = {
  fast_grower:  25,   // 20%+ 성장 → PER 25
  stalwart:     15,   // 10~20% 성장 → PER 15
  slow_grower:  10,   // 0~10% 성장 → PER 10
  cyclical:     12,   // 경기 사이클 → 보수 PER 12
  turnaround:   20,   // 회복 기대 → PER 20
  asset_play:   12,   // 순자산 기준 → PER 12
  na:           15,   // 미분류 → 중간값
}

/**
 * 카테고리별 멀티플 상한 캡
 * Lynch 원칙: "아무리 좋은 주식도 PEG > 2는 위험하다"
 *   fast_grower: 30 (40% 성장도 30배 캡 — 과도한 기대 방지)
 *   stalwart:    20 (대형우량주는 성장률 낮아 20배 이상 부당)
 */
export const LYNCH_MULTIPLE_CAP: Record<LynchCategoryKey, number> = {
  fast_grower:  30,
  stalwart:     20,
  slow_grower:  12,
  cyclical:     14,
  turnaround:   25,
  asset_play:   15,
  na:           20,
}

/** 카테고리별 최소 PE (이 값 이하로 implied PE가 나오면 EPS가 이상값) */
const LYNCH_MIN_PE: Record<LynchCategoryKey, number> = {
  fast_grower:  12,
  stalwart:     8,
  slow_grower:  5,
  cyclical:     4,
  turnaround:   8,
  asset_play:   5,
  na:           8,
}

/** 카테고리 한글 레이블 */
export const LYNCH_CATEGORY_KR: Record<string, string> = {
  fast_grower:  '고성장주',
  stalwart:     '대형우량주',
  slow_grower:  '저성장주',
  cyclical:     '경기순환주',
  turnaround:   '턴어라운드주',
  asset_play:   '자산주',
  na:           '미분류',
}

// ────────────────────────────────────────────────────────────────────────────
// 2. 안전한 숫자 변환
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어떤 값이든 안전하게 숫자로 변환
 * "N/A", null, undefined, NaN, Infinity → 0 반환
 */
export function safeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'string') {
    if (val === 'N/A' || val === '' || val === '-') return 0
    const n = parseFloat(val.replace(/,/g, ''))
    return isFinite(n) ? n : 0
  }
  if (typeof val === 'number') return isFinite(val) ? val : 0
  return 0
}

// ────────────────────────────────────────────────────────────────────────────
// 3. EPS 이상값 검증 및 클램핑
// ────────────────────────────────────────────────────────────────────────────

/**
 * EPS 이상값 방어
 *
 * 문제 사례:
 *  - SK하이닉스: Naver DART API가 ₩298,495 반환 (실제 ~₩52,000)
 *  - GEV: FMP가 $30.96 반환 (IPO 초기 이상값)
 *  - PLTR: 비GAAP EPS 혼용으로 $1.46 (실제 GAAP ~$0.14)
 *
 * 방어 원칙:
 *  EPS에서 계산되는 implied PE가 카테고리 최소 PE보다 낮으면 이상값으로 간주
 *  → currentPrice / minPE 값으로 클램핑
 *
 * @param eps          원본 EPS (연간)
 * @param currentPrice 현재 주가
 * @param category     Lynch 카테고리 (null 허용)
 * @returns            클램핑된 EPS (항상 0 이상)
 */
export function sanitizeEps(
  eps: number,
  currentPrice: number,
  category: string | null | undefined,
): number {
  // 적자 기업: 음수 EPS → 0 (Lynch Line 계산 불가)
  if (eps <= 0) return 0

  if (currentPrice <= 0) return eps

  const cat    = (category as LynchCategoryKey) ?? 'na'
  const minPe  = LYNCH_MIN_PE[cat] ?? 5
  const maxEps = currentPrice / minPe  // 이 값 이상이면 implied PE < minPe → 이상값

  if (eps > maxEps) {
    return parseFloat(maxEps.toFixed(currentPrice > 10000 ? 0 : 4))
  }
  return eps
}

// ────────────────────────────────────────────────────────────────────────────
// 4. 적정 멀티플 계산 (SSOT)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 피터 린치 적정 멀티플 계산 (모든 컴포넌트 공유 SSOT)
 *
 * 계산 우선순위:
 *  ① PE + PEG 모두 유효 → Lynch PEG=1 공식: 적정 PER = PE ÷ PEG (성장률%)
 *     단, 카테고리별 상한 캡 적용 + 최소 8배 보장
 *  ② PE만 있음 → PE × 0.55 (보수적 추정, 성장률 알 수 없으므로)
 *  ③ 카테고리 기본값 → LYNCH_MULTIPLE_DEFAULT
 *  ④ 시장별 최후 폴백 → KR=12, US=15
 *
 * 예시:
 *  calcFairMultiple(40, 1.33, 'fast_grower', 'US') → 30 (cap 적용)
 *  calcFairMultiple(22, 2.7,  'stalwart',    'US') →  8
 *  calcFairMultiple(0,  0,    'turnaround',  'US') → 20 (기본값)
 *
 * @param pe       주가수익비율 (0 or N/A면 0으로)
 * @param peg      PEG 비율 (0이면 미사용)
 * @param category Lynch 카테고리 영문 키
 * @param market   'US' | 'KR' (폴백용)
 */
export function calcFairMultiple(
  pe:       number | string | null | undefined,
  peg:      number | string | null | undefined,
  category: string | null | undefined,
  market:   string | undefined,
): number {
  const peNum  = safeNumber(pe)
  const pegNum = safeNumber(peg)
  const cat    = (category as LynchCategoryKey) ?? 'na'
  const cap    = LYNCH_MULTIPLE_CAP[cat]    ?? 20
  const defVal = LYNCH_MULTIPLE_DEFAULT[cat] ?? (market === 'KR' ? 12 : 15)

  // ① PE + PEG 모두 유효 (PEG 0초과 6 이하: 합리적 범위)
  if (peNum > 0 && pegNum > 0 && pegNum <= 6) {
    const implied = Math.round(peNum / pegNum)   // 성장률% = 적정 PER
    return Math.max(8, Math.min(cap, implied))
  }

  // ② PE만 있음 → 보수적 추정 (PEG를 모르므로 성장률을 낮게 가정)
  if (peNum > 0) {
    const estimated = Math.round(peNum * 0.55)   // PE×0.55: PEG≈1.8 가정
    return Math.max(8, Math.min(cap, estimated))
  }

  // ③ 카테고리 기본값 / 시장 폴백
  return defVal
}

// ────────────────────────────────────────────────────────────────────────────
// 5. 가치 괴리율 계산
// ────────────────────────────────────────────────────────────────────────────

export interface GapResult {
  isLossCompany:   boolean   // EPS ≤ 0 (적자)
  lynchLine:       number    // 본질가치
  gapPct:          number | null   // 괴리율 % (적자 기업 = null)
  isUndervalued:   boolean
  gapDisplay:      string    // "+12.3%" 또는 "적자 구간"
}

/**
 * Lynch 적정가치 괴리율 계산
 *
 * 엣지 케이스 처리:
 *  - Lynch Line = 0 (적자): gapPct = null, display = "적자 구간"
 *  - Lynch Line 매우 작은 양수: 정상 계산
 */
export function calcGap(
  currentPrice: number,
  eps:          number,
  multiple:     number,
  macroFactor = 1.0,
): GapResult {
  const lynchLine     = Math.round(eps * multiple * macroFactor)
  const isLossCompany = eps <= 0

  if (isLossCompany || lynchLine <= 0) {
    return {
      isLossCompany:  true,
      lynchLine:      0,
      gapPct:         null,
      isUndervalued:  false,
      gapDisplay:     '적자 구간',
    }
  }

  const gapPct       = ((currentPrice - lynchLine) / lynchLine) * 100
  const isUndervalued = gapPct < 0
  const abs           = Math.abs(gapPct).toFixed(1)
  const gapDisplay    = isUndervalued ? `−${abs}%` : `+${abs}%`

  return { isLossCompany: false, lynchLine, gapPct, isUndervalued, gapDisplay }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. 분기별 EPS 이력 합성 (합성값 사용 시 공통 로직)
// ────────────────────────────────────────────────────────────────────────────

export interface EpsHistoryPoint {
  date:  string
  price: number
  eps:   number   // 연간 EPS (lynch = eps × multiple으로 계산)
}

/**
 * 연간 EPS → 분기별 이력 포인트 생성
 * 여러 연도의 연간 EPS 맵을 받아 분기 레이블에 매핑
 *
 * @param annualEps     { '2024': 4.96, '2025E': 5.8, ... }
 * @param quarters      ['25-Q1','25-Q2', ...]
 * @param currentPrice  현재 주가 (마지막 포인트)
 * @param category      Lynch 카테고리 (EPS 이상값 클램핑용)
 */
export function buildEpsHistory(
  annualEps:    Record<string, number>,
  quarters:     string[],
  currentPrice: number,
  category:     string | null | undefined,
): EpsHistoryPoint[] {
  return quarters.map((date, i) => {
    const year       = 2000 + parseInt(date.slice(0, 2))
    const yearStr    = String(year)
    const yearEstStr = `${year}E`

    let rawEps =
      annualEps[yearStr] ??
      annualEps[yearEstStr] ??
      annualEps[String(year - 1)] ??
      0

    // EPS 이상값 클램핑
    rawEps = sanitizeEps(rawEps, currentPrice, category)

    // 가격: 마지막(현재) 포인트는 currentPrice, 이전은 선형 추정
    const n     = quarters.length
    const price = i === n - 1
      ? currentPrice
      : Math.round(currentPrice * (0.75 + (i / n) * 0.25))

    return { date, price, eps: rawEps }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// 10. EPS 분석 모드 — 적자/턴어라운드/혁신성장 통합 처리 (SSOT)
// ────────────────────────────────────────────────────────────────────────────

/**
 * EPS 분석 모드
 *  actual   — 정상 흑자: 실제 연간 EPS 사용
 *  forward  — 턴어라운드: 현재 적자지만 forwardEPS > 0 → 미래 EPS 기반
 *  revenue  — 혁신성장: EPS/forwardEPS 모두 음수 + 매출 폭발 (IonQ 류)
 *  loss     — 순적자: EPS 음수 + forwardEPS 음수 + 매출 성장도 저조
 */
export type EpsMode = 'actual' | 'forward' | 'revenue' | 'loss'

export interface EpsAnalysis {
  mode:         EpsMode
  eps:          number    // 사용할 EPS (actual/forward), revenue/loss 모드=0
  multiple:     number    // 적용 멀티플
  lyncLine:     number    // 계산된 Lynch Line (revenue 모드=수익화 목표가)
  isLoss:       boolean   // 의미있는 가치 계산 불가 여부
  badgeText:    string    // UI 배지 ("실제 EPS" / "Forward EPS" / "매출 성장" / "적자 구간")
  badgeColor:   string    // Tailwind 클래스
  description:  string    // 상세 설명 (툴팁/인사이트용)
  revenueData?: {         // revenue 모드 전용
    growthPct:   number
    psMultiple:  number
    revenueEst:  number   // 추정 주당 매출
  }
}

/**
 * EPS 모드 판정 및 Lynch Line 계산 (SSOT)
 *
 * 판정 로직:
 *  1. currentEps > 0 → actual 모드 (정상)
 *  2. currentEps ≤ 0 AND forwardEps > 0 → forward 모드 (턴어라운드)
 *  3. 둘 다 ≤ 0 AND revenueGrowth > 50% → revenue 모드 (혁신성장)
 *  4. 나머지 → loss 모드 (순적자)
 *
 * @param currentEps     TTM/연간 EPS (음수 허용)
 * @param forwardEps     컨센서스 향후 12개월 EPS 예측 (없으면 0)
 * @param revenueGrowth  YoY 매출 성장률 % (/api/financials에서)
 * @param currentPrice   현재 주가
 * @param category       Lynch 카테고리
 * @param market         'US' | 'KR'
 * @param currentPs      현재 P/S 비율 (revenue 모드 계산용, 없으면 0)
 */
export function analyzeEpsMode(
  currentEps:    number,
  forwardEps:    number,
  revenueGrowth: number,
  currentPrice:  number,
  category:      string | null | undefined,
  market:        string | undefined,
  currentPs = 0,
): EpsAnalysis {
  const cat     = (category as LynchCategoryKey) ?? 'na'
  const isKr    = market === 'KR'

  // ── Mode 1: ACTUAL (정상 흑자)
  if (currentEps > 0) {
    const cleanEps = sanitizeEps(currentEps, currentPrice, category)
    const multiple = calcFairMultiple(
      currentPrice > 0 ? currentPrice / cleanEps : 0, // PE 역산
      0,  // PEG는 외부에서 전달 (calcFairMultiple 단독 호출)
      category, market
    )
    return {
      mode: 'actual',
      eps: cleanEps,
      multiple,
      lyncLine: Math.round(cleanEps * multiple),
      isLoss: false,
      badgeText:   '실제 EPS',
      badgeColor:  'text-[#deff9a] bg-[#deff9a]/10 border-[#deff9a]/30',
      description: `실제 연간 EPS(${isKr ? '₩' : '$'}${cleanEps.toFixed(isKr ? 0 : 2)}) × ${multiple}배 멀티플로 적정가치 산출`,
    }
  }

  // ── Mode 2: FORWARD (턴어라운드 — 적자→흑자 전환 중)
  if (forwardEps > 0) {
    // 턴어라운드는 20배 기본, PE/PEG 없으므로 카테고리 기본값
    const turnaroundMultiple = LYNCH_MULTIPLE_DEFAULT['turnaround']  // 20
    const cleanFwdEps        = sanitizeEps(forwardEps, currentPrice, 'turnaround')
    const lyncLine           = Math.round(cleanFwdEps * turnaroundMultiple)
    return {
      mode: 'forward',
      eps: cleanFwdEps,
      multiple: turnaroundMultiple,
      lyncLine,
      isLoss: false,
      badgeText:   'Forward EPS',
      badgeColor:  'text-amber-400 bg-amber-400/10 border-amber-400/30',
      description: `현재 적자이나 애널리스트 컨센서스 Forward EPS(${isKr ? '₩' : '$'}${cleanFwdEps.toFixed(isKr ? 0 : 2)}) 기반 턴어라운드 분석. 실제 흑자 전환 확인 필수.`,
    }
  }

  // ── Mode 3: REVENUE (혁신성장 — EPS 모두 음수 but 매출 폭발)
  // IonQ·PLTR 초기처럼 매출이 >50% 성장하는 미래혁신 기업
  if (revenueGrowth > 50) {
    // 매출 기반 P/S 목표가 계산
    // 피터 린치 변형: 매출이 EPS를 대체하는 유일한 성장 지표
    // 적정 P/S = min(revenueGrowth / 10, 30) (성장률 100% → P/S 10)
    const targetPs    = Math.min(revenueGrowth / 10, 30)
    // 현재 P/S가 있으면: 목표가 = currentPrice × (targetPs / currentPs)
    // 없으면: 성장률 기반 프리미엄 추정
    let revenueTarget = 0
    let revenueEst    = 0
    if (currentPs > 0 && currentPs < 200) {
      revenueTarget = Math.round(currentPrice * (targetPs / currentPs))
      revenueEst    = currentPrice / currentPs  // 주당 매출 추정
    }
    return {
      mode: 'revenue',
      eps: 0,
      multiple: 0,
      lyncLine: revenueTarget,
      isLoss: revenueTarget === 0,  // P/S 없으면 계산 불가
      badgeText:   '매출 성장 기반',
      badgeColor:  'text-blue-400 bg-blue-400/10 border-blue-400/30',
      description: `EPS 음수이나 매출 성장률 ${revenueGrowth.toFixed(0)}% — Lynch 이익선 대신 P/S 목표가(×${targetPs.toFixed(1)}) 적용. 매출 꺾임 여부가 핵심 관찰 지표.`,
      revenueData: {
        growthPct:  revenueGrowth,
        psMultiple: targetPs,
        revenueEst,
      },
    }
  }

  // ── Mode 4: LOSS (순적자 — 유의미한 가치 산출 불가)
  return {
    mode: 'loss',
    eps: 0,
    multiple: 0,
    lyncLine: 0,
    isLoss: true,
    badgeText:   '적자 구간',
    badgeColor:  'text-zinc-400 bg-zinc-800/30 border-zinc-700/30',
    description: `EPS 및 Forward EPS 모두 음수, 매출 성장률(${revenueGrowth.toFixed(0)}%)도 기준 미달. 흑자 전환 또는 매출 폭발 전까지 Lynch 가치 산출 불가.`,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Phase 1 스트레스 테스터용 Beta / BasePEG
// ────────────────────────────────────────────────────────────────────────────

/**
 * 금리 민감도(Beta) 추정
 * PE/PEG → 성장률 → Beta (성장률이 높을수록 금리 민감도 높음)
 *
 * 범위: 0.5(방어주) ~ 2.5(고성장·코인)
 */
export function estimateBeta(
  pe:     number,
  peg:    number,
  market: string | undefined,
): number {
  const peNum  = safeNumber(pe)
  const pegNum = safeNumber(peg)

  const growthEst = peNum > 0 && pegNum > 0
    ? peNum / pegNum
    : (market === 'CRYPTO' ? 30 : market === 'KR' ? 20 : 15)

  return parseFloat(Math.max(0.5, Math.min(2.5, growthEst / 20)).toFixed(2))
}

/**
 * 기본 PEG (스트레스 테스트 기준가)
 * 실제 PEG 있으면 사용, 없으면 PE 기반 추정
 */
export function estimateBasePeg(pe: number, peg: number): number {
  const peNum  = safeNumber(pe)
  const pegNum = safeNumber(peg)

  if (pegNum > 0 && pegNum <= 6) return pegNum
  if (peNum > 0) return parseFloat((peNum / Math.max(10, peNum * 0.5)).toFixed(2))
  return 1.0
}

// ────────────────────────────────────────────────────────────────────────────
// 8. 섹터/시장 상관계수 추정
// ────────────────────────────────────────────────────────────────────────────

/**
 * 매크로 지수 상관계수 추정 (공개 실시간 API 없음 → 허용 추정)
 *
 * 근거:
 *  - 반도체·철강·화학 KR cyclical: 매크로 경기와 동행 → 0.85
 *  - 일반 KR 주식: 코스피 동반 → 0.70
 *  - US cyclical: 0.60
 *  - US stalwart: 0.45
 *  - 고성장·바이오: 개별 변수 강함 → 0.35
 */
export function estimateCorrelation(
  market:   string | undefined,
  category: string | null | undefined,
): number {
  if (market === 'CRYPTO') return 0.60  // BTC는 매크로 상관성 증가 추세
  if (market === 'KR') {
    if (category === 'cyclical')   return 0.85
    if (category === 'stalwart')   return 0.65
    return 0.70
  }
  // US
  if (category === 'cyclical')     return 0.60
  if (category === 'turnaround')   return 0.50
  if (category === 'stalwart')     return 0.45
  if (category === 'fast_grower')  return 0.35
  return 0.40
}

// ────────────────────────────────────────────────────────────────────────────
// 9. 분류 알고리즘 — DynamicCategorySwitcher SSOT
// ────────────────────────────────────────────────────────────────────────────

export interface ClassifyInput {
  epsGrowth:     number
  revenueGrowth: number
  debtRatio:     number
  netCashRatio:  number
  correlation:   number
  dbCategory?:   string | null   // DB 저장값 (있으면 최우선)
}

export interface ClassifiedCategory {
  id:    LynchCategoryKey
  label: string   // 한글
}

/**
 * 피터 린치 카테고리 자동 판정 (DB값 우선 → 알고리즘 폴백)
 *
 * DB에 저장된 lynch_category가 있으면 무조건 그것을 사용합니다.
 * (Phase 2의 알고리즘보다 사람이 검증한 DB값이 더 신뢰성 높음)
 */
export function classifyLynchCategory(input: ClassifyInput): ClassifiedCategory {
  // DB 값 최우선 (Lynch-classify API 또는 수동 입력)
  if (input.dbCategory && input.dbCategory !== 'na') {
    const label = LYNCH_CATEGORY_KR[input.dbCategory] ?? input.dbCategory
    return { id: input.dbCategory as LynchCategoryKey, label }
  }

  const { epsGrowth, revenueGrowth, debtRatio, netCashRatio, correlation } = input

  // 판정 순서 (우선순위 높은 것부터)

  // 1. 경기순환주: 매크로 상관계수 최우선 체크 (반도체 등 고성장과 중복 방지)
  if (correlation >= 0.70) return { id: 'cyclical', label: '경기순환주' }

  // 2. 턴어라운드주: EPS 폭발 회복 or 고부채+이익전환
  if (epsGrowth > 100 || (debtRatio > 200 && epsGrowth > 20)) {
    return { id: 'turnaround', label: '턴어라운드주' }
  }

  // 3. 고성장주: 20%+ EPS 또는 25%+ 매출
  if (epsGrowth >= 20 || revenueGrowth >= 25) {
    return { id: 'fast_grower', label: '고성장주' }
  }

  // 4. 대형우량주: 10~20% 안정 성장
  if (epsGrowth >= 10 && epsGrowth < 20) {
    return { id: 'stalwart', label: '대형우량주' }
  }

  // 5. 자산주: 순현금 비중 높음
  if (netCashRatio >= 30) return { id: 'asset_play', label: '자산주' }

  // 6. 저성장주: 나머지
  return { id: 'slow_grower', label: '저성장주' }
}
