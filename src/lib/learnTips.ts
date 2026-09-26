// 학생 배우기 화면 '오늘 알려드려요' 한 줄을 고르는 순수 규칙 — 날짜로 ①PER ②산 뒤 대 지수 ③일정 ④크게 움직인 종목을 돌리고, 데이터가 없으면 다음 규칙
//   숫자는 전부 입력에서만 나온다(지어내지 않는다) · 명령이 아니라 사실만 말한다 · 등락 표기는 studentFormat SSOT.
import { pct } from '@/lib/studentFormat'
import { getAssetType } from '@/lib/assetClassifier'
import { dayNum, type VsIndexRow } from '@/lib/learnTipsData'

export type TipKind = 'per' | 'vsIndex' | 'event' | 'mover'
export interface Tip {
  kind: TipKind; title: string; body: string; source: string
  ticker?: string; market?: string; tone?: 'up' | 'down' | 'flat'
  /** 기준일(YYYY-MM-DD) — 화면이 출처 옆에 적는다. 모르면 없음 */
  asOf?: string
}
export interface TipInputs {
  per: {
    ticker: string; name: string; market: string
    /** 화면에 보이는 PER(/api/stock-info fundamentals.pe — 네이버 우선) */
    pe: number | null
    /** 같은 종목의 Yahoo trailingPE(getSectorPeers.targetPe) — 동종 중앙값과 같은 잣대 */
    targetPeSameBasis: number | null
    perMedian: number | null; perCount: number
    /** pe 가 무슨 이익 기준인지 — 'annual' 이면 '직전 결산 연도' 문장을 붙인다. 모르면 붙이지 않는다 */
    peBasis?: 'annual' | 'trailing' | null
    /** stock-info 기준 시각(있으면) */
    asOf?: string | null
  }[] | null
  vsIndex: VsIndexRow[] | null
  events: { type: 'earnings' | 'exDiv' | 'payDiv'; date: string; ticker: string; name: string; market?: string }[] | null
  movers: {
    ticker: string; name: string; market: string; changePct: number
    /** 최근 뉴스 제목 — undefined = 찾아보지 않음(ETF·코인은 뉴스를 모으지 않는다 → 뉴스 문장을 뺀다) · null·빈 문자열 = 찾았는데 없음 */
    headline?: string | null
    /** 뉴스를 찾아보려 했는데 원천을 못 가져왔다 — '없음'이 아니라 '못 가져옴'으로 말한다 */
    newsFailed?: boolean
    /** 이 등락이 일어난 거래일(YYYY-MM-DD) — 모르면 null */
    tradeDate: string | null
    /** 내가 가진 종목인가 — false 는 버린다 */
    held: boolean
  }[] | null
}

/** 규칙 순서 — 오늘의 시작 규칙은 (날 수 mod 4) 번째, 매일 한 칸씩 밀린다 */
const RULES: TipKind[] = ['per', 'vsIndex', 'event', 'mover']
const YMD = /^\d{4}-\d{2}-\d{2}$/
/** 동종 기업 중앙값과 비교하려면 최소 이만큼 있어야 한다(getSectorPeers.perMedian 과 같은 기준) */
const PER_MIN_PEERS = 3
/** 화면 PER 과 같은 잣대 PER 이 이만큼(15%) 넘게 다르면 원천·기준이 달라 중앙값과 비교하지 않는다 */
const PER_BASIS_MAX_GAP = 0.15
/** 지수와 '비슷해요'로 보는 폭(%p) */
const VS_INDEX_BAND = 0.5
/** 일정은 오늘부터 이 날 수 안만 */
const EVENT_WINDOW_DAYS = 30
/** 보합 경계 — studentFormat.pct·upDown 과 같다 */
const FLAT = 0.05

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n)
/** M/D — 올해가 아니면 앞에 연도(2025/9/1) */
const md = (ymd: string, todayKst: string) => `${ymd.slice(0, 4) === todayKst.slice(0, 4) ? '' : `${ymd.slice(0, 4)}/`}${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}`
const times = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const toneOf = (n: number): 'up' | 'down' | 'flat' => Math.abs(n) < FLAT ? 'flat' : n > 0 ? 'up' : 'down'

