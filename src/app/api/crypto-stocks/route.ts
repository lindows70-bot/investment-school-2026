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
  benchmark: 'BTC' | 'ETH'    // 베타 기준 코인(BTC 트레저리/거래소=BTC, ETH 트레저리=ETH)
  beta: number | null         // 벤치마크 베타: 1.0=동일 움직임, 2.0=2배 레버리지
  corr: number | null         // 벤치마크 상관계수(-1~1)
  benchmarkReturn1y: number | null   // 벤치마크 코인 1년 수익률(%)
  return1y: number | null     // 1년 수익률(%)
  currentPrice: number | null
  points: { date: string; norm: number }[]   // 정규화 가격(첫주=100 기준)
  betaZone: 'high' | 'mid' | 'low' | 'neg'  // 베타 구간
  trend: 'up' | 'side' | 'down' | 'unknown' // 📉 주가 추세(타이밍)
  pct52w: number | null                      // 52주 레인지 내 위치(0=저점·100=고점)
  timingTip: string                          // 매수/매도 타이밍 한 줄
  jarvisTip: string
}

export interface CryptoStocksResult {
  stocks: CryptoStock[]
  btcReturn1y: number | null
  btcPoints: { date: string; norm: number }[]
  ethReturn1y: number | null
  ethPoints: { date: string; norm: number }[]
  asOf: string
}

const STOCKS: { symbol: string; name: string; tagline: string; model: string; color: string; benchmark?: 'BTC' | 'ETH' }[] = [
  { symbol: 'MSTR', name: '마이크로스트래티지', tagline: 'BTC 트레저리 컴퍼니', color: '#f59e0b',
    model: 'BTC를 직접 대규모 보유하는 기업 — 사실상 레버리지 BTC ETF. BTC가 1% 오르면 이 주식은 더 크게 반응한다.' },
  { symbol: 'BMNR', name: '비트마인', tagline: 'ETH 트레저리 컴퍼니', color: '#a855f7', benchmark: 'ETH',
    model: 'ETH를 대규모 보유하는 기업(톰 리 회장) — 이더리움판 마이크로스트래티지. ETH 가격에 강한 레버리지, 변동성 매우 큼. (베타는 ETH 기준)' },
  { symbol: 'COIN', name: '코인베이스', tagline: '미국 1위 코인 거래소', color: '#3b82f6',
    model: '거래 수수료 + 스테이킹 수익 — BTC 가격↑ → 거래량↑ → 수수료 수익↑. 규제 환경에 민감.' },
  { symbol: 'BLSH', name: 'Bullish', tagline: '기관용 코인 거래소(2025 상장)', color: '#ec4899',
    model: '기관 대상 현물·파생 거래소(피터 틸 투자, 코인데스크 소유) — 거래량·기관 자금 유입에 연동. 신규 상장주라 변동성 큼.' },
  { symbol: 'MARA', name: '마라홀딩스', tagline: 'BTC 채굴 기업', color: '#ef4444',
    model: '채굴한 BTC를 팔거나 보유 — 수익은 (BTC 가격 − 채굴원가) 스프레드. BTC 급등기에 지렛대 효과 극대화.' },
  { symbol: 'HOOD', name: '로빈후드', tagline: '주식·코인 MZ 거래 플랫폼', color: '#22c55e',
    model: '코인 거래 수수료 비중 높음 — 암호화폐 붐 수혜주. 주식+코인 양쪽에 분산된 사업 구조.' },
  { symbol: 'CRCL', name: '서클', tagline: 'USDC 스테이블코인 발행사', color: '#06b6d4',
    model: 'USDC 발행 담보(미국채) 이자수익이 주 수입 — 금리↑=수익↑, 스테이블코인 규제(GENIUS Act)에 직결.' },
]

