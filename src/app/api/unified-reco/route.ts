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
import { getCanonicalFundamentals, isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'
import { fetchMacroData, detectMacroPhase, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { getEntryTimings, type EntryTiming } from '@/lib/entryTiming'
import type { RotationResult, Quadrant as RotQuad } from '@/app/api/sector-rotation/route'
// ⚠️ 버핏 DCF는 원시 FCF 변동성(예: TXN 팹 capex)으로 비현실적 값(-2637%) 발생 → 신뢰 가능한 ROE(버핏 핵심)로 대체

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '').padStart(6, '0').slice(-6)
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// 축 가중치 — 방향(펀더멘탈)이 가장 무겁게(앱 철학: 수급은 연료, 방향은 펀더멘탈)
// 📈 모멘텀(Fwd EPS·가격추세)을 4번째 가중축으로 — "가장 중요" 철학 반영(펀더와 공동 최고)
const W = { season: 0.20, fund: 0.30, supply: 0.20, momentum: 0.30 }

export interface UnifiedRecoItem {
  ticker: string; name: string; market: string; sector: string; lynchCategory: string
  seasonScore: number; fundScore: number; supplyScore: number; momentumScore: number; combined: number
  fwdEpsDir: 'accel' | 'flat' | 'decline' | 'unknown'   // 📈 Fwd EPS 사이클 방향
  priceTrend: 'up' | 'side' | 'down' | 'unknown'        // 📉 최근 주가 추세
  fwdGrowthPct: number | null; priceVs200: number | null
  peg: number | null; opMargin: number | null
  fcfYield: number | null          // 💵 FCF 수익률(FCF/시총 %) — 주가 대비 현금창출력(버블·하락장 방어력)
  qualityGap: boolean              // ⚠️ 이익-현금 괴리(영업흑자인데 FCF 적자) = 이익의 질 의심
  psr: number | null               // 💵 주가매출비율 P/S — 적자기업·성장주 밸류 척도
  roe: number | null               // 🏰 버핏 퀄리티 — 자기자본이익률(소수)
  roic: number | null              // ⚙️ 투하자본이익률(%) — 빚까지 반영한 진짜 자본효율(복리 기계 판별)
  roeInflated: boolean             // ⚙️ ROE가 부채로 부풀려진 가짜 효율(진짜 ROIC는 낮음)
  epsRevision: string | null       // 📈 Fwd EPS 추정 모멘텀 up/down/mixed
  suggestWeight: number            // 💰 권장 편입 비중(%) — 통합점수·국면 배율 반영
  suggestWon: number               // 💰 권장 편입 금액(₩) — 포트폴리오 기준
  seasonFavored: boolean; supplyProxy: boolean; supplyKnown: boolean
  badges: string[]
  timing: EntryTiming | null       // 🚦 타점 신호등(EMA112·224+구름+ATR) — 점수 미반영, WHEN 정보만(신생·부족 시 null)
  rotationQuad: 'leading' | 'weakening' | 'lagging' | 'improving' | null   // 🧭 섹터 로테이션 국면(GICS 11만)
  rotationTilt: number             // 🧭 로테이션 틸트(주도 +4·태동 +2·과열 −1·이탈 −3, 미집계 0) — combined에 이미 반영됨
}
export interface UnifiedRecoResult {
  weights: typeof W
  usSeason: { quadrant: Quadrant; label: string; favored: string[] }
  krSeason: { quadrant: Quadrant; label: string; favored: string[] }
  items: UnifiedRecoItem[]
  selectionRule: string
  portfolioKrw: number          // 포트폴리오 총가치(₩) — 권장 편입액 기준
  regimeMult: number            // 국면 배율(위험 국면 축소)
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
  const cacheKey = `unified-reco-v25:${user.id}:${kstDate()}:${fp}`   // v25: ⬛ 관망(횡보·ADX<20) supply 필드 추가 — 영상 '회색 지대'(가짜 돌파 회피)
  const cached = await getCache<UnifiedRecoResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // base 유니버스 — macro-ai-picks가 적재한 전체 채점 캐시(없으면 빈 결과 graceful)
  const screened = await getCache<ScreenedStock[]>('macro-screened-universe:v7', 8 * 24 * 3600_000)
  if (!screened || screened.length === 0) {
    return NextResponse.json({ weights: W, usSeason: null, krSeason: null, items: [], asOf: new Date().toISOString(), warming: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ① 계절(US·KR) — macro SSOT를 ★in-process 직접 호출(HTTP 자기호출 실패→골디락스 오판 버그 차단)
  let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold', regimeMult = 1.0
  try {
    const md = await fetchMacroData(base)
    cpiYoY = typeof md.cpiYoY === 'number' ? md.cpiYoY : cpiYoY
    rateDir = md.rateDir ?? 'hold'
    const phase = detectMacroPhase(md).phase   // 권장 편입액 국면 배율(위험 국면일수록 축소)
    regimeMult = phase === 'stagflation' || phase === 'recession_risk' ? 0.5 : phase === 'peak_rate' ? 0.75 : 1.0
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
    mf = await getCache<MarketFlowKrResult>(`market-flow-kr-v5:${dt}`, 6 * 24 * 3600_000)
  }
  // 5일 내 캐시도 없으면(콜드/크론 미실행) 1회 라이브 컴퓨트 후 오늘 키에 적재 → 이후 요청 재사용
  if (!mf) { try { mf = await computeMarketFlowKr(base); if (mf) await setCache(`market-flow-kr-v5:${kstDate()}`, mf) } catch { mf = null } }
  const krFlow = new Map((mf?.entries ?? []).map(e => [e.ticker, e]))

  // 보유 종목 제외 + ₩환산 포트폴리오 총가치(권장 편입 금액 계산용)
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency').eq('user_id', user.id)
  const held = new Set((rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'STOCK').map(r => (r.market === 'KR' || /^\d/.test(r.ticker)) ? code6(r.ticker) : r.ticker.toUpperCase()))
  let usdKrw = 1350
  try { const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) }); if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate } } catch { /* 폴백 */ }
  const portfolioKrw = (rows ?? []).reduce((s, r) => s + (r.purchase_price ?? 0) * (r.quantity ?? 0) * (r.currency === 'USD' ? usdKrw : 1), 0)

  // ★ 증거 기반 매크로 오버라이드 게이트 — 계절 신뢰도 낮음(섹터 성적표 diverge) + 빅테크 CapEx 급증(주글라르 surge)일 때만,
  //   계절 불리 기술주의 적합도를 'Fwd EPS 가속' 증거가 있을 때만 복구. 무늬만 AI·역성장·증거없음은 복구 안 함(반-하이프).
  const ssCache = await getCache<{ us: { validation: { verdict: string } }; kr: { validation: { verdict: string } } }>('season-sector-v3', 6 * 3600_000)
  const capCache = await getCache<{ verdict: string; latestYoY: number | null }>('juglar-capex-v1', 24 * 3600_000)
  const usDiverge = ssCache?.us?.validation?.verdict === 'diverge'
  const krDiverge = ssCache?.kr?.validation?.verdict === 'diverge'
  const capexSurge = capCache?.verdict === 'surge'
  const capexFrac = (capCache?.latestYoY ?? 0) / 100

  // 💵 하락장·버블 국면 FCF 방어 틸트 — 막스 시계추 온도(과열≥65 OR 공포≤32)일 때만 현금창출력 가중(getCache 읽기만·콜드면 off)
  const marksCache = await getCache<{ temp: number }>(`marks-cycle-v3:${kstDate()}`, 12 * 3600_000)
  const marketTemp = marksCache?.temp ?? null   // 0~100 탐욕온도(높음=과열/버블·낮음=공포/하락)
  const fcfDefensive = marketTemp != null && (marketTemp >= 65 || marketTemp <= 32)   // "버블·하락장엔 현금이 왕" 국면
  const mSig = (d: ScreenedStock['fwdEpsDir']) => d === 'accel' ? 1 : d === 'flat' ? 0.5 : 0

  // ★ 🧭 섹터 로테이션 틸트 — 로테이션 시계(RRG 17섹터)의 국면을 제한된 가점·감점으로 반영(qualityTilt와 동일 패턴).
  //   5번째 가중축이 아닌 이유: 섹터 국면은 rs/mom 부호로 며칠 만에 뒤집혀 축으로 넣으면 추천 리스트 휩쏘 + 4축 희석.
  //   틸트는 ±4 바운드 — "WHAT은 펀더멘탈" 우선순위 유지, 동점권에서만 주도/이탈 섹터를 가름. 캐시 읽기만(콜드면 틸트 0 graceful).
  let rotQuadBySector: Map<string, { q: RotQuad; score: number }> | null = null
  for (let d = 0; d < 3 && !rotQuadBySector; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    const rot = await getCache<RotationResult>(`sector-rotation-v11:${dt}`, 3 * 24 * 3600_000)
    if (rot?.items?.length) rotQuadBySector = new Map(rot.items.map(i => [i.key, { q: i.quadrant, score: i.score }]))
  }
  // Yahoo GICS 섹터명 → 로테이션 시계 키(GICS 11만 — 테마 6은 종목 중복 소속이라 매핑 제외)
  const SECTOR_TO_ROT: Record<string, string> = {
    'Technology': 'infotech', 'Financial Services': 'financials', 'Healthcare': 'healthcare',
    'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Energy': 'energy',
    'Industrials': 'industrials', 'Basic Materials': 'materials', 'Communication Services': 'communication',
    'Utilities': 'utilities', 'Real Estate': 'realestate',
  }
  const ROT_TILT: Record<RotQuad, number> = { leading: 4, improving: 2, weakening: -1, lagging: -3 }
  const ROT_LABEL: Record<RotQuad, string> = { leading: '🌱 주도 섹터(자금 유입)', improving: '❄️ 태동 섹터(회전 초입)', weakening: '🔥 과열 섹터(모멘텀 둔화)', lagging: '🍂 이탈 섹터(자금 유출)' }
  const rotationOf = (sector: string | null): { q: RotQuad; tilt: number } | null => {
    if (!rotQuadBySector || !sector) return null
    const key = SECTOR_TO_ROT[sector]; if (!key) return null
    const r = rotQuadBySector.get(key); if (!r) return null
    return { q: r.q, tilt: ROT_TILT[r.q] }
  }
  //   복구 공식(제미나이): adjFit = fit + 0.5·min(1,ΔCapEx/0.5)·M_sig — 계절 불리(fit<0.5)·수혜섹터(Technology)만
  function adjustedSeason(rawFit01: number, s: ScreenedStock, diverge: boolean): { score: number; overridden: boolean } {
    if (!diverge || !capexSurge || rawFit01 >= 0.5 || s.sector !== 'Technology') return { score: clamp(rawFit01 * 100), overridden: false }
    const m = mSig(s.fwdEpsDir)
    if (m <= 0) return { score: clamp(rawFit01 * 100), overridden: false }   // 이익 가속 증거 없으면 복구 안 함
    const boost = 0.5 * Math.min(1, capexFrac / 0.5) * m
    return { score: clamp(Math.min(1, rawFit01 + boost) * 100), overridden: true }
  }

  // ③ 계절+펀더멘탈 즉시 채점(전체) → US는 상위만 수급 fetch
  type Pre = { s: ScreenedStock; quad: Quadrant; seasonScore: number; fundScore: number; momentumScore: number; knife: boolean; isKr: boolean; favored: boolean; waveOverride: boolean }
  const pre: Pre[] = screened
    .filter(s => !held.has(s.market === 'KR' ? code6(s.ticker) : s.ticker.toUpperCase()))
    .map(s => {
      const isKr = s.market === 'KR'
      const quad = isKr ? krQuad : usQuad
      const h: Holding = { ticker: s.ticker, weight: 0, lynchCategory: s.lynchCategory as Holding['lynchCategory'], sector: s.sector ?? undefined }
      const { score: seasonScore, overridden: waveOverride } = adjustedSeason(holdingFit(h, quad), s, isKr ? krDiverge : usDiverge)
      const favored = s.sector != null && SEASON_META[quad].favored.includes(s.sector)
      return { s, quad, seasonScore, fundScore: fundOf(s.score), momentumScore: s.momentumScore ?? 50, knife: s.knife ?? false, isKr, favored, waveOverride }
    })

  // US 수급 fetch 대상 — 계절+펀더+모멘텀 상위 25만(성능 바운드)
  const usPre = pre.filter(p => !p.isKr).sort((a, b) => (b.fundScore * 0.45 + b.seasonScore * 0.25 + b.momentumScore * 0.3) - (a.fundScore * 0.45 + a.seasonScore * 0.25 + a.momentumScore * 0.3)).slice(0, 25)
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
    // 📈 모멘텀 배지(Fwd EPS·가격추세)
    if (p.s.fwdEpsDir === 'accel') badges.push('📈 이익 가속(상승 사이클)')
    else if (p.s.fwdEpsDir === 'decline') badges.push('📉 이익 역성장(하강 사이클)')
    if (p.s.priceTrend === 'up') badges.push('🚀 주가 상승추세')
    else if (p.s.priceTrend === 'down') badges.push('🔻 주가 하락추세')
    if (p.knife) badges.push('🔪 급락 추세(falling knife)')
    if (p.waveOverride) badges.push('🌊 CapEx 수혜(매크로 역풍 돌파)')
    // 🧭 섹터 로테이션 틸트(±4 바운드) — 선정 전 반영: 주도/태동 섹터 종목이 동점권에서 앞서고, 이탈 섹터는 뒤로
    const rot = rotationOf(p.s.sector)
    if (rot) badges.push(`🧭 ${ROT_LABEL[rot.q]}`)
    const rotTilt = rot?.tilt ?? 0
    const combined = clamp(p.seasonScore * W.season + p.fundScore * W.fund + supplyScore * W.supply + p.momentumScore * W.momentum + rotTilt)
    return { p, supplyScore, supplyKnown, supplyProxy, badges, combined, rotQuad: rot?.q ?? null, rotTilt }
  })

  // ⑤ 원칙적 선별 — ① 품질 바닥 통합 65↑ ② 섹터당 최대 4(분산) ③ 최대 12종 ④ 한국 최소 3종 보장(국내 학생용)
  const QUALITY_FLOOR = 65, SECTOR_CAP = 4, MAX_ITEMS = 12, MIN_KR = 3
  const ranked = scored.sort((a, b) => b.combined - a.combined)
  const secCount = new Map<string, number>()
  let top: typeof ranked = []
  for (const t of ranked) {
    if (t.combined < QUALITY_FLOOR) continue
    if (t.p.knife) continue   // 🔪 급락 추세 종목은 매수 추천 제외(떨어지는 칼날)
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
      if (!t.p.isKr || t.combined < QUALITY_FLOOR || t.p.knife || inTop.has(t.p.s.ticker)) continue
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
  const selectionRule = `통합 ${QUALITY_FLOOR}점 이상 · 🔪 급락 추세(falling knife) 제외 · 섹터당 최대 ${SECTOR_CAP}종(분산) · 한국 최소 ${MIN_KR}종 보장 · 최대 ${MAX_ITEMS}종${rotQuadBySector ? ' · 🧭 로테이션 틸트(주도 +4·태동 +2·과열 −1·이탈 −3)' : ''}`

  // ⑥ 최종 12종 심화 검증 — canonical PEG(제2원칙) + 🛡️버핏 DCF 안전마진 + 📈Fwd EPS 모멘텀 (배치 4)
  const items: UnifiedRecoItem[] = []
  for (let i = 0; i < top.length; i += 4) {
    const batch = top.slice(i, i + 4)
    const part = await Promise.all(batch.map(async t => {
      const [cf, analyst, sm] = await Promise.all([
        getCanonicalFundamentals(t.p.s.ticker, t.p.s.market, base).catch(() => null),
        getAnalystSignal({ ticker: t.p.s.ticker, name: t.p.s.name, market: t.p.s.market }).catch(() => null),
        buildSignalMetrics(t.p.s.ticker, t.p.s.market, t.p.s.name, base).catch(() => null),   // ⚙️ ROIC(캐시 재사용)
      ])
      const peg = cf?.peg ?? t.p.s.peg
      const roe = cf?.roe ?? null
      const roic = sm?.roic ?? null
      const roeInflated = sm?.roeInflated ?? false
      const epsRevision = analyst?.revisionSignal ?? null
      let badges = [...t.badges]
      let fundScore = t.p.fundScore
      let combined = t.combined
      // ⚠️ 기저효과 가드(SSOT 공통 판정) — 착시 저PEG(이익 붕괴 후 회복 G>100%)는 💎 뱃지 박탈 + 경고 배지
      //   + 가치 점수 과신 방지: 신뢰 불가한 저PEG가 가치를 인플레하므로 가치를 중립 상한(68=마진·FCF 기반만)으로 캡 후 통합 재계산
      if (isPegBaseEffect(peg, cf?.growth ?? null)) {
        badges = badges.filter(b => b !== '💎 저PEG')
        badges.push('⚠️ 저PEG 기저효과 의심')
        if (fundScore > 68) {
          fundScore = 68
          combined = clamp(t.p.seasonScore * W.season + fundScore * W.fund + t.supplyScore * W.supply + t.p.momentumScore * W.momentum + t.rotTilt)
        }
      }
      // ⚙️ 자본효율 — ROIC(투하자본이익률) 우선. 없으면 ROE 폴백. + 점수(→비중) 반영: 복리 기계는 가점, 빚으로 부풀린 ROE는 감점
      if (roic != null && roic >= 15) badges.push(`⚙️ 고ROIC ${Math.round(roic)}%`)          // 복리 기계(빚까지 반영한 진짜 효율)
      else if (roic == null && roe != null && roe >= 0.20) badges.push(`🏰 고ROE ${Math.round(roe * 100)}%`)   // ROIC 없을 때만 ROE 폴백
      if (roeInflated) badges.push(`⚙️ ROE 부풀림(진짜 ROIC ${Math.round(roic ?? 0)}%)`)     // 부채로 부풀린 가짜 효율 경고
      const qualityTilt = (roic != null && roic >= 20 ? 3 : roic != null && roic >= 15 ? 1.5 : 0) - (roeInflated ? 6 : 0)
      if (qualityTilt !== 0) combined = clamp(combined + qualityTilt)
      // 💵 FCF — 이익-현금 괴리 경보(항상) + FCF 수익률 배지 + 버블·하락장 국면 방어 틸트(과열·공포 국면에서만 가점/감점)
      const fy = t.p.s.fcfYield
      // 💵 FCF 수익률 배지 — 점수 반영이 화면에 드러나게: 우수(≥5%)·양호(3~5%)는 초록 톤, 낮음(<1%=현금 대비 비쌈)은 경고 톤
      if (t.p.s.qualityGap) badges.push('⚠️ 이익-현금 괴리(영업흑자·영업현금 적자)')
      else if (fy != null && fy >= 5) badges.push(`💵 FCF수익률 ${fy}%(우수)`)
      else if (fy != null && fy >= 3) badges.push(`💵 FCF수익률 ${fy}%`)
      else if (fy != null && fy < 1) badges.push(`💵 FCF수익률 ${fy}%↓(현금 대비 고평가)`)
      const fcfTilt = fcfDefensive ? (t.p.s.qualityGap ? -5 : fy != null && fy >= 5 ? 3 : fy != null && fy >= 3 ? 1.5 : fy != null && fy < 0 ? -2 : 0) : 0
      if (fcfTilt !== 0) {
        combined = clamp(combined + fcfTilt)
        if (fcfTilt > 0) badges.push('🛟 현금창출력 방어 가중(국면)')
      }
      // 📈 애널리스트 추정 리비전 — 모멘텀(SSOT EPS 방향)과 어긋날 땐 숨김(제2원칙: '이익 가속+추정 하향' 모순 차단)
      if (epsRevision === 'up' && t.p.s.fwdEpsDir !== 'decline') badges.push('📈 이익추정 상향')
      else if (epsRevision === 'down' && t.p.s.fwdEpsDir !== 'accel') badges.push('📉 이익추정 하향')
      // 💰 권장 편입 비중 — 통합점수 티어(2.5/2/1.5%) × 국면 배율, 포트폴리오 기준 ₩
      const suggestWeight = Math.round((combined >= 85 ? 2.5 : combined >= 78 ? 2.0 : 1.5) * regimeMult * 10) / 10
      const suggestWon = Math.round(portfolioKrw * suggestWeight / 100)
      return {
        ticker: t.p.s.ticker, name: t.p.s.name, market: t.p.s.market, sector: t.p.s.sector ?? '—', lynchCategory: t.p.s.lynchCategory as string,
        seasonScore: t.p.seasonScore, fundScore, supplyScore: t.supplyScore, momentumScore: t.p.momentumScore, combined,
        fwdEpsDir: t.p.s.fwdEpsDir, priceTrend: t.p.s.priceTrend, fwdGrowthPct: t.p.s.fwdGrowthPct ?? null, priceVs200: t.p.s.priceVs200 ?? null,
        peg, opMargin: t.p.s.opMargin, fcfYield: t.p.s.fcfYield ?? null, qualityGap: t.p.s.qualityGap ?? false, psr: cf?.psr ?? null, roe, roic, roeInflated, epsRevision, suggestWeight, suggestWon,
        seasonFavored: t.p.favored, supplyProxy: t.supplyProxy, supplyKnown: t.supplyKnown, badges,
        timing: null,   // 🚦 최종 선정 후 일괄 부착
        rotationQuad: t.rotQuad, rotationTilt: t.rotTilt,
      }
    }))
    items.push(...part)
  }
  items.sort((a, b) => b.combined - a.combined)

  // 🚦 타점 신호등 부착(최종 선정 후 — 점수·선정·정렬 절대 불변, WHEN 정보 레이어만)
  try {
    const tmap = await getEntryTimings(items.map(i => ({ ticker: i.ticker, market: (i.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US' })), 4)
    for (const it of items) it.timing = tmap.get(`${it.ticker}:${it.market === 'KR' ? 'KR' : 'US'}`) ?? null
  } catch { /* graceful — 배지만 생략 */ }

  const result: UnifiedRecoResult = {
    weights: W,
    usSeason: { quadrant: usQuad, label: SEASON_META[usQuad].label, favored: SEASON_META[usQuad].favored },
    krSeason: { quadrant: krQuad, label: SEASON_META[krQuad].label, favored: SEASON_META[krQuad].favored },
    items, selectionRule, portfolioKrw, regimeMult, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
