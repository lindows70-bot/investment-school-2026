// 🎩 거장 위원회 SSOT — 버핏·멍거·단요핑·리루 4인의 결정론 판정(순수 함수·의존성 0)
// 오픈소스 "AI Berkshire" 의 구조(독립 판정→교차 반박→강제 결론→레드라인)를 우리 데이터로 재구현.
// ⚠️ 판정은 전부 이 코드(결정론)가 한다 — LLM 은 페르소나 서술·반박·종합 문장만 만든다(라우트에서).
// ⚠️ 매수 관점 판정이다 — 보유 종목 불통과 ≠ 매도 지시(HOLD_DIP 원칙, UI 캐비엇 필수).
// 스케일 실측(2026-08-06): returnOnEquity·margins·payoutRatio·earningsGrowth 는 분수(0.30=30%),
// pe·pbr 은 배수 원값, KR 은 high52w/low52w·sector 가 null 일 수 있다 — 전 체크 null 안전.

export type CheckStatus = 'pass' | 'warn' | 'fail'
export type Verdict = 'pass' | 'gray' | 'fail'
export type MasterId = 'buffett' | 'munger' | 'duan' | 'lilu'

export interface MasterCheck {
  key: string
  label: string          // 체크 이름(한국어)
  status: CheckStatus
  value: string          // 실측값 표시("ROE 114%")— 결측이면 "데이터 없음"
  basis: string          // 기준("≥15%")
}

export interface MasterResult {
  id: MasterId
  name: string
  emoji: string
  philosophy: string     // 한 줄 철학(고정 문구 — 데이터 아님)
  checks: MasterCheck[]
  verdict: Verdict
}

export interface Redline { key: string; label: string; hit: boolean; detail: string }

/** 라우트가 SSOT 들에서 수집해 넘기는 재료 — 전부 nullable(결측은 결측대로 판정에 반영) */
export interface CommitteeInput {
  // stock-info.fundamentals (분수 스케일)
  pe: number | null; peg: number | null; pbr: number | null
  eps: number | null; forwardEps: number | null
  earningsGrowth: number | null          // 분수(0.65=65%)
  roe: number | null                     // 분수
  grossMargin: number | null             // 분수
  opMargin: number | null                // 분수
  payoutRatio: number | null             // 분수
  dividendYield: number | null           // 분수
  freeCashflow: number | null; totalDebt: number | null; totalCash: number | null
  marketCap: number | null
  high52w: number | null; low52w: number | null
  currentPrice: number | null
  // stock-fcf
  fcfYieldPct: number | null             // % 단위
  qualityGap: boolean | null             // 영업흑자·영업현금 적자(이익-현금 괴리)
  // jarvisBriefing.buildSignalMetrics
  roic: number | null                    // % 단위
  roeInflated: boolean | null
  // getMoatBreach
  moatWidth: 'wide' | 'moderate' | 'narrow' | 'none' | null
  // reverse-dcf
  rdcfVerdict: 'demanding' | 'fair' | 'conservative' | 'unknown' | null
  rdcfImplied: number | null             // % 단위
  // canonicalFundamentals.isPegBaseEffect 결과(라우트에서 계산해 전달)
  pegBaseEffect: boolean | null
  // buffettDcf(있으면) — 매수 가격 구간의 유일한 원천(제2원칙)
  intrinsicPerShare: number | null
  // 🏦 금융주(stock-fcf SSOT 판정) — FCF·DCF·순부채 잣대가 구조적으로 무의미(예금·대출·보험 float).
  //    실사고(2026-08-06): Schwab 내재가치가 현재가의 2.8배로 떠 매수구간 $217~263 vs 현재가 ~$110.
  isFinancial: boolean | null
  /** 🇰🇷 자국 통화 상장(KR 시장의 KR 종목) — 재무·주가가 같은 통화라 **통화 불일치가 원천 불가능**하다.
   *  이걸 안 가리면 진짜 고FCF 기업이 오탐된다(IPARK현대산업개발 FCF/시총 38% → 통화 의심 오판). */
  sameCurrency: boolean | null
}

export interface BuyBand {
  low: number; high: number; fairValue: number
  /** 내재가치 ÷ 현재가. 2.5배를 넘으면 DCF 가 **성장률 외삽에 크게 기대고 있다**는 뜻이라 화면에 경고를 병기한다.
   *  실측(2026-08-06): 오리온 3.44배(성장률 25.5%를 5년 복리) — 틀렸다고 단정할 순 없지만
   *  "안전마진 66%"로 읽히면 가짜 정밀이 된다. 숫자를 지우지 말고 **의존도를 밝힌다**. */
  stretch: number | null
}

