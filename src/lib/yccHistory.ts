// 🎛️ 일드커브 컨트롤(YCC) SSOT — 개념 설명 + 일본 실사례 데이터 + 미국의 '사실상 YCC' 논쟁
//   ⚠️ 서술은 정적 참조(정책 사실)지만 **숫자는 전부 FRED 실데이터**다(제1원칙).
//      일본 10년물: IRLTLT01JPM156N (1989~ 월별, Phase 0 실측 확인)
//   YCC 는 중앙은행이 "장기 금리를 이 선 위로 못 올라가게 하겠다"고 선언하고 무제한 매입으로 방어하는 정책이다.

const FRED = 'https://api.stlouisfed.org/fred/series/observations'

async function fredSeries(series: string, startISO: string): Promise<{ date: string; v: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`${FRED}?series_id=${series}&api_key=${key}&file_type=json&observation_start=${startISO}`,
      { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) }))
      .filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}

/** YCC 역사의 분기점 — 정책 사실(정적 참조). 각 시점의 금리는 아래에서 실데이터로 채운다. */
export interface YccMilestone {
  date: string          // YYYY-MM
  title: string
  body: string
  /** 그 시점 일본 10년물 실측치(%) — 데이터에서 채움 */
  jgb10: number | null
}

const MILESTONES: Omit<YccMilestone, 'jgb10'>[] = [
  { date: '2016-09', title: 'YCC 도입', body: '일본은행이 세계 최초로 장기금리를 목표로 삼았습니다. 10년물을 "0% 근처"로 묶고, 넘으면 무제한으로 사들이겠다고 선언했습니다.' },
  { date: '2021-03', title: '허용 밴드 ±0.25%', body: '완전히 0으로 고정하면 채권 시장이 죽어버려, 위아래로 움직일 여지를 공식화했습니다.' },
  { date: '2022-12', title: '밴드 ±0.50%로 확대', body: '미국이 급격히 금리를 올리자 엔화가 폭락했습니다. 방어 비용이 커지자 상단을 열었고, 시장은 이를 "출구의 시작"으로 읽었습니다.' },
  { date: '2023-07', title: '±0.50%를 "참고치"로 완화', body: '사실상 1.0%까지 용인. 억눌렀던 금리가 튀어오르기 시작했습니다.' },
  { date: '2024-03', title: 'YCC 종료 · 마이너스 금리 해제', body: '7년 반 만에 장기금리 통제를 놓았습니다. 이후 일본 10년물은 자유롭게 상승했습니다.' },
]

export interface YccResult {
  milestones: YccMilestone[]
  /** 일본 10년물 월별 시계열(2013~) — 억눌린 구간과 풀린 뒤가 한눈에 보이게 */
  jgb: { date: string; v: number }[]
  latest: { date: string; v: number } | null
  /** YCC 기간 중 평균 vs 종료 후 평균 — 통제의 효과를 숫자로 */
  duringAvg: number | null
  afterAvg: number | null
  /** 미국 장기금리(비교축) */
  us30: { date: string; v: number } | null
  us10: { date: string; v: number } | null
  /** 💵 미국 연방정부 총부채 — YCC 논의의 출발점(부채가 커질수록 금리를 눌러야 할 유인이 커진다).
   *  재무부 Fiscal Data API(일별·키 불필요). 서술만 하던 것을 실데이터로 바꾼다(제1원칙). */
  usDebt: { date: string; total: number; yoyPct: number | null } | null
}

/** 미국 총부채(일별) — 재무부 공식. FRED GFDEBTN 은 분기라 최신성이 떨어져 이쪽을 쓴다. */
async function fetchUsDebt(): Promise<YccResult['usDebt']> {
  const get = async (params: string) => {
    const r = await fetch(`https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?${params}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json())?.data?.[0] ?? null
  }
  try {
    const latest = await get('sort=-record_date&page[size]=1')
    if (!latest?.record_date) return null
    const total = Number(latest.tot_pub_debt_out_amt)
    // 상식 검산 — 미국 총부채가 10조 미만이거나 200조 초과면 파싱이 틀린 것이다
    if (!isFinite(total) || total < 10e12 || total > 200e12) return null
    const y = new Date(new Date(latest.record_date).getTime() - 365 * 864e5).toISOString().slice(0, 10)
    const prior = await get(`filter=record_date:lte:${y}&sort=-record_date&page[size]=1`)
    const pv = prior ? Number(prior.tot_pub_debt_out_amt) : NaN
    return {
      date: String(latest.record_date).slice(0, 10),
      total,
      yoyPct: isFinite(pv) && pv > 0 ? Math.round((total / pv - 1) * 1000) / 10 : null,
    }
  } catch { return null }
}

const avg = (a: number[]) => a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 100) / 100 : null

export async function buildJapanYcc(): Promise<YccResult | null> {
  const [jgbRaw, us30Raw, us10Raw, usDebt] = await Promise.all([
    fredSeries('IRLTLT01JPM156N', '2013-01-01'),
    fredSeries('DGS30', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
    fredSeries('DGS10', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
    fetchUsDebt(),
  ])
  if (jgbRaw.length < 24) return null

  const jgb = jgbRaw.map(o => ({ date: o.date.slice(0, 7), v: o.v }))
  const YCC_START = '2016-09', YCC_END = '2024-03'
  const during = jgb.filter(o => o.date >= YCC_START && o.date <= YCC_END).map(o => o.v)
  const after = jgb.filter(o => o.date > YCC_END).map(o => o.v)

  const milestones: YccMilestone[] = MILESTONES.map(m => {
    // 해당 월(없으면 그 이하 최신)의 실측치
    const hit = jgb.filter(o => o.date <= m.date).pop()
    return { ...m, jgb10: hit?.v ?? null }
  })

  return {
    milestones, jgb,
    latest: jgb.length ? { date: jgb[jgb.length - 1].date, v: jgb[jgb.length - 1].v } : null,
    duringAvg: avg(during), afterAvg: avg(after),
    us30: us30Raw.length ? { date: us30Raw[us30Raw.length - 1].date, v: us30Raw[us30Raw.length - 1].v } : null,
    us10: us10Raw.length ? { date: us10Raw[us10Raw.length - 1].date, v: us10Raw[us10Raw.length - 1].v } : null,
    usDebt,
  }
}
