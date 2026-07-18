// 🕸️ 이종 자산 상관 수렴 레이더 API — 주식·채권·금·달러·BTC 5축 일별 수익률의 롤링 상관
//    "평시 대비 최근 30일 상관 급등"(위기 시 ρ→1 수렴, 동반 폭락=분산 소멸)을 경보로. 경보만·현금화 강요 없음.
//    데이터: techChartData SSOT(5축 일봉) + macro-weather HY스프레드(위기 맥락 보조·읽기만). 결정론·신규 수집 최소.
import { NextResponse } from 'next/server'
import { getTechCandles } from '@/lib/techChartData'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const RECENT = 30       // 최근 창(거래일)
const BASELINE = 200    // 평시 창(거래일)
const MIN_COMMON = 60   // 공통 거래일 최소

export interface CorrAxis { key: string; name: string; ticker: string; emoji: string; role: string }
export interface CorrPair { a: string; b: string; baseline: number | null; recent: number | null; delta: number | null }
export type CorrAlert = 'calm' | 'watch' | 'converging'
export interface CorrRadarResult {
  asOf: string
  axes: CorrAxis[]
  matrixRecent: (number | null)[][]
  matrixBaseline: (number | null)[][]
  pairs: CorrPair[]               // delta 큰 순(수렴 심한 쌍 우선)
  meanRecent: number | null       // 최근 10쌍 평균 상관(높을수록 분산 약화)
  meanBaseline: number | null
  meanDelta: number | null
  hySpread: number | null
  hySpike: number | null
  alert: CorrAlert
  headline: string
  note: string
  commonDays: number
  recentDays: number
  baselineDays: number
}

const AXES: CorrAxis[] = [
  { key: 'stock', name: '주식(S&P500)', ticker: 'SPY', emoji: '📈', role: '위험자산 대표' },
  { key: 'bond', name: '장기채(미국 국채)', ticker: 'TLT', emoji: '📜', role: '전통적 안전자산' },
  { key: 'gold', name: '금', ticker: 'GLD', emoji: '🥇', role: '인플레·위기 헤지' },
  { key: 'dollar', name: '달러', ticker: 'UUP', emoji: '💵', role: '위기 시 안전자산(디커플)' },
  { key: 'btc', name: '비트코인', ticker: 'BTC-USD', emoji: '₿', role: '고변동 위험자산' },
]

/** 피어슨 상관 — 표본 20 미만이면 null */
function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length)
  if (n < 20) return null
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i] }
  const mx = sx / n, my = sy / n
  let cov = 0, vx = 0, vy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my
    cov += dx * dy; vx += dx * dx; vy += dy * dy
  }
  if (vx <= 0 || vy <= 0) return null
  const r = cov / Math.sqrt(vx * vy)
  return Math.max(-1, Math.min(1, r))
}

