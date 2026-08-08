// 🤲 단단한 손 점검 SSOT — 코스톨라니 《돈, 뜨겁게 사랑하고 차갑게 다루어라》의 3조건을 결정론으로
//
// "폭락은 돈이 사라지는 게 아니라 떨리는 손에서 단단한 손으로 주식이 옮겨가는 과정이다."
// 단단한 손의 조건 = 💰돈(빚 없는 여유자금) · 🧠생각(나만의 논리) · ⏳인내(견딜 시간).
// 핵심은 **재능이 아니라 조건**이라는 것 — 셋을 갖추면 같은 사람의 손이 단단해진다.
//
// ⛔ 새 데이터 수집 0 · 새 판정기 0 — 기존 SSOT 셋(현금 포지션·매수 스냅샷·보유일)을 조합만 한다.
// ⛔ 매매 지시 아님 — "지금 무엇을 준비할 자리인가"를 국면과 함께 관측한다(자동매매 금지·매도 강요 금지).
import type { CashPosition } from '@/lib/cashPosition'

/** 🧭 매수 근거 스냅샷 적립 시작일 — 이전 매수는 '기록 없음'이 정상이라 분모에서 뺀다(억울한 감점 금지) */
export const SNAPSHOT_START = '2026-06-19'

export type AxisLevel = 'strong' | 'mid' | 'weak' | 'unknown'

export interface FirmAxis {
  key: 'money' | 'thesis' | 'patience'
  icon: string
  label: string
  level: AxisLevel
  value: string      // 화면에 그대로 쓰는 짧은 값
  detail: string     // 왜 그 판정인지(학생 언어)
  fix: string | null // 약할 때 무엇을 하면 되는지 — 조건은 준비할 수 있다
}

export interface FirmHandsResult {
  axes: FirmAxis[]
  strongCount: number
  /** 판정 가능한 축 수 — 현금 미등록 학생은 3이 아니라 2가 분모다(미확인을 '못 갖춤'으로 세면 억울하다) */
  knownCount: number
  grade: 'firm' | 'mixed' | 'trembling' | 'na'
  headline: string
  /** 국면(막스 온도) × 여유자금 결합 행동 — 매수/매도 판단에 바로 쓰는 한 줄 */
  action: string
  temp: number | null
  tempLabel: string
}

// ── 축별 판정(결정론) ────────────────────────────────────────────────────────

/** 💰 돈 — 현금 비중이 지금 국면의 권장 밴드 안에 있는가(cashPosition SSOT 재사용) */
function moneyAxis(cash: CashPosition | null): FirmAxis {
  const base = { key: 'money' as const, icon: '💰', label: '여유 자금' }
  if (!cash || cash.band == null) {
    return { ...base, level: 'unknown', value: '미등록',
      detail: '현금을 등록하면 지금 국면의 권장 범위와 비교해 드립니다 — 앱이 유일하게 알 수 없는 자산이에요',
      fix: '자산 관리에서 현금(원화·달러)을 입력하세요' }
  }
  const { cashPct, band, verdict } = cash
  if (verdict === 'aggressive') {
    return { ...base, level: 'weak', value: `${cashPct}%`,
      detail: `지금 국면의 권장 범위(${band.min}~${band.max}%)보다 적습니다 — 조정이 와도 살 실탄이 부족해요`,
      fix: '새로 들어오는 돈부터 현금으로 남겨 보세요(있는 걸 파는 게 아니라)' }
  }
  if (verdict === 'defensive') {
    return { ...base, level: 'strong', value: `${cashPct}%`,
      detail: `권장 범위(${band.min}~${band.max}%)보다 많습니다 — 실탄은 충분해요. 다만 너무 오래 쥐고만 있으면 기회를 놓칩니다`,
      fix: null }
  }
  return { ...base, level: 'strong', value: `${cashPct}%`,
    detail: `지금 국면의 권장 범위(${band.min}~${band.max}%) 안입니다 — 폭락이 와도 대응할 여지가 있어요`, fix: null }
}

