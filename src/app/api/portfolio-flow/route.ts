// 포트폴리오 수급 레이더 — 내 보유종목 수급(getMoneyFlow)+펀더멘탈(PEG) 집계. 신규 수집 0, 전부 재사용
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getMoneyFlow, type FlowStatus, type MoneyFlowResult } from '@/lib/moneyFlow'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'
import { growthFromCli, inflationFromRegime, seasonOf, holdingFit, SEASON_META, type Quadrant as Season } from '@/lib/seasonNavigator'
import { fetchMacroData } from '@/lib/macroPhaseScreener'
import { classifyLynchMece } from '@/lib/lynchAnalysis'
import { isInflowNear } from '@/lib/flowShared'

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
  sector:   string | null   // GICS 섹터(계절 적합도용)
  seasonFit: number         // 🌦️ 현재 계절 적합도 0~100(섹터×린치 fit)
  seasonTag: 'favored' | 'neutral' | 'unfavored'   // 계절 유리/중립/불리
}

export interface SeasonBrief { quadrant: Season; seasonKo: string; icon: string; label: string; favored: string[] }

export interface PortfolioFlowResult {
  entries:        FlowEntry[]
  total:          number
  inflowCount:    number     // 수급 유입 종목 수
  crowdedCount:   number     // 이탈·과열 종목 수
  smartMoneyRate: number     // 유입 비율 % (종목 수 기준)
  headline:       string     // 결정론적 앵커 브리핑(AI 미사용)
  history:        { date: string; rate: number }[]   // 동행지수 일별 추이(스파크라인용·누적)
  season:         { us: SeasonBrief; kr: SeasonBrief } | null   // 🌦️ 현재 계절(US·KR)
  asOf:           string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const dirArrow = (d?: string) => (d === 'BUY' ? '▲' : d === 'SELL' ? '▼' : '─')
const USD_KRW = 1350
const dnm = (e: { market: string; name: string; ticker: string }) => (e.market === 'KR' ? (e.name || e.ticker).slice(0, 10) : e.ticker.toUpperCase())

// 받침 유무로 은/는 조사 선택(한글만 판정, 그 외 영문 티커는 '는'). "SK하이닉스은(는)" 노출 방지
const eunNeun = (word: string): string => {
  const ch = word.charCodeAt(word.length - 1)
  if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 !== 0 ? '은' : '는'
  return '는'
}

// 결정론적 앵커 브리핑 — 집계만으로 한 줄 조립(AI 미사용 → Zero Cost·무환각)
function buildHeadline(entries: FlowEntry[], rate: number): string {
  if (!entries.length) return ''
  const byQ = (q: Quadrant) => entries.filter(e => e.quadrant === q).sort((a, b) => b.weight - a.weight)
  const top = (list: FlowEntry[], n = 2) => list.slice(0, n).map(dnm).join('·')
  const leaders = byQ('LEADER')
  const inflowNear = entries.filter(isInflowNear).sort((a, b) => b.weight - a.weight)   // 유입·임박(헤더와 동일 기준)
  // 진짜 '대기(수급 잠잠)' = 저평가(PEARL) 중 유입·임박도 이탈·과열도 아닌 종목만(둘 다 '잠잠'이 아님)
  const pearlsCalm = byQ('PEARL').filter(e => !isInflowNear(e) && e.status !== 'CROWDED')
  const crowdedByStatus = entries.filter(e => e.status === 'CROWDED').sort((a, b) => b.weight - a.weight)   // 이탈·과열(status 기준)
  const parts: string[] = []
  if (rate >= 50) parts.push(`내 종목 ${rate}%에 스마트머니가 유입되는 강한 수급 국면입니다`)
  else if (leaders.length) parts.push(`${top(leaders)} 등 ${leaders.length}종목이 저평가+수급 유입으로 매수 우선순위입니다`)
  else if (inflowNear.length) parts.push(`${top(inflowNear)} 등 ${inflowNear.length}종목에 스마트머니가 유입·임박 중입니다`)
  else if (pearlsCalm.length) parts.push(`${top(pearlsCalm)} 등 저평가 대기 ${pearlsCalm.length}종목은 체력은 단단하나 수급이 아직 잠잠합니다`)
  else parts.push('뚜렷한 수급 유입 종목이 적어 관망이 우선인 국면입니다')
  if (crowdedByStatus.length) { const cw = top(crowdedByStatus); parts.push(`다만 ${cw}${eunNeun(cw)} 수급이 이탈·과열되어 추격·보유 점검이 필요합니다`) }
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
  const cacheKey = `portfolio-flow-v12:${user.id}:${kstDate()}:${fp}`   // v12: 브리핑 조사(은/는) 자동 처리
  const cached = await getCache<PortfolioFlowResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') === 'STOCK')
  if (!stocks.length) {
    return NextResponse.json({ entries: [], total: 0, inflowCount: 0, crowdedCount: 0, smartMoneyRate: 0, headline: '', history: [], season: null, asOf: new Date().toISOString() })
  }

  // 원가 기준 비중(히트맵용) — 통화 정규화(USD→KRW), 추가 fetch 0
  const costKrw = (s: typeof stocks[number]) => (s.purchase_price ?? 0) * (s.quantity ?? 0) * (s.currency === 'USD' ? USD_KRW : 1)
  const totalCost = stocks.reduce((sum, s) => sum + costKrw(s), 0) || 1
  const weightOf = (s: typeof stocks[number]) => Math.round((costKrw(s) / totalCost) * 1000) / 10

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  // 🌦️ 현재 계절(US·KR) — 통합추천과 동일 SSOT 경로 재사용(macro + OECD CLI). 전부 캐시라 비용 미미
  let usQuad: Season = 'shoulder', krQuad: Season = 'shoulder'
  try {
    let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold'
    try { const md = await fetchMacroData(selfBase); cpiYoY = typeof md.cpiYoY === 'number' ? md.cpiYoY : cpiYoY; rateDir = md.rateDir ?? 'hold' } catch { /* graceful */ }
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
    usQuad = seasonOf(growthFromCli(usCli?.cli ?? 100, usCli?.cliPrev ?? 100), inf)
    krQuad = seasonOf(growthFromCli(krCli?.cli ?? 100, krCli?.cliPrev ?? 100), inf)
  } catch { /* 계절 미상 → shoulder 폴백 */ }
  // 계절 적합도 0~100 — 섹터(영문 GICS) + 린치 분류(growth+섹터로 산출, 추가 fetch 0)를 holdingFit에 투입.
  //  린치를 넘겨야 fit이 전 구간을 쓰며 '불리'까지 도달(이전 stalwart 폴백은 최저 55라 불리 미도달)
  const seasonFitOf = (market: 'KR' | 'US', sector: string | null, growth: number | null): number => {
    const { cat } = classifyLynchMece(null, growth, sector)
    const lc = cat === 'na' ? null : cat
    return Math.round(holdingFit({ ticker: '', weight: 0, lynchCategory: lc, sector: sector ?? undefined }, market === 'KR' ? krQuad : usQuad) * 100)
  }

  // 영문 GICS 섹터(계절 우대 매칭용) — SSOT cf.sector는 한국어 세분류라 영문 GICS와 안 맞음.
  //  통합추천과 동일하게 yahoo-finance2 assetProfile.sector('Energy'·'Industrials'…) 사용. 종목별 30일 캐시
  const gicsSector = async (ticker: string, market: 'KR' | 'US'): Promise<string | null> => {
    const num = ticker.replace(/\D/g, '')
    const primary = market === 'KR' ? `${num}.KS` : ticker.toUpperCase()
    const key = `gics-sector:${primary}`
    const cached = await getCache<{ s: string | null }>(key, 30 * 86400_000)
    if (cached) return cached.s
    try {
      const { default: YF } = await import('yahoo-finance2')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
      let s: string | null = (await yf.quoteSummary(primary, { modules: ['assetProfile'] }))?.assetProfile?.sector ?? null
      if (!s && market === 'KR') s = (await yf.quoteSummary(`${num}.KQ`, { modules: ['assetProfile'] }))?.assetProfile?.sector ?? null
      await setCache(key, { s })
      return s
    } catch { return null }
  }

  const entries: FlowEntry[] = []
  // 동시성 5 — 수급·펀더멘탈 모두 종목별 캐시라 콜드만 비용 발생
  for (let i = 0; i < stocks.length; i += 5) {
    const batch = stocks.slice(i, i + 5)
    const rs = await Promise.all(batch.map(async s => {
      const market = (s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
      const name = s.name ?? s.ticker
      try {
        const [mf, cf, gics] = await Promise.all([
          getMoneyFlow(s.ticker, market, name, selfBase),
          getCanonicalFundamentals(s.ticker, market, selfBase),
          gicsSector(s.ticker, market),
        ])
        const flowText = market === 'KR'
          ? `외인${dirArrow(mf.foreign?.dir)} 기관${dirArrow(mf.organ?.dir)} 개인${dirArrow(mf.individual?.dir)}`
          : `MFI ${mf.us?.mfi ?? '—'}${(mf.us?.insiderBuyers ?? 0) > 0 ? ` · 내부자 ${mf.us!.insiderBuyers}` : ''}${(mf.us?.giantHolders ?? 0) > 0 ? ` · 거인 ${mf.us!.giantHolders}` : ''}`
        const seasonFit = seasonFitOf(market, gics, cf.growth)
        const e: FlowEntry = {
          ticker: s.ticker, name, market, status: mf.status, peg: cf.peg, opMargin: cf.opMargin,
          quadrant: quadrantOf(mf.status, cf.peg, cf.opMargin), weight: weightOf(s),
          momentum: momentumOf(mf, market), flowText,
          sector: gics, seasonFit,
          seasonTag: seasonFit >= 75 ? 'favored' : seasonFit <= 50 ? 'unfavored' : 'neutral',
        }
        return e
      } catch { return null }
    }))
    for (const r of rs) if (r) entries.push(r)
  }

  const total = entries.length
  // 동행지수 = 확정 유입(INFLOW) + 수급이 살아나는 임박(momentum≥40). US는 INFLOW가 내부자 전용이라
  // 13F 거인·MFI 같은 실제 스마트머니 신호를 momentum으로 함께 반영(게이지가 0에 고착되던 문제 해결)
  const inflowCount = entries.filter(isInflowNear).length
  const crowdedCount = entries.filter(e => e.status === 'CROWDED').length
  const smartMoneyRate = total ? Math.round((inflowCount / total) * 100) : 0

  // 동행지수 일별 추이 누적(스파크라인) — 오늘 값 upsert, 최근 14일 유지(영구 키, 60일 TTL)
  const today = kstDate()
  const histKey = `portfolio-flow-hist:${user.id}`
  const prevHist = (await getCache<{ date: string; rate: number }[]>(histKey, 60 * 86400_000)) ?? []
  const history = [...prevHist.filter(h => h.date !== today), { date: today, rate: smartMoneyRate }].slice(-14)
  await setCache(histKey, history)

  const brief = (q: Season): SeasonBrief => ({ quadrant: q, seasonKo: SEASON_META[q].seasonKo, icon: SEASON_META[q].icon, label: SEASON_META[q].label, favored: SEASON_META[q].favored })
  const result: PortfolioFlowResult = {
    entries, total, inflowCount, crowdedCount, smartMoneyRate,
    headline: buildHeadline(entries, smartMoneyRate), history,
    season: { us: brief(usQuad), kr: brief(krQuad) },
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
