// 🎯 린치×수급 융합 추천 v2 — 통합 추천 점수 + 개인 이탈 조건 + ₩ 매수 가이드(자동화 연결고리)
// 기존 v1 대비 신규: ① 통합 Reco Score(0~100) ② 개인 이탈 확인 ③ 포트폴리오 총액→₩ 편입 가이드
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { computeMarketFlowKr, type MarketFlowKrResult, type MarketFlowEntry } from '@/lib/marketFlowKr'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export interface RecoItem {
  ticker:      string
  name:        string
  sector:      string
  peg:         number | null
  dualStreak:  number
  foreign5:    number         // 5일 누적 순매수(억)
  organ5:      number
  individual1: number         // ★ NEW: 당일 개인 순매수(억) — 음수=이탈 = 강한 신호
  changePct:   number | null
  recoScore:   number         // ★ NEW: 통합 추천 점수 0~100
  suggestWon:  number         // ★ NEW: 권장 매수 금액(원) — 포트폴리오의 2%(신규) / 1%(추가)
  reason:      string
  category:    'fillGap' | 'pearl' | 'addMore' | 'near'
}
export interface PortfolioRecoResult {
  fillGap:     RecoItem[]
  pearl:       RecoItem[]
  addMore:     RecoItem[]
  near:        RecoItem[]     // 임박 후보(모멘텀은 있지만 쌍끌이 미충족)
  heldSectors: string[]
  portfolioKrw: number        // ★ NEW: 원화 환산 총 포트폴리오 가치
  asOf:        string
}

const eok = (v: number) => Math.round(v / 1e8)
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const USD_KRW = 1350

// ★ 통합 추천 점수(0~100) — PEG 가치 + 수급 강도 + 개인 이탈 가산
function recoScore(e: MarketFlowEntry, sectBonus = 0): number {
  let s = 0
  // PEG 밸류에이션 점수(최대 35)
  if (e.peg != null && e.peg > 0) {
    s += e.peg < 0.3 ? 35 : e.peg < 0.5 ? 30 : e.peg < 0.8 ? 22 : e.peg < 1.0 ? 14 : 0
  }
  // 수급 강도 점수(최대 40) — 쌍끌이 일수 + 5일 누적 대금 규모
  // ※ max(0, ...) : 5일 누적이 음수여도 최근 쌍끌이 달성 종목에 음수 페널티 금지
  s += Math.min(e.dualStreak * 8, 24)
  const f5 = Math.max(0, e.foreign.d5 / 1e10), o5 = Math.max(0, e.organ.d5 / 1e10)
  s += Math.min(Math.floor((f5 + o5) * 3), 16)
  // 개인 이탈 보너스(최대 15) — 개인이 팔고 메이저가 받는 구조 = 수급 신뢰도 UP
  const ind1 = e.individual?.d1 ?? 0
  if (ind1 < -5e9) s += 15        // 개인 50억 이상 이탈
  else if (ind1 < 0) s += 8       // 개인 소규모 이탈
  // 섹터 빈집 보너스(최대 10)
  s += sectBonus
  return Math.min(100, Math.max(0, s))
}

