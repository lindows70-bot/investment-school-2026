// 🧬 피터 린치 7대 종목 분류 Matrix & 함정 레이더 API — 보유 주식을 MECE(상호배타) 단일 카테고리로 분류
// 핵심 가드: ①티커 병합(분할매수 여러 행→1종목) ②카테고리 단판 우선순위(사용자 지정>펀더멘탈 자동>미분류)
// ③함정 레이더 = canonicalFundamentals.isPegBaseEffect SSOT 재사용(BP 0.01 사건과 동일 기준 — 제2원칙)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getCanonicalFundamentals, isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { LYNCH_CATEGORY_KR, type LynchCategoryKey } from '@/lib/lynchAnalysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FALLBACK_KRW = 1350
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 경기순환 GICS 섹터(Yahoo 표기) — seasonNavigator favored와 동일 어휘 체계
const CYCLICAL_SECTORS = new Set(['Energy', 'Basic Materials', 'Industrials', 'Financial Services', 'Consumer Cyclical'])

export interface LynchMatrixItem {
  ticker: string
  name: string
  market: 'US' | 'KR'
  weightPct: number              // 주식 합 100 기준 비중
  peg: number | null
  growthPct: number | null       // 이익성장률 %(소수→% 변환)
  source: 'user' | 'auto'        // 분류 출처(사용자 지정 vs 펀더멘탈 자동)
  trap: boolean                  // ⚠️ 기저효과 저PEG 함정(린치의 경기순환주 경고)
}
export interface LynchMatrixCategory {
  key: LynchCategoryKey
  label: string
  weightPct: number
  items: LynchMatrixItem[]
}
export interface LynchMatrixResult {
  categories: LynchMatrixCategory[]   // 비중 내림차순 · 빈 카테고리 제외
  traps: { ticker: string; name: string; categoryLabel: string; peg: number | null; growthPct: number | null; reason: string }[]
  totalStocks: number
  asOf: string
}

// MECE 단판 분류 — 한 종목은 정확히 1개 카테고리. 우선순위: 사용자 지정 > 펀더멘탈 자동 > 미분류
function classify(
  userCat: string | null,
  growth: number | null,           // 소수(0.25=25%)
  sector: string | null,
): { cat: LynchCategoryKey; source: 'user' | 'auto' } {
  const valid: LynchCategoryKey[] = ['fast_grower', 'stalwart', 'slow_grower', 'cyclical', 'turnaround', 'asset_play']
  if (userCat && (valid as string[]).includes(userCat)) return { cat: userCat as LynchCategoryKey, source: 'user' }
  // 자동 분류(위→아래 첫 매치 단판 — 중복 소속 원천 불가)
  const cyc = sector != null && CYCLICAL_SECTORS.has(sector)
  if (growth != null) {
    if (growth < -0.10) return { cat: 'turnaround', source: 'auto' }            // 이익 붕괴 → 회복 베팅 영역
    if (cyc) return { cat: 'cyclical', source: 'auto' }                          // 경기민감 섹터는 성장률보다 사이클이 정체성
    if (growth >= 0.20) return { cat: 'fast_grower', source: 'auto' }
    if (growth >= 0.10) return { cat: 'stalwart', source: 'auto' }
    return { cat: 'slow_grower', source: 'auto' }
  }
  if (cyc) return { cat: 'cyclical', source: 'auto' }
  return { cat: 'na', source: 'auto' }
}

