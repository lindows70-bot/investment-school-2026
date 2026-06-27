// 🛰️ 양자 테마 인텔리전스 API — 종목별 1W/1M/1Y 수익률 + IONQ 대장주 베타·상관 + 서브섹터 집계
// Zero Cost: US=Yahoo 주봉 / KR=네이버 fchart 주봉(추가 키 없음) · 공개 6h 캐시 · 수익률은 비율이라 환율 무관
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { QUANTUM, QUANTUM_ANCHOR, QSUB_META, QUANTUM_POLICY, QUANTUM_PREIPO, type QSub, type QMarket, type QuantumStock } from '@/lib/quantumUniverse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const CACHE_KEY = () => `quantum-sector-v2:${kstDate()}`   // v2: 해외 라이브 + 테마지수·MDD·오버레이

// US 주봉 종가(오래된→최신) — Yahoo v8
async function fetchUsWeekly(ticker: string): Promise<number[]> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1wk`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
    return Array.isArray(q) ? q.filter((c: number | null): c is number => typeof c === 'number' && c > 0) : []
  } catch { return [] }
}

// KR 주봉 종가(오래된→최신) — 네이버 fchart(EUC-KR XML)
async function fetchKrWeekly(code: string): Promise<number[]> {
  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=week&count=110&requestType=0`
    const r = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const xml = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
    const out: number[] = []
    for (const m of Array.from(xml.matchAll(/data="([^"]+)"/g))) {
      const f = m[1].split('|')   // date|open|high|low|close|volume
      const c = Number(f[4])
      if (isFinite(c) && c > 0) out.push(c)
    }
    return out
  } catch { return [] }
}

// 해외(yahoo 심볼)는 Yahoo, KR은 네이버, 그 외(US)는 Yahoo(티커)
const fetchWeekly = (s: QuantumStock) => s.yahoo ? fetchUsWeekly(s.yahoo) : s.market === 'KR' ? fetchKrWeekly(s.ticker) : fetchUsWeekly(s.ticker)

// 수익률(%) — w(오래된→최신), back주 전 대비
const retPct = (w: number[], back: number): number | null => {
  if (w.length < back + 1) return null
  const past = w[w.length - 1 - back], now = w[w.length - 1]
  return past > 0 ? Math.round((now / past - 1) * 1000) / 10 : null
}
// 주간 수익률 시계열
const weeklyRets = (w: number[]): number[] => w.slice(1).map((c, i) => w[i] > 0 ? c / w[i] - 1 : 0)
// 베타·상관 (vs 앵커)
function betaCorr(stockW: number[], anchorW: number[]): { beta: number | null; corr: number | null } {
  const rs = weeklyRets(stockW), ra = weeklyRets(anchorW)
  const n = Math.min(rs.length, ra.length, 52)   // 최근 최대 1년
  if (n < 12) return { beta: null, corr: null }
  const S = rs.slice(-n), A = ra.slice(-n)
  const mS = S.reduce((a, b) => a + b, 0) / n, mA = A.reduce((a, b) => a + b, 0) / n
  let cov = 0, vA = 0, vS = 0
  for (let i = 0; i < n; i++) { const ds = S[i] - mS, da = A[i] - mA; cov += ds * da; vA += da * da; vS += ds * ds }
  if (vA === 0 || vS === 0) return { beta: null, corr: null }
  return { beta: Math.round((cov / vA) * 100) / 100, corr: Math.round((cov / Math.sqrt(vA * vS)) * 100) / 100 }
}

export interface QStockOut {
  ticker: string; name: string; market: QMarket; sub: QSub; modality: string[]; purePlay: boolean
  govAwardUsdM?: number; note: string
  ret1w: number | null; ret1m: number | null; ret1y: number | null
  beta: number | null; corr: number | null
}
export interface QThemeChart {
  len: number; theme: number[]; mdd: number; fromPeak: number
  overlay: { ticker: string; name: string; norm: number[] }[]
}
export interface QSubOut { key: QSub; label: string; emoji: string; color: string; desc: string; count: number; ret1w: number | null; ret1m: number | null; ret1y: number | null }
export interface QuantumSectorResult {
  anchor: string
  stocks: QStockOut[]
  subsectors: QSubOut[]
  themeChart: QThemeChart | null
  policy: typeof QUANTUM_POLICY
  preIpo: typeof QUANTUM_PREIPO
  asOf: string
}

