// 크론 헬스 모니터 API — 미발화 감지 + 자동 복구, 일반 GET은 보고만
//    복구는 크론 호출(Authorization=CRON_SECRET)일 때만 · idempotent · 240s 예산.
//    ⏱ 하루 3회(09:40·12:40·15:40 KST) — 한 번의 예산으로는 무거운 스캔 1개만 복구되므로
//       패스를 나눠 굶는 항목이 없게 한다(2026-08-08: 1회 실행일 때 hi52·breadth가 종일 stale).
//    브리핑 페이지가 이 API를 읽어 stale이 있으면 상단 빨간 줄 표시.
import { NextResponse } from 'next/server'
import { runHealthChecks, CRON_MONITORS, type HealthCheck } from '@/lib/cronHealth'
import { setCache, purgeStaleCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const HEAL_BUDGET_MS = 240_000
// 🧹 app_cache 정리 — 3번째 패스(15:40 KST)에서만, 복구가 끝난 뒤 남은 시간 안에서(허용 목록 접두어의 오래된 행만 · lib/cachePurge)
//    2026-09-26: 지우는 장치가 없어 날짜 키가 쌓여 DB 무료 한도(500 MB)를 넘겼다. 새 크론을 늘리지 않고 여기 붙인다.
const PURGE_BUDGET_MS = 20_000
const PURGE_DEADLINE_MS = 280_000   // maxDuration 300s 안에서 끝낸다

export async function GET(req: Request) {
  const started = Date.now()
  const secret = process.env.CRON_SECRET
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  let checks = await runHealthChecks()
  const healed: string[] = []
  const healFailed: string[] = []

  if (isCron) {
    // 복구 대상: stale + heal 경로 보유.
    // ⚠️ 정렬을 '항상 같은 순서(CRON_MONITORS 배열)'로 두면 앞의 무거운 크론이 예산을 다 먹고
    //    뒤의 것은 매일 타임아웃/스킵돼 **영영 복구되지 않는다**(실측 2026-08-08: winLose가 먼저
    //    시도되고 hi52·breadth는 남은 예산 부족으로 하루 종일 stale). 라운드로빈이 아니라
    //    **가장 오래 방치된 것 우선**으로 정렬해 굶는 항목이 생기지 않게 한다.
    //    (산출물이 아예 없는 것 = lastRun null 이 가장 시급 → 0으로 최우선)
    const staleWithHeal = checks
      .filter(c => c.status === 'stale')
      .map(c => ({ c, m: CRON_MONITORS.find(m => m.id === c.id)! }))
      .filter(x => x.m?.heal)
      .sort((a, b) => {
        const at = a.c.lastRun ? new Date(a.c.lastRun).getTime() : 0
        const bt = b.c.lastRun ? new Date(b.c.lastRun).getTime() : 0
        return at - bt
      })

    for (const { c, m } of staleWithHeal) {
      const remain = HEAL_BUDGET_MS - (Date.now() - started)
      if (remain < 30_000) break
      if (m.heavy && remain < 120_000) continue   // 무거운 크론은 2분 이상 남을 때만
      try {
        const r = await fetch(`${base}${m.heal}`, {
          headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
          cache: 'no-store',
          signal: AbortSignal.timeout(Math.min(remain - 10_000, 180_000)),
        })
        if (r.ok) healed.push(c.id)
        else healFailed.push(c.id)
      } catch { healFailed.push(c.id) }
    }

    if (healed.length) {
      // 복구 후 재판정(성공한 것은 ok로 바뀜)
      checks = await runHealthChecks()
    }
  }

  // 정리는 헬스 판정과 무관 — 실패해도 조용히(결과만 남긴다)
  let purge: Awaited<ReturnType<typeof purgeStaleCache>> | null = null
  const pass = new URL(req.url).searchParams.get('pass')
  if (isCron && pass === '3') {
    const remain = PURGE_DEADLINE_MS - (Date.now() - started)
    if (remain > 5_000) purge = await purgeStaleCache(Math.min(PURGE_BUDGET_MS, remain)).catch(() => null)
  }

  const withHealed: HealthCheck[] = checks.map(c => healed.includes(c.id) ? { ...c, healed: true } : c)
  const staleCount = withHealed.filter(c => c.status === 'stale').length
  const result = {
    asOf: new Date().toISOString(),
    staleCount,
    healed,
    healFailed,
    checks: withHealed,
    purge,
  }

  // 최신 보고 저장(운영 추적용 — 브리핑은 라이브 판정을 씀)
  if (isCron) await setCache('cron-health-latest', result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
