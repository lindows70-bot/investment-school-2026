// 위기 신호등 조립기(순수 함수 · 의존성 0) — 앱이 이미 가진 판정(수익률곡선·하이일드·삼의 법칙·위기 레이더·빚투 레이더·공포탐욕)과
//   설비투자÷번 돈·미국 신용잔고·야데니 모델을 등 9개로 묶어 학생 말로 옮긴다(+ VIX 긴 이력 차트). 새 판정은 만들지 않는다 — 색은 각 SSOT 의 판정이나 지표 자체의 정의(삼의 법칙·연준 모델)를 그대로 옮긴 것이다.
//   설계 docs/crisis-signal/plan.md · 2026-11-21 사용자 요청(AI 버블 논쟁 · 영상 EP55 · "장단기 금리차도 같이")
//   ⛔ 종합 점수·확률 없음(개수만) · 사라/팔라 없음 · 못 가져온 등은 초록이 아니라 '모름'(none) · 숫자마다 출처와 날짜
import type { CapexCash } from '@/lib/capexCash'
import type { UsMargin } from '@/lib/usMargin'
import type { FedModel } from '@/lib/fedModel'
import type { VixHistory } from '@/lib/vixHistory'
import type { BottomSignals } from '@/lib/bottomSignals'

export type LightColor = 'red' | 'yellow' | 'green' | 'none'
export type LightGroup = 'money' | 'bubble'
export type LightKey = 'curve' | 'credit' | 'jobs' | 'value' | 'yardeni' | 'usdebt' | 'debt' | 'capex' | 'mood'

export interface LightRow { label: string; value: string; note?: string }
export interface Light {
  key: LightKey
  group: LightGroup
  name: string                 // 짧은 이름(홈 카드 칩)
  title: string                // 상세 제목
  color: LightColor
  state: string                // 한두 단어 상태
  line: string                 // 지금 상태 한 문장
  rows: LightRow[]             // 근거 숫자
  what: string                 // 이 등이 무엇을 재나
  rule: string                 // 색을 가르는 규칙
  source: string
  date: string | null          // YYYY-MM-DD 또는 YYYY-MM
  dateKind: '기준일' | '기준월' | '분기 끝' | '계산일' | '조회일'
}
export interface CurveHistory { firstYear: string; total: number; recession: number; falseAlarm: number; medianMonths: number | null; minMonths: number | null; maxMonths: number | null; minDays: number }
export interface CrisisSignal {
  asOf: string
  lights: Light[]
  counts: Record<LightColor, number>
  measured: number
  total: number
  overall: { color: LightColor; headline: string; line: string; rule: string; todo: string[] }
  groups: { key: LightGroup; name: string; hint: string; line: string }[]
  curveSeries: { date: string; s2: number | null; s3m: number | null }[]
  curveHistory: CurveHistory | null
  /** VIX 긴 이력(차트) — 못 가져오면 null */
  vix: VixHistory | null
  /** 바닥 신호 5칸 — 위기 신호와 다른 질문(지금이 바닥인가). 라우트가 붙인다 · 못 만들면 null */
  bottom?: BottomSignals | null
  stale?: boolean              // 새로 못 만들어 마지막 성공분을 보여주는 중
}

/** 반대매매 비중이 이력의 이 백분위 이상이면 '강제청산 스파이크'로 본다 — 막스 시계추(/api/marks-cycle)와 같은 숫자 */
export const FORCED_SPIKE_PCTL = 60
/** 종합 색 규칙 — 화면에 그대로 적는다 */
export const OVERALL_RED_MIN = 3        // 빨강이 이만큼 이상이면 종합 빨강
export const OVERALL_YELLOW_MIN = 3     // 빨강이 없어도 노랑이 이만큼 이상이면 종합 노랑
export const OVERALL_MIN_MEASURED = 4   // 잰 등이 이보다 적으면 종합을 쉰다

