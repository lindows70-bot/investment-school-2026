'use client'
// 배우기 '오늘 알려드려요' — 오늘 규칙 순서(tipRuleOrder)대로 한 규칙씩 원천을 불러, 문장이 나오는 첫 규칙에서 멈춘다(무거운 원천을 한꺼번에 부르지 않는다)
//   ① PER: 개별 주식 최대 5종 stock-info + (미국만) 동종 기업 비교 ② 산 뒤 대 지수: 내 거래 기록(본인 것만) + 지수 일봉
//   ③ 일정: event-calendar ④ 크게 움직인 종목: day-movers + (고른 종목이 개별 주식이면) news-catalyst 한 번
//   ③·④ 원천은 페이지가 매매 브리핑 카드와 함께 쓴다(같은 원천을 두 번 부르지 않게) — want* 로 켜 달라고 알린다.
//   개인 데이터(보유·거래)는 브라우저 Supabase(RLS) + user_id 로만 읽고 공유 캐시에 두지 않는다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAssetType } from '@/lib/assetClassifier'
import { pickTip, tipRuleOrder, type Tip, type TipInputs, type TipKind } from '@/lib/learnTips'
import { dayNum, singleBuyHoldings, indexFor, buildVsIndexRow, type DatedClose, type IndexChoice } from '@/lib/learnTipsData'
import type { TradeRow } from '@/lib/lotsFromTrades'
import { getSectorPeers } from '@/app/actions/getSectorPeers'
import type { MyPortfolio } from '@/app/components/student/useMyPortfolio'
import type { JsonResult, JsonState } from '@/app/components/student/useJson'
import type { CalendarResp, MoversResp } from '@/app/components/student/home/homeUi'

export type TipStatus = 'waiting' | 'unauth' | 'noHoldings' | 'loading' | 'tip' | 'none' | 'failed'
export interface TodayTip {
  status: TipStatus
  tip: Tip | null
  /** 이야기가 없거나 고른 뒤라도 — 시도한 원천 중 못 가져온 것이 있었다 */
  partialFail: boolean
  /** 링크용 종목 이름(Tip 에는 이름 필드가 없다) */
  nameOf: (ticker: string) => string | null
  retry: () => void
}

type Field = 'per' | 'vsIndex' | 'events' | 'movers'
const FIELD: Record<TipKind, Field> = { per: 'per', vsIndex: 'vsIndex', event: 'events', mover: 'movers' }
const EMPTY: TipInputs = { per: null, vsIndex: null, events: null, movers: null }
const PER_MAX = 5          // PER 은 개별 주식 최대 5종만 부른다(종목마다 stock-info + 동종 비교)
const PAGE = 1000          // Supabase select 기본 상한 — 빈 페이지가 올 때까지 넘긴다
const TX_COLS = 'ticker,name,market,currency,type,price,quantity,transaction_date,created_at,memo'
const EVENT_TYPES = new Set(['earnings', 'exDiv', 'payDiv'])

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const up = (t: string) => t.trim().toUpperCase()
/** 규칙 원천을 못 가져왔다 — 다음 규칙으로 넘어가되 '못 가져옴'으로 센다 */
class SourceFailed extends Error {}

interface Run {
  key: string
  step: number
  inputs: TipInputs
  failed: TipKind[]
  tip: Tip | null
  done: boolean
}

