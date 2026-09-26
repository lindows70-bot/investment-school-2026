// 로그인 사용자의 오늘(KST) 첫 접속을 하루 1행으로 남기는 API — 테이블이 없으면 조용히 needsSetup
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { kstDate } from '@/lib/schoolIndex'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    let path: string | null = null
    try { const b = await req.json(); path = typeof b?.path === 'string' ? b.path.slice(0, 200) : null } catch { /* 본문 없음 */ }
    const { error } = await sb.from('student_visits').insert({ user_id: user.id, visit_date: kstDate(), first_path: path })
    if (!error || error.code === '23505') return NextResponse.json({ ok: true })            // 23505 = 오늘 이미 기록
    if (error.code === '42P01' || error.code === 'PGRST205') return NextResponse.json({ ok: false, needsSetup: true })
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
  } catch {
    return NextResponse.json({ ok: false, reason: 'exception' }, { status: 500 })
  }
}
