'use client'
// 시장 화면 원·달러 환율 추이 — 1달/3달/1년 선 차트 · 기간 최고·최저(값·날짜) · 최근 확정 고시와 전날 대비 · 오늘 고시는 '진행 중'으로만
//   원천 = /api/market-board/overview 의 fx(하나은행 매매기준율, 네이버). ⚠️ 앱의 다른 화면 환율(/api/exchange-rate)과 기준이 다를 수 있어 그 사실을 적는다.
//   환율 오르내림은 좋고 나쁨이 아니라 등락색(빨강·파랑)을 쓰지 않는다.
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { fxWon, signFx, pct } from '@/lib/studentFormat'
import { viewOf, mdDow, ymdDot, kstParts, type OverviewResp } from '@/lib/marketScreen'
import type { FxTrend } from '@/lib/fxTrend'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, LinePlot, Pending } from './marketUi'

type Range = 'm1' | 'm3' | 'y1'
const RANGES: { key: Range; label: string }[] = [{ key: 'm1', label: '1달' }, { key: 'm3', label: '3달' }, { key: 'y1', label: '1년' }]
const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00+09:00`)
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''

export default function FxTrendCard({ overview }: { overview: JsonResult<OverviewResp> }) {
  const [range, setRange] = useState<Range>('m1')
  const view = viewOf<OverviewResp, FxTrend>(overview, d => d.fx)
  const r = view.kind === 'ok' ? view.data[range] : null
  const pts = r ? r.points.map(p => ({ t: dayMs(p.date), v: p.v })).filter(p => Number.isFinite(p.t)) : []
  const latest = view.kind === 'ok' ? view.data.latest : null
  const prov = view.kind === 'ok' ? view.data.provisional : null

  return (
    <section aria-label="원·달러 환율" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="원·달러 환율" />
      <Pending view={view} loading="환율을 불러오는 중…" fail="환율 추이를 못 가져왔어요." onRetry={overview.reload} retryLabel="환율 추이 다시 불러오기" />
      {latest && r && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm }}>
            <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{fxWon(latest.v)}</span>
            {latest.change != null && (
              <span style={{ fontSize: FS.tiny, color: TK.slate300, whiteSpace: 'nowrap' }}>
                전날 고시보다 {signFx(latest.change)}{latest.changePct != null ? ` (${pct(latest.changePct)})` : ''}
              </span>
            )}
          </div>
          <span style={noteStyle()}>1달러를 사려면 드는 원화예요 · 하나은행 매매기준율 · {mdDow(latest.date) ?? latest.date} 고시</span>
          {prov && <span style={noteStyle(TK.slate300)}>오늘({mdDow(prov.date) ?? prov.date}) 고시는 진행 중이에요 — 지금 {fxWon(prov.v)}, 바뀔 수 있어요.</span>}
          <ChipRow label="기간" value={range} onChange={setRange} options={RANGES} />
          {pts.length >= 2
            ? <div style={{ height: 160, minWidth: 0 }}><LinePlot points={pts} color={TK.slate100} tFmt={tDay} vFmt={fxWon} /></div>
            : <span style={noteStyle()}>이 기간에 고시가 두 번 미만이라 선을 그릴 수 없어요.</span>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.sm }}>
            {([['기간 최고', r.high], ['기간 최저', r.low]] as const).map(([label, x]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
                <span style={{ fontSize: FS.micro, color: TK.sub }}>{label}</span>
                <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate200, whiteSpace: 'nowrap' }}>{x ? fxWon(x.v) : '—'}</span>
                {x && <span style={noteStyle()}>{ymdDot(x.date) ?? x.date}</span>}
              </div>
            ))}
          </div>
          <span style={noteStyle()}>{r.points.length ? `${ymdDot(r.points[0].date) ?? r.points[0].date} ~ ${ymdDot(r.to) ?? r.to} 고시 ${r.points.length}번 · ` : ''}네이버 · 앱의 다른 화면(내 자산 등) 환율과 기준이 다를 수 있어요.</span>
        </>
      )}
    </section>
  )
}