const isKr = (ticker: string, market?: string) => market === 'KR' || /^\d{6}$/.test(ticker.replace(/\.(KS|KQ)$/i, ''))

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `lynch-matrix-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<LynchMatrixResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 환율(₩환산 비중) — season-navigator와 동일 패턴
  let usdKrw = FALLBACK_KRW
  try {
    const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) })
    if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate }
  } catch { /* 폴백 1350 */ }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments')
    .select('ticker,name,market,purchase_price,quantity,currency,lynch_category').eq('user_id', user.id)
  const stocks = (rows ?? []).filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'STOCK')

  // ① 티커 병합 — 분할매수 여러 행을 1종목으로. 카테고리 충돌 시 비중 최대 행의 지정을 채택(MECE 1단계)
  type Merged = { ticker: string; name: string; market: 'US' | 'KR'; weight: number; userCat: string | null; maxRowW: number }
  const merged = new Map<string, Merged>()
  for (const r of stocks) {
    const code = r.ticker.replace(/\.(KS|KQ)$/i, '').toUpperCase()
    const w = (r.purchase_price ?? 0) * (r.quantity ?? 0) * (r.currency === 'USD' ? usdKrw : 1)
    if (w <= 0) continue
    const prev = merged.get(code)
    if (!prev) {
      merged.set(code, { ticker: r.ticker, name: r.name ?? r.ticker, market: isKr(r.ticker, r.market ?? undefined) ? 'KR' : 'US', weight: w, userCat: r.lynch_category ?? null, maxRowW: w })
    } else {
      prev.weight += w
      if (w > prev.maxRowW && r.lynch_category) { prev.userCat = r.lynch_category; prev.maxRowW = w }
    }
  }
  const holdings = Array.from(merged.values())
  const totalW = holdings.reduce((s, h) => s + h.weight, 0) || 1

  // ② SSOT 펀더멘탈 병렬 수집(canon-fund 캐시 공유 → 대부분 즉시)
  const funds = await Promise.all(holdings.map(h => getCanonicalFundamentals(h.ticker, h.market, base).catch(() => null)))

  // ③ MECE 단판 분류 + 함정 레이더
  const catMap = new Map<LynchCategoryKey, LynchMatrixItem[]>()
  const traps: LynchMatrixResult['traps'] = []
  holdings.forEach((h, i) => {
    const f = funds[i]
    const { cat, source } = classify(h.userCat, f?.growth ?? null, f?.sector ?? null)
    const trap = isPegBaseEffect(f?.peg ?? null, f?.growth ?? null)
    const item: LynchMatrixItem = {
      ticker: h.ticker, name: h.name, market: h.market,
      weightPct: Math.round((h.weight / totalW) * 1000) / 10,
      peg: f?.peg ?? null,
      growthPct: f?.growth != null ? Math.round(f.growth * 1000) / 10 : null,
      source, trap,
    }
    if (!catMap.has(cat)) catMap.set(cat, [])
    catMap.get(cat)!.push(item)
    if (trap) {
      traps.push({
        ticker: h.ticker, name: h.name, categoryLabel: LYNCH_CATEGORY_KR[cat] ?? cat,
        peg: item.peg, growthPct: item.growthPct,
        reason: `성장률 +${item.growthPct}%는 작년 이익 붕괴 후 회복(기저효과)일 가능성이 높습니다. PEG ${item.peg}는 '진짜 저평가'가 아니라 분모(성장률)가 일시적으로 부푼 착시 — 린치는 경기순환주를 이익 정점(저PER·저PEG처럼 보일 때)에 사는 것을 최악의 실수로 꼽았습니다.`,
      })
    }
  })

  const categories: LynchMatrixCategory[] = Array.from(catMap.entries())
    .map(([key, items]) => ({
      key, label: LYNCH_CATEGORY_KR[key] ?? key,
      weightPct: Math.round(items.reduce((s: number, x: LynchMatrixItem) => s + x.weightPct, 0) * 10) / 10,
      items: items.sort((a: LynchMatrixItem, b: LynchMatrixItem) => b.weightPct - a.weightPct),
    }))
    .sort((a, b) => b.weightPct - a.weightPct)

  const result: LynchMatrixResult = { categories, traps, totalStocks: holdings.length, asOf: new Date().toISOString() }
  if (holdings.length > 0) await setCache(cacheKey, result)   // 빈 포폴 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
