'use client'
// 학생 홈 카드들이 함께 쓰는 모양 — 카드 틀·제목 줄·상태 문구·다시 버튼·한눈 시황 말투 색·KST 오늘
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { addDays, type Tone, type HomeBriefInput } from '@/lib/homeBrief'
import { MACRO_RELEASES } from '@/lib/macroReleases'
import type { JsonResult } from '@/app/components/student/useJson'

/** 내 자산 화면(/s/assets)과 같은 카드 틀 */
export const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg, minWidth: 0 } as const

/** 한눈 시황 조각 색 — 등락은 studentFormat.upDown 과 같은 한국식(오름 빨강·내림 파랑·보합 회색) */
export const toneColor = (t?: Tone): string =>
  t === 'up' ? TK.red400 : t === 'down' ? TK.blue400 : t === 'flat' || t === 'muted' ? TK.sub : t === 'warn' ? TK.amber400 : TK.slate200

export const noteStyle = (color: string = TK.sub) => ({ fontSize: FS.tiny, color })

/** 카드 제목 줄 — 오른쪽에 '더 보기 ›' 같은 링크(44px) */
export function CardHead({ title, href, linkText, extra }: { title: string; href?: string; linkText?: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, minHeight: 44 }}>
      <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, minWidth: 0 }}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, flexShrink: 0 }}>
        {extra}
        {href && linkText && (
          <Link href={href} style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: `0 ${SP.xs}px`, fontSize: FS.tiny, color: TK.sub, textDecoration: 'none', whiteSpace: 'nowrap' }}>{linkText}</Link>
        )}
      </div>
    </div>
  )
}

/** 못 가져왔을 때 — 문구 + '다시' 버튼 */
/** retryLabel = 화면 낭독기가 읽을 버튼 이름(어느 카드를 다시 부르는지 — '다시'만으론 모른다) */
export function FailRow({ text, onRetry, retryLabel }: { text: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
      <span style={noteStyle(TK.amber400)}>{text}</span>
      {onRetry && <button type="button" onClick={onRetry} aria-label={retryLabel} style={retryBtn}>다시</button>}
    </div>
  )
}

export const retryBtn = { height: 44, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer', flexShrink: 0 } as const

// 홈 페이지가 한 번 불러 여러 카드에 나눠 주는 응답(같은 원천을 두 번 부르지 않게) — 쓰는 필드만 적는다
export interface IndexRow { id: string; value: number; changePct: number; change?: number; chartData?: unknown }   // chartData = 장중 점(지수 카드 미니 선) — 모양은 sparkSeries 가 검사
export interface CalEventRow { type: string; date: string; ticker: string; name: string }   // dDay 는 캐시 시점 기준이라 안 쓴다 — 날짜로 거른다
export interface CalendarResp { events?: CalEventRow[] }
export interface FxResp { rate?: unknown; source?: unknown }
export interface MacroResp { events?: unknown; failed?: unknown; unscheduled?: unknown }
export interface MacroRow { kind: string; label: string; kstDate: string; kstTime: string }

export interface MoverRow { ticker?: unknown; name?: unknown; market?: unknown; changePct?: unknown; held?: unknown }
export interface MoversResp { surges?: MoverRow[]; drops?: MoverRow[]; failed?: unknown; checked?: unknown; heldChecked?: unknown; heldFailed?: unknown; asOf?: unknown }
export interface WatchResp { asOf?: unknown; sigs?: unknown }

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

// 한눈 시황 '내 종목' 줄 입력 — 홈(MarketBrief)과 배우기 화면이 같은 검사로 만든다.
//  실패·로그인 필요·모양이 틀림 = null(못 가져옴) — 0 으로 채우지 않는다
export function briefSignals(watch: JsonResult<WatchResp>): HomeBriefInput['signals'] {
  return watch.state === 'ok' && Array.isArray(watch.data?.sigs)
    ? { asOf: typeof watch.data?.asOf === 'string' ? watch.data.asOf : null, count: watch.data.sigs.length }
    : null
}
export function briefEvents(calendar: JsonResult<CalendarResp>): HomeBriefInput['events'] {
  return calendar.state === 'ok' && Array.isArray(calendar.data?.events)
    ? calendar.data.events.filter(e => e && typeof e.date === 'string' && typeof e.type === 'string' && typeof e.name === 'string' && typeof e.ticker === 'string').map(e => ({ type: e.type, date: e.date, name: e.name, ticker: e.ticker }))
    : null
}
/** day-movers 는 보유하지 않아도 비트코인을 늘 넣는다 — 내 종목(held=true)만, 개수도 내 종목만 센 heldChecked·heldFailed 로.
 *  그 두 필드가 없으면(옛 응답) 전체 checked·failed 로 대신하지 않고 '못 가져옴' — 비트코인 실패가 섞인 수라 틀린 말이 된다 */
export function briefMovers(movers: JsonResult<MoversResp>): HomeBriefInput['movers'] {
  const md = movers.data
  const mChecked = md?.heldChecked
  const mFailed = md?.heldFailed
  return movers.state === 'ok' && md && Array.isArray(md.surges) && Array.isArray(md.drops) && isFiniteNum(mFailed) && isFiniteNum(mChecked)
    ? {
        held: [...md.surges, ...md.drops]
          .filter((m): m is { name: string; changePct: number; held: true } => m?.held === true && typeof m.name === 'string' && isFiniteNum(m.changePct))
          .map(m => ({ name: m.name, changePct: m.changePct })),
        checked: mChecked, failed: mFailed,
      }
    : null
}

const MACRO_YMD = /^\d{4}-\d{2}-\d{2}$/
/** '21:30' → '밤 9:30' — 저녁(13~23시)이 아니거나 못 읽으면 null(시각을 지어내지 않는다) */
export function macroNightText(hhmm: string): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  const h = m ? Number(m[1]) : NaN
  return m && h >= 13 && h <= 23 ? `밤 ${h - 12}:${m[2]}` : null
}

