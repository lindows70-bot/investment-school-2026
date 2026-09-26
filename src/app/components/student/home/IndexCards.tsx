'use client'
// 학생 홈 지수 카드 3개 — 코스피·S&P 500(market-indices) · 비트코인(stock-price 업비트 원화). 폰은 한 줄씩, PC 는 3칸
import { TK, FS, SP } from '@/lib/theme'
import { useJson, type JsonResult } from '@/app/components/student/useJson'
import { won, pct, upDown, points } from '@/lib/studentFormat'
import { card, noteStyle, retryBtn, type IndexRow } from './homeUi'

type Cell = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; value: string; changePct: number }
interface PriceRow { ticker?: unknown; currentPrice?: unknown; changePct?: unknown; error?: unknown }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const BTC_BODY = [{ ticker: 'BTC', market: 'CRYPTO' }]

function IndexCard({ label, cell, onRetry }: { label: string; cell: Cell; onRetry: () => void }) {
  return (
    <div className="sh-idx" style={{ ...card, padding: `${SP.md}px ${SP.lg}px`, gap: SP.xs }}>
      <span style={{ fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{label}</span>
      {cell.kind === 'loading' && <span style={noteStyle()}>불러오는 중…</span>}
      {cell.kind === 'failed' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
          <span style={noteStyle(TK.amber400)}>못 가져옴</span>
          <button type="button" onClick={onRetry} aria-label={`${label} 다시 불러오기`} style={retryBtn}>다시</button>
        </span>
      )}
      {cell.kind === 'ok' && (
        <span className="sh-idx-v" style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, minWidth: 0 }}>
          <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{cell.value}</span>
          <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(cell.changePct), whiteSpace: 'nowrap' }}>{pct(cell.changePct)}</span>
        </span>
      )}
    </div>
  )
}

export default function IndexCards({ indices }: { indices: JsonResult<IndexRow[]> }) {
  const btc = useJson<PriceRow[]>('/api/stock-price', { method: 'POST', body: BTC_BODY })

  const indexCell = (id: string): Cell => {
    if (indices.state === 'loading' || indices.state === 'idle') return { kind: 'loading' }
    const row = indices.state === 'ok' && Array.isArray(indices.data) ? indices.data.find(x => x?.id === id) : undefined
    return row && isNum(row.value) && row.value > 0 && isNum(row.changePct) ? { kind: 'ok', value: points(row.value), changePct: row.changePct } : { kind: 'failed' }
  }
  const btcCell = ((): Cell => {
    if (btc.state === 'loading' || btc.state === 'idle') return { kind: 'loading' }
    const row = btc.state === 'ok' && Array.isArray(btc.data) ? btc.data.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === 'BTC') : undefined
    // error 가 붙은 행은 지난 캐시 시세이거나 실패 폴백(가격 0) — 지금 가격이 아니다
    return row && !row.error && isNum(row.currentPrice) && row.currentPrice > 0 && isNum(row.changePct) ? { kind: 'ok', value: won(row.currentPrice), changePct: row.changePct } : { kind: 'failed' }
  })()

  return (
    <section aria-label="주요 지수" className="sh-idx-grid" style={{ display: 'grid', gap: SP.sm }}>
      <IndexCard label="코스피" cell={indexCell('kospi')} onRetry={indices.reload} />
      <IndexCard label="S&P 500" cell={indexCell('sp500')} onRetry={indices.reload} />
      <IndexCard label="비트코인" cell={btcCell} onRetry={btc.reload} />
    </section>
  )
}
