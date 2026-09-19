// 🇺🇸 ETF 순자산·NAV 일별 스냅샷 크론(화~토 10:20 UTC) — 자금 흐름 역산의 재료. 80% 미만 성공이면 저장하지 않는다
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { snapshotEtfs, ETF_SNAP_MARK } from '@/lib/etfFlow'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET() {
  const t = Date.now()
  const r = await snapshotEtfs()
  const ok = r.skipped === 'weekend' || r.fail.length <= 8   // 주말 스킵도 '정상 실행'(마커 남김 — 월요일 stale 오탐 방지)
  if (ok) await setCache(ETF_SNAP_MARK(kstDate()), { at: new Date().toISOString(), day: r.day, ok: r.ok })
  return NextResponse.json({ ok, ms: Date.now() - t, day: r.day, saved: r.ok, fail: r.fail, skipped: r.skipped ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}
