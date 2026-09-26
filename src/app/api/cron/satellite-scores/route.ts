// 위성(10배거) 100종목 점수를 매일 미리 계산해 캐시 — 리밸런싱 요청의 라이브 fetch 제거
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { computeSatelliteScores, SAT_SCORE_KEY } from '@/lib/satelliteScreener'
import { fetchUsdKrw } from '@/lib/fx'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret)
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const t0 = Date.now()
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fx = await fetchUsdKrw(base)
  const scored = await computeSatelliteScores(base, fx.rate)
  // 고정 환율로 잰 KR 시총(→$)은 시총룸 점수 구간을 바꾼다 — 36h 박제하지 않는다(헬스가 산출물 없음으로 잡아 재실행)
  if (scored.length && fx.live) await setCache(SAT_SCORE_KEY, scored)
  return NextResponse.json(
    { ok: true, scored: scored.length, top: scored.slice(0, 8).map(s => `${s.ticker}:${s.tenScore}`), ms: Date.now() - t0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
