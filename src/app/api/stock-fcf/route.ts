// 💵 단일 종목 FCF 수익률·이익-현금 괴리 — 리서치(워렌버핏·최일) 화면 배지용.
//  macroPhaseScreener.screenOne과 동일 로직·동일 금융 가드(제2원칙): FCF수익률=FCF/시총, 괴리=영업흑자인데 OCF 적자.
//  Zero Cost: Yahoo quoteSummary 1콜(추천 유니버스와 같은 소스). 종목 신호만(유저데이터 X).
import { NextResponse } from 'next/server'
import { getAssetType, isFinancialCompany } from '@/lib/assetClassifier'
import { normalizeCashflow } from '@/lib/finCurrency'   // 💱 ADR 재무통화 환산(스크리너와 동일 SSOT)
import { getTrueFcf, assessFcfNature, type FcfNature } from '@/lib/trueFcf'   // 💵 FCF 분자 SSOT + TTM 대표성 판정
import { getRoeTrend } from '@/lib/roeTrend'   // 📈 ROE 추세 SSOT(배지 전용·점수 미반영)

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export interface StockFcfResult {
  ticker: string
  isFinancial: boolean           // 🏦 금융주 = FCF/OCF 무의미(예금·대출·보험 float) → 지표 중립
  fcfYield: number | null        // 💵 FCF 수익률(FCF/시총 %)
  fcfAvgYield: number | null     // 💵 다년 평균 FCF 수익률 % — TTM 대표성 판별(스크리너와 동일 SSOT)
  fcfYears: number               // 평균의 표본 연수(화면 병기)
  fcfNature: FcfNature           // 🚨 mirage=최근 1년만 흑자(다년 합산 적자) · volatile=올해가 이례적
  natureNote: string | null      // 학생 화면용 한 줄(assessFcfNature 가 생성 — 문구도 SSOT)
  // 📈 ROE 추세 — "지금 좋은 회사"와 "좋아지고 있는 회사"를 가른다. ⛔ 점수 미반영(배지 전용)
  roeTrend: 'improving' | 'deteriorating' | 'stable' | 'na'
  roeNote: string | null
  roeLatest: number | null       // 최신 연간 ROE %(절대값은 병기만 — 애플 197% 같은 왜곡이 있어 판정엔 안 쓴다)
  roeYears: number               // 표본 연수
  qualityGap: boolean            // ⚠️ 이익-현금 괴리(영업흑자인데 영업현금흐름 적자)
  fcfNegOcfOk: boolean           // FCF만 적자·OCF 흑자 = CAPEX 성장 투자(좀비 아님)
  fcf: number | null
  ocf: number | null
  /** 💱 재무통화 → 거래통화 환산 계수(같은 통화=1 · 실패=null). 소비자는 부채·현금 등 다른 재무값에도 곱해야 한다
   *  — DCF는 FCF·부채·현금을 함께 쓰므로 하나만 고치면 여전히 틀린다(거장 위원회 밴드 보류의 근본 원인). */
  fxRate: number | null
  finCur: string | null
  opMargin: number | null        // 영업이익률 %
  grade: 'excellent' | 'good' | 'fair' | 'expensive' | 'gap' | 'capex' | 'loss' | 'mirage' | 'na'
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
    // 💵 분자는 현금흐름표에서 직접(OCF−CapEx) — financialData.freeCashflow 는 정의 불명(EQNR은 OCF보다 큼·MSFT는 1/4)
    // 💱 그 위에 ADR 통화 환산 — 재무는 재무통화(TSM=TWD), 시총은 거래통화라 그대로 나누면 부풀림
    const tf = await getTrueFcf(ticker, market)
    const marketCap = numf(sd.marketCap) ?? numf(pr.marketCap)
    // refOcf·시총 = 원값 통화 판별 근거 — FTS는 상장지 공시 통화라 financialCurrency와 다를 수 있다(두산밥캣 실사고)
    const cfFix = await normalizeCashflow(tf.fcf, tf.ocf ?? numf(fd.operatingCashflow), fd.financialCurrency, pr.currency,
      { refOcf: numf(fd.operatingCashflow), marketCap })
    const fcf = cfFix.fcf, ocf = cfFix.ocf
    const opMargin = numf(fd.operatingMargins) != null ? Math.round((fd.operatingMargins as number) * 1000) / 10 : null
    // 🏦 금융 가드(스크리너와 동일) — 은행·보험·증권은 OCF/FCF가 예금·대출·트레이딩·float으로 왜곡 → 지표 중립
    const isFinancial = isFinancialCompany(ticker, name, String(q?.assetProfile?.industry || '')) || /financ|bank|insurance/i.test(String(q?.assetProfile?.sector || ''))

    const fcfYield = (!isFinancial && fcf != null && marketCap != null && marketCap > 0) ? Math.round(fcf / marketCap * 1000) / 10 : null
    const qualityGap = !isFinancial && opMargin != null && opMargin > 0 && ocf != null && ocf < 0
    const fcfNegOcfOk = !isFinancial && fcf != null && fcf < 0 && ocf != null && ocf > 0
    // 💵 다년 평균 — 연간 시계열은 TTM 과 같은 FTS 출처라 같은 환산 계수(스크리너와 동일 계산)
    const cfFactor = cfFix.fxFailed ? null : (cfFix.converted ? (cfFix.rate ?? 1) : 1)
    const nY = (tf.annualFcf ?? []).length
    const avgRaw = nY > 0 ? tf.annualFcf.reduce((s, x) => s + x.fcf, 0) / nY : null
    const fcfAvgYield = (!isFinancial && avgRaw != null && cfFactor != null && marketCap != null && marketCap > 0)
      ? Math.round(avgRaw * cfFactor / marketCap * 1000) / 10 : null
    const nature = assessFcfNature(fcfYield, fcfAvgYield, nY)
    // 📈 ROE 추세 — 금융주는 자본 구조상 ROE 잣대가 달라 판정 보류(기존 금융 가드와 같은 철학)
    const roeT = isFinancial ? null : await getRoeTrend(ticker, market).catch(() => null)

    const grade: StockFcfResult['grade'] =
      isFinancial ? 'na'
      : qualityGap ? 'gap'
      : nature.kind === 'mirage' ? 'mirage'   // 🚨 올해만 흑자 — '우수' 문구가 나가면 오설명(배지는 숫자를 상쇄 못한다)
      : fcfYield != null && fcfYield >= 5 ? 'excellent'
      : fcfYield != null && fcfYield >= 3 ? 'good'
      : fcfYield != null && fcfYield >= 1 ? 'fair'
      : fcfYield != null && fcfYield >= 0 ? 'expensive'
      : fcfNegOcfOk ? 'capex'
      : (fcf != null && fcf < 0) ? 'loss' : 'na'

    return NextResponse.json({ ticker, isFinancial, fcfYield, fcfAvgYield, fcfYears: nY, fcfNature: nature.kind, natureNote: nature.note,
      roeTrend: roeT?.kind ?? 'na', roeNote: roeT?.note ?? null, roeLatest: roeT?.latest ?? null, roeYears: roeT?.years.length ?? 0,
      qualityGap, fcfNegOcfOk, fcf, ocf, fxRate: cfFix.rate, finCur: cfFix.finCur, opMargin, grade, asOf: new Date().toISOString() } as StockFcfResult)
  } catch {
    return NextResponse.json({ ticker, isFinancial: false, fcfYield: null, fcfAvgYield: null, fcfYears: 0, fcfNature: 'na', natureNote: null,
      roeTrend: 'na', roeNote: null, roeLatest: null, roeYears: 0,
      qualityGap: false, fcfNegOcfOk: false, fcf: null, ocf: null, fxRate: null, finCur: null, opMargin: null, grade: 'na', asOf: new Date().toISOString() } as StockFcfResult)
  }
}
