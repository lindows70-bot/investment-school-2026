/**
 * POST /api/lynch-batch
 * 선생님 전용 — 모든 학생의 미분류 종목(ETF·CRYPTO 제외) 피터린치 일괄 분류
 *
 * 동작 원리:
 *  1. 선생님 세션으로 모든 investments SELECT (teacher_reads_all_investments 정책 필요)
 *  2. 각 종목에 lynch-classify API 호출
 *  3. SUPABASE_SERVICE_ROLE_KEY 있으면 서비스 롤로 UPDATE (RLS 우회)
 *     없으면 → 분류 결과만 반환하고 각 학생이 앱 열 때 자동 적용됨
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const ETF_BRANDS = ['TIGER','KODEX','ACE','PLUS','KBSTAR','HANARO','ARIRANG','SOL','RISE','1Q','ETF']
function isEtfByName(name: string): boolean {
  return ETF_BRANDS.some(b => name.toUpperCase().includes(b))
}

export async function POST() {
  const cookieStore = cookies()

  // 선생님 세션 확인
  const sbSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await sbSession.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await sbSession.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '선생님 전용' }, { status: 403 })
  }

  // UPDATE용 클라이언트: service role key 있으면 RLS 우회, 없으면 일반 세션
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sbUpdate = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : sbSession   // fallback: 선생님 세션 (UPDATE 정책 필요)

  // 미분류 종목 전체 조회
  const { data: invs, error } = await sbSession
    .from('investments')
    .select('id, user_id, ticker, name, market, lynch_category')
    .neq('market', 'CRYPTO')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const targets = (invs ?? []).filter(inv =>
    (!inv.lynch_category || inv.lynch_category === 'na') && !isEtfByName(inv.name)
  )

  let updated = 0, skipped = 0
  const details: { ticker: string; name: string; category: string }[] = []
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  for (const inv of targets) {
    try {
      const res = await fetch(
        `${base}/api/lynch-classify?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`,
        { cache: 'no-store' }
      )
      if (!res.ok) { skipped++; continue }

      const { category, isEtf } = await res.json()
      if (isEtf || !category || category === 'na') {
        skipped++
        details.push({ ticker: inv.ticker, name: inv.name, category: isEtf ? 'ETF-skip' : 'no-cat' })
        continue
      }

      const { error: upErr } = await sbUpdate
        .from('investments')
        .update({ lynch_category: category })
        .eq('id', inv.id)

      if (upErr) {
        skipped++
        details.push({ ticker: inv.ticker, name: inv.name, category: `RLS-err:${upErr.code}` })
      } else {
        updated++
        details.push({ ticker: inv.ticker, name: inv.name, category })
      }
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      skipped++
      details.push({ ticker: inv.ticker, name: inv.name, category: `err:${(e as Error).message}` })
    }
  }

  return NextResponse.json({
    updated, skipped, total: targets.length,
    note: !serviceKey && skipped > 0
      ? 'SUPABASE_SERVICE_ROLE_KEY 미설정: RLS로 인해 일부 업데이트 실패. 학생들이 앱을 열면 자동 분류됩니다.'
      : undefined,
    details
  })
}