const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

export async function GET() {
  const cached = await getCache<QuantumSectorResult>(CACHE_KEY(), 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 주봉 동시 수집(앵커 포함)
  const series = new Map<string, number[]>()
  await Promise.all(QUANTUM.map(async s => { series.set(s.ticker, await fetchWeekly(s)) }))
  const anchorW = series.get(QUANTUM_ANCHOR) ?? []

  const stocks: QStockOut[] = QUANTUM.map(s => {
    const w = series.get(s.ticker) ?? []
    const { beta, corr } = s.ticker === QUANTUM_ANCHOR ? { beta: 1, corr: 1 } : betaCorr(w, anchorW)
    return {
      ticker: s.ticker, name: s.name, market: s.market, sub: s.sub, modality: s.modality, purePlay: s.purePlay,
      govAwardUsdM: s.govAwardUsdM, note: s.note,
      ret1w: retPct(w, 1), ret1m: retPct(w, 4), ret1y: retPct(w, 52),
      beta, corr,
    }
  })

  const subsectors: QSubOut[] = (Object.keys(QSUB_META) as QSub[]).map(k => {
    const m = QSUB_META[k], members = stocks.filter(s => s.sub === k)
    return {
      key: k, label: m.label, emoji: m.emoji, color: m.color, desc: m.desc, count: members.length,
      ret1w: avg(members.map(s => s.ret1w)), ret1m: avg(members.map(s => s.ret1m)), ret1y: avg(members.map(s => s.ret1y)),
    }
  })

  // ── 테마 지수 + 낙폭(MDD) + 모멘텀 오버레이 (퓨어플레이 동일가중, 최근 N주봉 rebase 100) ──
  const N = 78
  const norm = (w: number[]): number[] | null => {
    if (w.length < N) return null
    const win = w.slice(w.length - N), base = win[0]
    return base > 0 ? win.map(c => Math.round((c / base) * 1000) / 10) : null
  }
  const pureNorms = QUANTUM.filter(s => s.purePlay).map(s => norm(series.get(s.ticker) ?? [])).filter((x): x is number[] => x != null)
  let themeChart: QThemeChart | null = null
  if (pureNorms.length >= 3) {
    const theme: number[] = []
    for (let t = 0; t < N; t++) theme.push(Math.round((pureNorms.reduce((a, ns) => a + ns[t], 0) / pureNorms.length) * 10) / 10)
    let peak = -Infinity, mdd = 0
    for (const v of theme) { if (v > peak) peak = v; const dd = v / peak - 1; if (dd < mdd) mdd = dd }
    const fromPeak = Math.round((theme[theme.length - 1] / Math.max(...theme) - 1) * 1000) / 10
    const overlay = ['IONQ', 'QBTS', 'RGTI', 'QUBT', '046970'].map(tk => {
      const ns = norm(series.get(tk) ?? []); const s = QUANTUM.find(x => x.ticker === tk)
      return ns ? { ticker: tk, name: s?.name ?? tk, norm: ns } : null
    }).filter((x): x is { ticker: string; name: string; norm: number[] } => x != null)
    themeChart = { len: N, theme, mdd: Math.round(mdd * 1000) / 10, fromPeak, overlay }
  }

  const result: QuantumSectorResult = {
    anchor: QUANTUM_ANCHOR, stocks, subsectors, themeChart, policy: QUANTUM_POLICY, preIpo: QUANTUM_PREIPO, asOf: new Date().toISOString(),
  }
  // 핵심(앵커 시계열) 성공 시에만 캐시(부분실패 박제 방지)
  if (anchorW.length > 10) await setCache(CACHE_KEY(), result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
