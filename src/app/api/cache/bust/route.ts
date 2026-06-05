// 보유종목 변경(매수/매도) 직후 호출 — 로그인 사용자의 조립 캐시를 즉시 무효화
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bustUserCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const busted = await bustUserCache(user.id)
  return NextResponse.json({ ok: true, busted })
}
