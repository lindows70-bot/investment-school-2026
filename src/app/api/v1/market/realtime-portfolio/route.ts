/**
 * GET /api/v1/market/realtime-portfolio
 *
 * ⚠️  현재 상태: DEMO / MOCK ONLY
 * ✅  실제 운영 연동 방법:
 *   1. 인증된 사용자의 Supabase investments 쿼리
 *   2. 각 ticker 실시간 주가: Yahoo Finance (US) / Naver fchart (KR)
 *   3. EPS: DART (KR) / FMP (US) API
 *   4. 아래 포맷으로 응답
 *
 * ✅  제1원칙: 특정 종목 하드코딩 금지
 */

// 빌드 시 정적 생성 금지 — 무거운 외부 fetch가 빌드 타임아웃을 내고(2026-08-01 실측: SEC·Yahoo 지연으로 빌드 실패) 데이터가 빌드 시점에 박제된다
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const MOCK_DEMO: Record<string, unknown> = {}

export async function GET() {
  return NextResponse.json(MOCK_DEMO, {
    headers: {
      'Cache-Control': 's-maxage=60',
      'X-Data-Source': 'mock-demo',
    },
  })
}
