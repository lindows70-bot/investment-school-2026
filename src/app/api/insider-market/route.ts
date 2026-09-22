// 🇺🇸 내부자 매수 시장 스캐너 API — 30일 장내매수 집계·필터·보강(공개 · 일별 캐시 · 06:50 KST 크론 워밍 refresh=1)
// 판정 근거는 src/lib/insiderMarket.ts + docs/us-smart-money/plan.md
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildInsiderMarket, INSIDER_MARKET_KEY, type InsiderMarket } from '@/lib/insiderMarket'
import { appendUsmHistory } from '@/lib/usSmartHistory'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh') === '1'
  const key = INSIDER_MARKET_KEY(kstDate())
  if (!refresh) {
    const cached = await getCache<InsiderMarket>(key, 12 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }
  const out = await buildInsiderMarket()
  // ⚠️ 부분실패 박제 금지 — 수집이 절반도 안 찬 창(완성일 15일 미만)은 partial 로 내보내고 캐시하지 않는다(다음 요청이 다시 계산)
  if (!out.partial) await setCache(key, out)
  // 📋 성적 적립 — 크론(refresh=1)에서만, 클러스터 통과 종목만. 방문자 재생성이 기록을 늘리면 표본이 부풀려진다(스윙 마커와 같은 이유)
  if (refresh && !out.partial) {
    await appendUsmHistory(out.items.filter(i => i.cluster).map(i => ({
      src: 'insider' as const, ticker: i.ticker, name: i.issuer,
      note: `내부자 ${i.buyers}명 함께 매수${i.nearLow ? ' · 52주 저가 근처' : ''}${i.revision === 'up' ? ' · 추정치 상향' : ''}`,
    })))
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
