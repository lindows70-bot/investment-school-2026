// 📅 내 종목 이벤트 캘린더 API — 보유 종목의 어닝 D-day·배당락·지급일 타임라인 + 연간/월별 예상 배당 현금흐름
//    소스: Yahoo calendarEvents(어닝·배당락 — sectorEngine 검증 패턴)·summaryDetail(연배당)·chart events=div(지급 이력 12M 투영)
//    ⚠️ 정직: 어닝일은 수시 변경·KR 실적일 무료 미제공·월별 배당은 과거 패턴 투영 추정(캐비엇 UI 명시). Zero-Input·결정론.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const FALLBACK_KRW = 1350

export type EventType = 'earnings' | 'exDiv' | 'payDiv'
export interface CalEvent {
  type: EventType
  date: string          // YYYY-MM-DD
  dDay: number          // 오늘 기준 D-day(0=오늘)
  ticker: string
  name: string
  market: 'KR' | 'US'
  perShare: number | null   // 배당 이벤트: 주당 배당(현지 통화) — 어닝은 null
}
export interface DivHolding {
  ticker: string
  name: string
  market: 'KR' | 'US'
  quantity: number
  annualPerShare: number     // 주당 연 배당(현지 통화)
  annualKrw: number
  yieldPct: number | null
}
export interface MonthFlow { month: string; krw: number }   // 'YYYY-MM'
export interface EventCalendarResult {
  asOf: string
  usdKrw: number
  events: CalEvent[]         // 향후 90일, D-day 오름차순
  annualDivKrw: number
  divHoldings: DivHolding[]  // 배당 있는 종목만(연간₩ 내림차순)
  monthly: MonthFlow[]       // 향후 12개월 투영
  scanned: number
  krNoEarnings: boolean      // KR 보유가 있는데 어닝 일자를 못 구했는가(캐비엇 표시용)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `event-calendar-v1:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<EventCalendarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  let usdKrw = FALLBACK_KRW
  try {
    const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) })
    if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate }
  } catch { /* 폴백 */ }

  const { data: rows } = await sb.from('investments')
    .select('ticker,name,market,currency,quantity').eq('user_id', user.id)
  // 주식+ETF(어닝은 주식만·배당은 둘 다), 크립토·원자재 제외 / 같은 티커 수량 병합
  const merged = new Map<string, { ticker: string; name: string; market: 'KR' | 'US'; qty: number; isStock: boolean }>()
  for (const r of rows ?? []) {
    const mkt = String(r.market ?? '').toUpperCase()
    if (mkt !== 'KR' && mkt !== 'US') continue
    const at = getAssetType(r.ticker, r.name ?? '', mkt)
    if (at !== 'STOCK' && at !== 'ETF') continue
    const k = `${r.ticker.toUpperCase()}:${mkt}`
    const m = merged.get(k) ?? { ticker: String(r.ticker), name: String(r.name ?? r.ticker), market: mkt as 'KR' | 'US', qty: 0, isStock: at === 'STOCK' }
    m.qty += r.quantity ?? 0
    merged.set(k, m)
  }
  const list = Array.from(merged.values()).filter(h => h.qty > 0)

  const { default: YF } = await import('yahoo-finance2')
  const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })

  const today = kstDate()
  const todayMs = Date.parse(today)
  const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const dDayOf = (ms: number) => Math.round((Date.parse(dayOf(ms)) - todayMs) / 86_400_000)

  const events: CalEvent[] = []
  const divHoldings: DivHolding[] = []
  const monthlyMap = new Map<string, number>()
  let krEarningsFound = false

  const oneYearAgo = new Date(Date.now() - 370 * 86_400_000)
  const queue = [...list]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const h = queue.shift(); if (!h) break
      const fx = h.market === 'KR' ? 1 : usdKrw
      const symbols = h.market === 'KR' ? [`${h.ticker}.KS`, `${h.ticker}.KQ`] : [h.ticker]
      for (const sym of symbols) {
        try {
          const qs = await yf.quoteSummary(sym, { modules: ['calendarEvents', 'summaryDetail'] }, { validateResult: false })
          const cal = qs?.calendarEvents, sd = qs?.summaryDetail
          if (!cal && !sd) continue
          // 🎯 어닝(주식만)
          if (h.isStock) {
            const ed = cal?.earnings?.earningsDate
            const d = Array.isArray(ed) && ed.length ? new Date(ed[0]).getTime() : NaN
            if (isFinite(d)) {
              const dd = dDayOf(d)
              if (dd >= 0 && dd <= 90) events.push({ type: 'earnings', date: dayOf(d), dDay: dd, ticker: h.ticker, name: h.name, market: h.market, perShare: null })
              if (h.market === 'KR') krEarningsFound = true
            }
          }
          // 💰 배당락·지급일 + 연 배당
          const rate = typeof sd?.dividendRate === 'number' && sd.dividendRate > 0 ? sd.dividendRate : null
          const yieldPct = typeof sd?.dividendYield === 'number' && sd.dividendYield > 0
            ? Math.round((sd.dividendYield > 1 ? sd.dividendYield : sd.dividendYield * 100) * 100) / 100 : null
          for (const [field, type] of [['exDividendDate', 'exDiv'], ['dividendDate', 'payDiv']] as const) {
            const v = cal?.[field]
            const ms = v ? new Date(v).getTime() : NaN
            if (isFinite(ms)) {
              const dd = dDayOf(ms)
              if (dd >= 0 && dd <= 90) events.push({ type, date: dayOf(ms), dDay: dd, ticker: h.ticker, name: h.name, market: h.market, perShare: rate })
            }
          }
          if (rate != null) {
            divHoldings.push({
              ticker: h.ticker, name: h.name, market: h.market, quantity: h.qty,
              annualPerShare: rate, annualKrw: Math.round(rate * h.qty * fx), yieldPct,
            })
            // 💵 월별 투영 — 최근 12개월 지급 이력을 다음 해 같은 달로
            try {
              const ch = await yf.chart(sym, { period1: oneYearAgo, period2: new Date(), events: 'div' }, { validateResult: false })
              const divsRaw = ch?.events?.dividends
              const divs: { amount: number; date: Date | number }[] = Array.isArray(divsRaw) ? divsRaw : divsRaw ? Object.values(divsRaw) : []
              for (const dv of divs) {
                const ms = dv?.date instanceof Date ? dv.date.getTime() : typeof dv?.date === 'number' ? dv.date * (dv.date < 1e12 ? 1000 : 1) : NaN
                const amt = typeof dv?.amount === 'number' ? dv.amount : NaN
                if (!isFinite(ms) || !isFinite(amt) || amt <= 0) continue
                const next = new Date(ms); next.setUTCFullYear(next.getUTCFullYear() + 1)
                if (next.getTime() < todayMs) continue
                const mKey = next.toISOString().slice(0, 7)
                monthlyMap.set(mKey, (monthlyMap.get(mKey) ?? 0) + amt * h.qty * fx)
              }
            } catch { /* 이력 실패 — 연간 합계는 유지 */ }
          }
          break   // 심볼 폴백 성공 시 종료
        } catch { /* 다음 심볼 폴백 */ }
      }
    }
  }))

  events.sort((a, b) => a.dDay - b.dDay)
  divHoldings.sort((a, b) => b.annualKrw - a.annualKrw)
  const monthly: MonthFlow[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(todayMs); d.setUTCMonth(d.getUTCMonth() + i)
    const mKey = d.toISOString().slice(0, 7)
    monthly.push({ month: mKey, krw: Math.round(monthlyMap.get(mKey) ?? 0) })
  }

  const result: EventCalendarResult = {
    asOf: new Date().toISOString(), usdKrw,
    events, annualDivKrw: divHoldings.reduce((s, h) => s + h.annualKrw, 0),
    divHoldings, monthly, scanned: list.length,
    krNoEarnings: list.some(h => h.market === 'KR' && h.isStock) && !krEarningsFound,
  }
  if (list.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
