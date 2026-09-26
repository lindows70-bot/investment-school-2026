// 학생 배우기 화면 '오늘 알려드려요' 한 줄을 고르는 순수 규칙 — 날짜로 ①PER ②산 뒤 대 지수 ③일정 ④크게 움직인 종목을 돌리고, 데이터가 없으면 다음 규칙
//   숫자는 전부 입력에서만 나온다(지어내지 않는다) · 명령이 아니라 사실만 말한다 · 등락 표기는 studentFormat SSOT.
import { pct } from '@/lib/studentFormat'
import { dayNum } from '@/lib/learnTipsData'

export type TipKind = 'per' | 'vsIndex' | 'event' | 'mover'
export interface Tip { kind: TipKind; title: string; body: string; source: string; ticker?: string; market?: string; tone?: 'up' | 'down' | 'flat' }
export interface TipInputs {
  per: { ticker: string; name: string; market: string; pe: number | null; perMedian: number | null; perCount: number }[] | null
  vsIndex: { ticker: string; name: string; market: string; buyDate: string; returnPct: number; indexName: string; indexReturnPct: number }[] | null
  events: { type: 'earnings' | 'exDiv' | 'payDiv'; date: string; ticker: string; name: string }[] | null
  movers: { ticker: string; name: string; changePct: number; headline: string | null }[] | null
}

/** 규칙 순서 — 오늘의 시작 규칙은 (날 수 mod 4) 번째, 매일 한 칸씩 밀린다 */
const RULES: TipKind[] = ['per', 'vsIndex', 'event', 'mover']
const YMD = /^\d{4}-\d{2}-\d{2}$/
/** 동종 기업 중앙값과 비교하려면 최소 이만큼 있어야 한다(getSectorPeers.perMedian 과 같은 기준) */
const PER_MIN_PEERS = 3
/** 지수와 '비슷해요'로 보는 폭(%p) */
const VS_INDEX_BAND = 0.5
/** 일정은 오늘부터 이 날 수 안만 */
const EVENT_WINDOW_DAYS = 30
/** 보합 경계 — studentFormat.pct·upDown 과 같다 */
const FLAT = 0.05

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n)
const md = (ymd: string) => `${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}`
const times = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const toneOf = (n: number): 'up' | 'down' | 'flat' => Math.abs(n) < FLAT ? 'flat' : n > 0 ? 'up' : 'down'

/** 마지막 글자에 받침이 있나 — 한글은 정확히, 숫자·영문은 읽는 소리로(0=영/십/백, L=엘, M=엠, N=엔, R=알). 모르면 null */
function hasBatchim(word: string): boolean | null {
  const s = word.trim().replace(/[^0-9A-Za-z가-힣]+$/, '')
  const ch = s.slice(-1)
  if (!ch) return null
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  if (/[0-9]/.test(ch)) return '013678'.includes(ch)
  if (/[A-Za-z]/.test(ch)) return 'LMNR'.includes(ch.toUpperCase())
  return null
}
const eunNeun = (w: string) => { const b = hasBatchim(w); return b == null ? '은(는)' : b ? '은' : '는' }
const waGwa = (w: string) => { const b = hasBatchim(w); return b == null ? '와(과)' : b ? '과' : '와' }

/** 같은 규칙 안에서 고를 종목 — 규칙이 시작 자리에 다시 올 때(4일마다)마다 한 칸씩 넘어간다. 입력 순서와 무관하게 티커 순으로 정렬해 고른다 */
function rotatePick<T extends { ticker: string }>(xs: T[], day: number): T {
  const sorted = xs.slice().sort((a, b) => a.ticker.localeCompare(b.ticker))
  const i = Math.floor(day / RULES.length) % sorted.length
  return sorted[(i + sorted.length) % sorted.length]
}

function perTip(inputs: TipInputs, day: number): Tip | null {
  // ETF·코인·적자 기업은 PER 이 없다(null·0 이하) → 건너뛴다
  const xs = (inputs.per ?? []).filter(x => isNum(x.pe) && x.pe > 0)
  if (!xs.length) return null
  const x = rotatePick(xs, day)
  const pe = x.pe as number
  const isKr = (x.market ?? '').toUpperCase() === 'KR'
  let body = 'PER은 주가가 1년 동안 번 이익의 몇 배인지를 뜻해요.'
  if (isKr) body += ' (직전 결산 연도 이익 기준)'
  // 한국 종목은 비교하지 않는다 — 내 PER 은 직전 결산 연도 기준인데 동종 기업 PER(야후)은 최근 4분기 기준이라 잣대가 다르다
  const compare = !isKr && isNum(x.perMedian) && x.perMedian > 0 && x.perCount >= PER_MIN_PEERS
  if (compare) {
    const m = x.perMedian as number
    const head = ` 비슷한 기업 ${x.perCount}곳의 중앙값 ${times(m)}배`
    body += times(pe) === times(m) ? `${head}${waGwa('배')} 비슷해요.`
      : pe < m ? `${head}보다 낮아서, 버는 돈에 비해 덜 비싸게 거래되고 있어요.`
      : `${head}보다 높아서, 버는 돈에 비해 비싸게 거래되고 있어요.`
  }
  return {
    kind: 'per', title: `${x.name} PER은 ${times(pe)}배예요`, body,
    source: compare ? '앱 종목 정보 · 비슷한 기업 비교' : '앱 종목 정보', ticker: x.ticker, market: x.market,
  }
}

