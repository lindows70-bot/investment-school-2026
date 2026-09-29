// 투자학교 저울 채점표 API — 적립된 하루 한 장(scale-hist-v1)을 3개월 뒤 대표 가격으로 채점(lib/scaleScore). 공개 시장 데이터만 · 12h 캐시
//   대표 가격(사용자 결정 2026-09-29): 채권 IEF·주식 SPY = 야후 분배금 포함 수정주가(adjclose — 가격만 쓰면 IEF 2년 −8.8% vs 실제 −1.5% 로 채권이 늘 손해 채점),
//   금 GC=F·코인 BTC-USD = 종가, 부동산 = KB 아파트 매매지수(전국, 월간, re-market 캐시). 통화 = 자산마다 자기 통화
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { RE_MARKET_KEY } from '@/lib/reMarketKey'
import { SCALE_HIST_KEY, computeScaleScore, type ScaleSnap, type ScaleScore, type Series } from '@/lib/scaleScore'
import type { ReMarketResult } from '@/app/api/re-market/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_KEY = 'scale-score-v1'   // 날짜 없는 키 — 신선도는 TTL
const TTL = 12 * 3600_000
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 야후 일봉 — 수정주가(adjclose) 우선, 없으면 종가. from 부터 오늘까지 */
async function yahooSeries(sym: string, from: string): Promise<Series | null> {
  try {
    const p1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000)
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000), cache: 'no-store' })
    if (!r.ok) return null
    const res = (await r.json())?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? []
    const adj: (number | null)[] | undefined = res?.indicators?.adjclose?.[0]?.adjclose
    const close: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
    const dates: string[] = [], values: number[] = []
    for (let i = 0; i < ts.length; i++) {
      const v = adj?.[i] ?? close[i]
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) { dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10)); values.push(v) }
    }
    return dates.length ? { dates, values } : null
  } catch { return null }
}

export async function GET(req: Request) {
  const cached = await getCache<ScaleScore>(CACHE_KEY, TTL)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const hist = (await getCache<ScaleSnap[]>(SCALE_HIST_KEY, 3650 * 86400_000)) ?? []
  const today = kstToday()
  if (!hist.length) {
    // 적립 전 — 실패가 아니라 '아직 없음'(200 으로 구분)
    return NextResponse.json(computeScaleScore([], {}, today), { headers: { 'Cache-Control': 'no-store' } })
  }
  const from = new Date(Date.parse(`${hist[0].d}T00:00:00Z`) - 14 * 86400_000).toISOString().slice(0, 10)
  const origin = new URL(req.url).origin
  const [bond, stock, gold, coin, kb] = await Promise.all([
    yahooSeries('IEF', from), yahooSeries('SPY', from), yahooSeries('GC=F', from), yahooSeries('BTC-USD', from),
    (async (): Promise<Series | null> => {
      let rm = await getCache<ReMarketResult>(RE_MARKET_KEY, 12 * 3600_000)
      if (!rm) rm = await fetch(`${origin}/api/re-market`, { cache: 'no-store', signal: AbortSignal.timeout(40_000) }).then(r => r.ok ? r.json() : null).catch(() => null)
      const rows = (rm?.kbChart ?? []).filter(x => typeof x?.sale === 'number' && x.sale > 0)
      return rows.length ? { dates: rows.map(x => x.date), values: rows.map(x => x.sale as number) } : null
    })(),
  ])
  const out = computeScaleScore(hist, { bond: bond ?? undefined, stock: stock ?? undefined, gold: gold ?? undefined, coin: coin ?? undefined, realestate: kb ?? undefined }, today)
  // 대표 가격이 하나라도 비면 캐시하지 않는다(그 자산이 빠진 채점이 12시간 박제되지 않게)
  if (bond && stock && gold && coin && kb) await setCache(CACHE_KEY, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
