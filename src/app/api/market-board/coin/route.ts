// 시장 탭 '코인' 공개 데이터 — 업비트 원화 마켓 상승·하락·거래대금 상위(종목 검색과 같은 60초 시세 캐시를 쓴다)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchCoinBoard } from '@/lib/upbitMarket'

export async function GET() {
  const board = await fetchCoinBoard(10)
  return NextResponse.json({
    board,
    basis: '업비트 원화 마켓 · 등락은 전일 종가(UTC 0시 = 한국 오전 9시) 대비 · 거래대금은 최근 24시간(억원)',
    failed: board.ok ? [] : ['board'],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
