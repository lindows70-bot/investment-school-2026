'use client'
// 배우기 '오늘 알려드려요' — 오늘 규칙 순서(tipRuleOrder)대로 한 규칙씩 원천을 불러, 문장이 나오는 첫 규칙에서 멈춘다(무거운 원천을 한꺼번에 부르지 않는다)
//   ① PER: 개별 주식 최대 5종 stock-info → 고른 한 종목(미국)만 동종 기업 비교 ② 산 뒤 대 지수: 내 거래 기록(본인 것만) + 필요한 지수 일봉
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
import { briefMovers, type CalendarResp, type MoversResp } from '@/app/components/student/home/homeUi'

export type TipStatus = 'waiting' | 'unauth' | 'noHoldings' | 'loading' | 'tip' | 'none' | 'failed'
export interface TodayTip {
  status: TipStatus
  tip: Tip | null
  /** 시도한 원천 중 못 가져온 것이 있었다(규칙 전체 실패 또는 일부 종목·지수 실패) */
  partialFail: boolean
  /** 링크용 종목 이름(Tip 에는 이름 필드가 없다) */
  nameOf: (ticker: string) => string | null
  retry: () => void
}

type Field = 'per' | 'vsIndex' | 'events' | 'movers'
const FIELD: Record<TipKind, Field> = { per: 'per', vsIndex: 'vsIndex', event: 'events', mover: 'movers' }
const EMPTY: TipInputs = { per: null, vsIndex: null, events: null, movers: null }
const PER_MAX = 5          // PER 은 개별 주식 최대 5종만 부른다
const PAGE = 1000          // Supabase select 기본 상한 — 빈 페이지가 올 때까지 넘긴다
const TX_COLS = 'ticker,name,market,currency,type,price,quantity,transaction_date,created_at,memo'
const EVENT_TYPES = new Set(['earnings', 'exDiv', 'payDiv'])

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const up = (t: string) => t.trim().toUpperCase()
/** 규칙 원천을 못 가져왔다 — 다음 규칙으로 넘어가되 '못 가져옴'으로 센다 */
class SourceFailed extends Error {}
/** 규칙 결과 — partial = 일부 종목·지수를 못 가져왔다(나머지로 계산했다) */
interface Loaded<T> { value: T; partial: boolean }

interface Run {
  key: string
  step: number
  inputs: TipInputs
  failed: TipKind[]
  partial: boolean
  tip: Tip | null
  done: boolean
}
const fresh = (key: string): Run => ({ key, step: 0, inputs: EMPTY, failed: [], partial: false, tip: null, done: false })

/** ① PER — 개별 주식만(ETF·코인은 PER 이 없다), 티커순으로 줄 세워 날마다 시작점을 옮겨 5종의 PER 만 먼저 받는다.
 *  그걸로 오늘 고를 종목을 정한 뒤(고르는 규칙은 동종 비교와 무관 — 티커 순환), 그 종목이 미국이면 그 한 종목만 동종 기업 비교를 부른다 */
