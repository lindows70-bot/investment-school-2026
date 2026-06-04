// 🤖 AI 포트폴리오 리밸런싱 (Phase 1) — 수익률 연동형 교체매매 플랜
// 매도 진단(jarvisBriefing 재사용) × 실제 손익률 → 익절/손절/보류 4분면 + 신규 매수후보(macro-ai-picks)
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { buildSignalMetrics, evaluateSignal } from '@/lib/jarvisBriefing'
import type { MacroAiResult, AiRecommendation } from '@/app/api/macro-ai-picks/route'

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
  breakEvenRise: number | null   // 손실 종목: 본전까지 필요 상승률 % (확정 수학)
  releaseWeight: number          // 이 종목에서 회수할 비중 %(익절=절반, 손절=전량)
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
}

export interface RebalanceResult {
  holdings:       HoldingDiagnosis[]
  buyCandidates:  BuyCandidate[]
  sellBudget:     number         // 회수 가능 총 비중 %
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

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const cacheKey = `ai-rebalance-v1:${user.id}:${today}`

  const cached = await getCache<RebalanceResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json({ ...cached, fromCache: true }, { headers: { 'Cache-Control': 'no-store' } })

  // ① 보유 종목 (STOCK만)
  const db = admin()
  const { data: rows } = await db.from('investments')
    .select('ticker,name,market,quantity,purchase_price,lynch_category')
    .eq('user_id', user.id)
  const holds = (rows ?? []).filter(h => getAssetType(h.ticker, h.name ?? '', h.market ?? 'US') === 'STOCK')
  if (holds.length === 0) {
    return NextResponse.json({ holdings: [], buyCandidates: [], sellBudget: 0, narrative: '분석할 개별 주식이 없습니다. 종목을 추가하면 리밸런싱 진단이 시작됩니다.', generatedAt: new Date().toISOString(), fromCache: false })
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

  const valued = holds.map(h => {
    const price = prices[h.ticker.toUpperCase()] ?? 0
    const qty = Number(h.quantity) || 0
    const buy = Number(h.purchase_price) || 0
    const mv = price * qty
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
      try {
        const m = await buildSignalMetrics(v.ticker, v.market ?? 'US', v.name ?? '', base)
        if (m) {
          peg = m.peg
          const decision = evaluateSignal(m, v.lynch_category ?? null, false)
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
        lynchCategory: v.lynch_category ?? null, weight, pnlPct: v.pnlPct,
        action, sellReasons, peg, breakEvenRise: breakEvenRiseOf(v.pnlPct), releaseWeight,
      } as HoldingDiagnosis
    }))
    diagnoses.push(...rs)
  }
  diagnoses.sort((a, b) => b.releaseWeight - a.releaseWeight || b.weight - a.weight)

  const sellBudget = Math.round(diagnoses.reduce((s, d) => s + d.releaseWeight, 0) * 10) / 10

  // ④ 신규 매수 후보 (macro-ai-picks 재사용) — 미보유만, aiScore 순
  let buyCandidates: BuyCandidate[] = []
  try {
    const mr = await fetch(`${base}/api/macro-ai-picks`, { signal: AbortSignal.timeout(30_000) })
    if (mr.ok) {
      const md = await mr.json() as MacroAiResult
      const pool = (md.recommendations ?? [])
        .filter((r: AiRecommendation) => !heldSet.has(r.ticker.toUpperCase()))
        .sort((a, b) => b.aiScore - a.aiScore)
        .slice(0, 4)
      // 매도 예산을 aiScore 비례로 배분
      const scoreSum = pool.reduce((s, r) => s + r.aiScore, 0) || 1
      buyCandidates = pool.map(r => ({
        ticker: r.ticker, name: r.name, market: r.market, lynchCategory: r.lynchCategory,
        peg: r.peg, aiScore: r.aiScore,
        reason: r.macroFitReason || r.fundamentalReason || '',
        allocWeight: sellBudget > 0 ? Math.round((sellBudget * (r.aiScore / scoreSum)) * 10) / 10 : 0,
      }))
    }
  } catch { /* graceful */ }