export interface CommitteeResult {
  masters: MasterResult[]
  redlines: Redline[]
  redlineHit: boolean
  final: Verdict                 // 강제 결론 — 회색은 존재하되 양비론 서술은 금지(라우트 프롬프트)
  finalReason: string            // 결론이 나온 산식 설명(사람이 검산 가능하게)
  buyBand: BuyBand | null        // 안전마진 30%~15% 구간. DCF 불가면 null(가짜 정밀 금지)
  missingKeys: string[]          // 결측 입력 목록 — 화면에 그대로 밝힌다
  unitSuspect: boolean           // 통화 단위 불일치 의심 — 현금 관련 판정·가격 구간을 보류한다
}

/**
 * 💱 통화 단위 불일치 감지 — ADR·외국 상장사는 **재무제표가 현지통화, 주가·시총은 USD** 로 오는 일이 있다.
 * 실측(2026-08-06): TSM freeCashflow 739,057,991,680 은 TWD 인데 marketCap 은 USD 2,147B →
 * FCF/시총 34%, DCF 내재가치 $9,187 (현재가 $414 의 22배). 에퀴노르도 19.7배.
 * 합계·부호 검산으로는 절대 안 잡히는 유형이라(스케일 오류) **비율의 상식 범위**로 판별한다.
 *  - FCF/시총 > 30% : 정상 기업에선 거의 나오지 않는다(NVDA 0.9%·삼성 4.2%·토탈 7.0%)
 *  - 내재가치 > 현재가 × 5 : 보수 DCF(성장률 35% 클램프)로는 나올 수 없는 배수
 */
function detectUnitSuspect(x: CommitteeInput): boolean {
  // 🇰🇷 자국 통화 상장이면 FCF 비율이 아무리 높아도 '통화' 문제일 수 없다 — 진짜 고FCF 를 오탐하지 않는다.
  //     (IPARK현대산업개발 FCF/시총 38%는 건설 선수금 유입 등 실제 현상. 통화 불일치가 아니다)
  if (x.sameCurrency !== true) {
    const fcfOverMc = x.freeCashflow != null && x.freeCashflow > 0 && x.marketCap != null && x.marketCap > 0
      ? x.freeCashflow / x.marketCap : null
    if (fcfOverMc != null && fcfOverMc > 0.30) return true
  }
  // 배수 조건은 통화와 무관하게 유지 — 어떤 통화든 보수 DCF 가 현재가의 5배는 나올 수 없다
  if (x.intrinsicPerShare != null && x.currentPrice != null && x.currentPrice > 0
    && x.intrinsicPerShare > x.currentPrice * 5) return true
  return false
}

// ── 헬퍼 ─────────────────────────────────────────────────────────
const pct = (f: number | null) => (f == null ? null : f * 100)   // 분수 → %
const fmtPct = (f: number | null, d = 1) => (f == null ? '데이터 없음' : `${(f * 100).toFixed(d)}%`)
const fmtN = (n: number | null, d = 2) => (n == null ? '데이터 없음' : n.toFixed(d))

function verdictOf(checks: MasterCheck[]): Verdict {
  const fail = checks.filter(c => c.status === 'fail').length
  const warn = checks.filter(c => c.status === 'warn').length
  if (fail >= 2) return 'fail'
  if (fail === 1 || warn >= 2) return 'gray'
  return 'pass'
}

