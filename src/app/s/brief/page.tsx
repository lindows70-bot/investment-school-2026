'use client'
// 학생 '오늘의 브리핑' — 홈 '오늘의 한눈 시황' 3줄(시장·내 종목·다가오는 일정)을 각각 펼친다. 한 줄 문구는 홈과 같은 buildHomeBrief(두 화면이 다른 말을 하지 않게)
//   5단계: 홈·배우기의 '오늘의 매매 브리핑 전체'가 여기로 온다(분석 화면 대신 간편 안에서). 새 계산 없음 — 전부 이미 받는 응답
//   ①시장: 코스피·코스닥·S&P 500·원·달러 ②내 종목: 오늘 신호 목록 · 7일 안 실적 · 크게 움직인 종목 ③일정: 30일 안 5개(→ /s/calendar)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { buildHomeBrief, MOVE_MIN, type HomeBriefInput, type Line } from '@/lib/homeBrief'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import { acceptFx } from '@/lib/fxAccept'
import { points, pct, upDown, fxWon } from '@/lib/studentFormat'
import { useJson, type JsonState } from '@/app/components/student/useJson'
import {
  card, toneColor, noteStyle, retryBtn, useKstToday, macroRows, macroFailedLabels, briefSignals, briefEvents, briefMovers,
  buildCalendarItems, calDateText, CAL_TYPE_KO, type IndexRow, type CalendarResp, type FxResp, type MacroResp, type MoversResp, type WatchResp,
} from '@/app/components/student/home/homeUi'
import { fomcKstDates, addDays } from '@/lib/homeBrief'

interface Sig { ticker?: unknown; name?: unknown; market?: unknown; icon?: unknown; label?: unknown; detail?: unknown }
const FOMC_DATES = FOMC_SCHEDULE.map(m => m.date)
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const pending = (s: JsonState) => s === 'loading' || s === 'idle'

const back = <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 홈</Link>
const h2 = { margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 } as const
const rowStyle = { display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 48, borderTop: `1px solid ${TK.border}`, textDecoration: 'none', minWidth: 0 } as const

