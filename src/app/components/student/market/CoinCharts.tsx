'use client'
// 코인 차트 — 대표 코인(비트코인·이더리움·솔라나·리플) + 내가 가진 그 밖의 코인을 카드로(하루·1주·1달·3달·1년). 시장 화면 코인 탭과 코인 화면이 같은 부품을 쓴다
//   2026-11-14 사용자 요청: 시장 → 코인 탭엔 순위표만 있고 주요 코인 차트가 없었다. 코인 화면(/s/coin)의 4종 차트는 30일이 최장·회색 한 가지였다.
//   원천은 그대로 /api/stock-price(업비트 원화) 한 번 — 선 3종(시간봉 24·일봉 7·일봉 30)에 더해 같은 응답의 캔들(일봉 90·주봉 52)로 3달·1년을 그린다(새 원천 0).
//   색은 이 기간 등락색(오르면 빨강·내리면 파랑) · 점선 = 시작값 · 말풍선 = 기간 안 최고·최저. 경고·훈계 문구는 넣지 않는다(사용자 결정 2026-09-27).
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { won, pct, upDown } from '@/lib/studentFormat'
import { STUDENT_COINS } from '@/lib/studentCoins'
import { COIN_RANGES, coinSeries, periodChangePct, type ChartSource, type CoinRange } from '@/lib/studentCharts'
import { useJson, type JsonState } from '@/app/components/student/useJson'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { useInView } from '@/app/components/student/useInView'
import { surface } from '@/app/components/student/ui'
import { FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { RangeTabs, useNow } from './marketUi'
import TrendChart from '@/app/components/student/TrendChart'

interface PriceRow extends ChartSource { ticker?: unknown; currentPrice?: unknown; changePct?: unknown; error?: unknown; source?: unknown }
const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const CHART_H = 178
// 기간마다 한 점이 무엇인지 — 자료의 입도를 그대로 밝힌다
const GRAIN: Record<CoinRange, string> = { '1D': '한 시간 단위 · 한국 시각', '1W': '하루 단위', '1M': '하루 단위', '3M': '하루 단위', '1Y': '주 단위' }

function CoinCard({ ticker, name, row, range, loading, now, onRetry }: { ticker: string; name: string; row: PriceRow | undefined; range: CoinRange; loading: boolean; now: number | null; onRetry: () => void }) {
  const [ref, seen] = useInView<HTMLElement>()
  const price = row && isNum(row.currentPrice) && row.currentPrice > 0 ? row.currentPrice : null
  const chg = row && isNum(row.changePct) ? row.changePct : null
  const stale = price != null && !!row?.error   // 조회 실패 뒤 캐시에 남은 지난 시세
  // 조회 실패인데 캐시도 아니면 API 가 현재가 직선을 채워 보낸다 — 그건 가격 흐름이 아니다(coinSeries 가 직선은 버린다)
  const pts = row ? coinSeries(row, range, now ?? undefined) : []
  const period = periodChangePct(pts)
  const label = COIN_RANGES.find(r => r.key === range)?.label ?? ''
  return (
    <article ref={ref} aria-label={`${name} 가격 흐름`} style={{ ...surface, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, minWidth: 0 }}>
        <Link href={`/s/stock/${ticker}?m=CRYPTO&n=${encodeURIComponent(name)}`} style={{ display: 'flex', alignItems: 'baseline', gap: SP.xs, minHeight: 44, textDecoration: 'none', minWidth: 0 }}>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ fontSize: FS.micro, color: TK.sub, flexShrink: 0 }}>{ticker}</span>
          <span aria-hidden style={{ color: TK.sub, flexShrink: 0 }}>›</span>
        </Link>
        {price != null && chg != null && <span style={{ fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap', flexShrink: 0 }}>오늘 <b style={{ fontSize: FS.body, color: upDown(chg) }}>{pct(chg)}</b></span>}
      </div>
      {loading ? <span style={noteStyle()}>시세를 불러오는 중…</span>
        : price == null ? <span style={noteStyle(TK.amber400)}>지금 시세를 못 가져왔어요.</span>
        : (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: FS.xl, fontWeight: 800, letterSpacing: '-0.03em', color: TK.slate100, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{won(price)}{stale && <span style={{ marginLeft: SP.sm, fontSize: FS.tiny, fontWeight: 500, letterSpacing: 0, color: TK.amber400 }}>마지막으로 가져온 가격</span>}</span>
            {period != null && <span style={{ fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{label} <b style={{ fontSize: FS.body, color: upDown(period) }}>{pct(period)}</b></span>}
          </div>
        )}
      {pts.length >= 2
        ? (seen ? <TrendChart pts={pts} currency="KRW" height={CHART_H} ariaLabel={`${name} ${label} 가격 흐름`} marks /> : <div aria-hidden style={{ height: CHART_H }} />)
        : !loading && price != null && <FailRow text="가격 흐름을 못 가져왔어요." onRetry={onRetry} retryLabel={`${name} 가격 흐름 다시 불러오기`} />}
      {pts.length >= 2 && <span style={{ fontSize: FS.micro, color: TK.sub }}>{GRAIN[range]}{Math.max(...pts.map(p => p.v)) >= 10_000_000 ? ' · 눈금은 만원' : ''} · 업비트 원화</span>}
    </article>
  )
}

export default function CoinCharts() {
  const [range, setRange] = useState<CoinRange>('1M')
  const now = useNow()
  // 내 보유 코인(대표 4종 밖) — 보유 목록이 늦게 와도 대표 코인은 먼저 뜨고, 내 코인은 그 뒤에 붙는다(요청 본문이 바뀌면 useJson 이 한 번 더 부른다)
  const { holdings } = useMyPortfolio()
  const mine = holdings
    .filter(h => h.market === 'CRYPTO' && !STUDENT_COINS.some(c => c.ticker === h.ticker.toUpperCase()))
    .map(h => ({ ticker: h.ticker.toUpperCase(), name: h.name || h.ticker.toUpperCase() }))
  const coins = [...STUDENT_COINS, ...mine]
  const prices = useJson<PriceRow[]>('/api/stock-price', { method: 'POST', body: coins.map(c => ({ ticker: c.ticker, market: 'CRYPTO' as const })) })
  const list = prices.state === 'ok' && Array.isArray(prices.data) ? prices.data : []
  const rowOf = (t: string) => list.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === t)
  return (
    <section aria-label="코인 차트" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>대표 코인 {STUDENT_COINS.length}종{mine.length > 0 ? ` + 내 코인 ${mine.length}종` : ''}</h2>
        <RangeTabs label="차트 기간" options={COIN_RANGES} value={range} onChange={setRange} />
      </div>
      {prices.state === 'failed' && <FailRow text="코인 시세를 못 가져왔어요." onRetry={prices.reload} retryLabel="코인 시세 다시 불러오기" />}
      {/* 폭 기준 줄바꿈 — 폰은 한 줄에 하나, 넓으면 둘 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: SP.lg }}>
        {coins.map(c => <CoinCard key={c.ticker} ticker={c.ticker} name={c.name} row={rowOf(c.ticker)} range={range} loading={pending(prices.state)} now={now} onRetry={prices.reload} />)}
      </div>
      <span style={noteStyle()}>선 색은 이 기간 등락(오르면 빨강·내리면 파랑) · 점선 = 기간 시작값 · 오늘 등락은 오전 9시 기준(업비트)</span>
    </section>
  )
}
