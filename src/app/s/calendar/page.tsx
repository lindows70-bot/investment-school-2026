'use client'
// 학생 '일정' — 오늘부터 30일: FOMC(한국 새벽) · 미국 CPI·고용·PCE 발표(한국 밤) · 내 종목 실적 발표·배당락·배당 지급. 홈 '주요 일정' 카드와 같은 함수(buildCalendarItems)로 만든다
//   5단계: 홈 바로가기 '배당·실적 일정'·주요 일정 카드 '전체'·내 자산 일정 줄이 여기로 온다(분석 화면 대신 간편 안에서)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import { addDays, fomcKstDates } from '@/lib/homeBrief'
import { useJson } from '@/app/components/student/useJson'
import { card, FailRow, noteStyle, useKstToday, macroRows, macroFailedLabels, macroUnscheduledLabels, buildCalendarItems, calDateText, type CalendarResp, type MacroResp, type CalItem } from '@/app/components/student/home/homeUi'

const WINDOW_DAYS = 30
const WEEK_DAYS = 7
const FOMC_MAX = 2   // 홈 카드와 같이 다음 2회 — 30일 밖이어도 싣는다(한눈 시황 줄이 다음 FOMC 를 말한다)
const back = <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 홈</Link>

function Row({ it, today }: { it: CalItem; today: string }) {
  const inner = (
    <>
      <span style={{ width: 72, flexShrink: 0, fontSize: FS.tiny, color: it.date === today ? TK.slate100 : TK.sub, fontWeight: it.date === today ? 700 : 500, whiteSpace: 'nowrap' }}>{calDateText(it.date, today)}</span>
      <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
      {it.mine && <span style={{ flexShrink: 0, padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: `${TK.teal400}24`, color: TK.teal400, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap' }}>내 종목</span>}
    </>
  )
  const style = { display: 'flex', alignItems: 'center', gap: SP.md, minHeight: 48, borderTop: `1px solid ${TK.border}`, textDecoration: 'none', minWidth: 0 } as const
  return it.mine && it.ticker
    ? <Link href={`/s/stock/${encodeURIComponent(it.ticker)}?n=${encodeURIComponent(it.name ?? '')}`} style={style}>{inner}</Link>
    : <div style={style}>{inner}</div>
}

export default function StudentCalendar() {
  const today = useKstToday()
  const calendar = useJson<CalendarResp>('/api/event-calendar')
  const macro = useJson<MacroResp>('/api/macro-releases')

  let body: React.ReactNode
  if (!today) body = <span style={noteStyle()}>일정을 불러오는 중…</span>
  else {
    const fomcKst = fomcKstDates(FOMC_SCHEDULE.map(m => m.date), today).slice(0, FOMC_MAX)
    const macroList = macroRows(macro)
    const mineOk = calendar.state === 'ok' && Array.isArray(calendar.data?.events)
    const items = buildCalendarItems({ today, windowDays: WINDOW_DAYS, fomcKst, macro: macroList ?? [], events: mineOk ? calendar.data!.events! : [] })
    const weekEnd = addDays(today, WEEK_DAYS)
    const thisWeek = items.filter(it => it.date <= weekEnd)
    const later = items.filter(it => it.date > weekEnd)
    const macroFailed = macroFailedLabels(macro)
    const macroUnscheduled = macroUnscheduledLabels(macro)
    const mineCount = items.filter(it => it.mine).length
    body = (
      <>
        <section aria-label="이번 주" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>이번 주 <span style={{ fontSize: FS.tiny, fontWeight: 500, color: TK.sub }}>오늘부터 {WEEK_DAYS}일</span></h2>
          {thisWeek.length === 0 ? <span style={noteStyle()}>이번 주엔 잡힌 일정이 없어요.</span> : thisWeek.map(it => <Row key={it.key} it={it} today={today} />)}
        </section>
        <section aria-label="그다음" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>그다음 <span style={{ fontSize: FS.tiny, fontWeight: 500, color: TK.sub }}>{WINDOW_DAYS}일 안 · FOMC는 다음 {FOMC_MAX}회</span></h2>
          {later.length === 0 ? <span style={noteStyle()}>{WINDOW_DAYS}일 안에 더 잡힌 일정이 없어요.</span> : later.map(it => <Row key={it.key} it={it} today={today} />)}
        </section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          {fomcKst.length === 0 && <span style={noteStyle()}>FOMC 일정 못 가져옴</span>}
          {(macro.state === 'loading' || macro.state === 'idle') && <span style={noteStyle()}>지표 발표일을 불러오는 중…</span>}
          {macroFailed.length > 0 && <FailRow text={`${macroFailed.join('·')} 발표일 못 가져왔어요.`} onRetry={macro.reload} retryLabel="지표 발표일 다시 불러오기" />}
          {macroUnscheduled.length > 0 && <span style={noteStyle()}>{macroUnscheduled.join('·')}: FRED에 아직 다음 발표일이 없어요</span>}
          {(calendar.state === 'loading' || calendar.state === 'idle') && <span style={noteStyle()}>내 종목 일정을 불러오는 중…</span>}
          {calendar.state === 'unauth' && <span style={noteStyle()}>로그인하면 내 종목 실적·배당 일정이 보여요.</span>}
          {(calendar.state === 'failed' || (calendar.state === 'ok' && !mineOk)) && <FailRow text="내 종목 일정 못 가져옴" onRetry={calendar.reload} retryLabel="내 종목 일정 다시 불러오기" />}
          {mineOk && mineCount === 0 && <span style={noteStyle()}>{WINDOW_DAYS}일 안에 잡힌 내 종목 실적·배당 일정이 없어요.</span>}
          <span style={{ fontSize: FS.micro, color: TK.sub, wordBreak: 'keep-all' }}>FOMC: 미국 발표일의 다음 날 새벽 · 지표: FRED 공식 일정, BLS·BEA 발표 시각(미국 동부 8:30)을 한국 시각으로 · 내 종목: 실적 예정일은 바뀔 수 있어요</span>
        </div>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 720 }}>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100 }}>일정</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>내 종목의 실적 발표·배당과 시장을 움직이는 미국 발표를 날짜순으로 모았어요.</p>
      </header>
      {body}
    </div>
  )
}
