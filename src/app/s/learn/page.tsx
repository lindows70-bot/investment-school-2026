'use client'
// 학생 배우기 — 오늘의 명언 · 오늘 알려드려요(규칙 4종 순환, 필요한 원천만) · 매매 브리핑 한 줄 · 수업 자료 · 더 알아보기(분석 화면)
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { quoteOfDay } from '@/lib/quotes'
import { buildHomeBrief } from '@/lib/homeBrief'
import { upDown } from '@/lib/studentFormat'
import type { Tip } from '@/lib/learnTips'
import { useJson, type JsonResult, type JsonState } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import {
  card, CardHead, FailRow, noteStyle, retryBtn, toneColor, useKstToday,
  briefSignals, briefEvents, briefMovers, type CalendarResp, type MoversResp, type WatchResp,
} from '@/app/components/student/home/homeUi'
import { useTodayTip, type TodayTip } from '@/app/components/student/learn/useTodayTip'

const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const linkBtn = { alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' } as const
const moreLink = { display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.sky400, textDecoration: 'none', whiteSpace: 'nowrap' } as const

/** 'YYYY-MM-DD' → M/D (올해가 아니면 연도/M/D) — learnTips 와 같은 표기 */
const md = (ymd: string, today: string) => `${ymd.slice(0, 4) === today.slice(0, 4) ? '' : `${ymd.slice(0, 4)}/`}${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}`

// ── 1. 오늘의 명언 ──────────────────────────────────────────────────────────
function QuoteCard({ today }: { today: string | null }) {
  const [open, setOpen] = useState(false)
  const q = today ? quoteOfDay(today) : null
  // B22 는 출처 문구에 이미 '그레이엄의 말을 버핏이 인용'이 있다 — 같은 말을 두 번 쓰지 않는다
  const quoted = q?.quotedBy && !q.sourceLabel.includes('인용') ? ` (${q.quotedBy} 인용)` : ''
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="오늘의 명언" />
      {!q ? <span style={noteStyle()}>오늘의 명언을 고르는 중…</span> : (
        <>
          <p style={{ margin: 0, fontSize: FS.lg, lineHeight: 1.6, color: TK.slate100, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>“{q.ko}”</p>
          <span style={{ fontSize: FS.tiny, color: TK.slate300, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
            — {q.person}{quoted} · {q.sourceLabel}{q.note ? ` · ${q.note}` : ''}
          </span>
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="learn-quote-original"
            style={{ ...retryBtn, alignSelf: 'flex-start', padding: `0 ${SP.md}px` }}>
            {open ? '원문 닫기' : '원문 보기'}
          </button>
          <p id="learn-quote-original" lang="en" hidden={!open}
            style={{ margin: 0, fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate300, fontStyle: 'italic', overflowWrap: 'anywhere' }}>
            {q.original}
          </p>
        </>
      )}
    </section>
  )
}

// ── 2. 오늘 알려드려요 ──────────────────────────────────────────────────────
/** 제목 안의 등락률(+5.2% · −4.3% · 0.0%)만 한국식 등락색으로 — 등락이 있는 이야기(tone)일 때만 */
const PCT_RE = /([+−]?\d[\d,]*(?:\.\d+)?%)/
function TipTitle({ tip }: { tip: Tip }) {
  const style = { margin: 0, fontSize: FS.lg, fontWeight: 700, lineHeight: 1.5, color: TK.slate100, wordBreak: 'keep-all', overflowWrap: 'anywhere' } as const
  if (!tip.tone) return <h3 style={style}>{tip.title}</h3>
  return (
    <h3 style={style}>
      {tip.title.split(PCT_RE).map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>
        const v = parseFloat(part.replace('−', '-').replace(/[,%]/g, ''))
        return <span key={i} style={{ color: upDown(Number.isFinite(v) ? v : null) }}>{part}</span>
      })}
    </h3>
  )
}

function TipCard({ t, today }: { t: TodayTip; today: string | null }) {
  let body: React.ReactNode
  if (t.status === 'waiting' || t.status === 'loading') body = <span style={noteStyle()}>오늘 이야기를 고르는 중…</span>
  else if (t.status === 'unauth') body = <span style={noteStyle()}>로그인하면 내 종목 이야기를 알려드려요.</span>
  else if (t.status === 'noHoldings') body = (
    <>
      <span style={{ fontSize: FS.body, color: TK.slate200 }}>종목을 기록하면 내 종목 이야기를 알려드려요</span>
      <Link href="/s/record" style={linkBtn}>종목 기록하기</Link>
    </>
  )
  else if (t.status === 'failed') body = <FailRow text="오늘 이야기를 불러오지 못했어요." onRetry={t.retry} retryLabel="오늘 알려드려요 다시 불러오기" />
  else if (t.status === 'none') body = (
    <>
      <span style={{ fontSize: FS.body, color: TK.slate200 }}>오늘은 알려드릴 내 종목 이야기가 없어요</span>
      {t.partialFail && <FailRow text="일부 정보는 못 가져왔어요." onRetry={t.retry} retryLabel="오늘 알려드려요 다시 불러오기" />}
    </>
  )
  else if (t.tip && today) {
    const tip = t.tip
    const asOfMd = tip.asOf ? md(tip.asOf, today) : null
    // 기준일은 출처 옆에 — 일정 이야기의 날짜는 기준일이 아니라 일정 날짜(제목에 있다)이고, 출처에 이미 같은 기준일이 있으면 두 번 쓰지 않는다
    const prefix = asOfMd && tip.kind !== 'event' && !tip.source.includes(`${asOfMd} 기준`) ? `${asOfMd} 기준 · ` : ''
    const name = tip.ticker ? t.nameOf(tip.ticker) : null
    const href = tip.ticker
      ? `/s/stock/${encodeURIComponent(tip.ticker)}?${[tip.market ? `m=${encodeURIComponent(tip.market)}` : '', name ? `n=${encodeURIComponent(name)}` : ''].filter(Boolean).join('&')}`
      : null
    body = (
      <>
        <TipTitle tip={tip} />
        <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{tip.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap', paddingTop: SP.xs, borderTop: `1px solid ${TK.border}` }}>
          <span style={{ fontSize: FS.micro, color: TK.sub, minWidth: 0, overflowWrap: 'anywhere' }}>{prefix}{tip.source}</span>
          {href && <Link href={href} style={moreLink}>{name ?? tip.ticker} 자세히 ›</Link>}
        </div>
      </>
    )
  } else body = <span style={noteStyle()}>오늘 이야기를 고르는 중…</span>
  return (
    <section aria-live="polite" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="오늘 알려드려요" />
      {body}
    </section>
  )
}

// ── 3. 오늘의 매매 브리핑 한 줄(홈 한눈 시황의 '내 종목' 줄과 같은 규칙) ─────────
function BriefCard({ sectionRef, seen, calendar, movers, today }: {
  sectionRef: (el: HTMLElement | null) => void; seen: boolean
  calendar: JsonResult<CalendarResp>; movers: JsonResult<MoversResp>; today: string | null
}) {
  const watch = useJson<WatchResp>('/api/timing-watch', { enabled: seen })
  const ready = today != null && !pending(watch.state) && !pending(calendar.state) && !pending(movers.state)
  // '내 종목' 줄만 쓴다 — 시장·일정 줄의 원천은 넘기지 않는다(null)
  const mine = ready
    ? buildHomeBrief({ indices: null, usdKrw: null, signals: briefSignals(watch), events: briefEvents(calendar), movers: briefMovers(movers), fomcDates: null, macro: null }, today).mine
    : null
  const failed = [watch, calendar, movers].filter(s => s.state === 'failed')
  return (
    <section ref={sectionRef} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="오늘의 매매 브리핑" />
      {!mine ? <span style={noteStyle()}>내 종목 소식을 불러오는 중…</span> : (
        <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
          {mine.parts.map((p, i) => <span key={i} style={{ color: toneColor(p.tone) }}>{p.text}</span>)}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap', paddingTop: SP.xs, borderTop: `1px solid ${TK.border}` }}>
        {failed.length > 0
          ? <button type="button" onClick={() => failed.forEach(s => s.reload())} aria-label="매매 브리핑에서 못 가져온 것 다시 불러오기" style={retryBtn}>못 가져온 것 다시</button>
          : <span />}
        <Link href="/briefing" style={moreLink}>오늘의 매매 브리핑 전체 ›</Link>
      </div>
    </section>
  )
}

// ── 4. 수업 자료(투자 아카데미 4) ─────────────────────────────────────────────
const ACADEMY = [
  { href: '/investment-academy', title: '투자 아카데미', sub: '린치·버핏 기초 수업' },
  { href: '/master-strategy', title: '최일 전략', sub: '코어·위성 비율 원칙' },
  { href: '/weekly-report', title: '주간 리포트', sub: '이번 주 내 포트폴리오' },
  { href: '/school-lounge', title: '스쿨 라운지', sub: '질문하고 이야기하기' },
]

// ── 5. 더 알아보기 5묶음(선생님 분석 화면으로 열린다) — 이름은 사이드바 메뉴 이름을 줄인 것 ──
const MORE: { title: string; links: { href: string; label: string }[] }[] = [
  { title: '종목 분석', links: [
    { href: '/research', label: '종목 리서치' }, { href: '/earnings-reports', label: '실적 리포트' },
    { href: '/tech-chart', label: '기술적 차트' }, { href: '/valuation', label: '최일 가치분석' },
  ] },
  { title: '종목 추천', links: [
    { href: '/reco-hub', label: '추천 지도' }, { href: '/hi52-radar', label: '신고가 레이더' },
    { href: '/dashboard?tab=rotation', label: '섹터 로테이션 시계' },
  ] },
  { title: '시장·경제 흐름', links: [
    { href: '/macro-hub', label: '매크로 허브' }, { href: '/us-smart-money', label: '미국 스마트머니' },
  ] },
  { title: '배당·채권·코인', links: [
    { href: '/dividend', label: '배당 인컴 랩' }, { href: '/bonds', label: '채권 듀레이션 나침반' },
    { href: '/dashboard?tab=coinlab&cv=btc', label: '코인 랩' },
  ] },
  { title: '부동산', links: [
    { href: '/real-estate', label: '부동산 시장 대시보드' }, { href: '/real-estate/honeycomb', label: '벌집순환모형(지역 사이클)' },
    { href: '/real-estate/apt', label: '아파트 단지 리서치' },
  ] },
]

const sectionTitle = { margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 } as const

export default function StudentLearn() {
  const today = useKstToday()   // 마운트 뒤에만 정해진다(렌더 중 날짜 금지 — 서버 UTC·브라우저 KST 가 다른 날을 본다)
  const pf = useMyPortfolio()
  const [briefRef, briefSeen] = useInView<HTMLElement>()
  // 일정·등락 원천은 매매 브리핑 카드와 '오늘 알려드려요' ③·④ 가 함께 쓴다 — 둘 중 먼저 필요해진 쪽이 켜고, 한 번 켜면 끄지 않는다
  const [wantCal, setWantCal] = useState(false)
  const [wantMov, setWantMov] = useState(false)
  const calendar = useJson<CalendarResp>('/api/event-calendar', { enabled: briefSeen || wantCal })
  const movers = useJson<MoversResp>('/api/day-movers', { enabled: briefSeen || wantMov })
  const wantCalendar = useCallback(() => setWantCal(true), [])
  const wantMovers = useCallback(() => setWantMov(true), [])
  const tip = useTodayTip({ today, pf, calendar, movers, wantCalendar, wantMovers })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      {/* 폰이 기본, 769px↑ 만 덮어쓴다 — 기본값 + min-width 하나라 두 조건이 정확한 여집합이다 */}
      <style>{`
        .sl-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px; align-items: start }
        .sl-academy { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${SP.sm}px }
        .sl-more { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.md}px; align-items: start }
        @media (min-width: 769px) {
          .sl-two { grid-template-columns: repeat(2, minmax(0, 1fr)) }
          .sl-academy { grid-template-columns: repeat(4, minmax(0, 1fr)) }
          .sl-more { grid-template-columns: repeat(2, minmax(0, 1fr)) }
        }
      `}</style>
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>배우기</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>매일 하나씩 — 투자 거장의 한마디와 내 종목 이야기</p>
      </header>

      <div className="sl-two">
        <QuoteCard today={today} />
        <TipCard t={tip} today={today} />
      </div>

      <BriefCard sectionRef={briefRef} seen={briefSeen} calendar={calendar} movers={movers} today={today} />

      <section aria-labelledby="learn-academy" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 id="learn-academy" style={sectionTitle}>수업 자료</h2>
        <nav aria-label="수업 자료" className="sl-academy">
          {ACADEMY.map(a => (
            <Link key={a.href} href={a.href} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: SP.xs, minHeight: 72, padding: SP.md, borderRadius: RAD.md, background: TK.card, border: `1px solid ${TK.border}`, textDecoration: 'none', minWidth: 0 }}>
              <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, wordBreak: 'keep-all' }}>{a.title}</span>
              <span style={{ fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{a.sub}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section aria-labelledby="learn-more" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap' }}>
          <h2 id="learn-more" style={sectionTitle}>더 알아보기</h2>
          <span style={noteStyle()}>분석 화면으로 열려요</span>
        </div>
        <div className="sl-more">
          {MORE.map(g => (
            <nav key={g.title} aria-label={g.title} style={{ ...card, display: 'flex', flexDirection: 'column', paddingTop: SP.md, paddingBottom: SP.xs }}>
              <h3 style={{ margin: 0, paddingBottom: SP.xs, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>{g.title}</h3>
              {g.links.map(l => (
                <Link key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, minHeight: 44, borderTop: `1px solid ${TK.border}`, fontSize: FS.body, color: TK.slate200, textDecoration: 'none', minWidth: 0 }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.label}</span>
                  <span aria-hidden style={{ color: TK.sub, flexShrink: 0 }}>›</span>
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </section>
    </div>
  )
}
