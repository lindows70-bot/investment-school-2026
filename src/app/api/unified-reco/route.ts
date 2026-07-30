// 🎯 통합 3축 추천 — 계절(매크로 방향)×펀더멘탈(가치)×수급(연료)을 하나의 점수로 융합
// 4계절 내비게이터(방향) + 수급 레이더 맞춤추천(연료)을 단일 기준으로 통합. 기존 엔진 전부 재사용
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { growthFromCli, inflationFromRegime, seasonOf, holdingFit, SEASON_META, type Quadrant, type Holding } from '@/lib/seasonNavigator'
import { MARKET_FLOW_KR_KEY, computeMarketFlowKr, type MarketFlowKrResult, type MarketFlowEntry } from '@/lib/marketFlowKr'
import { getMoneyFlow } from '@/lib/moneyFlow'
import { getCanonicalFundamentals, isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'
import { fetchMacroData, detectMacroPhase, EU_TICKER_SET, JP_TICKER_SET, CN_TICKER_SET, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { computeCountryVol, type CountryVolItem } from '@/lib/countryVol'
import { volForStock } from '@/lib/countryVolShared'
import { UNIFIED_RECO_V } from '@/lib/recoCacheVersion'   // 하류(브리핑·리밸런싱·퀀트빌더) 캐시를 함께 무효화하는 공유 버전
import { SECTOR_ROTATION_KEY, SECTOR_TO_ROT, rotAxisScore } from '@/lib/rotationShared'   // 🧭 로테이션 SSOT(키·맵·정규화 — 3곳 복붙 제거)
import { getEntryTimings, type EntryTiming } from '@/lib/entryTiming'
import { buildEtfAltMap, type EtfAlt } from '@/lib/etfAlternative'
import type { RotationResult, Quadrant as RotQuad } from '@/app/api/sector-rotation/route'
// ⚠️ 버핏 DCF는 원시 FCF 변동성(예: TXN 팹 capex)으로 비현실적 값(-2637%) 발생 → 신뢰 가능한 ROE(버핏 핵심)로 대체

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '').padStart(6, '0').slice(-6)
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// 축 가중치 — 펀더멘탈(가치+퀄리티)을 앵커로(앱 철학: Get Rich Slowly·확정적으로 잃지 않게·WHAT은 펀더멘탈)
// 6축: 💎가치(저평가)·🏰퀄리티(재무건전성)·📈모멘텀·🧭주도섹터(자금 회전)·💰수급(연료)·🌦️계절(매크로).
// 🏰퀄리티 5번째 축(2026-07-18) + 🧭주도섹터 6번째 축(같은 날) — 기존 ±4 틸트를 정식 축으로 승격(실제 돈이 도는 섹터).
// 주도섹터 10%(수급·모멘텀과 성격 겹치고 반전 위험이라 과중 금지·틸트보단 확실히). 수급 15→10·계절 20→15로 재원.
const W = { season: 0.15, value: 0.25, quality: 0.20, supply: 0.10, momentum: 0.20, rotation: 0.10 }

export interface UnifiedRecoItem {
  ticker: string; name: string; market: string; currency: string; origin: 'EU' | 'KR' | 'US' | 'JP' | 'CN'; sector: string; industry: string | null; lynchCategory: string
  seasonScore: number; valueScore: number; qualityScore: number; supplyScore: number; momentumScore: number; combined: number
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
  rotationScore: number            // 🧭 주도섹터 축(0~100) — RRG 쏠림점수(상대강도×모멘텀) 정규화, 미집계=50(중립)
  etfAlt: EtfAlt | null             // 🔬 ETF 분산 대안(같은 GICS 섹터 ETF) — 점수 미반영, 분산 선택지 병기만
  /** 💪 상대강도 — 자국 지수 대비 20일 초과수익(%p). ⛔ **점수(가중 축)에는 절대 미반영**.
   *  자체 백테스트(58종목·28,910봉·워크포워드)가 **한쪽만** 지지했기 때문이다:
   *   · 강세(≥+10%p) edge +1.25%p 이나 **이상치 제거 시 −0.14%p 로 소멸** → '강한 걸 사라'는 기각
   *   · 하락장만 보면 **정반대** — 버틴 종목 −2.83%p / 같이 무너진 종목 +0.75%p(모멘텀 크래시)
   *   · ⭐ 약세(≤−10%p)만 **이상치 제거 후에도 −2.12%p** 로 명확히 나빴다 → '약한 건 피하라'만 살아남음
   *  그래서 **점수가 아니라 제외 게이트로만** 쓴다(RS_FLOOR). 표시 배지에도 한계를 함께 적는다. */
  rsVsMarket: number | null
}
// 🌍 지역 커버리지 참고 아이템(순위 무관·경량) — merit 12종 밖의 한국·유럽 대표 후보
export interface RegionRefItem {
  ticker: string; name: string; market: string; currency: string; sector: string; region: 'KR' | 'EU' | 'JP' | 'CN'
  combined: number; seasonScore: number; valueScore: number; qualityScore: number; momentumScore: number; supplyScore: number; rotationScore: number
  supplyKnown: boolean; supplyProxy: boolean   // 수급 미집계(중립 50)를 실측값처럼 보이지 않게 — merit 카드와 동일 정직 표기
  peg: number | null; badges: string[]
}

export interface UnifiedRecoResult {
  weights: typeof W
  usSeason: { quadrant: Quadrant; label: string; favored: string[] }
  krSeason: { quadrant: Quadrant; label: string; favored: string[] }
  euSeason?: { quadrant: Quadrant; label: string; favored: string[] }   // 🇪🇺 유럽 독자 계절(참고 섹션 라벨용)
  jpSeason?: { quadrant: Quadrant; label: string; favored: string[] }   // 🇯🇵 일본 독자 계절
  cnSeason?: { quadrant: Quadrant; label: string; favored: string[] }   // 🇨🇳 중국 독자 계절
  items: UnifiedRecoItem[]
  reference?: RegionRefItem[]   // 🌍 지역 커버리지(참고 · 순위 무관)
  volByOrigin?: Record<string, CountryVolItem>   // 🌪️ 국가별 시장 변동성(origin → 대표 지수) — ⛔ 점수 미반영, 배지·갭 경고 전용
  selectionRule: string
  portfolioKrw: number          // 포트폴리오 총가치(₩) — 권장 편입액 기준
  regimeMult: number            // 국면 배율(위험 국면 축소)
  momCrash?: boolean            // ⚠️ 모멘텀 크래시 국면(승패 해부실 12-1 역전 실측 재사용) — 점수 불변·캐비엇 전용
  asOf: string
}

// 축 점수(0~100) — screenOne valueScore·qualityScore(0~1) ×100
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
// KR 수급 폴백 점수(0~100) — marketFlowKr POOL 밖 종목을 getMoneyFlow(네이버 실수급)로 채점. krSupply와 동일 척도(5일 순매수·동반매수·개인 이탈)
//   ⚠️ 쌍끌이 연속일수(dualStreak)는 per-ticker 트렌드엔 없어, 외인·기관 5일 동반 순매수에 고정 보너스(+24 ≈ 2일 쌍끌이)로 근사
function krSupplyFromFlow(mf: Awaited<ReturnType<typeof getMoneyFlow>>): number {
  const f5 = mf.foreign?.net5 ?? 0, o5 = mf.organ?.net5 ?? 0, i5 = mf.individual?.net5 ?? 0
  let s = 30
  if (f5 > 0 && o5 > 0) s += 24
  s += f5 > 0 ? 15 : f5 < 0 ? -12 : 0
  s += o5 > 0 ? 15 : o5 < 0 ? -12 : 0
  s += i5 < 0 ? 12 : 0
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
  const cacheKey = `unified-reco-${UNIFIED_RECO_V}:${user.id}:${kstDate()}:${fp}`   // v52: 심화 검증 후 품질 바닥(65) 재적용 · v51: 지수 대비 −10%p 이하 약세 제외 · v50: 참고 리스트도 급락 제외 · v49: 💪 상대강도(지수 대비 20일) 표시 추가(점수 미반영) · v48: 📉 급락 종목 선별 제외(배지→필터) · v47: 🔪 칼날 깊이 조건(200일선 −20%↓)
  const cached = await getCache<UnifiedRecoResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // base 유니버스 — macro-ai-picks가 적재한 전체 채점 캐시(없으면 빈 결과 graceful)
  const screened = await getCache<ScreenedStock[]>('macro-screened-universe:v10', 8 * 24 * 3600_000)
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
  // 🇪🇺 유로존 HICP(소비자물가) YoY — 유럽 독자 물가축(FRED 신선). 실패 시 글로벌(US) 물가로 폴백
  const fetchEuHicp = async (): Promise<number | null> => {
    const c = await getCache<{ v: number }>('eu-hicp-yoy-v1', 24 * 3600_000); if (c) return c.v
    try {
      const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=CP0000EZ19M086NEST&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=2&units=pc1`, { signal: AbortSignal.timeout(10_000) })
      if (!r.ok) return null
      const j = await r.json(); const o = (j.observations ?? []).map((x: { value: string }) => parseFloat(x.value)).filter((v: number) => !isNaN(v))
      if (!o.length) return null; await setCache('eu-hicp-yoy-v1', { v: o[0] }); return o[0]
    } catch { return null }
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const [usCli, krCli, deCli, frCli, itCli, gbCli, jpCli, cnCli, euHicp] = await Promise.all([
    fetchCli('USALOLITOAASTSAM', 'oecd-cli-us-v1'), fetchCli('KORLOLITOAASTSAM', 'oecd-cli-kr-v1'),
    fetchCli('DEULOLITOAASTSAM', 'oecd-cli-de-v1'), fetchCli('FRALOLITOAASTSAM', 'oecd-cli-fr-v1'),
    fetchCli('ITALOLITOAASTSAM', 'oecd-cli-it-v1'), fetchCli('GBRLOLITOAASTSAM', 'oecd-cli-gb-v1'),
    fetchCli('JPNLOLITOAASTSAM', 'oecd-cli-jp-v1'), fetchCli('CHNLOLITOAASTSAM', 'oecd-cli-cn-v1'),
    fetchEuHicp(),
  ])
  const inf = inflationFromRegime(cpiYoY, rateDir)
  const usQuad = seasonOf(growthFromCli(usCli?.cli ?? 100, usCli?.cliPrev ?? 100), inf)
  const krQuad = seasonOf(growthFromCli(krCli?.cli ?? 100, krCli?.cliPrev ?? 100), inf)
  // 🇪🇺 유럽 독자 계절 — 유로존 통합 CLI(EA19)는 2022 중단(stale)이라 대국(독·프·이·영) 신선 CLI 평균으로 성장축 + 유로존 HICP로 물가축. 2개국+ 있을 때만, 부족 시 usQuad 폴백
  const euClis = [deCli, frCli, itCli, gbCli].filter((c): c is { cli: number; cliPrev: number } => c != null)
  const euQuad = euClis.length >= 2
    ? seasonOf(growthFromCli(avg(euClis.map(c => c.cli)), avg(euClis.map(c => c.cliPrev))), euHicp != null ? inflationFromRegime(euHicp, rateDir) : inf)
    : usQuad
  // 🇯🇵 일본·🇨🇳 중국 독자 계절 — 각 OECD CLI(신선)로 성장축 + 글로벌 물가축(한국 방식 — 일본 CPI 미제공·중국 CPI stale). 데이터 없으면 usQuad 폴백
  const jpQuad = jpCli ? seasonOf(growthFromCli(jpCli.cli, jpCli.cliPrev), inf) : usQuad
  const cnQuad = cnCli ? seasonOf(growthFromCli(cnCli.cli, cnCli.cliPrev), inf) : usQuad

  // ② KR 수급 — marketFlowKr 캐시(113) 6자리 조인. ★최근 5일 내 최신 캐시 폴백(장중/주말 라이브 스크랩 회피)
  //    크론이 16:00 KST 장마감 후에만 워밍 → 아침·장중·주말엔 오늘 키가 비므로 최근 영업일 캐시 재사용(누적 수급 유효)
  let mf: MarketFlowKrResult | null = null
  for (let d = 0; d < 5 && !mf; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    mf = await getCache<MarketFlowKrResult>(MARKET_FLOW_KR_KEY(dt), 6 * 24 * 3600_000)
  }
  // 5일 내 캐시도 없으면(콜드/크론 미실행) 1회 라이브 컴퓨트 후 오늘 키에 적재 → 이후 요청 재사용
  if (!mf) { try { mf = await computeMarketFlowKr(base); if (mf) await setCache(MARKET_FLOW_KR_KEY(kstDate()), mf) } catch { mf = null } }
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
  // ⚠️ 키는 marks-cycle 라우트의 writer 와 반드시 같아야 한다. v3 를 읽고 있어 2026-07-14(v3→v4) 이후
  //    캐시가 영원히 미스 → 이 틸트가 조용히 죽어 있었다(Gemini 정합성 감사가 발견).
  const marksCache = await getCache<{ temp: number }>(`marks-cycle-v4:${kstDate()}`, 12 * 3600_000)
  const marketTemp = marksCache?.temp ?? null   // 0~100 탐욕온도(높음=과열/버블·낮음=공포/하락)
  const fcfDefensive = marketTemp != null && (marketTemp >= 65 || marketTemp <= 32)   // "버블·하락장엔 현금이 왕" 국면
  const mSig = (d: ScreenedStock['fwdEpsDir']) => d === 'accel' ? 1 : d === 'flat' ? 0.5 : 0

  // ⚠️ 모멘텀 크래시 국면(Daniel-Moskowitz 2016) — 승패 해부실 실측 플래그(12-1 모멘텀 역전 = 낙폭과대 반등 장) 재사용.
  //    점수·선정 절대 불변 — 헤더 캐비엇 전용("달리는 말 추격이 무너지는 국면"). 캐시 읽기만·콜드면 off.
  let momCrash = false
  for (let d = 0; d < 2 && !momCrash; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    const wl = await getCache<{ momCrash?: boolean }>(`win-lose-v8:${dt}`, 2 * 24 * 3600_000)
    if (wl) { momCrash = !!wl.momCrash; break }
  }

  // ★ 🧭 섹터 로테이션 틸트 — 로테이션 시계(RRG 17섹터)의 국면을 제한된 가점·감점으로 반영(qualityTilt와 동일 패턴).
  //   5번째 가중축이 아닌 이유: 섹터 국면은 rs/mom 부호로 며칠 만에 뒤집혀 축으로 넣으면 추천 리스트 휩쏘 + 4축 희석.
  //   틸트는 ±4 바운드 — "WHAT은 펀더멘탈" 우선순위 유지, 동점권에서만 주도/이탈 섹터를 가름. 캐시 읽기만(콜드면 틸트 0 graceful).
  let rotQuadBySector: Map<string, { q: RotQuad; score: number }> | null = null
  for (let d = 0; d < 3 && !rotQuadBySector; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    const rot = await getCache<RotationResult>(SECTOR_ROTATION_KEY(dt), 3 * 24 * 3600_000)
    if (rot?.items?.length) rotQuadBySector = new Map(rot.items.map(i => [i.key, { q: i.quadrant, score: i.score }]))
  }
  // SECTOR_TO_ROT — rotationShared(SSOT)에서 import
  const ROT_LABEL: Record<RotQuad, string> = { leading: '🌱 주도 섹터(자금 유입)', improving: '❄️ 태동 섹터(회전 초입)', weakening: '🔥 과열 섹터(모멘텀 둔화)', lagging: '🍂 이탈 섹터(자금 유출)' }
  const rotationOf = (sector: string | null): { q: RotQuad; rotScore: number } | null => {
    if (!rotQuadBySector || !sector) return null
    const key = SECTOR_TO_ROT[sector]; if (!key) return null
    const r = rotQuadBySector.get(key); if (!r) return null
    // 🧭 주도섹터 축(0~100) — RRG 쏠림점수(0.6 상대강도 + 0.4 모멘텀, %p)를 정규화. 주도(높은 +)→100·이탈(−)→0·중립 50
    return { q: r.q, rotScore: rotAxisScore(r.score) }
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
  type Pre = { s: ScreenedStock; quad: Quadrant; seasonScore: number; valueScore: number; qualityScore: number; momentumScore: number; knife: boolean; isKr: boolean; favored: boolean; waveOverride: boolean }
  const pre: Pre[] = screened
    .filter(s => !held.has(s.market === 'KR' ? code6(s.ticker) : s.ticker.toUpperCase()))
    .map(s => {
      const isKr = s.market === 'KR'
      const isEu = EU_TICKER_SET.has(s.ticker)   // 🇪🇺 유럽 기업(ADR 포함) — 유럽 독자 계절 quadrant 배정
      const isJp = JP_TICKER_SET.has(s.ticker)   // 🇯🇵 일본 · 🇨🇳 중국도 각 독자 계절
      const isCn = CN_TICKER_SET.has(s.ticker)
      const quad = isKr ? krQuad : isEu ? euQuad : isJp ? jpQuad : isCn ? cnQuad : usQuad
      const h: Holding = { ticker: s.ticker, weight: 0, lynchCategory: s.lynchCategory as Holding['lynchCategory'], sector: s.sector ?? undefined }
      const { score: seasonScore, overridden: waveOverride } = adjustedSeason(holdingFit(h, quad), s, isKr ? krDiverge : usDiverge)
      const favored = s.sector != null && SEASON_META[quad].favored.includes(s.sector)
      return { s, quad, seasonScore, valueScore: fundOf(s.valueScore ?? s.score), qualityScore: fundOf(s.qualityScore ?? 0.5), momentumScore: s.momentumScore ?? 50, knife: s.knife ?? false, isKr, favored, waveOverride }
    })

  // US 수급 fetch 대상 — 가치+퀄리티+계절+모멘텀 상위 25만(성능 바운드·수급 제외)
  const preRank = (p: Pre) => p.valueScore * 0.25 + p.qualityScore * 0.20 + p.seasonScore * 0.20 + p.momentumScore * 0.20
  const usPre = pre.filter(p => !p.isKr).sort((a, b) => preRank(b) - preRank(a)).slice(0, 25)
  const usFlowMap = new Map<string, Awaited<ReturnType<typeof getMoneyFlow>>>()
  for (let i = 0; i < usPre.length; i += 5) {
    const batch = usPre.slice(i, i + 5)
    const r = await Promise.all(batch.map(p => getMoneyFlow(p.s.ticker, 'US', p.s.name, base).catch(() => null)))
    batch.forEach((p, idx) => { if (r[idx]) usFlowMap.set(p.s.ticker, r[idx]!) })
  }

  // KR 수급 폴백 fetch — marketFlowKr POOL(큐레이션 시장 랭킹 ~113종) 밖 상위 종목을 getMoneyFlow(수급 레이더와 동일 SSOT)로 보강.
  //   유니버스(~183종)엔 있으나 POOL엔 없는 종목(삼성E&A 등)이 '수급 미집계'로 빠지던 문제 해소. 상위 preRank 15만(성능 바운드)
  const krPre = pre.filter(p => p.isKr && !krFlow.has(code6(p.s.ticker))).sort((a, b) => preRank(b) - preRank(a)).slice(0, 15)
  const krFlowExtra = new Map<string, Awaited<ReturnType<typeof getMoneyFlow>>>()
  for (let i = 0; i < krPre.length; i += 5) {
    const batch = krPre.slice(i, i + 5)
    const r = await Promise.all(batch.map(p => getMoneyFlow(p.s.ticker, 'KR', p.s.name, base).catch(() => null)))
    batch.forEach((p, idx) => { if (r[idx] && r[idx]!.status !== 'UNSUPPORTED') krFlowExtra.set(code6(p.s.ticker), r[idx]!) })
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
      } else {
        const mf = krFlowExtra.get(code6(p.s.ticker))   // POOL 밖 종목 — getMoneyFlow 실수급 폴백
        if (mf) {
          supplyScore = krSupplyFromFlow(mf); supplyKnown = true
          if ((mf.foreign?.net5 ?? 0) > 0 && (mf.organ?.net5 ?? 0) > 0) badges.push('🔥 외인·기관 쌍끌이')
          if ((mf.individual?.net5 ?? 0) < 0) badges.push('👤 개인 이탈')
        }
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
    // 🧭 주도섹터 축(10%) — 실제 돈이 도는 섹터. 주도/태동은 높은 점수, 이탈은 낮은 점수. 미집계(테마·섹터 없음)=중립 50
    const rot = rotationOf(p.s.sector)
    if (rot) badges.push(`🧭 ${ROT_LABEL[rot.q]}`)
    const rotationScore = rot?.rotScore ?? 50
    const combined = clamp(p.seasonScore * W.season + p.valueScore * W.value + p.qualityScore * W.quality + supplyScore * W.supply + p.momentumScore * W.momentum + rotationScore * W.rotation)
    return { p, supplyScore, supplyKnown, supplyProxy, badges, combined, rotQuad: rot?.q ?? null, rotationScore }
  })

  // ⑤ 원칙적 선별 — ① 품질 바닥 통합 65↑ ② 🔪칼날·📉급락 제외 ③ 섹터당 최대 4(분산) ④ 최대 15종. ⚠️ 지역 할당 없음 — 순수 6축 실력 랭킹
  const QUALITY_FLOOR = 65, SECTOR_CAP = 4, MAX_ITEMS = 15
  const ranked = scored.sort((a, b) => b.combined - a.combined)

  // 📉 급락 종목 **선별에서 제외**(2026-07-29) — 예전엔 배지로만 경고했으나 배지 하나로 '통합 81점 2위'를
  //    상쇄할 수 없다. 학생이 보는 건 점수와 순위다. "한 번 물리면 몇십 %"를 막는 게 우선.
  //    ⚠️ 이건 예측이 아니라 **위험 회피**다(백테스트로 정당화할 성격이 아님). 다만 근거는 있다 —
  //    실측: 지수 대비 −10%p 이하 약세 구간은 이상치 제거 후에도 전방 20봉 −2.12%p 로 명확히 나빴다.
  //    ⭐ 복귀는 **자동·결정론**: 낙폭이 −12% 위로 회복되면 sharpDrop 이 스스로 false 가 된다(별도 상태 없음).
  //    후보 상위 N종만 캔들을 보므로 비용은 작다(일별 캐시 + tech-screener 크론이 매일 워밍).
  //    ⚠️ **선별 루프는 반드시 preTop 안에서만** 돈다 — 전체 ranked 를 돌면 검사 안 된 31위 이하가
  //    급락인 채로 뽑힌다(Codex 리뷰 지적). 급락률이 31%(KR 62%)라 루프가 30위 밖으로 내려가는 건
  //    흔한 일이라 이론이 아니라 실제로 뚫린다. 후보 깊이를 3배(45)로 늘려 섹터 캡까지 감당하고,
  //    그래도 15종을 못 채우면 **적게 보여주는 게 맞다**(급락장엔 살 게 없는 것도 정직한 답).
  const preTop = ranked.filter(t => t.combined >= QUALITY_FLOOR && !t.p.knife).slice(0, MAX_ITEMS * 3)
  const preTiming = new Map<string, EntryTiming>()   // 아래 배지 부착에서 재사용(같은 종목 두 번 안 부른다)
  const dropSet = new Set<string>()
  try {
    const tm = await getEntryTimings(preTop.map(t => ({ ticker: t.p.s.ticker, market: (t.p.s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US' })), 4)
    for (const t of preTop) {
      const tt = tm.get(`${t.p.s.ticker}:${t.p.s.market === 'KR' ? 'KR' : 'US'}`)
      if (tt) { preTiming.set(t.p.s.ticker, tt); if (tt.supply?.sharpDrop) dropSet.add(t.p.s.ticker) }
    }
  } catch { /* graceful — 타점 실패 시 급락 제외를 건너뛴다(있던 추천이 사라지는 것보다 낫다) */ }

  // 🌪️ 국가 지수 변동성(6h 캐시) — 상대강도 약세 제외에 필요해 **선별 앞으로** 당겨 계산한다(배지에도 재사용).
  let volByOrigin: Record<string, CountryVolItem> | undefined
  try { volByOrigin = (await computeCountryVol())?.byOrigin } catch { /* graceful — 약세 제외·배지 생략 */ }

  // 💪📉 **상대강도 약세 제외**(2026-07-29) — 자국 지수 대비 20일 초과수익이 −10%p 이하면 선별에서 뺀다.
  //    ⚠️ 이건 '강한 걸 사라'가 아니다 — 그쪽은 백테스트에서 이상치 제거 시 edge 가 소멸했다(−0.14%p).
  //    ⭐ 살아남은 건 **'약한 건 피하라'** 한쪽뿐이다: 지수 대비 ≤−10%p 구간은 이상치 제거 후에도
  //       전방 20봉 **−2.12%p** 로 명확히 나빴다(58종목·28,910봉·워크포워드·룩어헤드 없음).
  //    급락 필터가 못 잡는 유형을 잡는다 — 퀄컴은 −16.9% 를 10봉 넘게 **천천히** 빠져 sharpDrop=false 인데
  //    지수 대비로는 −13.5%p 로 명확한 약세였다. 빠른 급락(sharpDrop)과 느린 약세는 다른 축이다.
  //    ⛔ 점수에는 여전히 미반영 — 제외 게이트로만 쓴다(축으로 넣으면 하락장에서 정반대로 작동한다).
  const RS_FLOOR = -10
  const originOf = (s: ScreenedStock): 'EU' | 'KR' | 'US' | 'JP' | 'CN' =>
    EU_TICKER_SET.has(s.ticker) ? 'EU' : JP_TICKER_SET.has(s.ticker) ? 'JP' : CN_TICKER_SET.has(s.ticker) ? 'CN' : s.market === 'KR' ? 'KR' : 'US'
  const weakSet = new Set<string>()
  for (const t of preTop) {
    const mine = preTiming.get(t.p.s.ticker)?.supply?.ret20
    const idx = volForStock(t.p.s.ticker, originOf(t.p.s), volByOrigin)?.ret20
    if (mine != null && idx != null && (mine - idx) <= RS_FLOOR) weakSet.add(t.p.s.ticker)
  }

  const secCount = new Map<string, number>()
  const top: typeof ranked = []
  for (const t of preTop) {              // ⚠️ ranked 가 아니라 preTop — 뽑히는 종목은 전부 급락 검사를 거친다
    if (t.p.knife) continue              // 🔪 떨어지는 칼날(구조적 하락) — preTop 에서 이미 걸렀지만 방어적으로
    if (dropSet.has(t.p.s.ticker)) continue   // 📉 최근 급락(구조는 살아도 지금 진입은 칼받이)
    if (weakSet.has(t.p.s.ticker)) continue   // 💪📉 지수 대비 −10%p 이하 약세(백테스트상 명확히 나쁜 구간)
    const sec = t.p.s.sector ?? '—'
    const c = secCount.get(sec) ?? 0
    if (c >= SECTOR_CAP) continue   // 한 섹터 과밀 방지
    secCount.set(sec, c + 1); top.push(t)
    if (top.length >= MAX_ITEMS) break
  }
  const selectionRule = `통합 ${QUALITY_FLOOR}점 이상 · 🔪 급락 추세(falling knife) 제외 · 📉 최근 급락 종목 제외(반등 시 자동 복귀) · 💪 지수 대비 ${RS_FLOOR}%p 이하 약세 제외 · 섹터당 최대 ${SECTOR_CAP}종(분산) · 최대 ${MAX_ITEMS}종 · 순수 실력 랭킹(지역 할당 없음)${rotQuadBySector ? ' · 🧭 주도섹터 축 10%(자금 회전 국면)' : ''}`

  // 🌍 지역 커버리지(참고 · 순위 무관) — merit 12종 밖의 한국·유럽 대표 후보를 점수와 함께 노출. 억지 편입이 아니라 "앱이 이 지역도 채점·커버한다"를 보여주는 참고 리스트
  const meritSet = new Set(top.map(t => t.p.s.ticker))
  // 📉 참고 리스트도 급락을 거른다 — "순위 무관 참고"라 적혀 있어도 학생은 **점수와 배지**를 보고 추천으로 읽는다.
  //    ⚠️ 본목록은 preTop(45) 안에서만 검사하므로 참고 후보 상당수는 dropSet 에 없다 → 여기서 따로 검사한다.
  //    캔들은 일별 캐시(tech-screener 크론이 매일 워밍)라 비용은 계산뿐이다.
  const refPool = (pred: (t: typeof scored[number]) => boolean) =>
    scored.filter(t => pred(t) && !meritSet.has(t.p.s.ticker) && !t.p.knife && t.combined >= 50)
      .sort((a, b) => b.combined - a.combined).slice(0, 10)   // 급락 탈락분 여유를 두고 10 → 최종 5
  const refPreds: [(t: typeof scored[number]) => boolean, 'KR' | 'EU' | 'JP' | 'CN'][] = [
    [t => t.p.isKr, 'KR'],
    [t => EU_TICKER_SET.has(t.p.s.ticker), 'EU'],
    [t => JP_TICKER_SET.has(t.p.s.ticker), 'JP'],
    [t => CN_TICKER_SET.has(t.p.s.ticker), 'CN'],
  ]
  const refCands = refPreds.map(([pred]) => refPool(pred))
  try {
    const need = Array.from(new Map(
      refCands.flat().filter(t => !preTiming.has(t.p.s.ticker))
        .map(t => [t.p.s.ticker, { ticker: t.p.s.ticker, market: (t.p.s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US' }])
    ).values())
    if (need.length) {
      const tm = await getEntryTimings(need, 4)
      for (const n of need) {
        const tt = tm.get(`${n.ticker}:${n.market}`)
        if (!tt) continue
        preTiming.set(n.ticker, tt)
        if (tt.supply?.sharpDrop) dropSet.add(n.ticker)
      }
      // 💪📉 참고 리스트도 상대강도 약세 제외(본목록과 동일 게이트 — 같은 기준이어야 한다)
      for (const c of refCands.flat()) {
        const mine = preTiming.get(c.p.s.ticker)?.supply?.ret20
        const idx = volForStock(c.p.s.ticker, originOf(c.p.s), volByOrigin)?.ret20
        if (mine != null && idx != null && (mine - idx) <= RS_FLOOR) weakSet.add(c.p.s.ticker)
      }
    }
  } catch { /* graceful — 실패 시 참고 리스트는 급락 필터 없이 나간다(리스트가 비는 것보다 낫다) */ }

  const buildRef = (cands: typeof scored, region: 'KR' | 'EU' | 'JP' | 'CN'): RegionRefItem[] =>
    cands.filter(t => !dropSet.has(t.p.s.ticker) && !weakSet.has(t.p.s.ticker)).slice(0, 5)
      .map(t => ({
        ticker: t.p.s.ticker, name: t.p.s.name, market: t.p.s.market, currency: t.p.s.currency ?? 'USD', sector: t.p.s.sector ?? '—', region,
        combined: t.combined, seasonScore: t.p.seasonScore, valueScore: t.p.valueScore, qualityScore: t.p.qualityScore,
        momentumScore: t.p.momentumScore, supplyScore: t.supplyScore, rotationScore: t.rotationScore,
        supplyKnown: t.supplyKnown, supplyProxy: t.supplyProxy, peg: t.p.s.peg, badges: t.badges,
      }))
  const reference: RegionRefItem[] = refCands.flatMap((c, i) => buildRef(c, refPreds[i][1]))

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
      let valueScore = t.p.valueScore
      let combined = t.combined
      // ⚠️ 기저효과 가드(SSOT 공통 판정) — 착시 저PEG(이익 붕괴 후 회복 G>100%)는 💎 뱃지 박탈 + 경고 배지
      //   + 가치 점수 과신 방지: 신뢰 불가한 저PEG가 가치축을 인플레하므로 가치를 중립 상한(60)으로 캡 후 통합 재계산(퀄리티는 별개 축이라 불변)
      if (isPegBaseEffect(peg, cf?.growth ?? null)) {
        badges = badges.filter(b => b !== '💎 저PEG')
        badges.push('⚠️ 저PEG 기저효과 의심')
        if (valueScore > 60) {
          valueScore = 60
          combined = clamp(t.p.seasonScore * W.season + valueScore * W.value + t.p.qualityScore * W.quality + t.supplyScore * W.supply + t.p.momentumScore * W.momentum + t.rotationScore * W.rotation)
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
        ticker: t.p.s.ticker, name: t.p.s.name, market: t.p.s.market, currency: t.p.s.currency ?? 'USD',
        origin: (EU_TICKER_SET.has(t.p.s.ticker) ? 'EU' : JP_TICKER_SET.has(t.p.s.ticker) ? 'JP' : CN_TICKER_SET.has(t.p.s.ticker) ? 'CN' : t.p.s.market === 'KR' ? 'KR' : 'US') as 'EU' | 'KR' | 'US' | 'JP' | 'CN',
        sector: t.p.s.sector ?? '—', industry: t.p.s.industry ?? null, lynchCategory: t.p.s.lynchCategory as string,
        seasonScore: t.p.seasonScore, valueScore, qualityScore: t.p.qualityScore, supplyScore: t.supplyScore, momentumScore: t.p.momentumScore, combined,
        fwdEpsDir: t.p.s.fwdEpsDir, priceTrend: t.p.s.priceTrend, fwdGrowthPct: t.p.s.fwdGrowthPct ?? null, priceVs200: t.p.s.priceVs200 ?? null,
        peg, opMargin: t.p.s.opMargin, fcfYield: t.p.s.fcfYield ?? null, qualityGap: t.p.s.qualityGap ?? false, psr: cf?.psr ?? null, roe, roic, roeInflated, epsRevision, suggestWeight, suggestWon,
        seasonFavored: t.p.favored, supplyProxy: t.supplyProxy, supplyKnown: t.supplyKnown, badges,
        timing: null,   // 🚦 최종 선정 후 일괄 부착
        rotationQuad: t.rotQuad, rotationScore: t.rotationScore,
        etfAlt: null,   // 🔬 최종 선정 후 일괄 부착
        rsVsMarket: null,   // 💪 상대강도 — 지수 ret20 부착 후 계산(점수 미반영)
      }
    }))
    items.push(...part)
  }
  // ⚠️ **품질 바닥 재적용**(2026-07-29 화면 검수) — ⑤ 선별은 ④의 원시 통합점수로 하는데,
  //    ⑥ 심화 검증에서 통합점수가 **내려간다**(기저효과 가치 캡 60 · roeInflated −6 · FCF 국면 틸트).
  //    그 결과 "통합 65점 이상"이라 적어놓고 화면엔 61점(엔씨소프트)·64점(Marathon)이 떴다.
  //    ⭐ 더 중요한 건 문구 불일치가 아니라 **선별이 착시 점수로 이뤄졌다는 것**이다 — 앱이 스스로
  //    "이 저PEG는 기저효과 착시"·"이 ROE는 부채로 부풀림"이라 판정해놓고, 정작 컷은 그 부풀린 값으로 넘겼다.
  //    ⛔ 못 채운 자리는 비운다(뒤 후보는 심화 검증을 안 거쳐 끌어올릴 수 없고, 억지로 채우는 게 더 함정이다).
  //    ⚠️ ④에도 스크리너 기반 기저효과 가드가 있지만 그건 Yahoo earningsGrowth 기준이고,
  //       ⑥은 canonical(PEG SSOT) 기준이라 판정이 갈린다 — 최종 판단은 SSOT 쪽이 맞다.
  const beforeFloor = items.length
  const dropped = items.filter(i => i.combined < QUALITY_FLOOR).map(i => `${i.name}(${i.combined})`)
  const finalItems = items.filter(i => i.combined >= QUALITY_FLOOR)
  items.length = 0; items.push(...finalItems)
  if (dropped.length) console.log(`[unified-reco] 심화 검증 후 품질 바닥 미달 제외 ${dropped.length}/${beforeFloor}: ${dropped.join(', ')}`)
  items.sort((a, b) => b.combined - a.combined)

  // 🌪️ volByOrigin 은 ⑤ 선별 앞에서 이미 계산했다(상대강도 약세 제외에 필요) — 여기서 재사용만 한다

  // 🚦 타점 신호등 부착 — ⑤ 선별에서 이미 계산한 preTiming 재사용(같은 종목을 두 번 부르지 않는다).
  //    빠진 것만 보충 fetch(선별 후보 30종 밖에서 올라온 경우).
  try {
    for (const it of items) it.timing = preTiming.get(it.ticker) ?? null
    const miss = items.filter(i => !i.timing)
    if (miss.length) {
      const tmap = await getEntryTimings(miss.map(i => ({ ticker: i.ticker, market: (i.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US' })), 4)
      for (const it of miss) it.timing = tmap.get(`${it.ticker}:${it.market === 'KR' ? 'KR' : 'US'}`) ?? null
    }
  } catch { /* graceful — 배지만 생략 */ }

  // 🔬 ETF 분산 대안 부착(최종 선정 후 — 점수·선정·정렬 절대 불변, 같은 GICS 섹터 ETF 분산 선택지만)
  try {
    const etfMap = await buildEtfAltMap(items.map(i => ({ ticker: i.ticker, sector: i.sector, market: i.market, name: i.name, industry: i.industry })), base)
    for (const it of items) it.etfAlt = etfMap.get(it.ticker) ?? null
  } catch { /* graceful — ETF 대안만 생략 */ }

  // 💪 상대강도(자국 지수 대비 20일 초과수익) — **새 fetch 0**: 종목은 timing.supply.ret20,
  //    지수는 이미 받은 volByOrigin[origin].ret20 을 그대로 뺀다.
  //    ⛔ 점수·선정 절대 미반영 — 백테스트에서 예측력이 없었다(타입 주석 참조). 표시 전용.
  for (const it of items) {
    const mine = it.timing?.supply?.ret20
    // ⚠️ byOrigin[origin] 직접 인덱싱 금지 — 본토 A주(.SS/.SZ)는 origin 이 'CN' 이지만 기준 지수는
    //    항셍이 아니라 **상해종합(CN_A)** 이다. 티커까지 보는 volForStock 을 쓴다(다른 배지와 동일 SSOT).
    //    실측 차이: 항셍 ret20 +12.8% vs 상해종합 −6.9% → 안 쓰면 20%p 가까이 틀린 값이 표시된다.
    const idx = volForStock(it.ticker, it.origin, volByOrigin)?.ret20
    it.rsVsMarket = (mine != null && idx != null) ? Math.round((mine - idx) * 10) / 10 : null
  }

  const result: UnifiedRecoResult = {
    weights: W,
    usSeason: { quadrant: usQuad, label: SEASON_META[usQuad].label, favored: SEASON_META[usQuad].favored },
    krSeason: { quadrant: krQuad, label: SEASON_META[krQuad].label, favored: SEASON_META[krQuad].favored },
    euSeason: { quadrant: euQuad, label: SEASON_META[euQuad].label, favored: SEASON_META[euQuad].favored },
    jpSeason: { quadrant: jpQuad, label: SEASON_META[jpQuad].label, favored: SEASON_META[jpQuad].favored },
    cnSeason: { quadrant: cnQuad, label: SEASON_META[cnQuad].label, favored: SEASON_META[cnQuad].favored },
    items, reference, volByOrigin, selectionRule, portfolioKrw, regimeMult, momCrash, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
