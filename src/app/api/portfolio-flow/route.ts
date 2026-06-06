// 포트폴리오 수급 레이더 — 내 보유종목 수급(getMoneyFlow)+펀더멘탈(PEG) 집계. 신규 수집 0, 전부 재사용
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getMoneyFlow, type FlowStatus } from '@/lib/moneyFlow'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// 펀더멘탈(저PEG·흑자) × 수급(유입/이탈) 4분면
export type Quadrant = 'LEADER' | 'PEARL' | 'CROWDED' | 'REVIEW'

export interface FlowEntry {
  ticker:   string
  name:     string
  market:   'KR' | 'US'
  status:   FlowStatus
  peg:      number | null
  opMargin: number | null
  quadrant: Quadrant
  flowText: string          // 한 줄 수급 요약(KR=주체 방향 / US=MFI·내부자·거인)
}

export interface PortfolioFlowResult {
  entries:        FlowEntry[]
  total:          number
  inflowCount:    number     // 수급 유입 종목 수
  crowdedCount:   number     // 이탈·과열 종목 수
  smartMoneyRate: number     // 유입 비율 % (종목 수 기준)
  asOf:           string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const dirArrow = (d?: string) => (d === 'BUY' ? '▲' : d === 'SELL' ? '▼' : '─')

function quadrantOf(status: FlowStatus, peg: number | null, opMargin: number | null): Quadrant {
  const fundGood = peg != null && peg > 0 && peg < 1.2 && (opMargin == null || opMargin > -10)
  if (fundGood && status === 'INFLOW') return 'LEADER'   // 저평가 + 수급 유입
  if (fundGood) return 'PEARL'                            // 저평가 + 수급 잠잠(대기)
  if (status === 'INFLOW' || status === 'CROWDED') return 'CROWDED'  // 고평가 + 수급 몰림/이탈 = 과열·상투
  return 'REVIEW'                                         // 고평가 + 수급 약함
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `portfolio-flow-v2:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<PortfolioFlowResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') === 'STOCK')
  if (!stocks.length) {
    return NextResponse.json({ entries: [], total: 0, inflowCount: 0, crowdedCount: 0, smartMoneyRate: 0, asOf: new Date().toISOString() })
  }

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const entries: FlowEntry[] = []
  // 동시성 5 — 수급·펀더멘탈 모두 종목별 캐시라 콜드만 비용 발생
  for (let i = 0; i < stocks.length; i += 5) {
    const batch = stocks.slice(i, i + 5)
    const rs = await Promise.all(batch.map(async s => {
      const market = (s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
      const name = s.name ?? s.ticker
      try {
        const [mf, cf] = await Promise.all([
          getMoneyFlow(s.ticker, market, name, selfBase),
          getCanonicalFundamentals(s.ticker, market, selfBase),
        ])
        const flowText = market === 'KR'
          ? `외인${dirArrow(mf.foreign?.dir)} 기관${dirArrow(mf.organ?.dir)} 개인${dirArrow(mf.individual?.dir)}`
          : `MFI ${mf.us?.mfi ?? '—'}${(mf.us?.insiderBuyers ?? 0) > 0 ? ` · 내부자 ${mf.us!.insiderBuyers}` : ''}${(mf.us?.giantHolders ?? 0) > 0 ? ` · 거인 ${mf.us!.giantHolders}` : ''}`
        const e: FlowEntry = {
          ticker: s.ticker, name, market, status: mf.status, peg: cf.peg, opMargin: cf.opMargin,
          quadrant: quadrantOf(mf.status, cf.peg, cf.opMargin), flowText,
        }
        return e
      } catch { return null }
    }))
    for (const r of rs) if (r) entries.push(r)
  }

  const total = entries.length
  const inflowCount = entries.filter(e => e.status === 'INFLOW').length
  const crowdedCount = entries.filter(e => e.status === 'CROWDED').length
  const result: PortfolioFlowResult = {
    entries, total, inflowCount, crowdedCount,
    smartMoneyRate: total ? Math.round((inflowCount / total) * 100) : 0,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
