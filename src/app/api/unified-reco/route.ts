// 🎯 통합 3축 추천 — 계절(매크로 방향)×펀더멘탈(가치)×수급(연료)을 하나의 점수로 융합
// 4계절 내비게이터(방향) + 수급 레이더 맞춤추천(연료)을 단일 기준으로 통합. 기존 엔진 전부 재사용
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { growthFromCli, inflationFromRegime, seasonOf, holdingFit, SEASON_META, type Quadrant, type Holding } from '@/lib/seasonNavigator'
import { computeMarketFlowKr, type MarketFlowKrResult, type MarketFlowEntry } from '@/lib/marketFlowKr'
import { getMoneyFlow } from '@/lib/moneyFlow'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'
import { fetchMacroData, type ScreenedStock } from '@/lib/macroPhaseScreener'
// ⚠️ 버핏 DCF는 원시 FCF 변동성(예: TXN 팹 capex)으로 비현실적 값(-2637%) 발생 → 신뢰 가능한 ROE(버핏 핵심)로 대체

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '').padStart(6, '0').slice(-6)
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// 축 가중치 — 방향(펀더멘탈)이 가장 무겁게(앱 철학: 수급은 연료, 방향은 펀더멘탈)
const W = { season: 0.25, fund: 0.40, supply: 0.35 }

export interface UnifiedRecoItem {
  ticker: string; name: string; market: string; sector: string; lynchCategory: string
  seasonScore: number; fundScore: number; supplyScore: number; combined: number
  peg: number | null; opMargin: number | null
  roe: number | null               // 🏰 버핏 퀄리티 — 자기자본이익률(소수)
  epsRevision: string | null       // 📈 Fwd EPS 추정 모멘텀 up/down/mixed
  seasonFavored: boolean; supplyProxy: boolean; supplyKnown: boolean
  badges: string[]
}
export interface UnifiedRecoResult {
  weights: typeof W
  usSeason: { quadrant: Quadrant; label: string; favored: string[] }
  krSeason: { quadrant: Quadrant; label: string; favored: string[] }
  items: UnifiedRecoItem[]
  selectionRule: string
  asOf: string
}

// 펀더멘탈 점수(0~100) — screenOne score 합(최상위 ~1.0) ×100
const fundOf = (s: number) => clamp(s * 100)

