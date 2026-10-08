// 🎯 통합 3축 추천 — 로그인 사용자 기준으로 계산(lib/unifiedReco · 매일 워밍 크론과 같은 함수). 타입은 예전 import 경로가 깨지지 않게 다시 내보낸다
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeUnifiedReco } from '@/lib/unifiedReco'

export type { UnifiedRecoItem, RegionRefItem, WatchCandidate, UnifiedRecoResult } from '@/lib/unifiedReco'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const { body } = await computeUnifiedReco(user.id, base)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
