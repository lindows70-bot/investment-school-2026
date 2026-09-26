'use client'
// 시장 화면 국내 특징종목 — 상승률·하락률·신고가·거래량·거래대금 × 코스피/코스닥, 상위 5 + 더 보기(10). 원천 = /api/market-board/kr 의 movers(네이버)
//   하루 ±30%를 넘은 주식(상장 첫날·거래 재개·정리매매)은 서버가 뺐다 — 뺀 개수를 한 줄로 밝힌다.
//   기본은 주식만(레버리지 ETN 이 상승률 상위를 채운다 — 실측 코스피 상승 Top5 중 3개가 천연가스 레버리지 ETN), 'ETF·ETN 포함' 칩으로 켠다.
import { useState } from 'react'
import { TK, SP } from '@/lib/theme'
import { won, pct, upDown, eok } from '@/lib/studentFormat'
import { viewOf, asOfLabel, krMoverFilterNote, filterEtp, type KrBoardResp } from '@/lib/marketScreen'
import type { KrMover, MoverList, KrMarket, KrMoverKind } from '@/lib/krMarketBoard'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, StockRow, MoreToggle, Pending } from './marketUi'

const KINDS: { key: KrMoverKind; label: string }[] = [
  { key: 'up', label: '상승률' }, { key: 'down', label: '하락률' }, { key: 'high52week', label: '신고가' },
  { key: 'quantTop', label: '거래량' }, { key: 'priceTop', label: '거래대금' },
]
const KIND_NOTE: Record<KrMoverKind, string> = {
  up: '많이 오른 순', down: '많이 내린 순', high52week: '최근 1년(52주) 중 가장 높은 값을 넘은 종목',
  quantTop: '거래된 주식 수가 많은 순', priceTop: '거래된 금액이 많은 순',
}
const MK_NAME: Record<KrMarket, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const SHOW = 5, MAX = 10

export default function KrMovers({ kr }: { kr: JsonResult<KrBoardResp> }) {
  const [kind, setKind] = useState<KrMoverKind>('up')
  const [mk, setMk] = useState<KrMarket>('KOSPI')
  const [open, setOpen] = useState(false)
  const [etp, setEtp] = useState<'stock' | 'all'>('stock')
  const view = viewOf<KrBoardResp, MoverList<KrMover>>(kr, d => d.movers[mk][kind])
  const f = view.kind === 'ok' ? filterEtp(view.data.items, etp === 'all') : { items: [], removed: 0 }
  const items = f.items.slice(0, open ? MAX : SHOW)
  const filterNote = view.kind === 'ok' ? krMoverFilterNote(view.data.filtered) : null

  return (
    <section aria-label="눈에 띈 종목" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="눈에 띈 종목" />
      <ChipRow label="무엇으로 줄 세울까" value={kind} onChange={k => { setKind(k); setOpen(false) }} options={KINDS} />
      <ChipRow label="시장" value={mk} onChange={m => { setMk(m); setOpen(false) }} options={[{ key: 'KOSPI', label: '코스피' }, { key: 'KOSDAQ', label: '코스닥' }]} />
      <ChipRow label="종류" value={etp} onChange={e => { setEtp(e); setOpen(false) }} options={[{ key: 'stock', label: '주식만' }, { key: 'all', label: 'ETF·ETN 포함' }]} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column' }}>
        <Pending view={view} loading="종목 목록을 불러오는 중…" fail="종목 목록을 못 가져왔어요." onRetry={kr.reload} retryLabel="눈에 띈 종목 다시 불러오기" />
        {view.kind === 'ok' && (items.length === 0
          ? <span style={noteStyle()}>{view.data.scanned === 0 ? '네이버 목록이 비어 있어요.' : f.removed > 0 ? '받은 목록이 모두 ETF·ETN 이에요 — \'ETF·ETN 포함\'을 누르면 보여요.' : '걸러내고 나니 남은 종목이 없어요.'}</span>
          : items.map((s, i) => (
            <StockRow key={s.code} rank={i + 1}
              href={`/s/stock/${encodeURIComponent(s.code)}?m=KR&n=${encodeURIComponent(s.name)}`}
              name={s.name} badges={s.etp ? [{ text: s.etp }] : []}
              main={kind === 'priceTop' ? (s.tradeValueEok == null ? '거래대금 모름' : eok(s.tradeValueEok)) : (s.price == null ? '가격 모름' : won(s.price))}
              sub={s.changePct == null ? '등락 모름' : pct(s.changePct)} subColor={upDown(s.changePct)} />
          )))}
      </div>
      {view.kind === 'ok' && <MoreToggle open={open} total={Math.min(MAX, f.items.length)} shown={SHOW} onToggle={() => setOpen(o => !o)} />}
      {view.kind === 'ok' && (
        <>
          <span style={noteStyle()}>
            {[`${MK_NAME[mk]} · ${KIND_NOTE[kind]}`, asOfLabel(view.asOf, view.data.marketStatus), '네이버'].filter(Boolean).join(' · ')}
          </span>
          {filterNote && <span style={noteStyle(TK.slate300)}>{filterNote}</span>}
          {f.removed > 0 && <span style={noteStyle(TK.slate300)}>받은 상위 {view.data.items.length}개 중 ETF·ETN {f.removed}개는 뺐어요 — &lsquo;ETF·ETN 포함&rsquo;을 누르면 보여요.</span>}
        </>
      )}
    </section>
  )
}
