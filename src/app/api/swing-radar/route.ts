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
  // v11: 채점을 **규칙 준수**(손절선 이탈 시 그 가격에 종료) 기준으로 — recent 에 retHoldPct 필드가 늘어난다
  //      (스키마 확장도 키를 올린다: 옛 응답이 서빙되면 새 필드가 통째로 undefined 로 온다)
  const key = `swing-radar-v11:${kstDate()}`  // v10: 학생 보유 종목 스캔 포함 / v9: 트랙 D 추격 가드+성적 갱신
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
