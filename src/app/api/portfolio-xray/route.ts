// 🔬 포트폴리오 X-Ray API — 보유 ETF를 구성종목·섹터로 분해해 '실질 노출도' 합산
// 직접보유 NVDA + QQQ 속 NVDA를 중복 합산 → 숨은 몰빵 발견. 섹터는 ETF 네이티브 비중(왜곡 0)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getSector } from '@/lib/schoolIndex'
import { getEtfComposition, type EtfComposition } from '@/lib/etfLookThrough'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const r1 = (n: number) => Math.round(n * 10) / 10

export interface XrayStock {
  key: string                  // 통합 키(KR 6자리 / US 심볼)
  name: string
  market: 'KR' | 'US'
  directWeight: number         // 직접 보유 비중 %
  etfWeight: number            // ETF 경유 실질 비중 %
  totalWeight: number          // 합산 실질 비중 %
  viaEtfs: string[]            // 경유한 ETF 이름들
}
export interface XrayEtfDetail {
  ticker: string; name: string; market: string
  weight: number               // 포트폴리오 내 ETF 비중 %
  isEquityEtf: boolean
  isLeveraged: boolean         // 레버리지·인버스 — 분해 부적합(스왑 구조)
  holdingsHaveWeights: boolean // false=해외주식형 KR(종목명만, 섹터로만 반영)
  topNames: string[]           // 상위 구성종목명(표시용)
  topSectors: { sector: string; weight: number }[]
  resolved: boolean            // 분해 성공 여부
}
export interface XrayResult {
  realStocks: XrayStock[]              // 실질 종목 노출(직접+ETF경유 합산, 비중순)
  realSectors: { sector: string; weight: number }[]   // 실질 섹터 노출
  etfDetails: XrayEtfDetail[]
  coverage: { directStock: number; etfDecomposed: number; etfResidual: number; other: number }
  hiddenConcentration: { name: string; totalWeight: number; directWeight: number; viaEtfs: string[] } | null
  etfTotalWeight: number
  asOf: string
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `portfolio-xray-v2:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<XrayResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 보유 전체(₩ 환산 비중) — STOCK·ETF 모두 포함
  let usdKrw = 1350
  try { const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) }); if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate } } catch { /* 폴백 */ }
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency').eq('user_id', user.id)
  const all = (rows ?? []).map(r => ({
    ticker: r.ticker, name: r.name ?? r.ticker, market: (r.market ?? 'US') as string,
    krw: (r.purchase_price ?? 0) * (r.quantity ?? 0) * (r.currency === 'USD' ? usdKrw : 1),
    type: getAssetType(r.ticker, r.name ?? '', r.market ?? ''),
  })).filter(h => h.krw > 0)
  const totalKrw = all.reduce((s, h) => s + h.krw, 0) || 1
  const isKrT = (t: string, m: string) => m === 'KR' || /^\d{6}$/.test(t.replace(/\.(KS|KQ)$/i, ''))
  const keyOf = (t: string, m: string) => isKrT(t, m) ? t.replace(/\D/g, '').padStart(6, '0').slice(-6) : t.toUpperCase().replace(/\.(KS|KQ)$/i, '')

  // ── 합산 컨테이너 ──
  const stocks = new Map<string, XrayStock>()
  const sectors = new Map<string, number>()
  const addSector = (sec: string, w: number) => { if (w > 0) sectors.set(sec, (sectors.get(sec) ?? 0) + w) }
  const addStock = (key: string, name: string, market: 'KR' | 'US', w: number, via: string | null) => {
    const e = stocks.get(key) ?? { key, name, market, directWeight: 0, etfWeight: 0, totalWeight: 0, viaEtfs: [] }
    if (via) { e.etfWeight += w; if (!e.viaEtfs.includes(via)) e.viaEtfs.push(via) } else { e.directWeight += w; e.name = name }
    e.totalWeight = e.directWeight + e.etfWeight
    stocks.set(key, e)
  }

  let directStock = 0, etfDecomposed = 0, etfResidual = 0, other = 0
  const etfDetails: XrayEtfDetail[] = []
  const directStocks = all.filter(h => h.type === 'STOCK')
  const etfs = all.filter(h => h.type === 'ETF')

  // ① 직접 보유 주식 — 그대로 통과 + 섹터(7일 캐시 재사용)
  const dirSectors = await Promise.all(directStocks.map(h => getSector(h.ticker, h.market).catch(() => '')))
  directStocks.forEach((h, i) => {
    const w = r1(h.krw / totalKrw * 100)
    directStock += w
    addStock(keyOf(h.ticker, h.market), h.name, isKrT(h.ticker, h.market) ? 'KR' : 'US', w, null)
    addSector(dirSectors[i] || '기타', w)
  })

  // ② ETF — Look-through 분해(동시성 4)
  const comps: (EtfComposition | null)[] = []
  for (let i = 0; i < etfs.length; i += 4)
    comps.push(...await Promise.all(etfs.slice(i, i + 4).map(h => getEtfComposition(h.ticker, h.market).catch(() => null))))
  etfs.forEach((h, i) => {
    const w = r1(h.krw / totalKrw * 100)
    const c = comps[i]
    if (!c || !c.isEquityEtf || c.isLeveraged || c.sectorWeights.length === 0) {
      // 분해 불가(채권·원자재·레버리지·데이터없음) → 정직하게 '기타'. 레버리지는 스왑 구조라 구성종목이 실노출(2X) 왜곡
      other += w
      etfDetails.push({ ticker: h.ticker, name: c?.name ?? h.name, market: h.market, weight: w, isEquityEtf: c?.isEquityEtf ?? false, isLeveraged: c?.isLeveraged ?? false, holdingsHaveWeights: false, topNames: (c?.topHoldings ?? []).slice(0, 5).map(x => x.name), topSectors: [], resolved: false })
      return
    }
    // 섹터 — 네이티브 비중 그대로(합 ~100, 왜곡 0)
    const secSum = c.sectorWeights.reduce((s, x) => s + x.weight, 0) || 100
    for (const s of c.sectorWeights) addSector(s.sector, w * s.weight / secSum)
    // 종목 — 비중 있는 ETF만 원시 비중으로 주입, 나머지는 '기타 분산'(잔여)
    if (c.holdingsHaveWeights && c.topWeightSum != null) {
      for (const t of c.topHoldings) {
        if (t.weight == null) continue
        const cw = r1(w * t.weight / 100)
        addStock(t.ticker ?? t.name, t.name, c.market, cw, c.name)
      }
      etfDecomposed += r1(w * c.topWeightSum / 100)
      etfResidual += r1(w * (100 - c.topWeightSum) / 100)
    } else {
      etfResidual += w   // 해외주식형 KR — 종목 비중 미제공(섹터로만 반영, 추정 금지)
    }
    etfDetails.push({
      ticker: h.ticker, name: c.name, market: h.market, weight: w, isEquityEtf: true, isLeveraged: false,
      holdingsHaveWeights: c.holdingsHaveWeights, topNames: c.topHoldings.slice(0, 5).map(x => x.name),
      topSectors: c.sectorWeights.slice(0, 3), resolved: true,
    })
  })

  // ③ 비주식 자산(코인·원자재) → 기타
  for (const h of all.filter(x => x.type !== 'STOCK' && x.type !== 'ETF')) other += r1(h.krw / totalKrw * 100)

  const realStocks = Array.from(stocks.values()).sort((a, b) => b.totalWeight - a.totalWeight).slice(0, 15)
    .map(s => ({ ...s, directWeight: r1(s.directWeight), etfWeight: r1(s.etfWeight), totalWeight: r1(s.totalWeight) }))
  const realSectors = Array.from(sectors.entries()).map(([sector, weight]) => ({ sector, weight: r1(weight) })).sort((a, b) => b.weight - a.weight)
  // 숨은 몰빵: ETF 경유 비중이 있고 합산이 가장 큰 종목(직접+경유 합산 15%↑일 때만 경고)
  const hc = realStocks.find(s => s.etfWeight > 0 && s.totalWeight >= 15)
  const result: XrayResult = {
    realStocks, realSectors, etfDetails,
    coverage: { directStock: r1(directStock), etfDecomposed: r1(etfDecomposed), etfResidual: r1(etfResidual), other: r1(other) },
    hiddenConcentration: hc ? { name: hc.name, totalWeight: hc.totalWeight, directWeight: hc.directWeight, viaEtfs: hc.viaEtfs } : null,
    etfTotalWeight: r1(etfs.reduce((s, h) => s + h.krw / totalKrw * 100, 0)),
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
