// 🌍 글로벌 시총 Top 10 — KR(네이버 marketValue) + US(yahoo-finance2). ETF 차단, 12h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export interface TopEntry {
  rank:       number
  ticker:     string
  name:       string
  market:     'KR' | 'US'
  marketCapKrw: number      // 원화 시총(원)
  marketCapUsd: number | null  // 달러 시총(달러, US만)
  changePct:  number | null  // 당일 등락률 %
  lynchLabel: string         // 린치 분류 한글
  sector:     string
}
export interface GlobalTop10Result {
  kr: TopEntry[]
  us: TopEntry[]
  usdKrw: number
  asOf: string
}

const NAVER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 린치 분류 SSOT 매핑 (시총 상위 고정 종목 — DB 없어도 교육용으로 정확한 분류)
const LYNCH_KR: Record<string, { lynchLabel: string; sector: string }> = {
  '005930': { lynchLabel: '경기순환주', sector: '반도체' },
  '000660': { lynchLabel: '경기순환주', sector: '반도체' },
  '373220': { lynchLabel: '경기순환주', sector: '2차전지' },
  '005380': { lynchLabel: '경기순환주', sector: '자동차' },
  '000270': { lynchLabel: '경기순환주', sector: '자동차' },
  '207940': { lynchLabel: '빠른성장주', sector: '바이오' },
  '068270': { lynchLabel: '빠른성장주', sector: '바이오' },
  '105560': { lynchLabel: '경기순환주', sector: '금융/은행' },
  '055550': { lynchLabel: '경기순환주', sector: '금융/은행' },
  '035420': { lynchLabel: '빠른성장주', sector: '인터넷' },
  '005490': { lynchLabel: '경기순환주', sector: '철강' },
  '012450': { lynchLabel: '빠른성장주', sector: '방산/항공' },
  '009540': { lynchLabel: '경기순환주', sector: '조선' },
  '003550': { lynchLabel: '대형우량주', sector: '지주사' },
  '051910': { lynchLabel: '경기순환주', sector: '화학' },
}
const LYNCH_US: Record<string, { lynchLabel: string; sector: string }> = {
  'NVDA': { lynchLabel: '빠른성장주', sector: '반도체' },
  'AAPL': { lynchLabel: '대형우량주', sector: '소비자전자' },
  'MSFT': { lynchLabel: '대형우량주', sector: '소프트웨어' },
  'GOOGL': { lynchLabel: '빠른성장주', sector: '광고/AI' },
  'AMZN': { lynchLabel: '빠른성장주', sector: '커머스/클라우드' },
  'META': { lynchLabel: '빠른성장주', sector: '소셜미디어' },
  'AVGO': { lynchLabel: '빠른성장주', sector: '반도체' },
  'TSLA': { lynchLabel: '빠른성장주', sector: '전기차' },
  'BRK-B': { lynchLabel: '대형우량주', sector: '금융지주' },
  'JPM': { lynchLabel: '대형우량주', sector: '금융/은행' },
  'WMT': { lynchLabel: '대형우량주', sector: '유통' },
  'LLY': { lynchLabel: '빠른성장주', sector: '제약/비만치료' },
  'V': { lynchLabel: '대형우량주', sector: '결제네트워크' },
  'MA': { lynchLabel: '대형우량주', sector: '결제네트워크' },
  'XOM': { lynchLabel: '경기순환주', sector: '정유/에너지' },
  'COST': { lynchLabel: '대형우량주', sector: '유통' },
  'HD': { lynchLabel: '대형우량주', sector: '소매/인테리어' },
  'NFLX': { lynchLabel: '빠른성장주', sector: '스트리밍' },
  'ORCL': { lynchLabel: '대형우량주', sector: '소프트웨어' },
  'AMD': { lynchLabel: '빠른성장주', sector: '반도체' },
  'ASML': { lynchLabel: '빠른성장주', sector: '반도체장비' },
  'TSM': { lynchLabel: '경기순환주', sector: '반도체 파운드리' },
  'SPCX': { lynchLabel: '빠른성장주', sector: '우주항공/위성' },   // SpaceX — 2026 상장, 시총 $2T+ 진입
  'CRM': { lynchLabel: '빠른성장주', sector: '클라우드SaaS' },
  'NKE': { lynchLabel: '대형우량주', sector: '스포츠의류' },
  'GE':  { lynchLabel: '대형우량주', sector: '산업/항공' },
}

