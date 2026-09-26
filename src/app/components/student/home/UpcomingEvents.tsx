'use client'
// 학생 홈 '주요 일정' — FOMC 다음 2회(한국 새벽 발표일) + 미국 CPI·고용·PCE 30일 안 발표(FRED, 한국 밤) + 내 종목 30일 안 실적·배당(event-calendar), 날짜순 최대 5개
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import { addDays, fomcKstDates } from '@/lib/homeBrief'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, FailRow, noteStyle, macroRows, macroFailedLabels, macroUnscheduledLabels, macroNightText, type CalendarResp, type MacroResp } from './homeUi'

const TYPE_KO: Record<string, string> = { earnings: '실적 발표', exDiv: '배당락', payDiv: '배당 지급' }
const YMD = /^\d{4}-\d{2}-\d{2}$/
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const WINDOW_DAYS = 30   // homeBrief '다가오는 일정'과 같은 창
const MAX_ITEMS = 5

interface Item { key: string; date: string; label: string; mine: boolean }

/** 'YYYY-MM-DD' → '오늘' 또는 'M/D(요일)' — 문자열 산술만(시계 안 봄) */
function dateText(ymd: string, today: string) {
  if (ymd === today) return '오늘'
  const [y, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}(${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`
}

/** today = KST 'YYYY-MM-DD'(페이지가 마운트 뒤 useKstToday 로 준다 — 그 전엔 null). macro = /api/macro-releases(페이지가 한 번 불러 한눈 시황과 나눈다) */
export default function UpcomingEvents({ calendar, macro, today }: { calendar: JsonResult<CalendarResp>; macro: JsonResult<MacroResp>; today: string | null }) {

  if (!today) return <section style={card}><CardHead title="주요 일정" /><span style={noteStyle()}>일정을 불러오는 중…</span></section>

  // FOMC — 성명 발표일(미국 날짜)의 다음 날 새벽이 한국 날짜. homeBrief 3줄과 같은 함수
  const fomc: Item[] = fomcKstDates(FOMC_SCHEDULE.map(m => m.date), today).slice(0, 2)
    .map(d => ({ key: `fomc:${d}`, date: d, label: '새벽 FOMC 금리 발표', mine: false }))

  // 내 종목 — 날짜로 거른다(캐시된 dDay 는 하루 지나면 틀린다). 같은 종목·종류·날짜는 한 번
  const last = addDays(today, WINDOW_DAYS)
  // 미국 지표 — 8:30(미국 동부) 발표라 한국은 같은 날 밤 9:30(서머타임)·10:30. 30일 안만
  const macroList = macroRows(macro)
  const macroItems: Item[] = (macroList ?? []).flatMap(m => {
    const t = macroNightText(m.kstTime)   // macroRows 가 이미 걸렀으므로 늘 값이 있다 — 타입 좁히기용
    return t && m.kstDate >= today && m.kstDate <= last
      ? [{ key: `macro:${m.kind}:${m.kstDate}`, date: m.kstDate, label: `${t} · ${m.label} 발표`, mine: false }]
      : []
  })
  const macroFailed = macroFailedLabels(macro)
  const macroUnscheduled = macroUnscheduledLabels(macro)
  const mineItems: Item[] | null = calendar.state === 'ok' && Array.isArray(calendar.data?.events)
    ? Array.from(new Map(calendar.data.events
        .filter(e => e && TYPE_KO[e.type] && typeof e.name === 'string' && typeof e.date === 'string' && YMD.test(e.date) && e.date >= today && e.date <= last)
        .map(e => [`${e.type}:${e.ticker}:${e.date}`, { key: `${e.type}:${e.ticker}:${e.date}`, date: e.date, label: `${e.name} ${TYPE_KO[e.type]}`, mine: true }] as [string, Item])).values())
    : null

  const all = [...fomc, ...macroItems, ...(mineItems ?? [])].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  const items = all.slice(0, MAX_ITEMS)
  const more = all.length - items.length
  // 넘친 것이 전부 내 종목 일정일 때만 '배당·실적 일정에서' 안내 — FOMC·지표는 그 화면에 없다
  const moreAllMine = all.slice(MAX_ITEMS).every(it => it.mine)

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <CardHead title="주요 일정" href="/assets" linkText="배당·실적 일정 ›" />
      {items.map(it => (
        <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: SP.md, minHeight: 44, borderTop: `1px solid ${TK.border}` }}>
          <span style={{ width: 72, flexShrink: 0, fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{dateText(it.date, today)}</span>
          <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          {it.mine && <span style={{ flexShrink: 0, padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: `${TK.sky400}24`, color: TK.sky400, fontSize: FS.micro, fontWeight: 700, whiteSpace: 'nowrap' }}>내 종목</span>}
        </div>
      ))}
      {more > 0 && <span style={noteStyle()}>외 {more}건{moreAllMine ? ' — 전체는 배당·실적 일정에서' : ''}</span>}
      {fomc.length === 0 && <span style={noteStyle()}>FOMC 일정 못 가져옴</span>}
      {(macro.state === 'loading' || macro.state === 'idle') && <span style={noteStyle()}>지표 발표일을 불러오는 중…</span>}
      {macroFailed.length > 0 && <FailRow text={`${macroFailed.join('·')} 발표일 못 가져왔어요.`} onRetry={macro.reload} retryLabel="지표 발표일 다시 불러오기" />}
      {macroUnscheduled.length > 0 && <span style={noteStyle()}>{macroUnscheduled.join('·')}: FRED에 아직 다음 발표일이 없어요</span>}
      {(calendar.state === 'loading' || calendar.state === 'idle') && <span style={noteStyle()}>내 종목 일정을 불러오는 중…</span>}
      {calendar.state === 'unauth' && <span style={noteStyle()}>로그인하면 내 종목 일정이 보여요.</span>}
      {(calendar.state === 'failed' || (calendar.state === 'ok' && mineItems == null)) && <FailRow text="내 종목 일정 못 가져옴" onRetry={calendar.reload} retryLabel="내 종목 일정 다시 불러오기" />}
      {mineItems != null && mineItems.length === 0 && <span style={noteStyle()}>{WINDOW_DAYS}일 안에 잡힌 내 종목 실적·배당 일정이 없어요.</span>}
      {macroList != null && <span style={{ fontSize: FS.micro, color: TK.sub }}>발표일: FRED 공식 일정 · 시각: BLS·BEA 발표 시각(미국 동부 8:30)을 한국 시각으로</span>}
    </section>
  )
}
