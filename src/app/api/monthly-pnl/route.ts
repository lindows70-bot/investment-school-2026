// 진짜 월별 손익 시계열 API — 로트를 body 로 받아 서버에서 캔들 재구성 후 반환
// ⚠️ 개인 포트폴리오 데이터: 결과를 공유 캐시에 저장하지 않는다(캔들만 tech-chart-v1 공유 캐시).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeMonthlyPnl, type PnlLot } from '@/lib/monthlyPnl'
import { getTechCandles } from '@/lib/techChartData'
import { buildRealizedByMonth, type SellTx } from '@/lib/realizedPnl'

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
    const cp = Number(r.currentPrice)
    lots.push({
      ticker,
      market: typeof r.market === 'string' ? r.market : 'US',
      currency: r.currency === 'USD' ? 'USD' : 'KRW',
      purchase_price, quantity, purchase_date,
      currentPrice: isFinite(cp) && cp > 0 ? cp : null,
    })
  }
  if (!lots.length) return NextResponse.json({ error: 'no valid lots' }, { status: 400 })

  // 현재 월 환율 — 대시보드가 쓰는 실시간 환율을 그대로 받아 누적 끝 == 평가손익(제2원칙)
  const fxRaw = Number((body as Record<string, unknown>).usdKrwNow)
  const usdKrwNow = isFinite(fxRaw) && fxRaw > 500 && fxRaw < 5000 ? fxRaw : null

  const result = await computeMonthlyPnl(lots, usdKrwNow)

  // ── 실현손익(매도 확정) 병합 ────────────────────────────────────────────
  // ⚠️ 평가손익만 보여주면 성적의 절반이 사라진다 — 이 학생은 매도 11건으로 이미
  //    +$3,879.93 을 확정해 뒀는데 대시보드는 -541만만 보여줬다.
  //    로트는 body 로 받지만 매도 이력은 서버가 본인 세션으로 직접 읽는다(RLS + 인증).
  let realized: Awaited<ReturnType<typeof buildRealizedByMonth>> | null = null
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      const { data: sells } = await sb.from('transactions')
        .select('ticker,name,market,currency,realized_pnl,transaction_date')
        .eq('user_id', user.id).eq('type', 'sell')
      if (sells?.length) {
        const fxCandles = await getTechCandles('KRW=X', 'US', 'D')
        const latestFx = usdKrwNow ?? fxCandles[fxCandles.length - 1]?.close ?? 0
        if (latestFx > 0) realized = buildRealizedByMonth(sells as SellTx[], fxCandles, latestFx)
      } else {
        realized = { byMonth: [], totalKrw: 0, totalCount: 0, fxFallbackCount: 0 }
      }
    }
  } catch { /* 실현손익은 부가 정보 — 실패해도 평가손익 시계열은 그대로 준다 */ }

  return NextResponse.json({ ...result, realized }, { headers: { 'Cache-Control': 'no-store' } })
}