// ── 4인 체크리스트(결정론) ────────────────────────────────────────
function buffettChecks(x: CommitteeInput, unitSuspect: boolean): MasterCheck[] {
  const roePct = pct(x.roe)
  const netDebt = x.totalDebt != null && x.totalCash != null ? x.totalDebt - x.totalCash : null
  const netDebtOk = netDebt == null ? null : (netDebt <= 0 || (x.marketCap != null && netDebt < x.marketCap * 0.2))
  const margin = x.intrinsicPerShare != null && x.currentPrice != null && x.intrinsicPerShare > 0
    ? (x.intrinsicPerShare - x.currentPrice) / x.intrinsicPerShare : null
  return [
    { key: 'moat', label: '경제적 해자', basis: 'wide/moderate',
      status: x.moatWidth == null ? 'warn' : x.moatWidth === 'wide' ? 'pass' : x.moatWidth === 'moderate' ? 'pass' : 'fail',
      value: x.moatWidth == null ? '데이터 없음' : ({ wide: '넓고 강력', moderate: '보통', narrow: '얕음', none: '뚜렷하지 않음' })[x.moatWidth] },
    { key: 'roe', label: '자기자본이익률', basis: '≥15% (부풀림 아님)',
      status: roePct == null ? 'warn' : x.roeInflated === true ? 'fail' : roePct >= 15 ? 'pass' : roePct >= 10 ? 'warn' : 'fail',
      value: roePct == null ? '데이터 없음' : `ROE ${roePct.toFixed(1)}%${x.roeInflated ? ' (부채 부풀림)' : ''}` },
    // 💱 통화 불일치·🏦 금융주는 현금 지표를 '통과'로 읽지 않는다 — 왜곡된 값이 합격을 만들면 최악이다
    { key: 'fcf', label: '현금 창출력', basis: 'FCF수익률 ≥3%',
      status: x.isFinancial ? 'warn' : unitSuspect ? 'warn' : x.fcfYieldPct == null ? 'warn' : x.fcfYieldPct >= 3 ? 'pass' : x.fcfYieldPct >= 1 ? 'warn' : 'fail',
      value: x.isFinancial ? '금융주 — FCF 잣대 부적합(보류)' : unitSuspect ? '통화 단위 불일치 의심 — 검증 보류' : x.fcfYieldPct == null ? '데이터 없음' : `${x.fcfYieldPct.toFixed(1)}%` },
    { key: 'debt', label: '재무 요새', basis: '순부채 ≤0 또는 <시총 20%',
      status: x.isFinancial ? 'warn' : netDebtOk == null ? 'warn' : netDebtOk ? 'pass' : 'fail',
      value: x.isFinancial ? '금융주 — 부채 구조 상이(예금·차입 — 보류)' : netDebt == null ? '데이터 없음' : netDebt <= 0 ? '순현금' : `순부채 시총 대비 ${x.marketCap ? ((netDebt / x.marketCap) * 100).toFixed(0) : '?'}%` },
    { key: 'margin_of_safety', label: '안전마진(DCF)', basis: '내재가치 대비 ≥0%',
      status: x.isFinancial ? 'warn' : unitSuspect || margin == null ? 'warn' : margin >= 0.15 ? 'pass' : margin >= 0 ? 'warn' : 'fail',
      value: x.isFinancial ? '금융주 — FCF 기반 DCF 부적합(보류)' : unitSuspect ? '통화 단위 불일치 의심 — 산정 보류' : margin == null ? '산정 보류' : `${(margin * 100).toFixed(0)}%` },
  ]
}

function mungerChecks(x: CommitteeInput): MasterCheck[] {
  // 멍거 = 인버전("망하는 길부터 뒤집어 본다") — 앱의 경보 SSOT 를 그대로 잣대로 쓴다
  return [
    { key: 'quality_gap', label: '이익-현금 일치(인버전①)', basis: '괴리 없음',
      status: x.qualityGap == null ? 'warn' : x.qualityGap ? 'fail' : 'pass',
      value: x.qualityGap == null ? '데이터 없음' : x.qualityGap ? '영업흑자인데 현금 적자' : '일치' },
    { key: 'roe_inflated', label: '자본효율 진위(인버전②)', basis: 'ROIC 가 ROE 를 뒷받침',
      status: x.roeInflated == null ? 'warn' : x.roeInflated ? 'fail' : 'pass',
      value: x.roic == null ? '데이터 없음' : `ROIC ${x.roic.toFixed(1)}%` },
    { key: 'base_effect', label: '기저효과 착시(인버전③)', basis: '저PEG 가 진짜인가',
      status: x.pegBaseEffect == null ? 'warn' : x.pegBaseEffect ? 'fail' : 'pass',
      value: x.pegBaseEffect == null ? '데이터 없음' : x.pegBaseEffect ? '이익 붕괴 후 폭증 — 착시 위험' : '정상' },
    { key: 'expectation', label: '시장 기대 과열(인버전④)', basis: '역-DCF fair/conservative',
      status: x.rdcfVerdict == null || x.rdcfVerdict === 'unknown' ? 'warn' : x.rdcfVerdict === 'demanding' ? 'fail' : 'pass',
      value: x.rdcfVerdict == null || x.rdcfVerdict === 'unknown' ? '판단 보류'
        : `주가가 연 ${fmtN(x.rdcfImplied, 1)}% 성장을 선반영(${x.rdcfVerdict === 'demanding' ? '과도' : '합리'})` },
  ]
}

