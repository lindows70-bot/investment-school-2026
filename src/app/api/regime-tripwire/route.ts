// 🔔 국면 전환 트립와이어 — 매크로 계절/금리가 '뒤집힐 때' 내 포트의 어떤 종목이 유↔불리로 바뀌는지 능동 경고
//  FOMC→계절→내 포트 닫힌 루프. 전역 국면 이력을 캐시에 저장해 전환 감지, 보유종목은 이전/현재 quad로 각각 채점.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'
import { getCurrentSeason } from '@/lib/currentSeason'
import { holdingFit, SEASON_META, type Quadrant } from '@/lib/seasonNavigator'
import { classifyLynchMece } from '@/lib/lynchAnalysis'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

type Tag = 'favored' | 'neutral' | 'unfavored'
export interface RegimeFlip {
  ticker: string; name: string; market: 'KR' | 'US'
  from: Tag; to: Tag
  direction: 'up' | 'down'   // up=유리해짐, down=불리해짐
}
export interface RegimeTransition {
  from: { us: Quadrant; kr: Quadrant }
  to: { us: Quadrant; kr: Quadrant }
  date: string               // 전환 감지일
  daysSince: number
}
export interface RegimeTripwireResult {
  usQuad: Quadrant; krQuad: Quadrant
  usSeasonKo: string; krSeasonKo: string
  stableDays: number          // 현재 국면 유지 일수
  transition: RegimeTransition | null   // 최근 전환(없으면 안정)
  flips: RegimeFlip[]         // 전환으로 유↔불리 바뀐 보유종목
  favoredNow: number; unfavoredNow: number
  favoredList: { ticker: string; name: string; market: 'KR' | 'US' }[]    // 현재 계절 유리 보유종목
  unfavoredList: { ticker: string; name: string; market: 'KR' | 'US' }[]  // 현재 계절 불리 보유종목
  nextFomc: string | null
  asOf: string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const tagOf = (fit: number): Tag => fit >= 75 ? 'favored' : fit <= 50 ? 'unfavored' : 'neutral'

// 영문 GICS 섹터 — 30일 캐시(portfolio-flow와 동일 소스)
async function gicsSector(ticker: string, market: 'KR' | 'US'): Promise<string | null> {
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
    await setCache(key, { s }); return s
  } catch { return null }
}

interface RegimePoint { date: string; usQuad: Quadrant; krQuad: Quadrant; rateDir: string }

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  const cur = await getCurrentSeason(base)
  const today = kstDate()

  // 전역 국면 이력 — quad/rateDir 변화 시에만 push(전환 시점 보존)
  const histKey = 'regime-history-v1'
  const hist = (await getCache<RegimePoint[]>(histKey, 400 * 86400_000)) ?? []
  const last = hist[hist.length - 1]
  const changed = !last || last.usQuad !== cur.usQuad || last.krQuad !== cur.krQuad || last.rateDir !== cur.rateDir
  if (changed) { hist.push({ date: today, usQuad: cur.usQuad, krQuad: cur.krQuad, rateDir: cur.rateDir }); await setCache(histKey, hist.slice(-40)) }

  // 최근 전환: 계절 quadrant가 실제로 바뀐 마지막 지점(rateDir만 바뀐 건 전환에서 제외 — 계절 중심)
  let transition: RegimeTransition | null = null
  const seasonChanges = hist.filter((p, i) => i === 0 || p.usQuad !== hist[i - 1].usQuad || p.krQuad !== hist[i - 1].krQuad)
  if (seasonChanges.length >= 2) {
    const to = seasonChanges[seasonChanges.length - 1], from = seasonChanges[seasonChanges.length - 2]
    transition = {
      from: { us: from.usQuad, kr: from.krQuad }, to: { us: to.usQuad, kr: to.krQuad },
      date: to.date, daysSince: Math.round((new Date(today).getTime() - new Date(to.date).getTime()) / 86400_000),
    }
  }
  const curSeasonPoint = seasonChanges[seasonChanges.length - 1]
  const stableDays = curSeasonPoint ? Math.round((new Date(today).getTime() - new Date(curSeasonPoint.date).getTime()) / 86400_000) : 0

  // 보유종목 — 이전 quad vs 현재 quad로 각각 채점해 flip 감지
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') === 'STOCK')

  const flips: RegimeFlip[] = []
  const favoredList: { ticker: string; name: string; market: 'KR' | 'US' }[] = []
  const unfavoredList: { ticker: string; name: string; market: 'KR' | 'US' }[] = []
  let favoredNow = 0, unfavoredNow = 0
  for (let i = 0; i < stocks.length; i += 5) {
    const batch = stocks.slice(i, i + 5)
    const res = await Promise.all(batch.map(async s => {
      const market = (s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
      const [cf, gics] = await Promise.all([getCanonicalFundamentals(s.ticker, market, base).catch(() => null), gicsSector(s.ticker, market).catch(() => null)])
      const lynchCat = classifyLynchMece(null, cf?.growth ?? null, gics).cat
      const lc = lynchCat === 'na' ? null : lynchCat
      const fit = (q: Quadrant) => tagOf(Math.round(holdingFit({ ticker: '', weight: 0, lynchCategory: lc, sector: gics ?? undefined }, q) * 100))
      const newQuad = market === 'KR' ? cur.krQuad : cur.usQuad
      const toTag = fit(newQuad)
      let flip: RegimeFlip | null = null
      if (transition) {
        const prevQuad = market === 'KR' ? transition.from.kr : transition.from.us
        const fromTag = fit(prevQuad)
        if (fromTag !== toTag && (fromTag === 'favored' || toTag === 'favored' || fromTag === 'unfavored' || toTag === 'unfavored')) {
          const rank = (t: Tag) => t === 'favored' ? 2 : t === 'neutral' ? 1 : 0
          flip = { ticker: s.ticker, name: s.name ?? s.ticker, market, from: fromTag, to: toTag, direction: rank(toTag) > rank(fromTag) ? 'up' : 'down' }
        }
      }
      return { ticker: s.ticker, name: s.name ?? s.ticker, market, toTag, flip }
    }))
    for (const r of res) {
      if (r.toTag === 'favored') { favoredNow++; favoredList.push({ ticker: r.ticker, name: r.name, market: r.market }) }
      else if (r.toTag === 'unfavored') { unfavoredNow++; unfavoredList.push({ ticker: r.ticker, name: r.name, market: r.market }) }
      if (r.flip) flips.push(r.flip)
    }
  }
  // 불리해진 것 먼저(경고 우선)
  flips.sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'down' ? -1 : 1))

  const nextFomc = FOMC_SCHEDULE.filter(m => m.date > today)[0]?.date ?? null

  const result: RegimeTripwireResult = {
    usQuad: cur.usQuad, krQuad: cur.krQuad,
    usSeasonKo: SEASON_META[cur.usQuad].seasonKo, krSeasonKo: SEASON_META[cur.krQuad].seasonKo,
    stableDays, transition, flips, favoredNow, unfavoredNow, favoredList, unfavoredList, nextFomc,
    asOf: new Date().toISOString(),
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