/** /api/macro-releases → 발표 행(한눈 시황·주요 일정이 같은 검사를 거친 행을 쓴다 — 날짜 형식·밤 시각을 못 읽는 행은 버린다).
 *  요청 실패·모양 틀림·세 지표 전부 실패 = null(못 가져옴 — '일정 없음'이 아니다) */
export function macroRows(r: JsonResult<MacroResp>): MacroRow[] | null {
  if (r.state !== 'ok' || !Array.isArray(r.data?.events) || !Array.isArray(r.data?.failed)) return null
  if (r.data.failed.length >= MACRO_RELEASES.length) return null
  return (r.data.events as unknown[]).filter((e): e is MacroRow => {
    const x = e as Partial<MacroRow> | null
    return !!x && typeof x.kind === 'string' && typeof x.label === 'string'
      && typeof x.kstDate === 'string' && MACRO_YMD.test(x.kstDate)
      && typeof x.kstTime === 'string' && macroNightText(x.kstTime) != null
  })
}

/** 잘 읽었지만 FRED 에 다음 발표일이 아직 없는 지표 이름(실패 아님 — 연말에 다음 해 일정이 늦게 올라온다) */
export function macroUnscheduledLabels(r: JsonResult<MacroResp>): string[] {
  if (r.state !== 'ok' || !Array.isArray(r.data?.unscheduled)) return []
  const u = r.data.unscheduled as unknown[]
  return MACRO_RELEASES.filter(m => u.includes(m.kind)).map(m => m.label)
}

/** 못 가져온 지표 이름 — 요청 자체가 실패했거나 모양이 틀리면 전부. 불러오는 중·로그인 필요면 빈 목록 */
export function macroFailedLabels(r: JsonResult<MacroResp>): string[] {
  const all = MACRO_RELEASES.map(m => m.label)
  if (r.state === 'failed') return all
  if (r.state !== 'ok') return []
  if (!Array.isArray(r.data?.events) || !Array.isArray(r.data?.failed)) return all
  const failed = r.data.failed as unknown[]
  return MACRO_RELEASES.filter(m => failed.includes(m.kind)).map(m => m.label)
}

/** 오늘(KST 'YYYY-MM-DD') — 마운트 뒤에만 정하고(렌더 중 new Date() 는 서버 UTC·브라우저 KST 가 다른 날을 봐 하이드레이션이 깨진다),
 *  화면을 켜 둔 채 자정을 넘기면 1분 안에 다음 날로 바뀐다. 마운트 전엔 null */
export function useKstToday(): string | null {
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    const kst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    setToday(kst())
    const id = setInterval(() => setToday(kst()), 60_000)   // 같은 값이면 React 가 다시 그리지 않는다
    return () => clearInterval(id)
  }, [])
  return today
}

// ── 일정 항목 — 홈 '주요 일정' 카드와 /s/calendar 가 같은 함수로 만든다(FOMC 새벽 · 미국 지표 밤 · 내 종목 실적/배당) ──
export const CAL_TYPE_KO: Record<string, string> = { earnings: '실적 발표', exDiv: '배당락', payDiv: '배당 지급' }
export interface CalItem { key: string; date: string; label: string; mine: boolean; kind: 'fomc' | 'macro' | 'mine'; ticker?: string; name?: string }
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
/** today 부터 windowDays 안 일정을 날짜순으로. macro·events 는 못 가져왔으면 빈 배열로 넘긴다(그 사실은 호출부가 따로 말한다).
 *  FOMC 는 창으로 자르지 않는다 — 한눈 시황 줄이 '다음 FOMC'를 늘 말하므로(요약이 상세에 없으면 안 된다) 호출부가 넘긴 회차를 그대로 싣는다 */
export function buildCalendarItems(input: { today: string; windowDays: number; fomcKst: string[]; macro: MacroRow[]; events: CalEventRow[] }): CalItem[] {
  const { today, windowDays } = input
  const last = addDays(today, windowDays)
  const fomc: CalItem[] = input.fomcKst.filter(d => d >= today).map(d => ({ key: `fomc:${d}`, date: d, label: '새벽 FOMC 금리 발표', mine: false, kind: 'fomc' }))
  const macro: CalItem[] = input.macro.flatMap(m => {
    const t = macroNightText(m.kstTime)
    return t && m.kstDate >= today && m.kstDate <= last ? [{ key: `macro:${m.kind}:${m.kstDate}`, date: m.kstDate, label: `${t} · ${m.label} 발표`, mine: false, kind: 'macro' as const }] : []
  })
  // 같은 종목·종류·날짜는 한 번
  const mine = Array.from(new Map(input.events
    .filter(e => e && CAL_TYPE_KO[e.type] && typeof e.name === 'string' && typeof e.date === 'string' && YMD_RE.test(e.date) && e.date >= today && e.date <= last)
    .map(e => [`${e.type}:${e.ticker}:${e.date}`, { key: `${e.type}:${e.ticker}:${e.date}`, date: e.date, label: `${e.name} ${CAL_TYPE_KO[e.type]}`, mine: true, kind: 'mine' as const, ticker: e.ticker, name: e.name }] as [string, CalItem])).values())
  return [...fomc, ...macro, ...mine].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}
/** 'YYYY-MM-DD' → '오늘' 또는 'M/D(요일)' — 문자열 산술만(시계 안 봄) */
export function calDateText(ymd: string, today: string): string {
  if (ymd === today) return '오늘'
  const [y, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}(${['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`
}
