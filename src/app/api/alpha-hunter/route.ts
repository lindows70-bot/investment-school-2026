// 🎯 알파 헌터 — 가치 성장률(이익) vs 1년 주가 수익률의 '괴리'로 저평가 기회/거품을 탐지
// "가치는 오르는데 가격이 안 따라가는 곳"이 알파. 신규 수집 0: canonical(성장률)+stock-price-history(주가)+유니버스 캐시 재사용
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getCanonicalFundamentals, isPegBaseEffect } from '@/lib/canonicalFundamentals'
import type { ScreenedStock } from '@/lib/macroPhaseScreener'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export type AlphaZone = 'alpha' | 'bubble' | 'fair' | 'caution'
export interface AlphaPoint {
  ticker: string; name: string; market: 'KR' | 'US'; held: boolean
  growthPct: number          // 이익 성장률 %(가치 축)
  priceReturn: number        // 1년 주가 수익률 %(가격 축)
  divergence: number         // 성장률 − 주가수익률 (양수=가치>가격=저평가)
  zone: AlphaZone
  baseEffect: boolean        // ⚠️ 기저효과(이익 폭증 착시) — '가짜 성장'이라 알파에서 제외
  peg: number | null
}
export interface AlphaHunterResult {
  points: AlphaPoint[]
  alpha: AlphaPoint[]        // 저평가 기회(괴리 큰 양수)
  bubble: AlphaPoint[]       // 거품(괴리 큰 음수)
  heldCount: number
  asOf: string
}

const ALPHA_TH = 20   // 괴리 ±20%p 이상이면 의미있는 신호

// 1년 주가 수익률 — stock-price-history(연평균, KR/US 처리·캐시) 재사용. 최신년/직전년
async function priceReturnYoY(base: string, ticker: string, market: 'KR' | 'US'): Promise<number | null> {
  try {
    const r = await fetch(`${base}/api/stock-price-history?ticker=${encodeURIComponent(ticker)}&market=${market}`, { signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return null
    const j = await r.json()
    const yp: Record<string, number> = j?.yearPrices ?? {}
    const yrs = Object.keys(yp).filter(y => yp[y] > 0).sort()
    if (yrs.length < 2) return null
    const last = yp[yrs[yrs.length - 1]], prev = yp[yrs[yrs.length - 2]]
    return prev > 0 ? Math.round((last / prev - 1) * 1000) / 10 : null
  } catch { return null }
}

export async function GET(req: Request) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `alpha-hunter-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<AlphaHunterResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  // 대상 = 내 보유 STOCK ∪ 추천 유니버스(점수 상위 60)
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const held = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') === 'STOCK')
  const heldKeys = new Set(held.map(h => `${h.ticker.toUpperCase()}|${h.market === 'KR' ? 'KR' : 'US'}`))

  const universe = (await getCache<ScreenedStock[]>('macro-screened-universe:v3', 7 * 24 * 3600_000)) ?? []
  const uniTop = [...universe].sort((a, b) => b.score - a.score).slice(0, 60)

  const merged = new Map<string, { ticker: string; name: string; market: 'KR' | 'US'; held: boolean }>()
  for (const h of held) { const m = (h.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'; merged.set(`${h.ticker.toUpperCase()}|${m}`, { ticker: h.ticker, name: h.name ?? h.ticker, market: m, held: true }) }
  for (const u of uniTop) { const k = `${u.ticker.toUpperCase()}|${u.market}`; if (!merged.has(k)) merged.set(k, { ticker: u.ticker, name: u.name, market: u.market, held: heldKeys.has(k) }) }
  const targets = Array.from(merged.values())

  const points: AlphaPoint[] = []
  for (let i = 0; i < targets.length; i += 6) {
    const batch = targets.slice(i, i + 6)
    const rs = await Promise.all(batch.map(async t => {
      try {
        const [cf, pr] = await Promise.all([
          getCanonicalFundamentals(t.ticker, t.market, base),
          priceReturnYoY(base, t.ticker, t.market),
        ])
        if (cf.growth == null || pr == null) return null   // 가치 또는 가격 축 없으면 제외
        const growthPct = Math.round(cf.growth * 1000) / 10
        const divergence = Math.round((growthPct - pr) * 10) / 10
        const baseEffect = isPegBaseEffect(cf.peg, cf.growth)
        const zone: AlphaZone = baseEffect ? 'caution'
          : divergence >= ALPHA_TH ? 'alpha'
          : divergence <= -ALPHA_TH ? 'bubble' : 'fair'
        return { ticker: t.ticker.toUpperCase(), name: t.name, market: t.market, held: t.held, growthPct, priceReturn: pr, divergence, zone, baseEffect, peg: cf.peg }
      } catch { return null }
    }))
    for (const r of rs) if (r) points.push(r)
  }

  const alpha = points.filter(p => p.zone === 'alpha').sort((a, b) => b.divergence - a.divergence)
  const bubble = points.filter(p => p.zone === 'bubble').sort((a, b) => a.divergence - b.divergence)

  const result: AlphaHunterResult = { points, alpha, bubble, heldCount: held.length, asOf: new Date().toISOString() }
  if (points.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
