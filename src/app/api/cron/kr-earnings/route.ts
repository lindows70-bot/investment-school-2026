// 🇰🇷 한국 실적 카드 배치 수집 — 코스피·코스닥 시총 상위 50종의 DART 잠정실적 공시.
//   미국(8-K 서술 요약)과 달리 한국은 '숫자'가 전부다 — 대신 정정공시·단위·빈 항목을 정확히 옮기는 게 이 기능의 값어치.
import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'
import {
  collectKrEarnings, toKrIndexRow, KR_EARN_INDEX_KEY,
  type KrEarningsDoc, type KrIndexRow,
} from '@/lib/krEarnings'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TOP_N = 50
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function GET(req: NextRequest) {
  const started = Date.now()

  // 대상 = 유니버스 KR 시총 상위 50 (KR끼리 비교라 통화 환산 불필요 — 전부 원화)
  const uni = (await getCache<ScreenedStock[]>(UNIVERSE_KEY, 10 * 86_400_000)) ?? []
  const pool = uni
    .filter(s => s.market === 'KR' && /^\d{6}$/.test(s.ticker)
      && typeof s.marketCap === 'number' && (s.marketCap as number) > 0)
    .sort((a, b) => (b.marketCap as number) - (a.marketCap as number))

  if (pool.length < 10) {
    return NextResponse.json({ ok: false, reason: 'universe_not_ready', universeSize: uni.length })
  }

  // 시총 순으로 훑다 50종을 채우면 중단 — 잠정실적을 안 내는 회사는 건너뛰고 다음 순위가 채운다
  const docs: KrEarningsDoc[] = []
  let scanned = 0, failed = 0
  for (const s of pool) {
    if (docs.length >= TOP_N) break
    if (Date.now() - started > 260_000) break
    scanned++
    try {
      const d = await collectKrEarnings(s.ticker, s.name, s.marketCap ?? null)
      if (d) docs.push(d)
      else failed++
    } catch { failed++ }
    await sleep(120)   // DART 예의(일 10,000회 한도라 여유는 있다)
  }

  const rows: KrIndexRow[] = docs
    .map(toKrIndexRow)
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt))

  const enough = rows.length >= Math.floor(TOP_N * 0.5)
  if (enough) await setCache(KR_EARN_INDEX_KEY, { rows, targets: TOP_N, updatedAt: new Date().toISOString() })

  return NextResponse.json({
    ok: true,
    poolSize: pool.length, scanned, collected: docs.length, failed,
    corrected: rows.filter(r => r.corrected).length,
    divergence: rows.filter(r => r.divergence).map(r => r.ticker),
    indexWritten: enough,
    elapsedMs: Date.now() - started,
    cronAuth: !!req.headers.get('authorization'),
  })
}
