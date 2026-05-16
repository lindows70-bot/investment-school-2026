/**
 * POST /api/admin/delete-user
 * 관리자 전용 — 학생 계정 완전 삭제
 *
 * Body: { userId: string }
 * 순서: investments → transactions → profiles → auth.users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()

  // ── 1. 호출자가 선생님인지 확인 ──────────────────────────────
  const sbSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await sbSession.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await sbSession.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '관리자만 사용 가능합니다' }, { status: 403 })
  }

  // ── 2. 삭제할 userId 파싱 ──────────────────────────────────
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  // 자기 자신은 삭제 불가
  if (userId === user.id) {
    return NextResponse.json({ error: '자신의 계정은 삭제할 수 없습니다' }, { status: 400 })
  }

  try {
    // ── 3. 관련 데이터 삭제 (anon key로 가능한 것들) ───────────
    // transactions, investments, watchlist 등 cascade
    await sbSession.from('transactions').delete().eq('user_id', userId)
    await sbSession.from('investments').delete().eq('user_id', userId)

    // watchlist 테이블이 있으면 삭제
    await sbSession.from('watchlist').delete().eq('user_id', userId).then(() => {})

    // lounge_comments, lounge_posts 삭제
    await sbSession.from('lounge_comments').delete().eq('user_id', userId).then(() => {})
    await sbSession.from('lounge_posts').delete().eq('user_id', userId).then(() => {})

    // profiles 삭제
    const { error: profileErr } = await sbSession.from('profiles').delete().eq('id', userId)
    if (profileErr) console.warn('[DeleteUser] profiles delete:', profileErr.message)

    // ── 4. auth.users 삭제 (service role key 필요) ────────────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      const sbAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { error: authErr } = await sbAdmin.auth.admin.deleteUser(userId)
      if (authErr) {
        console.error('[DeleteUser] auth.users delete failed:', authErr.message)
        // profiles는 이미 지워졌으므로 로그인은 불가 — 부분 성공으로 처리
        return NextResponse.json({
          success: true,
          warning: 'auth.users 삭제 실패 (로그인은 불가하나 기록이 남습니다). SUPABASE_SERVICE_ROLE_KEY를 확인하세요.',
        })
      }
    } else {
      // service role key 없음 → profiles 삭제로 사실상 비활성화 (로그인 불가)
      return NextResponse.json({
        success: true,
        warning: 'SUPABASE_SERVICE_ROLE_KEY 미설정: auth.users는 남아있으나 profiles/investments가 삭제되어 로그인 후 빈 상태입니다.',
      })
    }

    return NextResponse.json({ success: true })

  } catch (e) {
    console.error('[DeleteUser] fatal:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
