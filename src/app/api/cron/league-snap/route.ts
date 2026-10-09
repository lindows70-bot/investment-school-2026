// 스쿨 리그 주간 순위 스냅샷 크론 — 월요일 06:30 KST. 리그 API(매번 라이브 계산) 결과의 순위표를 한 장 저장하고 최신 두 장을 묶어 둔다
//   학생 리그 화면 '지난주 N위 → 이번 주 M위'와 선생님 '이번 주 소식' 문구의 재료. 같은 날 다시 돌면 그날 장을 덮어쓰고 '지난주'는 바뀌지 않는다
import { NextResponse } from 'next/server'
import { cronUnauthorized } from '@/lib/cronAuth'
import { getCache, setCache } from '@/lib/appCache'
import { LEAGUE_SNAP_KEY, LEAGUE_SNAP_LATEST_KEY, rankRows, type LeagueSnap, type LeagueSnapLatest } from '@/lib/leagueSnap'
import type { SchoolLeagueData } from '@/app/api/school-league/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const denied = cronUnauthorized(req); if (denied) return denied
  const t0 = Date.now()
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  // 리그 API 는 로그인 없이 계산한다(서비스 롤) — 같은 함수를 부르는 것이 아니라 같은 응답을 쓴다(제2원칙 · 화면과 같은 값)
  const r = await fetch(`${base}/api/school-league`, { cache: 'no-store', signal: AbortSignal.timeout(90_000) }).catch(() => null)
  const j = r && r.ok ? await r.json().catch(() => null) as SchoolLeagueData | null : null
  if (!j || !Array.isArray(j.students)) return NextResponse.json({ ok: false, cached: false, error: '리그 응답 없음' }, { status: 502 })

  const rows = rankRows(j.students)
  if (rows.length === 0) return NextResponse.json({ ok: false, cached: false, error: '순위 0명 — 저장 안 함' })   // 시세 전멸 등 — 빈 장을 남기면 '지난주'가 거짓이 된다
  const today = kstDate()
  const prev = await getCache<LeagueSnapLatest>(LEAGUE_SNAP_LATEST_KEY, 400 * 86_400_000)
  // 월요일에만 새 장을 남긴다 — 상태판 자동 복구가 다른 요일에 불러도 덮어쓰지 않는다(그러면 '지난주' 장이 어제 장이 되어 1주 비교가 깨진다).
  //   첫 장(아직 아무 장도 없을 때)은 요일과 무관하게 남긴다 — 그래야 다음 월요일에 비교 상대가 생긴다. 날짜는 실제 날짜 그대로(월요일로 이름표를 붙이지 않는다)
  const dowKst = new Date(Date.now() + 9 * 3600_000).getUTCDay()
  if (dowKst !== 1 && prev?.current) {
    return NextResponse.json({ ok: true, cached: false, skipped: '월요일에만 저장', current: prev.current.date, previous: prev.previous?.date ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const snap: LeagueSnap = { date: today, rows }
  await setCache(LEAGUE_SNAP_KEY(today), snap)
  // 같은 날 재실행이면 current 만 갱신(previous 유지) · 다른 날이면 지난 current 가 previous 로
  const previous = prev ? (prev.current.date === today ? prev.previous : prev.current) : null
  const latest: LeagueSnapLatest = { current: snap, previous }
  await setCache(LEAGUE_SNAP_LATEST_KEY, latest)

  return NextResponse.json({ ok: true, cached: true, date: today, ranked: rows.length, previous: previous?.date ?? null, ms: Date.now() - t0 }, { headers: { 'Cache-Control': 'no-store' } })
}
