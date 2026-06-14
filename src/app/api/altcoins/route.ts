// 🔷 메이저 알트코인 네트워크 분석 — ETH·SOL·XRP의 '가격 vs 네트워크 펀더멘탈' 오버레이(투기 캔들 매몰 방지)
// ETH·SOL = 가격 vs TVL(DefiLlama 예치자본) · XRP = 가격 vs 거래량(결제망 유틸리티) · 전부 무료·무인증 · 12h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// 코인별 최선의 무료(무키) 네트워크 펀더멘탈
//  ETH·XRP = 활성주소(DAU·CoinMetrics 커뮤니티) · SOL = 일일 수수료(DefiLlama, 솔라나 DAU는 무료 미제공이나 수수료=실사용량 동행 지표)
type NetSource = 'dau' | 'fees'
const COINS: { id: string; symbol: string; name: string; tagline: string; source: NetSource; key: string; netLabel: string; netUnit: string; desc: string }[] = [
  { id: 'ethereum', symbol: 'ETH', name: '이더리움', tagline: '스마트계약 플랫폼',  source: 'dau',  key: 'eth',     netLabel: '활성주소(DAU)', netUnit: 'K', desc: '네트워크를 실제 쓰는 지갑 수 — 가격이 올라도 활성주소가 줄면 유틸리티 없는 거품(Hype) 의심.' },
  { id: 'solana',   symbol: 'SOL', name: '솔라나', tagline: '고속 스마트계약 체인', source: 'fees', key: 'solana',  netLabel: '일일 수수료', netUnit: 'M', desc: '네트워크에서 매일 발생하는 수수료 — 트랜잭션마다 내므로 실제 사용량(DAU)과 동행. 가격↑인데 수수료 정체면 거품 의심.' },
  { id: 'ripple',   symbol: 'XRP', name: '리플', tagline: '국경간 결제 브릿지',    source: 'dau',  key: 'xrp',     netLabel: '활성주소(DAU)', netUnit: 'K', desc: '국경 간 결제망 — 실제 송금에 쓰인 활성 지갑 수로 가격 뒤의 유틸리티를 본다.' },
]

export interface AltPoint { date: string; price: number; net: number | null }
export interface AltCoin {
  id: string; symbol: string; name: string; tagline: string
  netLabel: string; netUnit: string
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
// CoinMetrics 커뮤니티 API(무료·무인증) — 활성주소수(AdrActCnt). SOL 등 고성능 체인은 403(무료 미제공)이라 호출부에서 graceful
async function cmDau(asset: string): Promise<Map<string, number>> {
  try {
    const start = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10)
    const r = await fetch(`https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=${asset}&metrics=AdrActCnt&frequency=1d&page_size=420&start_time=${start}`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return new Map()
    const j = await r.json() as { data?: { time: string; AdrActCnt: string }[] }
    return new Map((j.data ?? []).map(o => [o.time.slice(0, 10), parseFloat(o.AdrActCnt)]).filter(([, v]) => isFinite(v as number)) as [string, number][])
  } catch { return new Map() }
}
// DefiLlama 일일 수수료(무료·무키) — 트랜잭션 수수료 = 실제 네트워크 사용량 프록시(DAU 동행)
async function llamaFees(slug: string): Promise<Map<string, number>> {
  try {
    const r = await fetch(`https://api.llama.fi/overview/fees/${slug}`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return new Map()
    const j = await r.json() as { totalDataChart?: [number, number][] }
    return new Map((j.totalDataChart ?? []).map(([t, v]) => [new Date(t * 1000).toISOString().slice(0, 10), v]))
  } catch { return new Map() }
}
// 네트워크 지표를 코인별 표시단위로 스케일(DAU→천 주소 K, 수수료→백만$ M)
const NET_SCALE: Record<NetSource, number> = { dau: 1e3, fees: 1e6 }

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)
const pctChg = (a: number, b: number) => (a > 0 ? Math.round(((b / a) - 1) * 1000) / 10 : 0)

export async function GET() {
  const cacheKey = 'altcoins-v2'   // v2: 네트워크 지표를 DAU(ETH·XRP)/일일수수료(SOL)로 — 실사용량 기반
  const cached = await getCache<AltcoinsResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 네트워크 지표 병렬(CoinMetrics·DefiLlama 호스트 다름) — DAU(ETH·XRP) + 수수료(SOL)
  const [ethDau, xrpDau, solFees] = await Promise.all([cmDau('eth'), cmDau('xrp'), llamaFees('solana')])
  const netMaps: Record<string, Map<string, number>> = { ethereum: ethDau, ripple: xrpDau, solana: solFees }

  const coins: AltCoin[] = []
  for (const c of COINS) {
    const chart = await cgChart(c.id)   // 가격은 CoinGecko 순차(무료 버스트 429 회피)
    if (!chart || !chart.prices?.length) {
      coins.push({ id: c.id, symbol: c.symbol, name: c.name, tagline: c.tagline, netLabel: c.netLabel, netUnit: c.netUnit, price: null, priceChgPct: null, netChgPct: null, points: [], divergence: 'neutral', jarvisTip: '데이터 일시 수집 실패 — 잠시 후 다시 확인하세요.', desc: c.desc })
      continue
    }
    const netMap = netMaps[c.id] ?? new Map<string, number>()
    const scale = NET_SCALE[c.source]
    const netAt = (d: string): number | null => { const v = netMap.get(d); return v != null && isFinite(v) ? Math.round(v / scale * 100) / 100 : null }

    // 주간 다운샘플(약 52포인트) — 일봉 7개당 1개 + 마지막 보장
    const daily = chart.prices.map(([t, p]) => ({ d: ymd(t), price: p }))
    const idxs = daily.map((_, i) => i).filter(i => i % 7 === 0)
    if (daily.length && idxs[idxs.length - 1] !== daily.length - 1) idxs.push(daily.length - 1)
    const points: AltPoint[] = idxs.map(i => ({ date: daily[i].d, price: Math.round(daily[i].price * 100) / 100, net: netAt(daily[i].d) }))

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
    const netName = c.netLabel
    const jarvisTip =
      divergence === 'hype' ? `⚠️ 최근 1년 ${c.name} 가격은 ${priceChgPct}%인데 ${netName}은 ${netChgPct}%에 그쳤습니다 — 실사용보다 기대(Hype)가 앞선 투기 프리미엄 구간일 수 있으니 추격 매수 주의.`
      : divergence === 'healthy' ? `✅ ${c.name} 가격(${priceChgPct}%)과 ${netName}(${netChgPct}%)이 함께 성장 중 — 가격이 네트워크 실사용에 뒷받침된 건강한 구간입니다.`
      : divergence === 'value' ? `🔍 ${c.name} 가격은 ${priceChgPct}%로 빠졌지만 ${netName}은 ${netChgPct}% 늘었습니다 — 실사용 대비 가격이 눌린 디커플링 구간(역사적으로 관심 가치).`
      : `${c.name} 가격(${priceChgPct ?? '—'}%)과 ${netName}(${netChgPct ?? '—'}%)에 뚜렷한 괴리는 없습니다. 가격 캔들보다 네트워크 실사용 추세를 함께 보세요.`

    coins.push({ id: c.id, symbol: c.symbol, name: c.name, tagline: c.tagline, netLabel: c.netLabel, netUnit: c.netUnit, price, priceChgPct, netChgPct, points, divergence, jarvisTip, desc: c.desc })
  }

  const result: AltcoinsResult = { coins, asOf: new Date().toISOString() }
  if (coins.some(c => c.points.length > 0)) await setCache(cacheKey, result)   // 전부 실패면 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