// ── 입력: 기존 응답에서 쓰는 필드만(모양은 여기서 검사한다 — 틀리면 그 등은 '모름') ──
interface SpreadIn { key?: unknown; value?: unknown; date?: unknown; invertedDays?: unknown; chg3m?: unknown }
export interface CurveIn {
  alert?: unknown; spreads?: SpreadIn[]
  sahm?: { v?: unknown; date?: unknown; triggered?: unknown } | null
  history?: { from?: unknown; leadMonths?: unknown; outcome?: unknown }[]
  leadSummary?: { medianMonths?: unknown; minMonths?: unknown; maxMonths?: unknown } | null
  series?: { date?: unknown; s2?: unknown; s3m?: unknown }[]
}
export interface LiquidityIn { gauges?: { key?: unknown; value?: unknown; sub?: unknown; tone?: unknown; date?: unknown }[] }
export interface RadarIn { alertLevel?: unknown; dangerCount?: unknown; asOf?: unknown; metrics?: { key?: unknown; label?: unknown; value?: unknown; unit?: unknown; signal?: unknown; norm?: unknown }[] }
export interface LeverageIn {
  current?: { date?: unknown; level?: unknown; ratio?: unknown; margin?: unknown; margin20dChgPct?: unknown; ratioPercentile?: unknown } | null
  misu?: { current?: { date?: unknown; forcedPct?: unknown; forcedPctPercentile?: unknown } | null; series?: unknown[] } | null
  series?: unknown[]
}
export interface MoodIn { source?: unknown; partyScore?: unknown; rating?: unknown; prevClose?: unknown; prev1Week?: unknown; prev1Month?: unknown; vix?: unknown; asOf?: unknown }
export interface SignalRules {
  flatPp: number; redDays: number; historyMinDays: number; sahmPp: number; hyWarn: number; hyBad: number; hySpike: number; capexRed: number; capexYellow: number
  /** 빚 판정 자리(lib/leverageLevel) — 위험 · 주의 · 조합(비율 자리 + 잔고 자리) */
  levDanger: number; levCaution: number; levComboRatio: number; levComboMargin: number; usWindowM: number
}
export interface CrisisSignalInput {
  now: string
  curve: CurveIn | null
  liquidity: LiquidityIn | null
  radar: RadarIn | null
  usMargin: UsMargin | null
  fedModel: FedModel | null
  vix: VixHistory | null
  leverage: LeverageIn | null
  mood: MoodIn | null
  capex: CapexCash | null
  rules: SignalRules
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const isStr = (s: unknown): s is string => typeof s === 'string' && s.length > 0
const YMD = /^\d{4}-\d{2}-\d{2}/
const ymd = (s: unknown): string | null => isStr(s) && YMD.test(s) ? s.slice(0, 10) : null
const signed = (n: number, d = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d)}`
const NONE_LINE = '지금은 이 등을 못 가져왔어요 — 초록이 아니라 모름이에요.'

type Meta = Pick<Light, 'key' | 'group' | 'name' | 'title' | 'what' | 'rule' | 'source' | 'dateKind'>
const none = (m: Meta): Light => ({ ...m, color: 'none', state: '모름', line: NONE_LINE, rows: [], date: null })

// ── ① 장단기 금리차 ──
function curveLight(c: CurveIn | null, r: SignalRules): Light {
  const meta: Meta = {
    key: 'curve', group: 'money', name: '금리차', title: '장단기 금리차 — 채권시장의 경기 경고',
    what: '미국에 10년 빌려줄 때 이자에서 2년(또는 3개월) 빌려줄 때 이자를 뺀 값이에요. 보통은 길게 빌려줄수록 이자가 높아서 플러스예요. 마이너스가 되는 걸 역전이라고 해요 — 채권시장이 "앞으로 경기가 식어 금리가 내려간다"에 돈을 걸었다는 뜻이라, 과거 침체와 금융위기 앞에 자주 나타났어요.',
    rule: `초록 = 두 금리차 모두 ${r.flatPp}%p 이상 · 노랑 = ${r.flatPp}%p 아래로 좁아졌거나 역전이 막 시작됨 · 빨강 = 역전이 ${r.redDays}거래일 넘게 이어짐(선생님 화면 수익률곡선 경보와 같은 규칙)`,
    source: 'FRED T10Y2Y · T10Y3M', dateKind: '기준일',
  }
  const s2 = c?.spreads?.find(s => s?.key === 't10y2y'), s3 = c?.spreads?.find(s => s?.key === 't10y3m')
  const alert = c?.alert
  if (!c || !s2 || !s3 || !isNum(s2.value) || !isNum(s3.value) || !(alert === 'none' || alert === 'watch' || alert === 'brief' || alert === 'red')) return none(meta)
  const v2 = s2.value, v3 = s3.value
  const days = Math.max(isNum(s2.invertedDays) ? s2.invertedDays : 0, isNum(s3.invertedDays) ? s3.invertedDays : 0)
  const narrowing = isNum(s2.chg3m) && isNum(s3.chg3m) && s2.chg3m < 0 && s3.chg3m < 0
  const color: LightColor = alert === 'red' ? 'red' : alert === 'none' ? 'green' : 'yellow'
  const state = alert === 'none' ? '정상' : alert === 'watch' ? '좁아짐' : `역전 ${days}거래일째`
  const line =
    alert === 'red' ? `짧은 돈 이자가 긴 돈보다 높은 역전이 ${days}거래일째예요 — 과거엔 이런 뒤에 침체가 자주 왔어요(바로 오지는 않았어요).`
    : alert === 'brief' ? `역전이 시작됐어요(${days}거래일째) — 며칠짜리 역전은 그냥 지나간 적도 많아요. ${r.redDays}거래일을 넘기면 빨강이에요.`
    : alert === 'watch' ? `금리차가 ${Math.min(v2, v3).toFixed(2)}%p까지 좁아졌어요 — 역전은 아니지만 지켜볼 자리예요.`
    : `10년 이자가 2년보다 ${v2.toFixed(2)}%p, 3개월보다 ${v3.toFixed(2)}%p 높아요 — 정상이에요.${narrowing ? ' 다만 석 달 전보다 좁아졌어요.' : ''}`
  const row = (label: string, s: SpreadIn): LightRow => ({ label, value: `${signed(s.value as number)}%p`, ...(isNum(s.chg3m) ? { note: `석 달 전보다 ${signed(s.chg3m)}%p` } : {}) })
  const d2 = ymd(s2.date), d3 = ymd(s3.date)
  return { ...meta, color, state, line, rows: [row('10년 − 2년', s2), row('10년 − 3개월', s3)], date: d2 && d3 ? (d2 < d3 ? d2 : d3) : d2 ?? d3 }
}

function curveHistoryOf(c: CurveIn | null, r: SignalRules): CurveHistory | null {
  const h = c?.history
  if (!Array.isArray(h) || !h.length || !isStr(h[0]?.from)) return null
  const num = (n: unknown) => isNum(n) ? n : null
  return {
    firstYear: (h[0].from as string).slice(0, 4), total: h.length,
    recession: h.filter(e => isNum(e?.leadMonths)).length,
    falseAlarm: h.filter(e => e?.outcome === 'false_alarm').length,
    medianMonths: num(c?.leadSummary?.medianMonths), minMonths: num(c?.leadSummary?.minMonths), maxMonths: num(c?.leadSummary?.maxMonths),
    minDays: r.historyMinDays,
  }
}

// ── ② 기업 돈줄(하이일드 스프레드) ──
function creditLight(l: LiquidityIn | null, r: SignalRules): Light {
  const meta: Meta = {
    key: 'credit', group: 'money', name: '기업 돈줄', title: '기업 돈줄 — 하이일드 스프레드',
    what: '신용이 낮은 회사가 돈을 빌릴 때 미국 국채보다 얼마나 더 이자를 줘야 하는지예요. 돈줄이 막히기 시작하면 이 숫자가 가장 먼저 뛰어요 — 2008년 금융위기 때도 그랬어요.',
    rule: `초록 = ${r.hyWarn}%p 이하 · 노랑 = ${r.hyWarn}%p 초과 또는 4주 새 ${r.hySpike}%p 넘게 뜀 · 빨강 = ${r.hyBad}%p 초과(선생님 화면 미국 유동성과 같은 규칙)`,
    source: 'FRED BAMLH0A0HYM2(ICE BofA 하이일드 스프레드)', dateKind: '기준일',
  }
  const g = (k: string) => l?.gauges?.find(x => x?.key === k)
  const hy = g('hy')
  if (!hy || !isStr(hy.value) || !(hy.tone === 'good' || hy.tone === 'warn' || hy.tone === 'bad')) return none(meta)
  const color: LightColor = hy.tone === 'bad' ? 'red' : hy.tone === 'warn' ? 'yellow' : 'green'
  const line =
    color === 'red' ? `신용이 낮은 회사는 국채보다 ${hy.value}나 더 줘야 돈을 빌려요 — 돈줄이 막히는 구간이에요.`
    : color === 'yellow' ? `신용이 낮은 회사가 돈을 빌리려면 국채보다 ${hy.value} 더 줘야 해요 — 조금 들썩여요.`
    : `신용이 낮은 회사도 국채보다 ${hy.value}만 더 주면 돈을 빌려요 — 돈줄이 평온해요.`
  const rows: LightRow[] = [{ label: '하이일드 스프레드', value: hy.value, ...(isStr(hy.sub) ? { note: hy.sub } : {}) }]
  // 곁에 두는 숫자(색에는 넣지 않는다) — 돈값과 은행 문턱
  for (const [k, label] of [['rate', '기준금리 · 시장이 보는 방향'], ['sloos', '은행 대출 문턱(조인 은행 − 푼 은행)'], ['netLiq', '시중에 풀린 돈']] as const) {
    const x = g(k)
    if (x && isStr(x.value)) rows.push({ label, value: x.value, ...(isStr(x.sub) ? { note: x.sub } : {}) })
  }
  return { ...meta, color, state: color === 'red' ? '막힘' : color === 'yellow' ? '들썩임' : '평온', line, rows, date: ymd(hy.date) }
}

// ── ③ 일자리(삼의 법칙) ──
function jobsLight(c: CurveIn | null, r: SignalRules): Light {
  const meta: Meta = {
    key: 'jobs', group: 'money', name: '일자리', title: '일자리 — 침체 시작 신호(삼의 법칙)',
    what: `미국 실업률 석 달 평균이 지난 1년 중 가장 낮았던 때보다 ${r.sahmPp}%p 넘게 오르면 켜져요. 장단기 금리차가 멀리서 오는 경고라면, 이 등은 "지금 시작됐다"에 가까운 신호예요.`,
    rule: `초록 = ${r.sahmPp}%p 미만 · 빨강 = ${r.sahmPp}%p 이상. 이 등은 노랑이 없어요 — 켜지거나 꺼지거나예요.`,
    source: 'FRED SAHMREALTIME', dateKind: '기준월',
  }
  const s = c?.sahm
  if (!s || !isNum(s.v) || typeof s.triggered !== 'boolean') return none(meta)
  const on = s.triggered
  return {
    ...meta, color: on ? 'red' : 'green', state: on ? '켜짐' : '꺼짐',
    line: on ? `실업률이 최근 1년 저점보다 ${s.v.toFixed(2)}%p 올랐어요 — 과거 침체가 시작될 때 켜지던 신호예요.` : `실업률이 최근 1년 저점보다 ${s.v.toFixed(2)}%p 높아요 — 침체 시작 신호(${r.sahmPp}%p)는 꺼져 있어요.`,
    rows: [{ label: '삼의 법칙 지표', value: `${s.v.toFixed(2)}%p`, note: `${r.sahmPp}%p 이상이면 켜짐` }],
    date: isStr(s.date) && YMD.test(s.date) ? s.date.slice(0, 7) : null,
  }
}

// ── ④ 주식 값(버블 지표 넷) ──
const SIG_KO: Record<string, string> = { danger: '빨강', caution: '노랑', safe: '초록' }
const metricName = (key: unknown, label: unknown): string =>
  key === 'cape' ? '10년 이익 배수(CAPE)' : key === 'buffett' ? '시가총액 ÷ GDP(버핏 지표)' : key === 'erp' ? '주식이 국채보다 더 주는 몫'
  : key === 'pe' ? (isStr(label) && label.includes('후행') ? '지난 이익 배수(후행 PER)' : '예상이익 배수(선행 PER)') : isStr(label) ? label : '지표'
function valueLight(x: RadarIn | null): Light {
  const meta: Meta = {
    key: 'value', group: 'bubble', name: '주식 값', title: '주식 값 — 미국 주식은 얼마나 비싼가',
    what: '미국 주식 전체를 네 가지 자로 재요 — 지난 10년 이익의 몇 배인지, 경제 규모의 몇 %인지, 앞으로 1년 예상이익의 몇 배인지, 국채보다 얼마나 더 주는지. 막스의 "어떤 값도 비싸지 않다"를 숫자로 보는 등이에요. 예상이익으로 재면 싸 보이고 지난 이익으로 재면 비싸 보일 수 있어서 자를 넷 써요.',
    rule: '빨강 = 네 자 중 2개 이상이 빨강 · 노랑 = 1개가 빨강이거나 2개 이상이 노랑 · 초록 = 그 밖(선생님 화면 위기 레이더와 같은 규칙)',
    source: 'multpl.com(CAPE·이익수익률) · FRED(시가총액·GDP·국채) · FactSet(선행 PER)', dateKind: '계산일',
  }
  const ms = Array.isArray(x?.metrics) ? x!.metrics!.filter(m => m && isNum(m.value) && isStr(m.signal) && SIG_KO[m.signal]) : []
  const lv = x?.alertLevel
  if (ms.length < 3 || !(lv === 'danger' || lv === 'caution' || lv === 'safe')) return none(meta)
  const color: LightColor = lv === 'danger' ? 'red' : lv === 'caution' ? 'yellow' : 'green'
  const reds = ms.filter(m => m.signal === 'danger').length
  const greens = ms.filter(m => m.signal === 'safe').map(m => metricName(m.key, m.label))
  const line =
    color === 'green' ? `값을 재는 자 ${ms.length}개 중 빨강이 ${reds}개예요 — 무난한 편이에요.`
    : `값을 재는 자 ${ms.length}개 중 ${reds}개가 빨강이에요${greens.length ? ` — ${greens.join(' · ')}만 초록이에요` : ''}.`
  return {
    ...meta, color, state: color === 'red' ? '비쌈' : color === 'yellow' ? '조금 비쌈' : '무난', line,
    // 음수는 다른 등과 같은 빼기 기호(−)로 — 한 화면에서 '-0.79' 와 '−0.21' 이 섞였다(2026-11-21 프로덕션 실측)
    rows: ms.map(m => ({ label: metricName(m.key, m.label), value: `${(m.value as number) < 0 ? '−' : ''}${Math.abs(m.value as number)}${isStr(m.unit) ? m.unit : ''}`, note: `${SIG_KO[m.signal as string]}${isStr(m.norm) ? ` · ${m.norm}` : ''}` })),
    date: ymd(x?.asOf),
  }
}

// ── ⑤ 야데니 모델(연준 모델) — 예상이익 수익률 vs 10년 국채 금리 ──
const pp2 = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%p`
function yardeniLight(x: FedModel | null, radar: RadarIn | null): Light {
  const meta: Meta = {
    key: 'yardeni', group: 'bubble', name: '야데니 모델', title: '야데니 모델 — 주식과 국채, 어느 쪽이 더 주나',
    what: '경제학자 에드 야데니가 1997년 미국 연준 보고서의 그림을 보고 이름 붙인 "연준 모델"이에요. 주식을 사면 앞으로 1년 예상이익만큼 버는 셈이라, 그 수익률(예상이익 ÷ 주가 = 100 ÷ 선행 PER)을 안전한 미국 10년 국채 금리와 견줘요. 주식이 국채보다 더 주면 주식이 상대적으로 싸고, 덜 주면 비싸다고 봐요. 야데니 자신도 금리가 아주 낮거나 높을 때는 잘 안 맞는다고 보고 장기 이익 성장 전망을 넣은 식으로 고쳤는데, 그 전망치는 무료로 받을 원천이 없어 이 앱은 원래 식만 써요.',
    rule: '초록 = 예상이익 수익률이 10년 국채 금리 이상(주식이 국채보다 더 줌) · 빨강 = 그 아래(국채가 더 줌). 모델의 정의 그대로이고, 이 앱이 선을 더하지 않았어요. 그래서 이 등은 노랑이 없어요.',
    source: 'FactSet(선행 PER · 주간) · FRED DGS10(10년 국채 금리)', dateKind: '기준일',
  }
  if (!x || !isNum(x.eyPct) || !isNum(x.y10) || typeof x.cheap !== 'boolean') return none(meta)
  const color: LightColor = x.cheap ? 'green' : 'red'
  // 같은 화면 '주식 값'의 지난 이익 기준 몫(ERP) — 둘이 반대 말을 하면 그 사실을 함께 말한다(예상이익을 믿느냐의 차이)
  const erp = Array.isArray(radar?.metrics) ? radar!.metrics!.find(m => m?.key === 'erp' && isNum(m.value)) : undefined
  const erpV = erp ? erp.value as number : null
  const contrast = erpV != null && (erpV < 0) === x.cheap
    ? ` 같은 화면 '주식 값'에서 지난 1년 실제 이익으로 재면 주식이 국채보다 ${pp2(erpV)} 더 줘요 — 예상이익을 믿으면 ${x.cheap ? '싸고' : '비싸고'}, 지난 이익으로 재면 ${x.cheap ? '비싸요' : '싸요'}.`
    : ''
  const line = x.cheap
    ? `주식의 예상이익 수익률 ${x.eyPct.toFixed(2)}%가 10년 국채 ${x.y10.toFixed(2)}%보다 ${pp2(x.gapPp)} 높아요 — 이 모델로는 주식이 국채보다 싼 쪽이에요.${contrast}`
    : `주식의 예상이익 수익률 ${x.eyPct.toFixed(2)}%가 10년 국채 ${x.y10.toFixed(2)}%보다 낮아요(${pp2(x.gapPp)}) — 이 모델로는 국채가 주식보다 더 주는 쪽이에요.${contrast}`
  return {
    ...meta, color, state: x.cheap ? '주식이 더 줌' : '국채가 더 줌', line,
    rows: [
      { label: '주식의 예상이익 수익률', value: `${x.eyPct.toFixed(2)}%`, note: `100 ÷ 선행 PER ${x.fwdPe}배 · FactSet ${x.fwdDate}` },
      { label: '미국 10년 국채 금리', value: `${x.y10.toFixed(2)}%`, note: `FRED ${x.y10Date}` },
      { label: '차이(주식 − 국채)', value: pp2(x.gapPp) },
      { label: '모델이 말하는 제값 PER', value: `${x.fairPe}배`, note: `100 ÷ 10년 금리 · 지금 ${x.fwdPe}배는 그보다 ${x.vsFairPct > 0 ? `${x.vsFairPct}% 높아요` : `${Math.abs(x.vsFairPct)}% 낮아요`}` },
    ],
    date: x.fwdDate < x.y10Date ? x.fwdDate : x.y10Date,
  }
}
// ── ⑥ 미국 빚(FINRA 신용잔고) — 위기의 진원지는 미국이라 한국보다 먼저 본다(2026-11-22 사용자 지시) ──
const usdJo = (m: number) => `$${(m / 1_000_000).toFixed(2)}조`   // 백만 달러 → 조 달러
const ymDot = (ym: string) => `${ym.slice(0, 4)}.${Number(ym.slice(5, 7))}`
function usDebtLight(x: UsMargin | null, r: SignalRules): Light {
  const meta: Meta = {
    key: 'usdebt', group: 'bubble', name: '미국 빚', title: '미국 빚 — 증권사에서 빌려 산 주식',
    what: '미국 투자자가 증권사에서 돈을 빌려 주식을 산 금액이에요(신용잔고). 값이 내리면 담보가 모자라 강제로 팔리고, 그 매도가 값을 또 내려요. 수업 영상의 풀이로는, 하루에 5%, 10%씩 빠지는 날이 나오는 건 회사가 하루 만에 나빠져서가 아니라 이 빚이 풀리는 속도 때문이에요.',
    rule: `한국 빚 등과 같은 규칙이에요. 빌린 돈 ÷ 맡겨 둔 돈 비율을 최근 ${r.usWindowM}개월과 줄 세워, ${r.levDanger}% 자리 이상이면 빨강 · ${r.levCaution}% 자리 이상이면 노랑이에요(비율이 ${r.levComboRatio}% 자리 이상이면서 빌린 돈 자체가 ${r.levComboMargin}% 자리 이상이어도 빨강).`,
    source: 'FINRA Margin Statistics(미국 금융산업규제기구 · 월별)', dateKind: '기준월',
  }
  if (!x || !isNum(x.debitM) || !isNum(x.freeM) || !isNum(x.ratioPct) || !(x.level === 'danger' || x.level === 'caution' || x.level === 'stable') || !/^\d{4}-\d{2}$/.test(x.ym)) return none(meta)
  const color: LightColor = x.level === 'danger' ? 'red' : x.level === 'caution' ? 'yellow' : 'green'
  const times = (x.ratioPct / 100).toFixed(1)
  const peakTail = x.peak.ym === x.ym ? ' 지금이 기록상 가장 많아요.' : ` 가장 많았던 ${ymDot(x.peak.ym)}보다는 ${Math.abs(x.fromPeakPct).toFixed(1)}% 적어요.`
  // 문장에선 기호($) 없이 "1.45조 달러" — 표 칸($1.45조)과 달리 기호와 낱말이 겹쳐 "$1.45조 달러"로 읽혔다(2026-11-22 화면 실측)
  const head = `미국 투자자가 증권사에서 빌린 돈이 ${(x.debitM / 1_000_000).toFixed(2)}조 달러예요`
  const line =
    color === 'red' ? `${head} — 맡겨 둔 돈의 ${times}배로, 최근 ${x.windowMonths}개월 가운데 맨 위쪽이에요.${peakTail}`
    : color === 'yellow' ? `${head} — 맡겨 둔 돈의 ${times}배로, 평소보다 많이 쌓였어요.${peakTail}`
    : `${head} — 맡겨 둔 돈의 ${times}배로, 최근 ${x.windowMonths}개월 가운데 평소 수준이에요.${peakTail}`
  const rows: LightRow[] = [
    { label: '신용잔고(빌린 돈)', value: usdJo(x.debitM), ...(x.yoyPct != null ? { note: `1년 전 같은 달보다 ${signed(x.yoyPct, 1)}%` } : {}) },
    { label: '기록상 가장 많았던 달', value: usdJo(x.peak.debitM), note: `${ymDot(x.peak.ym)}${x.peak.ym === x.ym ? ' · 지금' : ` · 지금은 그보다 ${signed(x.fromPeakPct, 1)}%`} · ${ymDot(x.historyFrom)}부터의 기록` },
    { label: '빌린 돈 ÷ 맡겨 둔 돈', value: `${x.ratioPct}%`, note: `최근 ${x.windowMonths}개월을 줄 세우면 아래에서 ${x.ratioPercentile}% 자리(빌린 돈 자체는 ${x.marginPercentile}% 자리)` },
  ]
  if (x.baseRate && x.baseRate.months > 0) rows.push({ label: '같은 규칙으로 본 과거', value: `${x.baseRate.months}개월 중 ${x.baseRate.danger}개월이 빨강`, note: `${ymDot(x.baseRate.since)}부터 — 빚은 오래 쌓인 뒤에 풀려요. 빨강이 곧 하락이라는 뜻은 아니에요` })
  return { ...meta, color, state: color === 'red' ? '과열' : color === 'yellow' ? '쌓임' : '잠잠', line, rows, date: x.ym }
}

