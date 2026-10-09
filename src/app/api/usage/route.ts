// 화면·탭 열람 1건 기록(로그인 사용자) — 본문 { kind: 'page'|'tab', key } · 집계는 lib/usageLog(월별 app_cache)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordUsage, type UsageKind } from '@/lib/usageLog'

export const dynamic = 'force-dynamic'

const KEY_RE = /^[A-Za-z0-9_\-/]{1,80}$/   // 경로·탭 이름만(쿼리·한글 없음 — 저장 크기와 키 수를 묶는다)

export async function POST(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  let kind: UsageKind | null = null, key: string | null = null
  try {
    const b = await req.json()
    if (b?.kind === 'page' || b?.kind === 'tab') kind = b.kind
    if (typeof b?.key === 'string' && KEY_RE.test(b.key)) key = b.key
  } catch { /* 본문 없음 */ }
  if (!kind || !key) return NextResponse.json({ ok: false }, { status: 400 })
  await recordUsage(kind, key, user.id).catch(() => {})   // 집계 실패는 화면에 영향 없음
  return NextResponse.json({ ok: true })
}
