// 🎯 스윙 레이더 API — 오늘 자리가 온 종목(공개·일별 캐시·크론 워밍)
// 판정·백테스트 근거는 src/lib/swingSetup.ts + docs/swing-trade/context-notes.md
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildSwingRadar, type SwingRadar } from '@/lib/swingRadar'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const key = `swing-radar-v8:${kstDate()}`   // v8: 거래량 천장 경고(volCautions) / v7: 수익 인자 / v6: 트랙 D+하루 상한
  if (!refresh) {
    const cached = await getCache<SwingRadar>(key, 12 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const out = await buildSwingRadar(base)
  if ('error' in out) return NextResponse.json(out, { status: 200 })
  // ⚠️ 부분실패 박제 금지 — 캔들 성공률이 낮으면 "자리 없음"이 하루 박제된다(빈 목록은 사실이어야 한다)
  if (out.okCount >= 300) await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
