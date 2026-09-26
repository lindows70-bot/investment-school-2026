'use client'
// 학생 홈 '오늘의 한눈 시황' — 시장·내 종목·다가오는 일정 3줄(buildHomeBrief 규칙). 줄마다 자기 원천이 올 때까지만 '불러오는 중'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { buildHomeBrief, type HomeBriefInput, type Line } from '@/lib/homeBrief'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import { acceptFx } from '@/lib/fxAccept'
import { useJson, type JsonResult, type JsonState } from '@/app/components/student/useJson'
import { card, CardHead, toneColor, noteStyle, retryBtn, macroRows, macroFailedLabels, briefSignals, briefEvents, briefMovers, type IndexRow, type CalendarResp, type FxResp, type MacroResp, type MoversResp, type WatchResp } from './homeUi'

const FOMC_DATES = FOMC_SCHEDULE.map(m => m.date)
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const pending = (s: JsonState) => s === 'loading' || s === 'idle'

/** 국내 장 상태 — KST 평일 09:00~15:30 = 장중. 주말은 늘 판정하고, 평일은 휴장일 목록(/api/market-holidays)이 있어야
 *  판정한다 — 목록을 못 받은 평일에 '장중'이라 하면 공휴일엔 거짓이 된다 */
function krxStatus(now: number, holidays: string[] | null): string {
  const k = new Date(now + 9 * 3600_000)
  const ymd = k.toISOString().slice(0, 10)
  const day = k.getUTCDay()
  const mins = k.getUTCHours() * 60 + k.getUTCMinutes()
  if (day === 0 || day === 6) return '국내 휴장일'
  if (holidays == null) return '휴장 여부 확인 못 함'
  if (holidays.includes(ymd)) return '국내 휴장일'
  if (mins < 9 * 60) return '국내 장 시작 전'
  if (mins < 15 * 60 + 30) return '국내 장중'
  return '국내 장 마감'
}

function BriefLine({ line, loadingText }: { line: Line | null; loadingText: string }) {
  if (!line) return <p style={{ margin: 0, ...noteStyle() }}>{loadingText}</p>
  return (
    <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      {line.parts.map((p, i) => <span key={i} style={{ color: toneColor(p.tone) }}>{p.text}</span>)}
    </p>
  )
}

/** today = KST 'YYYY-MM-DD'(페이지의 useKstToday — 마운트 전엔 null). indices·calendar·fx·macro 는 페이지가 한 번 불러 나눠 준다 */
export default function MarketBrief({ indices, calendar, fx, macro, today }: { indices: JsonResult<IndexRow[]>; calendar: JsonResult<CalendarResp>; fx: JsonResult<FxResp>; macro: JsonResult<MacroResp>; today: string | null }) {
  const watch = useJson<WatchResp>('/api/timing-watch')
  const movers = useJson<MoversResp>('/api/day-movers')
  const hol = useJson<{ kr?: { dates?: unknown } | null }>('/api/market-holidays')

  // 장 상태용 시각 — 마운트 뒤에만(렌더 중 new Date() 는 서버 UTC·브라우저 KST 가 달라 하이드레이션이 깨진다, 전례)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)   // 화면을 켜 둔 채 15:30 을 넘기면 '장 마감'으로 바뀌게
    return () => clearInterval(id)
  }, [])

  // 각 원천 → buildHomeBrief 입력. 실패·로그인 필요·모양이 틀림 = null(못 가져옴) — 0 으로 채우지 않는다
  const indicesIn: HomeBriefInput['indices'] = indices.state === 'ok' && Array.isArray(indices.data)
    ? indices.data.filter(x => x && typeof x.id === 'string' && isNum(x.changePct)).map(x => ({ id: x.id, changePct: x.changePct }))
    : null
  // 환율 라우트는 모든 원천이 죽으면 고정 상수(stale-constant)를 준다 — 지금 환율이 아니므로 '못 가져옴'(내 자산과 같은 acceptFx)
  const usdKrw = fx.state === 'ok' ? acceptFx(fx.data) : null
  const signals = briefSignals(watch)
  const events = briefEvents(calendar)
  const moversIn = briefMovers(movers)

  // 지표가 하나라도 빠졌으면 '가장 가까운 발표'라 말할 수 없다 — 남은 것 중 가장 가까운 것을 내면 실제로 더 가까운 발표를 건너뛸 수 있다
  const macroIn: HomeBriefInput['macro'] = macroFailedLabels(macro).length > 0 ? null : macroRows(macro)
  const brief = today ? buildHomeBrief({ indices: indicesIn, usdKrw, signals, events, movers: moversIn, fomcDates: FOMC_DATES, macro: macroIn }, today) : null
  const marketReady = brief && !pending(indices.state) && !pending(fx.state)
  const mineReady = brief && !pending(watch.state) && !pending(calendar.state) && !pending(movers.state)
  const upcomingReady = brief && !pending(calendar.state) && !pending(macro.state)

  const holidays = hol.state === 'ok' && Array.isArray(hol.data?.kr?.dates) ? (hol.data.kr.dates as unknown[]).filter((d): d is string => typeof d === 'string') : null
  const status = now != null && !pending(hol.state) ? krxStatus(now, holidays) : null

  const failed = [indices, fx, watch, calendar, movers, macro].filter(s => s.state === 'failed')

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="오늘의 한눈 시황" extra={status && (
        <span style={{ padding: `2px ${SP.sm}px`, borderRadius: RAD.pill, border: `1px solid ${TK.line1}`, fontSize: FS.micro, color: status === '국내 장중' ? TK.slate100 : TK.sub, whiteSpace: 'nowrap' }}>{status}</span>
      )} />
      <BriefLine line={marketReady ? brief.market : null} loadingText="시장 지수를 불러오는 중…" />
      <BriefLine line={mineReady ? brief.mine : null} loadingText="내 종목 소식을 불러오는 중…" />
      <BriefLine line={upcomingReady ? brief.upcoming : null} loadingText="다가오는 일정을 불러오는 중…" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap', paddingTop: SP.xs, borderTop: `1px solid ${TK.border}` }}>
        {failed.length > 0
          ? <button type="button" onClick={() => failed.forEach(s => s.reload())} aria-label="시황에서 못 가져온 것 다시 불러오기" style={retryBtn}>못 가져온 것 다시</button>
          : <span />}
        <Link href="/briefing" style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.sky400, textDecoration: 'none', whiteSpace: 'nowrap' }}>오늘의 매매 브리핑 전체 ›</Link>
      </div>
    </section>
  )
}