// ── ⑦ 한국 빚(신용융자 · 반대매매) ──
function debtLight(x: LeverageIn | null): Light {
  const meta: Meta = {
    key: 'debt', group: 'bubble', name: '한국 빚', title: '한국 빚 — 빌려서 산 주식과 강제청산',
    what: '한국 개인이 증권사에서 빌려 산 주식 금액(신용융자)과, 돈을 못 채워 강제로 팔린 비중(반대매매)이에요. 빚이 끼면 같은 하락도 더 깊어져요 — 값이 내리면 담보가 모자라 강제로 팔리고, 그 매도가 값을 또 내려요.',
    rule: `빨강·노랑·초록은 선생님 화면 빚투 레이더의 판정(신용융자÷예탁금 비율이 최근 이력에서 얼마나 높은 자리인가)을 그대로 써요. 초록이어도 반대매매 비중이 최근 이력의 ${FORCED_SPIKE_PCTL}% 자리 이상이면 노랑으로 올려요.`,
    source: '네이버 증권(고객예탁금·신용잔고) · 금융투자협회(미수금·반대매매)', dateKind: '기준일',
  }
  const c = x?.current
  if (!c || !isNum(c.margin) || !isNum(c.ratio) || !(c.level === 'danger' || c.level === 'caution' || c.level === 'stable')) return none(meta)
  const days = Array.isArray(x?.series) ? x!.series!.length : null
  const span = days ? `최근 ${days.toLocaleString('ko-KR')}거래일` : '최근 이력'
  const jo = `${(c.margin / 10_000).toFixed(1)}조 원`
  const m = x?.misu?.current
  const forcedHot = isNum(m?.forcedPctPercentile) && m.forcedPctPercentile >= FORCED_SPIKE_PCTL
  const base: LightColor = c.level === 'danger' ? 'red' : c.level === 'caution' ? 'yellow' : 'green'
  const color: LightColor = base === 'green' && forcedHot ? 'yellow' : base
  const chg = isNum(c.margin20dChgPct) ? c.margin20dChgPct : null
  const line =
    base === 'red' ? `빌려서 산 주식이 ${jo} — ${span} 가운데 맨 위쪽이에요. 값이 내리면 강제로 팔리는 물량이 돼요.`
    : base === 'yellow' ? `빌려서 산 주식이 ${jo} — 평소보다 많이 쌓였어요.`
    : forcedHot ? `빌려서 산 주식은 ${jo}${chg != null && chg < 0 ? `으로 20거래일 새 ${Math.abs(chg).toFixed(1)}% 줄었어요` : '이에요'} — 쌓인 빚은 평소 수준인데, 강제로 팔린 비중이 평소보다 높아요.`
    : `빌려서 산 주식이 ${jo} — 맡겨 둔 돈에 견줘 평소 수준이에요.`
  const rows: LightRow[] = [
    { label: '신용융자 잔고', value: jo, ...(chg != null ? { note: `20거래일 새 ${signed(chg, 1)}%` } : {}) },
    { label: '신용융자 ÷ 예탁금', value: `${c.ratio}%`, ...(isNum(c.ratioPercentile) ? { note: `${span}을 줄 세우면 아래에서 ${Math.round(c.ratioPercentile)}% 자리` } : {}) },
  ]
  if (m && isNum(m.forcedPct)) rows.push({ label: '반대매매 비중(미수금 대비)', value: `${m.forcedPct}%`, ...(isNum(m.forcedPctPercentile) ? { note: `${Array.isArray(x?.misu?.series) ? `최근 ${x!.misu!.series!.length.toLocaleString('ko-KR')}거래일` : '최근 이력'}을 줄 세우면 아래에서 ${Math.round(m.forcedPctPercentile)}% 자리${ymd(m.date) ? ` · ${ymd(m.date)}` : ''}` } : {}) })
  const state = base === 'red' ? '과열' : base === 'yellow' ? '쌓임' : forcedHot ? '강제청산 늘어남' : '잠잠'
  return { ...meta, color, state, line, rows, date: ymd(c.date) }
}

