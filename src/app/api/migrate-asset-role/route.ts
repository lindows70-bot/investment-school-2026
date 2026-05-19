/**
 * GET /api/migrate-asset-role
 *
 * investments 테이블에 asset_role 컬럼이 없으면 자동으로 추가합니다.
 * 앱 초기 로드 시 한 번만 호출되며, 이미 존재하면 아무것도 하지 않습니다.
 *
 * 컬럼: asset_role TEXT NOT NULL DEFAULT 'CORE' CHECK (asset_role IN ('CORE','SATELLITE'))
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'

export async function GET() {
  try {
    // service_role 키로 RLS를 우회하는 관리자 클라이언트 생성
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // ── 1. 컬럼 존재 여부 확인 ───────────────────────────────────────────
    const { error: checkErr } = await sb
      .from('investments')
      .select('asset_role')
      .limit(1)

    if (!checkErr) {
      // 이미 컬럼이 존재함 → 스킵
      return NextResponse.json({ status: 'already_exists' })
    }

    if (checkErr.code !== '42703') {
      // 42703 = undefined_column, 다른 에러면 예외 처리
      return NextResponse.json({ status: 'error', message: checkErr.message }, { status: 500 })
    }

    // ── 2. 컬럼 추가 (pg_catalog 우회 — Supabase Edge Function 없이 실행) ──
    // service_role을 통해 PostgREST로 직접 DDL을 실행할 수 없으므로,
    // 임시 방편으로 Supabase SQL API 엔드포인트를 직접 호출합니다.
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('.')[0].replace('https://', '')
    const sqlRes = await fetch(
      `https://${projectRef}.supabase.co/rest/v1/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          query: `ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS asset_role text NOT NULL DEFAULT 'CORE' CHECK (asset_role IN ('CORE','SATELLITE'))`
        }),
      }
    )

    if (sqlRes.ok) {
      return NextResponse.json({ status: 'migrated' })
    }

    // PostgREST 직접 DDL 불가 → SQL 실행 안내 반환
    return NextResponse.json({
      status: 'manual_required',
      sql: `ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS asset_role text NOT NULL DEFAULT 'CORE' CHECK (asset_role IN ('CORE','SATELLITE'));`,
      message: 'Supabase SQL Editor에서 위 SQL을 실행해 주세요.',
    })
  } catch (e) {
    return NextResponse.json({ status: 'error', message: String(e) }, { status: 500 })
  }
}
