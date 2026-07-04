// 🏆 2026 상반기 수익률 챔피언십 — 로컬 러너(scripts/h1-champions.mjs)가 4시장 스캔 적재한 app_cache를 서빙.
// H1(1~6월)은 확정 과거라 값 불변. 웹앱은 읽기만(수천 종목 스캔은 Vercel 타임아웃 → 러너 경유).
import { NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'

export interface ChampStock { ticker: string; name: string; ret: number; series: { d: string; c: number }[] }
export interface H1ChampResult {
  period: string
  markets: { sp500: ChampStock[]; nasdaq: ChampStock[]; kospi: ChampStock[]; kosdaq: ChampStock[] }
  indices: Record<'sp500' | 'nasdaq' | 'kospi' | 'kosdaq', { d: string; v: number }[]>
  indexReturns: Record<'sp500' | 'nasdaq' | 'kospi' | 'kosdaq', number | null>
  asOf: string
}

export async function GET() {
  const data = await getCache<H1ChampResult>('h1-champions-2026', 365 * 24 * 3600_000)   // 확정 과거 — 장기 유효
  if (!data) return NextResponse.json({ error: '러너 미적재 — scripts/h1-champions.mjs 실행 필요' }, { status: 503 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
