// 📋 미국 스마트머니 성적 적립 SSOT — 내부자 클러스터·애널리스트 리레이팅이 **목록에 오른 날부터** 성적을 쌓는다.
//    스윙과 같은 관례(swingHistory): ⛔ 소급 금지 · 진입가 = 등재일 **완성 종가** · 표본 10건·2주 미만이면 숫자를 말하지 않는다.
//    ⚠️ 이 화면은 '추천'이 아니라 출발점이지만, 목록을 보여주는 이상 학생은 추천으로 읽는다 — 그러면 성적도 함께 보여야 정직하다.
//    ⛔ 매도 신호가 없으므로 손절 채점도 없다. 시장(SPY) 같은 기간 수익률을 함께 재서 **초과분**을 본다.
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles, dropIncompleteBar } from '@/lib/techChartData'

export const USM_HIST_KEY = 'usm-history-v1'
export const USM_GRADE_KEY = (kst: string) => `usm-grade-v1:${kst}`
/** 채점 구간(거래일) — 내부자 매수는 6~12개월 우위가 보고된 지표라 짧은 구간은 참고용이라고 화면에 적는다 */
export const USM_HORIZONS = [20, 60] as const
export const USM_MIN_SAMPLE = 10
export const USM_MIN_COHORTS = 2

export type UsmSource = 'insider' | 'rerating'
export interface UsmHistEntry {
  date: string          // 등재일(미국 거래일 = 판정 기준 봉 날짜)
  src: UsmSource
  ticker: string
  name: string
  entry: number         // 등재일 완성 종가
  note: string          // 왜 올랐나(클러스터 N명 / 상향 N곳) — 나중에 읽을 때 기준이 보이게
}
export interface UsmGrade {
  src: UsmSource | 'all'
  bars: number
  n: number; pending: number; cohorts: number
  winRate: number | null; avgPct: number | null; medPct: number | null
  benchAvgPct: number | null; edgePp: number | null    // SPY 같은 기간 평균과의 차이
  thin: boolean
  firstDate: string | null
}

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null }
const avg = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const r1 = (n: number | null) => n == null ? null : Math.round(n * 10) / 10
/** 그 날짜가 속한 주(월요일 기준) — 시점 분산용(스윙과 같은 관례) */
function weekKey(d: string): string { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10) }

/** 오늘 목록에 오른 종목을 적립한다. 같은 종목·같은 출처가 90일 안에 다시 담기지 않게 — 한 자리를 두 번 세지 않는다.
 *  🕯️ 진입가·진입일은 호출부가 주는 현재가를 쓰지 않고 **완성 봉**에서 직접 뽑는다(2026-09-11 스윙 사고: 장중가로 채점하면
 *     학생이 재현할 수 없는 가격이 된다). 중복 제거를 먼저 해서 새 종목에만 캔들을 부른다(호출 절약). */
export async function appendUsmHistory(rows: { src: UsmSource; ticker: string; name: string; note: string }[]): Promise<number> {
  const hist = (await getCache<UsmHistEntry[]>(USM_HIST_KEY, 800 * 86400_000)) ?? []
  const today = new Date().toISOString().slice(0, 10)
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000)
  const cands = rows.filter(r => !hist.some(h => h.src === r.src && h.ticker === r.ticker && Math.abs(dayDiff(h.date, today)) < 90))
  const fresh: UsmHistEntry[] = []
  for (const r of cands) {
    if (fresh.some(f => f.src === r.src && f.ticker === r.ticker)) continue
    try {
      const D = dropIncompleteBar(await getTechCandles(r.ticker, 'US', 'D'), 'US')
      const last = D[D.length - 1]
      if (!last || !(last.close > 0)) continue
      // ⛔ 소급 금지 — 캔들이 낡은 종목(거래정지·상장폐지·조회 이상)은 마지막 봉이 몇 달 전이라, 그 날짜로 적립하면
      //    **이미 결과를 아는 과거**를 진입일로 삼게 된다(실측 2026-09-22: GREE 의 마지막 봉이 07-23).
      if (dayDiff(String(last.date).slice(0, 10), today) > 5) continue
      // 소수 잡음 제거($6.900000095367432) — 1달러 미만은 4자리, 그 위는 2자리
      const entry = last.close < 1 ? Math.round(last.close * 10000) / 10000 : Math.round(last.close * 100) / 100
      fresh.push({ date: String(last.date).slice(0, 10), src: r.src, ticker: r.ticker, name: r.name, entry, note: r.note })
    } catch { /* 캔들 실패 — 적립하지 않는다(가격 없는 기록은 채점 불가) */ }
  }
  if (fresh.length) await setCache(USM_HIST_KEY, [...hist, ...fresh].slice(-3000))
  return fresh.length
}

