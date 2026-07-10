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

  // 세 꼭짓점을 일관 산출: 순이익 = ROE(소수) × 자본 → PER·PBR·ROE가 항등식으로 정확히 닫힘(교육 목적)
  const mcap = m.marketCap, equity = m.equity
  const roeFrac = m.roe != null ? m.roe / 100 : null
  const netIncome = equity != null && roeFrac != null ? equity * roeFrac : null
  const pbr = mcap != null && equity != null && equity > 0 ? Math.round((mcap / equity) * 100) / 100 : null
  const per = mcap != null && netIncome != null && netIncome > 0 ? Math.round((mcap / netIncome) * 10) / 10 : null
  const isFinancial = /financ|bank|insurance|capital market|asset manage/i.test(`${m.sector ?? ''} ${m.industry ?? ''}`)

  const result: ValueTriangle = {
    ticker, name: m.name, market, currency: m.currency,
    marketCap: mcap, equity, netIncome: netIncome != null ? Math.round(netIncome) : null,
    pbr, per, roe: m.roe, isFinancial,
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
