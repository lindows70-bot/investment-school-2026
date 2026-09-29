// 투자학교 저울 SSOT — 다섯 자산(채권·주식·부동산·금·코인)을 같은 세 질문(①돈을 만드나 ②지금 비싼가 ③지금 계절은)으로 재는 칸 조립(순수 함수, 외부 호출 0)
//   기획 = docs/student-mode/scale-plan.md. 규칙: 출처·날짜 이름표가 없는 숫자는 칸에 넣지 않는다(status 'hold' 로 비우고 이유를 적는다) ·
//   사라·팔라 없이 상태만 · 비교 칩은 원천이 가진 비교 기준으로만(임의 경계 없음) · 오래된 값은 문장 맨 앞에 날짜를 밝힌다.
//   ③ 칩(순풍·보통·역풍)은 seasonNavigator.ASSET_SEASON_WIND — 선생님이 승인한 수업 원칙(통계 아님)
import { seasonWind } from './seasonNavigator'   // 상대 경로 — 검증 스크립트가 이 파일을 별칭 없이 컴파일한다

export type ScaleQ = 'cash' | 'price' | 'season'
export type ScaleAsset = 'bond' | 'stock' | 'realestate' | 'gold' | 'coin'
/** ok = 이름표 붙은 숫자 · none = "없음"이 정답(금·코인의 현금흐름) · text = 숫자 없이 설명만 · hold = 원천이 비어 판정을 쉼 */
export type ScaleStatus = 'ok' | 'none' | 'text' | 'hold'

export interface ScaleCell {
  q: ScaleQ
  status: ScaleStatus
  chip: string | null        // 칸 맨 위 두세 단어(있음·없음·5년 평균보다 높음…) — 없으면 null
  sentence: string           // 학생 문장 하나
  source: string | null      // 출처 이름표(기관·계열)
  date: string | null        // 기준일 'YYYY-MM-DD' 또는 'YYYY-MM'
  detail: string | null      // 눌러서 펼치는 한 줄(숫자 최대 두 개 규칙의 나머지)
  href: string | null        // 간편 화면 안의 더 보기(없으면 null)
}
export interface ScaleRow { asset: ScaleAsset; name: string; cells: [ScaleCell, ScaleCell, ScaleCell] }
/** 지난 날짜와 비교해 칩이 바뀐 칸 — 숫자가 아니라 칩(상태)만 비교한다 */
export interface ScaleChange { asset: ScaleAsset; name: string; q: ScaleQ; from: string; to: string }
export interface ScaleResult {
  rows: ScaleRow[]; oldestDate: string | null; asOf: string
  /** 오늘 바뀐 칸(라우트가 채운다 — 지난 날짜 스냅샷이 없으면 빈 배열) · changedSince = 비교한 지난 날짜(KST) */
  changes?: ScaleChange[]; changedSince?: string | null
}

export type Quad = 'goldilocks' | 'inflation' | 'stagflation' | 'recession' | 'shoulder'

export interface ScaleInput {
  today: string   // KST 'YYYY-MM-DD'
  realYield: { nominal: { v: number; date: string }; real: { v: number; date: string }; bei: { v: number; date: string } } | null
  factset: { fwd: number; avg5: number | null; avg10: number | null; date: string } | null
  kb: { yoy: number; asOf: string; mortgage: { v: number; asOf: string } | null } | null
  /** 계절 재료 — regionSeason SSOT. ok=false 인 재료는 폴백(진짜 값 아님)이라 그 계절은 말하지 않는다 */
  season: {
    us: { quad: Quad; cliMonth: string | null; cliOk: boolean }
    kr: { quad: Quad; cliMonth: string | null; cliOk: boolean }
    cpiYoY: number; cpiMonth: string | null; cpiOk: boolean
    rateDir: 'cut' | 'hold' | 'hike'; rateDirOk: boolean; nextFomc: string | null
  } | null
  gold: { last: { date: string; close: number }; yearAgo: { date: string; close: number } | null } | null
  fng: { now: number | null; weekAgo: number | null; monthAgo: number | null; cls: string | null; date: string | null } | null
}

