// 코스피/코스닥 투자자별 매매동향 — 네이버 일별 투자자 순매수(개인·외국인·기관 세부)를 타임라인으로
// Zero Cost: 네이버 신규 API(stock.naver.com · 무인증 JSON) — 파싱·코드표·단위는 lib/naverInvestorTrend SSOT · 단위 억원 · 6h 캐시
//   (옛 finance.naver.com 레거시 테이블은 2026-09-27 HTTP 410 으로 폐기)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { fetchInvestorDaily, type InvestorRow } from '@/lib/naverInvestorTrend'

export type { InvestorRow }

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface MarketInvestorResult {
  market: 'KOSPI' | 'KOSDAQ'
  rows: InvestorRow[]           // 최신 → 과거
  foreignCumSeries: { date: string; cum: number }[]   // 외국인 누적 순매수(과거→최신, 타임라인 차트용)
  pensionCumSeries: { date: string; cum: number }[]   // 🏛️ 연기금(국민연금 주력) 누적 순매수
  cum: { personal: number; foreign: number; institution: number; pension: number }   // 기간 누적
  asOf: string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// ⚠️ 원자료 단위 검산 이력 — 옛 페이지는 「일자별 순매수 (단위:억원)」였고 과거 ÷100(백만원 가정) 환산은 100배 축소 버그였다
//   (26.07.24 개인 51,782·외국인 −32,683·기관 −19,514억 = 언론 인용 +5.20/−3.28/−1.95조와 일치).
//   신규 API 는 원 단위라 lib 이 ÷1e8 한다 — 같은 날 값이 옛 페이지·다음 금융과 정확히 같다(2026-09-27 실측).
//   ※ 합계 검산(개인+외국인+기관+기타법인=0)은 스케일 불변이라 단위 오류를 잡지 못한다.

export async function GET(req: Request) {
  const market = new URL(req.url).searchParams.get('market') === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI'
  const cacheKey = `mkt-investor-v4:${market}:${kstDate()}`   // v4: 단위 100배 축소 버그 수정(원자료는 이미 억원) / v3: 연기금 누적 추세
  const cached = await getCache<MarketInvestorResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const rows = await fetchInvestorDaily(market, 70)   // 약 70거래일(3개월 집계 커버)
  if (rows.length === 0) return NextResponse.json({ error: 'no_data' }, { status: 200 })

  // 외국인 누적 추세(과거→최신) — 타임라인 차트
  const chrono = [...rows].reverse()
  let acc = 0
  const foreignCumSeries = chrono.map(r => { acc += r.foreign; return { date: r.date, cum: Math.round(acc) } })
  // 🏛️ 연기금(국민연금 주력) 누적 순매수 추세
  let accP = 0
  const pensionCumSeries = chrono.map(r => { accP += r.pension; return { date: r.date, cum: Math.round(accP) } })

  const cum = {
    personal: Math.round(rows.reduce((s, r) => s + r.personal, 0)),
    foreign: Math.round(rows.reduce((s, r) => s + r.foreign, 0)),
    institution: Math.round(rows.reduce((s, r) => s + r.institution, 0)),
    pension: Math.round(rows.reduce((s, r) => s + r.pension, 0)),
  }

  const result: MarketInvestorResult = { market, rows, foreignCumSeries, pensionCumSeries, cum, asOf: new Date().toISOString() }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