  // ⑤ Gemini 내러티브 (심리 인지 + 정직)
  const narrative = await buildNarrative(diagnoses, buyCandidates, sellBudget)

  const result: RebalanceResult = {
    holdings: diagnoses, buyCandidates, sellBudget,
    narrative, generatedAt: new Date().toISOString(), fromCache: false,
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

// ── Gemini 내러티브 ───────────────────────────────────────────────────────────
const ACTION_KO: Record<RebalanceAction, string> = {
  TAKE_PROFIT: '익절(수익중·고평가)', CUT_LOSS: '손절(손실중·thesis붕괴)',
  HOLD_DIP: '보류(손실중·단순고평가→저점매도 방지)', DEFEND: '사수(저평가/호재)', KEEP: '유지',
}

async function buildNarrative(holdings: HoldingDiagnosis[], buys: BuyCandidate[], sellBudget: number): Promise<string> {
  const sellLines = holdings
    .filter(h => h.action === 'TAKE_PROFIT' || h.action === 'CUT_LOSS' || h.action === 'HOLD_DIP')
    .map(h => `- ${h.name}(${h.ticker}): 비중 ${h.weight}%, 손익 ${h.pnlPct != null ? `${h.pnlPct > 0 ? '+' : ''}${h.pnlPct}%` : '자료없음'}, ${ACTION_KO[h.action]}${h.breakEvenRise != null ? `, 본전까지 +${h.breakEvenRise}% 필요` : ''}, 사유: ${h.sellReasons.join('·') || '—'}`)
    .join('\n')
  const buyLines = buys.map(b => `- ${b.name}(${b.ticker}): AI점수 ${b.aiScore}, PEG ${b.peg ?? '—'}, 제안 ${b.allocWeight}%, ${b.reason}`).join('\n')

  const prompt = `너는 '2026 투자학교'의 AI 자산관리 비서다. 학생의 실제 포트폴리오 손익을 고려해 따뜻하지만 정직한 리밸런싱 코칭을 하라.

[매도/축소 후보 (실제 손익 반영)]
${sellLines || '없음'}

[신규 매수 후보 (미보유·AI 추천)]
${buyLines || '없음'}

[회수 가능 예산] 총 ${sellBudget}% (이 비중만큼만 신규 매수 — 현금 중립)

[⛔ 절대 규칙]
- '승률 95%' 같은 지어낸 확률·숫자 금지. 주어진 AI점수·PEG·손익률만 사용.
- 손실 종목을 '단순 고평가'만으로 손절 강요 금지(보류 종목은 "저점 매도 금물"로 안내).
- 손실 회피 심리를 헤아려라: 익절은 축하의 톤, 손절은 "기회비용·전략적 후퇴"로 위로하되 강요 아닌 '고려' 권유.
- 본전까지 필요 상승률은 확정된 수학이니 그대로 활용해 설득하라(예: "−15%면 본전까지 +17.6%가 필요한데 회복 동력이 없다").
- 마지막에 "교육용 시뮬레이션이며 투자 추천이 아닙니다"를 반드시 덧붙여라.

[출력] 3~5문장의 한국어 코칭 1단락. JSON {"narrative": "..."} 형식만.`

  const r = await callGeminiJSON<{ narrative: string }>(prompt, {
    type: 'OBJECT', properties: { narrative: { type: 'STRING' } }, required: ['narrative'],
  }, { temperature: 0.5 })

  if (r.ok && r.data.narrative) return r.data.narrative
  // 폴백(결정론적)
  const cut = holdings.filter(h => h.action === 'CUT_LOSS').length
  const tp = holdings.filter(h => h.action === 'TAKE_PROFIT').length
  return `현재 포트폴리오에서 익절 대상 ${tp}종목, 손절 검토 ${cut}종목이 포착됐습니다. 회수 가능한 ${sellBudget}%를 AI 추천 저평가 종목으로 재배분하면 분산이 개선됩니다. 손실 종목 중 단순 고평가뿐인 종목은 저점 매도를 피하고 보유를 권합니다. ※ 교육용 시뮬레이션이며 투자 추천이 아닙니다.`
}
