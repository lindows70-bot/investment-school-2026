// 🌟 단일 종목 투자 프로필 API — 해자·스타등급(공정가치)·상대 PSR 한 카드(종목 리서치 캡스톤)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { buildStockProfile } from '@/lib/stockProfile'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') ?? '').trim()
  const market = (searchParams.get('market') ?? 'US').toUpperCase() === 'KR' ? 'KR' : 'US'
  if (!ticker) return NextResponse.json({ error: 'no_ticker' }, { status: 200 })

  // 개별 주식 전용(ETF·코인·원자재는 해자·공정가치 개념 부적합 — getAssetType SSOT)
  if (getAssetType(ticker, '', market) !== 'STOCK') return NextResponse.json({ error: 'unsupported' }, { status: 200 })

  const cacheKey = `stock-profile-v3:${ticker.toUpperCase()}:${market}:${kstDate()}`   // v2: peg 노출(관점 충돌 융합 띠)
  const cached = await getCache<unknown>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const profile = await buildStockProfile(ticker, market, base)
  if (!profile) return NextResponse.json({ error: 'no_data' }, { status: 200 })

  await setCache(cacheKey, profile)
  return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } })
}
