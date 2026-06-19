// 📸 의사결정 스냅샷 — 매수/매도 시점의 SSOT 신호를 한 번에 박제(나중 적중률 채점용). 종목 신호만(유저데이터 X)
// 기존 snapshot_data(peg·growth·category)를 확장: 수급·계절·FOMC 신호 추가. 전부 기존 SSOT/캐시 재사용.
import { NextResponse } from 'next/server'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'
import { getMoneyFlow } from '@/lib/moneyFlow'
import { getCurrentSeason } from '@/lib/currentSeason'
import { holdingFit } from '@/lib/seasonNavigator'
import { classifyLynchMece } from '@/lib/lynchAnalysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface DecisionSnapshot {
  // 펀더멘탈
  peg: number | null
  growth: number | null        // % (양수=성장)
  opMargin: number | null      // 소수
  sector: string | null        // 영문 GICS
  category: string | null      // 린치 분류(거래 시점)
  // 수급
  flow: string | null          // INFLOW/CROWDED/NEGLECTED/NEUTRAL
  mfi: number | null
  // 계절(거시 방향)
  seasonTag: 'favored' | 'neutral' | 'unfavored' | null
  season: string | null        // 계절 quadrant
  // FOMC(통화 정책)
  fomcStance: string | null    // hawkish/neutral/dovish
  rateDir: string | null       // cut/hold/hike
  // 메타
  priceAt: number | null
  recordedAt: string
}

// 영문 GICS 섹터(yahoo-finance2 assetProfile) — 30일 캐시
import { getCache, setCache } from '@/lib/appCache'
async function gicsSector(ticker: string, market: 'KR' | 'US'): Promise<string | null> {
  const num = ticker.replace(/\D/g, '')
  const primary = market === 'KR' ? `${num}.KS` : ticker.toUpperCase()
  const key = `gics-sector:${primary}`
  const cached = await getCache<{ s: string | null }>(key, 30 * 86400_000)
  if (cached) return cached.s
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    let s: string | null = (await yf.quoteSummary(primary, { modules: ['assetProfile'] }))?.assetProfile?.sector ?? null
    if (!s && market === 'KR') s = (await yf.quoteSummary(`${num}.KQ`, { modules: ['assetProfile'] }))?.assetProfile?.sector ?? null
    await setCache(key, { s })
    return s
  } catch { return null }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim()
  const market = (sp.get('market') === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
  const name = (sp.get('name') ?? ticker).trim()
  const priceAt = sp.get('price') ? parseFloat(sp.get('price')!) : null
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  const [cf, mf, gics, season, fomc] = await Promise.all([
    getCanonicalFundamentals(ticker, market, base).catch(() => null),
    getMoneyFlow(ticker, market, name, base).catch(() => null),
    gicsSector(ticker, market).catch(() => null),
    getCurrentSeason(base).catch(() => null),
    fetch(`${base}/api/fomc-decoder`, { signal: AbortSignal.timeout(10_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])

  const growthPct = cf?.growth != null ? Math.round(cf.growth * 1000) / 10 : null
  const lynch = classifyLynchMece(null, cf?.growth ?? null, gics).cat
  const category = lynch === 'na' ? null : lynch

  let seasonTag: DecisionSnapshot['seasonTag'] = null, seasonQ: string | null = null
  if (season) {
    const quad = market === 'KR' ? season.krQuad : season.usQuad
    seasonQ = quad
    const fit = Math.round(holdingFit({ ticker: '', weight: 0, lynchCategory: category, sector: gics ?? undefined }, quad) * 100)
    seasonTag = fit >= 75 ? 'favored' : fit <= 50 ? 'unfavored' : 'neutral'
  }

  const snap: DecisionSnapshot = {
    peg: cf?.peg ?? null,
    growth: growthPct,
    opMargin: cf?.opMargin ?? null,
    sector: gics,
    category,
    flow: mf?.status ?? null,
    mfi: mf?.us?.mfi ?? null,
    seasonTag,
    season: seasonQ,
    fomcStance: fomc?.stance ?? null,
    rateDir: fomc?.marketGap?.rateDir ?? season?.rateDir ?? null,
    priceAt: priceAt != null && isFinite(priceAt) ? priceAt : null,
    recordedAt: new Date().toISOString(),
  }
  return NextResponse.json(snap, { headers: { 'Cache-Control': 'no-store' } })
}
