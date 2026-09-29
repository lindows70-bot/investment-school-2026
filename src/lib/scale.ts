// 투자학교 저울 SSOT — 다섯 자산(채권·주식·부동산·금·코인)을 같은 세 질문(①돈을 만드나 ②지금 비싼가 ③지금 계절은)으로 재는 칸 조립(순수 함수, 외부 호출 0)
//   기획 = docs/student-mode/scale-plan.md. 규칙: 출처·날짜 이름표가 없는 숫자는 칸에 넣지 않는다(status 'hold' 로 비우고 이유를 적는다) ·
//   사라·팔라 없이 상태만 · 비교 칩은 원천이 가진 비교 기준으로만(임의 경계 없음) · 오래된 값은 문장 맨 앞에 날짜를 밝힌다.

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
export interface ScaleResult { rows: ScaleRow[]; oldestDate: string | null; asOf: string }

export interface ScaleInput {
  today: string   // KST 'YYYY-MM-DD'
  realYield: { nominal: { v: number; date: string }; real: { v: number; date: string }; bei: { v: number; date: string } } | null
  factset: { fwd: number; avg5: number | null; avg10: number | null; date: string } | null
  kb: { yoy: number; asOf: string } | null
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

// ③ 계절 — 2단계(계절 재료의 기준월·폴백 표시)가 붙기 전까지는 가짜 계절을 넣지 않는다
const SEASON_SOON = cell('season', 'hold', '곧 열려요. 경기와 물가가 오르는지 내리는지(계절)를 자료 날짜와 함께 보여 드릴게요.')

const FNG_KO: Record<string, string> = { 'Extreme Fear': '극도의 공포', Fear: '공포', Neutral: '중립', Greed: '탐욕', 'Extreme Greed': '극도의 탐욕' }

export function buildScale(inp: ScaleInput): ScaleResult {
  const { today } = inp
  const ry = inp.realYield && isNum(inp.realYield.nominal?.v) && isNum(inp.realYield.real?.v) && inp.realYield.nominal.date && inp.realYield.real.date ? inp.realYield : null
  const fs = inp.factset && isNum(inp.factset.fwd) && inp.factset.fwd > 0 && inp.factset.date ? inp.factset : null
  const kb = inp.kb && isNum(inp.kb.yoy) && inp.kb.asOf ? inp.kb : null
  const gold = inp.gold && isNum(inp.gold.last?.close) && inp.gold.last.date ? inp.gold : null
  const fng = inp.fng && isNum(inp.fng.now) && inp.fng.date ? inp.fng : null

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
      SEASON_SOON,
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
      SEASON_SOON,
    ],
  }

  // ── 부동산 — 전국 전세가율 원천이 없다: ① 은 설명만, 값은 관심 단지에서 ──
  const realestate: ScaleRow = {
    asset: 'realestate', name: '부동산',
    cells: [
      cell('cash', 'text', '집이 버는 돈은 월세예요(전세라면 집주인이 보증금을 굴려서 벌어요). 전국 숫자는 아직 없어서, 관심 단지를 고르면 그 단지 전세가가 매매가의 몇 %인지 보여 드려요.',
        { chip: '있음', href: '/s/realestate' }),
      kb ? cell('price', 'ok', `${staleLead(kb.asOf, today, STALE_DAYS.kb)}전국 아파트값은 1년 전보다 ${moved(kb.yoy)}.`,
        { source: 'KB 아파트 매매가격지수(전국) · 한국은행 ECOS', date: kb.asOf, detail: '월간 통계라 약 한 달 늦게 나와요. 대출 금리와 견주는 칸은 곧 붙어요.' })
        : hold('price', '전국 아파트값'),
      SEASON_SOON,
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
      SEASON_SOON,
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
      SEASON_SOON,
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