function LineText({ line, loadingText }: { line: Line | null; loadingText: string }) {
  if (!line) return <p style={{ margin: 0, ...noteStyle() }}>{loadingText}</p>
  return <p style={{ margin: 0, fontSize: FS.body, lineHeight: 1.6, color: TK.slate200, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{line.parts.map((p, i) => <span key={i} style={{ color: toneColor(p.tone) }}>{p.text}</span>)}</p>
}

export default function StudentBrief() {
  const today = useKstToday()
  const indices = useJson<IndexRow[]>('/api/market-indices')
  const fx = useJson<FxResp>('/api/exchange-rate')
  const watch = useJson<WatchResp>('/api/timing-watch')
  const movers = useJson<MoversResp>('/api/day-movers')
  const calendar = useJson<CalendarResp>('/api/event-calendar')
  const macro = useJson<MacroResp>('/api/macro-releases')

  const indicesIn: HomeBriefInput['indices'] = indices.state === 'ok' && Array.isArray(indices.data)
    ? indices.data.filter(x => x && typeof x.id === 'string' && isNum(x.changePct)).map(x => ({ id: x.id, changePct: x.changePct })) : null
  const usdKrw = fx.state === 'ok' ? acceptFx(fx.data) : null
  const macroIn: HomeBriefInput['macro'] = macroFailedLabels(macro).length > 0 ? null : macroRows(macro)
  const brief = today ? buildHomeBrief({ indices: indicesIn, usdKrw, signals: briefSignals(watch), events: briefEvents(calendar), movers: briefMovers(movers), fomcDates: FOMC_DATES, macro: macroIn }, today) : null
  const marketReady = brief && !pending(indices.state) && !pending(fx.state)
  const mineReady = brief && !pending(watch.state) && !pending(calendar.state) && !pending(movers.state)
  const upcomingReady = brief && !pending(calendar.state) && !pending(macro.state)

  // ① 시장 — 지수 3개 + 환율(한눈 시황 줄과 같은 원천)
  const idx = (id: string) => indices.state === 'ok' && Array.isArray(indices.data) ? indices.data.find(x => x?.id === id) : undefined
  const marketRows: { label: string; row?: IndexRow }[] = [{ label: '코스피', row: idx('kospi') }, { label: '코스닥', row: idx('kosdaq') }, { label: 'S&P 500', row: idx('sp500') }]

  // ② 내 종목 — 신호 목록 · 7일 안 실적 · 크게 움직인 종목
  const sigs: Sig[] = watch.state === 'ok' && Array.isArray(watch.data?.sigs) ? (watch.data.sigs as Sig[]) : []
  const earnings = today && calendar.state === 'ok' && Array.isArray(calendar.data?.events)
    ? buildCalendarItems({ today, windowDays: 7, fomcKst: [], macro: [], events: calendar.data.events! }).filter(it => it.kind === 'mine' && it.label.endsWith(CAL_TYPE_KO.earnings)) : []
  const md = movers.data
  const big = movers.state === 'ok' && md && Array.isArray(md.surges) && Array.isArray(md.drops)
    ? [...md.surges, ...md.drops].filter((m): m is { ticker: string; name: string; market?: unknown; changePct: number; held: true } => m?.held === true && typeof m.ticker === 'string' && typeof m.name === 'string' && isNum(m.changePct) && Math.abs(m.changePct) >= MOVE_MIN)
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    : []

  // ③ 다가오는 일정 — 30일 안 전부 + 다음 FOMC(한 줄이 말한 것은 목록에도 있어야 한다 — 자르지 않는다)
  const upcoming = today ? buildCalendarItems({ today, windowDays: 30, fomcKst: fomcKstDates(FOMC_DATES, today).slice(0, 1), macro: macroRows(macro) ?? [], events: calendar.state === 'ok' && Array.isArray(calendar.data?.events) ? calendar.data.events! : [] }) : []

  const failed = [indices, fx, watch, calendar, movers, macro].filter(s => s.state === 'failed')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 720 }}>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100 }}>오늘의 브리핑</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>홈 ‘한눈 시황’ 세 줄을 풀어 썼어요 — 시장 · 내 종목 · 다가오는 일정. 사라·팔라는 뜻은 없어요.</p>
      </header>

      <section aria-label="시장" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 style={h2}>시장</h2>
        <LineText line={marketReady ? brief!.market : null} loadingText="시장 지수를 불러오는 중…" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: SP.sm }}>
          {marketRows.map(m => (
            <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: FS.micro, color: TK.sub }}>{m.label}</span>
              {m.row && isNum(m.row.value) && isNum(m.row.changePct)
                ? <><span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{points(m.row.value)}</span><span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(m.row.changePct) }}>{pct(m.row.changePct)}</span></>
                : <span style={noteStyle(pending(indices.state) ? TK.sub : TK.amber400)}>{pending(indices.state) ? '…' : '못 가져옴'}</span>}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: FS.micro, color: TK.sub }}>원·달러</span>
            {usdKrw != null ? <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>{fxWon(usdKrw)}</span> : <span style={noteStyle(pending(fx.state) ? TK.sub : TK.amber400)}>{pending(fx.state) ? '…' : '못 가져옴'}</span>}
          </div>
        </div>
        <Link href="/s/market" style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.blue400, textDecoration: 'none' }}>시장 탭에서 더 보기 ›</Link>
      </section>

      <section aria-label="내 종목" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 style={h2}>내 종목</h2>
        <LineText line={mineReady ? brief!.mine : null} loadingText="내 종목 소식을 불러오는 중…" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <span style={{ fontSize: FS.micro, color: TK.sub }}>매매 신호</span>
          {pending(watch.state) ? <span style={noteStyle()}>…</span>
            : watch.state !== 'ok' ? <span style={noteStyle(TK.amber400)}>신호를 못 가져왔어요.</span>
            : sigs.length === 0 ? <span style={noteStyle()}>오늘 내 종목에 뜬 신호가 없어요.</span>
            : sigs.map((s, i) => {
              const ticker = typeof s.ticker === 'string' ? s.ticker : ''
              const name = typeof s.name === 'string' ? s.name : ticker
              const market = typeof s.market === 'string' ? s.market : 'US'
              return (
                <Link key={`${ticker}${i}`} href={`/s/stock/${encodeURIComponent(ticker)}?m=${encodeURIComponent(market)}&n=${encodeURIComponent(name)}`} style={rowStyle}>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                    <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof s.icon === 'string' ? `${s.icon} ` : ''}{name} <span style={{ fontWeight: 500, color: TK.slate300 }}>{typeof s.label === 'string' ? s.label : ''}</span></span>
                    {typeof s.detail === 'string' && s.detail && <span style={{ fontSize: FS.tiny, color: TK.sub, overflowWrap: 'anywhere' }}>{s.detail}</span>}
                  </span>
                  <span aria-hidden style={{ color: TK.sub, flexShrink: 0 }}>›</span>
                </Link>
              )
            })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <span style={{ fontSize: FS.micro, color: TK.sub }}>7일 안 실적 발표</span>
          {pending(calendar.state) ? <span style={noteStyle()}>…</span>
            : calendar.state !== 'ok' ? <span style={noteStyle(TK.amber400)}>실적 일정을 못 가져왔어요.</span>
            : earnings.length === 0 ? <span style={noteStyle()}>7일 안 실적 발표가 없어요.</span>
            : earnings.map(it => (
              <Link key={it.key} href={`/s/stock/${encodeURIComponent(it.ticker ?? '')}?n=${encodeURIComponent(it.name ?? '')}`} style={rowStyle}>
                <span style={{ width: 72, flexShrink: 0, fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{today ? calDateText(it.date, today) : it.date}</span>
                <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              </Link>
            ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <span style={{ fontSize: FS.micro, color: TK.sub }}>크게 움직인 종목(하루 ±{MOVE_MIN}% 넘게)</span>
          {pending(movers.state) ? <span style={noteStyle()}>…</span>
            : movers.state !== 'ok' ? <span style={noteStyle(TK.amber400)}>움직임을 못 가져왔어요.</span>
            : big.length === 0 ? <span style={noteStyle()}>{MOVE_MIN}% 넘게 움직인 내 종목이 없어요.</span>
            : big.map(m => (
              <Link key={m.ticker} href={`/s/stock/${encodeURIComponent(m.ticker)}?m=${encodeURIComponent(typeof m.market === 'string' ? m.market : 'US')}&n=${encodeURIComponent(m.name)}`} style={rowStyle}>
                <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                <span style={{ flexShrink: 0, fontSize: FS.body, fontWeight: 700, color: upDown(m.changePct) }}>{pct(m.changePct)}</span>
              </Link>
            ))}
        </div>
        <Link href="/s/news" style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.blue400, textDecoration: 'none' }}>내 종목 뉴스 전체 ›</Link>
      </section>

      <section aria-label="다가오는 일정" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <h2 style={h2}>다가오는 일정</h2>
        <LineText line={upcomingReady ? brief!.upcoming : null} loadingText="다가오는 일정을 불러오는 중…" />
        {today && upcoming.map(it => (
          <div key={it.key} style={{ ...rowStyle }}>
            <span style={{ width: 72, flexShrink: 0, fontSize: FS.tiny, color: TK.sub, whiteSpace: 'nowrap' }}>{calDateText(it.date, today)}</span>
            <span style={{ flexGrow: 1, minWidth: 0, fontSize: FS.body, color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            {it.mine && <span style={{ flexShrink: 0, padding: `0 ${SP.sm}px`, borderRadius: RAD.pill, background: `${TK.teal400}24`, color: TK.blue400, fontSize: FS.micro, fontWeight: 700 }}>내 종목</span>}
          </div>
        ))}
        <Link href="/s/calendar" style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.tiny, color: TK.blue400, textDecoration: 'none' }}>30일 일정 전체 ›</Link>
      </section>

      {failed.length > 0 && <button type="button" onClick={() => failed.forEach(s => s.reload())} aria-label="브리핑에서 못 가져온 것 다시 불러오기" style={{ ...retryBtn, alignSelf: 'flex-start' }}>못 가져온 것 다시</button>}
      <span style={noteStyle()}>{today ? `${addDays(today, 0).replace(/-/g, '.')} 기준` : ''} · 지수·환율 네이버/하나은행 · 신호·등락은 앱 계산 · 예측이 아니라 지금 상태예요</span>
    </div>
  )
}
