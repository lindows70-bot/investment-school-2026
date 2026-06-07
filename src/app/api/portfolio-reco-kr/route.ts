// 🎯 린치×수급 융합 추천(국내) — 내 포폴 상태 × 시장 수급(market-flow-kr) 조인. 추가 수집 0
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { computeMarketFlowKr, type MarketFlowKrResult, type MarketFlowEntry } from '@/lib/marketFlowKr'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export interface RecoItem {
  ticker: string; name: string; sector: string
  peg: number | null; dualStreak: number
  foreign5: number; organ5: number   // 5일 누적 순매수(억)
  changePct: number | null
  reason: string
}
export interface PortfolioRecoResult {
  fillGap:     RecoItem[]   // 빈집 채우기(없는 섹터 + 메이저 매집)
  pearl:       RecoItem[]   // 진주 발굴(저PEG + 쌍끌이, 미보유)
  addMore:     RecoItem[]   // 보유 불타기(보유 + 수급 가속)
  heldSectors: string[]
  asOf:        string
}

const eok = (v: number) => Math.round(v / 1e8)
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const cheap = (e: MarketFlowEntry) => e.peg != null && e.peg > 0 && e.peg < 1.0
const flow5 = (e: MarketFlowEntry) => e.foreign.d5 + e.organ.d5

const toItem = (e: MarketFlowEntry, reason: string): RecoItem => ({
  ticker: e.ticker, name: e.name, sector: e.sector, peg: e.peg, dualStreak: e.dualStreak,
  foreign5: eok(e.foreign.d5), organ5: eok(e.organ.d5), changePct: e.changePct, reason,
})

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `portfolio-reco-kr-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<PortfolioRecoResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 시장 수급(market-flow-kr) — 캐시 우선
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  let mf = await getCache<MarketFlowKrResult>(`market-flow-kr-v3:${kstDate()}`, 24 * 3600_000)
  if (!mf) mf = await computeMarketFlowKr(base)
  const entries = mf.entries

  // 내 보유 국내 개별주식
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const heldCodes = new Set(
    (rows ?? []).filter(r => (r.market === 'KR') && getAssetType(r.ticker, r.name ?? '', 'KR') === 'STOCK')
      .map(r => (r.ticker.match(/\d{6}/)?.[0] ?? '')).filter(Boolean),
  )
  const byCode = new Map(entries.map(e => [e.ticker, e]))
  const heldSectorsSet = new Set<string>()
  Array.from(heldCodes).forEach(c => { const e = byCode.get(c); if (e) heldSectorsSet.add(e.sector) })
  const heldSectors = heldSectorsSet   // alias for readability

  // ① 빈집 채우기: 미보유 + 보유 섹터에 없는 섹터 + 메이저 매집(쌍끌이 or 외인·기관 5일 동반매수)
  const fillGap = entries
    .filter(e => !heldCodes.has(e.ticker) && !heldSectors.has(e.sector) && (e.dualStreak >= 2 || (e.foreign.d5 > 0 && e.organ.d5 > 0)))
    .sort((a, b) => (flow5(b) + (cheap(b) ? 5e11 : 0)) - (flow5(a) + (cheap(a) ? 5e11 : 0)))
    .slice(0, 3)
    .map(e => toItem(e, `내 포폴에 없는 '${e.sector}' 섹터 — 외국인·기관이 ${e.dualStreak >= 2 ? `${e.dualStreak}일 연속 쌍끌이` : '5일 동반 순매수'} 중${cheap(e) ? ` (저PEG ${e.peg!.toFixed(2)})` : ''}. 위성 후보로 섹터 보강 검토.`))

  // ② 진주 발굴: 미보유 + 저PEG(<1.0) + 쌍끌이(2일+)
  const pearl = entries
    .filter(e => !heldCodes.has(e.ticker) && cheap(e) && e.dualStreak >= 2)
    .sort((a, b) => b.dualStreak - a.dualStreak || flow5(b) - flow5(a))
    .slice(0, 3)
    .map(e => toItem(e, `저PEG ${e.peg!.toFixed(2)} + 외국인·기관 ${e.dualStreak}일 연속 쌍끌이 — 수급 가속 붙은 저평가 진주. 신규 편입 후보.`))

  // ③ 보유 불타기: 보유(유니버스) + 수급 가속(쌍끌이 또는 외인 1일·5일 모두 순매수)
  const addMore = entries
    .filter(e => heldCodes.has(e.ticker) && (e.dualStreak >= 2 || (e.foreign.d1 > 0 && e.foreign.d5 > 0)))
    .sort((a, b) => flow5(b) - flow5(a))
    .slice(0, 3)
    .map(e => toItem(e, `보유 중 — ${e.dualStreak >= 2 ? `외국인·기관 ${e.dualStreak}일 연속 쌍끌이` : '외국인 1일·5일 모두 순매수'}로 수급 가속. 비중 확대(추가 매수) 검토 타이밍.`))

  const result: PortfolioRecoResult = { fillGap, pearl, addMore, heldSectors: Array.from(heldSectors), asOf: new Date().toISOString() }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
