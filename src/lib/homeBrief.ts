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
  /** 날짜(date 'YYYY-MM-DD')로 거른다 — 캐시된 dDay 는 하루 지나면 틀리므로 안 쓴다.
   *  event-calendar 의 date 는 야후 타임스탬프의 UTC 날짜다(미국 실적 = 미국 날짜, KST 아님) — 오늘(KST)과 하루 어긋날 수 있다 */
  events: { type: string; date: string; name: string; ticker: string }[] | null
  /** ⚠️ held 에는 보유 종목(held===true)만 넣는다 — day-movers 는 보유가 아니어도 BTC 를 항상 싣는다.
   *  checked·failed 에는 day-movers 의 heldChecked·heldFailed(보유 종목만 센 수)를 넣는다 — checked·failed 가 아니다.
   *  그쪽은 보유 안 한 BTC 를 포함해, 보유 전부 실패·BTC 만 성공이면 '없음 · 일부'로 거짓말하게 된다 */
  movers: { held: { name: string; changePct: number }[]; checked: number; failed: number } | null
  /** FOMC_SCHEDULE 의 성명 발표일(미국 날짜, 'YYYY-MM-DD'), 순서 무관. 한국엔 다음 날 새벽에 나온다 */
  fomcDates: string[] | null
}

const SEP: Part = { text: ' · ', tone: 'muted' }
const MOVE_MIN = 5          // day-movers 임계와 같은 5%
const EARN_SOON_DAYS = 7    // 2줄: 7일 안 실적
const UPCOMING_DAYS = 30    // 3줄: 30일 안 실적(홈 '주요 일정' 카드와 같은 창)
const YMD = /^\d{4}-\d{2}-\d{2}$/

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
/** 'YYYY-MM-DD' → 오늘이면 '오늘', 아니면 'M/D' */
const dayLabel = (ymd: string, today: string) => {
  if (ymd === today) return '오늘'
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}`
}

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

/** 실적 이벤트 중 날짜가 [오늘, 오늘+maxDay] 안인 것 — 같은 종목은 한 번(가장 이른 날), 날짜순 */
function earningsWithin(events: NonNullable<HomeBriefInput['events']>, today: string, maxDay: number) {
  const last = addDays(today, maxDay)
  const byTicker = new Map<string, NonNullable<HomeBriefInput['events']>[number]>()
  for (const e of events) {
    if (e.type !== 'earnings' || !YMD.test(e.date) || e.date < today || e.date > last) continue
    const prev = byTicker.get(e.ticker)
    if (!prev || e.date < prev.date) byTicker.set(e.ticker, e)
  }
  return Array.from(byTicker.values()).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}

function earningsPart(events: HomeBriefInput['events'], today: string): Part {
  if (events == null) return { text: '실적 일정 못 가져옴', tone: 'muted' }
  const n = earningsWithin(events, today, EARN_SOON_DAYS).length
  return { text: n > 0 ? `실적 발표 7일 안 ${n}건` : '7일 안 실적 발표 없음' }
}

/** 움직임 — 조각 묶음들. 일부 확인 실패는 마지막 종목에 붙어 보이지 않게 따로 떨어진 묶음으로 */
function moverGroups(m: HomeBriefInput['movers']): Part[][] {
  const unknown: Part[][] = [[{ text: '움직임 못 가져옴', tone: 'muted' }]]
  if (m == null) return unknown
  const failed = isNum(m.failed) ? m.failed : 0
  const checked = isNum(m.checked) ? m.checked : 0
  // 전부 실패 — '없음'이라 하면 모름을 0 으로 쓰는 것이다
  if (failed >= checked && (checked > 0 || failed > 0)) return unknown
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
    if (big.length > 2) parts.push({ text: ` 외 ${big.length - 2}종목` })
  }
  const groups = [parts]
  if (failed > 0) groups.push([{ text: '일부 종목은 확인 못 함', tone: 'warn' }])
  return groups
}

function mineLine(input: HomeBriefInput, today: string): Line {
  return { parts: [{ text: '내 종목: ' }, ...joinParts([[signalPart(input.signals, today)], [earningsPart(input.events, today)], ...moverGroups(input.movers)])] }
}

function upcomingLine(input: HomeBriefInput, today: string): Line {
  const dated: { date: string; part: Part }[] = []   // 날짜 있는 일정 — 날짜순으로 낸다
  const unknown: Part[] = []                          // 못 가져온 원천 — 날짜순 뒤에
  // FOMC — 미국 성명 발표일의 다음 날(한국 새벽 3~4시)이 한국 날짜. 그 날이 오늘 이후인 첫 회의.
  //  회의 간격(6~7주)이 30일보다 길어 창을 두지 않는다. 표(연 1회 수동)가 끝나 다음 회의가 없으면 '못 가져옴'
  //  — '일정 없음'이라 하면 표가 낡은 것을 FOMC 가 없는 것으로 말하게 된다.
  const nextFomc = input.fomcDates == null ? undefined
    : input.fomcDates.filter(d => YMD.test(d)).map(d => addDays(d, 1)).filter(d => d >= today).sort()[0]
  if (nextFomc) dated.push({ date: nextFomc, part: { text: `${dayLabel(nextFomc, today)} 새벽 FOMC 금리 발표` } })
  else unknown.push({ text: 'FOMC 일정 못 가져옴', tone: 'muted' })
  // 내 종목 실적 — 30일 안 가장 이른 1건(7일 넘어도 여기엔 나온다)
  if (input.events == null) {
    unknown.push({ text: '실적 일정 못 가져옴', tone: 'muted' })
  } else {
    const e = earningsWithin(input.events, today, UPCOMING_DAYS)[0]
    if (e) dated.push({ date: e.date, part: { text: `${dayLabel(e.date, today)} ${e.name} 실적` } })
  }
  dated.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  // FOMC 가 늘 날짜나 '못 가져옴'을 내므로 이 줄은 비지 않는다('30일 안 일정 없음' 문구가 필요 없다)
  return { parts: [{ text: '다가오는 일정: ' }, ...joinParts([...dated.map(d => [d.part]), ...unknown.map(u => [u])])] }
}

/** 홈 한눈 시황 3줄. todayKst = 'YYYY-MM-DD'(호출부가 마운트 후 KST 로 계산해 넘긴다 — 여기선 시계를 안 본다) */
export function buildHomeBrief(input: HomeBriefInput, todayKst: string): { market: Line; mine: Line; upcoming: Line } {
  return { market: marketLine(input), mine: mineLine(input, todayKst), upcoming: upcomingLine(input, todayKst) }
}

/** 한 줄을 문자열로(검증·접근성 라벨용) */
export const lineText = (l: Line) => l.parts.map(p => p.text).join('')
