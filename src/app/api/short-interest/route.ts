// 📉 공매도 잔고 레이더(미국) — 보유 US 종목의 공매도 잔고·커버일수·유통주식 비중(Yahoo 실데이터).
// ⚠️ KR 공매도는 무료·무키 소스 부재 확인(네이버 탭 폐지·KRX/공매도포털 게이트) → US만 정직 제공, KR은 교육 안내.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export interface ShortEntry {
  ticker: string; name: string
  sharesShort: number            // 공매도 잔고(주)
  priorMonth: number | null      // 전월 잔고(주)
  momChgPct: number | null       // 전월 대비 %
  shortRatio: number | null      // 커버일수(잔고÷일평균거래량, days to cover)
  pctFloat: number | null        // 유통주식 대비 %
  asOfDate: string | null        // 공시 기준일
  signal: 'heavy' | 'rising' | 'squeeze' | 'calm'   // 과다/증가/스퀴즈 잠재/평온
}
export interface ShortInterestResult { entries: ShortEntry[]; asOf: string }

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// yahoo-finance2가 원시 숫자(주식수)를 epoch로 오해해 Date로 변환하는 필드 복원(getTime/1000 = 원값)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawNum = (v: any): number | null => (v instanceof Date ? Math.round(v.getTime() / 1000) : typeof v === 'number' && isFinite(v) ? v : null)

async function fetchShort(ticker: string): Promise<Omit<ShortEntry, 'name' | 'signal'> | null> {
  const key = `short-int-v1:${ticker}:${kstDate()}`
  const cached = await getCache<Omit<ShortEntry, 'name' | 'signal'>>(key, 24 * 3600_000)
  if (cached) return cached
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const r = await yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] })
    const k = r?.defaultKeyStatistics
    const sharesShort = rawNum(k?.sharesShort)
    if (!sharesShort) return null
    const priorMonth = rawNum(k?.sharesShortPriorMonth)
    const out = {
      ticker,
      sharesShort,
      priorMonth,
      momChgPct: priorMonth ? Math.round(((sharesShort - priorMonth) / priorMonth) * 1000) / 10 : null,
      shortRatio: rawNum(k?.shortRatio),
      pctFloat: k?.shortPercentOfFloat != null ? Math.round(k.shortPercentOfFloat * 1000) / 10 : null,
      asOfDate: k?.dateShortInterest instanceof Date ? k.dateShortInterest.toISOString().slice(0, 10) : null,
    }
    await setCache(key, out)
    return out
  } catch { return null }
}

// 신호 판정(결정론): 과다=유통주식 10%+ / 스퀴즈 잠재=유통 5%+ & 커버 5일+ / 증가=전월비 +15%+ / 평온
function judge(e: Omit<ShortEntry, 'name' | 'signal'>): ShortEntry['signal'] {
  if ((e.pctFloat ?? 0) >= 10) return 'heavy'
  if ((e.pctFloat ?? 0) >= 5 && (e.shortRatio ?? 0) >= 5) return 'squeeze'
  if ((e.momChgPct ?? 0) >= 15) return 'rising'
  return 'calm'
}

export async function GET() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `short-interest-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<ShortInterestResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)

  // US 개별주식만(공매도 공시는 미국 FINRA 격주 — Yahoo 반영)
  const us = new Map<string, string>()
  for (const r of rows ?? []) {
    if ((r.market ?? '').toUpperCase() === 'KR') continue
    if (getAssetType(r.ticker, r.name, r.market) !== 'STOCK') continue
    if (!us.has(r.ticker)) us.set(r.ticker, r.name ?? r.ticker)
  }

  const entries: ShortEntry[] = []
  const tickers = Array.from(us.keys())
  for (let i = 0; i < tickers.length; i += 5) {
    const batch = await Promise.all(tickers.slice(i, i + 5).map(async t => {
      const d = await fetchShort(t)
      return d ? { ...d, name: us.get(t)!, signal: judge(d) } : null
    }))
    batch.forEach(b => { if (b) entries.push(b) })
  }
  entries.sort((a, b) => (b.pctFloat ?? 0) - (a.pctFloat ?? 0))

  const result: ShortInterestResult = { entries, asOf: new Date().toISOString() }
  if (entries.length || tickers.length === 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