// ── ⑧ 설비투자 ÷ 번 돈(빅테크) ──
const usdEok = (m: number) => `$${Math.round(m / 100).toLocaleString('en-US')}억`   // 백만 달러 → 억 달러
function capexLight(x: CapexCash | null, r: SignalRules): Light {
  const meta: Meta = {
    key: 'capex', group: 'bubble', name: '설비투자', title: '설비투자 — 빅테크는 번 돈으로 짓나',
    what: '닷컴 때 회사들은 남의 돈으로 지었고, 지금 빅테크는 번 돈으로 짓는다는 게 가장 큰 차이로 꼽혀요. 이 등은 그 말이 아직 맞는지 봐요 — 데이터센터에 쓰는 돈(설비투자)이 영업으로 번 현금을 넘으면, 모자란 돈은 빌려야 해요.',
    rule: `빨강 = ${r.capexRed}% 초과(번 돈보다 더 씀) · 노랑 = ${r.capexYellow}% 초과(번 돈의 절반 넘게) · 초록 = ${r.capexYellow}% 이하. ${r.capexRed}%와 ${r.capexYellow}%는 이 앱이 정한 선이에요.`,
    source: '각 회사 분기 보고서 숫자(야후 파이낸스 재무 시계열)', dateKind: '분기 끝',
  }
  if (!x || !isNum(x.ratioPct) || !Array.isArray(x.companies) || x.count < 3) return none(meta)
  const pct = Math.round(x.ratioPct)
  const color: LightColor = x.ratioPct > r.capexRed ? 'red' : x.ratioPct > r.capexYellow ? 'yellow' : 'green'
  const prev = x.prev && x.prev.count === x.count ? ` 1년 전 같은 분기에는 ${Math.round(x.prev.ratioPct)}%였어요.` : ''
  const head = `빅테크 ${x.count}곳이 최근 분기에 번 돈의 ${pct}%를 설비에 썼어요`
  const line =
    color === 'red' ? `${head} — 번 돈보다 더 써서 모자란 돈은 빌려야 해요.${prev}`
    : color === 'yellow' ? `${head} — 번 돈의 절반을 넘겼어요.${prev}`
    : `${head} — 번 돈 안에서 짓고 있어요.${prev}`
  const rows: LightRow[] = [
    { label: `${x.count}곳 합계`, value: `${pct}%`, note: `번 돈 ${usdEok(x.ocfM)} · 설비 ${usdEok(x.capexM)}${x.count < x.total ? ` · ${x.total}곳 중 ${x.count}곳만 최근 분기 자료가 있어요` : ''}` },
    ...x.companies.map(c => ({ label: c.name, value: c.ratioPct != null ? `${Math.round(c.ratioPct)}%` : '셀 수 없음', note: `번 돈 ${usdEok(c.ocfM)} · 설비 ${usdEok(c.capexM)} · ${c.date}${c.prevRatioPct != null ? ` · 1년 전 ${Math.round(c.prevRatioPct)}%` : ''}` })),
  ]
  return { ...meta, color, state: color === 'red' ? '번 돈보다 더 씀' : color === 'yellow' ? '절반 넘음' : '번 돈 안', line, rows, date: ymd(x.latestDate) }
}

