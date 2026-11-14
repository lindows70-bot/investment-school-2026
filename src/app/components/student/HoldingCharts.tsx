'use client'
// 내 자산 '내 종목 차트' — 내가 가진 종목마다 가격 흐름을 카드로(3개월·1년·5년). 금색 점선 = 내 평균 매수가, 그보다 위는 빨강·아래는 파랑
//   2026-11-14 사용자 요청: 내 자산 화면에 보유 종목의 차트가 하나도 없었다(목록만 있고, 종목을 눌러 상세로 들어가야 보였다).
//   자료는 새로 부르지 않는다 — useMyPortfolio 가 받는 시세 응답(/api/stock-price)에 차트가 이미 실려 온다(lib/studentCharts 가 고른다).
//   차트는 카드가 화면에 들어올 때 그린다(보유 20종이면 차트 20개를 한꺼번에 올리지 않게) · 처음엔 평가금액 큰 순 6종, 나머지는 '더 보기'.
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import type { HoldingRow } from '@/lib/portfolioSummary'
import { money, pct, upDown } from '@/lib/studentFormat'
import { HOLD_RANGES, holdingSeries, periodChangePct, spanLabel, avgInRange, type ChartSource, type HoldRange } from '@/lib/studentCharts'
import type { MyHolding } from '@/app/components/student/useMyPortfolio'
import { useInView } from '@/app/components/student/useInView'
import { surface } from '@/app/components/student/ui'
import { FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { RangeTabs, MoreToggle, useNow } from '@/app/components/student/market/marketUi'
import TrendChart from '@/app/components/student/TrendChart'

const SHOW = 6
const CHART_H = 164

function ChartCard({ row, holding, src, range, now, onRetry }: { row: HoldingRow; holding: MyHolding | undefined; src: ChartSource | null | undefined; range: HoldRange; now: number | null; onRetry: () => void }) {
  const [ref, seen] = useInView<HTMLElement>()
  const currency = holding?.currency ?? (row.market === 'US' ? 'USD' : 'KRW')
  const avg = holding?.purchase_price ?? null
  const { pts, note } = holdingSeries(row.market, src, range, now ?? undefined)
  const chg = periodChangePct(pts)
  const hasAvgLine = avgInRange(avg, pts)
  const label = HOLD_RANGES.find(r => r.key === range)?.label ?? ''
  return (
    <article ref={ref} aria-label={`${row.name} 가격 흐름`} style={{ ...surface, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      {/* 머리 = 종목 상세로 가는 링크(차트는 눌러서 값 보기라 링크로 감싸지 않는다) */}
      <Link href={`/s/stock/${encodeURIComponent(row.ticker)}?m=${row.market}`} style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 44, minWidth: 0, color: TK.slate200, textDecoration: 'none' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, fontSize: FS.tiny, color: TK.sub, minWidth: 0 }}>
            <span style={{ padding: `0 ${SP.xs + 2}px`, borderRadius: RAD.pill, background: row.role === 'CORE' ? `${TK.sky400}24` : `${TK.orange400}24`, color: row.role === 'CORE' ? TK.sky400 : TK.orange400, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{row.role === 'CORE' ? '코어' : '위성'}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.ticker}</span>
          </span>
        </span>
        <span aria-hidden style={{ fontSize: FS.lg, color: TK.slate500, flexShrink: 0 }}>›</span>
      </Link>

      {/* 왼쪽 = 지금 가격·오늘 / 오른쪽 = 내 수익률(이 카드에서 가장 큰 색 글자) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.sm, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {row.priced && row.currentPrice != null
            ? <span style={{ fontSize: FS.xl, fontWeight: 800, letterSpacing: '-0.03em', color: TK.slate100, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(row.currentPrice, currency)}</span>
            : <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.sub }}>지금 시세를 못 가져왔어요</span>}
          {/* 지난 시세의 등락은 오늘 것이 아닐 수 있다 — '오늘'로 쓰지 않는다(내 종목 목록과 같은 말) */}
          {row.priced && row.changePct != null && <span style={{ fontSize: FS.tiny, color: TK.sub }}>{row.stale ? '지난 시세' : '오늘'} <b style={{ color: upDown(row.changePct) }}>{pct(row.changePct)}</b></span>}
        </div>
        {row.priced && row.pnlPct != null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <span style={{ fontSize: FS.tiny, color: TK.sub }}>내 수익률</span>
            <span style={{ fontSize: FS.lg, fontWeight: 800, color: upDown(row.pnlPct), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{pct(row.pnlPct)}</span>
          </div>
        )}
      </div>

      {pts.length >= 2
        ? (seen
          ? <TrendChart pts={pts} currency={currency} avg={avg} height={CHART_H} ariaLabel={`${row.name} ${label} 가격 흐름`} />
          : <div aria-hidden style={{ height: CHART_H }} />)
        // 차트 자료가 비면 '기록 없음'이 아니라 '못 가져옴'이다(시세 서버가 차트만 못 준 경우 포함)
        : <FailRow text="가격 흐름을 못 가져왔어요." onRetry={onRetry} retryLabel={`${row.name} 가격 흐름 다시 불러오기`} />}

      {pts.length >= 2 && (
        <span style={noteStyle()}>
          {spanLabel(pts)}{chg != null && <> · 이 기간 <b style={{ color: upDown(chg) }}>{pct(chg)}</b></>}
          {note ? ` · ${note}` : ''}
          {avg != null && avg > 0 && !hasAvgLine ? ' · 평균 매수가가 이 기간 범위 밖이에요' : ''}
          {currency === 'KRW' && Math.max(...pts.map(p => p.v)) >= 10_000_000 ? ' · 눈금은 만원' : ''}
        </span>
      )}
    </article>
  )
}

export default function HoldingCharts({ rows, holdings, charts, onRetry }: { rows: HoldingRow[]; holdings: MyHolding[]; charts: Record<string, ChartSource | null>; onRetry: () => void }) {
  const [range, setRange] = useState<HoldRange>('1Y')
  const [open, setOpen] = useState(false)
  const now = useNow()
  if (rows.length === 0) return null
  const shown = rows.slice(0, open ? rows.length : SHOW)
  return (
    <section aria-label="내 종목 차트" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>내 종목 차트</h2>
        <RangeTabs label="차트 기간" options={HOLD_RANGES} value={range} onChange={setRange} />
      </div>
      <span style={noteStyle()}>
        <b style={{ color: TK.amber400 }}>금색 점선</b>이 내 평균 매수가예요 — 그보다 위는 <b style={{ color: TK.red400 }}>빨강</b>, 아래는 <b style={{ color: TK.blue400 }}>파랑</b>. 차트를 누르면 그날 가격이 보여요.
      </span>
      {/* 폭 기준 줄바꿈(미디어쿼리 아님) — 왼쪽 메뉴가 남는 820 폭에서도 카드가 320 아래로 눌리지 않는다 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: SP.lg }}>
        {shown.map(r => (
          <ChartCard key={r.id} row={r} holding={holdings.find(h => h.id === r.id)} src={charts[r.ticker.toUpperCase()]} range={range} now={now} onRetry={onRetry} />
        ))}
      </div>
      <MoreToggle open={open} total={rows.length} shown={SHOW} onToggle={() => setOpen(o => !o)} />
      <span style={noteStyle()}>평가금액 큰 순 · 주식은 종가(3개월 = 하루 단위, 1년 = 주 단위, 5년 = 달 단위) · 코인은 업비트 원화</span>
    </section>
  )
}
