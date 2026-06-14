// 🔷 메이저 알트코인 네트워크 분석 — ETH·SOL·XRP의 '가격 vs 네트워크 펀더멘탈' 오버레이(투기 캔들 매몰 방지)
// ETH·SOL = 가격 vs TVL(DefiLlama 예치자본) · XRP = 가격 vs 거래량(결제망 유틸리티) · 전부 무료·무인증 · 12h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const COINS = [
  { id: 'ethereum', symbol: 'ETH', name: '이더리움', net: 'tvl' as const,    llama: 'Ethereum', tagline: '스마트계약 플랫폼', netLabel: 'TVL(예치자본)', desc: '생태계에 묶여 DeFi 활동 중인 자본 — 가격이 올라도 TVL이 정체면 투기 프리미엄(Hype) 의심.' },
  { id: 'solana',   symbol: 'SOL', name: '솔라나', net: 'tvl' as const,    llama: 'Solana',   tagline: '고속 스마트계약 체인', netLabel: 'TVL(예치자본)', desc: '네트워크 위 실제 금융 활동에 묶인 자본 — 가격과 TVL의 동행 여부가 펀더멘탈 신호.' },
  { id: 'ripple',   symbol: 'XRP', name: '리플', net: 'volume' as const, llama: null,        tagline: '국경간 결제 브릿지', netLabel: '거래량', desc: '국경 간 결제 브릿지 — DeFi TVL이 없어, 가격 뒤의 실제 송금·거래량으로 유틸리티를 본다.' },
]

export interface AltPoint { date: string; price: number; net: number | null }
export interface AltCoin {
  id: string; symbol: string; name: string; tagline: string
  netKind: 'tvl' | 'volume'; netLabel: string; netUnit: string
  price: number | null; priceChgPct: number | null; netChgPct: number | null
  points: AltPoint[]
  divergence: 'hype' | 'healthy' | 'value' | 'neutral'
  jarvisTip: string
  desc: string
}
export interface AltcoinsResult { coins: AltCoin[]; asOf: string }

const CG_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
async function cgChart(id: string): Promise<{ prices: [number, number][]; total_volumes: [number, number][] } | null> {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`, { signal: AbortSignal.timeout(12_000), headers: { accept: 'application/json', 'User-Agent': CG_UA } })
      if (r.ok) return await r.json()
      if (r.status !== 429) return null
    } catch { /* 재시도 */ }
    await new Promise(res => setTimeout(res, 1500))
  }
  return null
}
async function llamaTvl(chain: string): Promise<Map<string, number>> {
  try {
    const r = await fetch(`https://api.llama.fi/v2/historicalChainTvl/${chain}`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return new Map()
    const arr = await r.json() as { date: number; tvl: number }[]
    return new Map(arr.map(o => [new Date(o.date * 1000).toISOString().slice(0, 10), o.tvl]))
  } catch { return new Map() }
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)
const pctChg = (a: number, b: number) => (a > 0 ? Math.round(((b / a) - 1) * 1000) / 10 : 0)

