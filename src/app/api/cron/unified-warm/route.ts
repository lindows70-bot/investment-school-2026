// 통합추천을 매일 미리 계산 — 선생님 계정 먼저(브리핑 '담을 것' · 핵심 추천 성적 적립이 읽는다), 남는 예산으로 학생 계정
//   2026-10-09: 누가 화면을 열 때만 계산돼(9/19·9/20·10/2·10/7) 브리핑이 매일 아침 '모으는 중' 1분 이상 · 적립이 `no-unified-today` 로 건너뛰었다.
//   ⏰ 07:20 KST — 6축이 읽는 섹터 로테이션(07:00 크론) 뒤 · 선생님이 브리핑을 여는 아침 전.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cronUnauthorized } from '@/lib/cronAuth'
import { setCache } from '@/lib/appCache'
import { computeUnifiedReco, UNIFIED_WARM_MARK } from '@/lib/unifiedReco'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUDGET_MS = 240_000   // 한 계정이 보통 60~90초(콜드) · 안쪽 캐시가 데워지면 그 뒤는 빠르다. 못 돈 계정은 첫 방문 때 같은 경로로 계산
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const denied = cronUnauthorized(req); if (denied) return denied
  const t0 = Date.now()
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (u, o) => fetch(u as RequestInfo, { ...o, cache: 'no-store' }) } })

  // 종목을 하나라도 넣은 계정만(통합추천은 보유를 빼고 추천한다 — 보유 0 이면 화면도 쓰지 않는다) · 선생님 먼저
  const { data: profiles, error } = await sb.from('profiles').select('id, role')
  if (error) return NextResponse.json({ ok: false, cached: false, error: error.message }, { status: 500 })
  const { data: invs, error: invErr } = await sb.from('investments').select('user_id')
  if (invErr) return NextResponse.json({ ok: false, cached: false, error: invErr.message }, { status: 500 })
  const hasInv = new Set((invs ?? []).map(r => r.user_id as string))
  const order = (profiles ?? [])
    .filter(p => hasInv.has(p.id))
    .sort((a, b) => Number(b.role === 'teacher') - Number(a.role === 'teacher'))

  const done: { id: string; role: string; fromCache: boolean; stored: boolean; items: number; ms: number }[] = []
  let left = 0, failed = 0
  for (const p of order) {
    if (Date.now() - t0 > BUDGET_MS) { left++; continue }
    const s = Date.now()
    try {
      const r = await computeUnifiedReco(p.id, base)
      done.push({ id: p.id.slice(0, 8), role: p.role, fromCache: r.fromCache, stored: r.stored, items: r.body.items.length, ms: Date.now() - s })
    } catch { failed++ }
  }

  // 실행 마커 — 첫 계정(선생님)이 오늘 결과를 갖게 됐을 때만(캐시든 새 계산이든). warming(유니버스 없음)이면 마커를 안 남겨 상태판이 다음 패스에 다시 부른다
  const first = done[0]
  const ok = !!first && (first.fromCache || first.stored)
  if (ok) await setCache(UNIFIED_WARM_MARK(kstDate()), { at: new Date().toISOString(), done, failed, left })
  return NextResponse.json({ ok, cached: ok, done, failed, left, ms: Date.now() - t0 }, { headers: { 'Cache-Control': 'no-store' } })
}