/** 🧠 생각 — 살 때의 근거가 기록돼 있는가. 기록이 없으면 폭락 때 팔지 말지 판단할 기준 자체가 없다 */
function thesisAxis(withSnap: number, eligible: number, preStart: number): FirmAxis {
  const base = { key: 'thesis' as const, icon: '🧠', label: '산 이유' }
  if (eligible === 0) {
    return { ...base, level: 'unknown', value: '—',
      detail: preStart > 0
        ? `보유 ${preStart}종이 모두 기록 시작(${SNAPSHOT_START}) 이전 매수예요 — 감점 대상이 아닙니다`
        : '아직 기록 대상 매수가 없습니다',
      fix: '다음 매수부터 자동으로 근거가 저장됩니다' }
  }
  const pct = Math.round((withSnap / eligible) * 100)
  const level: AxisLevel = pct >= 70 ? 'strong' : pct >= 30 ? 'mid' : 'weak'
  const tail = preStart > 0 ? ` · 기록 시작 이전 매수 ${preStart}종은 분모에서 제외` : ''
  // '6/6종'만 크게 보이면 보유가 6종인 줄 오해한다 — 분모가 '기록 대상'임을 값에 못박는다
  return { ...base, level, value: `기록 ${withSnap}/${eligible}종`,
    detail: level === 'strong'
      ? `근거가 남아 있어 폭락 때 "이유가 사라졌는지"로 판단할 수 있습니다${tail}`
      : `근거 기록이 ${pct}%뿐입니다 — 기록이 없으면 폭락 때 기준이 아니라 공포로 팔게 됩니다${tail}`,
    fix: level === 'strong' ? null : '투자 기록에서 매수를 등록하면 그 시점 지표가 자동 저장됩니다' }
}

/** ⏳ 인내 — 실제로 얼마나 오래 들고 있었는가. 시간을 견뎌본 계좌만 다음 상승의 복리를 받는다.
 *  ⚠️ 원천은 `investments.purchase_date`(사용자 입력)다. 앱을 시작하며 기존 보유를 등록할 때
 *     실제 매수일 대신 **등록일**을 넣으면 보유 기간이 실제보다 짧게 나온다(실측 정황: 거래 기록이
 *     특정 하루에 15건·12건씩 몰려 있음 = 일괄 등록 패턴). 그래서 단정하지 않고 **출처를 밝히고
 *     고치는 법을 함께 준다** — 판정이 데이터 아티팩트로 학생에게 낙인이 되면 안 된다. */
function patienceAxis(avgMonths: number | null, n: number, longRatio: number | null): FirmAxis {
  const base = { key: 'patience' as const, icon: '⏳', label: '보유 기간' }
  if (avgMonths == null || n === 0) {
    return { ...base, level: 'unknown', value: '—', detail: '매수일 정보가 있는 보유 종목이 없습니다', fix: null }
  }
  const level: AxisLevel = avgMonths >= 12 ? 'strong' : avgMonths >= 6 ? 'mid' : 'weak'
  const longTxt = longRatio != null ? ` · 1년 이상 ${Math.round(longRatio * 100)}%` : ''
  const src = ' (앱에 입력한 매수일 기준)'
  return { ...base, level, value: `평균 ${avgMonths.toFixed(1)}개월`,
    detail: level === 'strong'
      ? `한 사이클을 견뎌본 계좌입니다${longTxt}${src}`
      : level === 'mid'
        ? `아직 한 사이클(1년)을 다 겪지 않았습니다${longTxt}${src} — 첫 폭락이 진짜 시험대예요`
        : `입력된 매수일 기준으로는 대부분 최근에 산 종목입니다${longTxt}${src} — 짧은 보유는 작은 하락에도 흔들리기 쉽습니다`,
    fix: level === 'strong' ? null
      : '실제로 더 오래 보유한 종목이 있다면 자산 관리에서 매수일을 실제 날짜로 고쳐 주세요 — 등록일이 들어가 있으면 이 축이 실제보다 짧게 나옵니다' }
}