// 📉 매수/매도 타이밍 — 주봉 단기(4주)·장기(~30주) 이평 정렬 + 52주 위치
function priceTiming(prices: number[]): { trend: 'up' | 'side' | 'down' | 'unknown'; pct52w: number | null } {
  if (prices.length < 8) return { trend: 'unknown', pct52w: null }
  const last = prices[prices.length - 1]
  const maS = prices.slice(-4).reduce((a, b) => a + b, 0) / 4
  const longN = Math.min(30, prices.length)
  const maL = prices.slice(-longN).reduce((a, b) => a + b, 0) / longN
  const hi = Math.max(...prices), lo = Math.min(...prices)
  const pct52w = hi > lo ? Math.round(((last - lo) / (hi - lo)) * 100) : null
  let trend: 'up' | 'side' | 'down' = 'side'
  if (last >= maS && maS >= maL) trend = 'up'
  else if (last < maS && maS < maL) trend = 'down'
  return { trend, pct52w }
}

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
  const cacheKey = 'crypto-stocks-v3'   // v3: 종목별 벤치마크(ETH 트레저리=ETH 베타) + ETH 오버레이
  const cached = await getCache<CryptoStocksResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [btcRaw, ethRaw, ...stockRaws] = await Promise.all([
    yahooWeekly('BTC-USD'),
    yahooWeekly('ETH-USD'),
    ...STOCKS.map(s => yahooWeekly(s.symbol)),
  ])

  const ret1y = (raw: { price: number }[]) => raw.length >= 2 ? Math.round((raw[raw.length - 1].price / raw[0].price - 1) * 1000) / 10 : null
  const btcReturn1y = ret1y(btcRaw), ethReturn1y = ret1y(ethRaw)
  const btcPoints = normalize(btcRaw), ethPoints = normalize(ethRaw)
  const btcMap = new Map(btcRaw.map(p => [p.date, p.price]))
  const ethMap = new Map(ethRaw.map(p => [p.date, p.price]))

  const stocks: CryptoStock[] = STOCKS.map((meta, idx) => {
    const bench = meta.benchmark ?? 'BTC'
    const benchMap = bench === 'ETH' ? ethMap : btcMap
    const benchReturn1y = bench === 'ETH' ? ethReturn1y : btcReturn1y
    const raw = stockRaws[idx]
    if (raw.length < 10) {
      return { ...meta, benchmark: bench, beta: null, corr: null, benchmarkReturn1y: benchReturn1y, return1y: null, currentPrice: null, points: [], betaZone: 'mid' as const, trend: 'unknown' as const, pct52w: null, timingTip: '데이터 일시 수집 실패.', jarvisTip: '데이터 일시 수집 실패.' }
    }
    const prices = raw.map(p => p.price)
    // 날짜 정렬: 벤치마크 코인(BTC 또는 ETH)과 stock의 겹치는 주만 사용
    const paired = raw.filter(p => benchMap.has(p.date))
    const pairedBench = paired.map(p => benchMap.get(p.date)!)
    const { beta, corr } = calcBeta(paired.map(p => p.price), pairedBench)
    const return1y = ret1y(raw)

    const betaZone: CryptoStock['betaZone'] =
      beta == null ? 'mid'
      : beta < 0 ? 'neg'
      : beta >= 1.5 ? 'high'
      : beta >= 0.7 ? 'mid'
      : 'low'

    const benchLabel = benchReturn1y != null ? `${bench} ${benchReturn1y > 0 ? '+' : ''}${benchReturn1y}%` : bench
    const stockLabel = return1y != null ? `${return1y > 0 ? '+' : ''}${return1y}%` : '—'
    const alpha = return1y != null && benchReturn1y != null ? Math.round((return1y - benchReturn1y) * 10) / 10 : null

    const lowCorr = corr != null && Math.abs(corr) < 0.3   // 상관 낮으면 베타는 통계적으로 신뢰도↓(노이즈)
    const jarvisTip =
      beta == null ? `${meta.name} 가격 데이터를 일시적으로 가져오지 못했습니다.`
      : lowCorr ? `🌀 ${bench} 베타 ${beta}지만 상관 ${corr}로 매우 낮음 — 주가가 ${bench} 주간 등락과 따로 논다(자체 증자·보유 확대·내러티브가 주도). 베타 수치는 참고만 하고, ${meta.tagline} 고유 변동성으로 해석하라.`
      : beta >= 1.5 ? `⚡ ${bench} 베타 ${beta} — ${benchLabel}인데 이 주식은 ${stockLabel}로 움직임. ${bench}의 고베타 레버리지 포지션이다.`
      : beta >= 0.7 ? `📊 ${bench} 베타 ${beta} — ${bench} 수익률(${benchLabel})과 비슷한 궤적. ${alpha != null ? `초과수익(알파) ${alpha > 0 ? '+' : ''}${alpha}%.` : ''}`
      : beta >= 0 ? `🧩 ${bench} 베타 ${beta} — ${bench}보다 낮은 민감도. 코인보다 본업(${meta.tagline}) 가치가 더 반영되는 구조.`
      : `🔄 ${bench} 베타 ${beta}(음수) — 해석 주의: 집계 기간 중 ${bench}와 역방향 구간 존재. 더 긴 기간으로 재검토 권장.`

    // 📉 매수/매도 타이밍 — 추세 + 52주 위치 결합
    const { trend, pct52w } = priceTiming(prices)
    const posTxt = pct52w != null ? `52주 ${pct52w}% 지점` : ''
    const hot = pct52w != null && pct52w >= 85, bottom = pct52w != null && pct52w <= 15
    const timingTip =
      trend === 'up' ? (hot ? `🟢 상승추세지만 ${posTxt}(고점권) — 추격보다 분할·눌림 대기` : `🟢 상승추세(단기>장기 이평) · ${posTxt} — 추세 추종 유리`)
      : trend === 'down' ? (bottom ? `🔴 하락추세 · ${posTxt}(저점권) — 바닥 '확인 후' 분할, 떨어지는 칼날 주의` : `🔴 하락추세(단기<장기 이평) · ${posTxt} — 추격 매수 보류`)
      : trend === 'side' ? `🟡 횡보 · ${posTxt} — 방향 확정 대기(돌파/이탈 확인)`
      : '추세 판단 데이터 부족'

    return {
      ...meta,
      benchmark: bench,
      beta,
      corr,
      benchmarkReturn1y: benchReturn1y,
      return1y,
      currentPrice: Math.round(prices[prices.length - 1] * 100) / 100,
      points: normalize(raw),
      betaZone,
      trend,
      pct52w,
      timingTip,
      jarvisTip,
    }
  })

  const result: CryptoStocksResult = { stocks, btcReturn1y, btcPoints, ethReturn1y, ethPoints, asOf: new Date().toISOString() }
  if (stocks.some(s => s.points.length > 0)) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
