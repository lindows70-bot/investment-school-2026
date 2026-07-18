// 🔔 타점 전환 알림 서빙 — 크론(timing-watch)이 감지한 신호등 전환 중 '내 보유 종목'만 필터해 반환(개인화)
export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCache } from '@/lib/appCache'
import type { WatchSig, WatchResult } from '@/app/api/cron/timing-watch/route'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const cached = await getCache<WatchResult>('timing-watch-changes-v2', 2 * 86400_000)
  if (!cached?.sigs?.length) return NextResponse.json({ asOf: cached?.asOf ?? null, sigs: [] as WatchSig[] }, { headers: { 'Cache-Control': 'no-store' } })

  // 내 보유 종목만(개인화 — kr-short와 동일 패턴)
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: mine } = await admin.from('investments').select('ticker').eq('user_id', user.id)
  const mySet = new Set((mine ?? []).map(r => String(r.ticker).toUpperCase()))
  let sigs = cached.sigs.filter(s => mySet.has(s.ticker.toUpperCase()))

  // 🧭 펀더(WHAT) 교차 주입 — Jarvis 모닝 처방전 최신 판정을 붙여 '타점 매수 vs 펀더 매도검토'가 모순 없이 한 칩에서 읽히게(ETN 2축 융합 전례)
  try {
    const { data: briefs } = await admin.from('user_daily_briefings')
      .select('ticker, signal_type, base_date').eq('user_id', user.id)
      .order('base_date', { ascending: false }).limit(60)
    if (briefs?.length) {
      const latestDate = briefs[0].base_date
      const fundMap = new Map<string, 'SELL' | 'BUY'>()
      for (const b of briefs) if (b.base_date === latestDate && (b.signal_type === 'SELL' || b.signal_type === 'BUY'))
        fundMap.set(String(b.ticker).toUpperCase(), b.signal_type)
      sigs = sigs.map(s => ({ ...s, fund: fundMap.get(s.ticker.toUpperCase()) ?? null }))
    }
  } catch { /* graceful — 테이블 없어도 배너는 정상 */ }

  return NextResponse.json({ asOf: cached.asOf, sigs }, { headers: { 'Cache-Control': 'no-store' } })
}