// KR 수급 점수(0~100) — 외인/기관 5일 + 쌍끌이 + 개인 이탈(메이저가 받는 구조)
function krSupply(e: MarketFlowEntry): number {
  let s = 30
  s += Math.min(e.dualStreak * 12, 36)
  s += e.foreign.d5 > 0 ? 15 : e.foreign.d5 < 0 ? -12 : 0
  s += e.organ.d5 > 0 ? 15 : e.organ.d5 < 0 ? -12 : 0
  s += (e.individual?.d1 ?? 0) < 0 ? 12 : 0
  return clamp(s)
}
// US 수급 점수(0~100, 프록시) — MFI 과매도·상승 + 내부자 + 13F 거인
function usSupply(mf: Awaited<ReturnType<typeof getMoneyFlow>>): number {
  let s = 40
  const u = mf.us
  if (u?.mfi != null) {
    if (u.mfi < 30) s += 22
    else if (u.mfi < 50) s += 12
    else if (u.mfi <= 70) s += 4
    else if (u.mfi > 80) s -= 15
    if (u.mfiTrend === 'rising') s += 10
  }
  if (u?.insiderCluster) s += 20
  else if ((u?.insiderBuyers ?? 0) > 0) s += 10
  if (u?.giantTrend === 'add') s += 14
  else if ((u?.giantHolders ?? 0) > 0) s += 6
  return clamp(s)
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `unified-reco-v8:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<UnifiedRecoResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // base 유니버스 — macro-ai-picks가 적재한 전체 채점 캐시(없으면 빈 결과 graceful)
  const screened = await getCache<ScreenedStock[]>('macro-screened-universe:v2', 8 * 24 * 3600_000)
  if (!screened || screened.length === 0) {
    return NextResponse.json({ weights: W, usSeason: null, krSeason: null, items: [], asOf: new Date().toISOString(), warming: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ① 계절(US·KR) — macro SSOT를 ★in-process 직접 호출(HTTP 자기호출 실패→골디락스 오판 버그 차단)
  let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold'
  try {
    const md = await fetchMacroData(base)
    cpiYoY = typeof md.cpiYoY === 'number' ? md.cpiYoY : cpiYoY
    rateDir = md.rateDir ?? 'hold'
  } catch { /* graceful */ }
  const fetchCli = async (sid: string, key: string) => {
    const c = await getCache<{ cli: number; cliPrev: number }>(key, 12 * 3600_000)
    if (c) return c
    try {
      const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${sid}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=4`, { signal: AbortSignal.timeout(10_000) })
      if (!r.ok) return null
      const j = await r.json(); const o = (j.observations ?? []).map((x: { value: string }) => parseFloat(x.value)).filter((v: number) => !isNaN(v))
      if (o.length < 4) return null
      const out = { cli: o[0], cliPrev: o[3] }; await setCache(key, out); return out
    } catch { return null }
  }
  const [usCli, krCli] = await Promise.all([fetchCli('USALOLITOAASTSAM', 'oecd-cli-us-v1'), fetchCli('KORLOLITOAASTSAM', 'oecd-cli-kr-v1')])
  const inf = inflationFromRegime(cpiYoY, rateDir)
  const usQuad = seasonOf(growthFromCli(usCli?.cli ?? 100, usCli?.cliPrev ?? 100), inf)
  const krQuad = seasonOf(growthFromCli(krCli?.cli ?? 100, krCli?.cliPrev ?? 100), inf)

  // ② KR 수급 — marketFlowKr 캐시(113) 6자리 조인. ★최근 5일 내 최신 캐시 폴백(장중/주말 라이브 스크랩 회피)
  //    크론이 16:00 KST 장마감 후에만 워밍 → 아침·장중·주말엔 오늘 키가 비므로 최근 영업일 캐시 재사용(누적 수급 유효)
  let mf: MarketFlowKrResult | null = null
  for (let d = 0; d < 5 && !mf; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    mf = await getCache<MarketFlowKrResult>(`market-flow-kr-v4:${dt}`, 6 * 24 * 3600_000)
  }
  // 5일 내 캐시도 없으면(콜드/크론 미실행) 1회 라이브 컴퓨트 후 오늘 키에 적재 → 이후 요청 재사용
  if (!mf) { try { mf = await computeMarketFlowKr(base); if (mf) await setCache(`market-flow-kr-v4:${kstDate()}`, mf) } catch { mf = null } }
  const krFlow = new Map((mf?.entries ?? []).map(e => [e.ticker, e]))

  // 보유 종목 제외
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const held = new Set((rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'STOCK').map(r => (r.market === 'KR' || /^\d/.test(r.ticker)) ? code6(r.ticker) : r.ticker.toUpperCase()))

  // ③ 계절+펀더멘탈 즉시 채점(전체) → US는 상위만 수급 fetch
  type Pre = { s: ScreenedStock; quad: Quadrant; seasonScore: number; fundScore: number; isKr: boolean; favored: boolean }
  const pre: Pre[] = screened
    .filter(s => !held.has(s.market === 'KR' ? code6(s.ticker) : s.ticker.toUpperCase()))
    .map(s => {
      const isKr = s.market === 'KR'
      const quad = isKr ? krQuad : usQuad
      const h: Holding = { ticker: s.ticker, weight: 0, lynchCategory: s.lynchCategory as Holding['lynchCategory'], sector: s.sector ?? undefined }
      const seasonScore = clamp(holdingFit(h, quad) * 100)
      const favored = s.sector != null && SEASON_META[quad].favored.includes(s.sector)
      return { s, quad, seasonScore, fundScore: fundOf(s.score), isKr, favored }
    })

  // US 수급 fetch 대상 — 계절+펀더멘탈 상위 25만(성능 바운드)
  const usPre = pre.filter(p => !p.isKr).sort((a, b) => (b.fundScore * 0.6 + b.seasonScore * 0.4) - (a.fundScore * 0.6 + a.seasonScore * 0.4)).slice(0, 25)
  const usFlowMap = new Map<string, Awaited<ReturnType<typeof getMoneyFlow>>>()
  for (let i = 0; i < usPre.length; i += 5) {
    const batch = usPre.slice(i, i + 5)
    const r = await Promise.all(batch.map(p => getMoneyFlow(p.s.ticker, 'US', p.s.name, base).catch(() => null)))
    batch.forEach((p, idx) => { if (r[idx]) usFlowMap.set(p.s.ticker, r[idx]!) })
  }

  // ④ 수급 점수 + 통합 점수
  const scored = pre.map(p => {
    let supplyScore = 50, supplyKnown = false, supplyProxy = false
    const badges: string[] = []
    if (p.isKr) {
      const e = krFlow.get(code6(p.s.ticker))
      if (e) {
        supplyScore = krSupply(e); supplyKnown = true
        if (e.dualStreak >= 2) badges.push(`🔥 ${e.dualStreak}일 쌍끌이`)
        if ((e.individual?.d1 ?? 0) < 0) badges.push('👤 개인 이탈')
      }
    } else {
      supplyProxy = true
      const m = usFlowMap.get(p.s.ticker)
      if (m) {
        supplyScore = usSupply(m); supplyKnown = true
        if (m.us?.mfi != null && m.us.mfi < 30) badges.push('📉 MFI 과매도(매집 여력)')
        if (m.us?.insiderCluster) badges.push('🕵️ 내부자 클러스터')
        if (m.us?.giantTrend === 'add') badges.push('🐳 13F 거인 매집')
      }
    }
    if (p.favored) badges.push('🌦️ 계절 우대 섹터')
    if (p.s.peg != null && p.s.peg > 0 && p.s.peg < 1) badges.push('💎 저PEG')
    const combined = clamp(p.seasonScore * W.season + p.fundScore * W.fund + supplyScore * W.supply)
    return { p, supplyScore, supplyKnown, supplyProxy, badges, combined }
  })

  // ⑤ 원칙적 선별 — ① 품질 바닥 통합 65↑ ② 섹터당 최대 4(분산) ③ 최대 12종 ④ 한국 최소 3종 보장(국내 학생용)
  const QUALITY_FLOOR = 65, SECTOR_CAP = 4, MAX_ITEMS = 12, MIN_KR = 3
  const ranked = scored.sort((a, b) => b.combined - a.combined)
  const secCount = new Map<string, number>()
  let top: typeof ranked = []
  for (const t of ranked) {
    if (t.combined < QUALITY_FLOOR) continue
    const sec = t.p.s.sector ?? '—'
    const c = secCount.get(sec) ?? 0
    if (c >= SECTOR_CAP) continue   // 한 섹터 과밀 방지
    secCount.set(sec, c + 1); top.push(t)
    if (top.length >= MAX_ITEMS) break
  }
  // ④ 한국 대표성 — KR이 MIN_KR 미만이면, 품질 바닥 넘는 최상위 KR로 최저 미국 종목을 교체(국내 학생 체감↑)
  const krInTop = top.filter(t => t.p.isKr).length
  if (krInTop < MIN_KR) {
    const inTop = new Set(top.map(t => t.p.s.ticker))
    const krAdd: typeof ranked = []
    for (const t of ranked) {
      if (krAdd.length >= MIN_KR - krInTop) break
      if (!t.p.isKr || t.combined < QUALITY_FLOOR || inTop.has(t.p.s.ticker)) continue
      const sec = t.p.s.sector ?? '—'
      if ((secCount.get(sec) ?? 0) >= SECTOR_CAP) continue
      secCount.set(sec, (secCount.get(sec) ?? 0) + 1); krAdd.push(t)
    }
    if (krAdd.length > 0) {
      const dropUs = top.filter(t => !t.p.isKr).sort((a, b) => a.combined - b.combined).slice(0, krAdd.length)
      const dropSet = new Set(dropUs.map(t => t.p.s.ticker))
      top = top.filter(t => !dropSet.has(t.p.s.ticker)).concat(krAdd).sort((a, b) => b.combined - a.combined)
    }
  }
  const selectionRule = `통합 ${QUALITY_FLOOR}점 이상 · 섹터당 최대 ${SECTOR_CAP}종(분산) · 한국 최소 ${MIN_KR}종 보장 · 최대 ${MAX_ITEMS}종`

  // ⑥ 최종 12종 심화 검증 — canonical PEG(제2원칙) + 🛡️버핏 DCF 안전마진 + 📈Fwd EPS 모멘텀 (배치 4)
  const items: UnifiedRecoItem[] = []
  for (let i = 0; i < top.length; i += 4) {
    const batch = top.slice(i, i + 4)
    const part = await Promise.all(batch.map(async t => {
      const [cf, analyst] = await Promise.all([
        getCanonicalFundamentals(t.p.s.ticker, t.p.s.market, base).catch(() => null),
        getAnalystSignal({ ticker: t.p.s.ticker, name: t.p.s.name, market: t.p.s.market }).catch(() => null),
      ])
      const peg = cf?.peg ?? t.p.s.peg
      const roe = cf?.roe ?? null
      const epsRevision = analyst?.revisionSignal ?? null
      const badges = [...t.badges]
      if (roe != null && roe >= 0.20) badges.push(`🏰 고ROE ${Math.round(roe * 100)}%`)   // 버핏 퀄리티(자본효율)
      if (epsRevision === 'up') badges.push('📈 이익추정 상향')
      else if (epsRevision === 'down') badges.push('📉 이익추정 하향')
      return {
        ticker: t.p.s.ticker, name: t.p.s.name, market: t.p.s.market, sector: t.p.s.sector ?? '—', lynchCategory: t.p.s.lynchCategory as string,
        seasonScore: t.p.seasonScore, fundScore: t.p.fundScore, supplyScore: t.supplyScore, combined: t.combined,
        peg, opMargin: t.p.s.opMargin, roe, epsRevision,
        seasonFavored: t.p.favored, supplyProxy: t.supplyProxy, supplyKnown: t.supplyKnown, badges,
      }
    }))
    items.push(...part)
  }
  items.sort((a, b) => b.combined - a.combined)

  const result: UnifiedRecoResult = {
    weights: W,
    usSeason: { quadrant: usQuad, label: SEASON_META[usQuad].label, favored: SEASON_META[usQuad].favored },
    krSeason: { quadrant: krQuad, label: SEASON_META[krQuad].label, favored: SEASON_META[krQuad].favored },
    items, selectionRule, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
