// 매크로 국면 SSOT — FedWatch FF선물 방향 + FRED 레벨로 단일 결론 산출. 모든 매크로 화면이 이걸 읽음
import { NextResponse } from 'next/server'
import { fetchMacroData, detectMacroPhase } from '@/lib/macroPhaseScreener'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// 다음 FOMC ISO → 한국어 표기 + D-day (하드코딩 제거, FedWatch 일정 기반)
//   ⚠️ FOMC_SCHEDULE 의 date 는 **성명서 발표일 = 이틀 회의의 둘째 날**이다. 전엔 d~d+1 로 써서 10월 27~28일 회의가 "28~29일"로 나갔다(2026-10-18 6차 점검).
function fmtFomc(iso: string | null): { date: string; dDay: number } | null {
  if (!iso) return null
  const dt = new Date(`${iso}T00:00:00Z`)
  if (isNaN(dt.getTime())) return null
  const first = new Date(dt.getTime() - 86400_000)   // 회의 첫날(월 경계 안전)
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate()
  const sameMonth = first.getUTCMonth() === dt.getUTCMonth()
  const dDay = Math.max(0, Math.ceil((dt.getTime() - Date.now()) / 86400_000))
  return { date: sameMonth ? `${y}년 ${m}월 ${first.getUTCDate()}~${d}일` : `${y}년 ${first.getUTCMonth() + 1}월 ${first.getUTCDate()}일~${m}월 ${d}일`, dDay }
}

export async function GET(req: Request) {
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const data = await fetchMacroData(selfBase)
  const phase = detectMacroPhase(data)
  const rateDirLabel = data.rateDir === 'cut' ? '인하' : data.rateDir === 'hike' ? '인상' : '동결'
  return NextResponse.json(
    { fedRate: data.fedRate, cpiYoY: data.cpiYoY, cpiMonth: data.cpiMonth, yieldCurve: data.yieldCurve, hySpread: data.hySpread, rateDir: data.rateDir, rateDirLabel, nextFomc: fmtFomc(data.nextFomc), ...phase },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
