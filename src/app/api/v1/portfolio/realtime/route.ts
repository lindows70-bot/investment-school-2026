/**
 * GET /api/v1/portfolio/realtime
 *
 * ⚠️  현재 상태: DEMO / MOCK ONLY
 * ✅  실제 운영 연동 방법:
 *   1. Supabase에서 현재 로그인 학생의 investments 쿼리
 *   2. 각 ticker별 Yahoo Finance (US) / Naver (KR) 현재가 조회
 *   3. DART / FMP API에서 분기별 EPS 수집
 *   4. 조합하여 아래 포맷으로 반환
 *
 * ✅  제1원칙: 특정 종목 하드코딩 금지
 *   - 아래 MOCK_DATA는 개발/데모용으로만 사용
 *   - 프로덕션에서는 DB 쿼리 결과로 반환해야 함
 */

import { NextResponse } from 'next/server'

// ── DEMO 데이터 (개발용 — 특정 종목 의존 없이 포맷 확인 목적)
// 실제로는 Supabase investments 테이블 + 실시간 주가 API 로 교체
const MOCK_DEMO: Record<string, unknown> = {
  /* 예시 포맷:
  'TICKER': {
    name: '종목명',
    category: '린치 카테고리',
    multiple: 적정PER배수,
    isKrw: false,
    currentPrice: 실시간주가,  // Yahoo Finance 등에서 조회
    history: [
      { date: 'YY-QN', price: 분기평균가, eps: 분기EPS },
      ...
    ]
  }
  */
}

export async function GET() {
  // TODO: 아래 로직으로 교체
  // const sb = createServerSupabaseClient()
  // const user = await sb.auth.getUser()
  // const { data: investments } = await sb.from('investments').select('*').eq('user_id', user.id)
  // const liveData = await buildLiveTerminalData(investments)
  // return NextResponse.json(liveData)

  return NextResponse.json(MOCK_DEMO, {
    headers: {
      'Cache-Control': 's-maxage=60',
      'X-Data-Source': 'mock-demo',
    },
  })
}
