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
  const sigs = cached.sigs.filter(s => mySet.has(s.ticker.toUpperCase()))

  return NextResponse.json({ asOf: cached.asOf, sigs }, { headers: { 'Cache-Control': 'no-store' } })
}
