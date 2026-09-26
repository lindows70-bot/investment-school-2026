'use client'
// 학생 내 자산 '자산 성장' 차트 — 화면에 들어오면 /api/monthly-pnl 로 월말 평가액을 받아 내 자산·넣은 돈 두 선을 그린다(Recharts)
//   입력은 선생님 대시보드(dashboard/page.tsx 1107~1145)와 같다: { usdKrwNow, lots[{ticker,market,currency,purchase_price,quantity,purchase_date,currentPrice}] }.
//   개인 데이터(보유)는 우리 라우트로만 간다 — 라우트는 결과를 공유 캐시에 넣지 않는다.
import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { won, signWon, manWon, upDown } from '@/lib/studentFormat'
import type { HoldingRow } from '@/lib/portfolioSummary'
import type { MyHolding } from '@/app/components/student/useMyPortfolio'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { card, CardHead, FailRow, noteStyle } from '@/app/components/student/home/homeUi'

// 색 — 이 화면에서 sky400 = 코어, orange400 = 위성이라 그 둘은 피한다. 등락색(빨강·파랑)도 '오름/내림'이라 안 쓴다.
//   내 자산 = 가장 밝은 글자색 실선, 넣은 돈 = 보조 글자색 점선(기준선 느낌)
const C_VALUE = TK.slate100
const C_COST = TK.sub

interface Point { month?: unknown; valueKrw?: unknown; cumPnl?: unknown }
interface PnlResp { points?: Point[]; skipped?: unknown; truncated?: { from?: unknown; to?: unknown } | null }
interface Datum { month: string; value: number; cost: number; pnl: number }
interface PnlBody { usdKrwNow: number | null; lots: { ticker: string; market: string; currency: string; purchase_price: number; quantity: number; purchase_date: string; currentPrice: number | null }[] }

const YM = /^\d{4}-\d{2}$/
const YMD = /^\d{4}-\d{2}-\d{2}/
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const ymText = (ym: string) => `${ym.slice(0, 4)}년 ${parseInt(ym.slice(5, 7), 10)}월`
const monthDiff = (a: string, b: string) => (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)))
const MAX_MONTHS = 36   // monthlyPnl.ts 의 상한(최근 36개월)과 같은 값 — 잘린 이유를 가를 때만 쓴다

// 범위 — 원천이 월말 값뿐이라 '1달'은 없다(점 1~2개). 앞 범위와 같은 점 수가 되는 범위는 숨긴다
const RANGES = [{ key: '6m', label: '6달', n: 6 }, { key: '1y', label: '1년', n: 12 }, { key: 'all', label: '전체', n: Infinity }] as const
type RangeKey = typeof RANGES[number]['key']

/** 축 눈금 — 공백 없이(좁은 축에서 줄바꿈 방지). 첫 칸과 1월만 연도를 붙인다 */
const tickText = (ym: string, i: number) => {
  const m = parseInt(ym.slice(5, 7), 10)
  return i === 0 || m === 1 ? `${ym.slice(2, 4)}년${m}월` : `${m}월`
}

function Tip({ active, payload, lastMonth }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Datum }>; lastMonth: string }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div style={{ background: TK.bg7, border: `1px solid ${TK.line1}`, borderRadius: RAD.sm, padding: SP.sm, display: 'flex', flexDirection: 'column', gap: 2, fontSize: FS.tiny }}>
      <span style={{ color: TK.sub }}>{ymText(d.month)} {d.month === lastMonth ? '· 지금 시세' : '말'}</span>
      <span style={{ color: C_VALUE }}>내 자산 {won(d.value)}</span>
      <span style={{ color: C_COST }}>넣은 돈 {won(d.cost)}</span>
      <span style={{ color: upDown(d.pnl) }}>불어난 돈 {signWon(d.pnl)}</span>
    </div>
  )
}