// 원천별 '오래됐다'고 말하는 기준(일) — 발표 주기 + 여유. FactSet 은 주간(금 발표·토 적재), KB·ECOS 는 월간(약 한 달 늦게 발표)
export const STALE_DAYS = { fred: 7, factset: 8, kb: 62, gold: 7, fng: 3 } as const

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const daysBetween = (a: string, b: string) => {
  const p = (s: string) => Date.parse(s.length === 7 ? `${s}-01T00:00:00Z` : `${s.slice(0, 10)}T00:00:00Z`)
  return Math.round((p(b) - p(a)) / 86_400_000)
}
const dot = (s: string) => s.length === 7 ? `${s.slice(0, 4)}.${Number(s.slice(5, 7))}` : `${s.slice(0, 4)}.${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`
/** 오래된 값이면 문장 앞에 날짜를 밝힌다 — 숫자는 그대로 두되 '지금'으로 읽히지 않게 */
const staleLead = (date: string, today: string, maxDays: number) => daysBetween(date, today) > maxDays ? `${dot(date)} 기준 — 아직 새 값이 안 왔어요. ` : ''
const pct2 = (n: number) => `${n.toFixed(2)}%`
/** '1년 전보다 4.4% 올랐어요' — 방향은 말로(부호만 쓰면 '달라졌다'가 된다), 0.05% 미만은 그대로 */
const moved = (n: number) => Math.abs(n) < 0.05 ? '거의 그대로예요' : `${Math.abs(n).toFixed(1)}% ${n > 0 ? '올랐어요' : '내렸어요'}`

const cell = (q: ScaleQ, status: ScaleStatus, sentence: string, o: Partial<Omit<ScaleCell, 'q' | 'status' | 'sentence'>> = {}): ScaleCell =>
  ({ q, status, sentence, chip: o.chip ?? null, source: o.source ?? null, date: o.date ?? null, detail: o.detail ?? null, href: o.href ?? null })
const hold = (q: ScaleQ, what: string) => cell(q, 'hold', `${what} 자료가 아직 안 들어왔어요. 출처·날짜가 없는 숫자는 쓰지 않아서 이 칸은 잠시 비워 둬요.`)

// ③ 계절 — 투자학교 4계절(성장=OECD 경기선행지수 × 물가=미국 CPI 3% 초과 또는 금리 인상 예상). 순풍/역풍 칩은 선생님 원칙 승인 전까지 없다
const QUAD_KO: Record<Quad, string> = {
  goldilocks: '🌸 봄(경기↑ 물가↓)', inflation: '☀️ 여름(경기↑ 물가↑)', stagflation: '🍁 가을(경기↓ 물가↑)',
  recession: '❄️ 겨울(경기↓ 물가↓)', shoulder: '🌗 간절기',
}
const RATE_KO = { cut: '인하', hold: '동결', hike: '인상' } as const
const SEASON_DETAIL = '계절 = 경기(OECD 경기선행지수가 오르나)와 물가(미국 CPI 3% 초과·금리 인상 예상)로 나눈 4칸 · 순풍·보통·역풍은 투자학교 수업 원칙이에요(과거 경향이지 약속이 아님)'
type Season = NonNullable<ScaleInput['season']>
/** 물가축이 진짜 값인가 — CPI 를 받았고, CPI 가 3% 이하일 땐 금리 예상(FedWatch)까지 받아야 판정이 선다 */
const inflationKnown = (s: Season) => s.cpiOk && (s.cpiYoY > 3 || s.rateDirOk)
/** 한 지역 계절 문구 — 재료가 폴백이면 null */
function seasonPhrase(s: Season, region: 'us' | 'kr'): string | null {
  const r = s[region]
  if (!r.cliOk || !inflationKnown(s)) return null
  return r.quad === 'shoulder' ? '🌗 간절기(계절이 바뀌는 중 — 지표가 서로 다르게 말해요)' : QUAD_KO[r.quad]
}
function missingMaterial(s: Season | null, region: 'us' | 'kr'): string {
  if (!s) return '계절'
  const m = [!s[region].cliOk ? `${region === 'us' ? '미국' : '한국'} 경기선행지수` : null, !s.cpiOk ? '미국 물가' : null, s.cpiOk && s.cpiYoY <= 3 && !s.rateDirOk ? '금리 예상' : null].filter(Boolean)
  return m.join('·') || '계절'
}
const seasonHold = (s: Season | null, region: 'us' | 'kr') => cell('season', 'hold', `계절 판정에 쓰는 ${missingMaterial(s, region)} 자료가 아직 안 들어와서 판정을 쉬어요.`)
/** 재료 기준월 중 가장 오래된 것(이름표 날짜) */
const oldestMonth = (...ms: (string | null)[]) => ms.filter((m): m is string => !!m).sort()[0] ?? null
const seasonSource = (s: Season, region: 'us' | 'kr') =>
  `투자학교 4계절 · OECD ${region === 'us' ? '미국' : '한국'} 경기선행 ${s[region].cliMonth ?? '?'} · 미국 CPI ${s.cpiMonth ?? '?'}${s.rateDirOk ? ' · FedWatch' : ''}`

