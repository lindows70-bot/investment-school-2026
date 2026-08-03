// 진짜 월별 손익 시계열 API — 로트를 body 로 받아 서버에서 캔들 재구성 후 반환
// ⚠️ 개인 포트폴리오 데이터: 결과를 공유 캐시에 저장하지 않는다(캔들만 tech-chart-v1 공유 캐시).
import { NextResponse } from 'next/server'
import { computeMonthlyPnl, type PnlLot } from '@/lib/monthlyPnl'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  let body: { lots?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const raw = Array.isArray(body?.lots) ? body.lots : null
  if (!raw || raw.length === 0 || raw.length > 200) {
    return NextResponse.json({ error: 'lots must be 1~200 items' }, { status: 400 })
  }
  const lots: PnlLot[] = []
  for (const r of raw as Record<string, unknown>[]) {
    const ticker = typeof r.ticker === 'string' ? r.ticker.trim() : ''
    const purchase_price = Number(r.purchase_price)
    const quantity = Number(r.quantity)
    const purchase_date = typeof r.purchase_date === 'string' ? r.purchase_date.slice(0, 10) : ''
    if (!ticker || !/^\d{4}-\d{2}-\d{2}/.test(purchase_date)) continue
    if (!isFinite(purchase_price) || purchase_price <= 0 || !isFinite(quantity) || quantity <= 0) continue
    lots.push({
      ticker,
      market: typeof r.market === 'string' ? r.market : 'US',
      currency: r.currency === 'USD' ? 'USD' : 'KRW',
      purchase_price, quantity, purchase_date,
    })
  }
  if (!lots.length) return NextResponse.json({ error: 'no valid lots' }, { status: 400 })

  const result = await computeMonthlyPnl(lots)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
