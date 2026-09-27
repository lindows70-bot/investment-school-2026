// 학생 배우기 화면 '오늘 알려드려요' 한 줄을 고르는 순수 규칙 — 날짜로 ①PER ②산 뒤 대 지수 ③집중도 ④환율 효과 ⑤코어·위성을 돌리고, 데이터가 없으면 다음 규칙
//   2026-09-27 재설계: 등락·일정 규칙은 '오늘 내 종목 소식' 카드와 같은 말이 돼 뺐다 — 이 카드는 '내 숫자로 개념 하나 배우기', 소식 카드는 '오늘 일어난 일'.
//   숫자는 전부 입력에서만 나온다(지어내지 않는다) · 명령이 아니라 사실만 말한다 · 등락 표기는 studentFormat SSOT.
import { pct, fxWon } from '@/lib/studentFormat'
import { dayNum, type VsIndexRow } from '@/lib/learnTipsData'

export type TipKind = 'per' | 'vsIndex' | 'concentration' | 'fx' | 'coreSat'
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
  /** 내 자산 종목별 비중(%) — 지금 평가액 기준(시세 없는 종목은 매수가). 비어 있으면 종목 없음 */
  concentration: { rows: { ticker: string; name: string; market: string; weightPct: number }[] } | null
  /** 달러 종목의 환율 효과(/api/fx-attribution) — count 0 = 달러 종목 없음. 수익률은 % · exposurePct = 환율 노출 비중 % */
  fx: { count: number; retUsd: number; retKrw: number; exposurePct: number | null; fxNow: number } | null
  /** 코어·위성 비중(%)과 종목 수 — 기록할 때 정한 역할 */
  coreSat: { corePct: number; satPct: number; coreCount: number; satCount: number } | null
}

/** 규칙 순서 — 오늘의 시작 규칙은 (날 수 mod 5) 번째, 매일 한 칸씩 밀린다 */
const RULES: TipKind[] = ['per', 'vsIndex', 'concentration', 'fx', 'coreSat']
const YMD = /^\d{4}-\d{2}-\d{2}$/
/** 동종 기업 중앙값과 비교하려면 최소 이만큼 있어야 한다(getSectorPeers.perMedian 과 같은 기준) */
const PER_MIN_PEERS = 3
/** 화면 PER 과 같은 잣대 PER 이 이만큼(15%) 넘게 다르면 원천·기준이 달라 중앙값과 비교하지 않는다 */
const PER_BASIS_MAX_GAP = 0.15
/** 지수와 '비슷해요'로 보는 폭(%p) */
const VS_INDEX_BAND = 0.5
/** 집중도 — 한 종목이 이 비중을 넘으면 '절반 넘게', 그 아래 이 값을 넘으면 '30% 넘게' */
const CONC_HALF = 50, CONC_BIG = 30
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
 * 시작 규칙이면 규칙 수(5)일마다 한 칸(floor(day/5)), 다음 규칙으로 넘어와 매일 쓰일 수 있으면 매일 한 칸(day).
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

/** ③ 집중도 — 가장 비중이 큰 종목 하나. 절반 넘게 / 30% 넘게 / 그 아래로 문장이 갈린다(사라·팔라는 뜻이 아니라고 늘 밝힌다) */
function concentrationTip(inputs: TipInputs): Tip | null {
  const rows = (inputs.concentration?.rows ?? []).filter(r => isNum(r.weightPct) && r.weightPct > 0 && r.name)
  if (!rows.length) return null
  const top = rows.reduce((a, b) => (b.weightPct > a.weightPct ? b : a))
  const w = Math.round(top.weightPct * 10) / 10
  const n = rows.length
  const title = w >= CONC_BIG ? `내 자산의 ${w}%가 ${top.name} 한 종목이에요` : `가장 큰 종목은 ${top.name}, 내 자산의 ${w}%예요`
  const body = w >= CONC_HALF
    ? `한 종목이 절반 넘게 차지하면 그 종목이 흔들릴 때 내 자산 전체가 같이 흔들려요. 여러 종목·나라·자산에 나눠 담는 것을 '분산'이라고 해요. 몇 종목이 맞는지는 정답이 없고, 사라는 뜻도 팔라는 뜻도 아니에요.`
    : w >= CONC_BIG
    ? `한 종목이 30%를 넘으면 그 종목의 오르내림이 내 자산에 크게 보여요. 여러 종목·나라·자산에 나눠 담는 것을 '분산'이라고 해요. 몇 종목이 맞는지는 정답이 없고, 사라는 뜻도 팔라는 뜻도 아니에요.`
    : `가장 큰 종목도 30%가 안 돼서 여러 곳에 나눠 있어요. 나눠 담으면 한 종목이 크게 내려도 전체는 덜 흔들려요 — 대신 한 종목이 크게 올라도 전체는 덜 올라요.`
  return { kind: 'concentration', title, body, source: `내 자산 ${n}종목 · 지금 평가액 기준`, ticker: top.ticker, market: top.market }
}

