/**
 * GET /api/dividend-explorer?ticker=O&market=US
 *
 * 💰 글로벌 배당 익스플로러 — 개별 종목 배당 프로필 조회(포트폴리오 미보유 포함)
 *   계산 로직은 lib/dividendProfile.ts(SSOT) — 배당 포트폴리오와 동일 엔진 공유(제2원칙).
 *   인증 불필요 · app_cache 48h.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getDividendProfile, type DividendProfile } from '@/lib/dividendProfile'

// 컴포넌트 하위호환: 기존 import 경로 유지
export type { DividendProfile }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || '').trim().toUpperCase()
  const market = (searchParams.get('market') || 'US').trim().toUpperCase()
  if (!ticker) return NextResponse.json({ error: '티커가 필요합니다.' }, { status: 400 })

  const cacheKey = `div-explorer-v7:${ticker}:${market}`   // v7: 프로필 SSOT 추출·지급월 추가
  const cached = await getCache<DividendProfile>(cacheKey, 48 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const profile = await getDividendProfile(ticker, market)
  // 데이터가 실제로 채워진 경우만 캐시(에러 graceful 결과 박제 방지)
  if (profile.dividendYield != null || profile.payoutRatio != null) await setCache(cacheKey, profile)
  return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } })
}