/** 마지막 글자에 받침이 있나 — 한글은 정확히, 숫자는 읽는 소리로(0=영/십/백), 영문은 3글자 이하 약어만(L=엘·M=엠·N=엔·R=알). 모르면 null */
function hasBatchim(word: string): boolean | null {
  const s = word.trim().replace(/[^0-9A-Za-z가-힣]+$/, '')
  const ch = s.slice(-1)
  if (!ch) return null
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  if (/[0-9]/.test(ch)) return '013678'.includes(ch)
  if (/[A-Za-z]/.test(ch)) {
    const token = (s.match(/[A-Za-z]+$/) ?? [''])[0]
    // 긴 영문 이름(NVIDIA·Apple)은 읽는 법을 모른다 → null('은(는)')
    return token.length <= 3 ? 'LMNR'.includes(ch.toUpperCase()) : null
  }
  return null
}
const eunNeun = (w: string) => { const b = hasBatchim(w); return b == null ? '은(는)' : b ? '은' : '는' }
const waGwa = (w: string) => { const b = hasBatchim(w); return b == null ? '와(과)' : b ? '과' : '와' }

/**
 * 같은 규칙 안에서 고를 것 — 입력 순서와 무관하게 key 순으로 정렬해 고른다.
 * 시작 규칙이면 4일마다 한 칸(floor(day/4)), 다음 규칙으로 넘어와 매일 쓰일 수 있으면 매일 한 칸(day).
 */
function rotatePick<T>(xs: T[], key: (x: T) => string, day: number, viaFallback: boolean): T {
  const sorted = xs.slice().sort((a, b) => key(a).localeCompare(key(b)))
  const i = (viaFallback ? day : Math.floor(day / RULES.length)) % sorted.length
  return sorted[(i + sorted.length) % sorted.length]
}
const byTicker = (x: { ticker: string }) => x.ticker

function perTip(inputs: TipInputs, day: number, fb: boolean): Tip | null {
  // ETF·코인·적자 기업은 PER 이 없다(null·0 이하) → 건너뛴다
  const xs = (inputs.per ?? []).filter(x => isNum(x.pe) && x.pe > 0)
  if (!xs.length) return null
  const x = rotatePick(xs, byTicker, day, fb)
  const pe = x.pe as number
  let body = 'PER은 주가가 회사가 1년 동안 번 1주당 이익의 몇 배인지를 뜻해요.'
  if (x.peBasis === 'annual') body += ' 이 숫자는 직전 결산 연도 이익 기준이에요.'
  // 동종 중앙값(야후)과 비교는 같은 잣대 PER 이 화면 PER 과 15% 안에서 맞을 때만 — 원천(네이버 vs 야후)·기준(연간 vs 최근 4분기)이 다르면 엉뚱한 결론이 난다
  const sb = x.targetPeSameBasis
  const compare = isNum(x.perMedian) && x.perMedian > 0 && x.perCount >= PER_MIN_PEERS
    && isNum(sb) && sb > 0 && Math.abs(pe - sb) / Math.min(pe, sb) <= PER_BASIS_MAX_GAP
  if (compare) {
    const m = x.perMedian as number
    const side = (v: number) => times(v) === times(m) ? 0 : v < m ? -1 : 1
    // 두 PER 이 중앙값의 서로 다른 쪽이면 어느 쪽이라고 말할 수 없다 → 비슷해요
    const s = side(pe) === side(sb as number) ? side(pe) : 0
    // 국내 종목의 동종 기업 목록은 대부분 해외 기업이다(getSectorPeers 큐레이션 맵·야후 추천) → 밝혀 둔다
    const overseas = (x.market ?? '').toUpperCase() === 'KR' ? '(해외 기업 포함)' : ''
    const head = ` 비슷한 기업 ${x.perCount}곳${overseas}의 중앙값 ${times(m)}배`
    body += s === 0 ? `${head}${waGwa('배')} 비슷해요.`
      : s < 0 ? `${head}보다 낮아서, 버는 돈에 비해 비슷한 기업들보다 덜 비싸게 거래되고 있어요.`
      : `${head}보다 높아서, 버는 돈에 비해 비슷한 기업들보다 비싸게 거래되고 있어요.`
  }
  const asOf = typeof x.asOf === 'string' && YMD.test(x.asOf.slice(0, 10)) ? x.asOf.slice(0, 10) : undefined
  return {
    kind: 'per', title: `${x.name} PER은 ${times(pe)}배예요`, body,
    source: compare ? '앱 종목 정보 · 비슷한 기업 비교' : '앱 종목 정보', ticker: x.ticker, market: x.market,
    ...(asOf ? { asOf } : {}),
  }
}

