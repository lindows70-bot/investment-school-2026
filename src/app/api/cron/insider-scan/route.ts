// 🇺🇸 내부자 매수 수집 크론(하루 3회: 02:20·10:20·21:20 UTC) — SEC 일별 인덱스의 Form 4 를 예산(건수·시간) 안에서 증분 처리. 커서 = 처리한 accession 집합(멱등)
//    ⚠️ Vercel Hobby 는 크론이 '하루 1회'까지라 매시간이 안 된다(배포 거부 실측 2026-09-19) → 같은 경로를 slot 3개로 하루 3번.
//    회당 1,500건·240초 → 하루 4,500건 용량(최다 실측 1,971건). 남은 건 다음 슬롯이 이어받는다(scanRecent 가 미완료 날을 다시 본다).
import { NextResponse } from 'next/server'
import { setCache } from '@/lib/appCache'
import { scanRecent, INSIDER_SCAN_MARK } from '@/lib/insiderMarket'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const budget = Math.min(2000, Number(url.searchParams.get('budget') ?? 1500))
  const t = Date.now()
  const out = await scanRecent(budget, 240_000)
  const processed = out.runs.reduce((s, r) => s + r.processed, 0)
  const errors = out.runs.reduce((s, r) => s + r.errors, 0)
  // 마커는 실제로 SEC 를 읽어 처리했거나 처리할 게 없었을 때만 — 오류율이 높으면 남기지 않는다(워터마크 전진 금지)
  const ok = processed + errors === 0 || errors / (processed + errors) < 0.2
  if (ok) await setCache(INSIDER_SCAN_MARK(kstDate()), { at: new Date().toISOString(), processed, errors, runs: out.runs.length })
  return NextResponse.json({ ok, ms: Date.now() - t, processed, errors, budgetLeft: out.budgetLeft, runs: out.runs }, { headers: { 'Cache-Control': 'no-store' } })
}
