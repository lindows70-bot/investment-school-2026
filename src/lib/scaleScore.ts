// 투자학교 저울 채점표 SSOT(순수 함수) — ③ 순풍·역풍 수업 원칙이 맞았나를 오늘부터 앞으로만 적립·채점(docs/scale/scoring-plan.md, 사용자 승인 2026-09-29)
//   적립: 하루 한 장(불변) · ③ 다섯 칸이 다 판정된 날만. 채점: 달마다 첫 적립일 = 진입(코호트) · 3개월 뒤 수익 · 순풍 평균 − 역풍 평균.
//   게이트: 서로 다른 달 10개 전엔 숫자를 내지 않는다. ⛔ 소급 금지 — 과거 가격에 오늘의 원칙을 매기지 않는다.
import { ASSET_SEASON_WIND, type AssetClass, type SeasonWind, type Quadrant } from './seasonNavigator'   // 상대 경로 — 검증 스크립트가 별칭 없이 컴파일

export const SCALE_HIST_KEY = 'scale-hist-v1'   // 날짜 없는 키 한 행(최근 HIST_CAP 장)
export const HIST_CAP = 600
export const HORIZON_MONTHS = 3
export const COHORT_GATE = 10
export const ASSETS: AssetClass[] = ['bond', 'stock', 'realestate', 'gold', 'coin']
const NAME: Record<AssetClass, string> = { bond: '채권', stock: '주식', realestate: '부동산', gold: '금', coin: '코인' }

/** 하루 한 장 — 그날의 칩(원칙 표가 나중에 바뀌어도 그날의 판정으로 채점한다) */
export interface ScaleSnap {
  d: string                                  // KST 'YYYY-MM-DD'
  wind: Record<AssetClass, SeasonWind>       // ③ 칩
  quad: { us: Quadrant; kr: Quadrant }
  stockChip: string | null                   // ② 기록만(채점 안 함)
  fng: number | null                         // ② 기록만
}

/** 오늘의 계절 → 스냅샷. 채권·주식·금·코인 = 미국 계절(대표 가격이 미국 자산), 부동산 = 한국 계절. 간절기·폴백이면 null(적지 않는다) */
export function snapOf(d: string, us: Quadrant, kr: Quadrant, seasonsValid: boolean, stockChip: string | null, fng: number | null): ScaleSnap | null {
  if (!seasonsValid || us === 'shoulder' || kr === 'shoulder') return null
  const wind = {} as Record<AssetClass, SeasonWind>
  for (const a of ASSETS) wind[a] = ASSET_SEASON_WIND[a === 'realestate' ? kr : us][a]
  return { d, wind, quad: { us, kr }, stockChip, fng }
}

/** 적립 — 같은 날짜가 이미 있으면 그대로(불변). 새 배열을 돌려주고, 바뀐 게 없으면 null */
export function addSnap(hist: ScaleSnap[], snap: ScaleSnap): ScaleSnap[] | null {
  if (hist.some(h => h.d === snap.d)) return null
  return [...hist, snap].sort((a, b) => a.d.localeCompare(b.d)).slice(-HIST_CAP)
}

// ── 채점 ──────────────────────────────────────────────────────────────────
/** 대표 가격 시계열 — 날짜 오름차순. 채권·주식 = 분배금 포함 수정주가(IEF·SPY), 금 = GC=F, 코인 = BTC-USD, 부동산 = KB 월간('YYYY-MM') */
export type Series = { dates: string[]; values: number[] }
export interface CohortScore {
  d: string; exit: string; quad: { us: Quadrant; kr: Quadrant }
  ret: Partial<Record<AssetClass, number>>   // 3개월 수익(소수)
  tail: AssetClass[]; head: AssetClass[]
  spread: number | null                       // 순풍 평균 − 역풍 평균(비교 불가면 null)
  vsBase: number | null                       // 순풍 평균 − 다섯 자산 평균
}
export interface ScaleScore {
  days: number; firstDay: string | null
  cohortsStarted: number                      // 진입한 달 수(성숙 안 한 것 포함)
  matured: number; comparable: number         // 3개월이 지난 달 · 그중 순풍·역풍이 둘 다 있던 달
  gateOpen: boolean; firstResultMonth: string | null   // 'YYYY-MM' — 데이터로 계산(하드코딩 아님)
  stats: null | {
    n: number; meanSpread: number; medianSpread: number; hits: number
    meanVsBase: number; trimmedMeanSpread: number | null
    topAsset: { asset: AssetClass; name: string; share: number } | null   // 차이의 절반 넘게 만든 자산
    seasons: string[]                                                       // 채점된 달에 나온 미국 계절들
  }
  cohorts: CohortScore[]
}

