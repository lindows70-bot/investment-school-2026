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
  supplyPct: number | null; supplyNote: string   // 유통량/최대발행(희석 리스크). 하드캡 없으면 null
  jarvisTip: string
  desc: string
}

// CoinGecko markets 1회로 ETH·SOL·XRP 유통량/최대발행 — 희석(언락) 리스크
async function fetchSupply(): Promise<Record<string, { pct: number | null; note: string }>> {
  const out: Record<string, { pct: number | null; note: string }> = {}
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum,solana,ripple', { signal: AbortSignal.timeout(12_000), headers: { accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0' } })
    if (!r.ok) return out
    const arr = await r.json() as { id: string; circulating_supply?: number; max_supply?: number | null }[]
    for (const m of arr) {
      const circ = m.circulating_supply, max = m.max_supply
      if (circ && max) out[m.id] = { pct: Math.round((circ / max) * 1000) / 10, note: `최대 발행량 대비 유통률` }
      else out[m.id] = { pct: null, note: '발행 상한 없음(하드캡 X) — 유통량 대부분 이미 풀림' }
    }
  } catch { /* graceful */ }
  return out
}
export interface AltcoinsResult { coins: AltCoin[]; asOf: string }

// Yahoo Finance 주봉(무료·다년치) — CoinGecko 무료는 365일 초과 401이라 중장기 가격은 Yahoo 사용
async function yahooWeekly(symbol: string): Promise<{ date: string; price: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}?range=3y&interval=1wk`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
      if (!r.ok) continue
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []
      const cl: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const out: { date: string; price: number }[] = []
      for (let i = 0; i < ts.length; i++) { const c = cl[i]; if (c != null && isFinite(c) && c > 0) out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), price: Math.round(c * 100) / 100 }) }
      if (out.length > 20) return out
    } catch { /* 다음 host */ }
  }
  return []
}
// CoinMetrics 커뮤니티 API(무료·무인증) — 활성주소수(AdrActCnt). SOL 등 고성능 체인은 403(무료 미제공)이라 호출부에서 graceful
async function cmDau(asset: string): Promise<Map<string, number>> {
  try {
    const start = new Date(Date.now() - 1130 * 86400_000).toISOString().slice(0, 10)   // 약 3년
    const r = await fetch(`https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=${asset}&metrics=AdrActCnt&frequency=1d&page_size=1200&start_time=${start}`, { signal: AbortSignal.timeout(12_000) })
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

const pctChg = (a: number, b: number) => (a > 0 ? Math.round(((b / a) - 1) * 1000) / 10 : 0)

export async function GET() {
  const cacheKey = 'altcoins-v4'   // v4: 유통량(희석 리스크) 추가
  const cached = await getCache<AltcoinsResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 가격(Yahoo 3년 주봉) + 네트워크 지표(CoinMetrics DAU / DefiLlama 수수료) + 유통량(CoinGecko) 병렬 — 호스트 모두 달라 충돌 없음
  const [ethPx, solPx, xrpPx, ethDau, xrpDau, solFees, supply] = await Promise.all([
    yahooWeekly('ETH-USD'), yahooWeekly('SOL-USD'), yahooWeekly('XRP-USD'),
    cmDau('eth'), cmDau('xrp'), llamaFees('solana'), fetchSupply(),
  ])
  const pxMaps: Record<string, { date: string; price: number }[]> = { ethereum: ethPx, solana: solPx, ripple: xrpPx }
  const netMaps: Record<string, Map<string, number>> = { ethereum: ethDau, ripple: xrpDau, solana: solFees }

  const coins: AltCoin[] = []
  for (const c of COINS) {
    const weekly = pxMaps[c.id] ?? []
    if (weekly.length < 10) {
      coins.push({ id: c.id, symbol: c.symbol, name: c.name, tagline: c.tagline, netLabel: c.netLabel, netUnit: c.netUnit, price: null, priceChgPct: null, netChgPct: null, points: [], divergence: 'neutral', supplyPct: supply[c.id]?.pct ?? null, supplyNote: supply[c.id]?.note ?? '', jarvisTip: '데이터 일시 수집 실패 — 잠시 후 다시 확인하세요.', desc: c.desc })
      continue
    }
    const netMap = netMaps[c.id] ?? new Map<string, number>()
    const scale = NET_SCALE[c.source]
    // 주봉 날짜에 가장 가까운 네트워크 값(일별 DAU/수수료) — ±4일 내 탐색
    const netAt = (d: string): number | null => {
      const base = new Date(d).getTime()
      for (let off = 0; off <= 4; off++) {
        for (const s of off === 0 ? [0] : [-off, off]) {
          const key = new Date(base + s * 86400_000).toISOString().slice(0, 10)
          const v = netMap.get(key); if (v != null && isFinite(v)) return Math.round(v / scale * 100) / 100
        }
      }
      return null
    }
    const points: AltPoint[] = weekly.map(w => ({ date: w.date, price: w.price, net: netAt(w.date) }))

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
      divergence === 'hype' ? `⚠️ 최근 3년 ${c.name} 가격은 ${priceChgPct}%인데 ${netName}은 ${netChgPct}%에 그쳤습니다 — 실사용보다 기대(Hype)가 앞선 투기 프리미엄 구간일 수 있으니 추격 매수 주의.`
      : divergence === 'healthy' ? `✅ ${c.name} 가격(${priceChgPct}%)과 ${netName}(${netChgPct}%)이 함께 성장 중 — 가격이 네트워크 실사용에 뒷받침된 건강한 구간입니다.`
      : divergence === 'value' ? `🔍 ${c.name} 가격은 ${priceChgPct}%로 빠졌지만 ${netName}은 ${netChgPct}% 늘었습니다 — 실사용 대비 가격이 눌린 디커플링 구간(역사적으로 관심 가치).`
      : `${c.name} 가격(${priceChgPct ?? '—'}%)과 ${netName}(${netChgPct ?? '—'}%)에 뚜렷한 괴리는 없습니다. 가격 캔들보다 네트워크 실사용 추세를 함께 보세요.`

    const sup = supply[c.id]
    coins.push({ id: c.id, symbol: c.symbol, name: c.name, tagline: c.tagline, netLabel: c.netLabel, netUnit: c.netUnit, price, priceChgPct, netChgPct, points, divergence, supplyPct: sup?.pct ?? null, supplyNote: sup?.note ?? '', jarvisTip, desc: c.desc })
  }

  const result: AltcoinsResult = { coins, asOf: new Date().toISOString() }
  if (coins.some(c => c.points.length > 0)) await setCache(cacheKey, result)   // 전부 실패면 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
