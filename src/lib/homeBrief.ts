// 학생 홈 '오늘의 한눈 시황' 3줄(시장·내 종목·다가오는 일정)을 규칙으로 만드는 순수 함수 — 모름(null)은 0 이 아니라 '못 가져옴'
import { pct, won } from '@/lib/studentFormat'

export type Tone = 'up' | 'down' | 'flat' | 'muted' | 'warn'
export interface Part { text: string; tone?: Tone }
/** 한 줄 = 조각들. 구분자(' · ')·머리말('내 종목: ')도 조각으로 들어 있다 — 화면은 text 를 순서대로 이어 붙이고 tone 만 색으로 바꾼다 */
export interface Line { parts: Part[] }

export interface HomeBriefInput {
  indices: { id: string; changePct: number }[] | null
  usdKrw: number | null
  signals: { asOf: string | null; count: number } | null
  events: { type: string; dDay: number; date: string; name: string; ticker: string }[] | null
  movers: { held: { name: string; changePct: number }[]; failed: number } | null
  fomcDates: string[] | null   // YYYY-MM-DD, 순서 무관
}

const SEP: Part = { text: ' · ', tone: 'muted' }
const MOVE_MIN = 5          // day-movers 임계와 같은 5%
const EARN_SOON_DAYS = 7    // 2줄: 7일 안 실적
const UPCOMING_DAYS = 30    // 3줄: 30일 안 실적(홈 '주요 일정' 카드와 같은 창)

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
/** 등락 색 — studentFormat.pct 의 보합(±0.05% 안) 경계와 같다 */
const toneOf = (n: number): Tone => Math.abs(n) < 0.05 ? 'flat' : n > 0 ? 'up' : 'down'
const joinParts = (groups: Part[][]): Part[] => groups.flatMap((g, i) => i === 0 ? g : [SEP, ...g])

/** 'YYYY-MM-DD' 에 days 를 더한 날짜(달력 산술만 — 시계 안 봄) */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
/** ISO 시각 → KST 날짜. 못 읽으면 null */
function kstDate(iso: string): string | null {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t + 9 * 3600_000).toISOString().slice(0, 10) : null
}
/** 'YYYY-MM-DD' → 'M/D' */
const md = (ymd: string) => { const [, m, d] = ymd.split('-').map(Number); return `${m}/${d}` }

function marketLine(input: HomeBriefInput): Line {
  const groups: Part[][] = []
  if (input.indices == null) {
    groups.push([{ text: '지수 못 가져옴', tone: 'muted' }])
  } else {
    for (const [id, label] of [['kospi', '코스피'], ['kosdaq', '코스닥']] as const) {
      const v = input.indices.find(x => x.id === id)?.changePct
      groups.push(isNum(v) ? [{ text: `${label} ${pct(v)}`, tone: toneOf(v) }] : [{ text: `${label} 못 가져옴`, tone: 'muted' }])
    }
  }
  groups.push(isNum(input.usdKrw) && input.usdKrw > 0
    ? [{ text: `원·달러 ${won(input.usdKrw)}` }]
    : [{ text: '원·달러 못 가져옴', tone: 'muted' }])
  return { parts: joinParts(groups) }
}

function signalPart(s: HomeBriefInput['signals'], today: string): Part {
  const unknown: Part = { text: '신호 못 가져옴', tone: 'muted' }
  if (s == null || s.asOf == null || !isNum(s.count)) return unknown
  const d = kstDate(s.asOf)
  if (d == null || d > today) return unknown   // 미래 날짜는 시계가 어긋난 것 — 오늘 것이라 단정하지 않는다
  if (d === today) return { text: `오늘 신호 ${s.count}건` }
  if (d === addDays(today, -1)) return { text: `어제 신호 ${s.count}건` }
  return { text: '신호 기록이 오래됐어요', tone: 'warn' }
}

