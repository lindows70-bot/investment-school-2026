'use client'
// 시장 화면 원·달러 환율 추이 — 1달/3달/1년 선 차트 · 기간 최고·최저(값·날짜) · 최근 확정 고시와 전날 대비 · 오늘 고시는 '진행 중'으로만
//   원천 = /api/market-board/overview 의 fx(하나은행 매매기준율, 네이버). 앱 환율(/api/exchange-rate)도 하나은행이 1순위라 보통 같다 —
//   다를 때만(하나은행 실패로 다른 원천 · 다른 시각 고시) 이유를 적는다(fxBasisNote).
//   등락률은 참고 앱처럼 등락색(2026-09-27 사용자 결정 — 원칙의 예외, 학생이 보는 증권 앱과 같은 관례).
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { fxWon, signFx, pct, upDown } from '@/lib/studentFormat'
import { viewOf, mdDow, ymdDot, kstParts, fxBasisNote, niceTicks, dayTicks, type OverviewResp } from '@/lib/marketScreen'
import type { FxTrend } from '@/lib/fxTrend'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle, type FxResp } from '@/app/components/student/home/homeUi'
import { LinePlot, Pending, RangeTabs } from './marketUi'
import type { PlotMark } from './LinePlot'

type Range = 'm1' | 'm3' | 'y1'
const RANGES: { key: Range; label: string }[] = [{ key: 'm1', label: '1달' }, { key: 'm3', label: '3달' }, { key: 'y1', label: '1년' }]
const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00+09:00`)
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''
const int = (v: number) => Math.round(v).toLocaleString('ko-KR')
const md = (ymd: string) => { const [, m, d] = ymd.split('-'); return `${Number(m)}.${Number(d)}` }

/** appFx = /api/exchange-rate(내 자산 등 다른 화면이 쓰는 앱 환율) — 이 카드 값과 다를 때만 이유를 적는 데 쓴다 */
export default function FxTrendCard({ overview, appFx }: { overview: JsonResult<OverviewResp>; appFx: JsonResult<FxResp> }) {
  const [range, setRange] = useState<Range>('m1')
  const view = viewOf<OverviewResp, FxTrend>(overview, d => d.fx)
  const r = view.kind === 'ok' ? view.data[range] : null
  const pts = r ? r.points.map(p => ({ t: dayMs(p.date), v: p.v })).filter(p => Number.isFinite(p.t)) : []
  const latest = view.kind === 'ok' ? view.data.latest : null
  const dt = pts.length >= 2 ? dayTicks(pts[0].t, pts[pts.length - 1].t) : { ticks: [], fmt: tDay }
  // 차트 말풍선 — 기간 최고·최저(원천 계산값 그대로, 표시는 원 단위 반올림)
  const marks: PlotMark[] = []
  if (r?.high) marks.push({ t: dayMs(r.high.date), v: r.high.v, name: '고점', value: int(r.high.v), when: md(r.high.date), place: 'above' })
  if (r?.low) marks.push({ t: dayMs(r.low.date), v: r.low.v, name: '저점', value: int(r.low.v), when: md(r.low.date), place: 'below' })
  const highLowText = [r?.high ? `기간 최고 ${fxWon(r.high.v)}(${ymdDot(r.high.date) ?? r.high.date})` : null, r?.low ? `기간 최저 ${fxWon(r.low.v)}(${ymdDot(r.low.date) ?? r.low.date})` : null].filter(Boolean).join(' · ')
  const prov = view.kind === 'ok' ? view.data.provisional : null
  // 비교 대상 = 이 카드가 보여 주는 가장 새 값(오늘 진행 중이면 그 값, 아니면 확정일 값)
  const basis = latest && appFx.state === 'ok' ? fxBasisNote(appFx.data, prov ? prov.v : latest.v) : null

  return (
    <section aria-label="원·달러 환율" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="원·달러 환율" extra={<RangeTabs label="기간" value={range} onChange={setRange} options={RANGES} />} />
      <Pending view={view} loading="환율을 불러오는 중…" fail="환율 추이를 못 가져왔어요." onRetry={overview.reload} retryLabel="환율 추이 다시 불러오기" />
      {latest && r && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm }}>
            <span style={{ fontSize: FS.h1, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap', lineHeight: 1.1 }}>{fxWon(latest.v)}</span>
            {latest.change != null && (
              <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(latest.changePct), whiteSpace: 'nowrap' }}>
                직전 고시보다 {signFx(latest.change)}{latest.changePct != null ? ` (${pct(latest.changePct)})` : ''}
              </span>
            )}
          </div>
          <span style={noteStyle()}>1달러를 사려면 드는 원화예요 · 하나은행 매매기준율 · {mdDow(latest.date) ?? latest.date} 고시</span>
          {prov && <span style={noteStyle(TK.slate300)}>{mdDow(prov.date) ?? prov.date} 고시는 아직 진행 중이에요 — 지금 {fxWon(prov.v)}, 바뀔 수 있어요.</span>}
          {pts.length >= 2
            // 고점·저점은 차트 위 말풍선으로(값·날짜) — 읽어 주는 문장은 정확한 값(소수 둘째 자리)으로 따로 둔다
            ? <div aria-label={highLowText} style={{ height: 210, minWidth: 0 }}>
                <LinePlot points={pts} color={TK.teal400} tFmt={tDay} vFmt={fxWon}
                  area grid endDot yAxis="left" yTicks={niceTicks(Math.min(...pts.map(p => p.v)), Math.max(...pts.map(p => p.v)), 3)} yFmt={int}
                  xTicks={dt.ticks} xFmt={dt.fmt} marks={marks} />
              </div>
            : <span style={noteStyle()}>이 기간에 고시가 두 번 미만이라 선을 그릴 수 없어요.</span>}
          <span style={noteStyle()}>{r.points.length ? `${ymdDot(r.points[0].date) ?? r.points[0].date} ~ ${ymdDot(r.to) ?? r.to} 고시 ${r.points.length}번 · ` : ''}네이버</span>
          {basis && <span style={noteStyle()}>{basis}</span>}
        </>
      )}
    </section>
  )
}
