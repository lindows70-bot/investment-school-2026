// 🛰️ AI 1억 백지 퀀트 빌더 API — 설계 본체는 lib/quantBuilder(SSOT), 여기는 인증+전달만
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildQuantPlan } from '@/lib/quantBuilder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cookie = req.headers.get('cookie') ?? ''
  const result = await buildQuantPlan(base, cookie)
  if (!result) return NextResponse.json({ error: 'build_failed' }, { status: 502 })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
