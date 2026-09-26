'use client'
// 학생 홈 '내 종목 평가금액' 한 줄 — useMyPortfolio 요약을 내 자산 화면과 같은 말·같은 숫자로. 누르면 /s/assets
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import { won, signWon, pct, upDown } from '@/lib/studentFormat'
import { card, FailRow, noteStyle } from './homeUi'

export default function MyAssetsLine() {
  const { state, failReason, summary, pricesFailed, reload } = useMyPortfolio()

  if (state === 'loading') return <div style={card}><span style={noteStyle()}>내 종목을 불러오는 중이에요…</span></div>
  if (state === 'unauth') return <div style={card}><span style={noteStyle()}>로그인하면 내 자산이 보여요.</span></div>
  if (state === 'failed' || !summary) {
    return (
      <div style={card}>
        <FailRow onRetry={reload} text={failReason === 'fx' ? '환율을 못 가져와서 달러 종목을 원화로 바꿀 수 없어요.' : failReason === 'db' ? '내 종목 목록을 불러오지 못했어요.' : '내 자산을 불러오지 못했어요.'} />
      </div>
    )
  }
  if (summary.rows.length === 0) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.body, color: TK.slate100 }}>아직 기록한 종목이 없어요</span>
        <Link href="/s/record" style={{ display: 'flex', alignItems: 'center', height: 44, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>첫 종목 기록하기</Link>
      </div>
    )
  }

  // 시세가 하나도 없으면 오늘 등락은 '0'이 아니라 '모름'(내 자산 화면과 같은 판정)
  const noToday = summary.allUnpriced || summary.todayPct == null
  return (
    <Link href="/s/assets" style={{ ...card, display: 'flex', alignItems: 'center', gap: SP.sm, color: TK.slate200, textDecoration: 'none' }}>
      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={noteStyle()}>내 종목 평가금액{pricesFailed ? ' · 시세를 못 가져와 매수가 기준' : ''}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: SP.sm }}>
          <span style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{won(summary.totalEvalKrw)}</span>
          {noToday
            ? <span style={{ fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>오늘 —</span>
            : <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(summary.todayPct), whiteSpace: 'nowrap' }}>오늘 {signWon(summary.todayKrw)}{summary.todayPct != null ? ` (${pct(summary.todayPct)})` : ''}</span>}
        </div>
      </div>
      <span aria-hidden style={{ fontSize: FS.lg, color: TK.sub, flexShrink: 0 }}>›</span>
    </Link>
  )
}
