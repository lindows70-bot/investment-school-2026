// 크론 헬스 모니터 API — 매일 09:40 KST 크론이 미발화 감지 + 경량 크론 자동 복구, 일반 GET은 보고만
//    복구는 크론 호출(Authorization=CRON_SECRET)일 때만 · idempotent 경량 크론 화이트리스트 · 240s 예산.
//    브리핑 페이지가 이 API를 읽어 stale이 있으면 상단 빨간 줄 표시.
import { NextResponse } from 'next/server'
import { runHealthChecks, CRON_MONITORS, type HealthCheck } from '@/lib/cronHealth'
import { setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const HEAL_BUDGET_MS = 240_000

export async function GET(req: Request) {
  const started = Date.now()
  const secret = process.env.CRON_SECRET
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  let checks = await runHealthChecks()
  const healed: string[] = []
  const healFailed: string[] = []

  if (isCron) {
    // 복구 대상: stale + heal 경로 보유. 경량 먼저 → 무거운 것(morning-briefing)은 예산 남을 때만
    const staleWithHeal = checks
      .filter(c => c.status === 'stale')
      .map(c => ({ c, m: CRON_MONITORS.find(m => m.id === c.id)! }))
      .filter(x => x.m?.heal)
      .sort((a, b) => Number(!!a.m.heavy) - Number(!!b.m.heavy))

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

  const withHealed: HealthCheck[] = checks.map(c => healed.includes(c.id) ? { ...c, healed: true } : c)
  const staleCount = withHealed.filter(c => c.status === 'stale').length
  const result = {
    asOf: new Date().toISOString(),
    staleCount,
    healed,
    healFailed,
    checks: withHealed,
  }

  // 최신 보고 저장(운영 추적용 — 브리핑은 라이브 판정을 씀)
  if (isCron) await setCache('cron-health-latest', result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
