// 위성(10배거) 100종목 점수를 매일 미리 계산해 캐시 — 리밸런싱 요청의 라이브 fetch 제거
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { computeSatelliteScores, SAT_SCORE_KEY } from '@/lib/satelliteScreener'
import { fetchUsdKrw } from '@/lib/fx'
import { cronUnauthorized } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const denied = cronUnauthorized(req); if (denied) return denied   // fail-closed(비밀값이 비면 통과였다 · ?secret= 은 로그에 남아 폐지)
  const t0 = Date.now()
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fx = await fetchUsdKrw(base)
  const scored = await computeSatelliteScores(base, fx.rate)
  // 고정 환율로 잰 KR 시총(→$)은 시총룸 점수 구간을 바꾼다 — 36h 박제하지 않는다(헬스가 산출물 없음으로 잡아 재실행)
  const cached = scored.length > 0 && fx.live
  if (cached) await setCache(SAT_SCORE_KEY, scored)
  // cached:false 면 cron-health 가 복구 실패로 센다(200 이어도 산출물이 없다)
  return NextResponse.json(
    { ok: cached, cached, fxLive: fx.live, scored: scored.length, top: scored.slice(0, 8).map(s => `${s.ticker}:${s.tenScore}`), ms: Date.now() - t0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
