// 🌐 코스피 × 외국인 누적 순매수 오버레이 SSOT — "외인과 지수는 함께 움직인다(동행)"를 눈으로 보여주는 데이터
//   근거 실측(2026-08-14, scripts/probe-index-flow.mjs · 1,150일): 당일 동행 상관 +0.470 /
//   과거 수급 → 미래 지수 예측 상관 0±(20일→60일 −0.38) — 그래서 이 차트는 '예측 도구'가 아니라
//   '지금 외국인이 한국 시장을 어떻게 대하고 있나'를 읽는 관찰 도구다. 화면은 이 한계를 반드시 병기한다.
//   데이터: 네이버 투자자별 매매동향(코스피 전체·억원·일별) + ^KS11 종가 · 약 1년
import { getTechCandles } from '@/lib/techChartData'

export interface IndexFlowDay { d: string; kospi: number; cumForeignEok: number; foreignEok: number }
export interface IndexFlowResult {
  asOf: string
  days: IndexFlowDay[]           // 과거 → 현재 순
  corrDaily: number              // 당일 외인 순매수 ↔ 당일 지수 등락 상관(이 표본에서 라이브 계산 — 상수 박제 금지)
  totalEok: number               // 기간 누적 외인 순매수(억원)
}

const num = (s: unknown) => parseFloat(String(s ?? '').replace(/[,+\s]/g, '')) || 0

/** 코스피 전체 외국인 일별 순매수(억원) — investorDealTrendDay 를 bizdate 커서로 과거로 넘긴다 */
async function fetchForeignDaily(days: number): Promise<Map<string, number>> {
  const flow = new Map<string, number>()
  let cursor = new Date()
  const pages = Math.ceil(days / 9) + 2          // 페이지당 ~10행
  for (let p = 0; p < pages && flow.size < days; p++) {
    const bd = cursor.toISOString().slice(0, 10).replace(/-/g, '')
    try {
      const r = await fetch(`https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=${bd}&sosok=01`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000), cache: 'no-store' })
      if (!r.ok) break
      const t = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
      const rows = Array.from(t.matchAll(/date2">(\d{2}\.\d{2}\.\d{2})<\/td>\s*<td[^>]*>([-\d,]+)<\/td>\s*<td[^>]*>([-\d,]+)<\/td>/g))
      if (!rows.length) break
      let oldest: string | null = null
      for (const m of rows) {
        const iso = `20${m[1].replace(/\./g, '-')}`
        if (!flow.has(iso)) flow.set(iso, num(m[3]))   // m[2]=개인, m[3]=외국인
        oldest = iso
      }
      if (!oldest) break
      cursor = new Date(new Date(`${oldest}T00:00:00Z`).getTime() - 86_400_000)
    } catch { break }
    await new Promise(res => setTimeout(res, 80))
  }
  return flow
}

export async function buildIndexFlow(days = 250): Promise<IndexFlowResult | null> {
  const [flow, candles] = await Promise.all([
    fetchForeignDaily(days),
    getTechCandles('^KS11', 'US', 'D').catch(() => null),
  ])
  if (!flow.size || !candles || candles.length < 60) return null

  const px = candles
    .map(c => ({ d: String(c.date ?? '').slice(0, 10), c: c.close }))
    .filter(x => x.d && x.c > 0)
  const joined = px.filter(x => flow.has(x.d)).slice(-days)
  if (joined.length < 60) return null

  let cum = 0
  const out: IndexFlowDay[] = joined.map(x => {
    const f = flow.get(x.d) as number
    cum += f
    return { d: x.d, kospi: Math.round(x.c * 100) / 100, foreignEok: Math.round(f), cumForeignEok: Math.round(cum) }
  })

  // 당일 동행 상관 — 이 표본에서 라이브 계산(제1원칙: 측정 상수를 박제하지 않는다)
  const xs: number[] = [], ys: number[] = []
  for (let i = 1; i < out.length; i++) { xs.push(out[i].foreignEok); ys.push((out[i].kospi / out[i - 1].kospi - 1) * 100) }
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  const corrDaily = sxx > 0 && syy > 0 ? Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100 : 0

  return { asOf: new Date().toISOString(), days: out, corrDaily, totalEok: cum }
}
