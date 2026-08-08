// 🤲 단단한 손 점검 — 보유 통계(산 이유 기록률·보유 기간)만 서빙. 판정은 lib/firmHands SSOT가 한다.
//    현금 축은 클라이언트가 기존 /api/cash-position 을 그대로 읽어 합친다(같은 값·중복 계산 금지 — 제2원칙).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { SNAPSHOT_START } from '@/lib/firmHands'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export interface FirmHandsApi {
  snapshot: { withSnap: number; eligible: number; preStart: number }
  holding: { avgMonths: number | null; n: number; longRatio: number | null }
  asOf: string
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [{ data: rows }, { data: txs }] = await Promise.all([
    admin.from('investments').select('ticker, purchase_date, quantity').eq('user_id', user.id),
    admin.from('transactions').select('ticker, snapshot_data').eq('user_id', user.id).eq('type', 'buy').limit(1000),
  ])

  const empty: FirmHandsApi = { snapshot: { withSnap: 0, eligible: 0, preStart: 0 }, holding: { avgMonths: null, n: 0, longRatio: null }, asOf: new Date().toISOString() }
  if (!rows?.length) return NextResponse.json(empty, { headers: { 'Cache-Control': 'no-store' } })

  // 근거가 실제로 담긴 매수만 인정 — 빈 스냅샷을 '기록됨'으로 세면 점검이 거짓말이 된다
  const snapTickers = new Set<string>()
  for (const t of txs ?? []) {
    const sd = t.snapshot_data as Record<string, unknown> | null
    const has = sd && (sd.peg != null || sd.flow != null || sd.seasonTag != null || sd.opMargin != null)
    if (has) snapTickers.add(String(t.ticker).toUpperCase())
  }

  // 종목 단위(같은 티커 분할매수는 1종) — '몇 종을 왜 샀는지 아는가'가 질문이라 수량이 아니라 종목이 단위다
  const first = new Map<string, string>()   // ticker → 가장 이른 매수일
  for (const r of rows) {
    if (!r.purchase_date || (Number(r.quantity) || 0) <= 0) continue
    const t = String(r.ticker).toUpperCase()
    const d = String(r.purchase_date).slice(0, 10)
    const prev = first.get(t)
    if (!prev || d < prev) first.set(t, d)
  }

  let withSnap = 0, eligible = 0, preStart = 0
  const now = Date.now()
  let monthsSum = 0, n = 0, longN = 0
  for (const [t, d] of Array.from(first.entries())) {
    if (d >= SNAPSHOT_START) { eligible++; if (snapTickers.has(t)) withSnap++ }
    else preStart++
    const ms = now - new Date(d).getTime()
    if (isFinite(ms) && ms >= 0) {
      const months = ms / (30.44 * 86400_000)
      monthsSum += months; n++
      if (months >= 12) longN++
    }
  }

  const out: FirmHandsApi = {
    snapshot: { withSnap, eligible, preStart },
    holding: {
      avgMonths: n > 0 ? Math.round((monthsSum / n) * 10) / 10 : null,
      n,
      longRatio: n > 0 ? Math.round((longN / n) * 100) / 100 : null,
    },
    asOf: new Date().toISOString(),
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
