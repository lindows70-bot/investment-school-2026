// 🐎 신고가 레이더 API — '달리는 말' 분석(공개·일별 캐시·크론 워밍)
// 판정·백테스트 근거는 src/lib/hi52Radar.ts + docs/hi52-radar/context-notes.md
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildHi52Radar, type Hi52Radar } from '@/lib/hi52Radar'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh') === '1'   // 크론 워밍·수동 강제 재계산(research-verdict 교훈: refresh 미지원 라우트는 검증이 캐시에 속는다)
  const key = `hi52-radar-v2:${kstDate()}`   // v2: origin(실제 국적) 필드 추가
  if (!refresh) {
    const cached = await getCache<Hi52Radar>(key, 12 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }
  const out = await buildHi52Radar()
  if ('error' in out) return NextResponse.json(out, { status: 200 })
  // ⚠️ 부분실패 박제 금지 — 캔들 성공률이 절반 미만이면 오늘 캐시에 박제하지 않는다(다음 요청이 재시도)
  if (out.okCount >= 300) await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
