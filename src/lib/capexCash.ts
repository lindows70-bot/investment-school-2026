// 빅테크 하이퍼스케일러의 '번 돈 대비 설비투자' — 최근 분기 영업현금흐름과 설비투자로 "번 돈으로 짓나, 빌려서 짓나"를 잰다(위기 신호등 설비투자 등)
//   원천 = 야후 재무 시계열(quarterlyCapitalExpenditure · quarterlyOperatingCashFlow). 2026-11-21 실측: 2026-09 분기 값이 각 회사 10-Q 숫자와 일치
//   (아마존 42,422/77,259 · 알파벳 42,290/51,355 · 메타 32,785/33,942 · 마이크로소프트 58,000/39,367 백만 달러 — docs/crisis-signal/context-notes.md)
//   ⚠️ 야후는 분기를 빼먹는다(아마존 2026-06 없음) — 1년 전 분기는 인덱스가 아니라 날짜로 찾는다

/** AI 인프라 설비투자를 끌고 가는 하이퍼스케일러(클라우드 4강 + 오라클) — 주글라르 파동 추적기와 같은 목록 */
export const HYPERSCALERS: { ticker: string; name: string }[] = [
  { ticker: 'AMZN', name: 'Amazon(AWS)' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'ORCL', name: 'Oracle' },
]

export const CAPEX_CASH_KEY = 'capex-cash-v1'   // 날짜 없는 키 — 신선도는 TTL 로
/** 색을 가르는 선 — 100% = 번 돈보다 더 쓴다(모자란 돈은 빌린다) · 50% = 번 돈의 절반. 이 앱이 정한 선이다 */
export const CAPEX_RED_PCT = 100
export const CAPEX_YELLOW_PCT = 50
/** 가장 새 분기보다 이만큼 넘게 늦은 회사는 합계에서 뺀다(회계 분기 끝이 달라도 한 분기 안쪽) */
const MAX_LAG_DAYS = 125
/** '1년 전 같은 분기'로 인정하는 날짜 오차 */
const YEAR_TOL_DAYS = 20

export interface QuarterRow { date: string; ocfM: number; capexM: number }   // 백만 달러 · 설비투자는 양수
export interface CapexCashCompany {
  ticker: string; name: string
  date: string
  ocfM: number; capexM: number
  ratioPct: number | null            // 번 돈이 0 이하면 비율을 세지 않는다
  prevDate: string | null
  prevRatioPct: number | null
}
export interface CapexCash {
  asOf: string
  latestDate: string                 // 합계에 든 회사 중 가장 새 분기 끝
  companies: CapexCashCompany[]
  count: number                      // 합계에 든 회사 수
  total: number                      // 목록 전체 수
  ocfM: number; capexM: number
  ratioPct: number
  /** 1년 전 같은 분기 — 그 분기 자료가 있는 회사만으로 다시 합친다(count 로 밝힌다) */
  prev: { ratioPct: number; count: number } | null
}

