// 📋 스윙 성적 적립 SSOT — "앱이 추천한 스윙 종목이 실제로 맞았나"를 전향적으로 채점
//
// ⚠️ 축별 성적(axisHistory)에서 얻은 교훈을 그대로 적용한다:
//  ① **표본이 늘어나는 경로**를 먼저 설계한다 — 거기서는 종목당 1건만 세다 이틀 만에 신규 0종이 됐다.
//     여기는 신호 자체가 드물어(647종에 1~2건) 같은 종목이 연달아 나올 일이 없지만,
//     그래도 **같은 종목·같은 트랙은 보유 기간 안에 다시 담지 않는다**(한 자리를 두 번 세지 않기 위해).
//  ② **시점 분산**을 함께 본다 — 전부 같은 주에 진입한 성적은 신호가 아니라 그 주의 장세다.
//  ③ 표본이 얇으면 수치 대신 '적립 중'이라고 말한다(⛔ 가짜 정밀).
//
// ⛔ 소급 채점 금지 — 오늘부터 쌓는다. 과거를 소급하면 "지금 규칙으로 과거를 고른" 셈이 되어 성적이 부풀려진다.
export const SWING_HIST_KEY = 'swing-history-v1'

export interface SwingHistEntry {
  date: string                     // 추천일(KST)
  ticker: string; name: string
  market: 'KR' | 'US'
  track: 'reversion' | 'trend'
  entry: number                    // 추천일 종가
  stop: number                     // 그날 제시한 손절선
  holdBars: number                 // 그 트랙의 보유 기간(거래일)
}

export interface SwingGrade {
  track: 'reversion' | 'trend' | 'all'
  n: number                        // 채점 완료(보유 기간 경과) 건수
  pending: number                  // 적립됐지만 아직 기간 미경과
  cohorts: number                  // 서로 다른 진입 '주(週)' 수 — 1이면 그 주의 장세일 수 있다
  winRate: number | null
  avgPct: number | null            // 평균 수익률(보유 기간 종료 시점 기준)
  medPct: number | null
  stopHitRate: number | null       // 보유 중 손절선을 건드린 비율
  thin: boolean                    // 표본이 얇거나 시점이 하나뿐
  firstDate: string | null
}

/** 채점 최소 표본 — 10건 미만은 통계가 아니라 일화(앱 공통 원칙). 시점도 2주 이상 갈려야 한다. */
export const SWING_MIN_SAMPLE = 10
export const SWING_MIN_COHORTS = 2

const iso = (d: string) => d.slice(0, 10)
/** 그 날짜가 속한 주(월요일 기준) — 시점 분산용 */
function weekKey(date: string): string {
  const d = new Date(`${iso(date)}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7          // 월=0
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

/** 같은 종목·같은 트랙이 보유 기간 안에 다시 담기지 않게 — 한 자리를 두 번 세지 않는다 */
export function shouldAppend(hist: SwingHistEntry[], e: SwingHistEntry, dayDiff: (a: string, b: string) => number): boolean {
  return !hist.some(h =>
    h.ticker === e.ticker && h.track === e.track && dayDiff(h.date, e.date) < h.holdBars * 1.6)
}

export interface ScoredRow { entry: SwingHistEntry; retPct: number | null; stopHit: boolean }

/** 📊 채점 — 보유 기간이 지난 건만 센다. 미경과분은 pending 으로 정직하게 남긴다. */
export function gradeSwing(rows: ScoredRow[], track: SwingGrade['track'] = 'all'): SwingGrade {
  const mine = track === 'all' ? rows : rows.filter(r => r.entry.track === track)
  const done = mine.filter(r => r.retPct != null) as { entry: SwingHistEntry; retPct: number; stopHit: boolean }[]
  const pending = mine.length - done.length
  const cohorts = new Set(done.map(r => weekKey(r.entry.date))).size
  const firstDate = mine.length ? mine.reduce((m, r) => (r.entry.date < m ? r.entry.date : m), mine[0].entry.date) : null
  if (!done.length) {
    return { track, n: 0, pending, cohorts, winRate: null, avgPct: null, medPct: null, stopHitRate: null, thin: true, firstDate }
  }
  const rets = done.map(r => r.retPct).sort((a, b) => a - b)
  const r1 = (x: number) => Math.round(x * 10) / 10
  const mid = rets.length % 2 ? rets[(rets.length - 1) / 2] : (rets[rets.length / 2 - 1] + rets[rets.length / 2]) / 2
  return {
    track,
    n: done.length,
    pending,
    cohorts,
    winRate: Math.round(done.filter(r => r.retPct > 0).length / done.length * 100),
    avgPct: r1(rets.reduce((s, x) => s + x, 0) / rets.length),
    medPct: r1(mid),
    stopHitRate: Math.round(done.filter(r => r.stopHit).length / done.length * 100),
    thin: done.length < SWING_MIN_SAMPLE || cohorts < SWING_MIN_COHORTS,
    firstDate,
  }
}
