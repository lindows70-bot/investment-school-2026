/**
 * GET /api/school-index
 *
 * 🏫 투자학교 13F 인덱스 — 최신 스냅샷 서빙 (서비스롤 · RLS 무관)
 *
 * 두 스냅샷 테이블(school_index_stock_snapshots·_sector_snapshots)의 가장 최신 base_date
 * 데이터를 반환. 익명 집계(개인 식별 불가)라 로그인 학생 모두에게 동일하게 노출.
 *
 * ⚠️ 클라이언트 RLS 조회 대신 이 라우트(service role)로 서빙 — RLS 정책 상태와 무관하게 안정.
 *    테이블 미존재/빈 데이터/에러는 graceful(빈 배열) — 프론트 폴백뷰 트리거.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export interface SchoolIndexStock {
  ticker: string; stock_name: string | null; gics_sector: string | null
  avg_weight: number; student_count: number; weight_change: number
}
export interface SchoolIndexSector { gics_sector: string; avg_weight: number }
export interface SchoolIndexResponse {
  baseDate: string | null
  stocks: SchoolIndexStock[]
  sectors: SchoolIndexSector[]
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  const empty: SchoolIndexResponse = { baseDate: null, stocks: [], sectors: [] }
  try {
    const db = admin()
    if (!db) return NextResponse.json(empty)

    // 최신 base_date
    const { data: latest } = await db
      .from('school_index_stock_snapshots')
      .select('base_date').order('base_date', { ascending: false }).limit(1).maybeSingle()
    const baseDate = latest?.base_date as string | undefined
    if (!baseDate) return NextResponse.json(empty)

    const [{ data: stocks }, { data: sectors }] = await Promise.all([
      db.from('school_index_stock_snapshots')
        .select('ticker,stock_name,gics_sector,avg_weight,student_count,weight_change')
        .eq('base_date', baseDate).order('avg_weight', { ascending: false }),
      db.from('school_index_sector_snapshots')
        .select('gics_sector,avg_weight')
        .eq('base_date', baseDate).order('avg_weight', { ascending: false }),
    ])

    const res: SchoolIndexResponse = {
      baseDate,
      stocks: (stocks ?? []) as SchoolIndexStock[],
      sectors: (sectors ?? []) as SchoolIndexSector[],
    }
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.warn('[school-index]', (e as Error).message)
    return NextResponse.json(empty)
  }
}