async function fetchKrTop10(usdKrw: number): Promise<TopEntry[]> {
  try {
    const r = await fetch('https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=30', {
      headers: { 'User-Agent': NAVER_UA, Referer: 'https://m.stock.naver.com/' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return []
    const j = await r.json()
    // marketValue = 문자열 "19,234,257" (백만원) 또는 marketValueRaw(숫자)
    const stocks: { stockType: string; itemCode: string; stockName: string; marketValue: string | number; marketValueRaw?: number; closePrice: string; compareToPreviousClosePrice: string; fluctuationsRatio?: string }[] = j.stocks ?? []
    const entries: TopEntry[] = []
    for (const s of stocks) {
      if (entries.length >= 10) break
      if (getAssetType(s.itemCode, s.stockName, 'KR') !== 'STOCK') continue
      const meta = LYNCH_KR[s.itemCode] ?? { lynchLabel: '대형우량주', sector: '기타' }
      const close = parseFloat(s.closePrice?.replace(/,/g, '') || '0')
      // fluctuationsRatio 직접 사용(더 정확) — 없으면 closePrice로 역산
      const flucRaw = s.fluctuationsRatio ? parseFloat(s.fluctuationsRatio) : null
      const chgAmt = parseFloat(s.compareToPreviousClosePrice?.replace(/,/g, '') || '0')
      const changePct = flucRaw ?? (close > 0 ? Math.round((chgAmt / (close - chgAmt)) * 1000) / 10 : null)
      // marketValueRaw = 원(원화 그대로) — ★ JSON에서 문자열로 옴 → Number 강제(안 하면 합계 reduce가 문자열 연결돼 e+131 오버플로)
      const rawMc = s.marketValueRaw != null ? Number(s.marketValueRaw) : parseFloat(String(s.marketValue).replace(/,/g, '') || '0') * 1e6
      const marketCapKrw = isFinite(rawMc) && rawMc > 0 ? rawMc : 0
      entries.push({ rank: entries.length + 1, ticker: s.itemCode, name: s.stockName, market: 'KR', marketCapKrw, marketCapUsd: marketCapKrw / usdKrw, changePct, ...meta })
    }
    return entries
  } catch { return [] }
}

async function fetchUsTop10(usdKrw: number): Promise<TopEntry[]> {
  const candidates = Object.keys(LYNCH_US)
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const results = await Promise.allSettled(candidates.map(t =>
      yf.quoteSummary(t, { modules: ['summaryDetail', 'price'] }).catch(() => null)
    ))
    const entries: { mc: number; entry: TopEntry }[] = []
    results.forEach((res, i) => {
      if (res.status !== 'fulfilled' || !res.value) return
      const r = res.value
      const mc: number = r.summaryDetail?.marketCap ?? 0
      if (!mc || mc < 1e11) return   // 1000억 달러 미만은 top10 불가
      const ticker = candidates[i]
      const meta = LYNCH_US[ticker] ?? { lynchLabel: '대형우량주', sector: '기타' }
      const chg: number | null = r.price?.regularMarketChangePercent
        ? Math.round(r.price.regularMarketChangePercent * 1000) / 10 : null
      const name = r.price?.longName || r.price?.shortName || ticker
      entries.push({ mc, entry: { rank: 0, ticker, name: name.replace(/,.*$/, '').slice(0, 24), market: 'US', marketCapKrw: mc * usdKrw, marketCapUsd: mc, changePct: chg, ...meta } })
    })
    return entries.sort((a, b) => b.mc - a.mc).slice(0, 10).map((x, i) => ({ ...x.entry, rank: i + 1 }))
  } catch { return [] }
}

export async function GET(req: Request) {
  const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1'
  const cacheKey = `global-top10-v2:${kstDate()}`   // v2: KR 시총 숫자화(e+131 버그 수정) + SPCX 추가
  if (!forceRefresh) {
    const cached = await getCache<GlobalTop10Result>(cacheKey, 12 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  // 환율
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  let usdKrw = 1350
  try {
    const er = await fetch(`${selfBase}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) })
    if (er.ok) { const j = await er.json(); usdKrw = j.rate ?? 1350 }
  } catch { /* graceful */ }

  const [kr, us] = await Promise.all([fetchKrTop10(usdKrw), fetchUsTop10(usdKrw)])
  const result: GlobalTop10Result = { kr, us, usdKrw, asOf: new Date().toISOString() }
  if (kr.length > 0 && us.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
