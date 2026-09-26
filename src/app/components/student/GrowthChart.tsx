'use client'
// 학생 내 자산 '내 자산 흐름' — 화면에 들어오면 내 거래 기록을 읽어 로트(산 날·판 날)를 만들고 /api/monthly-pnl 로 월말 평가금액·넣은 돈 두 선을 그린다
//   거래 기록(transactions)을 평균단가법으로 되짚는다(lotsFromTrades) — 더 산 것은 산 달부터, 판 것은 판 달부터 반영된다.
//   거래 기록이 없거나 보유 수량과 안 맞는 종목만 예전처럼 '지금 수량을 처음 산 달부터' 한 줄로 대신 그리고, 화면에 그 사실을 밝힌다.
//   이 파일은 껍데기(보일 때 불러오기·상태 문구)만 — Recharts 는 GrowthPlot 을 next/dynamic 으로 데이터가 온 뒤에만 불러온다.
//   라우트 입력은 선생님 대시보드(dashboard/page.tsx 1107~1145)와 같은 모양에 sold_date 만 더한다(대시보드는 안 보내 예전 계산 그대로).
//   개인 데이터(보유·거래)는 브라우저 Supabase(RLS, 본인 user_id)와 우리 라우트로만 간다 — 라우트는 결과를 공유 캐시에 넣지 않는다.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { HoldingRow } from '@/lib/portfolioSummary'
import type { PnlLot } from '@/lib/monthlySeries'
import { lotsFromTrades, type TradeRow, type LotsFromTradesResult } from '@/lib/lotsFromTrades'
import type { MyHolding } from '@/app/components/student/useMyPortfolio'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { card, CardHead, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import type { GrowthDatum } from '@/app/components/student/GrowthPlot'

// 색 — 이 화면에서 sky400 = 코어, orange400 = 위성이라 그 둘은 피한다. 등락색(빨강·파랑)도 '오름/내림'이라 안 쓴다.
//   월말 평가금액 = 가장 밝은 글자색 실선, 넣은 돈 = 보조 글자색 점선(기준선 느낌). GrowthPlot 도 이 값을 쓴다
export const C_VALUE = TK.slate100
export const C_COST = TK.sub
export const ymText = (ym: string) => `${ym.slice(0, 4)}년 ${parseInt(ym.slice(5, 7), 10)}월`

// dynamic() 은 이 자리에서 바로 평가된다 — loading 은 호이스팅되는 function 선언이어야 한다(const 화살표는 TDZ)
const GrowthPlot = dynamic(() => import('@/app/components/student/GrowthPlot'), { ssr: false, loading: PlotLoading })
function PlotLoading() { return <div style={{ height: 220 }} /> }

interface Point { month?: unknown; valueKrw?: unknown; cumPnl?: unknown }
interface PnlResp { points?: Point[]; skipped?: unknown; truncated?: { from?: unknown; to?: unknown } | null }
interface PnlBody { usdKrwNow: number | null; lots: PnlLot[] }
type TxState = { state: 'loading' | 'ok' | 'failed' | 'unauth'; trades: TradeRow[]; forKey: string }
type Plan = { body: PnlBody; fallback: LotsFromTradesResult['fallback'] }

const YM = /^\d{4}-\d{2}$/
const YMD = /^\d{4}-\d{2}-\d{2}/
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const monthDiff = (a: string, b: string) => (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)))
const MAX_MONTHS = 36   // monthlySeries.ts 의 상한(최근 36개월)과 같은 값 — 잘린 이유를 가를 때만 쓴다
const PAGE = 1000       // Supabase select 기본 상한 — 이 크기로 끝까지 넘겨 읽는다(안 넘기면 1,000건 뒤 거래가 조용히 빠진다)
const TX_COLS = 'ticker,name,market,currency,type,price,quantity,transaction_date,created_at,memo'   // memo = '자동 동기화' 행 가려내기(lotsFromTrades)

// 범위 — 원천이 월말 값뿐이라 '1달'은 없다(점 1~2개). 앞 범위와 같은 점 수가 되는 범위는 숨긴다
const RANGES = [{ key: '6m', label: '6달', n: 6 }, { key: '1y', label: '1년', n: 12 }, { key: 'all', label: '전체', n: Infinity }] as const
type RangeKey = typeof RANGES[number]['key']

