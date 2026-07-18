// 📋 앱 신호 성적표 API — Jarvis 처방전(user_daily_briefings 이력)·타점 워처 전환(signal-history-v1)을
//    실제 주가로 자기 채점(30일 후·현재까지). "이 앱의 신호를 얼마나 믿어야 하나"를 데이터로 — 정직 원칙(가짜 승률 금지).
//    ⚠️ 이벤트 압축: Jarvis는 매일 같은 판정을 재적재(자기상관) → 연속 런의 첫날만 1이벤트(단절 >7일이면 새 이벤트).
//    가격 SSOT = techChartData(480일봉·타이밍 크론이 매일 캐시 워밍 — 추가 부하 ~0). AI 미사용·결정론.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import type { SignalHistEntry } from '@/app/api/cron/timing-watch/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10)

export type SigSrc = 'jarvis' | 'timing'
export interface SigEvent {
  date: string
  ticker: string
  name: string
  market: 'KR' | 'US'
  src: SigSrc
  kind: 'buy' | 'sell'          // jarvis BUY/SELL → buy/sell
  label: string                 // 타이밍 전환 라벨(진입 적기 돌파 등) / jarvis는 'SELL 판정' 등
  ageDays: number
  entry: number | null          // 이벤트일 이하 최근 종가
  retNow: number | null         // 현재까지 %(경과 7일 미만이면 null — 하루짜리 노이즈 배제)
  ret30: number | null          // +30일 %(30일 이상 익은 이벤트만)
}
export interface GroupStat {
  src: SigSrc
  kind: 'buy' | 'sell'
  title: string
  n: number                     // 전체 이벤트
  n7: number                    // 경과 7일+ (retNow 채점 대상)
  n30: number                   // 경과 30일+ (ret30 채점 대상)
  winNow: number | null         // 현재까지 적중률 %(buy=상승, sell=하락)
  win30: number | null          // 30일 적중률 %
  avgNow: number | null
  avg30: number | null
  best: SigEvent | null         // 신호 관점 최고 사례(buy=최대 상승 / sell=최대 하락)
  worst: SigEvent | null
  recent: SigEvent[]            // 최근 이벤트 최대 10
}
export interface SignalReportResult {
  asOf: string
  jarvisSince: string | null    // Jarvis 이력 시작일
  timingSince: string | null    // 타이밍 적립 시작일(없으면 null = 적립 중)
  groups: GroupStat[]
  tickers: number
}

// Jarvis 대상은 개별주식(STOCK)만이라 KR = 6자리 숫자 코드로 충분(영숫자 신형 코드는 ETF 전용 — 브리핑에 없음)
const isKr = (t: string) => /^\d{6}$/.test(t)

/** 이벤트일 이하 최근 종가 / null */
const closeAt = (candles: TechCandle[], date: string): number | null => {
  for (let i = candles.length - 1; i >= 0; i--) if (candles[i].date <= date) return candles[i].close
  return null
}