function duanChecks(x: CommitteeInput): MasterCheck[] {
  // 단요핑(段永平) = 본분(本分) — 본업의 이익의 질과 주주에 대한 태도
  const opPct = pct(x.opMargin), grossPct = pct(x.grossMargin)
  const shareholder = (x.payoutRatio != null && x.payoutRatio > 0) || (x.dividendYield != null && x.dividendYield > 0)
  return [
    { key: 'op_margin', label: '본업 수익성', basis: '영업이익률 ≥15%',
      status: opPct == null ? 'warn' : opPct >= 15 ? 'pass' : opPct >= 8 ? 'warn' : 'fail',
      value: fmtPct(x.opMargin) },
    { key: 'gross', label: '제품 경쟁력', basis: '총마진 ≥30%',
      status: grossPct == null ? 'warn' : grossPct >= 30 ? 'pass' : grossPct >= 20 ? 'warn' : 'fail',
      value: fmtPct(x.grossMargin) },
    { key: 'shareholder', label: '주주환원 태도', basis: '배당 또는 환원 실적',
      status: x.payoutRatio == null && x.dividendYield == null ? 'warn' : shareholder ? 'pass' : 'warn',
      value: x.dividendYield != null ? `배당수익률 ${fmtPct(x.dividendYield, 2)}` : '데이터 없음' },
    { key: 'earning_real', label: '이익의 실재', basis: '흑자 + 현금 일치',
      status: x.eps == null ? 'warn' : x.eps > 0 && x.qualityGap !== true ? 'pass' : x.eps > 0 ? 'fail' : 'fail',
      value: x.eps == null ? '데이터 없음' : x.eps > 0 ? `EPS ${fmtN(x.eps)}` : '적자' },
  ]
}

function liluChecks(x: CommitteeInput): MasterCheck[] {
  // 리루(李彔) = 저평가의 심도 — 얼마나 싸게 사는가
  const earningsYield = x.pe != null && x.pe > 0 ? 100 / x.pe : null
  const fwdGrowthPct = pct(x.earningsGrowth)
  const pos52 = x.high52w != null && x.low52w != null && x.currentPrice != null && x.high52w > x.low52w
    ? ((x.currentPrice - x.low52w) / (x.high52w - x.low52w)) * 100 : null
  return [
    { key: 'peg', label: '성장 대비 가격', basis: 'PEG ≤1.2 (기저효과 제외)',
      status: x.peg == null ? 'warn' : x.pegBaseEffect === true ? 'warn' : x.peg <= 1.2 ? 'pass' : x.peg <= 2 ? 'warn' : 'fail',
      value: x.peg == null ? '데이터 없음' : `PEG ${x.peg.toFixed(2)}${x.pegBaseEffect ? ' (기저효과 의심 — 제외)' : ''}` },
    { key: 'earnings_yield', label: '어닝일드', basis: '1/PER ≥4%',
      status: earningsYield == null ? 'warn' : earningsYield >= 4 ? 'pass' : earningsYield >= 2.5 ? 'warn' : 'fail',
      value: earningsYield == null ? '데이터 없음' : `${earningsYield.toFixed(1)}%` },
    { key: 'pbr', label: '자산 대비 가격', basis: 'PBR ≤5 (고성장 예외)',
      status: x.pbr == null ? 'warn' : x.pbr <= 5 ? 'pass' : (fwdGrowthPct != null && fwdGrowthPct >= 25) ? 'warn' : 'fail',
      value: x.pbr == null ? '데이터 없음' : `PBR ${x.pbr.toFixed(2)}` },
    { key: 'pos52', label: '가격 위치', basis: '52주 하단일수록 유리(참고)',
      status: pos52 == null ? 'warn' : pos52 <= 40 ? 'pass' : pos52 <= 75 ? 'warn' : 'warn',   // 상단이어도 fail 은 아님(추격 경계만)
      value: pos52 == null ? '데이터 없음' : `52주 위치 ${pos52.toFixed(0)} (0=저점·100=신고가)` },
  ]
}

