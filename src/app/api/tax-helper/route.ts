// 💸 연말 절세 도우미 API — 올해 해외주식 확정 양도차익을 집계해 250만 공제 대비 예상 세금과
//    손실 매도(loss harvesting)·공제 여유 익절(gain harvesting) 기회를 결정론 산출 (Zero-Input·자동매매 없음)
//    ⚠️ realized_pnl은 종목 통화 기준(USD/KRW — history 페이지와 동일 관례) → 현재 환율 일괄 환산(추정치, 캐비엇 명시)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── 세법 상수(2026년 기준 — 개정 시 여기 한 곳만 수정) ──
const TAX = {
  DEDUCTION_KRW: 2_500_000,   // 해외주식 양도소득 기본공제(연·인별)
  RATE: 0.22,                 // 양도소득세 20% + 지방소득세 2%
} as const

const FALLBACK_KRW = 1350
const kstNow = () => new Date(Date.now() + 9 * 3600_000)
const kstDate = () => kstNow().toISOString().slice(0, 10)

export interface TaxHarvestItem {
  ticker: string
  name: string
  quantity: number
  avgPrice: number           // 매입 평단(USD)
  curPrice: number           // 현재가(USD)
  unrealizedKrw: number      // 평가손익(₩ 환산, 손실은 음수)
  saveKrw: number            // (loss) 전량 매도 시 세금 절약액 ₩
}
export interface TaxGainItem {
  ticker: string
  name: string
  perShareGainKrw: number    // 주당 이익(₩)
  maxQty: number             // 남은 공제 여유 내 매도 가능 주수
  useKrw: number             // 여유 활용 금액 = min(평가이익, room)
}
export interface TaxHelperResult {
  year: number
  daysLeft: number           // 12/31까지 남은 일수(KST)
  usdKrw: number
  realizedUsUsd: number      // 올해 해외 확정 손익($)
  realizedUsKrw: number      // 〃 ₩ 환산(추정)
  usSellCount: number
  realizedKrKrw: number      // 국내 실현손익(참고 — 소액주주 비과세)
  krSellCount: number
  krEtfSellCount: number     // 국내 상장 ETF 매도 건수(배당소득세 15.4% 별도 안내용)
  cryptoSellCount: number    // 코인 매도 건수(2027 과세 유예 안내용)
  deductionKrw: number       // 250만
  taxableKrw: number         // max(0, 실현 − 공제)
  estTaxKrw: number          // 초과분 × 22%
  roomKrw: number            // 남은 비과세 이익 실현 여유 = max(0, 공제 − 실현)
  harvest: TaxHarvestItem[]  // 🔻 절세 매도 후보(taxable>0일 때, 절약액 순)
  gainHarvest: TaxGainItem[] // 🟢 공제 여유 익절 후보(room>0일 때)
  asOf: string
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `tax-helper-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<TaxHelperResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const now = kstNow()
  const year = now.getUTCFullYear()
  const daysLeft = Math.max(0, Math.ceil((Date.UTC(year, 11, 31) - Date.UTC(year, now.getUTCMonth(), now.getUTCDate())) / 86_400_000))

  // ── 환율·매도내역·보유내역 병렬 조회(전부 독립 — async-parallel, 환율 8s 타임아웃이 전체를 막지 않게) ──
  let usdKrw = FALLBACK_KRW
  const [exRate, { data: sells }, { data: holdings }] = await Promise.all([
    fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) })
      .then(r => r.ok ? r.json() : null).then(j => (typeof j?.rate === 'number' && j.rate > 0 ? j.rate as number : null))
      .catch(() => null),
    sb.from('transactions')
      .select('ticker,name,market,currency,realized_pnl,transaction_date')
      .eq('user_id', user.id).eq('type', 'sell')
      .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
    sb.from('investments')
      .select('ticker,name,market,currency,purchase_price,quantity')
      .eq('user_id', user.id),
  ])
  if (exRate != null) usdKrw = exRate

  let realizedUsUsd = 0, realizedKrKrw = 0
  let usSellCount = 0, krSellCount = 0, krEtfSellCount = 0, cryptoSellCount = 0
  for (const t of sells ?? []) {
    const pnl = typeof t.realized_pnl === 'number' ? t.realized_pnl : 0
    if (t.market === 'CRYPTO') { cryptoSellCount++; continue }         // 2027 과세 유예 — 집계 제외·안내만
    if (t.currency === 'USD') { realizedUsUsd += pnl; usSellCount++ }  // 해외 양도세 그룹(주식+미국 상장 ETF)
    else {
      realizedKrKrw += pnl; krSellCount++
      if (getAssetType(t.ticker, t.name ?? '', t.market ?? 'KR') === 'ETF') krEtfSellCount++
    }
  }
  const realizedUsKrw = Math.round(realizedUsUsd * usdKrw)
  const taxableKrw = Math.max(0, realizedUsKrw - TAX.DEDUCTION_KRW)
  const estTaxKrw = Math.round(taxableKrw * TAX.RATE)
  const roomKrw = Math.max(0, TAX.DEDUCTION_KRW - realizedUsKrw)

  // ── ② 보유 US 종목 평가손익 → harvest 후보 (KR=비과세·CRYPTO=유예라 대상 아님, holdings는 위 병렬 조회분) ──
  const usHoldings = (holdings ?? []).filter(h =>
    h.market === 'US' && h.currency === 'USD' && (h.quantity ?? 0) > 0 &&
    getAssetType(h.ticker, h.name ?? '', h.market ?? '') !== 'CRYPTO')

  let prices: Record<string, number> = {}
  if (usHoldings.length) {
    try {
      const pr = await fetch(`${base}/api/stock-price`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usHoldings.map(h => ({ ticker: h.ticker, market: 'US' }))),
        signal: AbortSignal.timeout(30_000),
      })
      if (pr.ok) {
        const arr = await pr.json() as Array<{ ticker: string; currentPrice: number }>
        prices = Object.fromEntries(arr.filter(d => d.currentPrice > 0).map(d => [d.ticker.toUpperCase(), d.currentPrice]))
      }
    } catch { /* graceful — 가격 실패 종목은 후보에서 제외(추정 절약액을 지어내지 않음) */ }
  }

  const harvest: TaxHarvestItem[] = []
  const gainHarvest: TaxGainItem[] = []
  // 같은 티커 여러 행(분할매수) 병합 — 가중평단
  const merged = new Map<string, { ticker: string; name: string; qty: number; cost: number }>()
  for (const h of usHoldings) {
    const k = h.ticker.toUpperCase()
    const m = merged.get(k) ?? { ticker: h.ticker, name: h.name ?? h.ticker, qty: 0, cost: 0 }
    m.qty += h.quantity; m.cost += h.purchase_price * h.quantity
    merged.set(k, m)
  }
  for (const m of Array.from(merged.values())) {
    const cur = prices[m.ticker.toUpperCase()]
    if (!cur || m.qty <= 0) continue
    const avg = m.cost / m.qty
    const unrealizedKrw = Math.round((cur - avg) * m.qty * usdKrw)
    if (unrealizedKrw < 0 && taxableKrw > 0) {
      const saveKrw = Math.round(Math.min(-unrealizedKrw, taxableKrw) * TAX.RATE)
      if (saveKrw >= 1000) harvest.push({
        ticker: m.ticker, name: m.name, quantity: m.qty,
        avgPrice: Math.round(avg * 100) / 100, curPrice: cur, unrealizedKrw, saveKrw,
      })
    } else if (unrealizedKrw > 0 && roomKrw > 0) {
      const perShareGainKrw = Math.round((cur - avg) * usdKrw)
      if (perShareGainKrw <= 0) continue
      const maxQty = Math.floor(roomKrw / perShareGainKrw)
      if (maxQty >= 1) gainHarvest.push({
        ticker: m.ticker, name: m.name, perShareGainKrw,
        // 소수점 매매 보유(2.9685주 등) — 표시용으로 소수 2자리 절사
        maxQty: Math.floor(Math.min(maxQty, m.qty) * 100) / 100, useKrw: Math.min(unrealizedKrw, roomKrw),
      })
    }
  }
  harvest.sort((a, b) => b.saveKrw - a.saveKrw)
  gainHarvest.sort((a, b) => b.useKrw - a.useKrw)

  const result: TaxHelperResult = {
    year, daysLeft, usdKrw,
    realizedUsUsd: Math.round(realizedUsUsd * 100) / 100, realizedUsKrw, usSellCount,
    realizedKrKrw: Math.round(realizedKrKrw), krSellCount, krEtfSellCount, cryptoSellCount,
    deductionKrw: TAX.DEDUCTION_KRW, taxableKrw, estTaxKrw, roomKrw,
    harvest: harvest.slice(0, 10), gainHarvest: gainHarvest.slice(0, 6),
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