export async function GET() {
  const today = kstDate()
  const cacheKey = `signal-report-v1:${today}`
  const cached = await getCache<SignalReportResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ── ① Jarvis 이력 → 이벤트 압축 ──
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: rows } = await admin.from('user_daily_briefings')
    .select('base_date,ticker,stock_name,signal_type')
    .in('signal_type', ['SELL', 'BUY'])
    .order('base_date', { ascending: true })

  // (base_date,ticker) 디듀프(여러 학생이 같은 종목 보유 — 판정은 동일)
  const daily = new Map<string, { date: string; ticker: string; name: string; type: 'SELL' | 'BUY' }>()
  for (const r of rows ?? []) {
    const date = String(r.base_date).slice(0, 10)
    daily.set(`${date}:${r.ticker}`, { date, ticker: String(r.ticker), name: String(r.stock_name ?? r.ticker), type: r.signal_type as 'SELL' | 'BUY' })
  }
  // 종목별 시계열 → 연속 런 압축(첫날=이벤트, 단절 >7일 또는 판정 변경 시 새 이벤트)
  const byTicker = new Map<string, { date: string; name: string; type: 'SELL' | 'BUY' }[]>()
  for (const d of Array.from(daily.values())) {
    const arr = byTicker.get(d.ticker) ?? []
    arr.push({ date: d.date, name: d.name, type: d.type })
    byTicker.set(d.ticker, arr)
  }
  const jarvisEvents: { date: string; ticker: string; name: string; kind: 'buy' | 'sell' }[] = []
  let jarvisSince: string | null = null
  for (const [ticker, arr] of Array.from(byTicker.entries())) {
    arr.sort((a, b) => a.date.localeCompare(b.date))
    let prevDate: string | null = null, prevType: string | null = null
    for (const d of arr) {
      if (!jarvisSince || d.date < jarvisSince) jarvisSince = d.date
      const isNew = prevType !== d.type || (prevDate != null && dayDiff(prevDate, d.date) > 7)
      if (prevType == null || isNew) jarvisEvents.push({ date: d.date, ticker, name: d.name, kind: d.type === 'SELL' ? 'sell' : 'buy' })
      prevDate = d.date; prevType = d.type
    }
  }

  // ── ② 타이밍 워처 적립 이력 ──
  const hist = (await getCache<SignalHistEntry[]>('signal-history-v1', 400 * 86400_000)) ?? []
  const timingSince = hist.length ? hist.reduce((m, h) => h.date < m ? h.date : m, hist[0].date) : null

  // ── ③ 가격 수집(캔들 SSOT·동시성 4) ──
  const tickers = new Map<string, { ticker: string; market: 'KR' | 'US' }>()
  for (const e of jarvisEvents) tickers.set(e.ticker, { ticker: e.ticker, market: isKr(e.ticker) ? 'KR' : 'US' })
  for (const h of hist) tickers.set(h.ticker, { ticker: h.ticker, market: h.market })
  const candleMap = new Map<string, TechCandle[]>()
  const queue = Array.from(tickers.values())
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const it = queue.shift(); if (!it) break
      try { candleMap.set(it.ticker, await getTechCandles(it.ticker, it.market, 'D')) } catch { /* graceful — 해당 종목 채점 제외 */ }
    }
  }))

  // ── ④ 채점 ──
  const score = (date: string, ticker: string, name: string, market: 'KR' | 'US', src: SigSrc, kind: 'buy' | 'sell', label: string): SigEvent | null => {
    const candles = candleMap.get(ticker)
    if (!candles?.length) return null
    const entry = closeAt(candles, date)
    if (entry == null || entry <= 0) return null
    const ageDays = dayDiff(date, today)
    const last = candles[candles.length - 1].close
    const retNow = ageDays >= 7 ? Math.round((last / entry - 1) * 1000) / 10 : null
    let ret30: number | null = null
    if (ageDays >= 30) {
      const c30 = closeAt(candles, addDays(date, 30))
      if (c30 != null) ret30 = Math.round((c30 / entry - 1) * 1000) / 10
    }
    return { date, ticker, name, market, src, kind, label, ageDays, entry, retNow, ret30 }
  }

  const events: SigEvent[] = []
  for (const e of jarvisEvents) {
    const mkt = tickers.get(e.ticker)!.market
    const ev = score(e.date, e.ticker, e.name, mkt, 'jarvis', e.kind, e.kind === 'sell' ? 'SELL(매도검토) 판정' : 'BUY(매수기회) 판정')
    if (ev) events.push(ev)
  }
  for (const h of hist) {
    const ev = score(h.date, h.ticker, h.name, h.market, 'timing', h.kind, h.label)
    if (ev) events.push(ev)
  }

  // ── ⑤ 그룹 통계(소스×방향) — buy 승=상승 / sell 승=하락(매도검토 신호는 공매도가 아님·UI 명시) ──
  const TITLES: Record<string, string> = {
    'jarvis:sell': '🤖 Jarvis 매도검토(SELL)', 'jarvis:buy': '🤖 Jarvis 매수기회(BUY)',
    'timing:sell': '🚦 타점 매도·경계 전환', 'timing:buy': '🚦 타점 매수 전환',
  }
  const groups: GroupStat[] = []
  for (const src of ['jarvis', 'timing'] as SigSrc[]) {
    for (const kind of ['sell', 'buy'] as ('sell' | 'buy')[]) {
      const evs = events.filter(e => e.src === src && e.kind === kind).sort((a, b) => b.date.localeCompare(a.date))
      const e7 = evs.filter(e => e.retNow != null)
      const e30 = evs.filter(e => e.ret30 != null)
      const hit = (r: number) => kind === 'buy' ? r > 0 : r < 0
      const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length * 10) / 10 : null
      const sortedBySignal = e7.slice().sort((a, b) => kind === 'buy' ? (b.retNow! - a.retNow!) : (a.retNow! - b.retNow!))
      groups.push({
        src, kind, title: TITLES[`${src}:${kind}`],
        n: evs.length, n7: e7.length, n30: e30.length,
        winNow: e7.length ? Math.round(e7.filter(e => hit(e.retNow!)).length / e7.length * 100) : null,
        win30: e30.length ? Math.round(e30.filter(e => hit(e.ret30!)).length / e30.length * 100) : null,
        avgNow: avg(e7.map(e => e.retNow!)), avg30: avg(e30.map(e => e.ret30!)),
        best: sortedBySignal[0] ?? null, worst: sortedBySignal[sortedBySignal.length - 1] ?? null,
        recent: evs.slice(0, 10),
      })
    }
  }

  const result: SignalReportResult = { asOf: new Date().toISOString(), jarvisSince, timingSince, groups, tickers: tickers.size }
  // 이벤트 0건(콜드·이력 부재)이면 캐시 박제 금지
  if (events.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