// ── ⑨ 심리(공포·탐욕) ──
const MOOD: Record<string, { color: LightColor; ko: string; be: string; tail: string }> = {
  'extreme fear': { color: 'red', ko: '극단 공포', be: '극단 공포예요', tail: '겁에 질려 던지는 물량과 강제청산이 나오는 때예요.' },
  fear: { color: 'yellow', ko: '공포', be: '공포예요', tail: '겁이 커진 쪽이에요.' },
  neutral: { color: 'green', ko: '중립', be: '중립이에요', tail: '한쪽으로 쏠리지 않았어요.' },
  greed: { color: 'yellow', ko: '탐욕', be: '탐욕이에요', tail: '나만 빠질 수 없다는 마음이 커지는 자리예요.' },
  'extreme greed': { color: 'red', ko: '극단 탐욕', be: '극단 탐욕이에요', tail: '막스가 말한 "나만 빠질 수 없다"가 가장 강한 때예요.' },
}
function moodLight(x: MoodIn | null, vix: VixHistory | null): Light {
  const meta: Meta = {
    key: 'mood', group: 'bubble', name: '심리', title: '심리 — 공포와 탐욕',
    what: '미국 주식 투자자의 마음 온도를 0(공포)~100(탐욕)으로 잰 지수예요. 막스의 "나만 빠질 수 없다"를 보는 등이에요.',
    rule: 'CNN이 나눈 다섯 구간을 그대로 써요 — 극단 공포·극단 탐욕 = 빨강, 공포·탐욕 = 노랑, 중립 = 초록. 양쪽 끝이 모두 빨강인 건, 극단 탐욕은 거품이 부풀 때고 극단 공포는 투매가 나올 때라서예요.',
    source: 'CNN Fear & Greed', dateKind: '조회일',
  }
  const m = isStr(x?.rating) ? MOOD[x!.rating!.toString().trim().toLowerCase()] : undefined
  if (!x || x.source !== 'cnn' || !isNum(x.partyScore) || !m) return none(meta)   // CNN 이 아니면(자체 계산·폴백) 같은 이름으로 다른 지수를 보이게 된다
  const v = Math.round(x.partyScore)
  const rows: LightRow[] = [{ label: '공포·탐욕 지수', value: `${v}`, note: m.ko }]
  for (const [k, label] of [['prevClose', '전 거래일'], ['prev1Week', '1주 전'], ['prev1Month', '1달 전']] as const) {
    const p = x[k]
    if (isNum(p)) rows.push({ label, value: `${Math.round(p)}` })
  }
  // VIX 는 아래 차트와 같은 값(FRED·야후 종가 · 날짜 포함)을 쓴다 — CNN 응답의 vix 를 따로 쓰면 한 화면에 두 숫자가 된다
  if (vix && isNum(vix.last?.v)) rows.push({ label: 'VIX(미국 변동성 지수)', value: vix.last.v.toFixed(2), note: `${vix.last.date} 종가 · ${vix.since.slice(0, 4)}년부터 지금보다 높았던 날 ${vix.higherPct}% · 색에는 넣지 않아요(공포·탐욕 지수 안에 들어 있어요)` })
  return { ...meta, color: m.color, state: m.ko, line: `공포·탐욕 지수 ${v} — ${m.be}. ${m.tail}`, rows, date: ymd(x.asOf) }
}

