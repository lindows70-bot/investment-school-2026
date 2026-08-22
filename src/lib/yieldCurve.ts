// 📐 수익률곡선 SSOT — 만기 곡선(11종) · 두 스프레드(10Y−2Y·10Y−3M) · 역전 에피소드 · 3단계 경보
//   Phase 0 실측(2026-08-22) 근거는 docs/bonds-upgrade/context-notes.md.
//   ⚠️ 스프레드는 FRED 공식 계열(T10Y2Y·T10Y3M)을 쓴다 — 직접 빼면 결측일 처리가 달라져 공식값과 어긋난다.
//   ⛔ 이 도구는 **타이밍 신호가 아니다**. 리드타임 7~23개월이고 2022년 역전은 침체로 이어지지 않았다.

const FRED = 'https://api.stlouisfed.org/fred/series/observations'

/** 캐시 키 SSOT — writer(/api/yield-curve)와 reader가 공유한다.
 *  ⚠️ 라우트 파일은 임의 export 를 허용하지 않으므로(Next.js 타입 제약) 키는 lib 에 둔다. */
export const YIELD_CURVE_KEY = (dateKey: string) => `yield-curve-v1:${dateKey}`

export interface FredPoint { date: string; v: number }

async function fredSeries(series: string, startISO: string): Promise<FredPoint[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`${FRED}?series_id=${series}&api_key=${key}&file_type=json&observation_start=${startISO}`,
      { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) }))
      .filter((x: FredPoint) => isFinite(x.v))
  } catch { return [] }
}

/** 만기 축 — years 는 차트의 x축(로그 간격이 자연스러워 실제 연수로 둔다) */
export const TENORS: { id: string; years: number; label: string }[] = [
  { id: 'DGS1MO', years: 1 / 12, label: '1개월' },
  { id: 'DGS3MO', years: 0.25, label: '3개월' },
  { id: 'DGS6MO', years: 0.5, label: '6개월' },
  { id: 'DGS1', years: 1, label: '1년' },
  { id: 'DGS2', years: 2, label: '2년' },
  { id: 'DGS3', years: 3, label: '3년' },
  { id: 'DGS5', years: 5, label: '5년' },
  { id: 'DGS7', years: 7, label: '7년' },
  { id: 'DGS10', years: 10, label: '10년' },
  { id: 'DGS20', years: 20, label: '20년' },
  { id: 'DGS30', years: 30, label: '30년' },
]

export type CurveAlert = 'none' | 'watch' | 'brief' | 'red'

export interface SpreadState {
  key: 't10y2y' | 't10y3m'
  label: string
  /** 무엇을 재는지 — 학생용 한 줄 */
  meaning: string
  value: number | null
  date: string | null
  /** 지금 역전 상태라면 연속 며칠째인가(거래일). 역전이 아니면 0 */
  invertedDays: number
  /** 현재 역전 구간의 최심값(%p). 역전이 아니면 null */
  minPp: number | null
  chg1m: number | null
  chg3m: number | null
}

export interface InversionEpisode {
  from: string
  to: string
  days: number
  minPp: number
  ongoing: boolean
  /** 이 역전 뒤 처음 시작된 NBER 침체(없으면 null) */
  recessionStart: string | null
  /** 역전 시작 → 침체 시작까지 개월 수 */
  leadMonths: number | null
}

export interface YieldCurveResult {
  asOf: string
  /** 11개 만기가 모두 존재하는 최신 날짜의 곡선 */
  curveDate: string
  curve: { years: number; label: string; v: number }[]
  /** 3개월 전 같은 곡선(이동을 보여주기 위함) — 못 구하면 null */
  curvePrev: { years: number; label: string; v: number }[] | null
  curvePrevDate: string | null
  /** 곡선 모양 판정 */
  shape: 'normal' | 'flat' | 'inverted' | 'humped'
  shapeNote: string
  spreads: SpreadState[]
  alert: CurveAlert
  alertHeadline: string
  alertDetail: string
  /** 과거 지속 역전(≥10거래일)과 그 뒤 침체 — 리드타임 대조용 */
  history: InversionEpisode[]
  /** 리드타임 요약 — 중앙값·범위. 표본수 병기(⛔가짜 정밀 금지) */
  leadSummary: { n: number; medianMonths: number | null; minMonths: number | null; maxMonths: number | null; noRecession: number }
  /** 실시간 침체 대용(Sahm) — NBER 은 후행이라 경보에 못 쓴다 */
  sahm: { v: number; date: string; triggered: boolean } | null
  /** 30일 스프레드 시계열(차트) */
  series: { date: string; s2: number | null; s3m: number | null }[]
}

