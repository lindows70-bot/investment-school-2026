'use client'
// 시장 화면 코인 탭 — 업비트 원화 마켓 상승·하락·거래대금 상위 5 + 더 보기(10). 원천 = /api/market-board/coin(업비트 60초 시세)
//   등락 기준은 업비트 기준가(한국 오전 9시) 대비 — 한국 주식 '전날 대비'와 기준 시각이 달라 그 사실을 한 줄로 밝힌다.
import { useState } from 'react'
import { SP } from '@/lib/theme'
import { won, pct, upDown, eok } from '@/lib/studentFormat'
import { viewOf, asOfLabel, type CoinBoardResp } from '@/lib/marketScreen'
import type { CoinBoard } from '@/lib/upbitMarket'
import { useJson } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, StockRow, MoreToggle, Pending } from './marketUi'

type Kind = 'up' | 'down' | 'tradeValue'
const KINDS: { key: Kind; label: string }[] = [{ key: 'up', label: '상승률' }, { key: 'down', label: '하락률' }, { key: 'tradeValue', label: '거래대금' }]
const KIND_NOTE: Record<Kind, string> = { up: '많이 오른 순', down: '많이 내린 순', tradeValue: '최근 24시간 거래된 금액이 많은 순' }
const SHOW = 5, MAX = 10

export default function CoinPanel() {
  const coin = useJson<CoinBoardResp>('/api/market-board/coin')
  const [kind, setKind] = useState<Kind>('up')
  const [open, setOpen] = useState(false)
  const view = viewOf<CoinBoardResp, CoinBoard>(coin, d => d.board)
  const all = view.kind === 'ok' ? view.data[kind] : []
  const items = all.slice(0, open ? MAX : SHOW)
  return (
    <section aria-label="코인 눈에 띈 종목" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="코인 눈에 띈 종목" />
      <ChipRow label="무엇으로 줄 세울까" value={kind} onChange={k => { setKind(k); setOpen(false) }} options={KINDS} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column' }}>
        <Pending view={view} loading="코인 목록을 불러오는 중…" fail="코인 목록을 못 가져왔어요." onRetry={coin.reload} retryLabel="코인 목록 다시 불러오기" />
        {view.kind === 'ok' && (items.length === 0
          ? <span style={noteStyle()}>업비트 목록이 비어 있어요.</span>
          : items.map((c, i) => (
            <StockRow key={c.symbol} rank={i + 1}
              href={`/s/stock/${encodeURIComponent(c.symbol)}?m=CRYPTO&n=${encodeURIComponent(c.name)}`}
              name={c.name} tag={c.name !== c.symbol ? c.symbol : null}
              main={kind === 'tradeValue' ? (c.tradeValue24hEok == null ? '거래대금 모름' : eok(c.tradeValue24hEok)) : (c.price == null ? '가격 모름' : won(c.price))}
              sub={c.changePct == null ? '등락 모름' : pct(c.changePct)} subColor={upDown(c.changePct)} />
          )))}
      </div>
      {view.kind === 'ok' && <MoreToggle open={open} total={Math.min(MAX, all.length)} shown={SHOW} onToggle={() => setOpen(o => !o)} />}
      {view.kind === 'ok' && (
        <>
          <span style={noteStyle()}>{[KIND_NOTE[kind], `원화 마켓 ${view.data.scanned}종목 중`, asOfLabel(view.asOf, 'OPEN'), '업비트'].filter(Boolean).join(' · ')}</span>
          <span style={noteStyle()}>코인 등락은 가장 최근 오전 9시(업비트 기준 시각) 값과 견준 거예요 — 주식의 &lsquo;전날 대비&rsquo;와 기준이 달라요.</span>
        </>
      )}
    </section>
  )
}