// ── 국면 × 여유자금 → 행동 한 줄 ─────────────────────────────────────────────
// 코스톨라니의 달걀(바닥·상승·상투·하락) + 막스 온도를 결합. "지금 무엇을 할 자리인가"를 말한다.
// ⛔ 종목 지시가 아니라 자세(공격/방어) 관측 — 매수는 통합추천, 매도는 출구 플랜이 담당한다.
function buildAction(temp: number | null, money: AxisLevel, grade: FirmHandsResult['grade']): string {
  if (temp == null) return '국면 데이터를 불러오지 못했습니다 — 세 축만 참고하세요'
  const greed = temp >= 65, fear = temp <= 32
  if (greed && money === 'weak')
    return '⚠️ 지금은 시장이 뜨거운데 실탄이 적습니다 — 가장 위험한 조합이에요. 신규 매수는 소액·분할로, 새 돈은 현금으로 남겨 조정을 기다리세요'
  if (greed)
    return '🔥 시장이 뜨거운 구간입니다 — 실탄은 있으니 서둘러 다 쓰지 마세요. 코스톨라니: 모두가 주식 이야기를 할 때가 꼭대기 근처입니다'
  if (fear && money === 'weak')
    return '💧 공포 구간인데 살 돈이 없습니다 — 이번엔 버티는 게 전략입니다. 팔지 않은 계좌만 다음 상승의 복리를 받습니다'
  if (fear)
    return '💧 공포 구간 + 실탄 보유 — 코스톨라니가 말한 "단단한 손이 사 모으는 자리"입니다. 한 번에 말고 계획대로 분할로'
  if (grade === 'trembling')
    return '🌤️ 지금은 중립 구간 — 폭락은 예고 없이 옵니다. 조용할 때 부족한 축을 채워두는 게 준비의 전부예요'
  return '🌤️ 지금은 중립 구간 — 조건이 갖춰져 있으니 평소 계획대로. 시세의 지그재그에 일희일비하지 마세요(산책하는 개)'
}

const TEMP_LABEL = (t: number | null) =>
  t == null ? '국면 미확인' : t >= 75 ? '극단적 탐욕' : t >= 65 ? '탐욕' : t >= 42 ? '중립' : t <= 25 ? '극단적 공포' : t <= 32 ? '공포' : '중립'

/** 종합 — 순수 함수(판정은 코드·결정론) */
export function computeFirmHands(input: {
  cash: CashPosition | null
  snapshot: { withSnap: number; eligible: number; preStart: number }
  holding: { avgMonths: number | null; n: number; longRatio: number | null }
}): FirmHandsResult {
  const axes = [
    moneyAxis(input.cash),
    thesisAxis(input.snapshot.withSnap, input.snapshot.eligible, input.snapshot.preStart),
    patienceAxis(input.holding.avgMonths, input.holding.n, input.holding.longRatio),
  ]
  const known = axes.filter(a => a.level !== 'unknown')
  const strongCount = axes.filter(a => a.level === 'strong').length
  const weakCount = axes.filter(a => a.level === 'weak').length
  const grade: FirmHandsResult['grade'] =
    known.length === 0 ? 'na'
    : strongCount >= 2 && weakCount === 0 ? 'firm'
    : weakCount >= 2 ? 'trembling'
    : 'mixed'
  const temp = input.cash?.temp ?? null
  const headline =
    grade === 'firm' ? '🤲 단단한 손 — 폭락이 와도 버틸 조건을 갖췄습니다'
    : grade === 'mixed' ? '🤝 절반의 손 — 한 축만 채우면 단단해집니다'
    : grade === 'trembling' ? '😰 떨리는 손 — 지금 폭락이 오면 흔들릴 수 있습니다'
    : '⚪ 판단 보류 — 현금과 보유 정보를 등록하면 점검할 수 있습니다'
  return {
    axes, strongCount, knownCount: known.length, grade, headline,
    action: buildAction(temp, axes[0].level, grade),
    temp, tempLabel: TEMP_LABEL(temp),
  }
}