/** 연속 역전 구간 묶기 — 하루짜리 노이즈를 거르기 위해 minRun 이상만 인정 */
export function findEpisodes(series: FredPoint[], minRun: number): Omit<InversionEpisode, 'recessionStart' | 'leadMonths'>[] {
  const out: Omit<InversionEpisode, 'recessionStart' | 'leadMonths'>[] = []
  let run: FredPoint[] = []
  const push = (ongoing: boolean) => {
    if (run.length < minRun) return
    out.push({ from: run[0].date, to: run[run.length - 1].date, days: run.length, minPp: Math.min(...run.map(x => x.v)), ongoing })
  }
  for (const o of series) {
    if (o.v < 0) run.push(o)
    else { push(false); run = [] }
  }
  push(true)
  return out
}

/** 현재 진행 중인 역전의 연속 일수와 최심값(마지막 관측이 음수일 때만) */
function currentRun(series: FredPoint[]): { days: number; minPp: number | null } {
  let days = 0, min = Infinity
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].v >= 0) break
    days++; min = Math.min(min, series[i].v)
  }
  return { days, minPp: days > 0 ? Math.round(min * 100) / 100 : null }
}

const chgBack = (a: FredPoint[], back: number) =>
  a.length > back ? Math.round((a[a.length - 1].v - a[a.length - 1 - back].v) * 100) / 100 : null

/** 🔴 Red Alert 임계 — Phase 0 근거: 침체 선행 역전은 전부 100일+ 였지만 확정까지 기다리면 경보로서 무용하다.
 *  10거래일은 "하루짜리 노이즈"를 거르는 최소선이고, 실제 지속일수를 화면에 숫자로 함께 띄운다. */
export const RED_MIN_DAYS = 10
/** 🟡 평탄 경계 */
export const FLAT_PP = 0.25

