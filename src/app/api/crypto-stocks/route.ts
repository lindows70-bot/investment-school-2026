// 코인 관련 주식 분석 — BTC 베타로 '얼마나 BTC 레버리지냐' + 본업 가치 2축 평가
// Zero Cost: Yahoo Finance 1년 주봉(무료·무키) · 서버에서 BTC 베타·상관 계산 · 6h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface CryptoStock {
  symbol: string
  name: string
  tagline: string
  model: string        // 비즈니스 모델(한 줄)
  color: string
  btcBeta: number | null      // BTC 베타: 1.0=BTC와 동일 움직임, 2.0=2배 레버리지
  btcCorr: number | null      // BTC 상관계수(-1~1)
  return1y: number | null     // 1년 수익률(%)
  currentPrice: number | null
  points: { date: string; norm: number }[]   // 정규화 가격(첫주=100 기준)
  betaZone: 'high' | 'mid' | 'low' | 'neg'  // 베타 구간
  jarvisTip: string
}

export interface CryptoStocksResult {
  stocks: CryptoStock[]
  btcReturn1y: number | null
  btcPoints: { date: string; norm: number }[]
  asOf: string
}

const STOCKS: { symbol: string; name: string; tagline: string; model: string; color: string }[] = [
  { symbol: 'MSTR', name: '마이크로스트래티지', tagline: 'BTC 트레저리 컴퍼니', color: '#f59e0b',
    model: 'BTC를 직접 대규모 보유하는 기업 — 사실상 레버리지 BTC ETF. BTC가 1% 오르면 이 주식은 더 크게 반응한다.' },
  { symbol: 'COIN', name: '코인베이스', tagline: '미국 1위 코인 거래소', color: '#3b82f6',
    model: '거래 수수료 + 스테이킹 수익 — BTC 가격↑ → 거래량↑ → 수수료 수익↑. 규제 환경에 민감.' },
  { symbol: 'MARA', name: '마라홀딩스', tagline: 'BTC 채굴 기업', color: '#8b5cf6',
    model: '채굴한 BTC를 팔거나 보유 — 수익은 (BTC 가격 − 채굴원가) 스프레드. BTC 급등기에 지렛대 효과 극대화.' },
  { symbol: 'HOOD', name: '로빈후드', tagline: '주식·코인 MZ 거래 플랫폼', color: '#22c55e',
    model: '코인 거래 수수료 비중 높음 — 암호화폐 붐 수혜주. 주식+코인 양쪽에 분산된 사업 구조.' },
  { symbol: 'CRCL', name: '서클', tagline: 'USDC 스테이블코인 발행사', color: '#06b6d4',
    model: 'USDC 발행 담보(미국채) 이자수익이 주 수입 — 금리↑=수익↑, 스테이블코인 규제(GENIUS Act)에 직결.' },
]

