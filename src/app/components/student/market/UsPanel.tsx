'use client'
// 시장 화면 미국 탭 — SPY·QQQ(가격·등락·장중 미니 차트·기준 시각) + 특징종목(상승·하락·거래량·거래대금·시가총액, 상위 5 + 더 보기). 원천 = /api/market-board/us
//   특징종목은 서버가 초소형주·상장 직후·권리/유닛을 뺐다 — 뺀 개수를 한 줄로 밝힌다. 순위 목록엔 기준 시각이 없다(지어내지 않는다). 미국 뉴스는 없다.
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { usd, usdBig, pct, upDown } from '@/lib/studentFormat'
import { viewOf, asOfLabel, kstParts, usMoverFilterNote, type UsBoardResp } from '@/lib/marketScreen'
import type { UsEtfIntraday, UsMover, UsMoverKind } from '@/lib/usMarketBoard'
import type { MoverList } from '@/lib/krMarketBoard'
import { useJson, type JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, StockRow, MoreToggle, Pending, LinePlot } from './marketUi'

const ETFS: { sym: 'SPY' | 'QQQ'; desc: string }[] = [
  { sym: 'SPY', desc: '미국 큰 회사 500곳(S&P 500)을 따라가는 ETF' },
  { sym: 'QQQ', desc: '나스닥 큰 회사 100곳(나스닥100)을 따라가는 ETF' },
]
const KINDS: { key: UsMoverKind; label: string }[] = [
  { key: 'up', label: '상승률' }, { key: 'down', label: '하락률' }, { key: 'quantTop', label: '거래량' },
  { key: 'priceTop', label: '거래대금' }, { key: 'marketValue', label: '시가총액' },
]
const KIND_NOTE: Record<UsMoverKind, string> = {
  up: '많이 오른 순', down: '많이 내린 순', quantTop: '거래된 주식 수가 많은 순', priceTop: '거래된 금액이 많은 순', marketValue: '시가총액이 큰 순',
}
const SHOW = 5, MAX = 10
const hm = (t: number) => kstParts(t).hm

function EtfTile({ us, sym, desc }: { us: JsonResult<UsBoardResp>; sym: 'SPY' | 'QQQ'; desc: string }) {
  const v = viewOf<UsBoardResp, UsEtfIntraday>(us, d => d.etfs[sym])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
      <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>{sym}</span>
      <span style={noteStyle()}>{desc}</span>
      <Pending view={v} loading="불러오는 중…" fail={`${sym} 못 가져옴`} onRetry={us.reload} retryLabel={`${sym} 다시 불러오기`} />
      {v.kind === 'ok' && (
        <>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm }}>
            <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{usd(v.data.price)}</span>
            <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(v.data.changePct), whiteSpace: 'nowrap' }}>{v.data.changePct == null ? '등락 모름' : pct(v.data.changePct)}</span>
          </span>
          {v.data.points.length >= 2
            ? <div style={{ height: 72, minWidth: 0 }}><LinePlot points={v.data.points} color={upDown(v.data.changePct)} baseline={v.data.prevClose} tFmt={hm} vFmt={usd} /></div>
            : <span style={noteStyle()}>장중 흐름 점이 아직 없어요.</span>}
          <span style={noteStyle()}>{[asOfLabel(v.asOf, v.data.marketStatus, 'NY'), '점선 = 전날 종가'].filter(Boolean).join(' · ')}</span>
        </>
      )}
    </div>
  )
}

function UsMovers({ us }: { us: JsonResult<UsBoardResp> }) {
  const [kind, setKind] = useState<UsMoverKind>('up')
  const [open, setOpen] = useState(false)
  const view = viewOf<UsBoardResp, MoverList<UsMover>>(us, d => d.movers[kind])
  const items = view.kind === 'ok' ? view.data.items.slice(0, open ? MAX : SHOW) : []
  const rules = us.state === 'ok' ? us.data?.rules : undefined
  const filterNote = view.kind === 'ok' && typeof rules?.minCapUsd === 'number' && typeof rules?.newListingDays === 'number'
    ? usMoverFilterNote(view.data.filtered, view.data.scanned, rules.minCapUsd, rules.newListingDays) : null
  return (
    <section aria-label="미국 눈에 띈 종목" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="미국 눈에 띈 종목" />
      <ChipRow label="무엇으로 줄 세울까" value={kind} onChange={k => { setKind(k); setOpen(false) }} options={KINDS} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column' }}>
        <Pending view={view} loading="종목 목록을 불러오는 중…" fail="종목 목록을 못 가져왔어요." onRetry={us.reload} retryLabel="미국 눈에 띈 종목 다시 불러오기" />
        {view.kind === 'ok' && (items.length === 0
          ? <span style={noteStyle()}>{view.data.scanned === 0 ? '네이버 목록이 비어 있어요.' : '걸러내고 나니 남은 종목이 없어요.'}</span>
          : items.map((s, i) => (
            <StockRow key={s.symbol} rank={i + 1}
              href={`/s/stock/${encodeURIComponent(s.symbol)}?m=US&n=${encodeURIComponent(s.name)}`}
              name={s.name} tag={s.name !== s.symbol ? s.symbol : null} badges={s.fund ? [{ text: '펀드' }] : []}
              main={kind === 'marketValue' ? (s.marketCapUsd == null ? '시가총액 모름' : usdBig(s.marketCapUsd)) : (s.price == null ? '가격 모름' : usd(s.price))}
              sub={s.changePct == null ? '등락 모름' : pct(s.changePct)} subColor={upDown(s.changePct)} />
          )))}
      </div>
      {view.kind === 'ok' && <MoreToggle open={open} total={Math.min(MAX, view.data.items.length)} shown={SHOW} onToggle={() => setOpen(o => !o)} />}
      {view.kind === 'ok' && (
        <>
          <span style={noteStyle()}>{KIND_NOTE[kind]} · 주식만 나와요(ETF 없음) · 네이버 해외 순위(기준 시각 표시 없음)</span>
          {filterNote && <span style={noteStyle(TK.slate300)}>{filterNote}</span>}
        </>
      )}
    </section>
  )
}

export default function UsPanel() {
  const us = useJson<UsBoardResp>('/api/market-board/us')
  return (
    <>
      <section aria-label="미국 대표 ETF" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <CardHead title="미국 시장 한눈에" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.lg }}>
          {ETFS.map(e => <EtfTile key={e.sym} us={us} sym={e.sym} desc={e.desc} />)}
        </div>
        <span style={noteStyle()}>야후 파이낸스 5분 봉 · 미국 정규장은 한국 시각 밤~새벽이에요</span>
      </section>
      <UsMovers us={us} />
    </>
  )
}
