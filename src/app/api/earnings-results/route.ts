// 📰 어닝 결과 API — 보유 종목 최근 발표(오늘−3~오늘)의 beat/miss + 주가 반응 (매매 브리핑 섹션용)
//    발표일은 earn-dates 공유 맵에 사전 적립(라우트 자급 — 캘린더 방문 의존 없음). AI 미사용·결정론.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { refreshEarnDates, buildEarningsResults, type EarnResultRow } from '@/lib/earnResults'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface EarningsResultsApi { asOf: string; rows: EarnResultRow[] }

export async function GET() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `earn-results-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<EarningsResultsApi>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const { data: invRows } = await sb.from('investments').select('ticker,name,market,quantity').eq('user_id', user.id)
  // 개별 주식만(어닝은 STOCK 전용) · 같은 티커 병합
  const merged = new Map<string, { ticker: string; name: string; market: 'KR' | 'US' }>()
  for (const r of invRows ?? []) {
    const mkt = String(r.market ?? '').toUpperCase()
    if (mkt !== 'KR' && mkt !== 'US') continue
    if ((r.quantity ?? 0) <= 0) continue
    if (getAssetType(r.ticker, r.name ?? '', mkt) !== 'STOCK') continue
    const k = `${String(r.ticker).toUpperCase()}:${mkt}`
    if (!merged.has(k)) merged.set(k, { ticker: String(r.ticker), name: String(r.name ?? r.ticker), market: mkt as 'KR' | 'US' })
  }
  const holdings = Array.from(merged.values())

  const map = await refreshEarnDates(holdings)          // 미래 발표일 적립(공유 맵) + 조회
  const rows = await buildEarningsResults(holdings, map)

  const result: EarningsResultsApi = { asOf: new Date().toISOString(), rows }
  if (holdings.length > 0) await setCache(cacheKey, result)   // 결과 0행도 정상(발표 없는 날) — 캐시 OK
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