const toItem = (
  e: MarketFlowEntry, reason: string, category: RecoItem['category'],
  sectBonus = 0, suggestWon = 0,
): RecoItem => ({
  ticker: e.ticker, name: e.name, sector: e.sector, peg: e.peg, dualStreak: e.dualStreak,
  foreign5: eok(e.foreign.d5), organ5: eok(e.organ.d5),
  individual1: eok(e.individual?.d1 ?? 0),
  changePct: e.changePct, recoScore: recoScore(e, sectBonus), suggestWon, reason, category,
})

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `portfolio-reco-kr-v3:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<PortfolioRecoResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 시장 수급 — 캐시 우선(추가 수집 0)
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  let mf = await getCache<MarketFlowKrResult>(`market-flow-kr-v4:${kstDate()}`, 24 * 3600_000)
  if (!mf) mf = await computeMarketFlowKr(base)
  const entries = mf.entries

  // 보유 종목 + 포트폴리오 총 가치(₩ 환산)
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency').eq('user_id', user.id)
  const krStocks = (rows ?? []).filter(r => r.market === 'KR' && getAssetType(r.ticker, r.name ?? '', 'KR') === 'STOCK')
  const portfolioKrw = (rows ?? []).reduce((s, r) => {
    const rate = (r.currency === 'USD') ? USD_KRW : 1
    return s + (r.purchase_price ?? 0) * (r.quantity ?? 0) * rate
  }, 0)

  const heldCodes = new Set(krStocks.map(r => (r.ticker.match(/\d{6}/)?.[0] ?? '')).filter(Boolean))
  const byCode = new Map(entries.map(e => [e.ticker, e]))
  const heldSectorsSet = new Set<string>()
  Array.from(heldCodes).forEach(c => { const e = byCode.get(c); if (e) heldSectorsSet.add(e.sector) })

  const suggestNew = Math.round(portfolioKrw * 0.02)    // 신규: 포트폴리오의 2%
  const suggestAdd = Math.round(portfolioKrw * 0.01)    // 추가: 1%

  // ① 빈집 채우기: 미보유 + 없는 섹터 + 쌍끌이/5일동반매수
  const fillGap = entries
    .filter(e => !heldCodes.has(e.ticker) && !heldSectorsSet.has(e.sector)
      && (e.dualStreak >= 2 || (e.foreign.d5 > 0 && e.organ.d5 > 0)))
    .sort((a, b) => recoScore(b, 10) - recoScore(a, 10))   // 빈집엔 섹터 보너스 10점
    .slice(0, 3)
    .map(e => {
      const indStr = (e.individual?.d1 ?? 0) < 0 ? ` + 개인 ${eok(e.individual?.d1 ?? 0)}억 이탈(수급 신뢰↑)` : ''
      return toItem(e,
        `내 포폴에 없는 '${e.sector}' 섹터 — 외인·기관 ${e.dualStreak >= 2 ? `${e.dualStreak}일 쌍끌이` : '5일 동반매수'}${indStr}. 권장 편입 ${(suggestNew / 1e4).toFixed(0)}만원(포트폴리오 2%).`,
        'fillGap', 10, suggestNew)
    })

  // ② 진주 발굴: 미보유 + 저PEG(<1.0) + 쌍끌이 2일+ + ★개인 이탈 있으면 최우선
  const pearl = entries
    .filter(e => !heldCodes.has(e.ticker) && e.peg != null && e.peg > 0 && e.peg < 1.0 && e.dualStreak >= 2)
    .sort((a, b) => recoScore(b) - recoScore(a))
    .slice(0, 3)
    .map(e => {
      const indStr = (e.individual?.d1 ?? 0) < 0 ? ` · 개인 이탈 중 — 수급 구조 최적` : ''
      return toItem(e,
        `PEG ${e.peg!.toFixed(2)} 저평가 + 외인·기관 ${e.dualStreak}일 쌍끌이${indStr}. 권장 신규 편입 ${(suggestNew / 1e4).toFixed(0)}만원.`,
        'pearl', 0, suggestNew)
    })

  // ③ 보유 불타기: 보유(유니버스) + ★강한 조건(쌍끌이 or 외인 1일·5일+개인이탈)
  const addMore = entries
    .filter(e => heldCodes.has(e.ticker)
      && (e.dualStreak >= 2 || (e.foreign.d1 > 0 && e.foreign.d5 > 0 && (e.individual?.d1 ?? 0) <= 0)))
    .sort((a, b) => recoScore(b) - recoScore(a))
    .slice(0, 3)
    .map(e => {
      const hasInd = (e.individual?.d1 ?? 0) < 0
      return toItem(e,
        `보유 중 — ${e.dualStreak >= 2 ? `외인·기관 ${e.dualStreak}일 쌍끌이` : '외인 연속 순매수'}${hasInd ? ' + 개인 이탈 — 메이저 단독 매집 구조' : ''}. 비중 확대 권장 ${(suggestAdd / 1e4).toFixed(0)}만원(포트폴리오 1%).`,
        'addMore', 0, suggestAdd)
    })

  // ④ 임박 후보: 진주·빈집 조건 미충족이지만 모멘텀≥30(선행 신호)
  const covered = new Set([...fillGap, ...pearl, ...addMore].map(r => r.ticker))
  const near = entries
    .filter(e => !covered.has(e.ticker) && !heldCodes.has(e.ticker)
      && e.peg != null && e.peg > 0 && e.peg < 1.2
      && (e.foreign.d5 > 0 || e.dualStreak >= 1))
    .map(e => ({ e, score: recoScore(e) }))
    .filter(x => x.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ e }) => toItem(e,
      `저PEG + 수급 조짐 — 아직 쌍끌이 확정은 아니나 추세 상승 중(점수 ${recoScore(e)}점). 관심종목 등록 후 쌍끌이 확인 시 편입 검토.`,
      'near', 0, 0))

  const result: PortfolioRecoResult = {
    fillGap, pearl, addMore, near,
    heldSectors: Array.from(heldSectorsSet), portfolioKrw, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
