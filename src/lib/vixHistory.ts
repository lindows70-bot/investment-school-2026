// VIX(미국 변동성 지수) 긴 이력 — "지금 공포가 과거에 견줘 어느 자리인가"를 눈으로 보게(위기 신호등 상세의 VIX 차트 · 2026-11-22 사용자 요청)
//   원천 = FRED VIXCLS(CBOE 종가 · 1990-01-02~ · 일별) + 야후 ^VIX 최근 한 달(FRED 는 하루 늦다 — 그 뒤 날짜만 잇는다)
//   2026-11-22 실측: FRED 9,321일(결측 302일 '.' 제외) · 마지막 11-19 28.44 = 야후 같은 날 28.44 · 야후 11-20 35.89 = CNN 응답의 vix 와 같음
//   ⚠️ 야후 range=max 는 일봉이 아니라 달봉(443점)이라 긴 이력은 FRED 로만 받는다
import { fredObservations } from '@/lib/fred'

export const VIX_HISTORY_KEY = 'vix-history-v2'   // v2: analog(비슷했던 날 2주 뒤) · 날짜 없는 키 — 신선도는 TTL 로
/** 차트 기간 — 1년 = 하루 종가 · 5년 = 주마다 가장 높았던 날 · 1990년부터 = 달마다 가장 높았던 날(급등이 평균에 묻히지 않게) */
export type VixRange = '1Y' | '5Y' | 'ALL'

export interface VixDay { date: string; v: number }
export interface VixHistory {
  asOf: string
  last: VixDay
  since: string                      // 이력 첫날
  days: number                       // 하루 종가 개수
  higherPct: number                  // 지금보다 높거나 같았던 날의 비율(%)
  median: number
  peaks: VixDay[]                    // 해마다 가장 높았던 날 중 큰 순 3개(서로 다른 해)
  series: Record<VixRange, VixDay[]>
  analog: VixAnalog | null           // 지금과 비슷했던 날 2주(10거래일) 뒤 — 영상의 "VIX 36 근처면 2주 뒤 30 아래가 더 많았다"를 우리 자료로
  sources: string
}

/** 지금과 비슷했던 날(±band) horizon 거래일 뒤 — 이어진 날은 서로 독립이 아니라 '서로 다른 일'(horizon 넘게 떨어진 묶음) 수를 함께 센다
 *  2026-11-22 재현: 34~38 로 마감한 날 141일 → 10거래일 뒤 30 아래 42번 · 40 위 14번(영상 숫자와 같음) · 그런데 서로 다른 일은 29번 */
export interface VixAnalog { band: number; horizon: number; n: number; episodes: number; lowerPct: number; median: number }
export function vixAnalogOf(days: VixDay[], band = 2, horizon = 10): VixAnalog | null {
  if (days.length < horizon + 2) return null
  const cur = days[days.length - 1].v
  const idx: number[] = []
  for (let i = 0; i + horizon < days.length; i++) if (Math.abs(days[i].v - cur) <= band) idx.push(i)
  if (!idx.length) return null
  const after = idx.map(i => days[i + horizon].v).sort((a, b) => a - b)
  const n = idx.length
  return {
    band, horizon, n,
    episodes: idx.filter((i, k) => k === 0 || i - idx[k - 1] > horizon).length,
    lowerPct: Math.round(idx.filter(i => days[i + horizon].v < days[i].v).length / n * 1000) / 10,
    median: Math.round((n % 2 ? after[(n - 1) / 2] : (after[n / 2 - 1] + after[n / 2]) / 2) * 100) / 100,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** 날짜 묶음마다 가장 높았던 날 하나 — key 가 같은 날끼리 묶는다(순서 유지) */
function maxBy(days: VixDay[], key: (d: VixDay) => string): VixDay[] {
  const out = new Map<string, VixDay>()
  for (const d of days) { const k = key(d), m = out.get(k); if (!m || d.v > m.v) out.set(k, d) }
  return Array.from(out.values())
}
/** 'YYYY-MM-DD' → 그 주 월요일(UTC) — 주 단위 묶음 키 */
const weekKey = (ymd: string) => { const t = Date.parse(`${ymd}T00:00:00Z`); const dow = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - dow * 86_400_000).toISOString().slice(0, 10) }

/** 순수 계산 — 하루 종가 목록(오름차순·중복 없음)에서 자리·가운데 값·큰 날·차트 세 벌을 만든다 */
export function vixHistoryOf(raw: VixDay[], nowIso: string = new Date().toISOString(), sources = ''): VixHistory | null {
  const days = raw.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(d.v) && d.v > 0).sort((a, b) => a.date < b.date ? -1 : 1)
  // VIX 는 1990년 이후 9 아래로 내려간 적도 90 위로 올라간 적도 없다 — 밖이면 단위·열 사고
  if (days.length < 1000 || days.some(d => d.v < 5 || d.v > 150)) return null
  const last = days[days.length - 1]
  const sorted = days.map(d => d.v).sort((a, b) => a - b)
  const n = sorted.length
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const higher = days.filter(d => d.v >= last.v).length
  const yearly = maxBy(days, d => d.date.slice(0, 4)).sort((a, b) => b.v - a.v).slice(0, 3)
  const lastT = Date.parse(`${last.date}T00:00:00Z`)
  const after = (years: number) => new Date(lastT - years * 365.25 * 86_400_000).toISOString().slice(0, 10)
  return {
    asOf: nowIso, last, since: days[0].date, days: n,
    higherPct: Math.round(higher / n * 1000) / 10,
    median: round2(median),
    peaks: yearly,
    series: {
      '1Y': days.filter(d => d.date > after(1)),
      '5Y': maxBy(days.filter(d => d.date > after(5)), d => weekKey(d.date)),
      ALL: maxBy(days, d => d.date.slice(0, 7)),
    },
    analog: vixAnalogOf(days),
    sources,
  }
}

