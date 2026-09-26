'use client'
// 시장 화면 '요즘 강한 분야' — 섹터 로테이션 계산(주가 흐름) 상위 5: 1주·1달·국면(학생 말)·종목 수·대표 종목(국기)·계산일. 원천 = /api/market-board/overview 의 strongSectors
//   ⚠️ 주가 수익률로 나눈 것이지 돈 흐름 데이터가 아니다 — 그 사실을 카드에 적는다. ⛔ 매수 순위·타점은 싣지 않는다(WHAT/WHEN).
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { pct, upDown } from '@/lib/studentFormat'
import { viewOf, mdDow, QUAD_TEXT, type OverviewResp } from '@/lib/marketScreen'
import type { StrongSectorsResult } from '@/lib/strongSectors'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { Pending, HelpButton, HelpBox } from './marketUi'

// 국면 = 섹터 로테이션의 rs(1달 수익률 − 전체 평균) · mom(1주 수익률 − 전체 평균) 부호(sector-rotation QUAD)
const HELP = [
  '강하다·약하다 = 최근 1달 주가 흐름이 다른 분야 평균보다 좋은지 나쁜지예요.',
  '더 강해지는·식는·살아나는 = 최근 1주 주가 흐름이 다른 분야 평균보다 좋은지 나쁜지예요.',
  '대표 종목 = 그 분야 종목 중 최근 1주에 많이 오른 종목이에요.',
  '주가가 오른 분야일 뿐, 앞으로도 오른다는 뜻은 아니에요.',
]

function Pct({ label, v }: { label: string; v: number | null }) {
  return (
    <span style={{ fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>
      {label} <b style={{ color: upDown(v), fontWeight: 700 }}>{v == null ? '모름' : pct(v)}</b>
    </span>
  )
}

export default function StrongSectors({ overview, inViewRef }: { overview: JsonResult<OverviewResp>; inViewRef: (el: HTMLElement | null) => void }) {
  const [help, setHelp] = useState(false)
  const view = viewOf<OverviewResp, StrongSectorsResult>(overview, d => d.strongSectors)
  // 대표 종목을 못 실은 분야가 있으면 이유를 한 줄로(서버 repsReason — 계산일이 다름 / 계산 결과 없음)
  const noReps = view.kind === 'ok' ? view.data.items.find(s => s.reps == null) : undefined
  const noRepsText = noReps
    ? (noReps.repsReason ?? '').includes('계산일') ? '대표 종목은 계산일이 달라 생략했어요.' : '대표 종목은 계산 결과가 없어 생략했어요.'
    : null
  return (
    <section ref={inViewRef} aria-label="요즘 강한 분야" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="요즘 강한 분야" extra={<HelpButton open={help} onToggle={() => setHelp(h => !h)} label="요즘 강한 분야 설명 보기" />} />
      {help && <HelpBox lines={HELP} />}
      <Pending view={view} loading="분야를 불러오는 중…" fail="요즘 강한 분야를 못 가져왔어요." onRetry={overview.reload} retryLabel="요즘 강한 분야 다시 불러오기" />
      {view.kind === 'ok' && (view.data.items.length === 0
        ? <span style={noteStyle()}>계산된 분야가 없어요.</span>
        : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {view.data.items.map(s => (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: `${SP.sm}px 0`, borderTop: `1px solid ${TK.border}`, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, minWidth: 0 }}>{s.emoji} {s.label}</span>
                  <span style={{ display: 'flex', gap: SP.sm }}><Pct label="1주" v={s.ret1w} /><Pct label="1달" v={s.ret1m} /></span>
                </div>
                <span style={noteStyle(TK.slate300)}>{QUAD_TEXT[s.quadrant] ?? '국면 모름'} · {s.count}종목</span>
                {s.reps && s.reps.length > 0 && (
                  <span style={{ ...noteStyle(), overflowWrap: 'anywhere' }}>
                    대표 {s.reps.map((r, i) => (
                      <span key={r.ticker}>{i > 0 ? ' · ' : ''}{r.flag} {r.name} <b style={{ color: upDown(r.ret1w), fontWeight: 700 }}>{pct(r.ret1w)}</b></span>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      {view.kind === 'ok' && (
        <>
          <span style={noteStyle()}>
            {[`${view.data.total}개 분야 중 강한 순 ${view.data.items.length}`,
              view.data.mean1w != null && view.data.mean1m != null ? `전체 평균 1주 ${pct(view.data.mean1w)} · 1달 ${pct(view.data.mean1m)}` : null,
              `${mdDow(view.data.calcDate) ?? view.data.calcDate} 계산`].filter(Boolean).join(' · ')}
          </span>
          <span style={noteStyle()}>강한 순 = 다른 분야 평균과 견준 1달 흐름(60%)과 1주 흐름(40%)을 섞은 점수 순이에요.</span>
          {noRepsText && <span style={noteStyle()}>{noRepsText}</span>}
          <span style={noteStyle(TK.slate300)}>미국·한국 종목을 함께 본 계산이에요 · 주가 흐름으로 나눈 것이에요 — 실제로 돈이 들어왔다는 뜻은 아니에요.</span>
        </>
      )}
    </section>
  )
}