// ── 레드라인 — 하나라도 걸리면 위원회 전체 불통과 ─────────────────
function buildRedlines(x: CommitteeInput, missingKeys: string[]): Redline[] {
  return [
    { key: 'quality_gap', label: '이익-현금 괴리', hit: x.qualityGap === true,
      detail: '영업이익은 흑자인데 영업현금흐름이 적자 — 이익의 실재가 의심되면 아무리 싸도 사지 않는다' },
    { key: 'roe_inflated', label: 'ROE 부풀림', hit: x.roeInflated === true,
      detail: 'ROE 는 높은데 ROIC 가 낮다 — 빚으로 만든 가짜 효율' },
    { key: 'base_effect', label: '기저효과 저PEG', hit: x.pegBaseEffect === true,
      detail: '작년 이익 붕괴 후 폭증 — 저평가 신호 전체가 착시일 수 있다' },
    { key: 'loss_no_outlook', label: '적자 + 전망 부재', hit: x.eps != null && x.eps <= 0 && (x.forwardEps == null || x.forwardEps <= 0),
      detail: '현재도 적자, 전망도 흑자 전환 근거 없음' },
    { key: 'extreme_expectation', label: '시장 기대 극단', hit: x.rdcfVerdict === 'demanding' && x.rdcfImplied != null && x.rdcfImplied >= 20,
      detail: '주가가 연 20%+ 영구 성장을 선반영 — 완벽한 실행을 가정한 가격' },
    { key: 'data_gap', label: '검증 불가', hit: missingKeys.length >= 5,
      detail: `핵심 데이터 ${missingKeys.length}개 결측 — 숫자를 확인할 수 없으면 사지 않는다` },
  ]
}

// ── 종합(강제 결론) ──────────────────────────────────────────────
export function computeCommittee(x: CommitteeInput): CommitteeResult {
  const missingKeys = (Object.entries({
    PER: x.pe, PEG: x.peg, PBR: x.pbr, EPS: x.eps, ROE: x.roe,
    영업이익률: x.opMargin, FCF수익률: x.fcfYieldPct, 해자: x.moatWidth, 현재가: x.currentPrice,
  }) as [string, unknown][]).filter(([, v]) => v == null).map(([k]) => k)

  const unitSuspect = detectUnitSuspect(x)

  const masters: MasterResult[] = [
    { id: 'buffett', name: '워런 버핏', emoji: '🏰', philosophy: '훌륭한 기업을 적당한 가격에 — 해자와 현금이 전부다', checks: buffettChecks(x, unitSuspect), verdict: 'gray' },
    { id: 'munger', name: '찰리 멍거', emoji: '🔍', philosophy: '뒤집어라 — 망하는 길을 먼저 지워야 남는 것이 답이다', checks: mungerChecks(x), verdict: 'gray' },
    { id: 'duan', name: '단요핑', emoji: '⚓', philosophy: '본분(本分) — 본업이 벌고, 번 것을 주주와 나누는가', checks: duanChecks(x), verdict: 'gray' },
    { id: 'lilu', name: '리루', emoji: '⚖️', philosophy: '가격이 가치보다 충분히 쌀 때만 — 심도 있는 저평가', checks: liluChecks(x), verdict: 'gray' },
  ]
  for (const m of masters) m.verdict = verdictOf(m.checks)

  const redlines = buildRedlines(x, missingKeys)
  const redlineHit = redlines.some(r => r.hit)

  const passN = masters.filter(m => m.verdict === 'pass').length
  const failN = masters.filter(m => m.verdict === 'fail').length
  let final: Verdict
  let finalReason: string
  if (redlineHit) {
    const hits = redlines.filter(r => r.hit).map(r => r.label).join('·')
    final = 'fail'
    finalReason = `레드라인(${hits}) — 하나라도 걸리면 다른 점수와 무관하게 불통과`
  } else if (passN >= 3 && failN === 0) {
    final = 'pass'
    finalReason = `4인 중 ${passN}인 통과·불통과 0인 — 위원회 통과`
  } else if (failN >= 2) {
    final = 'fail'
    finalReason = `4인 중 ${failN}인 불통과 — 위원회 불통과`
  } else {
    final = 'gray'
    finalReason = `통과 ${passN}·불통과 ${failN} — 확신 부족(회색지대). 회색은 "사지 않는다"와 같다`
  }

  // 매수 가격 구간 — 버핏 DCF 내재가치의 안전마진 30%~15%.
  // 기저효과·DCF 불가·레드라인·통화 단위 의심·**금융주**면 보류한다(틀린 가격은 없는 가격보다 나쁘다).
  const buyBand: BuyBand | null =
    !redlineHit && !unitSuspect && !x.isFinancial && x.intrinsicPerShare != null && x.intrinsicPerShare > 0
      ? {
        fairValue: x.intrinsicPerShare, low: x.intrinsicPerShare * 0.70, high: x.intrinsicPerShare * 0.85,
        stretch: x.currentPrice != null && x.currentPrice > 0 ? x.intrinsicPerShare / x.currentPrice : null,
      }
      : null

  return { masters, redlines, redlineHit, final, finalReason, buyBand, missingKeys, unitSuspect }
}