/** holdings = useMyPortfolio 보유(매수일 포함) · rows = 같은 요약의 행(현재가) · usdKrw = 같은 훅의 환율(null 이면 라우트가 캔들 환율) */
export default function GrowthChart({ holdings, rows, usdKrw }: { holdings: MyHolding[]; rows: HoldingRow[]; usdKrw: number | null }) {
  const [ref, seen] = useInView<HTMLElement>()
  const [range, setRange] = useState<RangeKey | null>(null)

  // ── 거래 기록 — 본인 것만(선생님 계정은 RLS 상 전원 것이 보이므로 user_id 로 반드시 거른다) ──
  //   보유 구성이 바뀌면(= 새 기록) 다시 읽는다. 실패하면 보유만으로 몰래 그리지 않고 '못 가져왔어요'를 말한다
  const holdKey = holdings.map(h => [h.id, h.ticker, h.quantity, h.purchase_price, h.purchase_date ?? ''].join('|')).join(',')
  const [txTick, setTxTick] = useState(0)
  const [tx, setTx] = useState<TxState>({ state: 'loading', trades: [], forKey: '' })
  useEffect(() => {
    if (!seen) return
    let cancelled = false
    setTx({ state: 'loading', trades: [], forKey: holdKey })
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { if (!cancelled) setTx({ state: 'unauth', trades: [], forKey: holdKey }); return }
      const all: TradeRow[] = []
      for (let from = 0; ; from += PAGE) {
        // 정렬 키에 id 까지 — 같은 거래일·시각이어도 페이지 경계에서 겹치거나 빠지지 않게
        const { data, error } = await sb.from('transactions').select(TX_COLS).eq('user_id', user.id)
          .order('transaction_date', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        const page = (data ?? []) as TradeRow[]
        for (const r of page) all.push(r)
        if (page.length < PAGE) break
      }
      if (!cancelled) setTx({ state: 'ok', trades: all, forKey: holdKey })
    })().catch(() => { if (!cancelled) setTx({ state: 'failed', trades: [], forKey: holdKey }) })
    return () => { cancelled = true }
  }, [seen, holdKey, txTick])

  // ⚠️ 시세·환율이 바뀔 때마다 다시 부르면 안 된다 — 이 요청은 캔들 수집 때문에 수십 초가 걸려 끝나지 않을 수 있다(대시보드 실사고).
  //    보유 구성·'시세가 채워진 종목 수'(대시보드와 같은 안정 신호)·거래 기록 지문(건수 + 마지막 적은 시각)이 바뀔 때만 몸통을 새로 만든다.
  const pricedCount = rows.filter(r => r.priced).length
  const lotsKey = `${holdKey}#${pricedCount}`
  const txFp = tx.state === 'ok'
    ? `${tx.trades.length}|${tx.trades.reduce((m, t) => (String(t.created_at) > m ? String(t.created_at) : m), '')}|${tx.forKey}`
    : `${tx.state}|${tx.forKey}`
  const [plan, setPlan] = useState<Plan | null>(null)
  useEffect(() => {
    // 보유가 바뀐 직후엔 tx 가 아직 옛 보유 기준이다 — 그걸로 만들면 수량이 안 맞아 헛요청이 한 번 나간다
    if (!seen || tx.state !== 'ok' || tx.forKey !== holdKey) { setPlan(null); return }
    const rowById = new Map(rows.map(r => [r.id, r]))
    const built = lotsFromTrades(tx.trades, holdings.map(h => {
      const r = rowById.get(h.id)
      return {
        ticker: h.ticker, name: h.name, market: h.market, currency: h.currency,
        quantity: h.quantity, purchase_price: h.purchase_price, purchase_date: h.purchase_date,
        // 이번 달 끝점을 위 '내 종목 평가금액'과 같은 현재가로 — 시세를 못 받은 종목은 라우트가 일봉 종가를 쓴다
        //  지난 캐시 시세(stale)는 '지금 시세'가 아니므로 넘기지 않는다
        currentPrice: r?.priced && !r.stale ? r.currentPrice : null,
      }
    }))
    setPlan({ body: { usdKrwNow: usdKrw, lots: built.lots }, fallback: built.fallback })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, lotsKey, txFp])
  const res = useJson<PnlResp>('/api/monthly-pnl', { method: 'POST', body: plan?.body, enabled: plan != null && plan.body.lots.length > 0 })

  // 거래 기록으로 못 그린 종목 — ①보유 한 줄로 대신 그린 것 ②대신 그릴 매수일도 없어 뺀 것 ③기록상 남았는데 지금 보유엔 없어 뺀 것
  const holdByTicker = new Map(holdings.map(h => [h.ticker.trim().toUpperCase(), h]))
  const fb = plan?.fallback ?? []
  const drawn = fb.filter(f => YMD.test(holdByTicker.get(f.ticker)?.purchase_date ?? ''))
  const fbDrawn = drawn.filter(f => f.reason !== 'synthetic')
  const fbSynth = drawn.filter(f => f.reason === 'synthetic')
  const fbNoDate = fb.filter(f => { const h = holdByTicker.get(f.ticker); return h != null && !YMD.test(h.purchase_date ?? '') })
  const fbNotHeld = fb.filter(f => !holdByTicker.has(f.ticker))
  const nameOf = (t: string) => holdByTicker.get(t.toUpperCase())?.name
    ?? tx.trades.find(r => r.ticker.trim().toUpperCase() === t.toUpperCase())?.name ?? t
  // 이름은 셋까지만 — 기록이 없는 옛 학생은 전 종목이 여기 걸려 줄이 끝없이 길어진다
  const names = (xs: { name: string }[]) => xs.slice(0, 3).map(x => x.name).join(', ') + (xs.length > 3 ? ` 외 ${xs.length - 3}` : '')

  const head = <CardHead title="내 자산 흐름" />
  const sub = <span style={noteStyle()}>거래 기록대로 매달 말에 들고 있던 종목으로 그렸어요 · 판 종목은 판 달부터 빠져요</span>
  let content: React.ReactNode
  if (tx.state === 'failed') {
    // 거래 기록 없이 보유만으로 그리면 '지금 수량을 처음부터 가졌다'는 옛 그림이 된다 — 몰래 바꾸지 않고 실패를 말한다
    content = <FailRow text="거래 기록을 못 가져왔어요." onRetry={() => setTxTick(t => t + 1)} retryLabel="거래 기록 다시 불러오기" />
  } else if (tx.state === 'unauth' || res.state === 'unauth') {
    content = <span style={noteStyle()}>로그인하면 내 자산 흐름이 보여요.</span>
  } else if (!seen || tx.state === 'loading') {
    content = <span style={noteStyle()}>거래 기록을 불러오는 중이에요…</span>
  } else if (plan != null && plan.body.lots.length === 0) {
    content = <span style={noteStyle()}>거래 기록도 매수일도 없어 그릴 수 없어요.</span>
  } else if (plan == null || res.state === 'idle' || res.state === 'loading') {
    content = <span style={noteStyle()}>월말 시세를 모으는 중이에요… (조금 걸려요)</span>
  } else if (res.state === 'failed' || !Array.isArray(res.data?.points)) {
    content = <FailRow text="지난 흐름을 못 가져왔어요." onRetry={res.reload} retryLabel="지난 흐름 다시 불러오기" />
  } else {
    const data: GrowthDatum[] = res.data.points
      .filter(p => typeof p?.month === 'string' && YM.test(p.month) && isNum(p.valueKrw) && isNum(p.cumPnl))
      .map(p => ({ month: p.month as string, value: p.valueKrw as number, cost: (p.valueKrw as number) - (p.cumPnl as number), pnl: p.cumPnl as number }))
    const skipped = Array.isArray(res.data.skipped) ? res.data.skipped.filter((t): t is string => typeof t === 'string') : []
    const skippedNames = skipped.map(nameOf)
    const tr = res.data.truncated
    const truncated = tr && typeof tr.from === 'string' && YM.test(tr.from) && data.length > 0
    const hasUsd = plan.body.lots.some(l => l.currency === 'USD')

    // 보일 범위 — 점 2개 미만이거나 앞 범위와 점 수가 같으면 숨긴다
    const opts: { key: RangeKey; label: string; count: number }[] = []
    for (const r of RANGES) {
      const count = Math.min(r.n, data.length)
      if (count >= 2 && (opts.length === 0 || count > opts[opts.length - 1].count)) opts.push({ key: r.key, label: r.label, count })
    }
    const cur = opts.find(o => o.key === range) ?? opts.find(o => o.key === '1y') ?? opts[opts.length - 1]
    const shown = cur ? data.slice(-cur.count) : data
    const lastMonth = data.length ? data[data.length - 1].month : ''

    content = (
      <>
        {/* 점이 0개인데 뺀 종목이 있으면 '기록 없음'이 아니라 '시세 이력을 못 가져옴' */}
        {data.length === 0 && skipped.length > 0 && <FailRow text="시세 이력을 못 가져와 그릴 수 없어요." onRetry={res.reload} retryLabel="지난 흐름 다시 불러오기" />}
        {data.length === 0 && skipped.length === 0 && <span style={{ fontSize: FS.body, color: TK.slate200 }}>그릴 월말 기록이 아직 없어요.</span>}
        {data.length === 1 && <span style={{ fontSize: FS.body, color: TK.slate200 }}>월말 기록이 아직 한 달뿐이라 선을 그릴 수 없어요.</span>}
        {data.length >= 2 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, fontSize: FS.tiny }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, color: C_VALUE }}><span aria-hidden style={{ width: 16, borderTop: `2px solid ${C_VALUE}` }} />월말 평가금액</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, color: C_COST }}><span aria-hidden style={{ width: 16, borderTop: `2px dashed ${C_COST}` }} />넣은 돈</span>
              </div>
              {opts.length >= 2 && (
                <div role="group" aria-label="기간" style={{ display: 'flex', gap: SP.xs }}>
                  {opts.map(o => {
                    const on = o.key === cur?.key
                    return (
                      <button key={o.key} type="button" aria-pressed={on} onClick={() => setRange(o.key)}
                        style={{ minWidth: 44, height: 44, padding: `0 ${SP.sm}px`, borderRadius: RAD.sm, border: `1px solid ${on ? TK.slate300 : TK.line1}`, background: on ? TK.bg7 : 'transparent', color: on ? TK.slate100 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 400, cursor: 'pointer' }}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <GrowthPlot data={shown} lastMonth={lastMonth} />
          </>
        )}
        {truncated && (
          // 첫 표시월이 36개월 상한에 닿았으면 잘린 이유는 상한, 아니면 시세 이력이 모자라서(monthlySeries.buildMonthlySeries)
          monthDiff(data[0].month, lastMonth) >= MAX_MONTHS - 1
            ? <span style={noteStyle()}>{ymText(data[0].month)} 이전은 뺐어요 · 최근 3년까지만 그려요.</span>
            : <span style={noteStyle()}>{ymText(data[0].month)} 이전은 시세 이력이 없어 뺐어요.</span>
        )}
        {skipped.length > 0 && <span style={noteStyle(TK.amber400)}>시세 이력을 못 가져와 뺀 종목 {skipped.length}개 · {skippedNames.join(', ')}</span>}
        {data.length >= 1 && hasUsd && <span style={noteStyle()}>달러 종목의 넣은 돈은 그달 말 환율로 바꿔 계산해서, 환율에 따라 조금씩 움직여요.</span>}
      </>
    )
  }

  return (
    <section ref={ref} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      {head}
      {sub}
      {content}
      {plan != null && plan.body.lots.length > 0 && (
        <>
          {fbDrawn.length > 0 && <span style={noteStyle(TK.amber400)}>거래 기록이 없거나 보유 수량과 안 맞는 {fbDrawn.length}종목({names(fbDrawn)})은 지금 수량을 처음 산 달부터 가졌다고 보고 그렸어요.</span>}
          {fbSynth.length > 0 && <span style={noteStyle(TK.amber400)}>자동으로 맞춘 기록이 섞인 {fbSynth.length}종목({names(fbSynth)})은 지금 수량을 처음 산 달부터 가졌다고 보고 그렸어요.</span>}
          {fbNoDate.length > 0 && <span style={noteStyle(TK.amber400)}>거래 기록이 없거나 안 맞고 매수일도 없는 {fbNoDate.length}종목({names(fbNoDate)})은 뺐어요.</span>}
          {fbNotHeld.length > 0 && <span style={noteStyle(TK.amber400)}>거래 기록엔 남아 있는데 지금 보유엔 없는 {fbNotHeld.length}종목({names(fbNotHeld)})은 뺐어요.</span>}
        </>
      )}
    </section>
  )
}
