// 💵 스테이블코인 레이더 — 암호시장의 '디지털 달러·유동성'. 시총(매수 대기 자금)·종류별 위험·페그 이탈 모니터
// Zero Cost·무키: DefiLlama 스테이블코인 API. 6h 캐시. "수급은 연료" — 스테이블 시총↑=강세 연료, 페그 붕괴=시스템 위기
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export type StableRisk = 'low' | 'mid' | 'high'
const MECH: Record<string, { ko: string; risk: StableRisk }> = {
  'fiat-backed':   { ko: '법정화폐 담보', risk: 'low' },
  'crypto-backed': { ko: '암호화폐 담보', risk: 'mid' },
  'algorithmic':   { ko: '알고리즘(무담보)', risk: 'high' },
}

export interface StableCoin { symbol: string; name: string; mcap: number; share: number; price: number | null; depegPct: number | null; mechanism: string; mechKo: string; risk: StableRisk }
export interface StablecoinResult {
  totalMcap: number
  mcapSeries: { date: string; mcap: number }[]
  mcapChange30d: number | null      // 30일 시총 증감 %(유동성 방향)
  coins: StableCoin[]
  byMech: { mechanism: string; ko: string; risk: StableRisk; mcap: number; share: number }[]
  depegAlerts: StableCoin[]
  asOf: string
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

export async function GET() {
  const cacheKey = `stablecoin-v3:${kstDate()}`   // v3: 페그경보 하방($1↓)만(yield형 +이탈 제외)
  const cached = await getCache<StablecoinResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const H = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
  let assets: Record<string, unknown>[] = [], chart: Record<string, unknown>[] = []
  try {
    const [a, c] = await Promise.all([
      fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true', { headers: H, signal: AbortSignal.timeout(15_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('https://stablecoins.llama.fi/stablecoincharts/all', { headers: H, signal: AbortSignal.timeout(15_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    assets = a?.peggedAssets ?? []
    chart = Array.isArray(c) ? c : []
  } catch { /* graceful */ }
  if (!assets.length) return NextResponse.json({ error: 'no_data' }, { status: 200 })

  // USD 페그 스테이블코인만 (EUR·JPY 등 제외)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usd = assets.filter((s: any) => s.pegType === 'peggedUSD')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcapOf = (s: any) => num(s?.circulating?.peggedUSD) ?? 0
  const totalMcap = usd.reduce((sum, s) => sum + mcapOf(s), 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coins: StableCoin[] = usd.map((s: any) => {
    const mcap = mcapOf(s), price = num(s.price)
    const mech = String(s.pegMechanism ?? 'fiat-backed').replace('crytpo', 'crypto')   // DefiLlama 원본 오타 정규화
    const meta = MECH[mech] ?? { ko: mech, risk: 'mid' as StableRisk }
    return { symbol: s.symbol, name: s.name, mcap, share: totalMcap ? +(mcap / totalMcap * 100).toFixed(1) : 0, price, depegPct: price != null ? +((price - 1) * 100).toFixed(2) : null, mechanism: mech, mechKo: meta.ko, risk: meta.risk }
  }).sort((a, b) => b.mcap - a.mcap)

  const topCoins = coins.slice(0, 10)

  // 종류별 집계
  const mechMap = new Map<string, number>()
  for (const c of coins) mechMap.set(c.mechanism, (mechMap.get(c.mechanism) ?? 0) + c.mcap)
  const byMech = Array.from(mechMap.entries()).map(([mechanism, mcap]) => {
    const meta = MECH[mechanism] ?? { ko: mechanism, risk: 'mid' as StableRisk }
    return { mechanism, ko: meta.ko, risk: meta.risk, mcap, share: totalMcap ? +(mcap / totalMcap * 100).toFixed(1) : 0 }
  }).filter(m => m.share >= 0.05).sort((a, b) => b.mcap - a.mcap)

  // 페그 이탈 경보 — 주요 코인($1B+)의 '하방' 이탈만(-0.5%↓). 위험은 늘 $1 붕괴 방향(USDC SVB $0.87·UST $0.01).
  // yield형(USDY 등 $1 초과 의도)·소형 죽은코인 노이즈 제외
  const depegAlerts = coins.filter(c => c.mcap > 1e9 && c.depegPct != null && c.depegPct <= -0.5)
    .sort((a, b) => a.depegPct! - b.depegPct!).slice(0, 6)

  // 시총 추이(USD 페그) — 다운샘플 ~180포인트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series = chart.map((p: any) => ({ date: new Date(Number(p.date) * 1000).toISOString().slice(0, 10), mcap: num(p?.totalCirculatingUSD?.peggedUSD) ?? 0 })).filter(p => p.mcap > 0)
  const step = Math.max(1, Math.ceil(series.length / 180))
  const mcapSeries = series.filter((_, i) => i % step === 0 || i === series.length - 1)
  // 30일 증감(원본 일별 기준)
  let mcapChange30d: number | null = null
  if (series.length > 30) { const a = series[series.length - 31].mcap, b = series[series.length - 1].mcap; if (a > 0) mcapChange30d = +((b / a - 1) * 100).toFixed(1) }

  const result: StablecoinResult = { totalMcap, mcapSeries, mcapChange30d, coins: topCoins, byMech, depegAlerts, asOf: new Date().toISOString() }
  if (totalMcap > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
