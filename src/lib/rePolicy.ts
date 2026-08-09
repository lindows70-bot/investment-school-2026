// 🏛️ 부동산 정책 분류 SSOT — 순수 함수·결정론. ⛔ 판정은 코드, AI는 서술만(앱 관례)
//
// 이 파일이 답하는 것: "이 정책은 **어느 경로로** 내 지표에 닿고, **언제쯤** 나타나나?"
// 답하지 않는 것: 정책이 옳은가(정치) · 집값이 몇 % 갈 것인가(예측).
//
// ⚠️ 키워드 사전은 '정적 참조 데이터'다(제1원칙 예외 — 데이터가 아니라 **분류 규칙**).
//    출처: 정책 유형은 국토교통부 주택정책 분류 체계(공급/금융/세제/규제지역)를 따랐다.

export type Channel = 'supply' | 'tax' | 'finance' | 'zone' | 'other'
export type Stance = 'tighten' | 'ease' | 'discuss'

export const CHANNEL_META: Record<Exclude<Channel, 'other'>, {
  emoji: string; label: string; metric: string; lagLabel: string; lagMonths: [number, number]; href: string
}> = {
  // ⚠️ 시차가 이 기능의 핵심 교육 포인트다 — "공급 대책 발표 = 곧 하락"이 아니다.
  supply:  { emoji: '🏗️', label: '공급',      metric: '공급 파이프라인(인허가→착공→준공)', lagLabel: '2~3년',   lagMonths: [24, 36], href: '/real-estate/honeycomb' },
  tax:     { emoji: '💰', label: '세제',      metric: '매물 출회 → 거래량·미분양',        lagLabel: '6~12개월', lagMonths: [6, 12],  href: '/real-estate' },
  finance: { emoji: '🏦', label: '금융',      metric: '주담대 금리·거래량',              lagLabel: '1~3개월',  lagMonths: [1, 3],   href: '/real-estate' },
  zone:    { emoji: '📍', label: '규제지역',   metric: '해당 지역 벌집 국면·거래량',        lagLabel: '즉시',    lagMonths: [0, 1],   href: '/real-estate/honeycomb' },
}

// ⚠️ 사전은 **실측 손 채점으로 고쳤다**(2026-08-09, 법령 45건). 자동 분류만 믿었으면 놓쳤을 것들:
//   · '표준지공시지가'·'감정평가' → 공시가격은 **보유세 과표**라 세제다(other 로 새고 있었다)
//   · '공공지원민간임대'·'매입임대'·'입주자' → 공급인데 '공급' 글자가 없어 안 걸렸다
//   · '분양가격의 산정'·'기본형건축비' → 공급이 아니라 **가격 통제(규제)** 다
const CH_WORDS: [Channel, RegExp][] = [
  ['zone',    /투기과열|조정대상|토지거래허가|분양가상한|분양가격|기본형건축비|가산비|규제지역|허가구역|전매제한|실거주\s*의무/],
  ['finance', /LTV|DSR|대출|보증|담보인정|PF|금융|여신|중도금|잔금|주택도시기금/i],
  ['tax',     /종부세|종합부동산세|양도세|양도소득|취득세|재산세|보유세|과세|세제|세율|공시가격|공시지가|감정평가|기준시가/],
  ['supply',  /공급|택지|그린벨트|개발제한|신도시|정비사업|재건축|재개발|착공|분양|입주|주택건설|용적률|임대주택|공공주택|주거급여|주택도시/],
]
/** 📐 경로 분류 — 앞선 규칙이 우선(규제지역 > 금융 > 세제 > 공급).
 *  ⚠️ '분양가상한제'는 공급이 아니라 **규제지역** 성격이라 먼저 잡는다(가격 통제). */
export function classifyChannel(text: string): Channel {
  for (const [ch, re] of CH_WORDS) if (re.test(text)) return ch
  return 'other'
}

const TIGHTEN = /강화|인상|상향|규제|제한|축소|지정|중과|금지|억제|substant|폐지 유예/
const EASE    = /완화|인하|하향|해제|확대|지원|공급 확대|면제|감면|풀|허용/
const DISCUSS = /검토|추진|논의|거론|유력|예정|방침|계획|의견 수렴/
/** 🚦 정책 강도 — ⚠️ **가격 방향이 아니라 규제 강도**다.
 *  🔴을 '악재'로 읽히게 하면 정치적 해석이 된다(억제책은 실수요자에겐 기회일 수 있다). */
