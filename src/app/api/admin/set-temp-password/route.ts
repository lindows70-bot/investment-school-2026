/**
 * POST /api/admin/set-temp-password
 *
 * Supabase Admin API 로 임시 비밀번호를 직접 설정합니다.
 * teacher 계정만 호출 가능합니다.
 *
 * Body: { userId: string, email: string }
 * Response: { tempPassword: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

// 임시 비밀번호 생성: 영문+숫자 조합 8자 (학생이 입력하기 쉬운 형태)
function generateTempPassword(): string {
  const prefix = '투자학교'   // 학교 이름 기억하기 쉽게
  const nums   = Math.floor(1000 + Math.random() * 9000)  // 4자리 랜덤 숫자
  return `${prefix}${nums}`   // 예: 투자학교5283
}

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json()
    if (!userId || !email) {
      return NextResponse.json({ error: 'userId와 email이 필요합니다' }, { status: 400 })
    }

    // ── 호출자가 teacher인지 확인 (클라이언트 토큰 검증)
    const authHeader = req.headers.get('Authorization') ?? ''
    const token      = authHeader.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // service_role 클라이언트 (비번 직접 변경 권한)
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 호출자 role 검증
    const { data: { user: caller } } = await adminClient.auth.getUser(token)
    if (!caller) {
      return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 401 })
    }
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'teacher') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    // ── 임시 비밀번호 생성 및 설정
    const tempPassword = generateTempPassword()

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    })

    if (error) {
      console.error('[set-temp-password]', error)
      return NextResponse.json(
        { error: `비밀번호 설정 실패: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ tempPassword, email })

  } catch (err) {
    console.error('[set-temp-password] error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
