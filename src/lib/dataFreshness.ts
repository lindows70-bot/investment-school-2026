// 🕒 데이터 신선도 SSOT — "이 숫자가 언제 것인가"를 화면이 **스스로 밝히게** 한다.
//
//   왜 만들었나 — 2026-08-23 교차검증에서 "부동산 값이 한 달 늦었다"는 지적이 나왔다.
//   실측해 보니 **앱은 원천 최신값을 정확히 쓰고 있었고**(9개 중 8개 일치), 늦은 건 **원천 자체**였다.
//   부동산 통계는 원래 1~3개월 늦게 나온다(월간은 익월 중순, 실거래는 등기 신고기한 때문에 3개월).
//   그런데 화면이 기준월만 보여주고 **"지금으로부터 얼마나 전인지"는 말하지 않아** 최신값으로 오해됐다.
//   → 지연을 숨기지 말고 **정상 지연인지 이상 지연인지까지 판정해서** 표시한다.
//
//   ⛔ 순수 함수·의존성 0. 화면·API 어디서든 같은 문구가 나오게 한다(문구도 SSOT).

export type FreshnessLevel = 'fresh' | 'normal' | 'stale'

export interface FreshnessInput {
  /** 데이터 기준 시점 — 'YYYY-MM' · 'YYYYMM' · 'YYYY-MM-DD' · 주간은 'YYYYWW' */
  period: string
  /** 이 통계의 **통상** 발표 지연(개월). 실측으로 채운다 — 이 값보다 더 늦으면 이상 신호 */
  typicalLagM: number
  /** 원천 이름 — 화면에 밝힌다 */
  source: string
  /** 주간 통계인가(YYYYWW) */
  weekly?: boolean
  /** 비교 기준 시각(테스트 주입용) */
  now?: Date
}

export interface FreshnessResult {
  /** 정규화된 기준월 'YYYY-MM' (주간이면 'YYYY-WW주') */
  label: string
  /** 오늘로부터 몇 개월 전 데이터인가 */
  lagMonths: number | null
  level: FreshnessLevel
  /** 화면 배지 문구 — 짧게 */
  badge: string
  /** 왜 늦는지 한 줄 — 학생이 '고장'으로 오해하지 않게 */
  why: string
}

/** 한국어 조사 — 받침 유무로 이/가·은/는·을/를을 고른다.
 *  ⚠️ 이걸 안 쓰면 "주담대 금리**이** 2026-06까지만"처럼 어색해진다(실제로 그렇게 나왔다). */
export function josa(word: string, pair: '이/가' | '은/는' | '을/를' | '와/과'): string {
  const last = String(word ?? '').trim().slice(-1)
  const code = last.charCodeAt(0)
  // 한글 음절이 아니면(숫자·영문) 받침 있는 쪽을 기본으로 — 숫자 읽기는 대부분 받침으로 끝난다
  const hasJong = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : true
  const [withJong, without] = pair.split('/')
  return hasJong ? withJong : without
}

/** 'YYYY-MM' · 'YYYYMM' · 'YYYY-MM-DD' → {y, m} */
function parseYm(s: string): { y: number; m: number } | null {
  const d = String(s ?? '').replace(/\D/g, '')
  if (d.length < 6) return null
  const y = Number(d.slice(0, 4)), m = Number(d.slice(4, 6))
  if (!(y >= 1900 && y <= 2200) || !(m >= 1 && m <= 12)) return null
  return { y, m }
}

export function freshness(inp: FreshnessInput): FreshnessResult {
  const now = inp.now ?? new Date()
  const nowY = now.getFullYear(), nowM = now.getMonth() + 1

  if (inp.weekly) {
    const d = String(inp.period ?? '').replace(/\D/g, '')
    const y = Number(d.slice(0, 4)), w = Number(d.slice(4, 6))
    const label = d.length >= 6 && isFinite(y) && isFinite(w) ? `${y}년 ${w}주차` : String(inp.period)
    return {
      label, lagMonths: null, level: 'fresh',
      badge: `${label} 기준`,
      why: `${inp.source} 주간 통계 — 매주 갱신됩니다.`,
    }
  }

  const p = parseYm(inp.period)
  if (!p) {
    return { label: String(inp.period ?? '—'), lagMonths: null, level: 'normal', badge: `${inp.period ?? '—'} 기준`, why: `출처: ${inp.source}` }
  }
  const label = `${p.y}-${String(p.m).padStart(2, '0')}`
  const lagMonths = (nowY * 12 + nowM) - (p.y * 12 + p.m)

  // 통상 지연 **이내**면 fresh(그 통계로서는 최신). 1개월 더 늦으면 normal, 그보다 늦으면 이상.
  //   ⚠️ 처음엔 `typicalLagM - 1` 을 fresh 로 뒀는데, 그러면 **정상 최신값이 죄다 normal** 로 찍힌다
  //      (매매지수는 통상 1개월 지연이라 절대 fresh 가 될 수 없었다 — 2026-08-23 검증에서 발각).
  const level: FreshnessLevel =
    lagMonths <= inp.typicalLagM ? 'fresh'
    : lagMonths <= inp.typicalLagM + 1 ? 'normal'
    : 'stale'

  const ago = lagMonths <= 0 ? '이번 달' : `${lagMonths}개월 전`
  const badge = `${label} 기준 · ${ago}`
  const why =
    level === 'stale'
      ? `${inp.source}는 보통 ${inp.typicalLagM}개월 늦게 나오는데 지금은 ${lagMonths}개월 전 값입니다 — 원천 발표가 밀렸는지 확인이 필요합니다.`
      : `${inp.source}는 집계·검증에 시간이 걸려 보통 ${inp.typicalLagM}개월 늦게 나옵니다 — 지연은 정상이며 최신 발표분입니다.`

  return { label, lagMonths, level, badge, why }
}

