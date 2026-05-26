/**
 * POST /api/migrate-asset-roles
 *
 * 기존 투자 데이터의 asset_role을 classifyAsset 로직으로 소급 재분류합니다.
 *
 * ◆ 실행 조건
 *  - service_role 키로 전체 investments 조회 (RLS 우회)
 *  - classifyAsset(ticker, name, market) 결과와 현재 asset_role 비교
 *  - 불일치 or null 인 경우 → DB 업데이트
 *
 * ◆ 응답
 *  { total: number, updated: number, unchanged: number, details: string[] }
 */
export const dynamic = 'force-dynamic'

import { NextResponse }              from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { classifyAsset }              from '@/lib/classifyAsset'

// ── service_role 클라이언트 ──────────────────────────────────────
function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export interface MigrateResult {
  total:     number
  updated:   number
  unchanged: number
  details:   string[]   // 변경된 항목 요약 로그
  error?:    string
}

export async function POST() {
  const sb = adminClient()

  // ── 1. 전체 investments 조회 ──────────────────────────────────
  const { data: invs, error } = await sb
    .from('investments')
    .select('id, ticker, name, market, asset_role')

  if (error) {
    return NextResponse.json(
      { total: 0, updated: 0, unchanged: 0, details: [], error: error.message } satisfies MigrateResult,
      { status: 500 }
    )
  }

  const investments = invs ?? []
  let updated   = 0
  let unchanged = 0
  const details: string[] = []

  // ── 2. 배치 업데이트 처리 ────────────────────────────────────
  // 한 번에 전체를 PATCH → DB 부하 최소화 (upsert 배열)
  const toUpdate: { id: string; asset_role: 'CORE' | 'SATELLITE' }[] = []

  for (const inv of investments) {
    const market = (inv.market ?? 'KR') as 'US' | 'KR' | 'CRYPTO'
    const classified = classifyAsset(inv.ticker ?? '', inv.name ?? '', market)
    const current    = inv.asset_role as 'CORE' | 'SATELLITE' | null

    if (current !== classified) {
      toUpdate.push({ id: inv.id, asset_role: classified })
      details.push(
        `[${current ?? 'null'} → ${classified}] ${inv.name ?? inv.ticker} (${inv.ticker}, ${market})`
      )
    } else {
      unchanged++
    }
  }

  // ── 3. Supabase 배치 업데이트 (30개씩 청크) ──────────────────
  const CHUNK = 30
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK)

    // Supabase는 배열 upsert를 지원하므로 한 번의 호출로 처리
    const { error: upErr } = await sb
      .from('investments')
      .upsert(chunk, { onConflict: 'id' })

    if (upErr) {
      console.error('[migrate-asset-roles] 배치 업데이트 오류:', upErr.message)
      // 실패 청크는 건너뜀 (개별 롤백 불필요)
    } else {
      updated += chunk.length
    }
  }

  const result: MigrateResult = {
    total:     investments.length,
    updated,
    unchanged,
    details,
  }

  console.log(`[migrate-asset-roles] 완료: 전체 ${investments.length}개 | 업데이트 ${updated}개 | 유지 ${unchanged}개`)
  return NextResponse.json(result)
}
