'use client'
// 학생 홈 스쿨 리그 한 줄 — 화면에 들어올 때 school-league 를 불러 내 순위(등록 학생 수익률 내림차순)를 '3위 / 6명 · +9.1%' 로
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { pct, upDown } from '@/lib/studentFormat'
import { card, FailRow, noteStyle } from './homeUi'

interface StudentRow { userId?: unknown; isRegistered?: unknown; totalReturn?: unknown }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** userId: undefined = 아직 모름, null = 로그인 안 됨 */
export default function LeagueLine({ userId }: { userId: string | null | undefined }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const league = useJson<{ students?: StudentRow[] }>('/api/school-league', { enabled: seen })

  let content: React.ReactNode
  let failed = false
  if (league.state === 'idle' || league.state === 'loading' || userId === undefined) {
    content = <span style={noteStyle()}>리그 순위를 불러오는 중…</span>
  } else if (league.state === 'unauth' || userId === null) {
    content = <span style={noteStyle()}>로그인하면 리그 순위가 보여요.</span>
  } else if (league.state === 'failed' || !Array.isArray(league.data?.students)) {
    failed = true
    content = <FailRow text="리그 순위를 못 가져왔어요." onRetry={league.reload} />
  } else {
    const students = league.data.students
    const ranked = students.filter(s => s?.isRegistered === true && isNum(s.totalReturn))
      .sort((a, b) => (b.totalReturn as number) - (a.totalReturn as number))
    const me = students.find(s => s?.userId === userId)
    const idx = ranked.findIndex(s => s.userId === userId)
    if (!me || me.isRegistered !== true) {
      content = <span style={{ fontSize: FS.body, color: TK.slate200 }}>종목을 기록하면 리그에 참여돼요</span>
    } else if (idx < 0) {
      content = <span style={noteStyle()}>내 수익률을 아직 계산하지 못했어요.</span>
    } else {
      const r = ranked[idx].totalReturn as number
      content = (
        <span style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
          <span style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100, whiteSpace: 'nowrap' }}>{idx + 1}위 / {ranked.length}명</span>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: upDown(r), whiteSpace: 'nowrap' }}>{pct(r)}</span>
        </span>
      )
    }
  }

  const inner = (
    <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <span style={{ fontSize: FS.tiny, color: TK.sub }}>스쿨 리그 · 전체 수익률 순위</span>
      {content}
    </div>
  )
  // 실패 줄엔 '다시' 버튼이 있어 링크로 감싸지 않는다(링크 안 버튼은 잘못된 HTML)
  return (
    <div ref={ref}>
      {failed
        ? <div style={card}>{inner}</div>
        : (
          <Link href="/s/league" style={{ ...card, display: 'flex', alignItems: 'center', gap: SP.sm, color: TK.slate200, textDecoration: 'none' }}>
            {inner}
            <span aria-hidden style={{ fontSize: FS.lg, color: TK.sub, flexShrink: 0 }}>›</span>
          </Link>
        )}
    </div>
  )
}