/** 통계별 통상 지연(개월) — **실측값**(2026-08-23 원천 대조)
 *  ⛔ 짐작해서 채우지 않는다. 새 지표를 넣을 땐 원천 최신월을 먼저 재고 등록한다. */
export const TYPICAL_LAG: Record<string, { lagM: number; source: string }> = {
  ronePrice:   { lagM: 1, source: '한국부동산원 월간 매매가격지수' },
  // 거래량은 신고·집계 때문에 가격지수보다 한 달 더 늦다 — 벌집순환(가격 ∩ 거래량)의 실제 병목이다.
  //   실측 2026-08-24: 가격 202607(1개월) vs 거래량 202606(2개월).
  roneVolume:  { lagM: 2, source: '한국부동산원 아파트 매매거래현황' },
  roneJeonse:  { lagM: 1, source: '한국부동산원 월간 전세가격지수' },
  ronePsy:     { lagM: 2, source: '국토연구원 부동산시장 소비심리지수' },
  roneConv:    { lagM: 2, source: '한국부동산원 전월세전환율' },
  roneSupply:  { lagM: 2, source: '한국부동산원 주택 착공·준공' },
  kbPrice:     { lagM: 1, source: 'KB 주택가격동향(ECOS)' },
  rtIndex:     { lagM: 3, source: '실거래가격지수(ECOS)' },
  unsold:      { lagM: 2, source: '미분양 주택(ECOS)' },
  mortgageRate:{ lagM: 2, source: '예금은행 주담대 금리(ECOS)' },
  cofix:       { lagM: 1, source: '전국은행연합회 COFIX 공시' },
}

/** 여러 입력의 교집합으로 만들어지는 지표에서 **무엇이 병목인지** 밝힌다.
 *  (게이지 버블 = 매매지수 ∩ 전세지수 ∩ 주담대금리 — 가장 늦은 하나가 전체를 끌어내린다) */
export interface BottleneckInput { label: string; period: string | null }
export function bottleneck(inputs: BottleneckInput[]): { period: string | null; label: string | null; note: string } {
  const valid = inputs.filter(i => i.period && parseYm(i.period))
  if (!valid.length) return { period: null, label: null, note: '' }
  const sorted = valid.slice().sort((a, b) => {
    const A = parseYm(a.period!)!, B = parseYm(b.period!)!
    return (A.y * 12 + A.m) - (B.y * 12 + B.m)
  })
  const slow = sorted[0], fast = sorted[sorted.length - 1]
  const sp = parseYm(slow.period!)!, fp = parseYm(fast.period!)!
  const fmt = (x: { y: number; m: number }) => `${x.y}-${String(x.m).padStart(2, '0')}`
  if (sp.y === fp.y && sp.m === fp.m) {
    return { period: fmt(sp), label: null, note: `입력 ${valid.length}종이 모두 ${fmt(sp)}까지 나와 있습니다.` }
  }
  return {
    period: fmt(sp), label: slow.label,
    note: `이 지표는 ${valid.map(v => v.label).join(' · ')}${josa(valid[valid.length - 1].label, '을/를')} 겹쳐 계산합니다.`
      + ` 그중 **${slow.label}${josa(slow.label, '이/가')} ${fmt(sp)}까지만** 나와 있어(다른 입력은 ${fmt(fp)}) 전체가 ${fmt(sp)}에서 멈춥니다`
      + ` — 계산이 늦은 게 아니라 재료가 아직 안 나온 것입니다.`,
  }
}
