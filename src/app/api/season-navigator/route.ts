// 🧭 4계절 매크로 내비게이터 API — macro-regime SSOT + OECD CLI를 2×2로 번역 + 보유 계절 적합도
// 제2원칙. 매크로 결론은 macro-regime SSOT 단일출처를 그대로 읽고, 성장축만 CLI로 보강(새 판정기 아님)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getSector } from '@/lib/schoolIndex'
import { getEtfComposition } from '@/lib/etfLookThrough'
import { fetchMacroData, detectMacroPhase, type ScreenedStock } from '@/lib/macroPhaseScreener'
import {
  growthFromCli, inflationFromRegime, seasonOf, holdingFit,
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
  perHolding: { ticker: string; name: string; weight: number; fit: number; market: string; isEtf: boolean }[]
  // 🌏 시장별 계절(성장축은 시장별 CLI, 물가축은 글로벌 공통)
  marketSeasons: {
    us: MarketSeason
    kr: MarketSeason
  }
  // 무료 조기 경보
  yieldCurveInverted: boolean
  yieldCurve: number | null
  // 🛒 이 계절 우대 섹터 매수 후보(공유 스크리너 캐시 재사용 · 보유 종목 제외)
  buyCandidates: { ticker: string; name: string; market: string; sector: string; lynchCategory: string; peg: number | null; opMargin: number | null; fcfPositive: boolean; score: number }[]
  asOf: string
}

// 점수 0~100 환산(screenOne score 합은 최상위가 ~1.0 → ×100, 상한 100). 라이브 검증값과 정합
const scaleScore = (s: number) => Math.min(100, Math.round(s * 100))

export interface MarketSeason {
  quadrant: Quadrant
  seasonKo: string
  icon: string
  label: string
  cli: number
  cliPrev: number
  dir: 'up' | 'down'
  aboveTrend: boolean
}

