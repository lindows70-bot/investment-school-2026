// 🌟 모닝스타식 스타 등급 — 보유 종목별 공정가치(DCF)·해자·불확실성·자본배분을 한 별점으로(운용 본부 진단)
// 신규 계산 0: stock-info(DCF입력)+getMoatBreach(해자)+stock-price(현재가) 재사용. 모닝스타 방법론 재현(교육용)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getMoatBreach } from '@/app/actions/getMoatBreach'
import { calcDCF, deriveDcfInputs } from '@/lib/buffettDcf'
import { computeStarRating, type StarResult } from '@/lib/morningstarRating'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const USD_KRW = 1350

export interface RatingEntry extends StarResult {
  ticker: string; name: string; market: 'KR' | 'US'; currency: 'USD' | 'KRW'
  fairValue: number | null    // 주당 내재가치(원시 통화)
  currentPrice: number | null
  weight: number              // 원가 기준 포트 비중 %
  dcfOk: boolean              // DCF 계산 가능 여부(적자·현금흐름 음수면 false → 별점 보류)
}
export interface MorningstarResult {
  entries: RatingEntry[]
  total: number
  avgStars: number | null
  asOf: string
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `morningstar-rating-v3:${user.id}:${kstDate()}:${fp}`   // v3: 기저효과 기준 isPegBaseEffect 통일(peg<0.3 AND g>100%)
  const cached = await getCache<MorningstarResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency,lynch_category').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') === 'STOCK')
  if (!stocks.length) return NextResponse.json({ entries: [], total: 0, avgStars: null, asOf: new Date().toISOString() })

  // 원가 기준 비중(통화 정규화)
  const costKrw = (s: typeof stocks[number]) => (s.purchase_price ?? 0) * (s.quantity ?? 0) * (s.currency === 'USD' ? USD_KRW : 1)
  const totalCost = stocks.reduce((sum, s) => sum + costKrw(s), 0) || 1
  const weightOf = (s: typeof stocks[number]) => Math.round((costKrw(s) / totalCost) * 1000) / 10

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  // 현재가 일괄 조회(배치 1회)
  const priceMap = new Map<string, number>()
  try {
    const pr = await fetch(`${selfBase}/api/stock-price`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stocks.map(s => ({ ticker: s.ticker, market: s.market === 'KR' ? 'KR' : 'US' }))),
      signal: AbortSignal.timeout(40_000),
    })
    if (pr.ok) {
      const arr = await pr.json() as { ticker: string; currentPrice: number }[]
      for (const p of arr) if (p?.currentPrice > 0) priceMap.set(p.ticker.toUpperCase(), p.currentPrice)
    }
  } catch { /* graceful — 현재가 없으면 별점 보류 */ }

  const entries: RatingEntry[] = []
  for (let i = 0; i < stocks.length; i += 4) {
    const batch = stocks.slice(i, i + 4)
    const rs = await Promise.all(batch.map(async s => {
      const market = (s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
      const name = s.name ?? s.ticker
      try {
        const [siRes, moat] = await Promise.all([
          fetch(`${selfBase}/api/stock-info?ticker=${encodeURIComponent(s.ticker)}&market=${market}`, { signal: AbortSignal.timeout(20_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
          getMoatBreach({ ticker: s.ticker, name, market }).catch(() => null),
        ])
        const fund = siRes?.fundamentals ?? {}
        const currentPrice = priceMap.get(s.ticker.toUpperCase()) ?? null
        const currency: 'USD' | 'KRW' = market === 'KR' ? 'KRW' : 'USD'

        // DCF 내재가치(SSOT 공유 계산)
        let fairValue: number | null = null, pFv: number | null = null, dcfOk = false
        if (currentPrice && currentPrice > 0) {
          const inp = deriveDcfInputs(fund, { market, currency, lynchCategory: s.lynch_category, currentPrice })
          if (inp.ok && inp.fcf0 && inp.shares) {
            const dcf = calcDCF(inp.fcf0, inp.g, inp.r, inp.gp, inp.netDebt, inp.shares, currentPrice)
            if (dcf.intrinsicPerShare > 0) { fairValue = dcf.intrinsicPerShare; pFv = currentPrice / fairValue; dcfOk = true }
          }
        }

        const moatWidth = moat?.moatWidth ?? 'none'
        const moatVerdict = moat?.verdict ?? 'early'
        const opMargin = typeof fund.operatingMargins === 'number' ? fund.operatingMargins : null
        const roe = typeof fund.returnOnEquity === 'number' ? fund.returnOnEquity
          : (typeof moat?.roe === 'number' ? moat.roe / 100 : null)
        const netDebtPos = (fund.totalDebt != null && fund.totalCash != null) ? (fund.totalDebt - fund.totalCash) > 0 : null
        // 성장률을 소수로 정규화(Yahoo는 0.18=18%, 일부는 18=18%로 옴) → 기저효과(>100%) 판정용
        const egRaw = typeof fund.earningsGrowth === 'number' ? fund.earningsGrowth : null
        const growth = egRaw == null ? null : (Math.abs(egRaw) < 5 ? egRaw : egRaw / 100)
        const pegN = typeof fund.peg === 'number' && isFinite(fund.peg) ? fund.peg : null

        const star = computeStarRating({ pFv, moatWidth, moatVerdict, opMargin, roe, netDebtPos, category: s.lynch_category ?? 'na', growth, peg: pegN })
        const e: RatingEntry = {
          ...star, ticker: s.ticker.toUpperCase(), name, market, currency,
          fairValue: fairValue != null ? +fairValue.toFixed(2) : null,
          currentPrice, weight: weightOf(s), dcfOk,
        }
        return e
      } catch { return null }
    }))
    for (const r of rs) if (r) entries.push(r)
  }

  // 별점 높은 순(저평가=매력) → DCF 보류는 뒤로
  entries.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || b.weight - a.weight)
  const rated = entries.filter(e => e.stars != null)
  const avgStars = rated.length ? +(rated.reduce((s, e) => s + (e.stars ?? 0), 0) / rated.length).toFixed(1) : null

  const result: MorningstarResult = { entries, total: entries.length, avgStars, asOf: new Date().toISOString() }
  if (entries.length) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