const FNG_KO: Record<string, string> = { 'Extreme Fear': '극도의 공포', Fear: '공포', Neutral: '중립', Greed: '탐욕', 'Extreme Greed': '극도의 탐욕' }

export function buildScale(inp: ScaleInput): ScaleResult {
  const { today } = inp
  const ry = inp.realYield && isNum(inp.realYield.nominal?.v) && isNum(inp.realYield.real?.v) && inp.realYield.nominal.date && inp.realYield.real.date ? inp.realYield : null
  const fs = inp.factset && isNum(inp.factset.fwd) && inp.factset.fwd > 0 && inp.factset.date ? inp.factset : null
  const kb = inp.kb && isNum(inp.kb.yoy) && inp.kb.asOf ? inp.kb : null
  const gold = inp.gold && isNum(inp.gold.last?.close) && inp.gold.last.date ? inp.gold : null
  const fng = inp.fng && isNum(inp.fng.now) && inp.fng.date ? inp.fng : null
  const sz = inp.season
  const us = sz ? seasonPhrase(sz, 'us') : null
  const kr = sz ? seasonPhrase(sz, 'kr') : null
  const usCell = (asset: 'bond' | 'gold' | 'coin', text: (p: string, s: Season) => string, detail = SEASON_DETAIL) => sz && us
    ? cell('season', 'ok', text(us, sz), { chip: seasonWind(sz.us.quad, asset), source: seasonSource(sz, 'us'), date: oldestMonth(sz.us.cliMonth, sz.cpiMonth), detail })
    : seasonHold(sz, 'us')
  const rateLine = (s: Season) => s.rateDirOk ? ` 시장은 앞으로 금리 '${RATE_KO[s.rateDir]}'을 예상해요${s.nextFomc ? `(다음 결정 ${dot(s.nextFomc)})` : ''}.` : ''
  const bondSeason = usCell('bond', (p, s) => `미국은 지금 ${p}이에요.${rateLine(s)}`)
  const stockSeason = sz && us
    ? cell('season', 'ok', `미국 ${us}${kr ? ` · 한국 ${kr}` : ''}이에요.`, {
        chip: (() => { const u = seasonWind(sz.us.quad, 'stock'), k = kr ? seasonWind(sz.kr.quad, 'stock') : null; return k && u !== k ? `미국 ${u ?? '—'} · 한국 ${k}` : u })(),
        source: `${seasonSource(sz, 'us')}${kr ? ` · OECD 한국 경기선행 ${sz.kr.cliMonth ?? '?'}` : ''}`,
        date: oldestMonth(sz.us.cliMonth, sz.cpiMonth, kr ? sz.kr.cliMonth : null),
        detail: `${kr ? '한국 계절은 한국 경기선행지수에 미국 물가(세계 물가의 기준)를 써서 판정해요 · ' : '한국 경기선행지수가 아직 안 들어와 한국 계절은 쉬어요 · '}${SEASON_DETAIL}` })
    : seasonHold(sz, 'us')
  const reSeason = sz && kr
    ? cell('season', 'ok', `한국은 지금 ${kr}이에요. 금리가 오르면 집값을 누르는 힘(중력)이 세져요.`, {
        chip: seasonWind(sz.kr.quad, 'realestate'),
        source: seasonSource(sz, 'kr'), date: oldestMonth(sz.kr.cliMonth, sz.cpiMonth),
        detail: `한국 계절은 한국 경기선행지수에 미국 물가(세계 물가의 기준)를 써서 판정해요 · ${SEASON_DETAIL}` })
    : seasonHold(sz, 'kr')
  const goldSeason = usCell('gold', (p, s) => `미국은 지금 ${p}이에요. 미국 물가는 1년 전보다 ${Math.abs(s.cpiYoY).toFixed(1)}% ${s.cpiYoY >= 0 ? '올랐어요' : '내렸어요'}${s.cpiMonth ? `(${dot(s.cpiMonth)})` : ''}.`)
  const coinSeason = usCell('coin', p => `미국은 지금 ${p}이에요.`, `시중에 풀린 돈의 양(M2)과 견주는 칸은 곧 붙어요 · ${SEASON_DETAIL}`)

  // ── 채권 — 이자가 나머지 네 자산을 재는 잣대(r)라 맨 위 ──
  const bond: ScaleRow = {
    asset: 'bond', name: '채권',
    cells: [
      ry ? cell('cash', 'ok', `${staleLead(ry.nominal.date, today, STALE_DAYS.fred)}빌려준 돈에 이자를 줘요. 만기까지 들고 있으면 받을 이자는 처음부터 정해져 있어요. 미국 10년 국채는 연 ${pct2(ry.nominal.v)}예요.`,
        { chip: '있음', source: 'FRED 미국 10년 국채 금리(DGS10)', date: ry.nominal.date })
        : hold('cash', '미국 국채 금리'),
      ry ? cell('price', 'ok', `${staleLead(ry.real.date, today, STALE_DAYS.fred)}받는 이자 ${pct2(ry.nominal.v)}에서 물가 오름을 빼면 ${pct2(ry.real.v)}가 남아요. 물가를 빼고도 남는 이자가 클수록 채권값은 싼 편이에요.`,
        { source: 'FRED DGS10 · DFII10(물가연동국채)', date: ry.real.date,
          detail: isNum(ry.bei?.v) && ry.bei.date ? `시장이 예상하는 물가 오름 ${pct2(ry.bei.v)}(FRED T10YIE · ${dot(ry.bei.date)}) — 받는 이자 = 물가 뺀 이자 + 예상 물가` : null })
        : hold('price', '물가를 뺀 국채 이자'),
      bondSeason,
    ],
  }

  // ── 주식 — 이익이 현금흐름. 시장 단위(S&P 500)만 — 내 종목은 '내 자산에서 보기'로 ──
  const ey = fs ? Math.round(10000 / fs.fwd) / 100 : null   // 이익수익률 = 100 ÷ 선행 PER(%)
  const stockChip = !fs || !isNum(fs.avg5) ? '비교 기준 없음' : Math.abs(fs.fwd - fs.avg5) < 0.05 ? '5년 평균과 같음' : fs.fwd > fs.avg5 ? '5년 평균보다 높음' : '5년 평균보다 낮음'
  const stock: ScaleRow = {
    asset: 'stock', name: '주식',
    cells: [
      fs && ey != null ? cell('cash', 'ok', `${staleLead(fs.date, today, STALE_DAYS.factset)}회사가 버는 이익이 주식의 현금흐름이에요. 미국 대표 500개 회사는 주가 100원어치가 앞으로 1년에 약 ${ey.toFixed(1)}원을 벌 것으로 예상돼요. 채권 이자처럼 약속된 돈은 아니에요.`,
        { chip: '있음', source: 'FactSet 선행 PER(S&P 500) · 계산 100÷PER', date: fs.date })
        : hold('cash', '미국 대표 주식의 예상이익'),
      fs ? cell('price', 'ok', `${staleLead(fs.date, today, STALE_DAYS.factset)}지금 값은 앞으로 1년 예상이익의 ${fs.fwd}배예요.${isNum(fs.avg5) ? ` 지난 5년 평균은 ${fs.avg5}배예요.` : ''}`,
        { chip: stockChip, source: 'FactSet Earnings Insight(S&P 500 선행 PER)', date: fs.date,
          detail: [isNum(fs.avg10) ? `10년 평균 ${fs.avg10}배` : null, ey != null && ry ? `1년 예상이익÷가격 ${ey.toFixed(1)}% vs 미국 10년 국채 이자 ${pct2(ry.nominal.v)}(${dot(ry.nominal.date)})` : null].filter(Boolean).join(' · ') || null })
        : hold('price', '미국 대표 주식의 가격 배수'),
      stockSeason,
    ],
  }

  // ── 부동산 — 전국 전세가율 원천이 없다: ① 은 설명만, 값은 관심 단지에서 ──
  const realestate: ScaleRow = {
    asset: 'realestate', name: '부동산',
    cells: [
      cell('cash', 'text', '집이 버는 돈은 월세예요(전세라면 집주인이 보증금을 굴려서 벌어요). 전국 숫자는 아직 없어서, 관심 단지를 고르면 그 단지 전세가가 매매가의 몇 %인지 보여 드려요.',
        { chip: '있음', href: '/s/realestate' }),
      kb ? cell('price', 'ok', `${staleLead(kb.asOf, today, STALE_DAYS.kb)}${kb.mortgage ? `새로 받는 주택담보대출 금리는 ${pct2(kb.mortgage.v)}예요. ` : ''}전국 아파트값은 1년 전보다 ${moved(kb.yoy)}.`,
        { source: `KB 아파트 매매가격지수(전국) ${kb.asOf}${kb.mortgage ? ` · 한국은행 주담대 금리(신규취급) ${kb.mortgage.asOf}` : ''}`, date: oldestMonth(kb.asOf, kb.mortgage?.asOf ?? null) ?? kb.asOf,
          detail: `${kb.mortgage ? `1억을 빌리면 1년 이자가 약 ${Math.round(kb.mortgage.v * 100).toLocaleString('ko-KR')}만원(단순 계산) · ` : ''}월간 통계라 약 한 달 늦게 나와요` })
        : hold('price', '전국 아파트값'),
      reSeason,
    ],
  }

  // ── 금 — 현금흐름 없음. 비싼가는 '포기하는 이자'와 나란히(관계는 원칙 문장) ──
  const gy = gold?.yearAgo && isNum(gold.yearAgo.close) && gold.yearAgo.close > 0 ? (gold.last.close / gold.yearAgo.close - 1) * 100 : null
  const goldRow: ScaleRow = {
    asset: 'gold', name: '금',
    cells: [
      cell('cash', 'none', '금은 이자도 배당도 주지 않아요. 들고 있는 동안 버는 돈은 0이에요. 값이 오를 때만 벌어요.', { chip: '없음' }),
      ry && gold && gy != null ? cell('price', 'ok', `${staleLead(gold.last.date, today, STALE_DAYS.gold)}금을 들고 있으면 물가를 뺀 국채 이자 ${pct2(ry.real.v)}를 포기하는 셈이에요. 금값은 1년 전보다 ${moved(gy)}.`,
        { chip: '비교 기준 없음', source: 'FRED DFII10 · 야후 금 선물(GC=F) 종가', date: gold.last.date,
          detail: `포기하는 이자가 클수록 금을 들고 있기가 무거워요(원칙이지 예측이 아님) · 금값 비교 ${dot(gold.yearAgo!.date)} → ${dot(gold.last.date)} · 물가 뺀 이자 FRED DFII10 ${dot(ry.real.date)}` })
        : hold('price', ry ? '금값' : '물가를 뺀 국채 이자'),
      goldSeason,
    ],
  }

  // ── 코인 — 현금흐름 없음. 금리와 견줄 수 없어 사람들 마음 온도로 ──
  const coin: ScaleRow = {
    asset: 'coin', name: '코인',
    cells: [
      cell('cash', 'none', '비트코인은 이자·배당·월세가 없어요. 값이 오르는 것만 수익이에요.', { chip: '없음' }),
      fng ? cell('price', 'ok', `${staleLead(fng.date!, today, STALE_DAYS.fng)}버는 돈이 없어서 금리와 견줄 수도, 적정 가격을 계산할 수도 없어요. 대신 사람들 마음 온도를 봐요. 지금은 ${fng.now}점${isNum(fng.weekAgo) ? `, 1주 전 ${fng.weekAgo}점` : ''}${isNum(fng.monthAgo) ? `, 1달 전 ${fng.monthAgo}점` : ''}이에요.`,
        { chip: fng.cls && FNG_KO[fng.cls] ? FNG_KO[fng.cls] : null, source: 'alternative.me 공포·탐욕 지수(0~100)', date: fng.date, detail: '0에 가까울수록 공포, 100에 가까울수록 탐욕 · ETF 자금 흐름은 코인 화면에서', href: '/s/coin' })
        : hold('price', '코인 공포·탐욕 지수'),
      coinSeason,
    ],
  }

  const rows = [bond, stock, realestate, goldRow, coin]
  const dates = rows.flatMap(r => r.cells).filter(c => c.status === 'ok' && c.date).map(c => c.date as string)
  const oldestDate = dates.length ? dates.reduce((a, b) => daysBetween(a, b) < 0 ? b : a) : null
  return { rows, oldestDate, asOf: new Date().toISOString() }
}

