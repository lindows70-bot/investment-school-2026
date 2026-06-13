// 🧹 퀀트 빌더 가상 종목 정리 — 과거 '복사하기(가상 트래킹)'로 실제 investments에 섞여 들어간 가상 종목 제거
// 식별: transactions.memo에 '가상 트래킹' 표식이 있는 행 → 해당 investment 삭제(실제 직접 추가 종목은 표식이 없어 안전)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  // 가상 트래킹 표식이 붙은 거래 → 대상 investment_id 수집
  const { data: txns } = await admin.from('transactions')
    .select('id,investment_id,name').eq('user_id', user.id).like('memo', '%가상 트래킹%')
  const invIds = Array.from(new Set((txns ?? []).map(t => t.investment_id).filter((v): v is string => !!v)))
  const names = Array.from(new Set((txns ?? []).map(t => t.name).filter(Boolean)))

  if (invIds.length === 0) return NextResponse.json({ removed: 0, names: [] }, { headers: { 'Cache-Control': 'no-store' } })

  // 거래내역 먼저 삭제(FK 안전) → investments 삭제(본인 소유만)
  await admin.from('transactions').delete().eq('user_id', user.id).like('memo', '%가상 트래킹%')
  const { error } = await admin.from('investments').delete().eq('user_id', user.id).in('id', invIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ removed: invIds.length, names }, { headers: { 'Cache-Control': 'no-store' } })
}
