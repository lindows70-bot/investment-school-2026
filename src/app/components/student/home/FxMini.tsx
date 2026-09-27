'use client'
// 학생 홈 원·달러 환율 한 줄 + 1달 미니 선 — 하나은행 매매기준율(overview.fx, 홈 page 가 한 번 불러 나눠 준다). 자세한 건 시장 화면
//   '직전 고시보다' — 비교 대상은 바로 앞 확정 고시일이다(주말·휴일을 건너뛰면 '전날'이 아니다)
//   한눈 시황·내 자산이 쓰는 앱 환율(/api/exchange-rate)도 하나은행이 1순위다(4단계 전환) — 값이 다를 때만 이유를 적는다(fxBasisNote):
//   하나은행을 못 받아 앱이 다른 원천으로 떨어졌거나, 같은 하나은행의 다른 시각 고시(오늘 진행 중 vs 이 카드의 확정일)일 때.
//   환율 오르내림은 좋고 나쁨이 아니라 등락색을 쓰지 않는다.
import { TK, FS, SP } from '@/lib/theme'
import { fxWon, signFx, pct } from '@/lib/studentFormat'
import { viewOf, mdDow, ymdDot, kstParts, fxBasisNote, type OverviewResp } from '@/lib/marketScreen'
import type { FxTrend } from '@/lib/fxTrend'
import type { JsonResult } from '@/app/components/student/useJson'
import { LinePlot, Pending } from '@/app/components/student/market/marketUi'
import { card, CardHead, noteStyle, type FxResp } from './homeUi'

const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00+09:00`)
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''

/** appFx = 홈이 한 번 부른 /api/exchange-rate(한눈 시황과 같은 응답) */
export default function FxMini({ overview, appFx }: { overview: JsonResult<OverviewResp>; appFx: JsonResult<FxResp> }) {
  const view = viewOf<OverviewResp, FxTrend>(overview, d => d.fx)
  const fx = view.kind === 'ok' ? view.data : null
  const basis = fx && appFx.state === 'ok' ? fxBasisNote(appFx.data, fx.latest.v) : null
  const pts = fx ? fx.m1.points.map(p => ({ t: dayMs(p.date), v: p.v })).filter(p => Number.isFinite(p.t)) : []
  return (
    <section aria-label="원·달러 환율" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="원·달러 환율" href="/s/market" linkText="더 보기 ›" />
      <Pending view={view} loading="환율을 불러오는 중…" fail="환율을 못 가져왔어요." onRetry={overview.reload} retryLabel="환율 다시 불러오기" />
      {fx && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: SP.sm }}>
            <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{fxWon(fx.latest.v)}</span>
            {fx.latest.change != null && (
              <span style={{ fontSize: FS.tiny, color: TK.slate300, whiteSpace: 'nowrap' }}>
                직전 고시보다 {signFx(fx.latest.change)}{fx.latest.changePct != null ? ` (${pct(fx.latest.changePct)})` : ''}
              </span>
            )}
          </div>
          {pts.length >= 2 && <div aria-hidden style={{ height: 48, minWidth: 0 }}><LinePlot points={pts} color={TK.slate100} tFmt={tDay} vFmt={fxWon} a11y={false} /></div>}
          <span style={noteStyle()}>{pts.length >= 2 ? '최근 1달 · ' : ''}하나은행 매매기준율 · {mdDow(fx.latest.date) ?? fx.latest.date} 고시</span>
          {basis && <span style={noteStyle()}>{basis}</span>}
        </>
      )}
    </section>
  )
}
