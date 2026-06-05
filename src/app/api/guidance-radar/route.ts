/**
 * GET /api/guidance-radar
 *
 * 📡 가이던스 수정 모멘텀 레이더 (Guidance Revision Momentum Radar)
 *
 * 사후 분석(JarvisInsight)과 달리, 미래 EPS 컨센서스의 '변화율(기울기)'을 스캐닝.
 *
 * ── 컨센서스 리비전 계산 방법 ──
 *  Yahoo는 30일 전 컨센서스를 직접 제공하지 않음 → '스냅샷 적립' 전략 사용:
 *   · 매 조회마다 오늘의 컨센서스를 app_cache(guidance-snap:TICKER:DATE)에 저장
 *   · 30일 전 스냅샷이 있으면 → revisionRate = (현재 - 30일전) / |30일전| × 100
 *   · 이력 없으면 → YoY EPS growth 방향으로 대리 대입 (부드러운 Fallback)
 *  업/다운그레이드 수 = recommendationTrend 0m(현재) vs -1m(1개월전) 비교
 *
 * ── 캐싱 ──
 *  · 최종 결과: app_cache(guidance-radar:USER_ID:DATE, 24h)
 *  · 일별 스냅샷: app_cache(guidance-snap:TICKER:MARKET:DATE)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type MomentumSignal = 'accelerating' | 'decelerating' | 'neutral' | 'no_data'
export interface GuidanceItem {
  ticker:         string
  name:           string
  market:         string
  nextQtrEps:     number | null   // 다음 분기 EPS 컨센서스
  currentYrEps:   number | null   // 올해 연간 EPS 컨센서스
  revisionRate:   number          // 30일 전 대비 변화율 % (없으면 YoY 대리값)
  upgradeCount:   number          // 최근 1개월 업그레이드 수
  downgradeCount: number          // 최근 1개월 다운그레이드 수
  analystCount:   number | null
  signal:         MomentumSignal
  fallback:       boolean         // true = 이력 없어 대리값 사용
}
export interface GuidanceRadarResult {
  items:      GuidanceItem[]
  topPick:    GuidanceItem | null   // 상향 모멘텀 최강
  worstWarn:  GuidanceItem | null   // 하향 리스크 최고
  asOf:       string
}

// ── 시그널 판정 ───────────────────────────────────────────────────────────────
function toSignal(rate: number, fallback: boolean): MomentumSignal {
  if (fallback && Math.abs(rate) < 0.5) return 'neutral'
  if (rate >=  3) return 'accelerating'
  if (rate <= -3) return 'decelerating'
  return 'neutral'
}

// ── Yahoo Finance ─────────────────────────────────────────────────────────────
async function getYF() {
  const { default: YF } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YF as any)({ suppressNotices: ['yahooSurvey'] })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | null { const x = typeof v === 'object' && v && 'raw' in v ? v.raw : v; const f = typeof x === 'number' ? x : parseFloat(x); return isFinite(f) ? f : null }

interface Snapshot { nextQtrEps: number | null; currentYrEps: number | null }

// ── 이름 정규화: Yahoo 내부 ID(예: "189300.KS,0P00...") → investments 원본명 우선 ─────
function cleanName(yahooName: string | null | undefined, fallbackName: string, ticker: string): string {
  const y = String(yahooName ?? '').trim()
  // Yahoo가 "TICKER.KS,0P000..." 패턴의 내부 ID를 반환할 때 → fallback
  if (!y || y.includes(',0P') || y.startsWith(ticker.split('.')[0]) && y.includes('.KS')) return fallbackName || ticker
  return y
}

async function fetchGuidance(ticker: string, market: string, yf: unknown, invName?: string): Promise<GuidanceItem> {
  const base: GuidanceItem = {
    ticker, name: invName || ticker, market,
    nextQtrEps: null, currentYrEps: null,
    revisionRate: 0, upgradeCount: 0, downgradeCount: 0,
    analystCount: null, signal: 'no_data', fallback: true,
  }
  try {
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = await (yf as any).quoteSummary(sym, { modules: ['earningsTrend', 'recommendationTrend', 'price'] })
    // Yahoo가 일부 KR 티커를 내부 ID("189300.KS,0P00...")로 반환 → investments 원본명 우선
    const name = cleanName(q?.price?.shortName || q?.price?.longName, invName || ticker, ticker)

    // 컨센서스 현재값
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trend: any[] = q?.earningsTrend?.trend ?? []
    const nq = trend.find(t => t.period === '+1q') ?? trend.find(t => t.period === '0q')
    const cy = trend.find(t => t.period === '0y') ?? trend.find(t => t.period === '+1y')
    const nextQtrEps = num(nq?.earningsEstimate?.avg)
    const currentYrEps = num(cy?.earningsEstimate?.avg)
    const analystCount = num(nq?.earningsEstimate?.numberOfAnalysts) ?? num(cy?.earningsEstimate?.numberOfAnalysts)

    // 일별 스냅샷 저장 & 30일 전과 비교
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const past30 = new Date(Date.now() - 30 * 86400_000 + 9 * 3600_000).toISOString().slice(0, 10)
    const snapKey = `guidance-snap:${ticker}:${market}:${today}`
    const snap30Key = `guidance-snap:${ticker}:${market}:${past30}`
    if (nextQtrEps != null || currentYrEps != null)
      await setCache(snapKey, { nextQtrEps, currentYrEps } as Snapshot)
    const snap30 = await getCache<Snapshot>(snap30Key, 35 * 86400_000)

    let revisionRate = 0
    let fallback = true
    if (snap30 && (snap30.nextQtrEps != null || snap30.currentYrEps != null)) {
      // 실제 30일 이력
      const base30 = snap30.nextQtrEps ?? snap30.currentYrEps!
      const cur    = nextQtrEps ?? currentYrEps
      if (cur != null && Math.abs(base30) > 1e-6)
        revisionRate = Math.round(((cur - base30) / Math.abs(base30)) * 1000) / 10
      fallback = false
    } else {
      // 이력 없음 → YoY growth 대리값 (방향만 참고)
      const yoyGrowth = num(cy?.earningsEstimate?.growth)
      if (yoyGrowth != null) revisionRate = Math.round(yoyGrowth * 100) / 10  // 소수→% 변환
      fallback = true
    }

    // 업/다운그레이드 수 (recommendationTrend 0m vs -1m 델타)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtTrend: any[] = q?.recommendationTrend?.trend ?? []
    const rt0m = rtTrend.find(t => t.period === '0m')
    const rt1m = rtTrend.find(t => t.period === '-1m')
    let upgradeCount = 0, downgradeCount = 0
    if (rt0m && rt1m) {
      const bull0 = (rt0m.strongBuy ?? 0) + (rt0m.buy ?? 0)
      const bull1 = (rt1m.strongBuy ?? 0) + (rt1m.buy ?? 0)
      const bear0 = (rt0m.sell ?? 0) + (rt0m.strongSell ?? 0)
      const bear1 = (rt1m.sell ?? 0) + (rt1m.strongSell ?? 0)
      upgradeCount   = Math.max(0, bull0 - bull1)
      downgradeCount = Math.max(0, bear0 - bear1 + (bull1 - bull0 > 0 ? bull1 - bull0 : 0))
      // 더 단순한 계산: 전체 강세 개수 증감
      upgradeCount   = Math.max(0, bull0 - bull1)
      downgradeCount = Math.max(0, bear0 - bear1)
    }

    return {
      ticker, name, market,
      nextQtrEps, currentYrEps, revisionRate,
      upgradeCount, downgradeCount, analystCount,
      signal: toSignal(revisionRate, fallback), fallback,
    }
  } catch { return base }
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export async function GET() {
  const sb = createClient()
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const fp = await holdingsFingerprint(user.id)   // 보유 변경 시 키 자동 무효화
  const radarKey = `guidance-radar:${user.id}:${today}:${fp}`
  const cached = await getCache<GuidanceRadarResult>(radarKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: invRows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const stocks = (invRows ?? []).filter(inv => getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') === 'STOCK')

  if (!stocks.length)
    return NextResponse.json({ items: [], topPick: null, worstWarn: null, asOf: new Date().toISOString() })

  const yf = await getYF()
  const items: GuidanceItem[] = []
  // 동시성 4 — Yahoo 스로틀 방지
  for (let i = 0; i < stocks.length; i += 4) {
    const batch = stocks.slice(i, i + 4)
    // inv.name(한글명)을 invName으로 전달 → Yahoo 내부 ID("189300.KS,0P00...") 대신 실명 표시
    const results = await Promise.all(batch.map(inv =>
      fetchGuidance(inv.ticker, inv.market ?? 'US', yf, inv.name || undefined).catch(() => ({
        ticker: inv.ticker, name: inv.name || inv.ticker, market: inv.market ?? 'US',
        nextQtrEps: null, currentYrEps: null, revisionRate: 0,
        upgradeCount: 0, downgradeCount: 0, analystCount: null, signal: 'no_data' as const, fallback: true,
      }))
    ))
    items.push(...results)
  }

  // 중복 제거 (같은 ticker 여러 번 보유 가능)
  const deduped = Array.from(new Map(items.map(i => [i.ticker, i])).values())
  deduped.sort((a, b) => b.revisionRate - a.revisionRate)

  const withData = deduped.filter(i => i.signal !== 'no_data')
  const topPick  = withData.find(i => i.signal === 'accelerating') ?? withData[0] ?? null
  // worstWarn: 실제 decelerating이 없으면 null(해당 없음) — 0%짜리 종목 노출 방지
  const decelItems = withData.filter(i => i.signal === 'decelerating')
  const worstWarn  = decelItems.length > 0
    ? decelItems.sort((a, b) => a.revisionRate - b.revisionRate)[0]
    : (withData.some(i => i.revisionRate < -1) ? [...withData].sort((a, b) => a.revisionRate - b.revisionRate)[0] : null)

  const result: GuidanceRadarResult = { items: deduped, topPick, worstWarn, asOf: new Date().toISOString() }
  await setCache(radarKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