export async function GET() {
  const cacheKey = 'altcoins-v1'
  const cached = await getCache<AltcoinsResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // TVL(DefiLlama)은 호스트 달라 병렬 OK · CoinGecko는 반드시 순차(무료 버스트 429)
  const [ethTvl, solTvl] = await Promise.all([llamaTvl('Ethereum'), llamaTvl('Solana')])
  const tvlMap: Record<string, Map<string, number>> = { Ethereum: ethTvl, Solana: solTvl }

  const coins: AltCoin[] = []
  for (const c of COINS) {
    const chart = await cgChart(c.id)   // 순차
    if (!chart || !chart.prices?.length) {
      coins.push({ id: c.id, symbol: c.symbol, name: c.name, tagline: c.tagline, netKind: c.net, netLabel: c.netLabel, netUnit: 'B', price: null, priceChgPct: null, netChgPct: null, points: [], divergence: 'neutral', jarvisTip: '데이터 일시 수집 실패 — 잠시 후 다시 확인하세요.', desc: c.desc })
      continue
    }
    const volMap = new Map(chart.total_volumes.map(([t, v]) => [ymd(t), v]))
    const tvl = c.llama ? tvlMap[c.llama] : null

    // 주간 다운샘플(약 52포인트) — 일봉 7개당 1개
    const daily = chart.prices.map(([t, p]) => ({ d: ymd(t), price: p }))
    const points: AltPoint[] = []
    for (let i = 0; i < daily.length; i += 7) {
      const { d, price } = daily[i]
      const netRaw = c.net === 'tvl' ? (tvl?.get(d) ?? null) : (volMap.get(d) ?? null)
      points.push({ date: d, price: Math.round(price * 100) / 100, net: netRaw != null ? Math.round(netRaw / 1e9 * 100) / 100 : null })   // 10억 단위(B)
    }
    if (daily.length && (daily.length - 1) % 7 !== 0) {   // 마지막 포인트 보장
      const { d, price } = daily[daily.length - 1]
      const netRaw = c.net === 'tvl' ? (tvl?.get(d) ?? null) : (volMap.get(d) ?? null)
      points.push({ date: d, price: Math.round(price * 100) / 100, net: netRaw != null ? Math.round(netRaw / 1e9 * 100) / 100 : null })
    }

    const price = points[points.length - 1]?.price ?? null
    const priceChgPct = points.length >= 2 ? pctChg(points[0].price, points[points.length - 1].price) : null
    const netVals = points.filter(p => p.net != null).map(p => p.net!)
    const netChgPct = netVals.length >= 2 ? pctChg(netVals[0], netVals[netVals.length - 1]) : null

    // 디커플링 판정 — 가격 vs 네트워크 펀더멘탈
    let divergence: AltCoin['divergence'] = 'neutral'
    if (priceChgPct != null && netChgPct != null) {
      if (priceChgPct > 20 && netChgPct < priceChgPct * 0.4) divergence = 'hype'        // 가격↑ 네트워크 정체 → 투기 프리미엄
      else if (priceChgPct > 5 && netChgPct >= priceChgPct * 0.6) divergence = 'healthy'  // 가격·네트워크 동반
      else if (priceChgPct < -10 && netChgPct > 0) divergence = 'value'                  // 가격↓ 네트워크↑ → 디커플링(저평가 여지)
    }
    const netName = c.net === 'tvl' ? '예치자본(TVL)' : '거래량'
    const jarvisTip =
      divergence === 'hype' ? `⚠️ 최근 1년 ${c.name} 가격은 ${priceChgPct}%인데 ${netName}은 ${netChgPct}%에 그쳤습니다 — 실사용보다 기대(Hype)가 앞선 투기 프리미엄 구간일 수 있으니 추격 매수 주의.`
      : divergence === 'healthy' ? `✅ ${c.name} 가격(${priceChgPct}%)과 ${netName}(${netChgPct}%)이 함께 성장 중 — 가격이 네트워크 펀더멘탈에 뒷받침된 건강한 구간입니다.`
      : divergence === 'value' ? `🔍 ${c.name} 가격은 ${priceChgPct}%로 빠졌지만 ${netName}은 ${netChgPct}% 늘었습니다 — 펀더멘탈 대비 가격이 눌린 디커플링 구간(역사적으로 관심 가치).`
      : `${c.name} 가격(${priceChgPct ?? '—'}%)과 ${netName}(${netChgPct ?? '—'}%)에 뚜렷한 괴리는 없습니다. 가격 캔들보다 네트워크 추세를 함께 보세요.`

    coins.push({ id: c.id, symbol: c.symbol, name: c.name, tagline: c.tagline, netKind: c.net, netLabel: c.netLabel, netUnit: 'B', price, priceChgPct, netChgPct, points, divergence, jarvisTip, desc: c.desc })
  }

  const result: AltcoinsResult = { coins, asOf: new Date().toISOString() }
  if (coins.some(c => c.points.length > 0)) await setCache(cacheKey, result)   // 전부 실패면 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
