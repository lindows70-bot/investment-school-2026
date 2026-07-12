// 💵 단일 종목 FCF 수익률·이익-현금 괴리 — 리서치(워렌버핏·최일) 화면 배지용.
//  macroPhaseScreener.screenOne과 동일 로직·동일 금융 가드(제2원칙): FCF수익률=FCF/시총, 괴리=영업흑자인데 OCF 적자.
//  Zero Cost: Yahoo quoteSummary 1콜(추천 유니버스와 같은 소스). 종목 신호만(유저데이터 X).
import { NextResponse } from 'next/server'
import { getAssetType, isFinancialCompany } from '@/lib/assetClassifier'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export interface StockFcfResult {
  ticker: string
  isFinancial: boolean           // 🏦 금융주 = FCF/OCF 무의미(예금·대출·보험 float) → 지표 중립
  fcfYield: number | null        // 💵 FCF 수익률(FCF/시총 %)
  qualityGap: boolean            // ⚠️ 이익-현금 괴리(영업흑자인데 영업현금흐름 적자)
  fcfNegOcfOk: boolean           // FCF만 적자·OCF 흑자 = CAPEX 성장 투자(좀비 아님)
  fcf: number | null
  ocf: number | null
  opMargin: number | null        // 영업이익률 %
  grade: 'excellent' | 'good' | 'fair' | 'expensive' | 'gap' | 'capex' | 'loss' | 'na'
  asOf: string
}

const numf = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim()
  const name = (sp.get('name') ?? '').trim()
  const market = (sp.get('market') === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  if (getAssetType(ticker, name, market) !== 'STOCK') return NextResponse.json({ error: 'unsupported', asOf: new Date().toISOString() })

  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    const q = await yf.quoteSummary(sym, { modules: ['financialData', 'summaryDetail', 'price', 'assetProfile'] })
    const fd = q?.financialData ?? {}, sd = q?.summaryDetail ?? {}, pr = q?.price ?? {}
    const fcf = numf(fd.freeCashflow), ocf = numf(fd.operatingCashflow)
    const marketCap = numf(sd.marketCap) ?? numf(pr.marketCap)
    const opMargin = numf(fd.operatingMargins) != null ? Math.round((fd.operatingMargins as number) * 1000) / 10 : null
    // 🏦 금융 가드(스크리너와 동일) — 은행·보험·증권은 OCF/FCF가 예금·대출·트레이딩·float으로 왜곡 → 지표 중립
    const isFinancial = isFinancialCompany(ticker, name, String(q?.assetProfile?.industry || '')) || /financ|bank|insurance/i.test(String(q?.assetProfile?.sector || ''))

    const fcfYield = (!isFinancial && fcf != null && marketCap != null && marketCap > 0) ? Math.round(fcf / marketCap * 1000) / 10 : null
    const qualityGap = !isFinancial && opMargin != null && opMargin > 0 && ocf != null && ocf < 0
    const fcfNegOcfOk = !isFinancial && fcf != null && fcf < 0 && ocf != null && ocf > 0

    const grade: StockFcfResult['grade'] =
      isFinancial ? 'na'
      : qualityGap ? 'gap'
      : fcfYield != null && fcfYield >= 5 ? 'excellent'
      : fcfYield != null && fcfYield >= 3 ? 'good'
      : fcfYield != null && fcfYield >= 1 ? 'fair'
      : fcfYield != null && fcfYield >= 0 ? 'expensive'
      : fcfNegOcfOk ? 'capex'
      : (fcf != null && fcf < 0) ? 'loss' : 'na'

    return NextResponse.json({ ticker, isFinancial, fcfYield, qualityGap, fcfNegOcfOk, fcf, ocf, opMargin, grade, asOf: new Date().toISOString() } as StockFcfResult)
  } catch {
    return NextResponse.json({ ticker, isFinancial: false, fcfYield: null, qualityGap: false, fcfNegOcfOk: false, fcf: null, ocf: null, opMargin: null, grade: 'na', asOf: new Date().toISOString() } as StockFcfResult)
  }
}
