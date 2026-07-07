// 🤖 AI 포트폴리오 리밸런싱 — 수익률 연동형 교체매매 + 분산 최적화(Phase 2)
// 매도 진단(jarvisBriefing 재사용) × 실제 손익률 → 익절/손절/보류 4분면 + 신규 매수후보(macro-ai-picks)
// Phase 2: 린치 황금비율 갭 가중 배분 + 분류/섹터 Before→After
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { buildSignalMetrics, evaluateSignal } from '@/lib/jarvisBriefing'
import { classifyLynchMece } from '@/lib/lynchAnalysis'
import { isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { getSector } from '@/lib/schoolIndex'
import { screenSatellite, type SatelliteScore } from '@/lib/satelliteScreener'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'   // ③통합매수와 동일 SSOT(제2원칙)
import { getEntryTimings, type EntryTiming } from '@/lib/entryTiming'   // 🚦 타점 신호등(WHEN 레이어 — 판정·점수 불변)
import { classifyAssetRole, type AssetRole } from '@/lib/portfolioRole'   // P2: 코어-새틀라이트 5분류 SSOT
import { getCurrentSeason } from '@/lib/currentSeason'
import { holdingFit } from '@/lib/seasonNavigator'   // 보강: 계절 적합도(불리 종목 트림)
import { getMoneyFlow } from '@/lib/moneyFlow'        // 보강: 수급 이탈(CROWDED) 트림

// 코어 목표 밴드(40~70%) — 위험 계절·매파일수록 코어(지수+채권) ↑
function coreTargetBand(usQuad: string, rateDir: string): { min: number; max: number; text: string } {
  const base: Record<string, number> = { recession: 68, stagflation: 64, shoulder: 58, inflation: 50, goldilocks: 45 }
  let center = base[usQuad] ?? 55
  if (rateDir === 'hike') center += 4   // 매파 긴축 = 방어적
  else if (rateDir === 'cut') center -= 4
  center = Math.max(42, Math.min(68, center))
  const seasonKo: Record<string, string> = { recession: '겨울(침체)', stagflation: '가을(스태그)', shoulder: '간절기', inflation: '여름(인플레)', goldilocks: '봄(골디락스)' }
  return { min: Math.max(40, center - 5), max: Math.min(70, center + 5), text: `${seasonKo[usQuad] ?? usQuad}·금리 ${rateDir === 'hike' ? '인상' : rateDir === 'cut' ? '인하' : '동결'} 국면` }
}

// 피터 린치 황금비율(권장 분류 비중 %) — PortfolioBalanceRadar와 동일 SSOT
const IDEAL_RATIOS: Record<string, number> = {
  stalwart: 35, fast_grower: 30, cyclical: 20, turnaround: 10, asset_play: 5, slow_grower: 0,
}
const CAT_KR: Record<string, string> = {
  stalwart: '대형우량주', fast_grower: '빠른성장주', cyclical: '경기순환주',
  turnaround: '회생주', asset_play: '자산주', slow_grower: '저성장주',
}


// ── 타입 ──────────────────────────────────────────────────────────────────────
// 수익률 × 매도진단 4분면 액션
export type RebalanceAction =
  | 'TAKE_PROFIT'  // 익절: 수익 중 + 고평가 → 분할 익절
  | 'CUT_LOSS'     // 손절: 손실 중 + thesis 붕괴(적자 등) → 기회비용 손절
  | 'HOLD_DIP'     // 보류: 손실 중 + 단순 고평가뿐 → 저점매도 방지
  | 'DEFEND'       // 사수: 저평가/호재 → 보유
  | 'KEEP'         // 유지: 시그널 없음

export interface HoldingDiagnosis {
  ticker:        string
  name:          string
  market:        string
  lynchCategory: string | null
  weight:        number          // 포트폴리오 내 비중 %
  pnlPct:        number | null   // 평가손익률 % (평단가 대비)
  action:        RebalanceAction
  sellReasons:   string[]        // 매도/축소 사유
  peg:           number | null
  pegSuspect:    boolean         // ⚠️ 기저효과 저PEG 의심(isPegBaseEffect SSOT) — UI에서 PEG를 호재로 표기 금지
  opMargin:      number | null   // 영업이익률 % (음수=영업적자=실체 없음 → 하이프 판별)
  interestCoverage: number | null  // 이자보상배율 (<1.5=좀비 위험, 무차입은 null)
  priceTrend:    'up' | 'side' | 'down' | 'unknown'   // 📉 주가 추세(보유 매도 신호)
  inventoryBuildup: boolean        // 📦 재고 적체(경기순환 고점 선행)
  invGapPct:     number | null     // 재고증가율 − 매출증가율(%p)
  breakEvenRise: number | null   // 손실 종목: 본전까지 필요 상승률 % (확정 수학)
  releaseWeight: number          // 이 종목에서 회수할 총 비중 %(신호 회수 + 집중 트림)
  trimWeight:    number          // Phase 3: 과집중 분류 분산 목적 축소 비중 %(releaseWeight에 포함)
}

export interface BuyCandidate {
  ticker:        string
  name:          string
  market:        string
  lynchCategory: string
  peg:           number | null
  aiScore:       number
  reason:        string          // macroFit/fundamental 요약
  timing?:       EntryTiming | null   // 🚦 타점 신호등(unified-reco 상속)
  allocWeight:   number          // 제안 편입 비중 %
  sector:        string          // GICS 섹터(분산 진단용)
}

// Phase 2 — 분산 진단(분류 Before→After + 섹터 집중도)
export interface CategoryBalance {
  key:    string
  label:  string
  before: number   // 현재 비중 %
  after:  number   // 리밸런싱 후 비중 %
  ideal:  number   // 린치 황금비율 %
}
export interface SectorWeight { sector: string; weight: number }
export interface DiversificationView {
  categories:      CategoryBalance[]
  sectorsBefore:   SectorWeight[]
  sectorsAfter:    SectorWeight[]
  topSectorBefore: number   // 최대 단일 섹터 비중 % (집중도)
  topSectorAfter:  number
}

// 시클리컬 가치함정 경고 — 피터 린치 영구 원리(경기순환주는 이익 정점에서 PER 최저=함정)
export interface CyclicalTrap {
  weight:  number    // 경기순환주 총 비중 %
  tickers: { ticker: string; name: string; market: string; peg: number | null; invGap: number | null }[]  // 저PEG 또는 재고적체 경기순환주(함정 의심)
}
// 하이프 프리미엄 경고 — 버핏/린치 영구 원리(이익이라는 실체 없이 내러티브로 프리미엄 = 거품)
export interface HypePremium {
  weight:  number    // 영업적자(실체 없음) 종목 총 비중 %
  tickers: { ticker: string; name: string; market: string; opMargin: number | null; pnlPct: number | null }[]
}
// 좀비 기업 경고 — 영업이익으로 이자도 못 갚는 기업(이자보상배율<1.5). 흑자여도 빚 못 갚으면 위험
export interface ZombieRisk {
  weight:  number
  tickers: { ticker: string; name: string; market: string; interestCoverage: number | null }[]
}
// 🚀 위성(공격) 후보 — 중소형 10배거 잠재 종목(satelliteScreener의 SatelliteScore + 제안 편입 비중)
export interface SatelliteCandidate extends SatelliteScore {
  allocWeight: number          // 제안 편입 비중 %
}

export interface RebalanceResult {
  holdings:       HoldingDiagnosis[]
  buyCandidates:  BuyCandidate[]
  sellBudget:     number         // 회수 가능 총 비중 %
  diversification: DiversificationView | null
  cyclicalTrap:   CyclicalTrap | null
  hypePremium:    HypePremium | null
  zombieRisk:     ZombieRisk | null
  satelliteCandidates: SatelliteCandidate[]   // 🚀 위성(10배거 공격) 후보
  portfolioValue: number         // 원화 환산 총 평가액 (실행 가이드용 — % → ₩ 금액 환산)
  narrative:      string         // Gemini 종합 플랜 내러티브
  generatedAt:    string
  fromCache:      boolean
  // ── P2: 코어-새틀라이트 5분류 자산군 분석(전 자산 기준) ──
  coreSatellite?: CoreSatelliteView
  // 🌊 증거 기반 매크로 오버라이드 진단. active = 실제 발동(계절 페널티 복구된 후보 ≥1) / boosted = 그 종목들
  waveOverride?: { active: boolean; boosted: string[]; note: string } | null
}

// ═══ 코어-새틀라이트 자산군 분석 ═══════════════════════════════════════════════
export interface AssetGroupRow { role: string; label: string; group: string; pct: number; tickers: string[] }
export interface ActionItem {
  ticker: string; name: string; market: 'KR' | 'US'
  weightPct: number          // 전체 포트 대비 비중
  trimPct?: number           // 줄일 것: 권장 축소 %p
  reason: string             // 강력한 단일 이유
  tag: string                // 근거 엔진 태그(레버리지·알트·캡초과·역DCF·수급·좀비 등)
  sector?: string | null     // GICS 섹터(테마·섹터 배지용 — secByTicker 재사용, 추가 비용 0)
}
export interface BuyIdea { ticker: string; name: string; market: string; role: string; targetPct: number; reason: string; tag: string; sector?: string | null; timing?: EntryTiming | null }
export interface CoreSatelliteView {
  groups: AssetGroupRow[]              // 5분류+차단 현재 비중(전 자산)
  totalValue: number                   // 전 자산 원화 총액(원화 환산 정확도용 — 주식만 아닌 ETF·크립토 포함)
  corePct: number; coreTargetMin: number; coreTargetMax: number; coreTargetText: string
  btcPct: number; ghostPct: number; capPct: number   // 캡(10%) 대비
  drop: ActionItem[]                   // 🗑️ 버릴 것
  trim: ActionItem[]                   // ✂️ 줄일 것
  add: BuyIdea[]                       // 🛒 보강할 것
  guide: string                        // 조언형 실행 가이드
}

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })
}