/** 금 일봉 → 마지막 완성 봉 + 1년 전(날짜로 찾는다 — 그날이 없으면 그 전 가장 가까운 거래일, 인덱스 산술 금지) */
export function goldPoints(candles: { date: string; close: number }[]): ScaleInput['gold'] {
  const c = candles.filter(x => x && typeof x.date === 'string' && isNum(x.close) && x.close > 0)
  if (c.length < 2) return null
  const last = c[c.length - 1]
  const target = new Date(Date.parse(`${last.date}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10)
  const before = c.filter(x => x.date <= target)
  const yearAgo = before.length ? before[before.length - 1] : null
  // 1년 전 봉이 목표일에서 10일 넘게 떨어져 있으면(이력 구멍) 비교하지 않는다
  return { last: { date: last.date, close: last.close }, yearAgo: yearAgo && daysBetween(yearAgo.date, target) <= 10 ? { date: yearAgo.date, close: yearAgo.close } : null }
}

/** 칩 스냅샷 — 'asset:q' → 칩. 쉬는 칸(hold)·칩 없는 칸은 싣지 않는다(쉬었다 돌아온 것을 '바뀜'으로 세지 않게) */
export function chipsOf(r: ScaleResult): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of r.rows) for (const c of row.cells) if (c.status !== 'hold' && c.chip) out[`${row.asset}:${c.q}`] = c.chip
  return out
}
/** 지난 스냅샷 대비 바뀐 칸 — 양쪽에 다 있는 칸만 비교 */
export function diffChips(prev: Record<string, string> | null, now: Record<string, string>, rows: ScaleRow[]): ScaleChange[] {
  if (!prev) return []
  const out: ScaleChange[] = []
  for (const row of rows) for (const c of row.cells) {
    const k = `${row.asset}:${c.q}`
    if (prev[k] && now[k] && prev[k] !== now[k]) out.push({ asset: row.asset, name: row.name, q: c.q, from: prev[k], to: now[k] })
  }
  return out
}
/** 스냅샷 한 행을 날짜에 맞춰 넘긴다 — 같은 날이면 비교 기준(prev)을 유지, 날이 바뀌면 어제 칩이 비교 기준이 된다 */
export interface ChipSnap { day: string; chips: Record<string, string>; prevDay: string | null; prevChips: Record<string, string> | null }
export function rollSnap(snap: ChipSnap | null, today: string, now: Record<string, string>): ChipSnap {
  if (!snap) return { day: today, chips: now, prevDay: null, prevChips: null }
  if (snap.day === today) return { day: today, chips: { ...snap.chips, ...now }, prevDay: snap.prevDay, prevChips: snap.prevChips }
  return { day: today, chips: { ...snap.chips, ...now }, prevDay: snap.day, prevChips: snap.chips }
}
