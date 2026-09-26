// 🌐 코스피 × 외국인 누적 순매수 오버레이 SSOT — "외인과 지수는 함께 움직인다(동행)"를 눈으로 보여주는 데이터
//   근거 실측(2026-08-14, scripts/probe-index-flow.mjs · 1,150일): 당일 동행 상관 +0.470 /
//   과거 수급 → 미래 지수 예측 상관 0±(20일→60일 −0.38) — 그래서 이 차트는 '예측 도구'가 아니라
//   '지금 외국인이 한국 시장을 어떻게 대하고 있나'를 읽는 관찰 도구다. 화면은 이 한계를 반드시 병기한다.
//   데이터: 네이버 투자자별 매매동향(코스피 전체·억원·일별 · lib/naverInvestorTrend SSOT) + ^KS11 종가 · 약 2년
import { getTechCandles } from '@/lib/techChartData'
import { fetchInvestorDaily } from '@/lib/naverInvestorTrend'

export interface IndexFlowDay {
  d: string; kospi: number
  foreignEok: number; cumForeignEok: number
  organEok: number; cumOrganEok: number
  indivEok: number; cumIndivEok: number
}
export interface IndexFlowResult {
  asOf: string
  days: IndexFlowDay[]           // 과거 → 현재 순
  corrDaily: number              // 당일 외인 순매수 ↔ 당일 지수 등락 상관(이 표본에서 라이브 계산 — 상수 박제 금지)
  totalEok: number               // 기간 누적 외인 순매수(억원)
  totalOrganEok: number          // 기간 누적 기관 순매수(억원)
  totalIndivEok: number          // 기간 누적 개인 순매수(억원)
  /** 기간 누적 기타법인(자사주 등) — **파생값**: 개인+외국인+기관계+기타법인 = 0 항등식으로 역산.
   *  4일 표본 실측에서 오차 0(2026-08-14). 화면이 "수급은 제로섬"이라고 말하면서 세 숫자만 보여주면
   *  합이 0이 아니라 요약이 스스로를 반박한다 — 네 번째 조각을 함께 표시한다. */
  totalEtcEok: number
}

type DailyFlow = { f: number; o: number; i: number }
/** 코스피 전체 일별 순매수(억원·개인/외국인/기관계) — 투자자별 매매동향 SSOT(naverInvestorTrend)에서 날짜 → 값 */
async function fetchFlowByDate(days: number): Promise<Map<string, DailyFlow>> {
  const rows = await fetchInvestorDaily('KOSPI', days)
  return new Map(rows.map(r => [r.date, { f: r.foreign, o: r.institution, i: r.personal }]))
}

export async function buildIndexFlow(days = 500): Promise<IndexFlowResult | null> {
  const [flow, candles] = await Promise.all([
    fetchFlowByDate(days),
    getTechCandles('^KS11', 'US', 'D').catch(() => null),
  ])
  if (!flow.size || !candles || candles.length < 60) return null

  const px = candles
    .map(c => ({ d: String(c.date ?? '').slice(0, 10), c: c.close }))
    .filter(x => x.d && x.c > 0)
  const joined = px.filter(x => flow.has(x.d)).slice(-days)
  if (joined.length < 60) return null

  let cumF = 0, cumO = 0, cumI = 0
  const out: IndexFlowDay[] = joined.map(x => {
    const fl = flow.get(x.d) as DailyFlow
    cumF += fl.f; cumO += fl.o; cumI += fl.i
    return {
      d: x.d, kospi: Math.round(x.c * 100) / 100,
      foreignEok: Math.round(fl.f), cumForeignEok: Math.round(cumF),
      organEok: Math.round(fl.o), cumOrganEok: Math.round(cumO),
      indivEok: Math.round(fl.i), cumIndivEok: Math.round(cumI),
    }
  })

  // 당일 동행 상관 — 이 표본에서 라이브 계산(제1원칙: 측정 상수를 박제하지 않는다)
  const xs: number[] = [], ys: number[] = []
  for (let i = 1; i < out.length; i++) { xs.push(out[i].foreignEok); ys.push((out[i].kospi / out[i - 1].kospi - 1) * 100) }
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  const corrDaily = sxx > 0 && syy > 0 ? Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100 : 0

  return {
    asOf: new Date().toISOString(), days: out, corrDaily,
    totalEok: cumF, totalOrganEok: cumO, totalIndivEok: cumI,
    totalEtcEok: -(cumF + cumO + cumI),
  }
}