function vsIndexTip(inputs: TipInputs, day: number, todayKst: string): Tip | null {
  const xs = (inputs.vsIndex ?? []).filter(x => isNum(x.returnPct) && isNum(x.indexReturnPct) && YMD.test(x.buyDate) && x.buyDate < todayKst && !!x.indexName)
  if (!xs.length) return null
  const x = rotatePick(xs, day)
  const diff = x.returnPct - x.indexReturnPct
  const clause = Math.abs(diff) < VS_INDEX_BAND ? `${x.indexName}${waGwa(x.indexName)} 비슷해요.`
    : `${x.indexName}보다 ${Math.abs(diff).toFixed(1)}%p ${diff > 0 ? '앞섰어요' : '뒤처졌어요'}.`
  return {
    kind: 'vsIndex',
    title: `${x.name}${eunNeun(x.name)} 산 뒤 ${pct(x.returnPct)}, 같은 기간 ${x.indexName} ${pct(x.indexReturnPct)}`,
    body: `산 날(${md(x.buyDate)})부터 오늘까지 비교했어요. ${clause}`,
    source: `내 거래 기록 · ${x.indexName} 종가`, ticker: x.ticker, market: x.market, tone: toneOf(x.returnPct),
  }
}

const EVENT_TEXT: Record<'earnings' | 'exDiv' | 'payDiv', { label: string; body: string }> = {
  earnings: { label: '실적 발표', body: '회사가 최근 성적(매출·이익)을 알리는 날이에요. 예정일이라 바뀔 수 있어요.' },
  exDiv:    { label: '배당락', body: '이날 전에 사서 이날까지 가지고 있어야 이번 배당을 받아요.' },
  payDiv:   { label: '배당 지급', body: '배당금이 들어오는 날이에요.' },
}

function eventTip(inputs: TipInputs, day: number): Tip | null {
  // 지난 일정은 빼고 오늘~30일 안에서 가장 가까운 날. 같은 날 여럿이면 그 안에서 돌린다
  const xs = (inputs.events ?? []).filter(e => e && EVENT_TEXT[e.type] && YMD.test(e.date))
    .map(e => ({ ...e, dd: dayNum(e.date) - day }))
    .filter(e => e.dd >= 0 && e.dd <= EVENT_WINDOW_DAYS)
  if (!xs.length) return null
  const nearest = Math.min(...xs.map(e => e.dd))
  const same = xs.filter(e => e.dd === nearest).map(e => ({ ...e, key: `${e.ticker}|${e.type}` }))
    .sort((a, b) => a.key.localeCompare(b.key))
  const e = same[Math.floor(day / RULES.length) % same.length]
  const t = EVENT_TEXT[e.type]
  return {
    kind: 'event', title: `${md(e.date)} ${e.name} ${t.label}`,
    body: `${t.body} ${e.dd === 0 ? '바로 오늘이에요.' : `오늘부터 ${e.dd}일 뒤예요.`}`,
    source: '종목 일정(실적·배당)', ticker: e.ticker,
  }
}

function moverTip(inputs: TipInputs, day: number): Tip | null {
  // 오늘 가장 크게 움직인 종목(절대값). 보합은 '움직인 종목'이 아니다
  const xs = (inputs.movers ?? []).filter(m => isNum(m.changePct) && Math.abs(m.changePct) >= FLAT)
  if (!xs.length) return null
  const top = Math.max(...xs.map(m => Math.abs(m.changePct)))
  const m = rotatePick(xs.filter(x => Math.abs(x.changePct) === top), day)
  const headline = typeof m.headline === 'string' && m.headline.trim() ? m.headline.trim() : null
  return {
    kind: 'mover', title: `${m.name} 오늘 ${pct(m.changePct)}`,
    body: headline ? `최근 뉴스 제목: "${headline}"` : '관련 뉴스 제목을 못 찾았어요.',
    source: '하루 등락 · 뉴스 제목(시각 미확인)', ticker: m.ticker, tone: toneOf(m.changePct),
  }
}

/**
 * 오늘의 한 줄 — 같은 날 같은 입력이면 늘 같은 결과.
 * 시작 규칙 = RULES[(날 수 mod 4)] 에서 시작해 입력이 없는 규칙은 건너뛴다. 전부 없으면 null(화면이 '오늘은 알려드릴 게 없어요'를 말한다).
 */
export function pickTip(todayKst: string, inputs: TipInputs): Tip | null {
  if (!YMD.test(todayKst)) return null
  const day = dayNum(todayKst)
  const start = ((day % RULES.length) + RULES.length) % RULES.length
  for (let i = 0; i < RULES.length; i++) {
    const kind = RULES[(start + i) % RULES.length]
    const tip = kind === 'per' ? perTip(inputs, day)
      : kind === 'vsIndex' ? vsIndexTip(inputs, day, todayKst)
      : kind === 'event' ? eventTip(inputs, day)
      : moverTip(inputs, day)
    if (tip) return tip
  }
  return null
}
