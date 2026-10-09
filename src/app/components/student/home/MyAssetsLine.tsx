'use client'
// 학생 홈 '내 종목 평가금액' 카드 — useMyPortfolio 요약을 내 자산 화면과 같은 말·같은 숫자로. 누르면 /s/assets
//   리디자인(2026-10-09 · docs/student-design): 홈에서 가장 큰 숫자 하나 + 빛 한 점(Glow). 선 차트는 포트폴리오 시계열이 없어 넣지 않는다(지어내지 않는다)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { won, signWon, pct, upDown } from '@/lib/studentFormat'
import { card, FailRow, noteStyle } from './homeUi'
import { surface, Label, Big, Glow } from '@/app/components/student/ui'

export default function MyAssetsLine() {
  const { state, failReason, summary, pricesFailed, reload } = useMyPortfolio()

  if (state === 'loading') return <div style={card}><Label>내 종목 평가금액</Label><div style={{ marginTop: SP.xs }}><span style={noteStyle()}>불러오는 중이에요…</span></div></div>
  if (state === 'unauth') return <div style={card}><span style={noteStyle()}>로그인하면 내 자산이 보여요.</span></div>
  if (state === 'failed' || !summary) {
    return (
      <div style={card}>
        <FailRow onRetry={reload} retryLabel="내 자산 다시 불러오기" text={failReason === 'fx' ? '환율을 못 가져와서 달러 종목을 원화로 바꿀 수 없어요.' : failReason === 'db' ? '내 종목 목록을 불러오지 못했어요.' : '내 자산을 불러오지 못했어요.'} />
      </div>
    )
  }
  if (summary.rows.length === 0) {
    // 온보딩 카드(2026-10-09) — 보유 0 학생이 홈에서 처음 보는 '할 일' 하나. 왜 적는지(리그·소식)와 걸리는 시간을 함께 말한다
    return (
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm, borderColor: TK.blue600 }}>
        <span style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100, wordBreak: 'keep-all' }}>종목 하나만 적어도 리그에 들어와요</span>
        <span style={{ ...noteStyle(), wordBreak: 'keep-all' }}>증권사에서 이미 산 종목을 적는 데 2분이면 돼요. 금액은 친구에게 보이지 않고, 적어 두면 내 종목 소식·실적 일정이 홈에 떠요.</span>
        <Link href="/s/record" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' }}>첫 종목 기록하기</Link>
      </div>
    )
  }

  // 시세가 하나도 없으면 오늘 등락은 '0'이 아니라 '모름'(내 자산 화면과 같은 판정)
  const noToday = summary.allUnpriced || summary.todayPct == null
  return (
    <Link href="/s/assets" aria-label="내 자산 보기" style={{ ...surface, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: SP.xs, color: TK.slate200, textDecoration: 'none' }}>
      <Glow />
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, position: 'relative' }}>
        {/* 내 자산 화면이 밝히는 단서(지난 시세·매수가로 계산한 종목)를 여기서도 — 같은 합계에 같은 단서 */}
        <Label style={{ overflowWrap: 'anywhere' }}>
          내 종목 평가금액{pricesFailed ? ' · 시세를 못 가져와 매수가 기준' : ''}
          {summary.staleCount > 0 && <span style={{ color: TK.amber400 }}>{` · ${summary.staleCount}종목 지난 시세`}</span>}
          {!pricesFailed && summary.unpricedCount > 0 && <span style={{ color: TK.amber400 }}>{` · ${summary.unpricedCount}종목 매수가로 계산`}</span>}
        </Label>
        <span aria-hidden style={{ fontSize: FS.lg, color: TK.slate500, flexShrink: 0 }}>›</span>
      </span>
      <span style={{ position: 'relative' }}><Big>{won(summary.totalEvalKrw)}</Big></span>
      <span style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
        {noToday
          ? <span style={{ fontSize: FS.tiny, fontWeight: 600, color: TK.sub }}>오늘 등락 모름</span>
          : <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(summary.todayPct), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{signWon(summary.todayKrw)}{summary.todayPct != null ? ` (${pct(summary.todayPct)})` : ''}</span>}
        <span style={{ fontSize: FS.tiny, color: TK.slate500 }}>오늘</span>
      </span>
    </Link>
  )
}
