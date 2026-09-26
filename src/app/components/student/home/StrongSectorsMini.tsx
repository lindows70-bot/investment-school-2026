'use client'
// 학생 홈 '요즘 강한 분야' 3 — 시장 화면과 같은 행(StrongSectorRow 간단 모드)·같은 응답(overview — 홈 page 가 한 번 불러 나눠 준다). 자세한 건 시장 화면
//   ⚠️ 주가 흐름 계산(미국·한국 종목 함께)이지 돈 흐름이 아니다 — 범위 문구 한 줄을 남긴다. ⛔ 매수 순위·타점은 없다(WHAT/WHEN).
import { TK, SP } from '@/lib/theme'
import { viewOf, mdDow, type OverviewResp } from '@/lib/marketScreen'
import type { StrongSectorsResult } from '@/lib/strongSectors'
import type { JsonResult } from '@/app/components/student/useJson'
import { StrongSectorRow } from '@/app/components/student/market/StrongSectors'
import { Pending } from '@/app/components/student/market/marketUi'
import { card, CardHead, noteStyle } from './homeUi'

const N = 3
// 목록 자리 높이 — 3행(행 ≈ 위아래 여백 16 + 제목 줄 + 국면 줄 ≈ 60px)을 먼저 잡아 overview 가 도착해도 아래 카드가 밀리지 않게
const LIST_MIN_H = 180

export default function StrongSectorsMini({ overview }: { overview: JsonResult<OverviewResp> }) {
  const view = viewOf<OverviewResp, StrongSectorsResult>(overview, d => d.strongSectors)
  return (
    <section aria-label="요즘 강한 분야" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="요즘 강한 분야" href="/s/market" linkText="더 보기 ›" />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: view.kind === 'loading' ? LIST_MIN_H : undefined }}>
        <Pending view={view} loading="분야를 불러오는 중…" fail="요즘 강한 분야를 못 가져왔어요." onRetry={overview.reload} retryLabel="요즘 강한 분야 다시 불러오기" />
        {view.kind === 'ok' && (view.data.items.length === 0
          ? <span style={noteStyle()}>계산된 분야가 없어요.</span>
          : view.data.items.slice(0, N).map(s => <StrongSectorRow key={s.key} s={s} simple />))}
      </div>
      {view.kind === 'ok' && view.data.items.length > 0 && (
        <>
          <span style={noteStyle()}>{view.data.total}개 분야 중 강한 순 {Math.min(N, view.data.items.length)} · {mdDow(view.data.calcDate) ?? view.data.calcDate} 계산</span>
          <span style={noteStyle(TK.slate300)}>미국·한국 종목을 함께 본 주가 흐름 계산이에요 — 돈이 들어왔다는 뜻도, 사라는 뜻도 아니에요.</span>
        </>
      )}
    </section>
  )
}