/** 실적 이벤트 중 dDay 가 [0, maxDay] 안인 것 — 같은 종목은 한 번(가장 가까운 것) */
function earningsWithin(events: NonNullable<HomeBriefInput['events']>, maxDay: number) {
  const byTicker = new Map<string, NonNullable<HomeBriefInput['events']>[number]>()
  for (const e of events) {
    if (e.type !== 'earnings' || !isNum(e.dDay) || e.dDay < 0 || e.dDay > maxDay) continue
    const prev = byTicker.get(e.ticker)
    if (!prev || e.dDay < prev.dDay) byTicker.set(e.ticker, e)
  }
  return Array.from(byTicker.values()).sort((a, b) => a.dDay - b.dDay)
}

function earningsPart(events: HomeBriefInput['events']): Part {
  if (events == null) return { text: '실적 일정 못 가져옴', tone: 'muted' }
  const n = earningsWithin(events, EARN_SOON_DAYS).length
  return { text: n > 0 ? `실적 발표 7일 안 ${n}건` : '7일 안 실적 발표 없음' }
}

function moverParts(m: HomeBriefInput['movers']): Part[] {
  if (m == null) return [{ text: '움직임 못 가져옴', tone: 'muted' }]
  const big = m.held
    .filter(h => isNum(h.changePct) && Math.abs(h.changePct) >= MOVE_MIN)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  const parts: Part[] = []
  if (big.length === 0) {
    parts.push({ text: `${MOVE_MIN}% 넘게 움직인 종목 없음` })
  } else {
    big.slice(0, 2).forEach((h, i) => {
      if (i > 0) parts.push({ text: ', ' })
      parts.push({ text: `${h.name} ${pct(h.changePct)}`, tone: toneOf(h.changePct) })
    })
    if (big.length > 2) parts.push({ text: ` 외 ${big.length - 2}` })
  }
  if (isNum(m.failed) && m.failed > 0) parts.push({ text: ' (일부 확인 못 함)', tone: 'warn' })
  return parts
}

function mineLine(input: HomeBriefInput, today: string): Line {
  return { parts: [{ text: '내 종목: ' }, ...joinParts([[signalPart(input.signals, today)], [earningsPart(input.events)], moverParts(input.movers)])] }
}

function upcomingLine(input: HomeBriefInput, today: string): Line {
  const groups: Part[][] = []
  // FOMC — 오늘 포함 이후 첫 회의. 회의 간격(6~7주)이 30일보다 길어 창을 두지 않는다
  if (input.fomcDates == null) {
    groups.push([{ text: 'FOMC 일정 못 가져옴', tone: 'muted' }])
  } else {
    const next = input.fomcDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).sort()[0]
    if (next) groups.push([{ text: `${md(next)} FOMC 금리 결정` }])
  }
  // 내 종목 실적 — 30일 안 가장 가까운 1건(7일 넘어도 여기엔 나온다)
  if (input.events == null) {
    groups.push([{ text: '일정 못 가져옴', tone: 'muted' }])
  } else {
    const e = earningsWithin(input.events, UPCOMING_DAYS)[0]
    if (e) groups.push([{ text: `${md(e.date)} ${e.name} 실적` }])
  }
  if (groups.length === 0) groups.push([{ text: `${UPCOMING_DAYS}일 안에 잡힌 일정이 없어요` }])
  return { parts: [{ text: '다가오는 일정: ' }, ...joinParts(groups)] }
}

/** 홈 한눈 시황 3줄. todayKst = 'YYYY-MM-DD'(호출부가 마운트 후 KST 로 계산해 넘긴다 — 여기선 시계를 안 본다) */
export function buildHomeBrief(input: HomeBriefInput, todayKst: string): { market: Line; mine: Line; upcoming: Line } {
  return { market: marketLine(input), mine: mineLine(input, todayKst), upcoming: upcomingLine(input, todayKst) }
}

/** 한 줄을 문자열로(검증·접근성 라벨용) */
export const lineText = (l: Line) => l.parts.map(p => p.text).join('')
