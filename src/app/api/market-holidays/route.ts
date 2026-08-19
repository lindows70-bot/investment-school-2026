// 📅 올해 시장 휴장일 API — MARKET HOURS 배지용(KRX 특일+규칙 · NYSE 결정론). kr=null 이면 키 미등록(fail-open)
import { NextResponse } from 'next/server'
import { krxHolidays, nyseHolidays } from '@/lib/marketHolidays'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date(Date.now() + 9 * 3600_000)      // KST 기준 연도
  const year = now.getUTCFullYear()
  const kr = await krxHolidays(year)
  // 연말·연초 경계: 12월엔 내년 초 NYSE 휴일도 함께 준다(1/1 판정이 해 바뀌는 순간 비지 않게)
  const us = [...Array.from(nyseHolidays(year)), ...Array.from(nyseHolidays(year + 1))].sort()
  return NextResponse.json(
    { year, kr, us },
    // ⚠️ kr=null(키 미등록·API 실패)은 **부분실패** — 캐시하면 활용신청을 마쳐도 1시간 동안 옛 null 이
    //    서빙된다(2026-08-19 실사고: 신청 직후 API 는 정상인데 화면 캐비엇만 '美' 로 남았다).
    { headers: { 'Cache-Control': kr ? 'public, max-age=3600' : 'no-store' } },
  )
}
