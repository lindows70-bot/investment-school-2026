// 🛰️→📋 퀀트 빌더 처방전 복사 API — 설계안을 내 포트폴리오(investments)로 가상 트래킹 편입
// 실제 매매 아님: 현재가를 매입가로 기록(가상 체결). 이미 보유한 티커는 건너뜀(중복/DCA 오염 방지 — 정직 보고)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { buildQuantPlan } from '@/lib/quantBuilder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let amountKrw = 100_000_000
  try {
    const body = await req.json()
    if (typeof body.amountKrw === 'number' && body.amountKrw >= 1_000_000) amountKrw = Math.min(body.amountKrw, 100_000_000_000)
  } catch { /* 기본 1억 */ }

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cookie = req.headers.get('cookie') ?? ''
  // 클라이언트가 보낸 비중을 신뢰하지 않고 서버 캐시 설계안을 재사용(변조 방지)
  const plan = await buildQuantPlan(base, cookie)
  if (!plan) return NextResponse.json({ error: 'build_failed' }, { status: 502 })

  // 전 종목(코어 ETF + 위성) 현재가 배치
  const targets = [
    ...plan.core.map(c => ({ ticker: c.ticker, name: c.name, market: 'US', weightPct: c.weightPct, role: 'CORE' as const })),
    ...plan.satellites.map(s => ({ ticker: s.ticker, name: s.name, market: s.market, weightPct: s.weightPct, role: 'SATELLITE' as const })),
  ]
  let prices: Record<string, number> = {}
  try {
    const pr = await fetch(`${base}/api/stock-price`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targets.map(t => ({ ticker: t.ticker, market: t.market }))),
      signal: AbortSignal.timeout(30_000),
    })
    if (pr.ok) {
      const arr = await pr.json() as Array<{ ticker: string; currentPrice: number }>
      prices = Object.fromEntries(arr.map(d => [d.ticker.toUpperCase(), d.currentPrice]))
    }
  } catch { /* 아래에서 가격 없는 종목 스킵 */ }

  let usdKrw = 1350
  try {
    const fx = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) })
    if (fx.ok) { const j = await fx.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate }
  } catch { /* 폴백 */ }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker').eq('user_id', user.id)
  const held = new Set((rows ?? []).map(r => r.ticker.toUpperCase()))

  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const added: string[] = []
  const skippedHeld: string[] = []
  const skippedNoPrice: string[] = []

  for (const t of targets) {
    const tk = t.ticker.toUpperCase()
    if (held.has(tk)) { skippedHeld.push(t.name); continue }
    const price = prices[tk] ?? 0
    if (price <= 0) { skippedNoPrice.push(t.name); continue }
    const currency = t.market === 'KR' ? 'KRW' : 'USD'
    const budgetKrw = amountKrw * t.weightPct / 100
    const unitKrw = price * (currency === 'USD' ? usdKrw : 1)
    // 수량: US는 소수 4자리(소수점 매수 가정), KR은 정수(최소 1주는 예산 부족 시 스킵하지 않고 1주 — 교육용 단순화 대신 0주면 스킵)
    const qty = currency === 'KRW' ? Math.floor(budgetKrw / unitKrw) : Math.round(budgetKrw / unitKrw * 10000) / 10000
    if (qty <= 0) { skippedNoPrice.push(t.name); continue }

    const { data: created, error } = await admin.from('investments').insert({
      user_id: user.id, ticker: tk, name: t.name, market: t.market, currency,
      purchase_price: price, quantity: qty, purchase_date: today,
      lynch_category: null, asset_role: t.role,
    }).select('id').single()
    if (error || !created) { skippedNoPrice.push(t.name); continue }
    added.push(t.name)
    // 거래 내역 자동 기록(실패해도 편입은 성공 처리 — AddInvestmentModal과 동일 패턴)
    try {
      await admin.from('transactions').insert({
        user_id: user.id, investment_id: created.id, ticker: tk, name: t.name, market: t.market, currency,
        type: 'buy', price, quantity: qty, total_amount: price * qty, fee: 0,
        memo: '🛰️ AI 퀀트 빌더 처방전 복사(가상 트래킹)', transaction_date: today,
      })
    } catch { /* 로그만 */ }
  }

  return NextResponse.json({ added, skippedHeld, skippedNoPrice, amountKrw }, { headers: { 'Cache-Control': 'no-store' } })
}
