'use client'
// 학생 배우기 — 오늘의 명언 · 오늘 알려드려요(배움 규칙 5종 순환: PER·지수 대비·집중도·환율 효과·코어위성) · 오늘 내 종목 소식(신호·실적·등락+뉴스 링크 3줄) · 수업 자료 · 폰 앱 설치 · 내 계정
//   5단계(2026-09-27): '더 알아보기' 16개(분석 화면 링크)를 뺐다 — 간편 화면에서 누른 건 간편 안에서 끝난다(phase5-plan)
//   2026-09-27 재설계: 두 카드가 같은 등락 이야기를 하던 것을 '배움'(내 숫자로 개념) / '소식'(오늘 일어난 일)로 갈랐다.
import Link from 'next/link'
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { quoteOfDay } from '@/lib/quotes'
import { mineParts, MOVE_MIN } from '@/lib/homeBrief'
import { upDown, pct } from '@/lib/studentFormat'
import { getAssetType } from '@/lib/assetClassifier'
import type { Tip } from '@/lib/learnTips'
import { useJson, type JsonResult, type JsonState } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { useMyPortfolio } from '@/app/components/student/useMyPortfolio'
import {
  card, CardHead, FailRow, noteStyle, retryBtn, toneColor, useKstToday,
  briefSignals, briefEvents, briefMovers, type CalendarResp, type MoversResp, type WatchResp,
} from '@/app/components/student/home/homeUi'
import { useTodayTip, type TodayTip } from '@/app/components/student/learn/useTodayTip'
import InstallCard from '@/app/components/student/InstallCard'
import ScaleSummary from '@/app/components/student/learn/ScaleSummary'
import LogoutButton from '@/app/components/student/LogoutButton'
import { setViewMode } from '@/lib/viewMode'

