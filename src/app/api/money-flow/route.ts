// 스마트머니 수급 레이더 API — 종목별 외국인/기관/개인 수급 분석(KR). 개별주식만, 일별 캐시
import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getMoneyFlow } from '@/lib/moneyFlow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') ?? '').trim()
  const name = (searchParams.get('name') ?? '').trim()
  const market = (searchParams.get('market') ?? (/\d{6}/.test(ticker) ? 'KR' : 'US')) as 'KR' | 'US'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // 개별주식만(ETF·코인·원자재 차단)
  if (getAssetType(ticker, name, market) !== 'STOCK') {
    return NextResponse.json({ ticker, name, market, status: 'UNSUPPORTED', note: '개별 주식 전용 분석입니다.' })
  }

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const result = await getMoneyFlow(ticker, market, name, selfBase)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