async function yahooWeekly(symbol: string): Promise<{ date: string; price: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1wk`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []
      const cl: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const out: { date: string; price: number }[] = []
      for (let i = 0; i < ts.length; i++) {
        const c = cl[i]; if (c != null && isFinite(c) && c > 0)
          out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), price: c })
      }
      if (out.length > 10) return out
    } catch { /* 다음 host */ }
  }
  return []
}

function calcBeta(stockPrices: number[], btcPrices: number[]): { beta: number | null; corr: number | null } {
  const n = Math.min(stockPrices.length, btcPrices.length) - 1
  if (n < 10) return { beta: null, corr: null }
  const sr = Array.from({ length: n }, (_, i) => stockPrices[i + 1] / stockPrices[i] - 1)
  const br = Array.from({ length: n }, (_, i) => btcPrices[i + 1] / btcPrices[i] - 1)
  const sm = sr.reduce((a, b) => a + b, 0) / n
  const bm = br.reduce((a, b) => a + b, 0) / n
  const cov = sr.reduce((a, _, i) => a + (sr[i] - sm) * (br[i] - bm), 0) / n
  const varB = br.reduce((a, _, i) => a + (br[i] - bm) ** 2, 0) / n
  const varS = sr.reduce((a, _, i) => a + (sr[i] - sm) ** 2, 0) / n
  if (varB === 0) return { beta: null, corr: null }
  const beta = Math.round((cov / varB) * 100) / 100
  const corr = varS > 0 ? Math.round((cov / Math.sqrt(varB * varS)) * 100) / 100 : null
  return { beta, corr }
}

function normalize(prices: { date: string; price: number }[]): { date: string; norm: number }[] {
  if (prices.length === 0) return []
  const base = prices[0].price
  return prices.map(p => ({ date: p.date, norm: Math.round((p.price / base) * 1000) / 10 }))
}

export async function GET() {
  const cacheKey = 'crypto-stocks-v1'
  const cached = await getCache<CryptoStocksResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [btcRaw, ...stockRaws] = await Promise.all([
    yahooWeekly('BTC-USD'),
    ...STOCKS.map(s => yahooWeekly(s.symbol)),
  ])

  const btcPrices = btcRaw.map(p => p.price)
  const btcReturn1y = btcPrices.length >= 2
    ? Math.round((btcPrices[btcPrices.length - 1] / btcPrices[0] - 1) * 1000) / 10
    : null
  const btcPoints = normalize(btcRaw)

  const stocks: CryptoStock[] = STOCKS.map((meta, idx) => {
    const raw = stockRaws[idx]
    if (raw.length < 10) {
      return { ...meta, btcBeta: null, btcCorr: null, return1y: null, currentPrice: null, points: [], betaZone: 'mid' as const, jarvisTip: '데이터 일시 수집 실패.' }
    }
    const prices = raw.map(p => p.price)
    // 날짜 정렬: BTC와 stock의 겹치는 주만 사용
    const btcMap = new Map(btcRaw.map(p => [p.date, p.price]))
    const paired = raw.filter(p => btcMap.has(p.date))
    const pairedBtc = paired.map(p => btcMap.get(p.date)!)
    const { beta, corr } = calcBeta(paired.map(p => p.price), pairedBtc)
    const return1y = prices.length >= 2
      ? Math.round((prices[prices.length - 1] / prices[0] - 1) * 1000) / 10
      : null

    const betaZone: CryptoStock['betaZone'] =
      beta == null ? 'mid'
      : beta < 0 ? 'neg'
      : beta >= 1.5 ? 'high'
      : beta >= 0.7 ? 'mid'
      : 'low'

    const btcLabel = btcReturn1y != null ? `BTC ${btcReturn1y > 0 ? '+' : ''}${btcReturn1y}%` : 'BTC'
    const stockLabel = return1y != null ? `${return1y > 0 ? '+' : ''}${return1y}%` : '—'
    const alpha = return1y != null && btcReturn1y != null ? Math.round((return1y - btcReturn1y) * 10) / 10 : null

    const jarvisTip =
      beta == null ? `${meta.name} 가격 데이터를 일시적으로 가져오지 못했습니다.`
      : beta >= 1.5 ? `⚡ BTC 베타 ${beta} — ${btcLabel}인데 이 주식은 ${stockLabel}로 움직임. BTC의 고베타 레버리지 포지션이다.`
      : beta >= 0.7 ? `📊 BTC 베타 ${beta} — BTC 수익률(${btcLabel})과 비슷한 궤적. ${alpha != null ? `초과수익(알파) ${alpha > 0 ? '+' : ''}${alpha}%.` : ''}`
      : beta >= 0 ? `🧩 BTC 베타 ${beta} — BTC보다 낮은 민감도. 코인보다 본업(${meta.tagline}) 가치가 더 반영되는 구조.`
      : `🔄 BTC 베타 ${beta}(음수) — 해석 주의: 집계 기간 중 BTC와 역방향 구간 존재. 더 긴 기간으로 재검토 권장.`

    return {
      ...meta,
      btcBeta: beta,
      btcCorr: corr,
      return1y,
      currentPrice: Math.round(prices[prices.length - 1] * 100) / 100,
      points: normalize(raw),
      betaZone,
      jarvisTip,
    }
  })

  const result: CryptoStocksResult = { stocks, btcReturn1y, btcPoints, asOf: new Date().toISOString() }
  if (stocks.some(s => s.points.length > 0)) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
