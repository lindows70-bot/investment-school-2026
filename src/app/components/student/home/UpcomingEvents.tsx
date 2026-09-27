'use client'
// 학생 홈 '주요 일정' — FOMC 다음 2회(한국 새벽 발표일) + 미국 CPI·고용·PCE 30일 안 발표(FRED, 한국 밤) + 내 종목 30일 안 실적·배당(event-calendar), 날짜순 최대 5개. 항목은 /s/calendar 와 같은 buildCalendarItems
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import { fomcKstDates } from '@/lib/homeBrief'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, FailRow, noteStyle, macroRows, macroFailedLabels, macroUnscheduledLabels, buildCalendarItems, calDateText, type CalendarResp, type MacroResp } from './homeUi'

const WINDOW_DAYS = 30   // homeBrief '다가오는 일정'과 같은 창
const MAX_ITEMS = 5
const FOMC_MAX = 2   // 홈 카드는 다음 2회만(/s/calendar 는 30일 안 전부)

/** today = KST 'YYYY-MM-DD'(페이지가 마운트 뒤 useKstToday 로 준다 — 그 전엔 null). macro = /api/macro-releases(페이지가 한 번 불러 한눈 시황과 나눈다) */
export default function UpcomingEvents({ calendar, macro, today }: { calendar: JsonResult<CalendarResp>; macro: JsonResult<MacroResp>; today: string | null }) {

  if (!today) return <section style={card}><CardHead title="주요 일정" /><span style={noteStyle()}>일정을 불러오는 중…</span></section>

  // 항목은 /s/calendar 와 같은 함수로 — 두 화면이 다른 일정을 보이지 않게. FOMC 만 홈은 다음 2회로 자른다
  const fomcKst = fomcKstDates(FOMC_SCHEDULE.map(m => m.date), today).slice(0, FOMC_MAX)
  const macroList = macroRows(macro)
  const macroFailed = macroFailedLabels(macro)
  const macroUnscheduled = macroUnscheduledLabels(macro)
  const mineOk = calendar.state === 'ok' && Array.isArray(calendar.data?.events)
  const all = buildCalendarItems({ today, windowDays: WINDOW_DAYS, fomcKst, macro: macroList ?? [], events: mineOk ? calendar.data!.events! : [] })
  const mineCount = all.filter(it => it.mine).length
  const items = all.slice(0, MAX_ITEMS)
  const more = all.length - items.length

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <CardHead title="주요 일정" href="/s/calendar" linkText="전체 일정 ›" />
      {items.map(it => (
        <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: SP.md, minHeight: 44, borderTop: `1px solid ${TK.border}` }}>
          <span style={{ width: 72, flexShrink: 0, fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{calDateText(it.date, today)}</span>
          <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          {it.mine && <span style={{ flexShrink: 0, padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: `${TK.sky400}24`, color: TK.sky400, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap' }}>내 종목</span>}
        </div>
      ))}
      {more > 0 && <span style={noteStyle()}>외 {more}건 — 전체 일정에서</span>}
      {fomcKst.length === 0 && <span style={noteStyle()}>FOMC 일정 못 가져옴</span>}
      {(macro.state === 'loading' || macro.state === 'idle') && <span style={noteStyle()}>지표 발표일을 불러오는 중…</span>}
      {macroFailed.length > 0 && <FailRow text={`${macroFailed.join('·')} 발표일 못 가져왔어요.`} onRetry={macro.reload} retryLabel="지표 발표일 다시 불러오기" />}
      {macroUnscheduled.length > 0 && <span style={noteStyle()}>{macroUnscheduled.join('·')}: FRED에 아직 다음 발표일이 없어요</span>}
      {(calendar.state === 'loading' || calendar.state === 'idle') && <span style={noteStyle()}>내 종목 일정을 불러오는 중…</span>}
      {calendar.state === 'unauth' && <span style={noteStyle()}>로그인하면 내 종목 일정이 보여요.</span>}
      {(calendar.state === 'failed' || (calendar.state === 'ok' && !mineOk)) && <FailRow text="내 종목 일정 못 가져옴" onRetry={calendar.reload} retryLabel="내 종목 일정 다시 불러오기" />}
      {mineOk && mineCount === 0 && <span style={noteStyle()}>{WINDOW_DAYS}일 안에 잡힌 내 종목 실적·배당 일정이 없어요.</span>}
      {macroList != null && <span style={{ fontSize: FS.micro, color: TK.sub }}>발표일: FRED 공식 일정 · 시각: BLS·BEA 발표 시각(미국 동부 8:30)을 한국 시각으로</span>}
    </section>
  )
}
