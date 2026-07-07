// 📉 기술적 차트 전용 장기 OHLCV API — EMA224·일목균형표(52봉+26선행)에 필요한 긴 시계열(일/주/월봉)
//    수집·캐시는 lib/techChartData(SSOT) — entryTiming(타점 신호등)과 동일 캐시 공유(제2원칙)
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getTechCandles, type TechCandle, type TechTf } from '@/lib/techChartData'

export type { TechCandle }
export interface TechChartResult { ticker: string; market: 'KR' | 'US'; tf: TechTf; candles: TechCandle[] }

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim().toUpperCase()
  const market = (sp.get('market') ?? 'US').toUpperCase() as 'KR' | 'US'
  const tf = ((sp.get('tf') ?? 'D').toUpperCase() as TechTf)
  if (!ticker) return NextResponse.json({ error: '티커를 입력해주세요.' }, { status: 400 })
  if (!['KR', 'US'].includes(market) || !['D', 'W', 'M'].includes(tf))
    return NextResponse.json({ error: '잘못된 파라미터' }, { status: 400 })

  const candles = await getTechCandles(ticker, market, tf)
  if (candles.length < 10)
    return NextResponse.json({ error: '시세를 불러오지 못했습니다 — 티커·시장을 확인해주세요.' }, { status: 404 })

  const result: TechChartResult = { ticker, market, tf, candles }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
