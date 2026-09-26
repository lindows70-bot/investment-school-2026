// 🚨 개인 빚투 레이더 — 네이버 증권 일별 고객예탁금·신용잔고(억원 · stock.naver.com 신규 API) → 빚투 비율·역사적 백분위 경보.
// 판정은 절대 임계 하드코딩 대신 최근 이력 분포(백분위)로 결정론 산출. 시뮬레이터 없음 — 실데이터 표시 전용.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 40

export interface LeverageDay { date: string; deposit: number; margin: number; ratio: number }   // 억원, ratio %
export interface MisuDay { date: string; misu: number; forced: number; forcedPct: number }      // 미수금(억)·반대매매(억)·비중(%)
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
  misu: {                                    // 🆕 위탁매매 미수금·반대매매(금융투자협회 FreeSIS 실데이터)
    series: MisuDay[]
    current: MisuDay & { forcedPctPercentile: number }
    peak: MisuDay                            // 반대매매 비중 최대일(2023-10 영풍제지 사태 등 극단 교육 앵커)
  } | null
  asOf: string
}

// 네이버 증시자금동향(stock.naver.com 신규 API · 무인증 JSON) — 고객예탁금·신용잔고(억원) 일별
//   💥 2026-09-27: 옛 PC 페이지 sise_deposit.naver 가 신규 사이트로 302 리다이렉트돼 파싱 0행 → 502 '데이터 부족'.
//   실측: /api/domestic/market/trendDeposit?startIdx=<페이지 번호>&pageSize=<≤200> · customerDeposit·creditLoan 은 억원 문자열.
//   같은 시계열 확인 — 2026-07-01 예탁금 1,200,837억·신용 367,436억 = 옛 페이지 검증값과 완전 일치.
//   독립 원천 대조 — 예탁금은 금융투자협회 FreeSIS 투자자예탁금(천원)과 같은 날 억 단위까지 일치(9/21 981,386억).
//   신용잔고는 FreeSIS 신용거래융자 합계보다 1.2~1.6% 작다(정의 차이 · 옛 페이지도 같은 값이었다).
//   Vercel(icn1)에서 도달 확인(프리뷰 프로브 HTTP 200).
async function fetchPage(page: number): Promise<{ date: string; deposit: number; margin: number }[] | null> {
  try {
    const r = await fetch(`https://stock.naver.com/api/domestic/market/trendDeposit?startIdx=${page}&pageSize=200`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!r.ok) return null
    const content: { bizdate?: string; customerDeposit?: string; creditLoan?: string }[] = (await r.json())?.content ?? []
    const out: { date: string; deposit: number; margin: number }[] = []
    for (const x of content) {
      const bd = String(x.bizdate ?? '')
      const deposit = Number(x.customerDeposit), margin = Number(x.creditLoan)
      if (!/^\d{8}$/.test(bd) || !isFinite(deposit) || !isFinite(margin) || deposit <= 0 || margin <= 0) continue
      out.push({ date: `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}`, deposit, margin })
    }
    return out
  } catch { return null }
}

const pct = (arr: number[], v: number) => Math.round((arr.filter(x => x <= v).length / arr.length) * 100)

// 금융투자협회 FreeSIS — 투자자예탁금·위탁매매 미수금·반대매매 (무인증 JSON POST, 단위 천원 → 억원 환산)
// 검증: TMPV5 미수금·TMPV6 반대매매금액·TMPV7 비중(%). 2023-10-20 비중 54.9% = 당시 '역대 최고' 보도와 정확 일치.
async function fetchKofiaMisu(): Promise<MisuDay[]> {
  try {
    const end = new Date(), start = new Date(); start.setFullYear(end.getFullYear() - 3)
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
    const r = await fetch('https://freesis.kofia.or.kr/meta/getMetaDataList.do', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ dmSearch: { tmpV40: '1000', tmpV41: '1', tmpV1: 'D', tmpV45: fmt(start), tmpV46: fmt(end), OBJ_NM: 'STATSCU0100000060BO' } }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return []
    const j = await r.json()
    const rows: { TMPV1: string; TMPV5: number; TMPV6: number; TMPV7: number }[] = j?.ds1 ?? []
    return rows
      .filter(x => x?.TMPV1 && isFinite(x.TMPV5) && isFinite(x.TMPV6))
      .map(x => ({
        date: `${x.TMPV1.slice(0, 4)}-${x.TMPV1.slice(4, 6)}-${x.TMPV1.slice(6, 8)}`,
        misu: Math.round(x.TMPV5 / 1e5),          // 천원 → 억원
        forced: Math.round(x.TMPV6 / 1e5),
        forcedPct: Math.round(x.TMPV7 * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch { return [] }
}

export async function GET() {
  const cacheKey = 'leverage-radar-v2'   // v2: KOFIA 미수금·반대매매 추가 — 스키마 변경
  const cached = await getCache<LeverageRadarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 200행 × 4페이지 ≈ 3년+ 일별 이력 — KOFIA 미수금은 병렬 시작.
  //   차례로 넘기고 첫 실패에서 멈춘다 — 중간 페이지만 빠지면 20거래일 변화율(인덱스로 센다)이 조용히 다른 기간이 된다
  const misuPromise = fetchKofiaMisu()
  const PAGES = 4
  const rows: { date: string; deposit: number; margin: number }[] = []
  for (let p = 0; p < PAGES; p++) {
    const page = await fetchPage(p)
    if (!page?.length) break
    rows.push(...page)
    if (page.length < 200) break
  }
  const byDate = new Map(rows.map(r => [r.date, r]))
  const series: LeverageDay[] = Array.from(byDate.values())
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

  // 미수금·반대매매 (실패 시 null — graceful)
  const misuSeries = await misuPromise
  let misu: LeverageRadarResult['misu'] = null
  if (misuSeries.length > 100) {
    const mc = misuSeries[misuSeries.length - 1]
    const misuPeak = misuSeries.reduce((w, s) => (s.forcedPct > w.forcedPct ? s : w), misuSeries[0])
    misu = { series: misuSeries, current: { ...mc, forcedPctPercentile: pct(misuSeries.map(s => s.forcedPct), mc.forcedPct) }, peak: misuPeak }
  }

  const result: LeverageRadarResult = {
    series,
    current: { date: cur.date, deposit: cur.deposit, margin: cur.margin, ratio: cur.ratio, ratioPercentile, marginPercentile, margin20dChgPct, level },
    peak: { date: peakDay.date, margin: peakDay.margin },
    trough: { date: troughDay.date, margin: troughDay.margin },
    misu,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
