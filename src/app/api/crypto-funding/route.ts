// 🪙 크립토 펀딩비·OI 과열 레이더 API — BTC·ETH·SOL 무기한 선물 펀딩비 + 미결제약정(OI)
//    펀딩 高양(+)=롱 과열(청산 위험) / 음(−)=숏 과밀(역발상 반등). OI 급증=레버리지 빌드업. 경보만·결정론.
//    데이터: Binance 무료·무키(premiumIndex·fundingRate·openInterestHist). Phase 0 실측 완료.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const FAPI = 'https://fapi.binance.com'

export type FundVerdict = 'long_hot' | 'short_skew' | 'neutral'
export interface CoinFroth {
  key: string; name: string; symbol: string; emoji: string
  markPrice: number
  fundingAnnual: number        // 현재 연율화 펀딩(%)
  fundingAvg30: number         // 30일 평균 연율화(%)
  fundingPctile: number        // 현재 연율화의 이력 내 백분위(0~100)
  oiValueUsd: number           // 현재 OI 명목가($)
  oiChange30: number | null    // OI 30일 변화(%)
  oiBuildup: boolean           // OI 30일 +25%↑
  verdict: FundVerdict
  severity: 'high' | 'elevated' | 'normal'
  fundingSpark: number[]       // 최근 연율화 펀딩(스파크라인)
}
export interface CryptoFundingResult {
  asOf: string
  coins: CoinFroth[]
  overall: FundVerdict
  headline: string
  note: string
}

const COINS = [
  { key: 'btc', name: '비트코인', symbol: 'BTCUSDT', emoji: '₿' },
  { key: 'eth', name: '이더리움', symbol: 'ETHUSDT', emoji: 'Ξ' },
  { key: 'sol', name: '솔라나', symbol: 'SOLUSDT', emoji: '◎' },
]

/* eslint-disable @typescript-eslint/no-explicit-any */
async function bget(path: string): Promise<any | null> {
  try {
    const r = await fetch(`${FAPI}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

/** 8h 펀딩 → 연율화(%) = rate × 3(회/일) × 365 */
const annualize = (rate8h: number) => rate8h * 3 * 365 * 100

async function scanCoin(c: typeof COINS[number]): Promise<CoinFroth | null> {
  // 같은 호스트 순차(버스트 429 방지 — coin-lab 교훈)
  const pi = await bget(`/fapi/v1/premiumIndex?symbol=${c.symbol}`)
  const hist = await bget(`/fapi/v1/fundingRate?symbol=${c.symbol}&limit=1000`)
  const oiHist = await bget(`/futures/data/openInterestHist?symbol=${c.symbol}&period=1d&limit=30`)
  if (!pi || typeof pi.lastFundingRate !== 'string') return null

  const markPrice = parseFloat(pi.markPrice)
  const fundingAnnual = annualize(parseFloat(pi.lastFundingRate))

  const annHist: number[] = Array.isArray(hist)
    ? hist.map((h: any) => annualize(parseFloat(h.fundingRate))).filter((x: number) => isFinite(x))
    : []
  const last90 = annHist.slice(-90)   // 최근 30일(8h×90)
  const fundingAvg30 = last90.length ? last90.reduce((s, x) => s + x, 0) / last90.length : fundingAnnual
  const below = annHist.filter(x => x <= fundingAnnual).length
  const fundingPctile = annHist.length ? Math.round((below / annHist.length) * 100) : 50
  const fundingSpark = annHist.slice(-60)

  let oiValueUsd = 0, oiChange30: number | null = null, oiBuildup = false
  if (Array.isArray(oiHist) && oiHist.length) {
    oiValueUsd = parseFloat(oiHist[oiHist.length - 1].sumOpenInterestValue) || 0
    const first = parseFloat(oiHist[0].sumOpenInterestValue)
    if (isFinite(first) && first > 0 && oiValueUsd > 0) {
      oiChange30 = Math.round(((oiValueUsd - first) / first) * 1000) / 10
      oiBuildup = oiChange30 >= 25
    }
  }

  let verdict: FundVerdict = 'neutral'
  let severity: CoinFroth['severity'] = 'normal'
  if (fundingAnnual >= 30) { verdict = 'long_hot'; severity = fundingAnnual >= 60 ? 'high' : 'elevated' }
  else if (fundingAnnual <= -5) { verdict = 'short_skew'; severity = fundingAnnual <= -20 ? 'high' : 'elevated' }

  return {
    key: c.key, name: c.name, symbol: c.symbol, emoji: c.emoji,
    markPrice, fundingAnnual: Math.round(fundingAnnual * 10) / 10,
    fundingAvg30: Math.round(fundingAvg30 * 10) / 10, fundingPctile,
    oiValueUsd, oiChange30, oiBuildup, verdict, severity, fundingSpark,
  }
}

export async function GET() {
  const cacheKey = `crypto-funding-v1:${kstDate()}:${Math.floor(Date.now() / 3600_000)}`  // 1h 버킷
  const cached = await getCache<CryptoFundingResult>(cacheKey, 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const coins: CoinFroth[] = []
  for (const c of COINS) { const r = await scanCoin(c).catch(() => null); if (r) coins.push(r) }
  if (coins.length < 2) return NextResponse.json({ error: 'binance_unreachable' }, { status: 503 })

  // 종합(가장 과열 우선)
  const hotHigh = coins.filter(c => c.verdict === 'long_hot' && c.severity === 'high')
  const hot = coins.filter(c => c.verdict === 'long_hot')
  const shortSkew = coins.filter(c => c.verdict === 'short_skew')
  let overall: FundVerdict = 'neutral'
  if (hot.length) overall = 'long_hot'
  else if (shortSkew.length) overall = 'short_skew'

  const names = (arr: CoinFroth[]) => arr.map(c => `${c.emoji} ${c.name}`).join('·')
  const headline =
    hotHigh.length ? `🔴 롱 레버리지 과열 — ${names(hotHigh)} 펀딩비 급등(청산 캐스케이드 위험)`
    : hot.length ? `🟠 롱 쏠림 조짐 — ${names(hot)} 펀딩비 상승(레버리지 빌드업)`
    : shortSkew.length ? `🔵 숏 과밀 — ${names(shortSkew)} 펀딩비 음(−), 역발상 반등(숏스퀴즈) 연료`
    : `🟢 레버리지 정상 — 펀딩비·OI 과열 없음`
  const buildup = coins.filter(c => c.oiBuildup)
  const note =
    overall === 'long_hot'
      ? `펀딩비 高양(+)=롱이 숏에 이자 지급=롱 과밀 → 작은 하락에도 연쇄청산(캐스케이드) 위험.${buildup.length ? ` OI도 30일 급증(${names(buildup)})=레버리지 빌드업.` : ''} ⛔ 매도 지시 아님 — 코인 비중·레버리지 점검, 추격매수 자제.`
      : overall === 'short_skew'
      ? '펀딩비 음(−)=숏이 롱에 이자 지급=숏 과밀. 공포 국면의 역발상 반등(숏스퀴즈) 연료가 될 수 있으나, 하락 추세면 함정. 현물·추세와 함께 보라.'
      : '롱/숏 어느 쪽도 과밀하지 않음 — 레버리지 froth 낮음. 펀딩비가 급등하면 사이클 후반 과열 신호로 감시.'

  const result: CryptoFundingResult = { asOf: new Date().toISOString(), coins, overall, headline, note }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