/** holdings = useMyPortfolio 보유(매수일 포함) · rows = 같은 요약의 행(현재가) · usdKrw = 같은 훅의 환율(null 이면 라우트가 캔들 환율) */
export default function GrowthChart({ holdings, rows, usdKrw }: { holdings: MyHolding[]; rows: HoldingRow[]; usdKrw: number | null }) {
  const [ref, seen] = useInView<HTMLElement>()
  const [range, setRange] = useState<RangeKey | null>(null)

  // ⚠️ 시세·환율이 바뀔 때마다 다시 부르면 안 된다 — 이 요청은 캔들 수집 때문에 수십 초가 걸려 끝나지 않을 수 있다(대시보드 실사고).
  //    보유 구성과 '시세가 채워진 종목 수'(대시보드와 같은 안정 신호)가 바뀔 때만 몸통을 새로 만들고, 현재가·환율은 그 시점 값을 읽는다.
  const pricedCount = rows.filter(r => r.priced).length
  const lotsKey = holdings.map(h => [h.id, h.ticker, h.quantity, h.purchase_price, h.purchase_date ?? ''].join('|')).join(',') + `#${pricedCount}`
  const [body, setBody] = useState<PnlBody | null>(null)
  useEffect(() => {
    if (!seen) return
    const rowById = new Map(rows.map(r => [r.id, r]))
    setBody({
      usdKrwNow: usdKrw,
      lots: holdings.filter(h => typeof h.purchase_date === 'string' && YMD.test(h.purchase_date)).map(h => {
        const r = rowById.get(h.id)
        return {
          ticker: h.ticker, market: h.market, currency: h.currency,
          purchase_price: h.purchase_price, quantity: h.quantity, purchase_date: h.purchase_date as string,
          // 이번 달 끝점을 위 '내 종목 평가금액'과 같은 현재가로 — 시세를 못 받은 종목은 라우트가 일봉 종가를 쓴다
          currentPrice: r?.priced ? r.currentPrice : null,
        }
      }),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, lotsKey])
  const noDateCount = holdings.length - (body?.lots.length ?? holdings.length)
  const res = useJson<PnlResp>('/api/monthly-pnl', { method: 'POST', body: body ?? undefined, enabled: body != null && body.lots.length > 0 })

  const head = <CardHead title="자산 성장" />
  const sub = <span style={noteStyle()}>지금 가진 종목의 월말 값이에요.</span>
  let content: React.ReactNode
  if (!seen || body == null || res.state === 'idle' || res.state === 'loading') {
    content = body != null && body.lots.length === 0
      ? <span style={noteStyle()}>매수일이 적힌 종목이 없어 그릴 수 없어요.</span>
      : <span style={noteStyle()}>월말 시세를 모으는 중이에요… (조금 걸려요)</span>
  } else if (res.state === 'unauth') {
    content = <span style={noteStyle()}>로그인하면 자산 성장이 보여요.</span>
  } else if (res.state === 'failed' || !Array.isArray(res.data?.points)) {
    content = <FailRow text="자산 성장 기록을 못 가져왔어요." onRetry={res.reload} retryLabel="자산 성장 다시 불러오기" />
  } else {
    const data: Datum[] = res.data.points
      .filter(p => typeof p?.month === 'string' && YM.test(p.month) && isNum(p.valueKrw) && isNum(p.cumPnl))
      .map(p => ({ month: p.month as string, value: p.valueKrw as number, cost: (p.valueKrw as number) - (p.cumPnl as number), pnl: p.cumPnl as number }))
    const skipped = Array.isArray(res.data.skipped) ? res.data.skipped.filter((t): t is string => typeof t === 'string') : []
    const skippedNames = skipped.map(t => holdings.find(h => h.ticker.toUpperCase() === t.toUpperCase())?.name ?? t)
    const tr = res.data.truncated
    const truncated = tr && typeof tr.from === 'string' && YM.test(tr.from) && data.length > 0
    const hasUsd = holdings.some(h => h.currency === 'USD')

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
        {data.length === 0 && <span style={{ fontSize: FS.body, color: TK.slate200 }}>그릴 월말 기록이 아직 없어요.</span>}
        {data.length === 1 && <span style={{ fontSize: FS.body, color: TK.slate200 }}>월말 기록이 아직 한 달뿐이라 선을 그릴 수 없어요.</span>}
        {data.length >= 2 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, fontSize: FS.tiny }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, color: C_VALUE }}><span aria-hidden style={{ width: 16, borderTop: `2px solid ${C_VALUE}` }} />내 자산</span>
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
            <div style={{ width: '100%', height: 220, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shown} margin={{ top: SP.sm, right: SP.sm, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={TK.grid} vertical={false} />
                  <XAxis dataKey="month" tickFormatter={tickText} interval="preserveStartEnd" minTickGap={16}
                    tick={{ fill: TK.sub, fontSize: FS.micro }} axisLine={{ stroke: TK.border }} tickLine={false} />
                  <YAxis tickFormatter={manWon} width={56} domain={['auto', 'auto']}
                    tick={{ fill: TK.sub, fontSize: FS.micro }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip lastMonth={lastMonth} />} cursor={{ stroke: TK.line4 }} />
                  <Line type="monotone" dataKey="cost" name="넣은 돈" stroke={C_COST} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="value" name="내 자산" stroke={C_VALUE} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {truncated && (
          // 첫 표시월이 36개월 상한에 닿았으면 잘린 이유는 상한, 아니면 시세 이력이 모자라서(monthlyPnl.buildMonthlySeries)
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
      {noDateCount > 0 && body != null && body.lots.length > 0 && <span style={noteStyle(TK.amber400)}>매수일이 없는 {noDateCount}종목은 뺐어요.</span>}
    </section>
  )
}