// ── 종합 ──
const TODO: Record<Exclude<LightColor, 'none'>, string[]> = {
  red: [
    '빚부터 덜어내요 — 신용·미수·3배 상품. 30% 내렸다가 30% 올라도 원금의 91%예요(0.7 × 1.3).',
    '한 번에 사지도 팔지도 않아요 — 나눠 살 날짜와 금액을 미리 적어 둬요.',
    '가진 종목마다 두 줄을 적어 봐요 — 번 돈보다 더 쓰는 회사인가, 빚 없이 2년을 버틸 현금이 있는 회사인가.',
  ],
  yellow: [
    '빚으로 산 몫이 있는지 먼저 봐요 — 빚이 끼면 같은 하락도 더 깊어져요.',
    '한쪽에 몰지 않아요 — 전부 걸기도, 전부 빼기도 가장 비싼 결정이 되기 쉬워요.',
    '살 거라면 나눠서 — 날짜와 금액을 미리 적어 둬요.',
  ],
  green: [
    '빨강이 없다고 안전하다는 뜻은 아니에요 — 신호등은 앞날을 맞히는 기계가 아니에요.',
    '평소 하던 대로 나눠 사고, 한쪽에 몰지 않아요.',
  ],
}
const nameList = (ls: Light[]) => ls.map(l => l.name).join(' · ')

