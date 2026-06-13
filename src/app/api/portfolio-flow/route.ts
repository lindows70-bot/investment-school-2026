// 포트폴리오 수급 레이더 — 내 보유종목 수급(getMoneyFlow)+펀더멘탈(PEG) 집계. 신규 수집 0, 전부 재사용
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getMoneyFlow, type FlowStatus, type MoneyFlowResult } from '@/lib/moneyFlow'
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
  weight:   number          // 포트폴리오 비중 %(원가 기준 — 히트맵용)
  momentum: number          // 수급 모멘텀 0~100(유입에 얼마나 근접 — '우선순위 임박' 판정용)
  flowText: string          // 한 줄 수급 요약(KR=주체 방향 / US=MFI·내부자·거인)
}

export interface PortfolioFlowResult {
  entries:        FlowEntry[]
  total:          number
  inflowCount:    number     // 수급 유입 종목 수
  crowdedCount:   number     // 이탈·과열 종목 수
  smartMoneyRate: number     // 유입 비율 % (종목 수 기준)
  headline:       string     // 결정론적 앵커 브리핑(AI 미사용)
  history:        { date: string; rate: number }[]   // 동행지수 일별 추이(스파크라인용·누적)
  asOf:           string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const dirArrow = (d?: string) => (d === 'BUY' ? '▲' : d === 'SELL' ? '▼' : '─')
const USD_KRW = 1350
const dnm = (e: { market: string; name: string; ticker: string }) => (e.market === 'KR' ? (e.name || e.ticker).slice(0, 10) : e.ticker.toUpperCase())

// 결정론적 앵커 브리핑 — 집계만으로 한 줄 조립(AI 미사용 → Zero Cost·무환각)
function buildHeadline(entries: FlowEntry[], rate: number): string {
  if (!entries.length) return ''
  const byQ = (q: Quadrant) => entries.filter(e => e.quadrant === q).sort((a, b) => b.weight - a.weight)
  const top = (list: FlowEntry[], n = 2) => list.slice(0, n).map(dnm).join('·')
  const leaders = byQ('LEADER'), pearls = byQ('PEARL'), crowded = byQ('CROWDED')
  const parts: string[] = []
  if (rate >= 50) parts.push(`내 종목 ${rate}%에 스마트머니가 유입되는 강한 수급 국면입니다`)
  else if (leaders.length) parts.push(`${top(leaders)} 등 ${leaders.length}종목이 저평가+수급 유입으로 매수 우선순위입니다`)
  else if (pearls.length) parts.push(`${top(pearls)} 등 저평가 대기 ${pearls.length}종목은 체력은 단단하나 수급이 아직 잠잠합니다`)
  else parts.push('뚜렷한 수급 유입 종목이 적어 관망이 우선인 국면입니다')
  if (crowded.length) parts.push(`다만 ${top(crowded)}은(는) 고평가에 수급이 과열되어 추격 매수를 자제하세요`)
  return parts.join('. ') + '.'
}

// 수급 모멘텀 0~100 — 유입(INFLOW)에 얼마나 근접한가. PEARL 중 '곧 1순위 될 후보' 선별용
function momentumOf(mf: MoneyFlowResult, market: 'KR' | 'US'): number {
  if (market === 'KR') {
    let m = 0
    if (mf.foreign?.dir === 'BUY') m += 40       // 외국인 매수 전환
    if (mf.organ?.dir === 'BUY') m += 40         // 기관 매수 전환
    if (mf.individual?.dir === 'SELL') m += 20   // 개인 이탈(메이저가 받는 중)
    return m
  }
  const u = mf.us
  let m = 0
  if (u?.mfiTrend === 'rising') m += 35                                  // 자금흐름 상승 전환
  if (u && u.mfi != null && u.mfi >= 40 && u.mfi <= 72) m += 20          // 과매도 탈출~과열 전 구간
  if ((u?.insiderBuyers ?? 0) > 0) m += 35                              // 내부자 매수
  if (u?.giantTrend === 'add') m += 30                                  // 13F 거인 매집(스마트머니)
  else if ((u?.giantHolders ?? 0) > 0) m += 15                          // 13F 거인 보유
  return Math.min(100, m)
}

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
  const cacheKey = `portfolio-flow-v6:${user.id}:${kstDate()}:${fp}`   // v6: 동행지수=유입+임박(거인 momentum 반영)
  const cached = await getCache<PortfolioFlowResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') === 'STOCK')
  if (!stocks.length) {
    return NextResponse.json({ entries: [], total: 0, inflowCount: 0, crowdedCount: 0, smartMoneyRate: 0, headline: '', history: [], asOf: new Date().toISOString() })
  }

  // 원가 기준 비중(히트맵용) — 통화 정규화(USD→KRW), 추가 fetch 0
  const costKrw = (s: typeof stocks[number]) => (s.purchase_price ?? 0) * (s.quantity ?? 0) * (s.currency === 'USD' ? USD_KRW : 1)
  const totalCost = stocks.reduce((sum, s) => sum + costKrw(s), 0) || 1
  const weightOf = (s: typeof stocks[number]) => Math.round((costKrw(s) / totalCost) * 1000) / 10

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
          quadrant: quadrantOf(mf.status, cf.peg, cf.opMargin), weight: weightOf(s),
          momentum: momentumOf(mf, market), flowText,
        }
        return e
      } catch { return null }
    }))
    for (const r of rs) if (r) entries.push(r)
  }

  const total = entries.length
  // 동행지수 = 확정 유입(INFLOW) + 수급이 살아나는 임박(momentum≥40). US는 INFLOW가 내부자 전용이라
  // 13F 거인·MFI 같은 실제 스마트머니 신호를 momentum으로 함께 반영(게이지가 0에 고착되던 문제 해결)
  const inflowCount = entries.filter(e => e.status === 'INFLOW' || e.momentum >= 40).length
  const crowdedCount = entries.filter(e => e.status === 'CROWDED').length
  const smartMoneyRate = total ? Math.round((inflowCount / total) * 100) : 0

  // 동행지수 일별 추이 누적(스파크라인) — 오늘 값 upsert, 최근 14일 유지(영구 키, 60일 TTL)
  const today = kstDate()
  const histKey = `portfolio-flow-hist:${user.id}`
  const prevHist = (await getCache<{ date: string; rate: number }[]>(histKey, 60 * 86400_000)) ?? []
  const history = [...prevHist.filter(h => h.date !== today), { date: today, rate: smartMoneyRate }].slice(-14)
  await setCache(histKey, history)

  const result: PortfolioFlowResult = {
    entries, total, inflowCount, crowdedCount, smartMoneyRate,
    headline: buildHeadline(entries, smartMoneyRate), history,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