export function classifyStance(text: string): Stance {
  if (DISCUSS.test(text)) return 'discuss'
  const t = TIGHTEN.test(text), e = EASE.test(text)
  if (t && !e) return 'tighten'
  if (e && !t) return 'ease'
  return 'discuss'   // 둘 다이거나 둘 다 아니면 단정하지 않는다(가짜 정밀 금지)
}

/** 🏛️ 부동산 정책 소관 부처만 — 실측에서 '주택공급' 검색에 산업통상부·국가보훈부·고용노동부가
 *  상위로 섞였다(2026-08-09). 부처 필터가 없으면 목록이 오설명이 된다. */
export const POLICY_ORG = /국토교통부|기획재정부|금융위원회|국세청|행정안전부/

/** 🗑️ 정치 공방 제외 — ⚠️ 검열이 아니라 **시장 영향과 무관한 잡음 제거**다.
 *  실측에서 여야 공방·인물 발언·정책 평점 기사가 다수 섞였다. 제외 건수는 화면에 표기한다.
 *  ⚠️ **인물명 자체로 거르지 않는다** — "李정부, 주택 공급대책 발표 전망"은 정상적인 정책 기사다.
 *     거르는 건 **평가·공방 표현**이다(라이브에서 "국정동력 '흔들'"이 통과해 보강했다). */
export const POLITICS_NOISE =
  /野|與|여당|야당|공방|정치공세|국정감사|국정동력|정쟁|지지율|여론조사|책임론|대표\s|의원\s|유체이탈|사설|칼럼|기고|인터뷰\+|악재'|'흔들/

/** 뉴스 제목 중복 판정 키 — ⚠️ 유니코드 따옴표(‘’“”)·공백·매체 꼬리를 정규화하지 않으면
 *  같은 기사가 두 번 뜬다(라이브 실측: 따옴표 종류만 다른 동일 기사 2건). */
export const dedupKey = (title: string): string =>
  title
    .replace(/\s*-\s*[^-]+$/, '')          // 매체명 꼬리 제거
    .replace(/[‘’'“”"·…\-—\s]/g, '')       // 따옴표·구두점·공백 제거
    .toLowerCase()

/** 뉴스 제목이 부동산 **정책** 기사인가(단순 시황·분양 광고 제외) */
export const POLICY_NEWS = /대책|정책|규제|완화|세제|개편|지정|해제|공급|법안|시행|고시|국토부|기재부|금융위/

export interface PolicyItem {
  source: 'law' | 'news'      // 📜 확정(법령) vs 📰 예고(뉴스) — 섞지 않는다
  title: string
  channel: Channel
  stance: Stance
  date: string                // YYYY-MM-DD
  meta: string                // 법령=부처·종류·제개정 / 뉴스=매체
  link: string
  effective?: string          // 법령만 — 시행일(발령 ≠ 시행)
}

export interface ChannelSummary {
  channel: Exclude<Channel, 'other'>
  lawN: number; newsN: number
  tighten: number; ease: number
}

/** 경로별 집계 — 화면이 "어느 경로가 지금 뜨거운가"를 표본수와 함께 보여줄 수 있게 */
export function summarize(items: PolicyItem[]): ChannelSummary[] {
  return (Object.keys(CHANNEL_META) as Exclude<Channel, 'other'>[]).map(ch => {
    const g = items.filter(i => i.channel === ch)
    return {
      channel: ch,
      lawN: g.filter(i => i.source === 'law').length,
      newsN: g.filter(i => i.source === 'news').length,
      tighten: g.filter(i => i.stance === 'tighten').length,
      ease: g.filter(i => i.stance === 'ease').length,
    }
  })
}

/** 🚦 종합 기후 — 확정(법령)에 가중 2, 예고(뉴스)에 1. 표본이 얇으면 단정하지 않는다. */
export function climateOf(items: PolicyItem[]): { stance: Stance; tighten: number; ease: number; n: number } {
  let t = 0, e = 0
  for (const i of items) {
    const w = i.source === 'law' ? 2 : 1
    if (i.stance === 'tighten') t += w
    else if (i.stance === 'ease') e += w
  }
  const n = items.length
  const stance: Stance = n < 5 || Math.abs(t - e) < 3 ? 'discuss' : t > e ? 'tighten' : 'ease'
  return { stance, tighten: t, ease: e, n }
}

export const ymd = (yyyymmdd: string): string =>
  /^\d{8}$/.test(yyyymmdd) ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}` : yyyymmdd
