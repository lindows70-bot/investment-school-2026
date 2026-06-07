// 매크로 국면 SSOT — FedWatch FF선물 방향 + FRED 레벨로 단일 결론 산출. 모든 매크로 화면이 이걸 읽음
import { NextResponse } from 'next/server'
import { fetchMacroData, detectMacroPhase } from '@/lib/macroPhaseScreener'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const data = await fetchMacroData(selfBase)
  const phase = detectMacroPhase(data)
  const rateDirLabel = data.rateDir === 'cut' ? '인하' : data.rateDir === 'hike' ? '인상' : '동결'
  return NextResponse.json(
    { fedRate: data.fedRate, cpiYoY: data.cpiYoY, yieldCurve: data.yieldCurve, hySpread: data.hySpread, rateDir: data.rateDir, rateDirLabel, ...phase },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
