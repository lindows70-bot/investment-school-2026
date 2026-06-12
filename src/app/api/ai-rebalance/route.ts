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
  tickers: { ticker: string; name: string; market: string; peg: number | null }[]  // 저PEG 경기순환주(함정 의심)
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
  const cacheKey = `ai-rebalance-v15:${user.id}:${today}:${fp}`   // v15: MECE 분류 SSOT + pegSuspect(기저효과) 가드

  if (!forceRefresh) {
    const cached = await getCache<RebalanceResult>(cacheKey, 24 * 3600_000)
    if (cached) return NextResponse.json({ ...cached, fromCache: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ① 보유 종목 (STOCK만)
  const db = admin()
  const { data: rows } = await db.from('investments')
    .select('ticker,name,market,quantity,purchase_price,lynch_category')
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
      // MECE 분류 SSOT — lynch-matrix(진단 탭)와 동일 분류기(제2원칙). DB 지정 > 펀더멘탈 자동
      let lynchCategory: string | null = v.lynch_category ?? null
      try {
        const m = await buildSignalMetrics(v.ticker, v.market ?? 'US', v.name ?? '', base)
        if (m) {
          peg = m.peg
          pegSuspect = isPegBaseEffect(m.peg, m.earningsGrowth)
          opMargin = m.opMargin
          interestCoverage = m.interestCoverage
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
        action, sellReasons, peg, pegSuspect, opMargin, interestCoverage, breakEvenRise: breakEvenRiseOf(v.pnlPct), releaseWeight, trimWeight: 0,
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
  const lowPegCyclicals = diagnoses
    .filter(d => d.lynchCategory === 'cyclical' && d.peg != null && d.peg > 0 && d.peg < 0.8 && d.weight > 0.5)
    .map(d => ({ ticker: d.ticker, name: d.name, market: d.market, peg: d.peg }))
  const cyclicalTrap: CyclicalTrap | null =
    cyclicalWeight >= 40 && lowPegCyclicals.length > 0
      ? { weight: cyclicalWeight, tickers: lowPegCyclicals }
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
  try {
    const ur = await fetch(`${base}/api/unified-reco`, { headers: { cookie }, signal: AbortSignal.timeout(40_000) })
    if (ur.ok) {
      const ud = await ur.json() as UnifiedRecoResult
      // 통합점수 상위 4종(코어) — 순서·종목을 ③통합매수와 동일하게. (이미 미보유로 필터됨, 안전망으로 재확인)
      const ranked = (ud.items ?? []).filter(it => !heldSet.has(it.ticker.toUpperCase())).slice(0, 4)
      const csum = ranked.reduce((s, it) => s + it.combined, 0) || 1
      buyCandidates = ranked.map(it => ({
        ticker: it.ticker, name: it.name, market: it.market, lynchCategory: it.lynchCategory,
        peg: it.peg, aiScore: it.combined, sector: it.sector,
        reason: it.badges.slice(0, 3).join(' · ') || `통합 ${it.combined}점(계절·가치·수급)`,
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

  const narrative = await buildNarrative(diagnoses, buyCandidates, sellBudget, diversification, cyclicalTrap, hypePremium, zombieRisk, regimeNote)

  const result: RebalanceResult = {
    holdings: diagnoses, buyCandidates, sellBudget, diversification, cyclicalTrap, hypePremium, zombieRisk, satelliteCandidates, portfolioValue: Math.round(totalMv),
    narrative, generatedAt: new Date().toISOString(), fromCache: false,
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
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
  const divLine = div
    ? `최대 단일 섹터 비중 ${div.topSectorBefore}%→${div.topSectorAfter}% (낮을수록 분산 양호). 분류 편중: ${div.categories.filter(c => c.before > c.ideal + 10).map(c => `${c.label} ${c.before}%(권장 ${c.ideal}%)`).join(', ') || '없음'}`
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
- [분산 상태]가 있으면 섹터·분류 편중을 한 문장으로 짚고, 이 리밸런싱이 분산을 어떻게 개선하는지 설명하라.
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
  return `현재 포트폴리오에서 익절 대상 ${tp}종목, 손절 검토 ${cut}종목이 포착됐습니다. 회수 가능한 ${sellBudget}%를 AI 추천 저평가 종목으로 재배분하면 분산이 개선됩니다. 손실 종목 중 단순 고평가뿐인 종목은 저점 매도를 피하고 보유를 권합니다.${macroSuffix} ※ 교육용 시뮬레이션이며 투자 추천이 아닙니다.`
}