function vsIndexTip(inputs: TipInputs, day: number, fb: boolean, todayKst: string): Tip | null {
  const xs = (inputs.vsIndex ?? []).filter(x => isNum(x.returnPct) && isNum(x.indexReturnPct) && !!x.indexName
    && YMD.test(x.buyDate) && x.buyDate < todayKst && YMD.test(x.endDate) && YMD.test(x.indexStartDate))
  if (!xs.length) return null
  const x = rotatePick(xs, byTicker, day, fb)
  const diff = x.returnPct - x.indexReturnPct
  const clause = Math.abs(diff) < VS_INDEX_BAND ? `${x.indexName}${waGwa(x.indexName)} 비슷해요.`
    : `${x.indexName}보다 ${Math.abs(diff).toFixed(1)}%p ${diff > 0 ? '앞섰어요' : '뒤처졌어요'}.`
  const notes = [
    x.indexStartDate !== x.buyDate ? `지수는 ${md(x.indexStartDate, todayKst)} 종가부터` : null,
    x.indexName === '코스피' ? '코스피 기준' : null,   // 코스닥 종목도 코스피와 비교한다(티커로 시장을 못 가른다)
  ].filter(Boolean)
  return {
    kind: 'vsIndex',
    title: `${x.name}${eunNeun(x.name)} 산 뒤 ${pct(x.returnPct)}, 같은 기간 ${x.indexName} ${pct(x.indexReturnPct)}`,
    body: `산 날(${md(x.buyDate, todayKst)})부터 ${md(x.endDate, todayKst)}까지 비교했어요${notes.length ? `(${notes.join(' · ')})` : ''}. ${clause}`,
    source: `내 거래 기록 · ${x.indexName}${x.endComplete ? ' 종가' : ''} (${md(x.endDate, todayKst)} 기준)`,
    ticker: x.ticker, market: x.market, tone: toneOf(x.returnPct), asOf: x.endDate,
  }
}

const EX_TEXT = (money: string) => `이날 전 거래일까지 사 둔 사람이 이번 ${money}을 받아요(이날 팔아도 받아요).`
function eventText(type: 'earnings' | 'exDiv' | 'payDiv', isEtf: boolean): { label: string; body: string } {
  if (type === 'earnings') return { label: '실적 발표', body: '회사가 최근 성적(매출·이익)을 알리는 날이에요. 예정일이라 바뀔 수 있어요.' }
  // ETF 는 '배당' 이 아니라 '분배금'
  if (type === 'exDiv') return isEtf ? { label: '분배락', body: EX_TEXT('분배금') } : { label: '배당락', body: EX_TEXT('배당') }
  return isEtf ? { label: '분배금 지급', body: '분배금이 들어오는 날이에요.' } : { label: '배당 지급', body: '배당금이 들어오는 날이에요.' }
}

function eventTip(inputs: TipInputs, day: number, fb: boolean, todayKst: string): Tip | null {
  // 지난 일정은 빼고 오늘~30일 안에서 가장 가까운 날. 같은 날 여럿이면 그 안에서 돌린다
  const xs = (inputs.events ?? []).filter(e => e && (e.type === 'earnings' || e.type === 'exDiv' || e.type === 'payDiv') && YMD.test(e.date))
    .map(e => ({ ...e, dd: dayNum(e.date) - day }))
    .filter(e => e.dd >= 0 && e.dd <= EVENT_WINDOW_DAYS)
  if (!xs.length) return null
  const nearest = Math.min(...xs.map(e => e.dd))
  const e = rotatePick(xs.filter(x => x.dd === nearest), x => `${x.ticker}|${x.type}`, day, fb)
  const t = eventText(e.type, getAssetType(e.ticker, e.name ?? '', e.market) === 'ETF')
  return {
    kind: 'event', title: `${md(e.date, todayKst)} ${e.name} ${t.label}`,
    body: `${t.body} ${e.dd === 0 ? '바로 오늘이에요.' : `오늘부터 ${e.dd}일 뒤예요.`}`,
    source: '종목 일정(실적·배당)', ticker: e.ticker, ...(e.market ? { market: e.market } : {}), asOf: e.date,
  }
}