export async function GET(req: Request) {
  const cacheKey = `correlation-radar-v1:${kstDate()}`
  const cached = await getCache<CorrRadarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 5축 캔들 수집(SSOT)
  const candlesList = await Promise.all(AXES.map(a => getTechCandles(a.ticker, 'US', 'D').catch(() => [])))
  const ok = candlesList.filter(c => c.length >= 40).length
  if (ok < 2) return NextResponse.json({ error: 'insufficient_data' }, { status: 503 })

  // date→close 맵 → 공통 거래일
  const maps = candlesList.map(cs => {
    const m = new Map<string, number>()
    for (const c of cs) if (c.close > 0) m.set(c.date, c.close)
    return m
  })
  // 첫 유효 자산 기준으로 공통일 후보 만들고 전 자산에 있는 날만
  const anyDates = candlesList.find(c => c.length >= 40)?.map(c => c.date) ?? []
  const common = anyDates.filter(d => maps.every(m => m.has(d))).sort()

  const buildRet = (m: Map<string, number>) => {
    const r: number[] = []
    for (let i = 1; i < common.length; i++) {
      const p0 = m.get(common[i - 1])!, p1 = m.get(common[i])!
      r.push((p1 - p0) / p0)
    }
    return r
  }
  const rets = maps.map(buildRet)                       // 각 자산 공통일 수익률
  const total = rets[0]?.length ?? 0

  const recentDays = Math.min(RECENT, total)
  const baselineDays = Math.min(BASELINE, Math.max(0, total - recentDays))
  const sliceRecent = (a: number[]) => a.slice(a.length - recentDays)
  const sliceBase = (a: number[]) => a.slice(Math.max(0, a.length - recentDays - baselineDays), a.length - recentDays)

  const n = AXES.length
  const matrixRecent: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null))
  const matrixBaseline: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null))
  const pairs: CorrPair[] = []

  for (let i = 0; i < n; i++) {
    matrixRecent[i][i] = 1; matrixBaseline[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      const rec = pearson(sliceRecent(rets[i]), sliceRecent(rets[j]))
      const base = pearson(sliceBase(rets[i]), sliceBase(rets[j]))
      matrixRecent[i][j] = matrixRecent[j][i] = rec
      matrixBaseline[i][j] = matrixBaseline[j][i] = base
      const delta = rec != null && base != null ? Math.round((rec - base) * 100) / 100 : null
      pairs.push({ a: AXES[i].key, b: AXES[j].key, baseline: base, recent: rec, delta })
    }
  }
  pairs.sort((p, q) => (q.delta ?? -9) - (p.delta ?? -9))

  const mean = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null)
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }
  const meanRecent = mean(pairs.map(p => p.recent))
  const meanBaseline = mean(pairs.map(p => p.baseline))
  const meanDelta = meanRecent != null && meanBaseline != null ? Math.round((meanRecent - meanBaseline) * 100) / 100 : null

  // HY 스프레드(위기 맥락 보조·읽기만·graceful)
  let hySpread: number | null = null, hySpike: number | null = null
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
    const w = await fetch(`${base}/api/macro-weather`, { signal: AbortSignal.timeout(8_000) })
    if (w.ok) { const j = await w.json(); hySpread = typeof j.hySpread === 'number' ? j.hySpread : null; hySpike = typeof j.hySpike === 'number' ? j.hySpike : null }
  } catch { /* graceful */ }

  // 경보 판정(결정론)
  let alert: CorrAlert = 'calm'
  if (meanRecent != null && meanDelta != null) {
    if (meanRecent >= 0.40 && meanDelta >= 0.20) alert = 'converging'
    else if (meanDelta >= 0.15 || meanRecent >= 0.35) alert = 'watch'
  }

  const pct = (x: number | null) => x == null ? '—' : (x >= 0 ? '+' : '') + Math.round(x * 100) + '%'
  const headline =
    alert === 'converging' ? `⚠️ 상관 수렴 — 자산군이 함께 움직이기 시작(평균 상관 ${pct(meanBaseline)}→${pct(meanRecent)})`
    : alert === 'watch' ? `🟡 상관 상승 조짐 — 분산 효과가 약해지는 중(평균 ${pct(meanRecent)})`
    : `🟢 분산 정상 — 자산군이 제각각 움직임(평균 상관 ${pct(meanRecent)})`
  const crisisCtx = hySpread != null && hySpread >= 4.0 ? ' 신용 스프레드도 높아 위기 맥락 보강.' : ''
  const note =
    alert === 'converging'
      ? `위기엔 주식·채권·금·코인이 함께 떨어져 "분산됐다"는 착시가 깨진다.${crisisCtx} 달러(UUP)만 오르는지 확인 — 진짜 헤지는 현금·달러일 수 있다. ⛔ 기계적 현금화 아님, 비중·리스크 점검 신호.`
      : alert === 'watch'
      ? '자산군 간 상관이 평시보다 오르는 중 — 분산 방어력이 줄고 있다. 신규 편입 시 상관 낮은 축(달러·금)을 함께 보라.'
      : '주식·채권·금·달러·코인이 서로 다른 방향으로 움직여 분산이 살아있다. 위기 땐 이 상관이 1로 수렴하는지 감시.'

  const result: CorrRadarResult = {
    asOf: new Date().toISOString(),
    axes: AXES, matrixRecent, matrixBaseline, pairs,
    meanRecent, meanBaseline, meanDelta,
    hySpread, hySpike, alert, headline, note,
    commonDays: common.length, recentDays, baselineDays,
  }
  if (common.length >= MIN_COMMON && ok >= 4) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
