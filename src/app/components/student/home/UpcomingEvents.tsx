'use client'
// 학생 홈 '주요 일정' — FOMC 다음 2회(한국 새벽 발표일) + 내 종목 30일 안 실적·배당(event-calendar), 날짜순 최대 5개
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, FailRow, noteStyle, addDays, kstToday, type CalendarResp } from './homeUi'

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

export default function UpcomingEvents({ calendar }: { calendar: JsonResult<CalendarResp> }) {
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => { setToday(kstToday()) }, [])   // 날짜는 마운트 뒤에만(하이드레이션 사고 전례)

  if (!today) return <section style={card}><CardHead title="주요 일정" /><span style={noteStyle()}>일정을 불러오는 중…</span></section>

  // FOMC — 성명 발표일(미국 날짜)의 다음 날 새벽이 한국 날짜. homeBrief 3줄과 같은 규칙
  const fomc: Item[] = FOMC_SCHEDULE.map(m => m.date).filter(d => YMD.test(d)).map(d => addDays(d, 1))
    .filter(d => d >= today).sort().slice(0, 2)
    .map(d => ({ key: `fomc:${d}`, date: d, label: '새벽 FOMC 금리 발표', mine: false }))

  // 내 종목 — 날짜로 거른다(캐시된 dDay 는 하루 지나면 틀린다). 같은 종목·종류·날짜는 한 번
  const last = addDays(today, WINDOW_DAYS)
  const mineItems: Item[] | null = calendar.state === 'ok' && Array.isArray(calendar.data?.events)
    ? Array.from(new Map(calendar.data.events
        .filter(e => e && TYPE_KO[e.type] && typeof e.name === 'string' && typeof e.date === 'string' && YMD.test(e.date) && e.date >= today && e.date <= last)
        .map(e => [`${e.type}:${e.ticker}:${e.date}`, { key: `${e.type}:${e.ticker}:${e.date}`, date: e.date, label: `${e.name} ${TYPE_KO[e.type]}`, mine: true }] as [string, Item])).values())
    : null

  const items = [...fomc, ...(mineItems ?? [])].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(0, MAX_ITEMS)

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
      {fomc.length === 0 && <span style={noteStyle()}>FOMC 일정 못 가져옴</span>}
      {(calendar.state === 'loading' || calendar.state === 'idle') && <span style={noteStyle()}>내 종목 일정을 불러오는 중…</span>}
      {calendar.state === 'unauth' && <span style={noteStyle()}>로그인하면 내 종목 일정이 보여요.</span>}
      {(calendar.state === 'failed' || (calendar.state === 'ok' && mineItems == null)) && <FailRow text="내 종목 일정 못 가져옴" onRetry={calendar.reload} />}
      {mineItems != null && mineItems.length === 0 && <span style={noteStyle()}>{WINDOW_DAYS}일 안에 잡힌 내 종목 실적·배당 일정이 없어요.</span>}
    </section>
  )
}