/** ④ 환율 효과 — 달러 종목 전체의 '원화 수익률 − 달러 수익률'(%p). 달러 종목이 없으면 없음. 예측이 아니라 지난 일만 */
function fxTip(inputs: TipInputs): Tip | null {
  const f = inputs.fx
  if (!f || !(f.count > 0) || !isNum(f.retUsd) || !isNum(f.retKrw) || !isNum(f.fxNow) || f.fxNow <= 0) return null
  const eff = Math.round((f.retKrw - f.retUsd) * 10) / 10
  const flat = Math.abs(eff) < FLAT
  const abs = Math.abs(eff).toFixed(1)
  const title = flat ? '환율은 내 달러 종목 수익률을 거의 안 움직였어요'
    : `환율이 내 달러 종목 수익률을 ${abs}%p ${eff > 0 ? '올렸어요' : '깎았어요'}`
  const exp = isNum(f.exposurePct) && f.exposurePct > 0 ? ` 내 자산의 ${Math.round(f.exposurePct)}%가 환율에 노출돼 있어요.` : ''
  const body = flat
    ? `달러로 보면 ${pct(f.retUsd)}, 원화로 바꾸면 ${pct(f.retKrw)}예요 — 거의 같아요. 산 날과 지금 원·달러 환율이 비슷해서예요.${exp}`
    : `달러로 보면 ${pct(f.retUsd)}, 원화로 바꾸면 ${pct(f.retKrw)}예요 — 그 차이가 환율 효과예요. 산 날보다 원·달러가 ${eff > 0 ? '올라서(달러가 비싸져서)' : '내려서(달러가 싸져서)'} 생긴 차이예요.${exp} 환율은 맞힐 수 없어서 지난 일만 봤어요.`
  return { kind: 'fx', title, body, source: `내 달러 종목 ${f.count}종 · 매입일 환율 대비 지금 ${fxWon(f.fxNow)}`, tone: toneOf(eff) }
}

/** ⑤ 코어·위성 — 기록할 때 정한 역할의 비중. 비율의 정답은 말하지 않고 '최일 전략' 수업으로 넘긴다 */
function coreSatTip(inputs: TipInputs): Tip | null {
  const c = inputs.coreSat
  if (!c || !isNum(c.corePct) || !isNum(c.satPct) || c.coreCount + c.satCount <= 0) return null
  const core = Math.round(c.corePct), sat = Math.round(c.satPct)
  const title = sat === 0 ? `내 자산은 전부 코어(${c.coreCount}종목)예요`
    : core === 0 ? `내 자산은 전부 위성(${c.satCount}종목)이에요`
    : `내 자산은 코어 ${core}% · 위성 ${sat}%예요`
  const tail = core === 0 ? '코어가 없으면 자산 전체가 위성처럼 크게 흔들릴 수 있어요.'
    : sat === 0 ? '위성이 없으면 크게 흔들리진 않지만, 크게 오를 기회도 그만큼 적어요.'
    : "두 쪽을 어떤 비율로 둘지는 '최일 전략' 수업의 코어·위성 원칙을 보세요."
  return {
    kind: 'coreSat', title,
    body: `코어는 오래 들고 갈 큰 회사·지수 ETF, 위성은 더 크게 오르내릴 수 있는 종목이에요. 어느 쪽인지는 기록할 때 내가 정한 거예요. ${tail}`,
    source: '내 자산 · 기록할 때 정한 코어/위성 · 지금 평가액 기준',
  }
}

/**
 * 오늘 규칙을 시도하는 순서 — RULES[(날 수 mod 5)] 부터 한 바퀴. pickTip 이 이 순서로 돈다.
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
 * 시작 규칙 = RULES[(날 수 mod 5)] 에서 시작해 입력이 없는 규칙은 건너뛴다. 전부 없으면 null(화면이 '오늘은 알려드릴 게 없어요'를 말한다).
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
      : kind === 'concentration' ? concentrationTip(inputs)
      : kind === 'fx' ? fxTip(inputs)
      : coreSatTip(inputs)
    if (tip) return tip
  }
  return null
}