export async function buildYieldCurve(): Promise<YieldCurveResult | null> {
  const start2y = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)

  const [tenorArrays, s2Full, s3mFull, recArr, sahmArr] = await Promise.all([
    Promise.all(TENORS.map(t => fredSeries(t.id, start2y))),
    fredSeries('T10Y2Y', '1976-01-01'),
    fredSeries('T10Y3M', '1982-01-01'),
    fredSeries('USREC', '1976-01-01'),
    fredSeries('SAHMREALTIME', new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)),
  ])
  if (s2Full.length < 200 || s3mFull.length < 200) return null   // 부분실패면 섹션을 접는다(박제 금지)

  // ── 곡선: 11개 만기가 **모두** 있는 최신 날짜만 쓴다(빠진 만기를 이전 값으로 메우면 곡선이 왜곡된다)
  const byDate = new Map<string, Map<number, number>>()
  tenorArrays.forEach((arr, i) => {
    for (const o of arr) {
      if (!byDate.has(o.date)) byDate.set(o.date, new Map())
      byDate.get(o.date)!.set(TENORS[i].years, o.v)
    }
  })
  const fullDates = Array.from(byDate.entries())
    .filter(([, m]) => m.size === TENORS.length).map(([d]) => d).sort()
  if (!fullDates.length) return null
  const curveDate = fullDates[fullDates.length - 1]
  const mk = (d: string) => TENORS.map(t => ({ years: t.years, label: t.label, v: byDate.get(d)!.get(t.years)! }))
  const curve = mk(curveDate)

  // 3개월 전 곡선 — 정확히 그 날짜가 없을 수 있으므로 '이하 중 최신'
  const target = new Date(new Date(curveDate).getTime() - 91 * 864e5).toISOString().slice(0, 10)
  const prevDate = fullDates.filter(d => d <= target).pop() ?? null
  const curvePrev = prevDate ? mk(prevDate) : null

  // ── 스프레드 상태
  const s2Recent = s2Full.filter(o => o.date >= start2y)
  const s3mRecent = s3mFull.filter(o => o.date >= start2y)
  const run2 = currentRun(s2Full), run3 = currentRun(s3mFull)
  const spreads: SpreadState[] = [
    {
      key: 't10y2y', label: '10년 − 2년',
      meaning: '시장이 보는 중기 성장·금리 경로. 가장 널리 인용되는 침체 선행 지표.',
      value: s2Full[s2Full.length - 1]?.v ?? null, date: s2Full[s2Full.length - 1]?.date ?? null,
      invertedDays: run2.days, minPp: run2.minPp,
      chg1m: chgBack(s2Recent, 21), chg3m: chgBack(s2Recent, 63),
    },
    {
      key: 't10y3m', label: '10년 − 3개월',
      meaning: '연준 정책금리(단기)와 시장 기대(장기)의 차이. 학계에서 침체 예측력이 가장 높다고 보는 쪽.',
      value: s3mFull[s3mFull.length - 1]?.v ?? null, date: s3mFull[s3mFull.length - 1]?.date ?? null,
      invertedDays: run3.days, minPp: run3.minPp,
      chg1m: chgBack(s3mRecent, 21), chg3m: chgBack(s3mRecent, 63),
    },
  ]

  // ── 경보 3단계 (Phase 0: 단순 음수로 울리면 2025년에만 6건이 잡힌다)
  const vals = spreads.map(s => s.value).filter((v): v is number => v != null)
  const maxRun = Math.max(run2.days, run3.days)
  const anyInverted = vals.some(v => v < 0)
  let alert: CurveAlert = 'none'
  if (anyInverted && maxRun >= RED_MIN_DAYS) alert = 'red'
  else if (anyInverted) alert = 'brief'
  else if (vals.some(v => v < FLAT_PP)) alert = 'watch'

  const inv = spreads.filter(s => s.value != null && s.value < 0)
  const invNames = inv.map(s => s.label).join(' · ')
  const alertHeadline =
    alert === 'red' ? `🔴 장단기 금리 역전 ${maxRun}거래일 연속 — ${invNames}`
    : alert === 'brief' ? `🟠 장단기 금리 역전 발생(${maxRun}거래일째) — ${invNames}`
    : alert === 'watch' ? `🟡 수익률곡선 평탄 — 가장 좁은 구간 ${Math.min(...vals).toFixed(2)}%p`
    : `🟢 수익률곡선 정상 — 10Y−2Y ${spreads[0].value?.toFixed(2)}%p · 10Y−3M ${spreads[1].value?.toFixed(2)}%p`

  // ── 과거 지속 역전 + 침체 리드타임
  const recStarts: string[] = []
  for (let i = 1; i < recArr.length; i++) if (recArr[i].v === 1 && recArr[i - 1].v === 0) recStarts.push(recArr[i].date)
  // ⚠️ 표와 통계는 **같은 잣대**여야 한다 — "다음 침체"를 무조건 붙이면 1982년 역전에 1990년 침체가 달려
  //    "102개월 후"가 표에 찍힌다. 통계에서만 걸러내면 표와 요약이 서로 다른 것을 세게 된다.
  //    36개월을 넘으면 그 역전과 침체는 관련이 없다고 보고 **양쪽 모두에서** 끊는다.
  const LEAD_MAX_M = 36
  const withRec = (e: Omit<InversionEpisode, 'recessionStart' | 'leadMonths'>): InversionEpisode => {
    const next = recStarts.find(r => r > e.from) ?? null
    const lead = next ? Math.round((new Date(next).getTime() - new Date(e.from).getTime()) / 864e5 / 30.44) : null
    if (lead == null || lead > LEAD_MAX_M) return { ...e, recessionStart: null, leadMonths: null }
    return { ...e, recessionStart: next, leadMonths: lead }
  }
  // 두 스프레드의 지속 역전을 합치되 시작일이 6개월 내로 겹치면 같은 사건으로 본다
  const raw = [...findEpisodes(s2Full, RED_MIN_DAYS), ...findEpisodes(s3mFull, RED_MIN_DAYS)]
    .sort((a, b) => a.from < b.from ? -1 : 1)
  const merged: typeof raw = []
  for (const e of raw) {
    const prev = merged[merged.length - 1]
    if (prev && (new Date(e.from).getTime() - new Date(prev.from).getTime()) / 864e5 < 190) {
      // 같은 사건 — 더 길고 깊은 쪽을 대표로
      if (e.days > prev.days) merged[merged.length - 1] = { ...e, minPp: Math.min(e.minPp, prev.minPp), from: prev.from }
      else prev.minPp = Math.min(prev.minPp, e.minPp)
      continue
    }
    merged.push({ ...e })
  }
  const history = merged.map(withRec)
  const leads = history.filter(h => h.leadMonths != null && h.leadMonths > 0).map(h => h.leadMonths!).sort((a, b) => a - b)
  const median = leads.length ? (leads.length % 2 ? leads[(leads.length - 1) / 2] : Math.round((leads[leads.length / 2 - 1] + leads[leads.length / 2]) / 2)) : null
  const leadSummary = {
    n: leads.length, medianMonths: median,
    minMonths: leads[0] ?? null, maxMonths: leads[leads.length - 1] ?? null,
    noRecession: history.filter(h => h.recessionStart == null && !h.ongoing).length,
  }

  // ── 곡선 모양
  const y = (yr: number) => curve.find(c => c.years === yr)!.v
  const s2v = y(10) - y(2), s3v = y(10) - y(0.25), belly = y(5) - y(2), longEnd = y(30) - y(10)
  let shape: YieldCurveResult['shape'], shapeNote: string
  if (s2v < 0 || s3v < 0) { shape = 'inverted'; shapeNote = '역전 — 짧은 돈이 긴 돈보다 비싸다. 시장이 앞으로 금리가 내려갈 것(=경기가 식을 것)으로 보고 있다는 뜻입니다.' }
  else if (s2v < FLAT_PP && s3v < FLAT_PP) { shape = 'flat'; shapeNote = '평탄 — 만기를 늘려도 이자를 더 주지 않습니다. 길게 묶는 대가가 사라진 상태로, 경기 후반에 잘 나타납니다.' }
  else if (belly < 0 && longEnd > 0) { shape = 'humped'; shapeNote = '중간 볼록 — 중기 구간만 눌린 형태로, 정책금리 인하 기대와 장기 인플레 우려가 동시에 반영된 모습입니다.' }
  else { shape = 'normal'; shapeNote = `정상·우상향 — 길게 맡길수록 이자를 더 줍니다(10년이 2년보다 +${s2v.toFixed(2)}%p). 은행이 예대마진을 벌기 좋은 환경입니다.` }
  if (longEnd >= 0.5) shapeNote += ` 특히 장기 구간이 가파릅니다(30년−10년 +${longEnd.toFixed(2)}%p) — 재정적자·국채 발행 부담이 장기 금리에 얹히고 있다는 신호로 읽힙니다.`

  const alertDetail =
    alert === 'red' ? `과거 지속 역전(10거래일+) 뒤 침체가 시작되기까지 ${leadSummary.medianMonths ?? '—'}개월(범위 ${leadSummary.minMonths ?? '—'}~${leadSummary.maxMonths ?? '—'}개월, 표본 ${leadSummary.n}건) 걸렸습니다. 다만 2022~24년 역전은 534일·최심 −1.89%p로 역사상 손꼽히게 깊었는데도 침체로 이어지지 않았습니다 — 방향 참고이지 타이밍 도구가 아닙니다.`
    : alert === 'brief' ? `아직 짧은 역전입니다. 과거에도 며칠짜리 얕은 역전은 흔했고 대부분 아무 일 없이 지나갔습니다(2025년에만 6건). ${RED_MIN_DAYS}거래일 이상 이어지면 경보 단계가 올라갑니다.`
    : alert === 'watch' ? '아직 역전은 아니지만 만기를 늘려 받는 이자가 얇아졌습니다. 곡선이 더 눌리는지 지켜보세요.'
    : '장단기 모두 정상 범위입니다.'

  const sahmLast = sahmArr[sahmArr.length - 1]
  const s2Map = new Map(s2Recent.map(o => [o.date, o.v]))
  const s3Map = new Map(s3mRecent.map(o => [o.date, o.v]))
  // ⚠️ Map 스프레드는 TS2802 (프로젝트 5회 재발) — Array.from 으로만
  const allDates = Array.from(new Set(Array.from(s2Map.keys()).concat(Array.from(s3Map.keys())))).sort().slice(-260)
  const series = allDates.map(d => ({ date: d, s2: s2Map.get(d) ?? null, s3m: s3Map.get(d) ?? null }))

  return {
    asOf: new Date().toISOString(),
    curveDate, curve, curvePrev, curvePrevDate: prevDate,
    shape, shapeNote, spreads, alert, alertHeadline, alertDetail,
    history, leadSummary,
    sahm: sahmLast ? { v: sahmLast.v, date: sahmLast.date, triggered: sahmLast.v >= 0.5 } : null,
    series,
  }
}