const addMonths = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + n, d)); return dt.toISOString().slice(0, 10) }
/** 날짜 d 이하 마지막 값(가격은 그날까지 알려진 종가) */
function atOrBefore(s: Series | undefined, d: string): { date: string; v: number } | null {
  if (!s) return null
  let lo = 0, hi = s.dates.length - 1, ans = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (s.dates[mid] <= d) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans >= 0 && s.values[ans] > 0 ? { date: s.dates[ans], v: s.values[ans] } : null
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** 한 자산의 진입~청산 수익. 월간(KB)은 달 단위로 — 진입 달의 지수 → 3개월 뒤 달의 지수(그 달 값이 아직 없으면 미성숙) */
function assetRet(a: AssetClass, s: Series | undefined, d: string, exit: string): number | null | 'pending' {
  if (!s) return null
  if (a === 'realestate') {
    const i0 = s.dates.indexOf(d.slice(0, 7)), i1 = s.dates.indexOf(exit.slice(0, 7))
    if (i0 < 0) return null
    if (i1 < 0) return 'pending'
    return s.values[i1] / s.values[i0] - 1
  }
  const p0 = atOrBefore(s, d), p1 = atOrBefore(s, exit)
  if (!p0 || !p1) return null
  if (p1.date < exit && s.dates[s.dates.length - 1] < exit) return 'pending'   // 청산일 가격이 아직 없다
  return p1.v / p0.v - 1
}

export function computeScaleScore(histRaw: ScaleSnap[], series: Partial<Record<AssetClass, Series>>, today: string): ScaleScore {
  const seen = new Set<string>()
  const hist = histRaw.filter(h => (seen.has(h.d) ? false : (seen.add(h.d), true))).sort((a, b) => a.d.localeCompare(b.d))
  // 달마다 첫 적립일만 진입(겹치는 창으로 표본이 부풀지 않게)
  const byMonth = new Map<string, ScaleSnap>()
  for (const h of hist) if (!byMonth.has(h.d.slice(0, 7))) byMonth.set(h.d.slice(0, 7), h)
  const entries = Array.from(byMonth.values())
  const cohorts: CohortScore[] = []
  for (const e of entries) {
    const exit = addMonths(e.d, HORIZON_MONTHS)
    if (exit > today) continue   // 아직 3개월이 안 지났다
    const ret: Partial<Record<AssetClass, number>> = {}
    let pending = false
    for (const a of ASSETS) { const r = assetRet(a, series[a], e.d, exit); if (r === 'pending') pending = true; else if (r != null) ret[a] = r }
    if (pending) continue
    const tail = ASSETS.filter(a => e.wind[a] === 'tail' && ret[a] != null)
    const head = ASSETS.filter(a => e.wind[a] === 'head' && ret[a] != null)
    const all = ASSETS.filter(a => ret[a] != null).map(a => ret[a]!)
    const tailAvg = tail.length ? avg(tail.map(a => ret[a]!)) : null
    const spread = tail.length && head.length ? tailAvg! - avg(head.map(a => ret[a]!)) : null
    cohorts.push({ d: e.d, exit, quad: e.quad, ret, tail, head, spread, vsBase: tailAvg != null && all.length ? tailAvg - avg(all) : null })
  }
  const comp = cohorts.filter(c => c.spread != null)
  const gateOpen = comp.length >= COHORT_GATE
  let stats: ScaleScore['stats'] = null
  if (gateOpen) {
    const sp = comp.map(c => c.spread!)
    // 자산별 기여 — 차이 = Σ(순풍 r/|T|) − Σ(역풍 r/|H|). 한 자산이 합의 절반을 넘으면 밝힌다(backtest-autopsy '최다 점유')
    const contrib: Partial<Record<AssetClass, number>> = {}
    for (const c of comp) {
      for (const a of c.tail) contrib[a] = (contrib[a] ?? 0) + c.ret[a]! / c.tail.length
      for (const a of c.head) contrib[a] = (contrib[a] ?? 0) - c.ret[a]! / c.head.length
    }
    const total = sp.reduce((a, b) => a + b, 0)
    const top = (Object.entries(contrib) as [AssetClass, number][]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0]
    const share = top && total !== 0 ? top[1] / total : 0
    const maxI = sp.reduce((bi, v, i) => (Math.abs(v) > Math.abs(sp[bi]) ? i : bi), 0)
    const trimmed = sp.filter((_, i) => i !== maxI)
    stats = {
      n: comp.length, meanSpread: avg(sp), medianSpread: median(sp), hits: sp.filter(v => v > 0).length,
      meanVsBase: avg(comp.filter(c => c.vsBase != null).map(c => c.vsBase!)),
      trimmedMeanSpread: trimmed.length ? avg(trimmed) : null,
      topAsset: top && share > 0.5 ? { asset: top[0], name: NAME[top[0]], share } : null,
      seasons: Array.from(new Set(comp.map(c => c.quad.us))),
    }
  }
  // 첫 성적 예상 달 — 첫 진입 달 + (게이트−1)개월 = 10번째 진입 달, 그 3개월 뒤(비교 불가 달이 끼면 더 늦어진다 — 화면이 '쯤'이라고 쓴다)
  const first = entries[0]?.d ?? null
  const firstResultMonth = first ? addMonths(`${first.slice(0, 7)}-01`, COHORT_GATE - 1 + HORIZON_MONTHS).slice(0, 7) : null
  return { days: hist.length, firstDay: first, cohortsStarted: entries.length, matured: cohorts.length, comparable: comp.length, gateOpen, firstResultMonth, stats, cohorts }
}
