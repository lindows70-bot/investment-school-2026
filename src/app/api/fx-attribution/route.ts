// 💱 환율 기여도 분해 API — 해외(USD) 보유의 수익을 '달러 수익 + 환율 기여'로 분리
//    매입일 환율은 Yahoo KRW=X 일봉, 현재 환율은 앱 SSOT(/api/exchange-rate).
//    ⛔ 예측·환헤지 권유 아님(과거 분해). 원화 상장 해외 ETF는 대상 아님(매입 환율 개념 없음).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getUsdKrw } from '@/lib/fx'
import { buildFxAttribution, type FxLot, type FxAttribution } from '@/lib/fxAttribution'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `fx-attribution-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<FxAttribution>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const { data: rows } = await sb.from('investments')
    .select('ticker,name,market,currency,purchase_price,quantity,purchase_date').eq('user_id', user.id)
  const all = rows ?? []
  // 외화(USD) 보유만 — 원화 표시 자산(KR 상장·크립토 원화)은 매입 환율 개념이 없다
  const usd = all.filter(r => r.currency === 'USD' && (r.quantity ?? 0) > 0 && r.purchase_date)
  if (!usd.length) return NextResponse.json({ empty: true }, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  // 현재가 배치(전 종목 — 환노출 비중 계산에 전체 평가액이 필요)
  const priceMap = new Map<string, { price: number; krw: boolean }>()
  for (let i = 0; i < all.length; i += 40) {
    try {
      const r = await fetch(`${base}/api/stock-price`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all.slice(i, i + 40).map(h => ({ ticker: h.ticker, market: h.market ?? 'US' }))),
        signal: AbortSignal.timeout(40_000),
      })
      if (r.ok) for (const d of await r.json() as any[])
        if (Number(d?.currentPrice) > 0) priceMap.set(String(d.ticker).toUpperCase(), { price: Number(d.currentPrice), krw: d.currency === 'KRW' })
    } catch { /* graceful */ }
  }

  const [fxNow, fxSeries] = await Promise.all([
    getUsdKrw(base),
    (async () => {
      const { default: YF } = await import('yahoo-finance2')
      const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
      const c = await yf.chart('KRW=X', {
        period1: '2015-01-01', period2: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), interval: '1d',
      }, { validateResult: false })
      return (c?.quotes ?? [])
        .filter((q: any) => Number(q?.close) > 0)
        .map((q: any) => ({ date: (q.date instanceof Date ? q.date : new Date(q.date)).toISOString().slice(0, 10), rate: Number(q.close) }))
    })().catch(() => [] as { date: string; rate: number }[]),
  ])
  if (!fxSeries.length) return NextResponse.json({ error: 'fx series unavailable' }, { status: 503 })

  const lots: FxLot[] = []
  for (const r of usd) {
    const p = priceMap.get(String(r.ticker).toUpperCase())
    if (!p || p.krw) continue   // 가격 미확보 또는 원화 표시(대상 아님)
    lots.push({
      ticker: String(r.ticker), name: String(r.name ?? r.ticker),
      purchaseDate: String(r.purchase_date).slice(0, 10),
      purchasePrice: Number(r.purchase_price) || 0, quantity: Number(r.quantity) || 0,
      currentPrice: p.price,
    })
  }
  if (!lots.length) return NextResponse.json({ empty: true }, { headers: { 'Cache-Control': 'no-store' } })

  // 전체 포트 원화 평가액(환노출 비중 분모) — 가격 실패분은 원가 폴백(0% 붕괴 방지)
  let totalKrw = 0
  for (const r of all) {
    const qty = Number(r.quantity) || 0
    if (qty <= 0) continue
    const p = priceMap.get(String(r.ticker).toUpperCase())
    const isKrw = r.currency ? r.currency === 'KRW' : r.market === 'KR'
    totalKrw += p && p.price > 0
      ? p.price * qty * (p.krw ? 1 : fxNow)
      : (Number(r.purchase_price) || 0) * qty * (isKrw ? 1 : fxNow)
  }

  const result = buildFxAttribution(lots, fxSeries, fxNow, totalKrw)
  if (!result) return NextResponse.json({ empty: true }, { headers: { 'Cache-Control': 'no-store' } })

  // 라이브 가격을 충분히 확보했을 때만 캐시(부분실패 박제 금지)
  if (lots.length >= usd.length * 0.6) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
