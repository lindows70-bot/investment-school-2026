// 🛡️ 막스 리스크 재정의 — 내 종목을 '견뎌야 할 변동성' vs '잘라야 할 영구손실'로 분류.
//    막스: "리스크는 가격 변동성이 아니라 영구적 원금 손실 가능성. 무서워서 투매하면 손실을 확정한다."
//    새 판정기 0개(제1·2원칙): buildSignalMetrics(적자·FCF·좀비·ROE부풀림·재고) + getMoatBreach(해자붕괴) 재사용.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { getMoatBreach } from '@/app/actions/getMoatBreach'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface LossEntry {
  ticker: string; name: string; market: 'KR' | 'US'
  category: 'permanent' | 'volatility'   // 🔴 영구손실 위험 / 🟢 단순 변동성
  reasons: string[]                       // 영구손실 신호(있으면) — 왜 잘라야 하는지
  priceTrend: 'up' | 'side' | 'down' | 'unknown'
  note: string                            // 막스식 한 줄 처방
}
export interface PermanentLossResult {
  entries: LossEntry[]
  permanentCount: number; volatilityCount: number
  asOf: string
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `permanent-loss-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<PermanentLossResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const seen = new Set<string>()
  const stocks = (rows ?? []).filter(r => {
    const k = String(r.ticker).toUpperCase()
    if (seen.has(k) || getAssetType(r.ticker, r.name ?? '', r.market ?? 'US') !== 'STOCK') return false
    seen.add(k); return true
  })
  if (!stocks.length)
    return NextResponse.json({ entries: [], permanentCount: 0, volatilityCount: 0, asOf: new Date().toISOString() })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const entries: LossEntry[] = []
  for (let i = 0; i < stocks.length; i += 4) {
    const batch = stocks.slice(i, i + 4)
    const part = await Promise.all(batch.map(async s => {
      const market = (s.market === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
      const name = s.name ?? s.ticker
      const [m, moat] = await Promise.all([
        buildSignalMetrics(s.ticker, market, name, base).catch(() => null),
        getMoatBreach({ ticker: s.ticker, name, market }).catch(() => null),
      ])
      if (!m) return null
      // 영구손실 신호(펀더멘탈 훼손 — 잘라야 할 것). 변동성(견뎌야 할 것)과 구분.
      const reasons: string[] = []
      if (m.opMargin != null && m.opMargin < 0) reasons.push('영업적자(이익 실체 없음)')
      if (m.fcfNegative) reasons.push('FCF 적자(현금 유출)')
      if (m.interestCoverage != null && m.interestCoverage < 1.5) reasons.push(`좀비(이자보상배율 ${m.interestCoverage.toFixed(1)}<1.5)`)
      if (moat?.verdict === 'breach') reasons.push('해자 붕괴(가격결정력 침식)')
      if (m.roeInflated) reasons.push(`ROE 부풀림(진짜 ROIC ${Math.round(m.roic ?? 0)}%)`)
      if (m.inventoryBuildup) reasons.push('재고 적체(수요 둔화 선행)')
      const category: LossEntry['category'] = reasons.length > 0 ? 'permanent' : 'volatility'
      const note = category === 'permanent'
        ? 'thesis(투자 논거)가 훼손 중 — 손절 기준을 명확히. 물타기 금물.'
        : (m.priceTrend === 'down'
            ? '펀더멘탈은 멀쩡한데 주가만 하락 — 무서워서 팔면 손실을 확정한다. 변동성은 견디는 것.'
            : '영구손실 신호 없음 — 단기 등락은 리스크가 아니라 노이즈.')
      return { ticker: s.ticker.toUpperCase(), name, market, category, reasons, priceTrend: m.priceTrend, note }
    }))
    entries.push(...part.filter((x): x is LossEntry => x != null))
  }
  // 영구손실 먼저(경고 우선), 그 안에서 신호 많은 순
  entries.sort((a, b) => (a.category === b.category ? b.reasons.length - a.reasons.length : a.category === 'permanent' ? -1 : 1))

  const result: PermanentLossResult = {
    entries,
    permanentCount: entries.filter(e => e.category === 'permanent').length,
    volatilityCount: entries.filter(e => e.category === 'volatility').length,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
