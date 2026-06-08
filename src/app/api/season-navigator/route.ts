// 🧭 4계절 매크로 내비게이터 API — macro-regime SSOT + OECD CLI를 2×2로 번역 + 보유 계절 적합도
// 제2원칙. 매크로 결론은 macro-regime SSOT 단일출처를 그대로 읽고, 성장축만 CLI로 보강(새 판정기 아님)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getSector } from '@/lib/schoolIndex'
import {
  growthFromCli, inflationFromRegime, seasonOf, seasonalAlignment,
  SEASON_META, type Holding, type Quadrant,
} from '@/lib/seasonNavigator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FALLBACK_KRW = 1350
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

type LynchCat = Holding['lynchCategory']

export interface SeasonNavResult {
  quadrant: Quadrant
  seasonKo: string
  icon: string
  label: string
  guide: string
  cashHint: string
  favored: string[]
  // 축 진단(투명성)
  growth: { cli: number; cliPrev: number; dir: 'up' | 'down'; aboveTrend: boolean }
  inflation: { cpiYoY: number; rateDir: string; hot: boolean }
  regimeLabel: string         // macro-regime이 말하는 국면 라벨(SSOT 일치 확인용)
  // 보유 정합성
  alignmentScore: number
  perHolding: { ticker: string; name: string; weight: number; fit: number }[]
  // 무료 조기 경보
  yieldCurveInverted: boolean
  yieldCurve: number | null
  asOf: string
}

// FRED OECD CLI(미국, USALOLITOAASTSAM) 최신 + 3개월 전 레벨 — 12h 캐시
async function fetchUsCli(): Promise<{ cli: number; cliPrev: number } | null> {
  const cached = await getCache<{ cli: number; cliPrev: number }>('oecd-cli-us-v1', 12 * 3600_000)
  if (cached) return cached
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=USALOLITOAASTSAM&api_key=${key}&file_type=json&sort_order=desc&limit=4`
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const j = await r.json()
    const obs = (j.observations ?? []).map((o: { value: string }) => parseFloat(o.value)).filter((v: number) => !isNaN(v))
    if (obs.length < 4) return null
    const out = { cli: obs[0], cliPrev: obs[3] }   // 최신 vs 3개월 전(모멘텀)
    await setCache('oecd-cli-us-v1', out)
    return out
  } catch { return null }
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `season-navigator-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<SeasonNavResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 물가/금리축 + 역전경보 = macro-regime SSOT 재사용(추가 판정 0)
  let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold', regimeLabel = '—'
  let yieldCurve: number | null = null
  try {
    const rg = await fetch(`${base}/api/macro-regime`, { signal: AbortSignal.timeout(10_000) })
    if (rg.ok) {
      const j = await rg.json()
      cpiYoY = typeof j.cpiYoY === 'number' ? j.cpiYoY : cpiYoY
      rateDir = j.rateDir ?? 'hold'
      regimeLabel = j.label ?? '—'
      yieldCurve = typeof j.yieldCurve === 'number' ? j.yieldCurve : null
    }
  } catch { /* graceful — 폴백 중립값 사용 */ }

  // ② 성장축 = OECD CLI(미국, 물가/금리축과 같은 경제권으로 정합)
  const cli = await fetchUsCli()
  const g = growthFromCli(cli?.cli ?? 100, cli?.cliPrev ?? 100)
  const i = inflationFromRegime(cpiYoY, rateDir)
  const quadrant = seasonOf(g, i)
  const meta = SEASON_META[quadrant]

  // ③ 보유 종목 → ₩환산 비중 + 섹터(재사용) → 정합성 점수
  let usdKrw = FALLBACK_KRW
  try {
    const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) })
    if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate }
  } catch { /* 폴백 1350 */ }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments')
    .select('ticker,name,market,purchase_price,quantity,currency,lynch_category').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'STOCK')

  // 섹터 병렬 조회(7일 캐시 재사용 → 대부분 즉시)
  const sectors = await Promise.all(stocks.map(async r => {
    try { return await getSector(r.ticker, r.market ?? 'US') } catch { return '' }
  }))

  const holdings: Holding[] = stocks.map((r, idx) => {
    const rate = r.currency === 'USD' ? usdKrw : 1
    const weight = (r.purchase_price ?? 0) * (r.quantity ?? 0) * rate   // ₩환산 평가(원가) — 내부에서 비중 정규화
    return {
      ticker: r.ticker,
      weight,
      lynchCategory: (r.lynch_category ?? null) as LynchCat,
      sector: sectors[idx] || undefined,
    }
  }).filter(h => h.weight > 0)

  const align = seasonalAlignment(holdings, quadrant)
  const nameByTicker = new Map(stocks.map(r => [r.ticker, r.name ?? r.ticker]))
  const totalW = holdings.reduce((s, h) => s + h.weight, 0) || 1

  const result: SeasonNavResult = {
    quadrant: meta.quadrant, seasonKo: meta.seasonKo, icon: meta.icon, label: meta.label,
    guide: meta.guide, cashHint: meta.cashHint, favored: meta.favored,
    growth: { cli: g.cli, cliPrev: g.cliPrev, dir: g.dir, aboveTrend: g.aboveTrend },
    inflation: { cpiYoY: i.cpiYoY, rateDir: i.rateDir, hot: i.hot },
    regimeLabel,
    alignmentScore: align.score,
    perHolding: align.perHolding
      .map(p => ({ ticker: p.ticker, name: nameByTicker.get(p.ticker) ?? p.ticker, weight: Math.round((p.weight / totalW) * 1000) / 10, fit: p.fit }))
      .sort((a, b) => b.weight - a.weight),
    yieldCurveInverted: yieldCurve != null && yieldCurve < 0,
    yieldCurve,
    asOf: new Date().toISOString(),
  }

  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
