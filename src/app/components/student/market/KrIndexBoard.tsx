'use client'
// 시장 화면 국내 첫 화면 — 지수 3칸(누르면 아래 장중 차트가 그 지수로) · 선택 시장의 투자자별 금액 · 오른/내린 종목 수. 원천 = /api/market-board/kr(네이버)
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { pct, upDown, points, signEok } from '@/lib/studentFormat'
import { viewOf, asOfLabel, kstParts, mdDow, breadthNote, niceTicks, hourTicks, type KrBoardResp, type View } from '@/lib/marketScreen'
import type { KrIndexQuote, IntradayPoint, InvestorTotals, UpDownCount, KrIndexCode, KrMarket } from '@/lib/krMarketBoard'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { LinePlot, Pending } from './marketUi'

const IDX: { code: KrIndexCode; label: string }[] = [
  { code: 'KOSPI', label: '코스피' },
  { code: 'KOSDAQ', label: '코스닥' },
  { code: 'KPI200', label: '코스피200' },
]
const MK_NAME: Record<KrMarket, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const hm = (t: number) => kstParts(t).hm
const int = (v: number) => Math.round(v).toLocaleString('ko-KR')

export default function KrIndexBoard({ kr }: { kr: JsonResult<KrBoardResp> }) {
  const [sel, setSel] = useState<KrIndexCode>('KOSPI')
  const mk: KrMarket = sel === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI'   // 코스피200 은 코스피 시장
  const quotes = viewOf<KrBoardResp, KrIndexQuote[]>(kr, d => d.indices)
  const chart = viewOf<KrBoardResp, IntradayPoint[]>(kr, d => d.charts[sel])
  const integ = viewOf<KrBoardResp, { investors: InvestorTotals | null; upDown: UpDownCount | null }>(kr, d => d.investorsAndBreadth[mk])
  const q = quotes.kind === 'ok' ? quotes.data.find(x => x.code === sel) ?? null : null
  const mkQuote = quotes.kind === 'ok' ? quotes.data.find(x => x.code === mk) ?? null : null
  const open = mkQuote?.marketStatus === 'OPEN'
  const base = q && q.change != null ? q.value - q.change : null
  const vals = chart.kind === 'ok' ? [...chart.data.map(p => p.v), ...(base != null ? [base] : [])] : []

  return (
    <>
      <section aria-label="국내 지수" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.md }}>
        <Pending view={quotes} loading="지수를 불러오는 중…" fail="지수를 못 가져왔어요." onRetry={kr.reload} retryLabel="국내 지수 다시 불러오기" />
        {quotes.kind === 'ok' && (
          <div role="group" aria-label="장중 차트로 볼 지수" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SP.xs, padding: SP.xs, borderRadius: RAD.md, background: TK.bg3 }}>
            {IDX.map(i => {
              const x = quotes.data.find(r => r.code === i.code)
              const on = sel === i.code
              return (
                <button key={i.code} type="button" aria-pressed={on} onClick={() => setSel(i.code)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SP.xs, minWidth: 0, minHeight: 44,
                    padding: `${SP.md}px ${SP.xs}px`, borderRadius: RAD.md, border: `1px solid ${on ? TK.line4 : 'transparent'}`,
                    background: on ? TK.bg7 : 'transparent', cursor: 'pointer', textAlign: 'center',
                  }}>
                  <span style={{ fontSize: FS.tiny, color: on ? TK.slate100 : TK.sub, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap' }}>{i.label}</span>
                  {x ? (
                    <>
                      <span className="mk-idx-v" style={{ fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{points(x.value)}</span>
                      <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(x.changePct), whiteSpace: 'nowrap' }}>{x.changePct == null ? '등락 모름' : pct(x.changePct)}</span>
                    </>
                  ) : <span style={noteStyle(TK.amber400)}>못 가져옴</span>}
                </button>
              )
            })}
          </div>
        )}

        {quotes.kind === 'ok' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
            {chart.kind === 'ok' && chart.data.length >= 2 ? (
              <>
                {/* 네이버 증시현황처럼 — 오른쪽 값 눈금 · 2시간 눈금 · 선 아래 그라데이션 · 점선 = 전날 종가 · 끝점 */}
                <div style={{ height: 210, minWidth: 0 }}>
                  <LinePlot points={chart.data} color={upDown(q?.changePct ?? null)} baseline={base} tFmt={hm} vFmt={points}
                    area endDot yAxis="right" yTicks={niceTicks(Math.min(...vals), Math.max(...vals), 5)} yFmt={int}
                    xTicks={hourTicks(chart.data[0].t, chart.data[chart.data.length - 1].t)} xFmt={hm} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
                  <span style={noteStyle()}>{hm(chart.data[0].t)} ~ {hm(chart.data[chart.data.length - 1].t)}</span>
                  {base != null && <span style={noteStyle()}>점선 = 전날 종가 {points(base)}</span>}
                </div>
              </>
            ) : chart.kind === 'ok'
              ? <span style={noteStyle()}>장중 흐름 점이 아직 없어요.</span>
              : <Pending view={chart} loading="장중 흐름을 불러오는 중…" fail="장중 흐름을 못 가져왔어요." onRetry={kr.reload} retryLabel="장중 흐름 다시 불러오기" />}
            <span style={noteStyle()}>
              {[q ? asOfLabel(q.asOf, q.marketStatus) : null, '네이버 증권'].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </section>

      <div className="mk-two">
        <section aria-label={`${MK_NAME[mk]} 투자자별`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <CardHead title={`${MK_NAME[mk]} 누가 사고 팔았나`} />
          <Pending view={integ} loading="투자자별 금액을 불러오는 중…" fail="투자자별 금액을 못 가져왔어요." onRetry={kr.reload} retryLabel="투자자별 금액 다시 불러오기" />
          {integ.kind === 'ok' && (integ.data.investors ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SP.sm }}>
                {([['개인', integ.data.investors.personal], ['외국인', integ.data.investors.foreign], ['기관', integ.data.investors.institutional]] as const).map(([name, v]) => (
                  <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
                    <span style={{ fontSize: FS.tiny, color: TK.sub }}>{name}</span>
                    {/* 순매수 + 빨강 · − 파랑(2026-09-27 사용자 결정 — 네이버 증시현황과 같은 관례. 색 원칙의 예외) */}
                    <span style={{ fontSize: FS.body, fontWeight: 700, color: v == null ? TK.sub : upDown(v), overflowWrap: 'break-word' }}>{v == null ? '모름' : signEok(v)}</span>
                  </div>
                ))}
              </div>
              <span style={noteStyle()}>
                + 는 산 돈이 더 많음, − 는 판 돈이 더 많음 · {[integ.data.investors.bizdate ? mdDow(integ.data.investors.bizdate) : null, '억원', '네이버'].filter(Boolean).join(' · ')}
              </span>
              {open && <span style={noteStyle()}>장이 열려 있는 동안 숫자가 계속 바뀌어요.</span>}
            </>
          ) : <span style={noteStyle()}>투자자별 금액이 원천에 없어요.</span>)}
        </section>

        <Breadth view={integ} market={mk} indexPct={mkQuote?.changePct ?? null} onRetry={kr.reload} />
      </div>
    </>
  )
}

