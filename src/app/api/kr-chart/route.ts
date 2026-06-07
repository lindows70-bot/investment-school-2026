// 국내 종목 1Day 인트라데이 스파크라인 프록시 — 네이버 분봉(CORS 회피). 코드 다건 배치
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const UA = 'Mozilla/5.0'

// 분봉 → 종가 시계열(다운샘플 ~28포인트)
async function intradaySeries(code: string): Promise<number[]> {
  const key = `kr-intraday-v1:${code}:${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`
  const cached = await getCache<number[]>(key, 3 * 3600_000)
  if (cached) return cached
  try {
    const r = await fetch(`https://api.stock.naver.com/chart/domestic/item/${code}/minute?cnt=400`, {
      headers: { 'User-Agent': UA, Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(9_000),
    })
    if (!r.ok) return []
    const j = await r.json()
    const prices: number[] = (Array.isArray(j) ? j : []).map((p: { currentPrice?: number }) => Number(p?.currentPrice)).filter((n: number) => isFinite(n) && n > 0)
    if (prices.length < 2) return []
    const step = Math.max(1, Math.ceil(prices.length / 28))
    const sampled = prices.filter((_, i) => i % step === 0)
    if (sampled[sampled.length - 1] !== prices[prices.length - 1]) sampled.push(prices[prices.length - 1])
    await setCache(key, sampled)
    return sampled
  } catch { return [] }
}

export async function GET(req: Request) {
  const codes = (new URL(req.url).searchParams.get('codes') ?? '').split(',').map(c => c.replace(/\D/g, '')).filter(c => c.length === 6).slice(0, 14)
  if (!codes.length) return NextResponse.json({})
  const out: Record<string, number[]> = {}
  for (let i = 0; i < codes.length; i += 7) {
    const batch = codes.slice(i, i + 7)
    const rs = await Promise.all(batch.map(async c => [c, await intradaySeries(c)] as const))
    for (const [c, s] of rs) if (s.length) out[c] = s
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