export function buildCrisisSignal(inp: CrisisSignalInput): CrisisSignal {
  const r = inp.rules
  const lights: Light[] = [
    curveLight(inp.curve, r), creditLight(inp.liquidity, r), jobsLight(inp.curve, r),
    valueLight(inp.radar), yardeniLight(inp.fedModel, inp.radar), usDebtLight(inp.usMargin, r), debtLight(inp.leverage), capexLight(inp.capex, r), moodLight(inp.mood, inp.vix),
  ]
  const counts: Record<LightColor, number> = { red: 0, yellow: 0, green: 0, none: 0 }
  for (const l of lights) counts[l.color]++
  const measured = lights.length - counts.none

  const color: LightColor = measured < OVERALL_MIN_MEASURED ? 'none'
    : counts.red >= OVERALL_RED_MIN ? 'red'
    : counts.red >= 1 || counts.yellow >= OVERALL_YELLOW_MIN ? 'yellow' : 'green'
  const headline = `빨강 ${counts.red} · 노랑 ${counts.yellow} · 초록 ${counts.green}${counts.none ? ` · 모름 ${counts.none}` : ''}`
  const line =
    color === 'none' ? `등 ${lights.length}개 중 ${counts.none}개를 못 가져왔어요 — 종합은 쉬어요.`
    : color === 'red' ? '여러 등이 함께 빨강이에요 — 새로 걸기보다 빚과 몰린 자리부터 살필 때예요.'
    : color === 'yellow' ? '빨강이 일부 켜졌어요 — 서두르지 말고 나눠서 움직일 때예요.'
    : '빨강이 없어요 — 그래도 신호등은 앞날을 맞히는 기계가 아니에요.'
  const rule = `등 ${lights.length}개의 색을 세요. 빨강이 ${OVERALL_RED_MIN}개 이상이면 빨강, 빨강이 1개라도 있거나 노랑이 ${OVERALL_YELLOW_MIN}개 이상이면 노랑, 그 밖은 초록이에요. 점수나 확률은 만들지 않아요. 잰 등이 ${OVERALL_MIN_MEASURED}개보다 적으면 종합을 쉬어요.`

  const groupLine = (key: LightGroup): string => {
    const g = lights.filter(l => l.group === key)
    const reds = g.filter(l => l.color === 'red'), yellows = g.filter(l => l.color === 'yellow'), unknown = g.filter(l => l.color === 'none')
    const tail = unknown.length ? ` 못 가져온 등도 있어요(${nameList(unknown)}).` : ''
    if (unknown.length === g.length) return '이 묶음은 지금 못 가져왔어요.'
    if (reds.length) return `빨강 ${reds.length}개(${nameList(reds)})${yellows.length ? ` · 노랑 ${yellows.length}개(${nameList(yellows)})` : ''}예요.${tail}`
    if (yellows.length) return `빨강은 없고 노랑 ${yellows.length}개(${nameList(yellows)})예요.${tail}`
    return `모두 초록이에요.${tail}`
  }
  const series = Array.isArray(inp.curve?.series)
    ? inp.curve!.series!.filter(p => p && isStr(p.date) && YMD.test(p.date)).map(p => ({ date: p.date as string, s2: isNum(p.s2) ? p.s2 : null, s3m: isNum(p.s3m) ? p.s3m : null }))
    : []

  return {
    asOf: inp.now, lights, counts, measured, total: lights.length,
    overall: { color, headline, line, rule, todo: color === 'none' ? [] : TODO[color] },
    groups: [
      { key: 'money', name: '돈줄 신호', hint: '금융위기와 침체 앞에 먼저 켜지던 등 — 채권·신용·일자리', line: groupLine('money') },
      { key: 'bubble', name: '거품 신호', hint: '값(주식 값 · 야데니 모델) · 빚(미국 · 한국) · 설비투자 · 심리 — 막스의 다섯 신호 중 숫자로 잴 수 있는 것', line: groupLine('bubble') },
    ],
    curveSeries: series,
    curveHistory: curveHistoryOf(inp.curve, r),
    vix: inp.vix && isNum(inp.vix.last?.v) && inp.vix.series ? inp.vix : null,
  }
}