/** FRED 이력 뒤에 야후 최근 날짜를 잇는다 — 겹치는 날 값이 다르면(0.05 넘게) 야후를 쓰지 않는다(다른 것을 재고 있다는 뜻) */
export function joinVix(fred: VixDay[], recent: VixDay[]): { days: VixDay[]; added: number } {
  if (!fred.length) return { days: [], added: 0 }
  const lastFred = fred[fred.length - 1].date
  const byDate = new Map(fred.map(d => [d.date, d.v]))
  const overlap = recent.filter(r => byDate.has(r.date))
  if (overlap.some(r => Math.abs((byDate.get(r.date) as number) - r.v) > 0.05)) return { days: fred, added: 0 }
  const extra = recent.filter(r => r.date > lastFred).sort((a, b) => a.date < b.date ? -1 : 1)
  return { days: [...fred, ...extra], added: extra.length }
}

const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
const NY_HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })

/** 뉴욕 오늘 장(종가 16:15 · 15분 여유)이 끝나기 전이면 오늘 날짜 봉은 진행 중이다 — 순수 함수라 단위 검사가 그대로 부른다 */
export function dropOpenDay(rows: VixDay[], nowMs: number = Date.now()): VixDay[] {
  const today = NY_DATE.format(new Date(nowMs))
  const hm = NY_HM.format(new Date(nowMs)).replace(/^24/, '00')
  return hm < '16:30' ? rows.filter(r => r.date !== today) : rows
}

/** 야후 ^VIX 최근 한 달 하루 종가(뉴욕 날짜) — 진행 중인 오늘 봉은 뺀다. 실패 = 빈 배열 */
async function yahooRecent(): Promise<VixDay[]> {
  try {
    const r = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1mo&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const res = (await r.json())?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? [], close: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
    const rows = ts.flatMap((t, i) => { const v = close[i]; return typeof v === 'number' && Number.isFinite(v) ? [{ date: NY_DATE.format(new Date(t * 1000)), v: round2(v) }] : [] })
    return dropOpenDay(rows)
  } catch { return [] }
}

/** 수집 + 계산(캐시는 부르는 라우트가 맡는다). FRED 가 비면 null — 짧은 야후 자료만으로 '1990년부터의 자리'를 말하지 않는다 */
export async function fetchVixHistory(): Promise<VixHistory | null> {
  const [fred, recent] = await Promise.all([
    fredObservations('VIXCLS', { observation_start: '1990-01-01' }, { timeoutMs: 20_000 }).catch(() => []),
    yahooRecent(),
  ])
  const { days, added } = joinVix(fred.map(o => ({ date: o.date, v: o.v })), recent)
  return vixHistoryOf(days, new Date().toISOString(), added ? `FRED VIXCLS(CBOE 종가) · 최근 ${added}일은 야후 ^VIX` : 'FRED VIXCLS(CBOE 종가)')
}