function Breadth({ view, market, indexPct, onRetry }: { view: View<{ investors: InvestorTotals | null; upDown: UpDownCount | null }>; market: KrMarket; indexPct: number | null; onRetry: () => void }) {
  const ud = view.kind === 'ok' ? view.data.upDown : null
  const cells: [string, number | null, string][] = ud
    ? [['⬆ 상한', ud.upper, TK.red400], ['▲ 상승', ud.rise, TK.red400], ['— 보합', ud.steady, TK.sub], ['▼ 하락', ud.fall, TK.blue400], ['⬇ 하한', ud.lower, TK.blue400]]
    : []
  const tot = (ud?.rise ?? 0) + (ud?.steady ?? 0) + (ud?.fall ?? 0)
  const note = breadthNote(ud, indexPct)
  const day = view.kind === 'ok' && view.asOf ? mdDow(view.asOf) : null   // 원천 기준일(투자자별 bizdate) — 휴장일에 '오늘'이라 쓰지 않게
  return (
    <section aria-label={`${MK_NAME[market]} 오른 종목·내린 종목 수`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title={`${MK_NAME[market]} 오른 종목·내린 종목`} />
      <Pending view={view} loading="종목 수를 불러오는 중…" fail="종목 수를 못 가져왔어요." onRetry={onRetry} retryLabel="오른 종목·내린 종목 수 다시 불러오기" />
      {view.kind === 'ok' && (ud ? (
        <>
          {/* 좁은 두 칸 배치(769~850px)에선 한 칸 56px 밑으로 줄지 않고 다음 줄로(5칸 → 3+2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))', gap: SP.xs }}>
            {cells.map(([name, v, c]) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SP.xs, minWidth: 0 }}>
                <span style={{ fontSize: FS.tiny, color: TK.sub }}>{name}</span>
                <span style={{ fontSize: FS.body, fontWeight: 700, color: v == null ? TK.sub : c }}>{v == null ? '—' : v.toLocaleString('ko-KR')}</span>
              </div>
            ))}
          </div>
          {tot > 0 && (
            <div role="img" aria-label={`상승 ${ud.rise ?? 0} · 보합 ${ud.steady ?? 0} · 하락 ${ud.fall ?? 0}`} style={{ display: 'flex', height: 8, borderRadius: RAD.pill, overflow: 'hidden', background: TK.line1 }}>
              <div style={{ width: `${(ud.rise ?? 0) / tot * 100}%`, background: TK.red400 }} />
              <div style={{ width: `${(ud.steady ?? 0) / tot * 100}%`, background: TK.line4 }} />
              <div style={{ width: `${(ud.fall ?? 0) / tot * 100}%`, background: TK.blue400 }} />
            </div>
          )}
          <span style={noteStyle()}>
            {MK_NAME[market]} 지수 <span style={{ color: upDown(indexPct), fontWeight: 700 }}>{indexPct == null ? '등락 모름' : pct(indexPct)}</span> · {day ? `${day} 시장 전체 종목의 등락이에요.` : '시장 전체 종목의 등락이에요(기준일 표시 없음).'}
          </span>
          {note && <span style={noteStyle(TK.slate300)}>{note}</span>}
        </>
      ) : <span style={noteStyle()}>종목 수가 원천에 없어요.</span>)}
    </section>
  )
}
