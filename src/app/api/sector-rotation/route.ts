// 🧭 섹터 로테이션 시계 — 17개 섹터(GICS 11 + 테마 6)를 상대강도×모멘텀 4사분면에 배치.
//    새 판정기 0(제1·2원칙): 기존 /api/sector(computeSector) 결과의 섹터 평균수익률만 집계 → 섹터 탭과 동일값.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 17개 섹터: GICS 11 + 테마 6
const GICS = ['energy', 'materials', 'industrials', 'discretionary', 'staples', 'healthcare', 'financials', 'infotech', 'communication', 'utilities', 'realestate']
const THEME = ['quantum', 'ai-semi', 'power', 'phys-ai', 'ai-bio', 'defense']

export type Quadrant = 'leading' | 'weakening' | 'lagging' | 'improving'
export interface RotationItem {
  key: string; label: string; emoji: string; group: 'gics' | 'theme'
  ret1w: number | null; ret1m: number | null; ret1y: number | null
  rs: number; mom: number        // X 상대강도, Y 모멘텀(peer 대비)
  quadrant: Quadrant; score: number   // 자금쏠림 점수 = 0.6·rs + 0.4·mom
  count: number                  // 집계 종목 수
}
export interface RotationResult {
  items: RotationItem[]
  inflow: RotationItem[]; outflow: RotationItem[]   // 🔥유입 Top / ❄️이탈 Top
  mean1w: number; mean1m: number
  used: number; asOf: string
}

const QUAD = (rs: number, mom: number): Quadrant =>
  rs > 0 && mom > 0 ? 'leading' : rs > 0 ? 'weakening' : mom > 0 ? 'improving' : 'lagging'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const avg = (arr: (number | null | undefined)[]): number | null => {
  const v = arr.filter((x): x is number => typeof x === 'number' && isFinite(x))
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cacheKey = `sector-rotation-v1:${kstDate()}`
  const cached = await getCache<RotationResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const all = [...GICS.map(k => ['gics', k] as const), ...THEME.map(k => ['theme', k] as const)]
  const raw = await Promise.all(all.map(async ([group, key]) => {
    try {
      const r = await fetch(`${base}/api/sector?key=${key}`, { signal: AbortSignal.timeout(45_000) })
      if (!r.ok) return null
      const d = await r.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stocks: any[] = Array.isArray(d?.stocks) ? d.stocks : []
      if (!stocks.length) return null
      // 섹터 평균수익률(동일가중). 1y는 신규상장(weeks<52) 제외로 왜곡 방지
      const ret1w = avg(stocks.map(s => s.ret1w))
      const ret1m = avg(stocks.map(s => s.ret1m))
      const ret1y = avg(stocks.filter(s => (s.weeks ?? 0) >= 52).map(s => s.ret1y))
      return { group, key, label: String(d.label ?? key).replace(/ 인텔리전스| 테마 인텔리전스$/, ''), emoji: String(d.emoji ?? '📊'), ret1w, ret1m, ret1y, count: stocks.length }
    } catch { return null }
  }))
  const secs = raw.filter((x): x is NonNullable<typeof x> => x != null && x.ret1m != null && x.ret1w != null)
  if (secs.length < 6)
    return NextResponse.json({ error: '섹터 데이터 부족 — 잠시 후 재시도(섹터 탭 방문 시 캐시 워밍)' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const mean1m = secs.reduce((s, x) => s + (x.ret1m as number), 0) / secs.length
  const mean1w = secs.reduce((s, x) => s + (x.ret1w as number), 0) / secs.length

  const items: RotationItem[] = secs.map(x => {
    const rs = Math.round(((x.ret1m as number) - mean1m) * 10) / 10   // 상대강도(1M)
    const mom = Math.round(((x.ret1w as number) - mean1w) * 10) / 10   // 모멘텀(1W peer 대비)
    const score = Math.round((0.6 * rs + 0.4 * mom) * 10) / 10
    return {
      key: x.key, label: x.label, emoji: x.emoji, group: x.group,
      ret1w: x.ret1w != null ? Math.round(x.ret1w * 10) / 10 : null,
      ret1m: x.ret1m != null ? Math.round(x.ret1m * 10) / 10 : null,
      ret1y: x.ret1y != null ? Math.round(x.ret1y * 10) / 10 : null,
      rs, mom, quadrant: QUAD(rs, mom), score, count: x.count,
    }
  }).sort((a, b) => b.score - a.score)

  const result: RotationResult = {
    items,
    inflow: items.filter(i => i.score > 0).slice(0, 3),
    outflow: [...items].filter(i => i.score < 0).sort((a, b) => a.score - b.score).slice(0, 3),
    mean1w: Math.round(mean1w * 10) / 10, mean1m: Math.round(mean1m * 10) / 10,
    used: secs.length, asOf: new Date().toISOString(),
  }
  if (secs.length >= 12) await setCache(cacheKey, result)   // 과반 이상 성공 시에만 캐시(부분실패 박제 방지)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
