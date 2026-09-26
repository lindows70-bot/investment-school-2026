'use client'
// 학생 홈 원·달러 환율 한 줄 + 1달 미니 선 — 하나은행 매매기준율(overview.fx, 홈 page 가 한 번 불러 나눠 준다). 자세한 건 시장 화면
//   ⚠️ 한눈 시황·내 자산은 아직 앱 환율(/api/exchange-rate)을 쓴다 — 기준이 달라 값이 조금 다를 수 있다는 사실을 적는다(4단계에서 전환).
//   환율 오르내림은 좋고 나쁨이 아니라 등락색을 쓰지 않는다.
import { TK, FS, SP } from '@/lib/theme'
import { fxWon, signFx, pct } from '@/lib/studentFormat'
import { viewOf, mdDow, ymdDot, kstParts, type OverviewResp } from '@/lib/marketScreen'
import type { FxTrend } from '@/lib/fxTrend'
import type { JsonResult } from '@/app/components/student/useJson'
import { LinePlot, Pending } from '@/app/components/student/market/marketUi'
import { card, CardHead, noteStyle } from './homeUi'

const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00+09:00`)
const tDay = (t: number) => ymdDot(kstParts(t).ymd) ?? ''

export default function FxMini({ overview }: { overview: JsonResult<OverviewResp> }) {
  const view = viewOf<OverviewResp, FxTrend>(overview, d => d.fx)
  const fx = view.kind === 'ok' ? view.data : null
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
                전날 고시보다 {signFx(fx.latest.change)}{fx.latest.changePct != null ? ` (${pct(fx.latest.changePct)})` : ''}
              </span>
            )}
          </div>
          {pts.length >= 2 && <div aria-hidden style={{ height: 48, minWidth: 0 }}><LinePlot points={pts} color={TK.slate100} tFmt={tDay} vFmt={fxWon} /></div>}
          <span style={noteStyle()}>{pts.length >= 2 ? '최근 1달 · ' : ''}하나은행 매매기준율 · {mdDow(fx.latest.date) ?? fx.latest.date} 고시</span>
          <span style={noteStyle()}>한눈 시황·내 자산의 환율과는 기준이 달라 조금 다를 수 있어요.</span>
        </>
      )}
    </section>
  )
}
