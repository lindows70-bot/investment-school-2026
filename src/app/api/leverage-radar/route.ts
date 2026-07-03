// 🚨 개인 빚투 레이더 — 네이버 증권 일별 고객예탁금·신용잔고(억원) 파싱 → 빚투 비율·역사적 백분위 경보.
// 판정은 절대 임계 하드코딩 대신 최근 이력 분포(백분위)로 결정론 산출. 시뮬레이터 없음 — 실데이터 표시 전용.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 40

export interface LeverageDay { date: string; deposit: number; margin: number; ratio: number }   // 억원, ratio %
export interface LeverageRadarResult {
  series: LeverageDay[]           // 과거→최신
  current: {
    date: string; deposit: number; margin: number; ratio: number
    ratioPercentile: number       // 이력 내 백분위(0~100)
    marginPercentile: number
    margin20dChgPct: number       // 신용잔고 20거래일 변화율 %
    level: 'stable' | 'caution' | 'danger'
  }
  peak: { date: string; margin: number }    // 이력 내 신용잔고 최고
  trough: { date: string; margin: number }  // 이력 내 최저(반대매매 청산 국면 교육용)
  asOf: string
}

// 네이버 sise_deposit 1페이지 파싱(EUC-KR) — 행: [날짜, 예탁금, 증감, 신용잔고, 증감, …]
async function fetchPage(page: number): Promise<{ date: string; deposit: number; margin: number }[]> {
  try {
    const r = await fetch(`https://finance.naver.com/sise/sise_deposit.naver?page=${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const buf = await r.arrayBuffer()
    const html = new TextDecoder('euc-kr').decode(buf)
    const out: { date: string; deposit: number; margin: number }[] = []
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(html)) !== null) {
      const cells = Array.from(m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;|,/g, '').trim())
      if (cells.length < 5) continue
      const dm = cells[0].match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
      if (!dm) continue
      const deposit = parseFloat(cells[1]), margin = parseFloat(cells[3])
      if (!isFinite(deposit) || !isFinite(margin) || deposit <= 0 || margin <= 0) continue
      out.push({ date: `20${dm[1]}-${dm[2]}-${dm[3]}`, deposit, margin })
    }
    return out
  } catch { return [] }
}

const pct = (arr: number[], v: number) => Math.round((arr.filter(x => x <= v).length / arr.length) * 100)

export async function GET() {
  const cacheKey = 'leverage-radar-v1'
  const cached = await getCache<LeverageRadarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 40페이지 ≈ 3년+ 일별 이력(동시성 8 청크)
  const PAGES = 40, CHUNK = 8
  const rows: { date: string; deposit: number; margin: number }[] = []
  for (let i = 1; i <= PAGES; i += CHUNK) {
    const batch = await Promise.all(Array.from({ length: Math.min(CHUNK, PAGES - i + 1) }, (_, k) => fetchPage(i + k)))
    batch.forEach(b => rows.push(...b))
  }
  const byDate = new Map(rows.map(r => [r.date, r]))
  const series: LeverageDay[] = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ ...r, ratio: Math.round((r.margin / r.deposit) * 1000) / 10 }))

  if (series.length < 100) return NextResponse.json({ error: '데이터 부족' }, { status: 502 })

  const cur = series[series.length - 1]
  const ratios = series.map(s => s.ratio), margins = series.map(s => s.margin)
  const ratioPercentile = pct(ratios, cur.ratio)
  const marginPercentile = pct(margins, cur.margin)
  const m20 = series.length > 20 ? series[series.length - 21].margin : cur.margin
  const margin20dChgPct = Math.round(((cur.margin - m20) / m20) * 1000) / 10
  // 경보: 빚투 비율 백분위 주신호 + 신용잔고 자체 백분위 보조(둘 다 극단이면 위험)
  const level: LeverageRadarResult['current']['level'] =
    ratioPercentile >= 80 || (ratioPercentile >= 65 && marginPercentile >= 90) ? 'danger'
    : ratioPercentile >= 60 ? 'caution' : 'stable'

  const peakDay = series.reduce((w, s) => (s.margin > w.margin ? s : w), series[0])
  const troughDay = series.reduce((w, s) => (s.margin < w.margin ? s : w), series[0])

  const result: LeverageRadarResult = {
    series,
    current: { date: cur.date, deposit: cur.deposit, margin: cur.margin, ratio: cur.ratio, ratioPercentile, marginPercentile, margin20dChgPct, level },
    peak: { date: peakDay.date, margin: peakDay.margin },
    trough: { date: troughDay.date, margin: troughDay.margin },
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