/** ① PER — 개별 주식만(ETF·코인은 PER 이 없다), 티커순으로 줄 세워 날마다 시작점을 옮겨 5종. 미국은 동종 기업 중앙값까지 */
async function loadPer(holdings: MyPortfolio['holdings'], today: string): Promise<NonNullable<TipInputs['per']>> {
  const seen = new Set<string>()
  const stocks = holdings
    .filter(h => getAssetType(h.ticker, h.name ?? '', h.market) === 'STOCK')
    .filter(h => { const k = up(h.ticker); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => up(a.ticker).localeCompare(up(b.ticker)))
  if (!stocks.length) return []
  const off = ((dayNum(today) % stocks.length) + stocks.length) % stocks.length
  const pick = stocks.slice(off).concat(stocks.slice(0, off)).slice(0, PER_MAX)
  const rows = await Promise.all(pick.map(async h => {
    try {
      const r = await fetch(`/api/stock-info?ticker=${encodeURIComponent(h.ticker)}&market=${encodeURIComponent(h.market)}`, { cache: 'no-store' })
      if (!r.ok) return null
      const j = await r.json().catch(() => null) as { fundamentals?: { pe?: unknown } } | null
      if (!j) return null
      // pe 는 숫자 또는 'N/A' — 양수만 PER 로 본다. 무슨 이익 기준인지 응답이 말하지 않으므로 peBasis 는 넣지 않는다
      const rawPe = j.fundamentals?.pe
      const pe = isNum(rawPe) && rawPe > 0 ? rawPe : null
      let perMedian: number | null = null, perCount = 0, targetPeSameBasis: number | null = null
      if (pe != null && h.market === 'US') {
        // 동종 비교는 곁들이는 것 — 실패해도 PER 한 줄은 낸다(비교 문장만 빠진다)
        const p = await getSectorPeers({ ticker: h.ticker, name: h.name, market: h.market }).catch(() => null)
        if (p && p.status !== 'error') {
          perMedian = isNum(p.perMedian) ? p.perMedian : null
          perCount = isNum(p.perCount) ? p.perCount : 0
          targetPeSameBasis = isNum(p.targetPe) ? p.targetPe : null
        }
      }
      return { ticker: h.ticker, name: h.name, market: h.market, pe, perMedian, perCount, targetPeSameBasis }
    } catch { return null }
  }))
  const ok = rows.filter((x): x is NonNullable<typeof x> => x != null)
  if (!ok.length) throw new SourceFailed('per')
  return ok
}

/** ② 산 뒤 대 지수 — 한 번만 사고 판 적 없는 개별 주식 중 지금 시세가 있는 것만, 필요한 지수 일봉만 한 번씩 */
async function loadVsIndex(pf: MyPortfolio, today: string): Promise<NonNullable<TipInputs['vsIndex']>> {
  if (pf.state !== 'ready' || !pf.summary) throw new SourceFailed('vsIndex')   // 시세를 못 받았으면 비교할 '지금'이 없다
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new SourceFailed('vsIndex')
  const trades: TradeRow[] = []
  // 본인 거래만(선생님 계정은 RLS 상 전원 것이 보인다) — 빈 페이지가 올 때까지, 다음 시작점은 받은 만큼만
  for (let from = 0; ;) {
    const { data, error } = await sb.from('transactions').select(TX_COLS).eq('user_id', user.id)
      .order('transaction_date', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new SourceFailed('vsIndex')
    const page = (data ?? []) as TradeRow[]
    if (page.length === 0) break
    for (const r of page) trades.push(r)
    from += page.length
  }
  const cands = singleBuyHoldings(trades, pf.holdings.map(h => ({
    ticker: h.ticker, name: h.name, market: h.market, currency: h.currency,
    quantity: h.quantity, purchase_price: h.purchase_price, purchase_date: h.purchase_date,
  })))
  // 지난 캐시 시세(stale)는 '지금 시세'가 아니므로 쓰지 않는다
  const rowBy = new Map(pf.summary.rows.map(r => [up(r.ticker), r]))
  const ready = cands.flatMap(b => {
    const r = rowBy.get(up(b.ticker))
    const idx = indexFor(b.ticker, b.market)
    return r && r.priced && !r.stale && isNum(r.currentPrice) && idx ? [{ b, price: r.currentPrice, idx }] : []
  })
  if (!ready.length) {
    if (cands.length && pf.pricesFailed) throw new SourceFailed('vsIndex')
    return []
  }
  const symbols = Array.from(new Set(ready.map(x => x.idx.symbol)))
  const candles = new Map<IndexChoice['symbol'], DatedClose[]>()
  await Promise.all(symbols.map(async sym => {
    try {
      const r = await fetch(`/api/tech-chart?ticker=${encodeURIComponent(sym)}&market=US&tf=D`, { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json().catch(() => null) as { candles?: unknown } | null
      if (j && Array.isArray(j.candles)) candles.set(sym, j.candles as DatedClose[])
    } catch { /* 이 지수만 빠진다 */ }
  }))
  if (candles.size === 0) throw new SourceFailed('vsIndex')
  const nowMs = Date.now()   // 효과(effect) 안에서만 — 렌더 중 시계를 보지 않는다
  return ready.flatMap(({ b, price, idx }) => {
    const c = candles.get(idx.symbol)
    const row = c ? buildVsIndexRow(b, price, idx, c, today, nowMs) : null
    return row ? [row] : []
  })
}

/** ③ 일정 — event-calendar 응답을 모양 검사해 옮긴다. 못 가져오면 null */
function eventsFrom(calendar: JsonResult<CalendarResp>): TipInputs['events'] {
  if (calendar.state !== 'ok' || !Array.isArray(calendar.data?.events)) return null
  return (calendar.data.events as unknown[]).flatMap(x => {
    const e = x as Record<string, unknown> | null
    if (!e || typeof e.type !== 'string' || !EVENT_TYPES.has(e.type) || typeof e.date !== 'string' || typeof e.ticker !== 'string' || typeof e.name !== 'string') return []
    return [{ type: e.type as 'earnings' | 'exDiv' | 'payDiv', date: e.date, ticker: e.ticker, name: e.name, ...(typeof e.market === 'string' ? { market: e.market } : {}) }]
  })
}

/** ④ 크게 움직인 내 종목 — day-movers 는 ±5% 넘은 것만 싣는다. 비트코인(보유 안 함)은 held=false 라 빠진다.
 *  asOf 는 요청 시각이지 등락이 일어난 거래일이 아니다(주말·장 전엔 지난 거래일 등락) → tradeDate 는 모름(null) */
function moversFrom(movers: JsonResult<MoversResp>): TipInputs['movers'] {
  const md = movers.data
  if (movers.state !== 'ok' || !md || !Array.isArray(md.surges) || !Array.isArray(md.drops)) return null
  return [...md.surges, ...md.drops].flatMap(m => m && m.held === true && typeof m.ticker === 'string' && typeof m.name === 'string' && isNum(m.changePct)
    ? [{ ticker: m.ticker, name: m.name, market: typeof m.market === 'string' ? m.market : 'US', changePct: m.changePct, headline: null, tradeDate: null, held: true }]
    : [])
}

/** 고른 종목의 최근 뉴스 제목 1개 — news-catalyst 는 내 개별 주식 전체를 한 번에 준다. 못 가져오거나 없으면 null */
async function firstHeadline(ticker: string): Promise<string | null> {
  try {
    const r = await fetch('/api/news-catalyst', { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json().catch(() => null) as { catalysts?: unknown } | null
    if (!j || !Array.isArray(j.catalysts)) return null
    const c = (j.catalysts as { ticker?: unknown; headlines?: unknown }[]).find(x => typeof x?.ticker === 'string' && up(x.ticker) === up(ticker))
    const h = Array.isArray(c?.headlines) ? (c.headlines as unknown[]).find((s): s is string => typeof s === 'string' && s.trim() !== '') : undefined
    return h ?? null
  } catch { return null }
}

export function useTodayTip({ today, pf, calendar, movers, wantCalendar, wantMovers }: {
  today: string | null
  pf: MyPortfolio
  calendar: JsonResult<CalendarResp>
  movers: JsonResult<MoversResp>
  /** 이 규칙 차례가 오면 페이지에 원천을 켜 달라고 알린다(한 번 켜면 끄지 않는다 — 끄면 매매 브리핑이 쓰던 응답도 사라진다) */
  wantCalendar: () => void
  wantMovers: () => void
}): TodayTip {
  const [tick, setTick] = useState(0)
  const holdKey = pf.holdings.map(h => `${h.id}|${h.ticker}|${h.quantity}|${h.purchase_price}`).join(',')
  const active = today != null && (pf.state === 'ready' || pf.state === 'failed') && !(pf.state === 'ready' && pf.holdings.length === 0)
  const key = `${today}#${pf.state}#${holdKey}#${tick}`
  const order = today ? tipRuleOrder(today) : []
  const [run, setRun] = useState<Run>({ key: '', step: 0, inputs: EMPTY, failed: [], tip: null, done: false })
  const cur: Run = run.key === key ? run : { key, step: 0, inputs: EMPTY, failed: [], tip: null, done: false }
  const kind: TipKind | null = active && !cur.done ? order[cur.step] ?? null : null
  const keyRef = useRef(key)
  keyRef.current = key

  // 한 규칙 결과를 넣고 다음으로 — 그 사이 날짜·보유·다시 시도가 바뀌었으면(키가 다르면) 버린다
  const settle = useCallback((forKey: string, k: TipKind, value: TipInputs[Field] | null, didFail: boolean) => {
    if (!today || forKey !== keyRef.current) return   // 날짜·보유·다시 시도가 바뀐 뒤 도착한 옛 결과
    setRun(prev => {
      const base: Run = prev.key === forKey ? prev : { key: forKey, step: 0, inputs: EMPTY, failed: [], tip: null, done: false }
      if (base.done || tipRuleOrder(today)[base.step] !== k) return base
      const inputs = { ...base.inputs, [FIELD[k]]: value } as TipInputs
      const failed = didFail ? base.failed.concat(k) : base.failed
      // 앞 규칙들은 이미 문장이 없었으니 여기서 나오는 문장은 이 규칙 것이다(전부 넣은 pickTip 과 같은 결과 — verify-learn-tips 2-b)
      const tip = pickTip(today, inputs)
      const last = base.step + 1 >= tipRuleOrder(today).length
      return { key: forKey, step: tip || last ? base.step : base.step + 1, inputs, failed, tip, done: !!tip || last }
    })
  }, [today])

  // 다시 시도 직후엔 원천 상태가 아직 '실패'로 남아 있다 — 새로 불러오기 시작할 때까지(실패가 아닌 상태가 한 번 올 때까지) 기다린다
  const calWait = useRef(false)
  const movWait = useRef(false)
  useEffect(() => { if (calendar.state !== 'failed') calWait.current = false }, [calendar.state])
  useEffect(() => { if (movers.state !== 'failed') movWait.current = false }, [movers.state])

  // ① ② — 이 파일이 직접 부른다
  useEffect(() => {
    if (!today || (kind !== 'per' && kind !== 'vsIndex')) return
    let cancelled = false
    const forKey = key
    const noHoldings = pf.state === 'failed' && pf.holdings.length === 0   // 보유를 못 읽었다 — 두 규칙 모두 쓸 것이 없다
    const job = noHoldings ? Promise.reject(new SourceFailed(kind))
      : kind === 'per' ? loadPer(pf.holdings, today) : loadVsIndex(pf, today)
    job.then(v => { if (!cancelled) settle(forKey, kind, v, false) })
      .catch(() => { if (!cancelled) settle(forKey, kind, null, true) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind])

  // ③ — 페이지의 event-calendar 응답을 기다린다
  useEffect(() => {
    if (kind !== 'event') return
    wantCalendar()
    if (calWait.current || pending(calendar.state)) return
    const ev = eventsFrom(calendar)
    settle(key, 'event', ev, ev == null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, calendar.state, calendar.data])

  // ④ — 페이지의 day-movers 응답 + 고른 종목이 개별 주식이면 뉴스 제목 한 번
  useEffect(() => {
    if (kind !== 'mover' || !today) return
    wantMovers()
    if (movWait.current || pending(movers.state)) return
    const rows = moversFrom(movers)
    if (rows == null) { settle(key, 'mover', null, true); return }
    // 제목 없이 먼저 골라 본다(고르는 규칙은 제목과 무관) — 고른 종목에만 뉴스를 붙인다
    const pre = pickTip(today, { ...cur.inputs, movers: rows })
    const h = pre?.kind === 'mover' && pre.ticker ? pf.holdings.find(x => up(x.ticker) === up(pre.ticker as string)) : undefined
    // news-catalyst 는 개별 주식만 모은다 — ETF·코인이면 부르지 않는다
    if (!pre || pre.kind !== 'mover' || !pre.ticker || !h || getAssetType(h.ticker, h.name ?? '', h.market) !== 'STOCK') { settle(key, 'mover', rows, false); return }
    let cancelled = false
    const forKey = key, ticker = pre.ticker
    firstHeadline(ticker).then(headline => {
      if (cancelled) return
      settle(forKey, 'mover', rows.map(r => up(r.ticker) === up(ticker) ? { ...r, headline } : r), false)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, movers.state, movers.data])

  const retry = useCallback(() => {
    if (calendar.state === 'failed') { calWait.current = true; calendar.reload() }
    if (movers.state === 'failed') { movWait.current = true; movers.reload() }
    if (pf.state === 'failed') pf.reload()
    setTick(t => t + 1)
  }, [calendar, movers, pf])

  const nameOf = useCallback((ticker: string) => {
    const h = pf.holdings.find(x => up(x.ticker) === up(ticker))
    if (h?.name) return h.name
    const rows: { ticker: string; name: string }[] = [
      ...(cur.inputs.per ?? []), ...(cur.inputs.vsIndex ?? []), ...(cur.inputs.events ?? []), ...(cur.inputs.movers ?? []),
    ]
    return rows.find(r => up(r.ticker) === up(ticker))?.name || null
  }, [pf.holdings, cur.inputs])

  let status: TipStatus
  if (today == null || pf.state === 'loading') status = 'waiting'
  else if (pf.state === 'unauth') status = 'unauth'
  else if (pf.state === 'ready' && pf.holdings.length === 0) status = 'noHoldings'
  else if (!cur.done) status = 'loading'
  else if (cur.tip) status = 'tip'
  // 시도한 규칙이 전부 원천을 못 가져왔다 — '이야기가 없다'가 아니라 '못 불러왔다'
  else if (cur.failed.length >= order.length) status = 'failed'
  else status = 'none'

  return { status, tip: cur.done ? cur.tip : null, partialFail: cur.failed.length > 0, nameOf, retry }
}
