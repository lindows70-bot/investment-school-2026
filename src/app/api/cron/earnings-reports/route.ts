// 📑 실적 리포트 배치 수집 — 미국 시총 상위 50종의 SEC 8-K(Item 2.02) 실적 원문을 매일 갱신.
//   수집(SEC)은 가볍고(50종 ~75초) Gemini 요약이 병목(무료 한도) → 요약은 매 실행 N개씩 분산.
//   같은 분기(accession 동일)면 재수집·재요약 안 하므로 평시엔 신규 발표분만 처리된다.
import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'
import {
  getCikMap, collectReport, summarizeReport, attachSummary, toIndexRow, sleep,
  ER_INDEX_KEY, type EarningsReportDoc, type ErIndexRow,
} from '@/lib/earningsReport'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TOP_N = 50               // 사용자 확정 규모
const SUMMARIZE_PER_RUN = 10   // Gemini 무료 한도 분산(며칠에 걸쳐 전 종목 채움)

export async function GET(req: NextRequest) {
  const started = Date.now()

  // ① 대상 = 유니버스 US 시총 상위 50 (하드코딩 리스트 없음 — 시총 변동 자동 반영)
  const uni = (await getCache<ScreenedStock[]>(UNIVERSE_KEY, 10 * 86_400_000)) ?? []
  const targets = uni
    .filter(s => s.market === 'US' && typeof s.marketCap === 'number' && (s.marketCap as number) > 0)
    .sort((a, b) => (b.marketCap as number) - (a.marketCap as number))
    .slice(0, TOP_N)

  if (targets.length < 10) {
    return NextResponse.json({
      ok: false,
      reason: 'universe_not_ready',
      note: '유니버스에 시총이 아직 적재되지 않았습니다(macro-ai-picks 재계산 필요).',
      universeSize: uni.length,
    })
  }

  const cikMap = await getCikMap()
  if (Object.keys(cikMap).length < 1000) {
    return NextResponse.json({ ok: false, reason: 'cik_map_unavailable' })
  }

  // ② 원문 수집(순차 — SEC 예의). 새 분기 발표가 없으면 캐시 반환이라 빠르다
  const docs: { doc: EarningsReportDoc; cap: number | null }[] = []
  let collected = 0, failed = 0
  for (const t of targets) {
    if (Date.now() - started > 200_000) break   // 요약 예산 남기기
    try {
      const doc = await collectReport(t.ticker, t.name, cikMap)
      if (doc) { docs.push({ doc, cap: t.marketCap ?? null }); collected++ }
      else failed++
    } catch { failed++ }
    await sleep(250)
  }

  // ③ 요약 없는 것부터 N개(최신 발표 우선 — 학생이 먼저 볼 것)
  const needSummary = docs
    .filter(d => !d.doc.summary)
    .sort((a, b) => b.doc.filedAt.localeCompare(a.doc.filedAt))
    .slice(0, SUMMARIZE_PER_RUN)

  let summarized = 0, summaryFailed = 0
  for (const d of needSummary) {
    if (Date.now() - started > 270_000) break
    try {
      const s = await summarizeReport(d.doc)
      if (s) { d.doc = await attachSummary(d.doc, s); summarized++ }
      else summaryFailed++
    } catch { summaryFailed++ }
  }

  // ④ 목록 인덱스 — 부분 실패 박제 금지(절반도 못 모았으면 기존 인덱스 유지)
  const rows: ErIndexRow[] = docs
    .map(d => toIndexRow(d.doc, d.cap))
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt))

  const enough = rows.length >= Math.floor(targets.length * 0.5)
  if (enough) await setCache(ER_INDEX_KEY, { rows, targets: targets.length, updatedAt: new Date().toISOString() })

  return NextResponse.json({
    ok: true,
    targets: targets.length,
    collected, failed,
    summarized, summaryFailed,
    withSummary: rows.filter(r => r.hasSummary).length,
    indexWritten: enough,
    elapsedMs: Date.now() - started,
    cronAuth: !!req.headers.get('authorization'),
  })
}
