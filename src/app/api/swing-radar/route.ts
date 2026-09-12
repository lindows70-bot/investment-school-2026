// 🎯 스윙 레이더 API — 오늘 자리가 온 종목(공개·일별 캐시·크론 워밍)
// 판정·백테스트 근거는 src/lib/swingSetup.ts + docs/swing-trade/context-notes.md
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildSwingRadar, type SwingRadar } from '@/lib/swingRadar'
import { SWING_CRON_MARK } from '@/lib/swingHistory'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  // v11: 채점을 **규칙 준수**(손절선 이탈 시 그 가격에 종료) 기준으로 — recent 에 retHoldPct 필드가 늘어난다
  //      (스키마 확장도 키를 올린다: 옛 응답이 서빙되면 새 필드가 통째로 undefined 로 온다)
  // v12: 🧭 섹터 로테이션 결합 — items[].rot 필드 신설 + 이탈 섹터 후순위·경고(스키마 확장 = 키 범프)
  // v13: 🕯️ 완성 봉만 판정(진행 중 봉 제거) · 진입일=신호 봉 날짜 · barDate/signalDate 필드 신설 — 판정 결과가 바뀌므로 범프
  // v14: 트랙 켜짐을 상한 절단 전 목록으로 판정 · 해외 상장 제외(skippedForeign 필드) · 크론 실행 마커
  const key = `swing-radar-v14:${kstDate()}`  // v13: 완성 봉만 판정 / v11: 규칙 준수 채점 / v10: 학생 보유 종목 스캔 포함
  if (!refresh) {
    const cached = await getCache<SwingRadar>(key, 12 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const out = await buildSwingRadar(base)
  if ('error' in out) return NextResponse.json(out, { status: 200 })
  // ⚠️ 부분실패 박제 금지 — 캔들 성공률이 낮으면 "자리 없음"이 하루 박제된다(빈 목록은 사실이어야 한다)
  if (out.okCount >= 300) {
    await setCache(key, out)
    // 🕰️ 크론 실행 마커 — 결과 캐시의 updated_at 은 저녁 방문자 재생성에 덮여 "아침 크론이 실패했다"를 못 가른다
    //    (2026-09-11 실사고: 06:15 산출물 없이 22:38 방문자가 만들었는데 헬스는 ok). 크론(refresh=1)만 이 마커를 남긴다.
    if (refresh) await setCache(SWING_CRON_MARK(kstDate()), { at: out.asOf })
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
