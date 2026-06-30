// 주글라르(설비투자, 9~10년) 파동 추적기 — 빅테크 하이퍼스케일러 CAPEX 합산 추이로 AI 인프라 사이클 위치 측정
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// AI 인프라 CAPEX를 끌고 가는 하이퍼스케일러(클라우드 4강 + 오라클)
const ANCHORS: { ticker: string; name: string }[] = [
  { ticker: 'AMZN', name: 'Amazon(AWS)' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'ORCL', name: 'Oracle' },
]

export interface JuglarResult {
  years: { year: string; capexB: number; count: number; yoy: number | null }[]
  latestYear: string | null
  latestYoY: number | null
  verdict: 'surge' | 'expand' | 'slow'
  anchors: { ticker: string; name: string; latestB: number | null }[]
  asOf: string
}

async function annualCapex(ticker: string): Promise<{ year: string; absB: number }[]> {
  const now = Math.floor(Date.now() / 1000), p1 = now - 7 * 365 * 86400
  for (const host of ['query2', 'query1']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}?type=annualCapitalExpenditure&period1=${p1}&period2=${now}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const j = await r.json()
      const arr = j?.timeseries?.result?.[0]?.annualCapitalExpenditure ?? []
      const out = arr
        .map((x: { asOfDate?: string; reportedValue?: { raw?: number } }) => ({ year: String(x.asOfDate ?? '').slice(0, 4), raw: x.reportedValue?.raw }))
        .filter((x: { year: string; raw?: number }) => x.year && typeof x.raw === 'number')
        .map((x: { year: string; raw: number }) => ({ year: x.year, absB: Math.abs(x.raw) / 1e9 }))
      if (out.length) return out
    } catch { /* 다음 host */ }
  }
  return []
}

export async function GET() {
  const cacheKey = 'juglar-capex-v1'
  const cached = await getCache<JuglarResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const series = await Promise.all(ANCHORS.map(a => annualCapex(a.ticker)))

  // 연도별 합산(회계연도 라벨 기준). ⚠️ 일부사 FY 말월이 달라(MSFT 6월·ORCL 5월) 단독 연도(count<4)는 드롭해 왜곡 방지
  const yearMap = new Map<string, { sum: number; count: number }>()
  series.forEach(s => s.forEach(({ year, absB }) => {
    const e = yearMap.get(year) ?? { sum: 0, count: 0 }
    e.sum += absB; e.count += 1; yearMap.set(year, e)
  }))
  const years = Array.from(yearMap.entries())
    .filter(([, e]) => e.count >= 4)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, e], i, arr) => {
      const prev = i > 0 ? arr[i - 1][1].sum : null
      return { year, capexB: Math.round(e.sum), count: e.count, yoy: prev ? Math.round((e.sum / prev - 1) * 1000) / 10 : null }
    })

  const latest = years[years.length - 1] ?? null
  const latestYoY = latest?.yoy ?? null
  const verdict: 'surge' | 'expand' | 'slow' = latestYoY == null ? 'expand' : latestYoY >= 25 ? 'surge' : latestYoY >= 5 ? 'expand' : 'slow'

  const anchors = ANCHORS.map((a, i) => {
    const s = series[i]
    return { ticker: a.ticker, name: a.name, latestB: s.length ? Math.round(s[s.length - 1].absB) : null }
  })

  const result: JuglarResult = { years, latestYear: latest?.year ?? null, latestYoY, verdict, anchors, asOf: new Date().toISOString() }
  if (years.length >= 2) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
