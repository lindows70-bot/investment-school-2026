// 유령 종목을 매일 미리 계산 — 미보유 발굴(공유 캐시) + 전 학생 보유 주식의 종목별 행(app_cache ghost-row-v1)
//   2026-10-07: 크론이 없어 캐시가 빈 날 처음 여는 사람이 105초를 기다렸다. 결과는 화면이 쓰는 것과 같은 함수(lib/ghostStock).
//   ⏰ 00:05 KST — 화면이 '오늘(KST)' 행만 쓰므로 KST 날이 바뀐 직후에 채워야 하루 종일 맞는다.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cronUnauthorized } from '@/lib/cronAuth'
import { setCache } from '@/lib/appCache'
import { getAssetClassification } from '@/lib/assetClassifier'
import { buildGhostRecord, buildDiscovery, readGhostRows, saveGhostRows, GHOST_WARM_MARK, type GhostCacheRow } from '@/lib/ghostStock'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUDGET_MS = 240_000   // 남은 종목은 다음 날 또는 첫 방문자가 계산한다(화면과 같은 경로)
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const denied = cronUnauthorized(req); if (denied) return denied
  const t0 = Date.now()
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (u, o) => fetch(u as RequestInfo, { ...o, cache: 'no-store' }) } })

  // ① 미보유 발굴 — 화면이 그대로 읽는 공유 캐시(이미 있으면 즉시 끝난다)
  const discovery = await buildDiscovery().catch(() => [] as Omit<GhostCacheRow, 'updated_at'>[])

  // ② 전 학생 보유 주식(중복 제거) — 화면과 같은 분류 기준(STOCK 만)
  const { data: invs, error } = await sb.from('investments').select('ticker, name, market, lynch_category')
  if (error) return NextResponse.json({ ok: false, cached: false, error: error.message }, { status: 500 })
  const uniq = new Map<string, { ticker: string; name: string; market: string; lynch: string }>()
  for (const h of invs ?? []) {
    const t = String(h.ticker ?? '').toUpperCase()
    if (!t || uniq.has(t)) continue
    if (!getAssetClassification(h.ticker, h.name, h.market ?? 'US').isAnalyzable) continue
    uniq.set(t, { ticker: t, name: h.name, market: h.market ?? 'US', lynch: h.lynch_category ?? '' })
  }

  // ③ 오늘(KST) 행이 이미 있는 종목은 건너뛴다 — 화면의 캐시 HIT 판정과 같은 함수
  const fresh = await readGhostRows(Array.from(uniq.keys()))
  const todo = Array.from(uniq.values()).filter(h => !fresh.has(h.ticker))

  const built: Omit<GhostCacheRow, 'updated_at'>[] = []
  let failed = 0
  const q = [...todo]
  async function worker() {
    while (q.length && Date.now() - t0 < BUDGET_MS) {
      const h = q.shift(); if (!h) break
      try { built.push(await buildGhostRecord(h.ticker, h.name, h.market, h.lynch)) }
      catch { failed++ }   // 커버리지 미확인 종목은 정직 생략(화면과 같다 — 가짜 행 금지)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  if (built.length) await saveGhostRows(built)

  const left = q.length
  // 실행 마커 — 발굴이 비지 않았을 때만(위성 크론이 콜드면 발굴이 빈다 → 상태판이 다음 패스에 다시 부른다)
  const ok = discovery.length > 0
  if (ok) await setCache(GHOST_WARM_MARK(kstDate()), { at: new Date().toISOString(), holdings: uniq.size, built: built.length, skippedFresh: fresh.size, failed, left })
  return NextResponse.json(
    { ok, cached: ok, discovery: discovery.length, holdings: uniq.size, skippedFresh: fresh.size, built: built.length, failed, left, ms: Date.now() - t0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