function moverTip(inputs: TipInputs, day: number, fb: boolean, todayKst: string): Tip | null {
  // 내가 가진 종목 중 가장 크게 움직인 것(절대값). 보합은 '움직인 종목'이 아니다
  const xs = (inputs.movers ?? []).filter(m => m && m.held === true && isNum(m.changePct) && Math.abs(m.changePct) >= FLAT)
  if (!xs.length) return null
  const top = Math.max(...xs.map(m => Math.abs(m.changePct)))
  const m = rotatePick(xs.filter(x => Math.abs(x.changePct) === top), byTicker, day, fb)
  const headline = typeof m.headline === 'string' && m.headline.trim() ? m.headline.trim() : null
  // 뉴스 문장 — 제목 있음 · 못 가져옴 · 찾았는데 없음 · 찾아보지 않음(빈 본문 — 화면이 줄을 숨긴다)
  const body = headline ? `최근 뉴스 제목: "${headline}"`
    : m.newsFailed === true ? '뉴스 제목을 못 가져왔어요.'
    : m.headline === undefined ? ''
    : '관련 뉴스 제목을 못 찾았어요.'
  const td = typeof m.tradeDate === 'string' && YMD.test(m.tradeDate) ? m.tradeDate : null
  // 등락이 일어난 날을 제목에 — 오늘이 아니면 그날 날짜, 모르면 '최근 거래일'
  const when = td == null ? '최근 거래일' : td === todayKst ? '오늘' : md(td, todayKst)
  return {
    kind: 'mover', title: `${m.name} ${when} ${pct(m.changePct)}`,
    body,
    source: '하루 등락 · 뉴스 제목(시각 미확인)', ticker: m.ticker, market: m.market, tone: toneOf(m.changePct),
    ...(td ? { asOf: td } : {}),
  }
}

/**
 * 오늘 규칙을 시도하는 순서 — RULES[(날 수 mod 4)] 부터 한 바퀴. pickTip 이 이 순서로 돈다.
 * 화면은 이 순서대로 한 규칙씩 원천을 불러, 문장이 나오는 첫 규칙에서 멈춘다(무거운 원천을 한꺼번에 부르지 않게).
 * 날짜 형식이 틀리면 빈 배열.
 */
export function tipRuleOrder(todayKst: string): TipKind[] {
  if (!YMD.test(todayKst)) return []
  const day = dayNum(todayKst)
  const start = ((day % RULES.length) + RULES.length) % RULES.length
  return RULES.map((_, i) => RULES[(start + i) % RULES.length])
}

/**
 * 오늘의 한 줄 — 같은 날 같은 입력이면 늘 같은 결과.
 * 시작 규칙 = RULES[(날 수 mod 4)] 에서 시작해 입력이 없는 규칙은 건너뛴다. 전부 없으면 null(화면이 '오늘은 알려드릴 게 없어요'를 말한다).
 */
export function pickTip(todayKst: string, inputs: TipInputs): Tip | null {
  if (!YMD.test(todayKst)) return null
  const day = dayNum(todayKst)
  const order = tipRuleOrder(todayKst)
  for (let i = 0; i < order.length; i++) {
    const kind = order[i]
    const fb = i > 0
    const tip = kind === 'per' ? perTip(inputs, day, fb)
      : kind === 'vsIndex' ? vsIndexTip(inputs, day, fb, todayKst)
      : kind === 'event' ? eventTip(inputs, day, fb, todayKst)
      : moverTip(inputs, day, fb, todayKst)
    if (tip) return tip
  }
  return null
}