const pending = (s: JsonState) => s === 'loading' || s === 'idle'
const linkBtn = { alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' } as const
// 긴 종목 이름도 375px 에서 넘치지 않게 — 링크는 줄어들 수 있고(minWidth 0) 글자는 안쪽 span 에서 말줄임
const moreLink = { display: 'flex', alignItems: 'center', minHeight: 44, minWidth: 0, maxWidth: '100%', fontSize: FS.tiny, color: TK.sky400, textDecoration: 'none' } as const
const ellipsis = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

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
          {/* 사진첩의 한국어 글은 원문이 없다(빈 문자열) — 빈 '원문 보기'를 내밀지 않는다 */}
          {q.original && (
            <>
              <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="learn-quote-original"
                style={{ ...retryBtn, alignSelf: 'flex-start', padding: `0 ${SP.md}px` }}>
                {open ? '원문 닫기' : '원문 보기'}
              </button>
              <p id="learn-quote-original" hidden={!open}
                style={{ margin: 0, fontSize: FS.tiny, lineHeight: 1.6, color: TK.slate300, fontStyle: 'italic', overflowWrap: 'anywhere' }}>
                {q.original}
              </p>
            </>
          )}
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
    const prefix = asOfMd && !tip.source.includes(`${asOfMd} 기준`) ? `${asOfMd} 기준 · ` : ''
    const name = tip.ticker ? t.nameOf(tip.ticker) : null
    const href = tip.ticker
      ? `/s/stock/${encodeURIComponent(tip.ticker)}?${[tip.market ? `m=${encodeURIComponent(tip.market)}` : '', name ? `n=${encodeURIComponent(name)}` : ''].filter(Boolean).join('&')}`
      : null
    body = (
      <>
        <TipTitle tip={tip} />
        {/* 본문이 빈 경우 = ETF·코인 등락처럼 뉴스를 찾아보지 않은 이야기 — 빈 줄을 그리지 않는다 */}
        {tip.body && <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{tip.body}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap', paddingTop: SP.xs, borderTop: `1px solid ${TK.border}` }}>
          <span style={{ fontSize: FS.micro, color: TK.sub, minWidth: 0, overflowWrap: 'anywhere' }}>{prefix}{tip.source}</span>
          {href && <Link href={href} style={moreLink}><span style={ellipsis}>{name ?? tip.ticker} 자세히 ›</span></Link>}
          {!href && tip.link && <Link href={tip.link.href} style={moreLink}><span style={ellipsis}>{tip.link.label}</span></Link>}
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

// ── 3. 오늘 내 종목 소식 — 홈 한눈 시황 '내 종목' 줄과 같은 규칙(mineParts)을 세 줄로 펼치고, 크게 움직인 종목엔 기사 링크를 붙인다 ─────
interface NewsLink { title: string; url: string | null }
interface CatalystRow { ticker?: unknown; links?: unknown }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const rowStyle = { display: 'flex', flexDirection: 'column', gap: 2, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` } as const
const labelStyle = { fontSize: FS.micro, color: TK.sub } as const

function NewsCard({ sectionRef, seen, calendar, movers, today }: {
  sectionRef: (el: HTMLElement | null) => void; seen: boolean
  calendar: JsonResult<CalendarResp>; movers: JsonResult<MoversResp>; today: string | null
}) {
  const watch = useJson<WatchResp>('/api/timing-watch', { enabled: seen })
  const ready = today != null && !pending(watch.state) && !pending(calendar.state) && !pending(movers.state)
  const parts = ready ? mineParts({ signals: briefSignals(watch), events: briefEvents(calendar), movers: briefMovers(movers) }, today) : null
  // 크게 움직인 내 종목(±5%) — 티커·시장까지 든 행(뉴스 링크·종목 링크용). 이름·등락만 주는 briefMovers 와 같은 문턱(MOVE_MIN)
  const md = movers.data
  const big = movers.state === 'ok' && md && Array.isArray(md.surges) && Array.isArray(md.drops)
    ? [...md.surges, ...md.drops]
        .filter((m): m is { ticker: string; name: string; market?: unknown; changePct: number; held: true } => m?.held === true && typeof m.ticker === 'string' && typeof m.name === 'string' && isNum(m.changePct) && Math.abs(m.changePct) >= MOVE_MIN)
        .map(m => ({ ticker: m.ticker, name: m.name, market: typeof m.market === 'string' ? m.market : 'US', changePct: m.changePct }))
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    : []
  // 뉴스는 개별 주식만 모은다(ETF·코인은 찾아보지 않는다) — 그런 종목이 있을 때만 부른다
  const wantNews = big.some(m => getAssetType(m.ticker, m.name, m.market) === 'STOCK')
  const news = useJson<{ catalysts?: CatalystRow[] }>('/api/news-catalyst', { enabled: wantNews })
  const linkFor = (ticker: string): NewsLink | null => {
    if (news.state !== 'ok' || !Array.isArray(news.data?.catalysts)) return null
    const c = news.data.catalysts.find(x => typeof x?.ticker === 'string' && x.ticker.toUpperCase() === ticker.toUpperCase())
    const l = Array.isArray(c?.links) ? (c.links as { title?: unknown; url?: unknown }[]).find(x => typeof x?.title === 'string' && x.title.trim()) : undefined
    return l ? { title: (l.title as string).trim(), url: typeof l.url === 'string' && /^https?:\/\//.test(l.url) ? l.url : null } : null
  }
  const failed = [watch, calendar, movers].filter(s => s.state === 'failed')
  return (
    <section ref={sectionRef} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="오늘 내 종목 소식" />
      {!parts ? <span style={noteStyle()}>내 종목 소식을 불러오는 중…</span> : (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>매매 신호</span>
            <span style={{ fontSize: FS.body, color: toneColor(parts.signal.tone) }}>{parts.signal.text}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>실적 발표</span>
            <span style={{ fontSize: FS.body, color: toneColor(parts.earnings.tone) }}>{parts.earnings.text}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>크게 움직인 종목(하루 ±{MOVE_MIN}% 넘게)</span>
            {big.length === 0
              ? <span style={{ fontSize: FS.body, color: toneColor(parts.movers[0]?.[0]?.tone) }}>{parts.movers[0]?.map(p => p.text).join('') ?? '—'}</span>
              : big.map(m => {
                const stock = getAssetType(m.ticker, m.name, m.market) === 'STOCK'
                const link = stock ? linkFor(m.ticker) : null
                const href = `/s/stock/${encodeURIComponent(m.ticker)}?m=${encodeURIComponent(m.market)}&n=${encodeURIComponent(m.name)}`
                return (
                  <div key={m.ticker} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <Link href={href} style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, minHeight: 44, fontSize: FS.body, color: TK.slate100, textDecoration: 'none', minWidth: 0 }}>
                      <span style={ellipsis}>{m.name}</span>
                      <span style={{ fontWeight: 700, color: upDown(m.changePct), whiteSpace: 'nowrap' }}>{pct(m.changePct)}</span>
                    </Link>
                    {/* 뉴스 — 개별 주식만: 제목 있으면 기사 링크(주소 없으면 글자만), 불러오는 중, 못 가져옴, 없음 */}
                    {stock && (news.state === 'loading' || news.state === 'idle'
                      ? <span style={noteStyle()}>뉴스 제목 찾는 중…</span>
                      : news.state !== 'ok' ? <span style={noteStyle(TK.amber400)}>뉴스 제목을 못 가져왔어요.</span>
                      : link
                      ? link.url
                        ? <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.slate300, textDecoration: 'none', overflowWrap: 'anywhere' }}>{link.title}<span aria-hidden style={{ color: TK.sub, marginLeft: SP.xs, flexShrink: 0 }}>›</span></a>
                        : <span style={{ fontSize: FS.tiny, color: TK.slate300, overflowWrap: 'anywhere' }}>{link.title}</span>
                      : <span style={noteStyle()}>관련 뉴스 제목을 못 찾았어요.</span>)}
                  </div>
                )
              })}
            {/* 일부 종목 확인 실패 등 두 번째 묶음(경고) */}
            {parts.movers.slice(1).map((g, i) => <span key={i} style={noteStyle(TK.amber400)}>{g.map(p => p.text).join('')}</span>)}
          </div>
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap', paddingTop: SP.xs, borderTop: `1px solid ${TK.border}` }}>
        {failed.length > 0
          ? <button type="button" onClick={() => failed.forEach(s => s.reload())} aria-label="내 종목 소식에서 못 가져온 것 다시 불러오기" style={retryBtn}>못 가져온 것 다시</button>
          : <span />}
        <Link href="/s/brief" style={moreLink}><span style={ellipsis}>오늘의 매매 브리핑 전체 ›</span></Link>
      </div>
    </section>
  )
}

// ── 4. 수업 자료(투자 아카데미 4) — 5단계-5: 간편 경로로(분석 화면과 같은 원본 components/lessons) ──
const ACADEMY = [
  { href: '/s/learn/academy', title: '투자 아카데미', sub: '린치·버핏 기초 수업' },
  { href: '/s/learn/strategy', title: '최일 전략', sub: '코어·위성 비율 원칙' },
  { href: '/s/weekly', title: '주간 리포트', sub: '이번 주 내 포트폴리오' },
  { href: '/s/lounge', title: '스쿨 라운지', sub: '질문하고 이야기하기' },
]

// ── 5. 테마(부동산·코인) — 5단계-3: 간편 화면 안의 부동산·코인 입구(사용자 결정: 둘 다 중요한 자산, 배우기에 둔다)
const THEMES = [
  { href: '/s/realestate', title: '부동산', sub: '아파트 단지 리서치 — 실거래로 찾기' },
  { href: '/s/coin', title: '코인', sub: '대표 4종 시세 · 규제 · ETF 자금' },
]

const sectionTitle = { margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 } as const

export default function StudentLearn() {
  const today = useKstToday()   // 마운트 뒤에만 정해진다(렌더 중 날짜 금지 — 서버 UTC·브라우저 KST 가 다른 날을 본다)
  const pf = useMyPortfolio()
  const [briefRef, briefSeen] = useInView<HTMLElement>()
  // 일정·등락 원천은 소식 카드가 화면에 들어올 때 부른다('오늘 알려드려요'는 이제 이 원천을 안 쓴다)
  const calendar = useJson<CalendarResp>('/api/event-calendar', { enabled: briefSeen })
  const movers = useJson<MoversResp>('/api/day-movers', { enabled: briefSeen })
  const tip = useTodayTip({ today, pf })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      {/* 폰이 기본, 769px↑ 만 덮어쓴다 — 기본값 + min-width 하나라 두 조건이 정확한 여집합이다 */}
      <style>{`
        .sl-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px; align-items: start }
        .sl-academy { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${SP.sm}px }
        .sl-themes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${SP.sm}px }
        @media (min-width: 769px) {
          .sl-two { grid-template-columns: repeat(2, minmax(0, 1fr)) }
          .sl-academy { grid-template-columns: repeat(4, minmax(0, 1fr)) }
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

      <NewsCard sectionRef={briefRef} seen={briefSeen} calendar={calendar} movers={movers} today={today} />

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

      <section aria-labelledby="learn-themes" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 id="learn-themes" style={sectionTitle}>더 알아보기</h2>
        {/* 투자학교 저울 — '더 알아보기' 빈자리의 주인공(docs/student-mode/scale-plan.md) · 5줄 × 칩 요약, 누르면 /s/scale */}
        <ScaleSummary />
        <nav aria-label="부동산·코인" className="sl-themes">
          {THEMES.map(a => (
            <Link key={a.href} href={a.href} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: SP.xs, minHeight: 72, padding: SP.md, borderRadius: RAD.md, background: TK.card, border: `1px solid ${TK.border}`, textDecoration: 'none', minWidth: 0 }}>
              <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, wordBreak: 'keep-all' }}>{a.title}</span>
              <span style={{ fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{a.sub}</span>
            </Link>
          ))}
        </nav>
      </section>

      <InstallCard />

      {/* 내 계정 — 폰에는 왼쪽 메뉴가 없어 여기가 나가는 길이다 */}
      <section aria-labelledby="learn-account" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 id="learn-account" style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>내 계정</h2>
        <div style={{ display: 'flex', gap: SP.sm, flexWrap: 'wrap' }}>
          {/* 선택을 쿠키에 남긴다 — 다음 로그인·앱 아이콘(/start)도 분석 화면으로 연다 */}
          <button type="button" onClick={() => { setViewMode('full'); window.location.href = '/dashboard' }} style={{ ...retryBtn, fontSize: FS.body }}>분석 화면으로 바꾸기</button>
          <LogoutButton style={{ ...retryBtn, fontSize: FS.body }} />
        </div>
      </section>
    </div>
  )
}