const DAY = 86_400_000
const ms = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`)
const round1 = (n: number) => Math.round(n * 10) / 10

/** 순수 계산 — 회사별 분기 줄을 받아 합계 비율을 만든다. 쓸 회사가 없으면 null */
export function capexCashOf(input: { ticker: string; name: string; rows: QuarterRow[] }[], nowIso: string = new Date().toISOString()): CapexCash | null {
  const latestOf = input
    .map(c => {
      const rows = c.rows.filter(r => Number.isFinite(r.ocfM) && Number.isFinite(r.capexM) && /^\d{4}-\d{2}-\d{2}$/.test(r.date)).sort((a, b) => a.date < b.date ? -1 : 1)
      return rows.length ? { ...c, rows, last: rows[rows.length - 1] } : null
    })
    .filter((c): c is NonNullable<typeof c> => c != null)
  if (!latestOf.length) return null
  const newest = latestOf.reduce((m, c) => c.last.date > m ? c.last.date : m, latestOf[0].last.date)
  const kept = latestOf.filter(c => ms(newest) - ms(c.last.date) <= MAX_LAG_DAYS * DAY)

  const companies: CapexCashCompany[] = kept.map(c => {
    const target = ms(c.last.date) - 365 * DAY
    const prev = c.rows.filter(r => Math.abs(ms(r.date) - target) <= YEAR_TOL_DAYS * DAY).pop() ?? null
    return {
      ticker: c.ticker, name: c.name, date: c.last.date,
      ocfM: Math.round(c.last.ocfM), capexM: Math.round(c.last.capexM),
      ratioPct: c.last.ocfM > 0 ? round1(c.last.capexM / c.last.ocfM * 100) : null,
      prevDate: prev?.date ?? null,
      prevRatioPct: prev && prev.ocfM > 0 ? round1(prev.capexM / prev.ocfM * 100) : null,
    }
  })
  const ocfM = companies.reduce((s, c) => s + c.ocfM, 0)
  const capexM = companies.reduce((s, c) => s + c.capexM, 0)
  if (!(ocfM > 0)) return null
  const ratioPct = round1(capexM / ocfM * 100)
  // 상식 범위 밖이면 단위·통화 사고일 가능성이 높다 — 틀린 값은 없는 값보다 나쁘다
  if (!(ratioPct > 0 && ratioPct < 500)) return null

  const prevRows = kept
    .map(c => { const target = ms(c.last.date) - 365 * DAY; return c.rows.filter(r => Math.abs(ms(r.date) - target) <= YEAR_TOL_DAYS * DAY).pop() ?? null })
    .filter((r): r is QuarterRow => r != null)
  const pOcf = prevRows.reduce((s, r) => s + r.ocfM, 0), pCapex = prevRows.reduce((s, r) => s + r.capexM, 0)
  const prev = prevRows.length && pOcf > 0 ? { ratioPct: round1(pCapex / pOcf * 100), count: prevRows.length } : null

  return { asOf: nowIso, latestDate: newest, companies, count: companies.length, total: input.length, ocfM, capexM, ratioPct, prev }
}

/** 한 회사의 분기 영업현금흐름·설비투자(최근 3년) — 두 계열을 분기 끝 날짜로 맞춘다. 실패 = 빈 배열 */
async function fetchQuarterly(ticker: string): Promise<QuarterRow[]> {
  const now = Math.floor(Date.now() / 1000), p1 = now - 3 * 365 * 86400
  type Obs = { asOfDate?: string; reportedValue?: { raw?: number } }
  for (const host of ['query2', 'query1']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}?type=quarterlyCapitalExpenditure,quarterlyOperatingCashFlow&period1=${p1}&period2=${now}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const j = await r.json()
      const results: Record<string, unknown>[] = j?.timeseries?.result ?? []
      const pick = (type: string): Map<string, number> => {
        const res = results.find(x => Array.isArray((x as { meta?: { type?: string[] } }).meta?.type) && (x as { meta: { type: string[] } }).meta.type[0] === type)
        const arr = (res?.[type] as Obs[] | undefined) ?? []
        return new Map(arr.filter(o => typeof o?.asOfDate === 'string' && typeof o?.reportedValue?.raw === 'number').map(o => [o.asOfDate as string, o.reportedValue!.raw as number]))
      }
      const capex = pick('quarterlyCapitalExpenditure'), ocf = pick('quarterlyOperatingCashFlow')
      const rows = Array.from(ocf.entries())
        .filter(([d]) => capex.has(d))
        .map(([d, o]) => ({ date: d, ocfM: o / 1e6, capexM: Math.abs(capex.get(d) as number) / 1e6 }))
      if (rows.length) return rows
    } catch { /* 다음 host */ }
  }
  return []
}

/** 목록 전체를 수집해 합친다(캐시는 부르는 라우트가 맡는다 — 이 lib 는 DB 를 모른다 · 단위 검사가 그대로 불러 쓴다) */
export async function fetchCapexCash(): Promise<CapexCash | null> {
  const series = await Promise.all(HYPERSCALERS.map(async h => ({ ...h, rows: await fetchQuarterly(h.ticker) })))
  return capexCashOf(series)
}
