'use client'
// 학생 홈 스쿨 리그 타일 — 화면에 들어올 때 school-league 를 불러 내 순위(등록 학생 수익률 내림차순)를 '3위' + ↑↓ 칩 + '7명 중 · +9.1%' 로. 누르면 /s/league
//   리디자인(2026-10-09 · docs/student-design): 한 줄 → 타일(기록 타일과 2열). ↑↓ 칩은 지난주 스냅샷이 **오늘과 다른 날**일 때만(첫 주엔 순위만 — 추정 없음)
import { TK, FS } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { pct, upDown } from '@/lib/studentFormat'
import { card, FailRow } from './homeUi'
import { Tile, Chip, Label } from '@/app/components/student/ui'

interface StudentRow { userId?: unknown; isRegistered?: unknown; totalReturn?: unknown; prevRank?: unknown }
interface LeagueResp { students?: StudentRow[]; prevSnapDate?: unknown }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** 지난주 순위 → 칩. 스냅샷이 오늘 것이면(첫 장) 비교할 '지난주'가 없다 */
export function rankDeltaChip(prevRank: unknown, rank: number, prevSnapDate: unknown, today: string | null): React.ReactNode {
  if (!isNum(prevRank) || typeof prevSnapDate !== 'string' || !today || prevSnapDate >= today) return null
  const d = prevRank - rank
  if (d > 0) return <Chip text={`↑${d}`} tone="lime" />
  if (d < 0) return <Chip text={`↓${-d}`} />
  return <Chip text="=" />
}

/** userId: undefined = 아직 모름, null = 로그인 안 됨 · today: KST 'YYYY-MM-DD'(마운트 전 null) */
export default function LeagueLine({ userId, today }: { userId: string | null | undefined; today: string | null }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const league = useJson<LeagueResp>('/api/school-league', { enabled: seen })

  let node: React.ReactNode
  if (league.state === 'idle' || league.state === 'loading' || userId === undefined) {
    node = <Tile label="스쿨 리그" value="…" sub="순위를 불러오는 중" />
  } else if (league.state === 'unauth' || userId === null) {
    node = <Tile label="스쿨 리그" value="—" sub="로그인하면 보여요" />
  } else if (league.state === 'failed' || !Array.isArray(league.data?.students)) {
    node = <div style={card}><Label>스쿨 리그</Label><FailRow text="순위를 못 가져왔어요." onRetry={league.reload} retryLabel="리그 순위 다시 불러오기" /></div>
  } else {
    const students = league.data.students
    const ranked = students.filter(s => s?.isRegistered === true && isNum(s.totalReturn))
      .sort((a, b) => (b.totalReturn as number) - (a.totalReturn as number))
    const me = students.find(s => s?.userId === userId)
    const idx = ranked.findIndex(s => s.userId === userId)
    if (!me) {
      node = <Tile href="/s/league" label="스쿨 리그" value="—" sub="명단에서 내 계정을 못 찾았어요" />
    } else if (me.isRegistered !== true) {
      node = <Tile href="/s/record" label="스쿨 리그" value="—" valueSize={FS.lg} sub="종목을 기록하면 들어와요 ›" />
    } else if (idx < 0) {
      node = <Tile href="/s/league" label="스쿨 리그" value="—" sub="내 수익률을 아직 계산하지 못했어요" />
    } else {
      const r = ranked[idx].totalReturn as number
      node = (
        <Tile href="/s/league" label="스쿨 리그" ariaLabel={`스쿨 리그 ${idx + 1}위, ${ranked.length}명 중`}
          value={`${idx + 1}위`} chip={rankDeltaChip(me.prevRank, idx + 1, league.data.prevSnapDate, today)}
          /* school-league totalReturn 은 판 종목의 실현 손익까지 더한 값 — 내 자산(지금 보유만)과 다른 숫자인 이유를 밝힌다 */
          sub={<>{ranked.length}명 중 · <span style={{ color: upDown(r), fontWeight: 700 }}>{pct(r)}</span> <span style={{ color: TK.slate500 }}>판 종목 포함</span></>} />
      )
    }
  }
  return <div ref={ref} style={{ display: 'flex', minWidth: 0 }}><div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{node}</div></div>
}