/** 채점 — 등재일 이후 bars 거래일이 지난 건만. 미경과분은 pending 으로 정직하게 남는다. */
export async function gradeUsm(): Promise<{ grades: UsmGrade[]; recent: (UsmHistEntry & { retPct: number | null; benchPct: number | null })[] }> {
  const hist = (await getCache<UsmHistEntry[]>(USM_HIST_KEY, 800 * 86400_000)) ?? []
  if (!hist.length) return { grades: [], recent: [] }
  const spy = dropIncompleteBar(await getTechCandles('SPY', 'US', 'D').catch(() => []), 'US')
  const fwd = (D: { date: string; close: number }[], from: string, bars: number): number | null => {
    const i = D.findIndex(d => String(d.date).slice(0, 10) >= from)
    if (i < 0 || i + bars >= D.length) return null
    return (D[i + bars].close / D[i].close - 1) * 100
  }
  type Row = { e: UsmHistEntry; ret: Record<number, number | null>; bench: Record<number, number | null>; last: number | null }
  const rows: Row[] = []
  for (const e of hist) {
    let D: { date: string; close: number }[] = []
    try { D = dropIncompleteBar(await getTechCandles(e.ticker, 'US', 'D'), 'US') } catch { /* 조회 실패 — 이 건은 채점에서 빠진다 */ }
    const ret: Record<number, number | null> = {}, bench: Record<number, number | null> = {}
    for (const b of USM_HORIZONS) { ret[b] = D.length ? fwd(D, e.date, b) : null; bench[b] = spy.length ? fwd(spy, e.date, b) : null }
    // '지금 수익률'은 하루라도 지난 뒤에만 — 등재 당일은 진입가와 같은 봉이라 0% 가 나와 성과처럼 읽힌다
    const li = D.findIndex(d => String(d.date).slice(0, 10) >= e.date)
    const elapsed = li >= 0 ? D.length - 1 - li : -1
    const lastClose = elapsed > 0 ? D[D.length - 1].close : null
    rows.push({ e, ret, bench, last: lastClose != null ? (lastClose / e.entry - 1) * 100 : null })
  }
  const grades: UsmGrade[] = []
  for (const src of ['insider', 'rerating', 'all'] as const) {
    for (const bars of USM_HORIZONS) {
      const xs = rows.filter(r => src === 'all' || r.e.src === src)
      const done = xs.filter(r => r.ret[bars] != null)
      const rs = done.map(r => r.ret[bars]!) , bs = done.map(r => r.bench[bars]).filter((v): v is number => v != null)
      const cohorts = new Set(done.map(r => weekKey(r.e.date))).size
      const a = avg(rs), ba = avg(bs)
      grades.push({
        src, bars, n: done.length, pending: xs.length - done.length, cohorts,
        winRate: rs.length ? r1(rs.filter(v => v > 0).length / rs.length * 100) : null,
        avgPct: r1(a), medPct: r1(med(rs)), benchAvgPct: r1(ba),
        edgePp: a != null && ba != null ? r1(a - ba) : null,
        thin: done.length < USM_MIN_SAMPLE || cohorts < USM_MIN_COHORTS,
        firstDate: xs.length ? xs.map(r => r.e.date).sort()[0] : null,
      })
    }
  }
  const recent = rows.slice(-12).reverse().map(r => ({ ...r.e, retPct: r1(r.last), benchPct: r1(r.bench[20] ?? null) }))
  return { grades, recent }
}