// FRED OECD CLI 최신 + 3개월 전 레벨(모멘텀) — 시리즈별 12h 캐시
async function fetchCli(seriesId: string, cacheKey: string): Promise<{ cli: number; cliPrev: number } | null> {
  const cached = await getCache<{ cli: number; cliPrev: number }>(cacheKey, 12 * 3600_000)
  if (cached) return cached
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=4`
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const j = await r.json()
    const obs = (j.observations ?? []).map((o: { value: string }) => parseFloat(o.value)).filter((v: number) => !isNaN(v))
    if (obs.length < 4) return null
    const out = { cli: obs[0], cliPrev: obs[3] }
    await setCache(cacheKey, out)
    return out
  } catch { return null }
}

// KR 시장 판별(6자리 코드 또는 market 필드)
const isKrHolding = (ticker: string, market?: string) => market === 'KR' || /^\d{6}$/.test(ticker.replace(/\.(KS|KQ)$/i, ''))

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `season-navigator-v8:${user.id}:${kstDate()}:${fp}`   // v8: ETF Look-through 정합성 반영
  const cached = await getCache<SeasonNavResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 물가/금리축 + 역전경보 = macro SSOT를 ★in-process로 직접 호출(HTTP 자기호출 제거)
  //    이유: /api/macro-regime HTTP 자기호출이 실패하면 조용히 기본값(2.5,hold)→골디락스 오판. CPI는 FRED 직접이라 신뢰
  let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold', regimeLabel = '—'
  let yieldCurve: number | null = null
  try {
    const md = await fetchMacroData(base)
    cpiYoY = typeof md.cpiYoY === 'number' ? md.cpiYoY : cpiYoY
    rateDir = md.rateDir ?? 'hold'
    yieldCurve = typeof md.yieldCurve === 'number' ? md.yieldCurve : null
    regimeLabel = detectMacroPhase(md).label
  } catch { /* graceful — 폴백 중립값 사용 */ }

  // ② 성장축 = OECD CLI(미국·한국 각각). 물가축은 글로벌 공통(KR CPI는 FRED stale → 글로벌 기준 사용)
  const [usCli, krCli] = await Promise.all([
    fetchCli('USALOLITOAASTSAM', 'oecd-cli-us-v1'),
    fetchCli('KORLOLITOAASTSAM', 'oecd-cli-kr-v1'),
  ])
  const i = inflationFromRegime(cpiYoY, rateDir)
  const gUs = growthFromCli(usCli?.cli ?? 100, usCli?.cliPrev ?? 100)
  const gKr = growthFromCli(krCli?.cli ?? 100, krCli?.cliPrev ?? 100)
  const usQuad = seasonOf(gUs, i)   // 미국 = 글로벌 매크로 앵커(메인 다이어그램·행동가이드 기준)
  const krQuad = seasonOf(gKr, i)
  const g = gUs                      // 축 진단·메인 다이어그램은 미국 앵커
  const quadrant = usQuad
  const meta = SEASON_META[quadrant]
  const mkMeta = (q: Quadrant, gg: typeof gUs): MarketSeason => ({
    quadrant: q, seasonKo: SEASON_META[q].seasonKo, icon: SEASON_META[q].icon, label: SEASON_META[q].label,
    cli: gg.cli, cliPrev: gg.cliPrev, dir: gg.dir, aboveTrend: gg.aboveTrend,
  })

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

  const holdings: (Holding & { name: string })[] = stocks.map((r, idx) => {
    const rate = r.currency === 'USD' ? usdKrw : 1
    const weight = (r.purchase_price ?? 0) * (r.quantity ?? 0) * rate   // ₩환산 평가(원가) — 내부에서 비중 정규화
    return {
      ticker: r.ticker,
      name: r.name ?? r.ticker,
      weight,
      lynchCategory: (r.lynch_category ?? null) as LynchCat,
      sector: sectors[idx] || undefined,
      market: isKrHolding(r.ticker, r.market ?? undefined) ? 'KR' : 'US',
    }
  }).filter(h => h.weight > 0)

  // ③-b 🔬 ETF Look-through — 주식형 ETF도 정합성에 반영(ETF가 점수에서 통째로 빠지던 왜곡 해소)
  //    ETF fit = Σ(섹터비중 × 섹터적합 1.0/0.5). 계절은 국가비중(usWeight)으로 — KR상장 미국ETF는 미국 계절
  const etfRows = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'ETF')
  const etfComps = await Promise.all(etfRows.map(r => getEtfComposition(r.ticker, r.market ?? undefined).catch(() => null)))
  type EtfScored = { ticker: string; name: string; weight: number; fit: number; market: string; isEtf: true }
  const etfScored: EtfScored[] = []
  etfRows.forEach((r, idx) => {
    const c = etfComps[idx]
    if (!c || !c.isEquityEtf || c.isLeveraged || c.sectorWeights.length === 0) return   // 비주식·레버리지·미분해는 제외(판정 불가 — 정직)
    const w = (r.purchase_price ?? 0) * (r.quantity ?? 0) * (r.currency === 'USD' ? usdKrw : 1)
    if (w <= 0) return
    const quad = c.usWeight >= 50 ? usQuad : krQuad   // 자산 소재 국가 기준 계절
    const favored = SEASON_META[quad].favored
    const secSum = c.sectorWeights.reduce((s, x) => s + x.weight, 0) || 100
    const fit = c.sectorWeights.reduce((s, x) => s + (x.weight / secSum) * (favored.includes(x.sector) ? 1.0 : 0.5), 0)
    etfScored.push({ ticker: r.ticker, name: c.name, weight: w, fit: Math.round(fit * 100) / 100, market: c.usWeight >= 50 ? 'US' : 'KR', isEtf: true })
  })

  // ③ 시장별 계절로 종목 채점(주식) + ETF 기여 합산 — 분모 = 주식+분해가능 ETF
  const totalW = holdings.reduce((s, h) => s + h.weight, 0) + etfScored.reduce((s, e) => s + e.weight, 0) || 1
  const perHolding = [
    ...holdings.map(h => {
      const q = h.market === 'KR' ? krQuad : usQuad
      return { ticker: h.ticker, name: h.name, weight: Math.round((h.weight / totalW) * 1000) / 10, fit: holdingFit(h, q), market: h.market ?? 'US', isEtf: false }
    }),
    ...etfScored.map(e => ({ ticker: e.ticker, name: e.name, weight: Math.round((e.weight / totalW) * 1000) / 10, fit: e.fit, market: e.market, isEtf: true })),
  ].sort((a, b) => b.weight - a.weight)
  const alignmentScore = Math.round(perHolding.reduce((s, p) => s + (p.weight / 100) * p.fit, 0) * 100)

  // 🛒 이 계절 우대 섹터 매수 후보 — macro-ai-picks가 적재한 공유 스크리너 캐시 재사용(추가 fetch 0)
  const heldSet = new Set(stocks.map(r => r.ticker.replace(/\.(KS|KQ)$/i, '')))
  const screened = await getCache<ScreenedStock[]>('macro-screened-universe:v6', 8 * 24 * 3600_000)
  const buyCandidates = (screened ?? [])
    .filter(s => s.sector != null && meta.favored.includes(s.sector) && !heldSet.has(s.ticker.replace(/\.(KS|KQ)$/i, '')))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => ({
      ticker: s.ticker, name: s.name, market: s.market as string, sector: s.sector ?? '—', lynchCategory: s.lynchCategory as string,
      peg: s.peg, opMargin: s.opMargin, fcfPositive: s.fcfPositive, score: scaleScore(s.score),
    }))

  const result: SeasonNavResult = {
    quadrant: meta.quadrant, seasonKo: meta.seasonKo, icon: meta.icon, label: meta.label,
    guide: meta.guide, cashHint: meta.cashHint, favored: meta.favored,
    growth: { cli: g.cli, cliPrev: g.cliPrev, dir: g.dir, aboveTrend: g.aboveTrend },
    inflation: { cpiYoY: i.cpiYoY, rateDir: i.rateDir, hot: i.hot },
    regimeLabel,
    alignmentScore,
    perHolding,
    marketSeasons: { us: mkMeta(usQuad, gUs), kr: mkMeta(krQuad, gKr) },
    yieldCurveInverted: yieldCurve != null && yieldCurve < 0,
    yieldCurve,
    buyCandidates,
    asOf: new Date().toISOString(),
  }

  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
