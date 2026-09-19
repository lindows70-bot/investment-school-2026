// 🇺🇸 내부자 매수 수집 크론(매시간) — SEC 일별 인덱스의 Form 4 를 예산(건수·시간) 안에서 증분 처리. 커서 = 처리한 accession 집합(멱등)
//    하루 2,000건짜리 날은 300초에 못 끝나므로(Phase 0 실측 246초) 회당 600건·240초로 쪼개 여러 번에 걸쳐 채운다.
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { scanRecent, INSIDER_SCAN_MARK } from '@/lib/insiderMarket'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const budget = Math.min(2000, Number(url.searchParams.get('budget') ?? 600))
  const t = Date.now()
  const out = await scanRecent(budget, 240_000)
  const processed = out.runs.reduce((s, r) => s + r.processed, 0)
  const errors = out.runs.reduce((s, r) => s + r.errors, 0)
  // 마커는 실제로 SEC 를 읽어 처리했거나 처리할 게 없었을 때만 — 오류율이 높으면 남기지 않는다(워터마크 전진 금지)
  const ok = processed + errors === 0 || errors / (processed + errors) < 0.2
  if (ok) await setCache(INSIDER_SCAN_MARK(kstDate()), { at: new Date().toISOString(), processed, errors, runs: out.runs.length })
  return NextResponse.json({ ok, ms: Date.now() - t, processed, errors, budgetLeft: out.budgetLeft, runs: out.runs }, { headers: { 'Cache-Control': 'no-store' } })
}