/** 손실률 → 본전까지 필요 상승률 (확정 수학): r=-15% → +17.6% */
function breakEvenRiseOf(pnlPct: number | null): number | null {
  if (pnlPct == null || pnlPct >= 0) return null
  const r = pnlPct / 100
  return Math.round((-r / (1 + r)) * 1000) / 10
}

/**
 * Phase 3 — 목표 추종 집중 트림.
 * 종목별 매도 신호가 없어도 '포트폴리오 집중 위험'(한 분류가 황금비율 +15%p 초과)을 점진 축소.
 * 안전장치(사용자 요구 "일방적 매도 금지" 확장):
 *   · 점진적: 초과분의 절반만, 종목당 최대 비중의 절반
 *   · 깊은 손실(-15%↓)은 트림 제외 — 저점 매도 방지
 *   · 고PEG(매력 낮은)부터 트림, 최저PEG 핵심 1종목은 보호
 */
function applyConcentrationTrim(diagnoses: HoldingDiagnosis[], curCat: Record<string, number>) {
  const TRIM_THRESHOLD = 15   // 권장 대비 초과 허용폭(%p)
  for (const [cat, cur] of Object.entries(curCat)) {
    const ideal = IDEAL_RATIOS[cat] ?? 0
    const excess = cur - ideal
    if (excess <= TRIM_THRESHOLD) continue
    let trimTarget = Math.round(excess * 0.5 * 10) / 10   // 초과분의 절반만(점진)

    // 이 분류 보유 종목 — 트림 우선순위: 고PEG 먼저, 깊은손실 보호, 최저PEG 핵심 보호
    const inCat = diagnoses
      .filter(d => d.lynchCategory === cat && d.weight > 0.1)
      .sort((a, b) => (b.peg ?? 0) - (a.peg ?? 0))   // 고PEG(덜 매력적)부터
    const coreTicker = inCat.reduce<HoldingDiagnosis | null>((best, d) =>
      (d.peg != null && d.peg > 0 && (best == null || (d.peg < (best.peg ?? 99)))) ? d : best, null)?.ticker

    for (const d of inCat) {
      if (trimTarget <= 0.1) break
      if (d.pnlPct != null && d.pnlPct < -15) continue   // 깊은 손실 보호(저점매도 방지)
      if (d.ticker === coreTicker && inCat.length > 1) continue   // 최저PEG 핵심 1종목 보호
      const avail = Math.max(0, d.weight - d.releaseWeight)
      const cap = Math.round(d.weight * 0.5 * 10) / 10   // 종목당 최대 절반
      const t = Math.round(Math.min(avail, trimTarget, cap) * 10) / 10
      if (t >= 0.1) {
        d.trimWeight = t
        d.releaseWeight = Math.round((d.releaseWeight + t) * 10) / 10
        if (!d.sellReasons.length || d.action === 'DEFEND' || d.action === 'KEEP')
          d.sellReasons = [...d.sellReasons, `${CAT_KR[cat] ?? cat} 비중 과다(현재 ${Math.round(cur)}% · 권장 ${ideal}%) — 분산 위해 일부 축소`]
        trimTarget = Math.round((trimTarget - t) * 10) / 10
      }
    }
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cookie = req.headers.get('cookie') ?? ''   // unified-reco는 인증 필요 → 쿠키 전달
  const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1'
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  // v9: 위성(10배거) 레이어 추가 — 캐시 무효화 / fp: 보유 변경 시 키 자동 무효화
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `ai-rebalance-v33:${user.id}:${today}:${fp}`   // v33: 🚦 타점 신호등(매수 카드)+최후 방어선 붕괴 경고(매도측 근거 병기)

  if (!forceRefresh) {
    const cached = await getCache<RebalanceResult>(cacheKey, 24 * 3600_000)
    if (cached) return NextResponse.json({ ...cached, fromCache: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ① 보유 종목 (STOCK만)
  const db = admin()
  const { data: rows } = await db.from('investments')
    .select('ticker,name,market,quantity,purchase_price,currency,lynch_category')
    .eq('user_id', user.id)
  const holds = (rows ?? []).filter(h => getAssetType(h.ticker, h.name ?? '', h.market ?? 'US') === 'STOCK')
  if (holds.length === 0) {
    return NextResponse.json({ holdings: [], buyCandidates: [], sellBudget: 0, diversification: null, cyclicalTrap: null, hypePremium: null, zombieRisk: null, satelliteCandidates: [], portfolioValue: 0, narrative: '분석할 개별 주식이 없습니다. 종목을 추가하면 리밸런싱 진단이 시작됩니다.', generatedAt: new Date().toISOString(), fromCache: false })
  }

  // ② 현재가 배치 → 평가액·비중·손익률
  let prices: Record<string, number> = {}
  try {
    const pr = await fetch(`${base}/api/stock-price`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holds.map(h => ({ ticker: h.ticker, market: h.market ?? 'US' }))),
      signal: AbortSignal.timeout(30_000),
    })
    if (pr.ok) {
      const arr = await pr.json() as Array<{ ticker: string; currentPrice: number }>
      prices = Object.fromEntries(arr.map(d => [d.ticker.toUpperCase(), d.currentPrice]))
    }
  } catch { /* graceful — 비중 계산 불가 종목은 0 */ }

  // ⭐ 통화 통일(원화 환산) — KR(₩)·US($) 혼합 포트폴리오의 비중 왜곡 방지
  //    (버그: 환산 없이 합산하면 ₩가격(수십만)이 $가격(수백)을 압도해 국내종목이 비중 독식)
  let usdKrw = 1380   // 폴백
  try {
    const fx = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8000) })
    if (fx.ok) { const j = await fx.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate }
  } catch { /* 폴백 사용 */ }
  const toKrw = (market: string | null) => (market === 'KR' ? 1 : usdKrw)   // 종목 통화 → 원화 배율

  const valued = holds.map(h => {
    const price = prices[h.ticker.toUpperCase()] ?? 0
    const qty = Number(h.quantity) || 0
    const buy = Number(h.purchase_price) || 0
    const mv = price * qty * toKrw(h.market ?? 'US')   // 원화 환산 평가액
    const pnlPct = buy > 0 && price > 0 ? Math.round(((price - buy) / buy) * 1000) / 10 : null
    return { ...h, price, mv, pnlPct }
  })
  const totalMv = valued.reduce((s, v) => s + v.mv, 0) || 1

  // ③ 매도 진단 (jarvisBriefing 재사용) — 동시성 6
  const heldSet = new Set(holds.map(h => h.ticker.toUpperCase()))
  const diagnoses: HoldingDiagnosis[] = []
  for (let i = 0; i < valued.length; i += 6) {
    const batch = valued.slice(i, i + 6)
    const rs = await Promise.all(batch.map(async v => {
      const weight = Math.round((v.mv / totalMv) * 1000) / 10
      let action: RebalanceAction = 'KEEP'
      let sellReasons: string[] = []
      let peg: number | null = null
      let pegSuspect = false
      let opMargin: number | null = null
      let interestCoverage: number | null = null
      let priceTrend: HoldingDiagnosis['priceTrend'] = 'unknown'
      let inventoryBuildup = false
      let invGapPct: number | null = null
      // MECE 분류 SSOT — lynch-matrix(진단 탭)와 동일 분류기(제2원칙). DB 지정 > 펀더멘탈 자동
      let lynchCategory: string | null = v.lynch_category ?? null
      try {
        const m = await buildSignalMetrics(v.ticker, v.market ?? 'US', v.name ?? '', base)
        if (m) {
          peg = m.peg
          pegSuspect = isPegBaseEffect(m.peg, m.earningsGrowth)
          opMargin = m.opMargin
          interestCoverage = m.interestCoverage
          priceTrend = m.priceTrend
          inventoryBuildup = m.inventoryBuildup
          invGapPct = m.invGapPct
          const mece = classifyLynchMece(v.lynch_category ?? null, m.earningsGrowth, m.sector).cat
          lynchCategory = mece === 'na' ? null : mece   // 'na'는 기존처럼 미분류(null) — 황금비율 트림 대상 제외
          const decision = evaluateSignal(m, lynchCategory, false)
          const thesisBroken = m.opMargin2qDown || m.fcfNegative || (m.opMargin != null && m.opMargin < -10)
          if (decision.type === 'SELL') {
            sellReasons = decision.reasons
            if (v.pnlPct != null && v.pnlPct > 0)        action = 'TAKE_PROFIT'   // 수익 중 → 익절
            else if (thesisBroken)                        action = 'CUT_LOSS'      // 손실 + thesis붕괴 → 손절
            else                                          action = 'HOLD_DIP'      // 손실 + 단순고평가 → 저점매도 방지
          } else if (decision.type === 'BUY') {
            action = 'DEFEND'
          }
        }
      } catch { /* graceful — KEEP */ }
      const releaseWeight = action === 'CUT_LOSS' ? weight
        : action === 'TAKE_PROFIT' ? Math.round(weight * 0.5 * 10) / 10   // 분할 익절(절반)
        : 0
      return {
        ticker: v.ticker, name: v.name ?? v.ticker, market: v.market ?? 'US',
        lynchCategory, weight, pnlPct: v.pnlPct,
        action, sellReasons, peg, pegSuspect, opMargin, interestCoverage, priceTrend, inventoryBuildup, invGapPct, breakEvenRise: breakEvenRiseOf(v.pnlPct), releaseWeight, trimWeight: 0,
      } as HoldingDiagnosis
    }))
    diagnoses.push(...rs)
  }

  // 현재 분류/섹터 비중
  const curCat: Record<string, number> = {}
  for (const d of diagnoses) if (d.lynchCategory) curCat[d.lynchCategory] = (curCat[d.lynchCategory] ?? 0) + d.weight

  // 🔁 시클리컬 가치함정 — 경기순환주 비중 高 + 저PEG(저평가처럼 보임)면 '이익 정점 함정' 경고
  //    (피터 린치 영구 원리: 경기순환주는 이익이 정점일 때 PER이 가장 낮아 보임 → 저PEG≠저평가)
  const cyclicalWeight = Math.round((curCat['cyclical'] ?? 0) * 10) / 10
  //  📦 재고 적체(선행) OR 저PEG(후행 착시) 경기순환주 = 사이클 고점 함정 의심
  const trapCyclicals = diagnoses
    .filter(d => d.lynchCategory === 'cyclical' && d.weight > 0.5 &&
      ((d.peg != null && d.peg > 0 && d.peg < 0.8) || d.inventoryBuildup))
    .map(d => ({ ticker: d.ticker, name: d.name, market: d.market, peg: d.peg, invGap: d.inventoryBuildup ? d.invGapPct : null }))
  const cyclicalTrap: CyclicalTrap | null =
    cyclicalWeight >= 40 && trapCyclicals.length > 0
      ? { weight: cyclicalWeight, tickers: trapCyclicals }
      : null

  // 💭 하이프 프리미엄 — 영업적자(이익이라는 실체 없음) 종목을 내러티브 의존 거품 위험으로 경고
  //    (버핏/린치 영구 원리 + 자료의 '매도 로직': 실체 없이 스토리로 프리미엄 = OKLO·JOBY류)
  const hypeHoldings = diagnoses
    .filter(d => d.opMargin != null && d.opMargin < 0 && d.weight > 0.5)
    .map(d => ({ ticker: d.ticker, name: d.name, market: d.market, opMargin: d.opMargin, pnlPct: d.pnlPct }))
  const hypeWeight = Math.round(hypeHoldings.reduce((s, h) => s + (diagnoses.find(d => d.ticker === h.ticker)?.weight ?? 0), 0) * 10) / 10
  const hypePremium: HypePremium | null = hypeHoldings.length > 0 ? { weight: hypeWeight, tickers: hypeHoldings } : null

  // 🧟 좀비 기업 — 영업이익으로 이자도 못 갚음(이자보상배율<1.5). 흑자여도 빚 상환 불가 = 구조적 위험
  const zombieHoldings = diagnoses
    .filter(d => d.interestCoverage != null && d.interestCoverage < 1.5 && d.weight > 0.5)
    .map(d => ({ ticker: d.ticker, name: d.name, market: d.market, interestCoverage: d.interestCoverage }))
  const zombieWeight = Math.round(zombieHoldings.reduce((s, h) => s + (diagnoses.find(d => d.ticker === h.ticker)?.weight ?? 0), 0) * 10) / 10
  const zombieRisk: ZombieRisk | null = zombieHoldings.length > 0 ? { weight: zombieWeight, tickers: zombieHoldings } : null

  // ④ Phase 3 — 목표 추종 집중 트림: 종목 신호가 없어도 황금비율 초과 분류를 점진 축소
  applyConcentrationTrim(diagnoses, curCat)

  diagnoses.sort((a, b) => b.releaseWeight - a.releaseWeight || b.weight - a.weight)
  const sellBudget = Math.round(diagnoses.reduce((s, d) => s + d.releaseWeight, 0) * 10) / 10
  // 코어 80% / 위성 20% 분리 — 위성은 고위험이라 소액 한정(최대 절대 8%p)
  const satelliteBudget = Math.min(Math.round(sellBudget * 0.2 * 10) / 10, 8)
  const coreBudget = Math.round((sellBudget - satelliteBudget) * 10) / 10

  // ⑤ 분산 진단용 — 보유 종목 섹터 수집(getSector 7일 캐시 공유)
  const secByTicker: Record<string, string> = {}
  for (let i = 0; i < valued.length; i += 6) {
    const batch = valued.slice(i, i + 6)
    const secs = await Promise.all(batch.map(v => getSector(v.ticker, v.market ?? 'US').catch(() => '기타')))
    batch.forEach((v, k) => { secByTicker[v.ticker.toUpperCase()] = secs[k] })
  }
  const curSec: Record<string, number> = {}
  for (const d of diagnoses) {
    const sec = secByTicker[d.ticker.toUpperCase()] ?? '기타'
    curSec[sec] = (curSec[sec] ?? 0) + d.weight
  }

  // ⑤ 신규 매수 후보 — ③통합매수(unified-reco)와 동일 SSOT 사용(제2원칙: 진단·통합매수·리밸런싱 일관)
  //    기존엔 macro-ai-picks 별도 엔진 + 갭/섹터 재랭킹을 써 ①③과 종목이 달라지는 불일치가 있었음.
  //    → unified-reco가 이미 보유제외·섹터분산(SECTOR_CAP)·통합 3축 채점을 수행하므로 그 상위를 그대로 채택.
  let buyCandidates: BuyCandidate[] = []
  let waveBoostedNames: string[] = []   // 🌊 계절 페널티가 실제로 복구된 추천 종목(정직한 배너용)
  try {
    const ur = await fetch(`${base}/api/unified-reco`, { headers: { cookie }, signal: AbortSignal.timeout(40_000) })
    if (ur.ok) {
      const ud = await ur.json() as UnifiedRecoResult
      waveBoostedNames = (ud.items ?? []).filter(it => it.badges.includes('🌊 CapEx 수혜(매크로 역풍 돌파)')).map(it => it.name)
      // 통합점수 상위 4종(코어) — 순서·종목을 ③통합매수와 동일하게. (이미 미보유로 필터됨, 안전망으로 재확인)
      const ranked = (ud.items ?? []).filter(it => !heldSet.has(it.ticker.toUpperCase())).slice(0, 4)
      const csum = ranked.reduce((s, it) => s + it.combined, 0) || 1
      buyCandidates = ranked.map(it => ({
        ticker: it.ticker, name: it.name, market: it.market, lynchCategory: it.lynchCategory,
        peg: it.peg, aiScore: it.combined, sector: it.sector, timing: it.timing ?? null,
        reason: it.badges.slice(0, 3).join(' · ') || `통합 ${it.combined}점(계절·가치·수급·모멘텀)`,
        // 회수 예산(coreBudget)을 통합점수 비례로 배분 — 어떤 종목을 살지는 ③과 동일, 얼마나는 회수액 기준
        allocWeight: coreBudget > 0 ? Math.round((coreBudget * (it.combined / csum)) * 10) / 10 : 0,
      }))
      // ⭐ 반올림 잔돈을 1순위(최고 점수)에 합산 → 코어 매수 합 = 코어 예산 정확히 일치
      if (coreBudget > 0 && buyCandidates.length > 0) {
        const allocSum = buyCandidates.reduce((s, b) => s + b.allocWeight, 0)
        const remainder = Math.round((coreBudget - allocSum) * 10) / 10
        if (Math.abs(remainder) >= 0.1) buyCandidates[0].allocWeight = Math.round((buyCandidates[0].allocWeight + remainder) * 10) / 10
      }
    }
  } catch { /* graceful */ }

  // ⑤-b 🚀 위성 10배거 후보 — 중소형 유니버스 스크리닝 → 위성 예산 배분(점수 비례)
  let satelliteCandidates: SatelliteCandidate[] = []
  if (satelliteBudget >= 0.1) {
    try {
      const picks = await screenSatellite(base, heldSet, 2)
      const sSum = picks.reduce((s, p) => s + Math.max(1, p.tenScore), 0) || 1
      satelliteCandidates = picks.map((p, i) => ({
        ...p,
        allocWeight: i === picks.length - 1
          ? Math.round((satelliteBudget - picks.slice(0, -1).reduce((s, q) => s + Math.round((satelliteBudget * Math.max(1, q.tenScore) / sSum) * 10) / 10, 0)) * 10) / 10
          : Math.round((satelliteBudget * Math.max(1, p.tenScore) / sSum) * 10) / 10,
      }))
    } catch { /* graceful */ }
  }

  // ⑥ Before → After (매도 회수분 차감 + 매수 배분분 가산)
  const diversification = buildDiversification(diagnoses, secByTicker, curCat, curSec, buyCandidates)

  // ⑦ Gemini 내러티브 (심리 인지 + 정직 + 시클리컬 함정)
  // ⭐ 매크로 국면 SSOT(/api/macro-regime) 재사용 — 내러티브에 시장 맥락 한 줄 주입(추가 fetch 0, 캐시 공유)
  let regimeNote: string | null = null
  try {
    const rg = await fetch(`${base}/api/macro-regime`, { signal: AbortSignal.timeout(8_000) })
    if (rg.ok) {
      const j = await rg.json()
      const dirKo = j.rateDir === 'cut' ? '인하' : j.rateDir === 'hike' ? '인상' : '동결'
      regimeNote = `현재 매크로 국면: ${j.label}(시장은 당분간 금리 ${dirKo} 컨센서스). ${j.description ?? ''}`
    }
  } catch { /* graceful */ }

  // ⑦-b 증거 기반 매크로 오버라이드 진단 — 계절 신뢰도 낮음(diverge)+CapEx 급증(surge) 시 계절 가중을 낮추고 실적·CapEx 증거 종목 중심으로 추천을 조정했음을 정직하게 고지
  let waveOverride: RebalanceResult['waveOverride'] = null
  try {
    const ss = await getCache<{ us: { validation: { verdict: string } }; kr: { validation: { verdict: string } } }>('season-sector-v3', 6 * 3600_000)
    const cap = await getCache<{ verdict: string; latestYoY: number | null }>('juglar-capex-v1', 24 * 3600_000)
    const diverge = ss?.us?.validation?.verdict === 'diverge' || ss?.kr?.validation?.verdict === 'diverge'
    if (diverge && cap?.verdict === 'surge') {
      if (waveBoostedNames.length > 0) {
        // 실제 발동 — 계절 페널티가 복구된 종목이 추천에 있음
        const note = `계절 이론 신뢰도 낮음(섹터 성적표 괴리) + 빅테크 CapEx +${cap.latestYoY}% 급증. 계절상 불리하지만 'Fwd EPS 이익 가속 + CapEx 수혜' 증거가 확실한 ${waveBoostedNames.join('·')}의 계절 페널티를 복구해 추천에 반영했습니다. 증거 없는 무늬만 테마·역성장·급락주는 그대로 제외됩니다.`
        waveOverride = { active: true, boosted: waveBoostedNames, note }
      } else {
        // 게이트는 활성이나 발동 대상 없음 — 정직하게 대기 상태로 고지(반도체=경기순환이라 여름 이미 우대)
        const note = `계절 신뢰도 낮음(괴리) + CapEx +${cap.latestYoY}% 급증으로 오버라이드 게이트는 활성이지만, 현재 매수 후보 중 발동 대상은 없습니다 — AI 주력(반도체 등)은 이 앱에서 '경기순환주'로 분류돼 여름에 이미 계절 우대(적합도 0.75)를 받아 계절이 밀어내지 않기 때문입니다. (오버라이드는 순수 성장 기술주가 계절에 강하게 눌리는 다른 국면을 위한 안전장치로 대기 중)`
        waveOverride = { active: false, boosted: [], note }
      }
      regimeNote = `${regimeNote ?? ''} ${waveOverride.note}`.trim()
    }
  } catch { /* graceful */ }

  const narrative = await buildNarrative(diagnoses, buyCandidates, sellBudget, diversification, cyclicalTrap, hypePremium, zombieRisk, regimeNote)

  // ═══ P2: 코어-새틀라이트 5분류 자산군 분석(전 자산 기준) ═══════════════════════
  let coreSatellite: CoreSatelliteView | undefined
  try {
    coreSatellite = await buildCoreSatellite(rows ?? [], diagnoses, buyCandidates, satelliteCandidates, zombieHoldings, secByTicker, base, usdKrw)
  } catch (e) { console.warn('[coreSatellite]', (e as Error).message) }

  const result: RebalanceResult = {
    holdings: diagnoses, buyCandidates, sellBudget, diversification, cyclicalTrap, hypePremium, zombieRisk, satelliteCandidates, portfolioValue: Math.round(totalMv),
    narrative, generatedAt: new Date().toISOString(), fromCache: false, coreSatellite, waveOverride,
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

// ═══ P2: 코어-새틀라이트 자산군 + 캡 + 3액션 ═══════════════════════════════════
const CAP = 10   // BTC·유령 각 캡 10%
const ROLE_LABEL: Record<AssetRole, string> = {
  CORE_INDEX: '코어·인덱스', CORE_BOND: '코어·채권', SATELLITE_BTC: '새틀라이트·BTC',
  SATELLITE_GHOST: '새틀라이트·유령', SATELLITE_GENERAL: '새틀라이트·일반', BLOCKED: '정책 부적합',
}
const ROLE_GROUP: Record<AssetRole, string> = {
  CORE_INDEX: 'CORE', CORE_BOND: 'CORE', SATELLITE_BTC: 'SATELLITE', SATELLITE_GHOST: 'SATELLITE', SATELLITE_GENERAL: 'SATELLITE', BLOCKED: 'BLOCKED',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildCoreSatellite(rows: any[], diagnoses: HoldingDiagnosis[], buys: BuyCandidate[], sats: SatelliteCandidate[], zombies: { ticker: string; name: string; market: string }[], secByTicker: Record<string, string>, base: string, usdKrw: number): Promise<CoreSatelliteView> {
  // ① 전 자산 가치평가(원화) — ⚠️ stock-price POST는 최대 50개 → 40개씩 청크. 통화는 API의 currency 필드 사용
  //    (버그 수정: 크립토는 Upbit 원화 기준인데 market 기반으로 ×usdKrw하면 1380배 폭증 → currency==='KRW'면 ×1)
  const priceMap = new Map<string, { price: number; krw: boolean }>()
  for (let i = 0; i < rows.length; i += 40) {
    try {
      const chunk = rows.slice(i, i + 40)
      const pr = await fetch(`${base}/api/stock-price`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunk.map(h => ({ ticker: h.ticker, market: h.market ?? 'US' }))), signal: AbortSignal.timeout(30_000) })
      if (pr.ok) {
        const arr = await pr.json() as Array<{ ticker: string; currentPrice: number; currency: string }>
        for (const d of arr) priceMap.set(String(d.ticker).toUpperCase(), { price: Number(d.currentPrice) || 0, krw: d.currency === 'KRW' })
      }
    } catch { /* graceful — 해당 청크 0 */ }
  }
  const items = rows.map(h => {
    const role = classifyAssetRole(h.ticker, h.name ?? '', h.market ?? 'US').role
    const pm = priceMap.get(h.ticker.toUpperCase())
    const qty = Number(h.quantity) || 0
    let mv: number
    if (pm && pm.price > 0) {
      mv = pm.price * qty * (pm.krw ? 1 : usdKrw)   // ① 라이브 가격 × 수량 × currency 원화 환산
    } else {
      // ② 라이브 가격 실패(Yahoo 스로틀 등) → 원가(매입가×수량) 폴백 — 앱 공통 원칙. 통화는 investment.currency 우선, 없으면 market
      const isKrw = h.currency ? h.currency === 'KRW' : (h.market === 'KR')
      mv = (Number(h.purchase_price) || 0) * qty * (isKrw ? 1 : usdKrw)
    }
    return { ticker: h.ticker, name: h.name ?? h.ticker, market: (h.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US', role, mv }
  })
  const total = items.reduce((s, i) => s + i.mv, 0) || 1
  const pctOf = (mv: number) => Math.round((mv / total) * 1000) / 10

  // ② 5분류 집계
  const byRole = new Map<AssetRole, { pct: number; tickers: string[] }>()
  for (const it of items) {
    const g = byRole.get(it.role) ?? { pct: 0, tickers: [] }
    g.pct += pctOf(it.mv); g.tickers.push(it.ticker); byRole.set(it.role, g)
  }
  const roles: AssetRole[] = ['CORE_INDEX', 'CORE_BOND', 'SATELLITE_BTC', 'SATELLITE_GHOST', 'SATELLITE_GENERAL', 'BLOCKED']
  const groups: AssetGroupRow[] = roles.filter(r => byRole.has(r)).map(r => ({ role: r, label: ROLE_LABEL[r], group: ROLE_GROUP[r], pct: Math.round((byRole.get(r)!.pct) * 10) / 10, tickers: byRole.get(r)!.tickers }))
  const corePct = Math.round(((byRole.get('CORE_INDEX')?.pct ?? 0) + (byRole.get('CORE_BOND')?.pct ?? 0)) * 10) / 10
  const btcPct = Math.round((byRole.get('SATELLITE_BTC')?.pct ?? 0) * 10) / 10
  const ghostPct = Math.round((byRole.get('SATELLITE_GHOST')?.pct ?? 0) * 10) / 10

  // ③ 코어 동적 밴드(4계절·금리)
  let band = { min: 50, max: 60, text: '국면 분석 보류' }
  let season: Awaited<ReturnType<typeof getCurrentSeason>> | null = null
  try { season = await getCurrentSeason(base); band = coreTargetBand(season.usQuad, season.rateDir) } catch { /* 폴백 */ }

  const mvByTicker = new Map(items.map(i => [i.ticker.toUpperCase(), i]))

  // ③' 보강: 종목별 매도측 신호 수집(역-DCF·수급·계절) — 보유 진단 종목 한정·캐시 재사용
  const sig = new Map<string, { dcf?: string; flow?: string; seasonTag?: string; trend?: string }>()
  await Promise.all(diagnoses.map(async d => {
    const k = d.ticker.toUpperCase(); const mk = (d.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'; const o: { dcf?: string; flow?: string; seasonTag?: string; trend?: string } = {}
    try { const r = await fetch(`${base}/api/reverse-dcf?ticker=${encodeURIComponent(d.ticker)}&market=${mk}`, { signal: AbortSignal.timeout(10_000) }); if (r.ok) o.dcf = (await r.json())?.verdict } catch { /* graceful */ }
    try { const mf = await getMoneyFlow(d.ticker, mk, d.name, base); o.flow = mf?.status } catch { /* graceful */ }
    o.trend = d.priceTrend   // 보유 진단에서 캡처한 주가 추세(추가 fetch 0)
    if (season) {
      const quad = mk === 'KR' ? season.krQuad : season.usQuad
      const sec = secByTicker[k]
      const fit = holdingFit({ ticker: '', weight: 0, lynchCategory: (d.lynchCategory as never) ?? null, sector: sec }, quad)
      o.seasonTag = fit >= 0.75 ? 'favored' : fit <= 0.5 ? 'unfavored' : 'neutral'
    }
    sig.set(k, o)
  }))
  // 신호 → 한국어 사유 조각(매도측 위험만)
  const sellSignalText = (k: string): string[] => {
    const o = sig.get(k); if (!o) return []
    const out: string[] = []
    if (o.dcf === 'demanding') out.push('역-DCF 기대과도🔥(주가가 실제보다 높은 성장 선반영)')
    if (o.flow === 'CROWDED') out.push('수급 이탈·과열(외인·기관 매도 우위)')
    if (o.trend === 'down') out.push('주가 하락추세(50·200일선 이탈 — 추세 이탈)')
    if (o.seasonTag === 'unfavored') out.push('현재 계절 역풍(불리 섹터)')
    return out
  }
  // 🔧 모순 제거 — 매도 신호(역DCF/수급/계절)가 뜬 종목은 '사수(DEFEND)'에서 강등(KEEP).
  //    PLTR처럼 PEG는 낮아 보이나(기저효과) 역-DCF가 기대과도로 잡는 종목이 '사수'+'줄일것'에 동시 노출되던 모순 차단.
  for (const d of diagnoses) {
    const sigs = sellSignalText(d.ticker.toUpperCase())
    if (d.action === 'DEFEND' && sigs.length > 0) { d.action = 'KEEP'; d.sellReasons = [...d.sellReasons, ...sigs] }
  }

  // ④ 🗑️ 버릴 것 — 정책 차단 + 손절 + 좀비
  const drop: ActionItem[] = []
  const dropSeen = new Set<string>()
  for (const it of items) {
    if (it.role === 'BLOCKED') {
      const r = classifyAssetRole(it.ticker, it.name, it.market).reason
      drop.push({ ticker: it.ticker, name: it.name, market: it.market, weightPct: pctOf(it.mv), reason: r, tag: '정책 차단', sector: secByTicker[it.ticker.toUpperCase()] ?? null })
      dropSeen.add(it.ticker.toUpperCase())
    }
  }
  for (const d of diagnoses) {
    const k = d.ticker.toUpperCase()
    if (dropSeen.has(k)) continue
    if (d.action === 'CUT_LOSS') { drop.push({ ticker: d.ticker, name: d.name, market: (d.market === 'KR' ? 'KR' : 'US'), weightPct: pctOf(mvByTicker.get(k)?.mv ?? 0), reason: d.sellReasons.join('·') || '손실 중 + 펀더멘탈 붕괴', tag: '손절', sector: secByTicker[k] ?? null }); dropSeen.add(k) }
  }
  for (const z of zombies) {
    const k = z.ticker.toUpperCase(); if (dropSeen.has(k)) continue
    drop.push({ ticker: z.ticker, name: z.name, market: (z.market === 'KR' ? 'KR' : 'US'), weightPct: pctOf(mvByTicker.get(k)?.mv ?? 0), reason: '영업이익으로 이자도 못 갚는 좀비(이자보상배율<1.5) — 구조적 위험', tag: '좀비', sector: secByTicker[k] ?? null }); dropSeen.add(k)
  }

  // ⑤ ✂️ 줄일 것 — 캡 초과(BTC/유령) + 코어 과다 + 익절
  const trim: ActionItem[] = []
  if (btcPct > CAP) {
    const btc = items.find(i => i.role === 'SATELLITE_BTC')
    if (btc) trim.push({ ticker: btc.ticker, name: btc.name, market: btc.market, weightPct: btcPct, trimPct: Math.round((btcPct - CAP) * 10) / 10, reason: `비트코인이 캡 ${CAP}%를 ${Math.round((btcPct - CAP) * 10) / 10}%p 초과 — 초과분 코어/일반으로 기계적 환원`, tag: '캡 초과' })
  }
  if (ghostPct > CAP) {
    const gs = items.filter(i => i.role === 'SATELLITE_GHOST').sort((a, b) => b.mv - a.mv)[0]
    if (gs) trim.push({ ticker: gs.ticker, name: gs.name, market: gs.market, weightPct: ghostPct, trimPct: Math.round((ghostPct - CAP) * 10) / 10, reason: `유령/10배거가 캡 ${CAP}%를 초과 — 초과분 환원(고위험 영역 통제)`, tag: '캡 초과', sector: secByTicker[gs.ticker.toUpperCase()] ?? null })
  }
  for (const d of diagnoses) {
    if (d.action === 'TAKE_PROFIT' && d.releaseWeight >= 0.1 && !dropSeen.has(d.ticker.toUpperCase())) {
      trim.push({ ticker: d.ticker, name: d.name, market: (d.market === 'KR' ? 'KR' : 'US'), weightPct: pctOf(mvByTicker.get(d.ticker.toUpperCase())?.mv ?? 0), trimPct: d.releaseWeight, reason: d.sellReasons.join('·') || '수익 중 + 고평가 — 분할 익절', tag: '익절', sector: secByTicker[d.ticker.toUpperCase()] ?? null })
    } else if (d.trimWeight >= 0.1 && !dropSeen.has(d.ticker.toUpperCase()) && d.action !== 'TAKE_PROFIT') {
      trim.push({ ticker: d.ticker, name: d.name, market: (d.market === 'KR' ? 'KR' : 'US'), weightPct: pctOf(mvByTicker.get(d.ticker.toUpperCase())?.mv ?? 0), trimPct: d.trimWeight, reason: d.sellReasons.join('·') || '분류 비중 과다 — 분산 위해 일부 축소', tag: '집중 축소', sector: secByTicker[d.ticker.toUpperCase()] ?? null })
    }
  }
  // ⑤' 신호 기반 트림 — 역DCF 기대과도·수급 이탈·계절 역풍(이미 정리/축소 대상 아닌 종목, 비중 큰 순)
  const trimSeen = new Set(trim.map(t => t.ticker.toUpperCase()))
  for (const d of [...diagnoses].sort((a, b) => (pctOf(mvByTicker.get(b.ticker.toUpperCase())?.mv ?? 0)) - (pctOf(mvByTicker.get(a.ticker.toUpperCase())?.mv ?? 0)))) {
    const k = d.ticker.toUpperCase()
    if (dropSeen.has(k) || trimSeen.has(k)) continue
    const sigs = sellSignalText(k)
    if (sigs.length === 0) continue
    const w = pctOf(mvByTicker.get(k)?.mv ?? 0)
    if (w < 1) continue   // 비중 1% 미만은 노이즈
    trim.push({ ticker: d.ticker, name: d.name, market: (d.market === 'KR' ? 'KR' : 'US'), weightPct: w, trimPct: Math.round(Math.min(w * 0.3, 4) * 10) / 10, reason: sigs.join(' · '), tag: sig.get(k)?.dcf === 'demanding' ? '고평가' : sig.get(k)?.flow === 'CROWDED' ? '수급 이탈' : '계절 역풍', sector: secByTicker[k] ?? null })
    trimSeen.add(k)
  }
  // 기존 drop·trim 이유에 종목 신호 보강(중복 방지)
  for (const a of [...drop, ...trim]) {
    const extra = sellSignalText(a.ticker.toUpperCase()).filter(s => !a.reason.includes(s.slice(0, 6)))
    if (extra.length) a.reason = `${a.reason} · ${extra.join(' · ')}`
  }

  // ⑥ 🛒 보강할 것 — 통합3축 매수 + 캡 미달(BTC/유령) + 코어 밴드 미달
  const add: BuyIdea[] = []
  if (corePct < band.min) add.push({ ticker: 'CORE', name: '코어 보강(지수 ETF/채권)', market: 'KR', role: 'CORE_INDEX', targetPct: Math.round((band.min - corePct) * 10) / 10, reason: `현재 코어 ${corePct}% < 목표 하한 ${band.min}%(${band.text}) — 시장 베타·방어를 위해 광의 지수/채권 보강`, tag: '코어 밴드' })
  if (btcPct < CAP - 1) add.push({ ticker: 'BTC', name: '비트코인', market: 'US', role: 'SATELLITE_BTC', targetPct: Math.round((CAP - btcPct) * 10) / 10, reason: `전략 암호 캡 ${CAP}% 미달(현재 ${btcPct}%) — 분산·비상관 자산으로 비트코인 보강`, tag: 'BTC 캡 미달' })
  if (ghostPct < CAP - 1 && sats.length > 0) {
    const s = sats[0]
    add.push({ ticker: s.ticker, name: s.name, market: s.market, role: 'SATELLITE_GHOST', targetPct: Math.round(Math.min(CAP - ghostPct, s.allocWeight || 3) * 10) / 10, reason: `유령 캡 ${CAP}% 미달(현재 ${ghostPct}%) — 발굴주: ${s.reason}`, tag: '유령 발굴', sector: s.sector ?? null })
  }
  for (const b of buys.slice(0, 4)) add.push({ ticker: b.ticker, name: b.name, market: b.market, role: 'SATELLITE_GENERAL', targetPct: b.allocWeight, reason: b.reason, tag: `통합점수 ${b.aiScore}`, sector: b.sector ?? null, timing: b.timing ?? null })

  // 🚦 최후 방어선 경고(역배열+구름 이탈) — 매도측 근거 '병기'(판정은 절대 안 뒤집음 — 일방적 매도 강요 금지 원칙)
  //    + 매수측(add)엔 타점 신호등 부착. 전부 기술차트와 동일 SSOT(entryTiming) — tech-chart 캐시 공유·추가 판정기 0
  try {
    const uniq = new Map<string, { ticker: string; market: 'KR' | 'US' }>()
    for (const it of [...drop, ...trim]) if (it.market === 'KR' || it.market === 'US') uniq.set(`${it.ticker}:${it.market}`, { ticker: it.ticker, market: it.market })
    for (const a of add) if ((a.market === 'KR' || a.market === 'US') && a.ticker !== 'CORE' && a.ticker !== 'BTC' && !a.timing) uniq.set(`${a.ticker}:${a.market}`, { ticker: a.ticker, market: a.market as 'KR' | 'US' })
    const tmap = await getEntryTimings(Array.from(uniq.values()), 4)
    for (const it of [...drop, ...trim]) {
      const t = tmap.get(`${it.ticker}:${it.market}`)
      if (t?.trendBreak) it.reason += ' · 🚨 최후 방어선 붕괴(EMA 역배열+구름 이탈 — 장기 추세까지 꺾임)'
    }
    for (const a of add) if (!a.timing) a.timing = tmap.get(`${a.ticker}:${a.market}`) ?? null
  } catch { /* graceful — 경고·배지만 생략 */ }

  // ⑦ 조언형 실행 가이드(체결 X)
  const dropName = drop[0]?.name, addName = add.find(a => a.ticker !== 'CORE' && a.ticker !== 'BTC')?.name ?? add[0]?.name
  const guide = `유휴 현금을 먼저 쓰고, 부족하면 ${dropName ? `'${dropName}' 등 정리 대상의 매도 대금` : '비중 축소 자산의 매도 대금'}으로 ${addName ? `'${addName}' 등` : '보강 대상'}을 매수하세요. ⚠️ 실제 체결은 직접 진행 — 본 가이드는 순서·금액 제안까지입니다(국내 T+2 등 결제일 고려).`

  return {
    groups, totalValue: Math.round(total), corePct, coreTargetMin: band.min, coreTargetMax: band.max, coreTargetText: band.text,
    btcPct, ghostPct, capPct: CAP,
    drop: drop.sort((a, b) => b.weightPct - a.weightPct), trim, add, guide,
  }
}

// ── 분산 진단: 분류 Before→After + 섹터 집중도 ────────────────────────────────
function buildDiversification(
  diagnoses: HoldingDiagnosis[], secByTicker: Record<string, string>,
  curCat: Record<string, number>, curSec: Record<string, number>,
  buys: BuyCandidate[],
): DiversificationView | null {
  if (diagnoses.length === 0) return null
  // after 분류 = 현재 − 회수분(매도종목 분류에서) + 매수 배분분(후보 분류로)
  const afterCat: Record<string, number> = { ...curCat }
  const afterSec: Record<string, number> = { ...curSec }
  for (const d of diagnoses) {
    if (d.releaseWeight > 0) {
      if (d.lynchCategory) afterCat[d.lynchCategory] = Math.max(0, (afterCat[d.lynchCategory] ?? 0) - d.releaseWeight)
      const s = secByTicker[d.ticker.toUpperCase()] ?? '기타'
      afterSec[s] = Math.max(0, (afterSec[s] ?? 0) - d.releaseWeight)
    }
  }
  for (const b of buys) {
    if (b.allocWeight > 0) {
      afterCat[b.lynchCategory] = (afterCat[b.lynchCategory] ?? 0) + b.allocWeight
      afterSec[b.sector] = (afterSec[b.sector] ?? 0) + b.allocWeight
    }
  }
  const r1 = (n: number) => Math.round(n * 10) / 10
  // 분류: 황금비율 6종 + 실제 보유 분류 모두 표기
  const catKeys = Array.from(new Set([...Object.keys(IDEAL_RATIOS), ...Object.keys(curCat)]))
  const categories: CategoryBalance[] = catKeys.map(k => ({
    key: k, label: CAT_KR[k] ?? k,
    before: r1(curCat[k] ?? 0), after: r1(afterCat[k] ?? 0), ideal: IDEAL_RATIOS[k] ?? 0,
  })).sort((a, b) => b.ideal - a.ideal || b.before - a.before)

  const toSorted = (rec: Record<string, number>): SectorWeight[] =>
    Object.entries(rec).filter(([, w]) => w > 0.05)
      .map(([sector, weight]) => ({ sector, weight: r1(weight) }))
      .sort((a, b) => b.weight - a.weight)
  const sectorsBefore = toSorted(curSec)
  const sectorsAfter = toSorted(afterSec)
  return {
    categories, sectorsBefore, sectorsAfter,
    topSectorBefore: sectorsBefore[0]?.weight ?? 0,
    topSectorAfter: sectorsAfter[0]?.weight ?? 0,
  }
}

// ── Gemini 내러티브 ───────────────────────────────────────────────────────────
const ACTION_KO: Record<RebalanceAction, string> = {
  TAKE_PROFIT: '익절(수익중·고평가)', CUT_LOSS: '손절(손실중·thesis붕괴)',
  HOLD_DIP: '보류(손실중·단순고평가→저점매도 방지)', DEFEND: '사수(저평가/호재)', KEEP: '유지',
}

async function buildNarrative(holdings: HoldingDiagnosis[], buys: BuyCandidate[], sellBudget: number, div: DiversificationView | null, trap: CyclicalTrap | null, hype: HypePremium | null, zombie: ZombieRisk | null, regimeNote: string | null): Promise<string> {
  const sellLines = holdings
    // 실제 행동 가능한 것만: 회수 비중 ≥0.1% 이거나 보류(저점매도 방지) — 소액(0%) 익절 노이즈 제외
    .filter(h => h.releaseWeight >= 0.1 || h.action === 'HOLD_DIP')
    .map(h => `- ${h.name}(${h.ticker}): 비중 ${h.weight}%, 손익 ${h.pnlPct != null ? `${h.pnlPct > 0 ? '+' : ''}${h.pnlPct}%` : '자료없음'}, ${ACTION_KO[h.action]}${h.trimWeight >= 0.1 ? `+분산트림 ${h.trimWeight}%` : ''}${h.breakEvenRise != null ? `, 본전까지 +${h.breakEvenRise}% 필요` : ''}, 사유: ${h.sellReasons.join('·') || '—'}`)
    .join('\n')
  const buyLines = buys.map(b => `- ${b.name}(${b.ticker}): AI점수 ${b.aiScore}, PEG ${b.peg ?? '—'}, 섹터 ${b.sector}, 제안 ${b.allocWeight}%, ${b.reason}`).join('\n')
  const concDelta = div ? Math.round((div.topSectorBefore - div.topSectorAfter) * 10) / 10 : 0
  const concImproved = concDelta >= 1   // 최대 섹터 집중도가 1%p+ 실제로 줄었나
  const divLine = div
    ? `최대 단일 섹터 비중 ${div.topSectorBefore}%→${div.topSectorAfter}% (낮을수록 분산 양호). ${concImproved
        ? `→ 집중도 ${concDelta}%p 감소(개선).`
        : `→ ⚠️ 집중도가 거의 안 줄었다(개선 아님). 이번 리밸런싱이 '편중 구조를 개선/해소했다'고 말하지 말 것 — 최대 섹터의 핵심 대형주가 깊은 손실·최저PEG 보호로 트림 대상에서 빠져 회수 예산이 작기 때문이다. 정직하게 '핵심 대형주 보호로 이번엔 소폭만 조정됐고, 집중 해소는 학생이 해당 대형주를 직접 판단해야 한다'는 취지로 서술하라.`} 분류 편중: ${div.categories.filter(c => c.before > c.ideal + 10).map(c => `${c.label} ${c.before}%(권장 ${c.ideal}%)`).join(', ') || '없음'}`
    : ''
  const trapLine = trap
    ? `⚠️경기순환주(반도체 등)가 ${trap.weight}%로 집중. ${trap.tickers.map(t => `${t.name} PEG ${t.peg}`).join(', ')}처럼 PEG가 낮아 저평가로 보이지만, 경기순환주는 이익이 정점일 때 PER이 가장 낮아 보이는 '가치 함정'일 수 있다(피터 린치 원리). 저PEG만 보고 안심하지 말 것.`
    : ''
  const hypeLine = hype
    ? `💭영업적자(이익이라는 실체 없음) 종목이 ${hype.weight}% 보유 중: ${hype.tickers.map(t => `${t.name}(영업이익률 ${t.opMargin}%)`).join(', ')}. 이익 없이 성장 스토리·내러티브로 프리미엄을 받는 '하이프 프리미엄'은 거품 위험(버핏 원리). 다만 일방적 매도가 아니라, 매출 성장·해자(기술)가 실재하는지 확인하고 비중을 관리할 것.`
    : ''
  const zombieLine = zombie
    ? `🧟좀비 위험: ${zombie.tickers.map(t => `${t.name}(이자보상배율 ${t.interestCoverage}배)`).join(', ')}는 영업이익으로 이자도 충분히 못 갚는 상태(이자보상배율 1.5 미만). 금리·업황 악화 시 파산 위험이 큰 구조적 약체 — 비중 관리 필요.`
    : ''

  const prompt = `너는 '2026 투자학교'의 AI 자산관리 비서다. 학생의 실제 포트폴리오 손익을 고려해 따뜻하지만 정직한 리밸런싱 코칭을 하라.

[시장 매크로 맥락 — 참고용, SSOT]
${regimeNote ?? '자료없음'}

[매도/축소 후보 (실제 손익 반영)]
${sellLines || '없음'}

[신규 매수 후보 (미보유·AI 추천)]
${buyLines || '없음'}

[회수 가능 예산] 총 ${sellBudget}% (이 비중만큼만 신규 매수 — 현금 중립)

[분산 상태] ${divLine || '자료없음'}

[시클리컬 함정] ${trapLine || '해당 없음'}

[하이프 프리미엄] ${hypeLine || '해당 없음'}

[좀비 위험] ${zombieLine || '해당 없음'}

[⛔ 절대 규칙]
- '승률 95%' 같은 지어낸 확률·숫자 금지. 주어진 AI점수·PEG·손익률만 사용.
- 【손익 부호 엄수】각 종목의 '손익'이 음수(−)면 절대 '수익 중'이라 표현하지 말 것. 음수=손실 중, 양수=수익 중으로만 서술하라.
- 【매도 유형 엄수】각 종목에 표기된 유형(익절/손절/보류/유지+분산트림)을 그대로 반영하라. 특히 '분산트림'으로 축소되는 종목은 '차익 실현·익절'이 아니라 반드시 '분산(비중 조정)을 위한 축소'로만 서술하라. '차익 실현/익절'이라는 표현은 유형이 '익절(수익중·고평가)'로 명시된 종목에만 사용 가능하다.
- 손실 종목을 '단순 고평가'만으로 손절 강요 금지(보류 종목은 "저점 매도 금물"로 안내).
- 손실 회피 심리를 헤아려라: 익절은 축하의 톤, 손절은 "기회비용·전략적 후퇴"로 위로하되 강요 아닌 '고려' 권유.
- 본전까지 필요 상승률은 확정된 수학이니 그대로 활용해 설득하라(예: "−15%면 본전까지 +17.6%가 필요한데 회복 동력이 없다").
- [시장 매크로 맥락]이 '자료없음'이 아니면, 신규 매수 비중을 어느 정도로 가져갈지에 참고할 한 문장을 코칭에 자연스럽게 녹여라(예: "현재 금리 고점기이니 신규 편입은 분할로 신중하게 접근" 식). 단정적 예측이나 매수/매도 지시가 아니라 '참고할 시장 맥락'으로만 다뤄라.
- [분산 상태]가 있으면 섹터·분류 편중을 한 문장으로 짚어라. 단, [분산 상태]에 명시된 집중도 변화(개선/미개선)를 그대로만 서술하라 — 최대 섹터 집중도가 실제로 줄지 않았으면 절대 '편중 구조를 개선/해소했다'고 과장하지 말고, 명시된 대로 '핵심 대형주 보호로 소폭만 조정됐다'는 취지로 정직하게 서술하라.
- [시클리컬 함정]이 '해당 없음'이 아니면, 저PEG 경기순환주를 무조건 저평가로 믿지 말라는 린치의 '가치 함정' 경고를 한 문장으로 꼭 포함하라.
- [하이프 프리미엄]이 '해당 없음'이 아니면, 이익 실체 없이 스토리로 프리미엄 받는 거품 위험을 한 문장으로 짚되 일방적 매도가 아닌 비중 관리·해자 확인으로 안내하라.
- [좀비 위험]이 '해당 없음'이 아니면, 이자도 못 갚는 구조적 약체임을 한 문장으로 경고하라.
- 마지막에 "교육용 시뮬레이션이며 투자 추천이 아닙니다"를 반드시 덧붙여라.

[출력] 3~6문장의 한국어 코칭 1단락. JSON {"narrative": "..."} 형식만.`

  const r = await callGeminiJSON<{ narrative: string }>(prompt, {
    type: 'OBJECT', properties: { narrative: { type: 'STRING' } }, required: ['narrative'],
  }, { temperature: 0.5 })

  if (r.ok && r.data.narrative) return r.data.narrative
  // 폴백(결정론적)
  const cut = holdings.filter(h => h.action === 'CUT_LOSS').length
  const tp = holdings.filter(h => h.action === 'TAKE_PROFIT').length
  const macroSuffix = regimeNote ? ` 참고로 ${regimeNote.split('.')[0]}이니 신규 편입은 분할로 신중하게 접근하세요.` : ''
  const divSuffix = div
    ? (concImproved
        ? ` 회수 가능한 ${sellBudget}%를 AI 추천 저평가 종목으로 재배분하면 섹터 집중도(${div.topSectorBefore}%→${div.topSectorAfter}%)가 낮아져 분산이 개선됩니다.`
        : ` 다만 최대 섹터 집중(${div.topSectorAfter}%)은 핵심 대형주가 손실·최저PEG 보호로 트림에서 빠져 회수 예산이 ${sellBudget}%뿐이라 이번엔 소폭만 조정됩니다 — 집중 해소는 해당 대형주를 직접 판단하셔야 합니다.`)
    : ''
  return `현재 포트폴리오에서 익절 대상 ${tp}종목, 손절 검토 ${cut}종목이 포착됐습니다.${divSuffix} 손실 종목 중 단순 고평가뿐인 종목은 저점 매도를 피하고 보유를 권합니다.${macroSuffix} ※ 교육용 시뮬레이션이며 투자 추천이 아닙니다.`
}
