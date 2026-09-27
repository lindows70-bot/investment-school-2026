'use client'
// 학생 홈 지수 카드 3개 — 코스피·S&P 500(market-indices) · 비트코인(stock-price 업비트 원화) + 칸마다 장중 차트(값 눈금·시간 눈금·그라데이션·점선 = 전날 종가·끝점). 폰은 한 칸씩 세로, PC 는 3칸
//   차트는 이미 받는 응답을 쓴다(새 요청 없음): 지수 = market-indices 의 장중 chartData(코스피는 네이버 분봉), 비트코인 = stock-price 의 1D(지난 24시간 1시간봉).
//   점선 = 전날 종가(값 − 등락). 비트코인은 등락 기준(오전 9시)과 선의 시작(24시간 전)이 달라 기준선을 긋지 않고,
//   선 색도 등락색이 아니라 중립색이다(등락률은 올랐는데 24시간 선은 내려가는 모양일 수 있다).
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import { useJson, type JsonResult } from '@/app/components/student/useJson'
import { won, pct, upDown, points } from '@/lib/studentFormat'
import { sparkSeries, kstParts, niceTicks, hourTicks } from '@/lib/marketScreen'
import { LinePlot } from '@/app/components/student/market/marketUi'
import { card, noteStyle, retryBtn, type IndexRow } from './homeUi'

type Spark = { t: number; v: number }[] | null
/** lineColor = 선 색 — 지수는 등락색(선과 등락의 기준이 같은 전날 종가), 비트코인은 중립색 · xStepH = 시간 눈금 간격(지수 2시간, 비트코인 24시간이라 6시간) */
type Cell = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; value: string; changePct: number; spark: Spark; baseline: number | null; lineColor: string; vFmt: (v: number) => string; yFmt: (v: number) => string; xStepH: number }
interface PriceRow { ticker?: unknown; currentPrice?: unknown; changePct?: unknown; error?: unknown; charts?: { '1D'?: unknown } }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const BTC_BODY = [{ ticker: 'BTC', market: 'CRYPTO' }]
const hm = (t: number) => kstParts(t).hm
const int = (v: number) => Math.round(v).toLocaleString('ko-KR')
const man = (v: number) => `${Math.round(v / 10_000).toLocaleString('ko-KR')}만`   // 비트코인 눈금 — 115,167,000원은 눈금 칸에 안 들어간다

function IndexCard({ label, cell, onRetry }: { label: string; cell: Cell; onRetry: () => void }) {
  const sp = cell.kind === 'ok' ? cell.spark : null
  const vals = sp ? [...sp.map(p => p.v), ...(cell.kind === 'ok' && cell.baseline != null ? [cell.baseline] : [])] : []
  return (
    <div className="sh-idx" style={{ ...card, padding: `${SP.md}px ${SP.lg}px`, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <span style={{ fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{label}</span>
      {cell.kind === 'loading' && <span style={noteStyle()}>불러오는 중…</span>}
      {cell.kind === 'failed' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
          <span style={noteStyle(TK.amber400)}>못 가져옴</span>
          <button type="button" onClick={onRetry} aria-label={`${label} 다시 불러오기`} style={retryBtn}>다시</button>
        </span>
      )}
      {cell.kind === 'ok' && (
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm, minWidth: 0 }}>
          <span style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{cell.value}</span>
          <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(cell.changePct), whiteSpace: 'nowrap' }}>{pct(cell.changePct)}</span>
        </span>
      )}
      {/* 차트 — 못 그리면(점 부족·가짜 평평선) 빈 자리. 값은 위 글자가 말하므로 접근성 층은 끈다 */}
      <div className="sh-spark" aria-hidden>
        {cell.kind === 'ok' && sp && sp.length >= 2 && (
          <LinePlot points={sp} color={cell.lineColor} baseline={cell.baseline} tFmt={hm} vFmt={cell.vFmt} a11y={false}
            area endDot yAxis="right" yTicks={niceTicks(Math.min(...vals), Math.max(...vals), 3)} yFmt={cell.yFmt}
            xTicks={hourTicks(sp[0].t, sp[sp.length - 1].t, cell.xStepH)} xFmt={hm} />
        )}
      </div>
    </div>
  )
}

export default function IndexCards({ indices }: { indices: JsonResult<IndexRow[]> }) {
  const btc = useJson<PriceRow[]>('/api/stock-price', { method: 'POST', body: BTC_BODY })

  const indexCell = (id: string): Cell => {
    if (indices.state === 'loading' || indices.state === 'idle') return { kind: 'loading' }
    const row = indices.state === 'ok' && Array.isArray(indices.data) ? indices.data.find(x => x?.id === id) : undefined
    if (!(row && isNum(row.value) && row.value > 0 && isNum(row.changePct))) return { kind: 'failed' }
    return {
      kind: 'ok', value: points(row.value), changePct: row.changePct, vFmt: points, yFmt: int, xStepH: 2, lineColor: upDown(row.changePct),
      spark: sparkSeries(row.chartData), baseline: isNum(row.change) ? row.value - row.change : null,
    }
  }
  const btcCell = ((): Cell => {
    if (btc.state === 'loading' || btc.state === 'idle') return { kind: 'loading' }
    const row = btc.state === 'ok' && Array.isArray(btc.data) ? btc.data.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === 'BTC') : undefined
    // error 가 붙은 행은 지난 캐시 시세이거나 실패 폴백(가격 0) — 지금 가격이 아니다
    if (!(row && !row.error && isNum(row.currentPrice) && row.currentPrice > 0 && isNum(row.changePct))) return { kind: 'failed' }
    return { kind: 'ok', value: won(row.currentPrice), changePct: row.changePct, vFmt: won, yFmt: man, xStepH: 6, spark: sparkSeries(row.charts?.['1D']), baseline: null, lineColor: TK.slate300 }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <section aria-label="주요 지수" className="sh-idx-grid" style={{ display: 'grid', gap: SP.sm }}>
        <IndexCard label="코스피" cell={indexCell('kospi')} onRetry={indices.reload} />
        <IndexCard label="S&P 500" cell={indexCell('sp500')} onRetry={indices.reload} />
        <IndexCard label="비트코인" cell={btcCell} onRetry={btc.reload} />
      </section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <span style={noteStyle()}>선 = 지수는 그날 장중(점선 = 전날 종가) · 비트코인은 지난 24시간(눈금은 만원)</span>
        <Link href="/s/market" style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: `0 ${SP.xs}px`, fontSize: FS.tiny, color: TK.sub, textDecoration: 'none', whiteSpace: 'nowrap' }}>시장 더 보기 ›</Link>
      </div>
    </div>
  )
}
