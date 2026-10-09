// 선생님용 '이번 주 소식' 문구 — 반 단톡방에 붙여넣을 글을 결정론 템플릿으로 만든다(학생 복귀 2단계 · 2026-10-09)
//   재료: 리그 순위(라이브 · studentTotalReturn SSOT) + 월요일 스냅샷(지난번 순위) + 주간 리포트 공통 캐시의 지수 주간 등락(같은 값 재사용) + 7일 안 일정(FOMC·미국 지표)
//   ⛔ LLM 없음(이름·순위·수익률은 개인 데이터) · 금액 없음(리그 원칙) · 자동 전송 없음(선생님이 복사해 붙인다)
import { NextResponse } from 'next/server'
import { isTeacher } from '@/lib/cronAuth'
import { getCache } from '@/lib/appCache'
import { rankRows, LEAGUE_SNAP_LATEST_KEY, type LeagueSnapLatest } from '@/lib/leagueSnap'
import { fomcKstDates, addDays } from '@/lib/homeBrief'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import type { SchoolLeagueData } from '@/app/api/school-league/route'
import type { MacroReleasesResp } from '@/app/api/macro-releases/route'
import type { WrCommon } from '@/app/api/weekly-report/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = 'https://investment-school-2026.vercel.app/s'
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const md = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return `${m}/${d}(${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})` }
const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`
const delta = (prev: number | null, now: number) => prev == null ? '' : prev > now ? ` ↑${prev - now}` : prev < now ? ` ↓${now - prev}` : ' ='

export async function GET(req: Request) {
  if (!(await isTeacher())) return NextResponse.json({ error: '선생님만 쓸 수 있어요.' }, { status: 403 })
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const today = kstDate()
  const until = addDays(today, 7)
  // 리그 API 는 로그인을 요구한다 — 서버 안 자기 호출엔 쿠키가 안 실리므로 선생님의 쿠키를 그대로 넘긴다
  const cookie = req.headers.get('cookie') ?? ''
  const get = async <T,>(path: string): Promise<T | null> => {
    try { const r = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(60_000), headers: { cookie } }); return r.ok ? await r.json() as T : null } catch { return null }
  }
  const [league, macro, latest] = await Promise.all([
    get<SchoolLeagueData>('/api/school-league'),
    get<MacroReleasesResp>('/api/macro-releases'),
    getCache<LeagueSnapLatest>(LEAGUE_SNAP_LATEST_KEY, 400 * 86_400_000).catch(() => null),
  ])
  const missing: string[] = []
  const lines: string[] = [`📣 투자학교 이번 주 소식 (${md(today)})`, '']

  // 🏆 리그 — 지난번 스냅샷이 있으면 변화까지(없으면 순위만 · 추정 안 함)
  if (league && Array.isArray(league.students)) {
    const rows = rankRows(league.students)
    const prevRows = latest?.previous?.rows ?? latest?.current?.rows ?? null   // 비교 상대: 지난 월요일 장(없으면 가장 최근 장)
    const prevDate = latest?.previous?.date ?? latest?.current?.date ?? null
    const prevRank = (uid: string) => prevRows?.find(r => r.userId === uid)?.rank ?? null
    lines.push(`🏆 리그 순위 (${rows.length}명${prevDate && prevDate !== today ? ` · ${md(prevDate)} 대비` : ''})`)
    for (const r of rows.slice(0, 3)) lines.push(`${r.rank}위 ${r.name} ${pct(r.totalReturn)}${delta(prevRank(r.userId), r.rank)}`)
    if (prevRows && prevDate !== today) {
      const climbers = rows.map(r => ({ r, up: (prevRank(r.userId) ?? r.rank) - r.rank })).filter(x => x.up > 0).sort((a, b) => b.up - a.up)
      if (climbers.length) lines.push(`가장 많이 올라온 친구: ${climbers[0].r.name} (↑${climbers[0].up})`)
    }
    const unregistered = league.students.filter(s => !s.isRegistered).length
    if (unregistered > 0) lines.push(`아직 종목을 안 넣은 친구 ${unregistered}명 — 한 종목만 적어도 리그에 들어와요`)
    lines.push('')
  } else missing.push('리그')

  // 📈 지난주 시장 — 주간 리포트 공통 캐시(코스피·S&P 500·원/달러)와 같은 값. 최근 7일 안 캐시가 없으면 줄을 뺀다(계산을 따로 하지 않는다)
  let common: WrCommon | null = null
  for (let d = 0; d < 7 && !common; d++) common = await getCache<WrCommon>(`weekly-report-common-v12:${addDays(today, -d)}`, 8 * 86_400_000).catch(() => null)
  const idx = (key: string) => common?.indices?.find(i => i.key === key) ?? null
  const kospi = idx('kospi'), sp = idx('sp500'), fx = idx('usdkrw')
  if (kospi?.weekPct != null || sp?.weekPct != null) {
    const parts = [
      kospi?.weekPct != null ? `코스피 ${pct(kospi.weekPct)}` : null,
      sp?.weekPct != null ? `S&P 500 ${pct(sp.weekPct)}` : null,
      fx?.close != null ? `원/달러 ${Math.round(fx.close).toLocaleString('ko-KR')}원` : null,
    ].filter(Boolean)
    lines.push(`📈 지난주 시장: ${parts.join(' · ')}`, '')
  } else missing.push('시장 주간 등락')

  // 📅 이번 주 일정 — FOMC(한국 시각 새벽) + 미국 지표(CPI·고용·PCE · 밤)
  const events: { date: string; text: string }[] = []
  for (const d of fomcKstDates(FOMC_SCHEDULE.map(m => m.date), today)) if (d <= until) events.push({ date: d, text: `${md(d)} 새벽 FOMC 금리 발표` })
  if (macro && Array.isArray(macro.events)) {
    for (const e of macro.events) if (e.kstDate >= today && e.kstDate <= until) events.push({ date: e.kstDate, text: `${md(e.kstDate)} ${e.kstTime === '21:30' ? '밤 9:30' : '밤 10:30'} 미국 ${e.label} 발표` })
  } else missing.push('미국 지표 일정')
  events.sort((a, b) => a.date < b.date ? -1 : 1)
  if (events.length) lines.push('📅 이번 주 일정', ...events.map(e => `· ${e.text}`), '')

  lines.push(`👉 앱 열기: ${APP_URL}`)
  return NextResponse.json({ text: lines.join('\n'), missing, asOf: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