async function loadPer(holdings: MyPortfolio['holdings'], today: string, prior: TipInputs, signal: AbortSignal): Promise<Loaded<NonNullable<TipInputs['per']>>> {
  const seen = new Set<string>()
  const stocks = holdings
    .filter(h => getAssetType(h.ticker, h.name ?? '', h.market) === 'STOCK')
    .filter(h => { const k = up(h.ticker); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => up(a.ticker).localeCompare(up(b.ticker)))
  if (!stocks.length) return { value: [], partial: false }
  const off = ((dayNum(today) % stocks.length) + stocks.length) % stocks.length
  const pick = stocks.slice(off).concat(stocks.slice(0, off)).slice(0, PER_MAX)
  const got = await Promise.all(pick.map(async h => {
    try {
      const r = await fetch(`/api/stock-info?ticker=${encodeURIComponent(h.ticker)}&market=${encodeURIComponent(h.market)}`, { cache: 'no-store', signal })
      if (!r.ok) return null
      const j = await r.json().catch(() => null) as { fundamentals?: { pe?: unknown } } | null
      if (!j) return null
      // pe 는 숫자 또는 'N/A' — 양수만 PER 로 본다. 무슨 이익 기준인지 응답이 말하지 않으므로 peBasis 는 넣지 않는다
      const rawPe = j.fundamentals?.pe
      const pe = isNum(rawPe) && rawPe > 0 ? rawPe : null
      return { ticker: h.ticker, name: h.name, market: h.market, pe, perMedian: null as number | null, perCount: 0, targetPeSameBasis: null as number | null }
    } catch { return null }
  }))
  const rows = got.filter((x): x is NonNullable<typeof x> => x != null)
  if (!rows.length) throw new SourceFailed('per')
  const partial = rows.length < pick.length
  const pre = pickTip(today, { ...prior, per: rows })
  const chosen = pre?.kind === 'per' && pre.ticker ? rows.find(x => up(x.ticker) === up(pre.ticker as string)) : undefined
  if (!chosen || chosen.market !== 'US') return { value: rows, partial }
  // 동종 비교는 곁들이는 것 — 실패해도 PER 한 줄은 낸다(비교 문장만 빠진다)
  const p = await getSectorPeers({ ticker: chosen.ticker, name: chosen.name, market: chosen.market }).catch(() => null)
  if (!p || p.status === 'error') return { value: rows, partial }
  return {
    value: rows.map(x => x !== chosen ? x : {
      ...x,
      perMedian: isNum(p.perMedian) ? p.perMedian : null,
      perCount: isNum(p.perCount) ? p.perCount : 0,
      targetPeSameBasis: isNum(p.targetPe) ? p.targetPe : null,
    }),
    partial,
  }
}

/** ② 산 뒤 대 지수 — 한 번만 사고 판 적 없는 개별 주식 중 지금 시세가 있는 것만, 필요한 지수 일봉만 한 번씩 */
async function loadVsIndex(pf: MyPortfolio, today: string, signal: AbortSignal): Promise<Loaded<NonNullable<TipInputs['vsIndex']>>> {
  if (pf.state !== 'ready' || !pf.summary) throw new SourceFailed('vsIndex')   // 시세를 못 받았으면 비교할 '지금'이 없다
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new SourceFailed('vsIndex')
  const trades: TradeRow[] = []
  // 본인 거래만(선생님 계정은 RLS 상 전원 것이 보인다) — 빈 페이지가 올 때까지, 다음 시작점은 받은 만큼만
  for (let from = 0; ;) {
    if (signal.aborted) throw new SourceFailed('vsIndex')
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
    return { value: [], partial: false }
  }
  const symbols = Array.from(new Set(ready.map(x => x.idx.symbol)))
  const candles = new Map<IndexChoice['symbol'], DatedClose[]>()
  await Promise.all(symbols.map(async sym => {
    try {
      const r = await fetch(`/api/tech-chart?ticker=${encodeURIComponent(sym)}&market=US&tf=D`, { cache: 'no-store', signal })
      if (!r.ok) return
      const j = await r.json().catch(() => null) as { candles?: unknown } | null
      if (j && Array.isArray(j.candles)) candles.set(sym, j.candles as DatedClose[])
    } catch { /* 이 지수만 빠진다 — partial 로 센다 */ }
  }))
  if (candles.size === 0) throw new SourceFailed('vsIndex')
  const nowMs = Date.now()   // 효과(effect) 안에서만 — 렌더 중 시계를 보지 않는다
  const value = ready.flatMap(({ b, price, idx }) => {
    const c = candles.get(idx.symbol)
    const row = c ? buildVsIndexRow(b, price, idx, c, today, nowMs) : null
    return row ? [row] : []
  })
  return { value, partial: candles.size < symbols.length }
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

/** ④ 크게 움직인 내 종목 — 홈 한눈 시황과 같은 관문(briefMovers: 내 종목 확인 수가 없거나 전부 실패면 '못 가져옴').
 *  day-movers 는 ±5% 넘은 것만 싣는다. 비트코인(보유 안 함)은 held=false 라 빠진다.
 *  asOf 는 요청 시각이지 등락이 일어난 거래일이 아니다(주말·장 전엔 지난 거래일 등락) → tradeDate 는 모름(null).
 *  headline 은 넣지 않는다(undefined = 찾아보지 않음) — 고른 종목에만 뉴스를 붙인다 */
function moversFrom(movers: JsonResult<MoversResp>): Loaded<NonNullable<TipInputs['movers']>> | null {
  const gate = briefMovers(movers)
  const md = movers.data
  if (gate == null || !md || !Array.isArray(md.surges) || !Array.isArray(md.drops)) return null
  if (gate.checked > 0 && gate.failed >= gate.checked) return null   // 내 종목 전부 실패 — '없음'이라 하면 모름을 0 으로 쓰는 것
  const value = [...md.surges, ...md.drops].flatMap(m => m && m.held === true && typeof m.ticker === 'string' && typeof m.name === 'string' && isNum(m.changePct)
    ? [{ ticker: m.ticker, name: m.name, market: typeof m.market === 'string' ? m.market : 'US', changePct: m.changePct, tradeDate: null, held: true }]
    : [])
  return { value, partial: gate.failed > 0 }
}

/** 고른 종목의 최근 뉴스 제목 1개 — news-catalyst 는 내 개별 주식 전체를 한 번에 준다. 없으면 null, 못 가져오면 failed */
async function firstHeadline(ticker: string, signal: AbortSignal): Promise<{ headline: string | null; failed: boolean }> {
  try {
    const r = await fetch('/api/news-catalyst', { cache: 'no-store', signal })
    if (!r.ok) return { headline: null, failed: true }
    const j = await r.json().catch(() => null) as { catalysts?: unknown } | null
    if (!j || !Array.isArray(j.catalysts)) return { headline: null, failed: true }
    const c = (j.catalysts as { ticker?: unknown; headlines?: unknown }[]).find(x => typeof x?.ticker === 'string' && up(x.ticker) === up(ticker))
    const h = Array.isArray(c?.headlines) ? (c.headlines as unknown[]).find((s): s is string => typeof s === 'string' && s.trim() !== '') : undefined
    return { headline: h ?? null, failed: false }
  } catch { return { headline: null, failed: true } }
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
  const [run, setRun] = useState<Run>(fresh(''))
  const cur: Run = run.key === key ? run : fresh(key)
  const kind: TipKind | null = active && !cur.done ? order[cur.step] ?? null : null
  const keyRef = useRef(key)
  keyRef.current = key

  // 한 규칙 결과를 넣고 다음으로 — 그 사이 날짜·보유·다시 시도가 바뀌었으면(키가 다르면) 버린다
  const settle = useCallback((forKey: string, k: TipKind, value: TipInputs[Field] | null, didFail: boolean, partial = false) => {
    if (!today || forKey !== keyRef.current) return   // 날짜·보유·다시 시도가 바뀐 뒤 도착한 옛 결과
    setRun(prev => {
      const base: Run = prev.key === forKey ? prev : fresh(forKey)
      if (base.done || tipRuleOrder(today)[base.step] !== k) return base
      const inputs = { ...base.inputs, [FIELD[k]]: value } as TipInputs
      const failed = didFail ? base.failed.concat(k) : base.failed
      // 앞 규칙들은 이미 문장이 없었으니 여기서 나오는 문장은 이 규칙 것이다(전부 넣은 pickTip 과 같은 결과 — verify-learn-tips 2-b)
      const tip = pickTip(today, inputs)
      const last = base.step + 1 >= tipRuleOrder(today).length
      return { key: forKey, step: tip || last ? base.step : base.step + 1, inputs, failed, partial: base.partial || partial, tip, done: !!tip || last }
    })
  }, [today])

  // 다시 시도 직후엔 원천 상태가 아직 '실패'로 남아 있다 — 새로 불러오기 시작할 때까지(실패가 아닌 상태가 한 번 올 때까지) 기다린다
  const calWait = useRef(false)
  const movWait = useRef(false)
  useEffect(() => { if (calendar.state !== 'failed') calWait.current = false }, [calendar.state])
  useEffect(() => { if (movers.state !== 'failed') movWait.current = false }, [movers.state])

  // ① ② — 이 파일이 직접 부른다. 날짜·보유가 바뀌거나 화면을 떠나면 요청을 취소한다
  useEffect(() => {
    if (!today || (kind !== 'per' && kind !== 'vsIndex')) return
    const ctrl = new AbortController()
    const forKey = key
    const noHoldings = pf.state === 'failed' && pf.holdings.length === 0   // 보유를 못 읽었다 — 두 규칙 모두 쓸 것이 없다
    const job: Promise<Loaded<TipInputs[Field]>> = noHoldings ? Promise.reject(new SourceFailed(kind))
      : kind === 'per' ? loadPer(pf.holdings, today, cur.inputs, ctrl.signal) : loadVsIndex(pf, today, ctrl.signal)
    job.then(r => { if (!ctrl.signal.aborted) settle(forKey, kind, r.value, false, r.partial) })
      .catch(() => { if (!ctrl.signal.aborted) settle(forKey, kind, null, true) })
    return () => ctrl.abort()
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
    const got = moversFrom(movers)
    if (got == null) { settle(key, 'mover', null, true); return }
    const rows = got.value
    // 제목 없이 먼저 골라 본다(고르는 규칙은 제목과 무관) — 고른 종목에만 뉴스를 붙인다
    const pre = pickTip(today, { ...cur.inputs, movers: rows })
    const h = pre?.kind === 'mover' && pre.ticker ? pf.holdings.find(x => up(x.ticker) === up(pre.ticker as string)) : undefined
    // news-catalyst 는 개별 주식만 모은다 — ETF·코인이면 부르지 않는다(headline undefined → 뉴스 문장 생략)
    if (!pre || pre.kind !== 'mover' || !pre.ticker || !h || getAssetType(h.ticker, h.name ?? '', h.market) !== 'STOCK') {
      settle(key, 'mover', rows, false, got.partial); return
    }
    const ctrl = new AbortController()
    const forKey = key, ticker = pre.ticker
    firstHeadline(ticker, ctrl.signal).then(n => {
      if (ctrl.signal.aborted) return
      settle(forKey, 'mover', rows.map(r => up(r.ticker) === up(ticker) ? { ...r, headline: n.headline, newsFailed: n.failed } : r), false, got.partial || n.failed)
    })
    return () => ctrl.abort()
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

  return { status, tip: cur.done ? cur.tip : null, partialFail: cur.failed.length > 0 || cur.partial, nameOf, retry }
}
