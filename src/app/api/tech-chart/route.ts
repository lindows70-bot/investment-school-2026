// 📉 기술적 차트 전용 장기 OHLCV API — EMA224·일목균형표(52봉+26선행)에 필요한 긴 시계열(일/주/월봉)
//    stock-price(60캔들·요약용)와 별개: 증권사식 차트는 400봉+ 필요. KR=네이버 fchart, US=Yahoo v8.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export interface TechCandle { date: string; open: number; high: number; low: number; close: number; volume: number }
export interface TechChartResult { ticker: string; market: 'KR' | 'US'; tf: 'D' | 'W' | 'M'; candles: TechCandle[] }

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** KR — 네이버 fchart OHLCV (일 480 / 주 320 / 월 240) */
async function krCandles(code: string, tf: 'D' | 'W' | 'M'): Promise<TechCandle[]> {
  const m = { D: { timeframe: 'day', count: 480 }, W: { timeframe: 'week', count: 320 }, M: { timeframe: 'month', count: 240 } }[tf]
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=${m.timeframe}&count=${m.count}&requestType=0`,
      { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const xml = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
    const out: TechCandle[] = []
    for (const mm of Array.from(xml.matchAll(/data="([^"]+)"/g))) {
      const p = mm[1].split('|')
      if (p.length < 6) continue
      const ds = p[0], close = parseFloat(p[4])
      if (!isFinite(close) || close <= 0) continue
      const open = parseFloat(p[1]), high = parseFloat(p[2]), low = parseFloat(p[3]), volume = parseFloat(p[5])
      out.push({
        date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`,
        open: isFinite(open) && open > 0 ? open : close,
        high: isFinite(high) && high > 0 ? high : close,
        low: isFinite(low) && low > 0 ? low : close,
        close, volume: isFinite(volume) ? volume : 0,
      })
    }
    return out
  } catch { return [] }
}

/** US — Yahoo v8 chart OHLCV (일=2y / 주=7y / 월=20y) */
async function usCandles(ticker: string, tf: 'D' | 'W' | 'M'): Promise<TechCandle[]> {
  const m = { D: { range: '2y', interval: '1d' }, W: { range: '7y', interval: '1wk' }, M: { range: '20y', interval: '1mo' } }[tf]
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${m.range}&interval=${m.interval}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? []
    const q = res?.indicators?.quote?.[0]
    if (!ts.length || !q) return []
    const out: TechCandle[] = []
    for (let i = 0; i < ts.length; i++) {
      const c = q.close?.[i]
      if (typeof c !== 'number' || !isFinite(c) || c <= 0) continue
      const d = new Date(ts[i] * 1000)
      out.push({
        date: d.toISOString().slice(0, 10),
        open: typeof q.open?.[i] === 'number' && q.open[i] > 0 ? q.open[i] : c,
        high: typeof q.high?.[i] === 'number' && q.high[i] > 0 ? q.high[i] : c,
        low: typeof q.low?.[i] === 'number' && q.low[i] > 0 ? q.low[i] : c,
        close: c, volume: typeof q.volume?.[i] === 'number' ? q.volume[i] : 0,
      })
    }
    // Yahoo 주/월봉 '진행중 현재봉' 중복 트레일링 바 제거(sectorEngine 교훈)
    if (out.length >= 2 && tf !== 'D' && out[out.length - 1].close === out[out.length - 2].close
      && out[out.length - 1].open === out[out.length - 2].open) out.pop()
    return out
  } catch { return [] }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim().toUpperCase()
  const market = (sp.get('market') ?? 'US').toUpperCase() as 'KR' | 'US'
  const tf = ((sp.get('tf') ?? 'D').toUpperCase() as 'D' | 'W' | 'M')
  if (!ticker) return NextResponse.json({ error: '티커를 입력해주세요.' }, { status: 400 })
  if (!['KR', 'US'].includes(market) || !['D', 'W', 'M'].includes(tf))
    return NextResponse.json({ error: '잘못된 파라미터' }, { status: 400 })

  const cacheKey = `tech-chart-v1:${ticker}:${market}:${tf}:${kstDate()}`
  const cached = await getCache<TechChartResult>(cacheKey, 30 * 60_000)   // 30분(장중 갱신)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const candles = market === 'KR' ? await krCandles(ticker, tf) : await usCandles(ticker, tf)
  if (candles.length < 10)
    return NextResponse.json({ error: '시세를 불러오지 못했습니다 — 티커·시장을 확인해주세요.' }, { status: 404 })

  const result: TechChartResult = { ticker, market, tf, candles }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
