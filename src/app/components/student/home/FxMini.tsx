'use client'
// 학생 홈 원·달러 환율 한 줄 + 1달 미니 선 — 하나은행 매매기준율(overview.fx, 홈 page 가 한 번 불러 나눠 준다). 자세한 건 시장 화면
//   '직전 고시보다' — 비교 대상은 바로 앞 확정 고시일이다(주말·휴일을 건너뛰면 '전날'이 아니다)
//   한눈 시황·내 자산이 쓰는 앱 환율(/api/exchange-rate)도 하나은행이 1순위다(4단계 전환) — 값이 다를 때만 이유를 적는다(fxBasisNote):
//   하나은행을 못 받아 앱이 다른 원천으로 떨어졌거나, 같은 하나은행의 다른 시각 고시(오늘 진행 중 vs 이 카드의 확정일)일 때.
//   등락률은 참고 앱처럼 등락색(2026-09-27 사용자 결정 — 원칙의 예외, 학생이 보는 증권 앱과 같은 관례).
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { fxWon, signFx, pct, upDown } from '@/lib/studentFormat'
import { viewOf, mdDow, ymdDot, kstParts, fxBasisNote, niceTicks, dayTicks, type OverviewResp } from '@/lib/marketScreen'
import type { FxTrend } from '@/lib/fxTrend'
import type { JsonResult } from '@/app/components/student/useJson'
import { LinePlot, Pending, RangeTabs } from '@/app/components/student/market/marketUi'
import type { PlotMark } from '@/app/components/student/market/LinePlot'
import { card, CardHead, noteStyle, type FxResp } from './homeUi'

const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00+09:00`)
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''
const int = (v: number) => Math.round(v).toLocaleString('ko-KR')
type Range = 'm1' | 'm3' | 'y1'
const RANGES: { key: Range; label: string }[] = [{ key: 'm1', label: '1달' }, { key: 'm3', label: '3달' }, { key: 'y1', label: '1년' }]
const RANGE_NAME: Record<Range, string> = { m1: '최근 1달', m3: '최근 3달', y1: '최근 1년' }

/** appFx = 홈이 한 번 부른 /api/exchange-rate(한눈 시황과 같은 응답) */
export default function FxMini({ overview, appFx }: { overview: JsonResult<OverviewResp>; appFx: JsonResult<FxResp> }) {
  const [range, setRange] = useState<Range>('m1')
  const view = viewOf<OverviewResp, FxTrend>(overview, d => d.fx)
  const fx = view.kind === 'ok' ? view.data : null
  const basis = fx && appFx.state === 'ok' ? fxBasisNote(appFx.data, fx.latest.v) : null
  const pts = fx ? fx[range].points.map(p => ({ t: dayMs(p.date), v: p.v })).filter(p => Number.isFinite(p.t)) : []
  const dt = pts.length >= 2 ? dayTicks(pts[0].t, pts[pts.length - 1].t) : null
  // 고점·저점 말풍선(2026-10-12 "더리치 메인처럼") — 값·날짜는 fxTrend 가 같은 기간에서 고른 high/low 그대로(시장 화면과 같은 값)
  const marks: PlotMark[] = fx
    ? ([['고점', fx[range].high, 'above'], ['저점', fx[range].low, 'below']] as const)
        .flatMap(([name, hl, place]) => hl && Number.isFinite(dayMs(hl.date)) ? [{ t: dayMs(hl.date), v: hl.v, name, value: fxWon(hl.v), when: mdDow(hl.date) ?? hl.date, place }] : [])
    : []
  return (
    <section aria-label="원·달러 환율" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="원·달러 환율" href="/s/market" linkText="더 보기 ›" extra={<RangeTabs label="기간" value={range} onChange={setRange} options={RANGES} />} />
      <Pending view={view} loading="환율을 불러오는 중…" fail="환율을 못 가져왔어요." onRetry={overview.reload} retryLabel="환율 다시 불러오기" />
      {fx && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm }}>
            <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{fxWon(fx.latest.v)}</span>
            {fx.latest.change != null && (
              <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(fx.latest.changePct), whiteSpace: 'nowrap' }}>
                직전 고시보다 {signFx(fx.latest.change)}{fx.latest.changePct != null ? ` (${pct(fx.latest.changePct)})` : ''}
              </span>
            )}
          </div>
          {pts.length >= 2 && dt && (
            <div aria-hidden style={{ height: 210, minWidth: 0 }}>
              {/* 높이 210 = 시장 화면 FxTrendCard 와 같게 — 말풍선 여백(LinePlot padK 0.32)이 그 높이에 맞춰져 있어 132px 에선 고점 상자 위 11px 가 잘렸다(2026-10-12 375 실측).
                  ⚠️ 이 주석을 `{cond && (` 바로 안쪽에 두면 webpack 파싱이 깨진다(네 번째) — 열린 태그 안 첫 줄에 둔다 */}
              <LinePlot points={pts} color={TK.teal400} tFmt={tDay} vFmt={fxWon} a11y={false} area endDot marks={marks}
                yAxis="left" yTicks={niceTicks(Math.min(...pts.map(p => p.v)), Math.max(...pts.map(p => p.v)), 3)} yFmt={int} xTicks={dt.ticks} xFmt={dt.fmt} />
            </div>
          )}
          <span style={noteStyle()}>{pts.length >= 2 ? `${RANGE_NAME[range]} · ` : ''}하나은행 매매기준율 · {mdDow(fx.latest.date) ?? fx.latest.date} 고시</span>
          {basis && <span style={noteStyle()}>{basis}</span>}
        </>
      )}
    </section>
  )
}
