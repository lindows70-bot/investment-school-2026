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
