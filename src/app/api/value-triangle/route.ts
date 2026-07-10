// 🔺 밸류 삼각형 API — 시가총액·자본·당기순이익 3꼭짓점에서 PBR·PER·ROE 3변을 도출(PBR = PER × ROE 항등식)
//    신규 수집 0 — buildSignalMetrics(SSOT, 종목별 12h 캐시)의 marketCap·equity·roe 재사용(제2원칙)
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'

export interface ValueTriangle {
  ticker: string; name: string; market: string; currency: string | null
  marketCap: number | null   // 시가총액(종목 통화)
  equity: number | null      // 자기자본(최신 분기)
  netIncome: number | null   // 당기순이익(TTM 근사 = ROE × 자본)
  pbr: number | null         // 시총 ÷ 자본
  per: number | null         // 시총 ÷ 순이익
  roe: number | null         // 순이익 ÷ 자본 (%)
  isFinancial: boolean       // 금융주 — PBR 꼭짓점으로 평가 강조
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim().toUpperCase()
  const market = (sp.get('market') ?? 'US').toUpperCase()
  const name = sp.get('name') ?? ''
  if (!ticker) return NextResponse.json({ error: '티커가 필요합니다.' }, { status: 400 })
  if (getAssetType(ticker, name, market) !== 'STOCK')
    return NextResponse.json({ error: '개별 주식만 지원합니다.' }, { status: 400 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const m = await buildSignalMetrics(ticker, market, name, base)
  if (!m) return NextResponse.json({ error: '지표를 불러오지 못했습니다.' }, { status: 404 })

  // 세 꼭짓점을 일관 산출 — ⭐ PER 앵커(제2원칙): PER은 앱에서 가장 많이 노출되는 지표라 화면 상단(stock-info)과 반드시 일치해야 함.
  //   순이익 = 시총 ÷ PER(stock-info) → ROE = 순이익 ÷ 자본(도출값). Yahoo ROE(평균자본 기준)로 도출하면 PER이 화면과 어긋남(NVDA 22 vs 45 사건).
  //   PER 미제공(적자 등) 시에만 Yahoo ROE 폴백.
  const perIn = parseFloat(sp.get('per') ?? '')
  const mcap = m.marketCap, equity = m.equity
  const pbr = mcap != null && equity != null && equity > 0 ? Math.round((mcap / equity) * 100) / 100 : null
  let per: number | null = null, netIncome: number | null = null, roeOut: number | null = null
  if (isFinite(perIn) && perIn > 0 && mcap != null && equity != null && equity > 0) {
    per = Math.round(perIn * 10) / 10
    netIncome = mcap / perIn
    roeOut = Math.round((netIncome / equity) * 1000) / 10
  } else if (m.roe != null && equity != null && mcap != null && equity > 0) {
    // 폴백: Yahoo ROE 기준 도출(PER 미제공 종목)
    netIncome = equity * m.roe / 100
    per = netIncome > 0 ? Math.round((mcap / netIncome) * 10) / 10 : null
    roeOut = m.roe
  }
  const isFinancial = /financ|bank|insurance|capital market|asset manage/i.test(`${m.sector ?? ''} ${m.industry ?? ''}`)

  const result: ValueTriangle = {
    ticker, name: m.name, market, currency: m.currency,
    marketCap: mcap, equity, netIncome: netIncome != null ? Math.round(netIncome) : null,
    pbr, per, roe: roeOut, isFinancial,
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
