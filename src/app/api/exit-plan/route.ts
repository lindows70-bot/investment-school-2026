// 🚪 출구 플랜 API — 보유 종목별 매도 계획(두 참고선·매도 압력·결정론 행동) 서빙
// 계산은 lib/exitPlan SSOT. 캔들은 타이밍 크론이 매일 워밍한 일별 캐시라 대부분 즉시.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { buildExitPlans, type ExitHolding, type ExitPlanItem } from '@/lib/exitPlan'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface ExitPlanApi { asOf: string; items: ExitPlanItem[]; skipped: string[] }

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const fp = await holdingsFingerprint(user.id)
  const key = `exit-plan-v1:${user.id}:${kstDate()}:${fp}`
  if (!refresh) {
    const cached = await getCache<ExitPlanApi>(key, 6 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: rows } = await admin.from('investments')
    .select('ticker, name, market, purchase_price, quantity')
    .eq('user_id', user.id)
  if (!rows?.length) return NextResponse.json({ asOf: kstDate(), items: [], skipped: [] })

  // STOCK만 + 티커 병합(분할매수 여러 행 → 가중 평단·수량 합산)
  const merged = new Map<string, ExitHolding & { cost: number }>()
  for (const r of rows) {
    const mkt = (r.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
    if (getAssetType(r.ticker, r.name, mkt) !== 'STOCK') continue
    const t = String(r.ticker).toUpperCase()
    const qty = Number(r.quantity) || 0, px = Number(r.purchase_price) || 0
    if (qty <= 0 || px <= 0) continue
    const prev = merged.get(t)
    if (prev) { prev.qty += qty; prev.cost += px * qty; prev.avgPrice = prev.cost / prev.qty }
    else merged.set(t, { ticker: t, name: r.name ?? t, market: mkt, avgPrice: px, qty, cost: px * qty })
  }
  if (merged.size === 0) return NextResponse.json({ asOf: kstDate(), items: [], skipped: [] })

  // Jarvis 최신 펀더 판정(WHAT축) — timing-watch 서빙과 동일 조인
  const fundMap = new Map<string, ExitPlanItem['fund']>()
  try {
    const { data: briefs } = await admin.from('user_daily_briefings')
      .select('ticker, signal_type, base_date').eq('user_id', user.id)
      .order('base_date', { ascending: false }).limit(80)
    if (briefs?.length) {
      const latest = briefs[0].base_date
      for (const b of briefs) if (b.base_date === latest)
        fundMap.set(String(b.ticker).toUpperCase(), b.signal_type as ExitPlanItem['fund'])
    }
  } catch { /* graceful */ }

  const { items, skipped } = await buildExitPlans(Array.from(merged.values()), fundMap)
  const out: ExitPlanApi = { asOf: kstDate(), items, skipped }
  if (items.length > 0) await setCache(key, out)   // 전멸 결과는 박제 금지
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
