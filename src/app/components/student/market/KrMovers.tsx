'use client'
// 시장 화면 국내 특징종목 — 상승률·하락률·신고가·거래량·거래대금 × 코스피/코스닥, 상위 5 + 더 보기(10). 원천 = /api/market-board/kr 의 movers(네이버)
//   하루 ±30%를 넘은 주식(상장 첫날·거래 재개·정리매매)은 서버가 뺐다 — 뺀 개수를 한 줄로 밝힌다. ETF·ETN 은 배지.
import { useState } from 'react'
import { TK, SP } from '@/lib/theme'
import { won, pct, upDown, eok } from '@/lib/studentFormat'
import { viewOf, asOfLabel, krMoverFilterNote, type KrBoardResp } from '@/lib/marketScreen'
import type { KrMover, MoverList, KrMarket, KrMoverKind } from '@/lib/krMarketBoard'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, StockRow, MoreToggle, Pending } from './marketUi'

const KINDS: { key: KrMoverKind; label: string }[] = [
  { key: 'up', label: '상승률' }, { key: 'down', label: '하락률' }, { key: 'high52week', label: '신고가' },
  { key: 'quantTop', label: '거래량' }, { key: 'priceTop', label: '거래대금' },
]
const KIND_NOTE: Record<KrMoverKind, string> = {
  up: '오늘 많이 오른 순', down: '오늘 많이 내린 순', high52week: '최근 1년(52주) 중 가장 높은 값을 넘은 종목',
  quantTop: '오늘 거래된 주식 수가 많은 순', priceTop: '오늘 거래된 금액이 많은 순',
}
const MK_NAME: Record<KrMarket, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const SHOW = 5, MAX = 10

export default function KrMovers({ kr }: { kr: JsonResult<KrBoardResp> }) {
  const [kind, setKind] = useState<KrMoverKind>('up')
  const [mk, setMk] = useState<KrMarket>('KOSPI')
  const [open, setOpen] = useState(false)
  const view = viewOf<KrBoardResp, MoverList<KrMover>>(kr, d => d.movers[mk][kind])
  const items = view.kind === 'ok' ? view.data.items.slice(0, open ? MAX : SHOW) : []
  const filterNote = view.kind === 'ok' ? krMoverFilterNote(view.data.filtered) : null

  return (
    <section aria-label="오늘 눈에 띈 종목" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="오늘 눈에 띈 종목" />
      <ChipRow label="무엇으로 줄 세울까" value={kind} onChange={k => { setKind(k); setOpen(false) }} options={KINDS} />
      <ChipRow label="시장" value={mk} onChange={m => { setMk(m); setOpen(false) }} options={[{ key: 'KOSPI', label: '코스피' }, { key: 'KOSDAQ', label: '코스닥' }]} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column' }}>
        <Pending view={view} loading="종목 목록을 불러오는 중…" fail="종목 목록을 못 가져왔어요." onRetry={kr.reload} retryLabel="눈에 띈 종목 다시 불러오기" />
        {view.kind === 'ok' && (items.length === 0
          ? <span style={noteStyle()}>{view.data.scanned === 0 ? '네이버 목록이 비어 있어요.' : '걸러내고 나니 남은 종목이 없어요.'}</span>
          : items.map((s, i) => (
            <StockRow key={s.code} rank={i + 1}
              href={`/s/stock/${encodeURIComponent(s.code)}?m=KR&n=${encodeURIComponent(s.name)}`}
              name={s.name} badges={s.etp ? [{ text: s.etp }] : []}
              main={kind === 'priceTop' ? (s.tradeValueEok == null ? '거래대금 모름' : eok(s.tradeValueEok)) : (s.price == null ? '가격 모름' : won(s.price))}
              sub={s.changePct == null ? '등락 모름' : pct(s.changePct)} subColor={upDown(s.changePct)} />
          )))}
      </div>
      {view.kind === 'ok' && <MoreToggle open={open} total={Math.min(MAX, view.data.items.length)} shown={SHOW} onToggle={() => setOpen(o => !o)} />}
      {view.kind === 'ok' && (
        <>
          <span style={noteStyle()}>
            {[`${MK_NAME[mk]} · ${KIND_NOTE[kind]}`, asOfLabel(view.asOf, view.data.marketStatus), '네이버'].filter(Boolean).join(' · ')}
          </span>
          {filterNote && <span style={noteStyle(TK.slate300)}>{filterNote}</span>}
        </>
      )}
    </section>
  )
}
