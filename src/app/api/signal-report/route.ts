// 📋 앱 신호 성적표 API — Jarvis 처방전(user_daily_briefings 이력)·타점 워처 전환(signal-history-v1)을
//    실제 주가로 자기 채점(30일 후·현재까지). "이 앱의 신호를 얼마나 믿어야 하나"를 데이터로 — 정직 원칙(가짜 승률 금지).
//    ⚠️ 이벤트 압축: Jarvis는 매일 같은 판정을 재적재(자기상관) → 연속 런의 첫날만 1이벤트(단절 >7일이면 새 이벤트).
//    가격 SSOT = techChartData(480일봉·타이밍 크론이 매일 캐시 워밍 — 추가 부하 ~0). AI 미사용·결정론.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import type { SignalHistEntry } from '@/app/api/cron/timing-watch/route'
import { CORE_HIST_KEY, type CoreHistEntry } from '@/lib/coreReco'   // ⭐ 핵심 추천(3중 통과) 전향적 적립분
import { AXIS_HIST_KEY, AXIS_REENTRY_DAYS, gradeAxes, pickAxisSamples, type AxisHistEntry, type AxisGrade } from '@/lib/axisHistory'   // 📐 축별 성적

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10)

export type SigSrc = 'jarvis' | 'timing' | 'confluence' | 'core'   // confluence = 가치+타이밍 겹침 · core = ⭐핵심 추천(가치 상위×타이밍×위원회 3중 통과, 매수 전용)
export interface SigEvent {
  date: string
  ticker: string
  name: string
  market: 'KR' | 'US'
  src: SigSrc
  kind: 'buy' | 'sell'          // jarvis BUY/SELL → buy/sell
  label: string                 // 타이밍 전환 라벨(진입 적기 돌파 등) / jarvis는 'SELL 판정' 등
  ageDays: number
  entry: number | null          // 이벤트일 이하 최근 종가
  retNow: number | null         // 현재까지 %(경과 7일 미만이면 null — 하루짜리 노이즈 배제)
  ret30: number | null          // +30일 %(30일 이상 익은 이벤트만)
  // 📏 같은 기간 시장(코스피/S&P500) 수익률 — 승률의 기준선. 이게 없으면 "29%는 나쁘다"는 오독을 막을 수 없다.
  //    실측(2026-06~07): 코스피는 30일 후 상승 확률 0%(0/23)·평균 −16.6%. 아무 종목이나 사도 다 물리던 구간이다.
  benchNow: number | null
  bench30: number | null
}
export interface GroupStat {
  src: SigSrc
  kind: 'buy' | 'sell'
  title: string
  n: number                     // 전체 이벤트
  n7: number                    // 경과 7일+ (retNow 채점 대상)
  n30: number                   // 경과 30일+ (ret30 채점 대상)
  winNow: number | null         // 현재까지 적중률 %(buy=상승, sell=하락)
  win30: number | null          // 30일 적중률 %
  avgNow: number | null
  avg30: number | null
  // 📏 기준선 — 같은 기간 시장 평균과, 시장을 이긴 비율(buy=더 오름/sell=더 피함). 적중률만으로는 국면을 못 걷어낸다.
  avgBenchNow: number | null
  winVsNow: number | null       // 시장 대비 승률 %(경과 7일+ 대상)
  best: SigEvent | null         // 신호 관점 최고 사례(buy=최대 상승 / sell=최대 하락)
  worst: SigEvent | null
  recent: SigEvent[]            // 최근 이벤트 최대 10
  // ⚠️ 화면은 recent만 보면 안 된다 — 최근 10건이 전부 경과 7일 미만이면 표가 대시(—)만 남고,
  //    적중 종목 칩도 사라진다(매도 적중 22건인데 칩 2개, 타이밍 매수는 칩 줄 자체가 소멸했다).
  scored: SigEvent[]            // 채점 완료(retNow != null) 이벤트 최신순 최대 12 — 표·칩의 실제 소스
  pendingN: number              // 아직 채점 전(경과 7일 미만) 건수 — 표에 "대기 N건"으로 정직 표기
  // 칩은 '최근 3개'인데 그 3개의 뜻이 축마다 다르다(가치 매수는 적중 4건 중 3개=사실상 전부 /
  // 가치 매도는 22건 중 3개). 건수를 함께 줘야 "왜 몇 개만 보여주나"에 화면이 스스로 답한다.
  hitN: number                  // 채점분 중 적중 건수(전체 기준)
  missN: number                 // 채점분 중 빗나간 건수
}
export interface SignalReportResult {
  asOf: string
  jarvisSince: string | null    // Jarvis 이력 시작일
  timingSince: string | null    // 타이밍 적립 시작일(없으면 null = 적립 중)
  groups: GroupStat[]
  /** 📐 축별 성적 — 6축 중 어느 축이 실제로 맞았나(전향적 적립분·30일 채점). thin=true 면 '적립 중' */
  axisGrades: AxisGrade[]
  axisSince: string | null           // 축 적립 시작일(없으면 null = 아직 한 건도 없음)
  axisPending: number                // 적립됐지만 30일 미경과(=아직 채점 못 함) 종목 수
  axisFirstScoreDate: string | null  // 첫 채점 가능일 — "언제부터 숫자가 보이나"를 화면이 답할 수 있게
  tickers: number
  unscored: number              // ⚠️ 생존편향 방어: 캔들 로드 실패(상폐·거래정지 가능)로 채점 못 한 종목 수 — 승률 분모 투명성
}

// Jarvis 대상은 개별주식(STOCK)만이라 KR = 6자리 숫자 코드로 충분(영숫자 신형 코드는 ETF 전용 — 브리핑에 없음)
const isKr = (t: string) => /^\d{6}$/.test(t)

/** 이벤트일 이하 최근 종가 / null */
const closeAt = (candles: TechCandle[], date: string): number | null => {
  for (let i = candles.length - 1; i >= 0; i--) if (candles[i].date <= date) return candles[i].close
  return null
}

export async function GET(req: Request) {
  const today = kstDate()
  // 🔬 full=1 — scored 12건 캡 없이 전 이벤트 반환(시뮬레이션·감사용. 화면은 캡 유지)
  const full = new URL(req.url).searchParams.get('full') === '1'
  // ⚠️ 응답 '내용'(제목·라벨 문자열)만 바뀌어도 키를 올려야 한다 — 스키마가 같으면 커밋 훅이 못 잡는다(v6에서 실제로 겪음).
  const cacheKey = `signal-report-v13:${today}${full ? ':full' : ''}`   // v13: 📐 축 표본 재적립(30일 간격)+진입 시점 수(cohorts) — 스키마 확장이라 옛 응답이면 undefined / v12: 📐 축 적립 대기 건수·첫 채점일 노출 / v11: 📐 축별 성적(axisGrades) 추가 — 필드가 늘어도 옛 응답이면 undefined 로 와서 화면이 빈다 / v10: 🌟 핵심 추천(core) 그룹 — 3중 통과 전향적 적립분 채점 / v9: hitN/missN / v8: scored·pendingN / v7: 라벨 / v6: 📏 기준선 / v5: 런 압축 / v4: ⭐그룹
  const cached = await getCache<SignalReportResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ── ① Jarvis 이력 → 이벤트 압축 ──
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  // ⚠️ Supabase select 기본 1,000행 상한 — 브리핑은 사용자×일×종목이라 이미 1,456행(검증이 발견: 7월 신호 통째 절단)
  //    → range 페이지네이션(안정 정렬 위해 id 보조 정렬 필수 — 동일 base_date 행이 페이지 경계에서 중복/누락 방지)
  const rows: { base_date: string; ticker: string; stock_name: string | null; signal_type: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page } = await admin.from('user_daily_briefings')
      .select('base_date,ticker,stock_name,signal_type')
      .in('signal_type', ['SELL', 'BUY'])
      .order('base_date', { ascending: true }).order('id', { ascending: true })
      .range(from, from + 999)
    if (!page?.length) break
    rows.push(...page)
    if (page.length < 1000) break
  }

  // (base_date,ticker) 디듀프(여러 학생이 같은 종목 보유 — 판정은 동일)
  const daily = new Map<string, { date: string; ticker: string; name: string; type: 'SELL' | 'BUY' }>()
  for (const r of rows ?? []) {
    const date = String(r.base_date).slice(0, 10)
    daily.set(`${date}:${r.ticker}`, { date, ticker: String(r.ticker), name: String(r.stock_name ?? r.ticker), type: r.signal_type as 'SELL' | 'BUY' })
  }
  // 종목별 시계열 → 연속 런 압축(첫날=이벤트, 단절 >7일 또는 판정 변경 시 새 이벤트)
  const byTicker = new Map<string, { date: string; name: string; type: 'SELL' | 'BUY' }[]>()
  for (const d of Array.from(daily.values())) {
    const arr = byTicker.get(d.ticker) ?? []
    arr.push({ date: d.date, name: d.name, type: d.type })
    byTicker.set(d.ticker, arr)
  }
  const jarvisEvents: { date: string; ticker: string; name: string; kind: 'buy' | 'sell' }[] = []
  let jarvisSince: string | null = null
  for (const [ticker, arr] of Array.from(byTicker.entries())) {
    arr.sort((a, b) => a.date.localeCompare(b.date))
    let prevDate: string | null = null, prevType: string | null = null
    for (const d of arr) {
      if (!jarvisSince || d.date < jarvisSince) jarvisSince = d.date
      const isNew = prevType !== d.type || (prevDate != null && dayDiff(prevDate, d.date) > 7)
      if (prevType == null || isNew) jarvisEvents.push({ date: d.date, ticker, name: d.name, kind: d.type === 'SELL' ? 'sell' : 'buy' })
      prevDate = d.date; prevType = d.type
    }
  }

  // ── ② 타이밍 워처 적립 이력 + ⭐ 핵심 추천 적립 이력(별도 스토어 — 섞으면 timing 그룹에 오집계) ──
  const hist = (await getCache<SignalHistEntry[]>('signal-history-v1', 400 * 86400_000)) ?? []
  const timingSince = hist.length ? hist.reduce((m, h) => h.date < m ? h.date : m, hist[0].date) : null
  const coreHist = (await getCache<CoreHistEntry[]>(CORE_HIST_KEY, 400 * 86400_000)) ?? []
  // 📐 축별 성적 — 크론(core-reco)이 매일 적립한 6축 스냅샷. 소급이 역인과로 막혀 있어 전향적 적립만이 유일한 길이다.
  const axisHist = (await getCache<AxisHistEntry[]>(AXIS_HIST_KEY, 400 * 86400_000)) ?? []

  // ── ②-b ⭐ 합류(confluence) — 타점(WHEN) 트리거가 같은 종목·같은 방향의 Jarvis(WHAT) 신호로 뒷받침될 때만 '고신뢰'
  //    "싸고 좋은 회사(가치)"가 "진입/이탈 타이밍(기술)"까지 겹친 자리 = 두 독립 엔진의 합의. 타점일을 기준(행동 시점)으로 채점.
  const CONF_WINDOW = 14   // Jarvis 신호가 타점 −14일~+3일 이내에 같은 방향으로 존재하면 합류(가치는 느려 2주 창이 합리적)
  const confluenceEvents: { date: string; ticker: string; name: string; market: 'KR' | 'US'; kind: 'buy' | 'sell' }[] = []
  // ⚠️ 같은 날짜만 거르면 자기상관이 남는다 — 타점 트리거가 연일 재발화하면(OXY 07-28·07-30·08-01)
  //    같은 Jarvis 런에 3번 합류해 '드물게(귀하게)'를 표방하는 그룹에 같은 통찰이 3표가 된다.
  //    Jarvis 런 압축과 동일 원칙: 종목·방향별로 7일 내 재발화는 첫날 1건으로 압축(오래된 것부터 훑어 첫날을 남긴다).
  const confLast = new Map<string, string>()   // `${ticker}:${kind}` → 마지막 채택 신호일
  for (const h of [...hist].sort((a, b) => a.date.localeCompare(b.date))) {
    const jarvisArr = byTicker.get(h.ticker)
    if (!jarvisArr) continue
    const wantType = h.kind === 'sell' ? 'SELL' : 'BUY'
    const backed = jarvisArr.some(j => { const d = dayDiff(j.date, h.date); return j.type === wantType && d >= -3 && d <= CONF_WINDOW })
    if (!backed) continue
    const runKey = `${h.ticker}:${h.kind}`
    const prev = confLast.get(runKey)
    if (prev && dayDiff(prev, h.date) <= 7) continue
    confLast.set(runKey, h.date)
    confluenceEvents.push({ date: h.date, ticker: h.ticker, name: h.name, market: h.market, kind: h.kind })
  }

  // ── ③ 가격 수집(캔들 SSOT·동시성 4) ──
  const tickers = new Map<string, { ticker: string; market: 'KR' | 'US' }>()
  for (const e of jarvisEvents) tickers.set(e.ticker, { ticker: e.ticker, market: isKr(e.ticker) ? 'KR' : 'US' })
  for (const h of hist) tickers.set(h.ticker, { ticker: h.ticker, market: h.market })
  for (const c of coreHist) tickers.set(c.ticker, { ticker: c.ticker, market: c.market })
  for (const a of axisHist) tickers.set(a.ticker, { ticker: a.ticker, market: a.market })   // 📐 축별 채점 대상
  const candleMap = new Map<string, TechCandle[]>()
  const failedTickers = new Set<string>()   // ⚠️ 생존편향: 캔들 로드 실패(상폐·거래정지 가능) 종목 — 조용히 버리면 최악 결과가 승률에서 빠져 위로 부풀려짐
  const queue = Array.from(tickers.values())
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const it = queue.shift(); if (!it) break
      try {
        const c = await getTechCandles(it.ticker, it.market, 'D')
        if (c?.length) candleMap.set(it.ticker, c); else failedTickers.add(it.ticker)
      } catch { failedTickers.add(it.ticker) }
    }
  }))

  // ── ③-b 📏 기준선(벤치마크) 캔들 — KR은 코스피, US는 S&P500. 둘 다 야후 심볼이라 'US' 경로로 받는다.
  //    ⚠️ 이게 없으면 화면이 거짓말을 한다: 매수 적중률 29%만 보면 나빠 보이지만, 실측상 이 표본 구간(2026-06~07)의
  //    코스피는 30일 후 상승 확률이 0%(0/23)·평균 −16.6%였다. 기준선 없는 승률은 국면을 신호 탓으로 돌린다.
  const benchMap = new Map<'KR' | 'US', TechCandle[]>()
  await Promise.all(([['KR', '^KS11'], ['US', '^GSPC']] as const).map(async ([mk, sym]) => {
    try { const c = await getTechCandles(sym, 'US', 'D'); if (c?.length) benchMap.set(mk, c) } catch { /* 기준선 없으면 null로 정직하게 생략 */ }
  }))

  // ── ④ 채점 ──
  const score = (date: string, ticker: string, name: string, market: 'KR' | 'US', src: SigSrc, kind: 'buy' | 'sell', label: string): SigEvent | null => {
    const candles = candleMap.get(ticker)
    if (!candles?.length) return null
    const entry = closeAt(candles, date)
    if (entry == null || entry <= 0) return null
    const ageDays = dayDiff(date, today)
    const last = candles[candles.length - 1].close
    const retNow = ageDays >= 7 ? Math.round((last / entry - 1) * 1000) / 10 : null
    let ret30: number | null = null
    if (ageDays >= 30) {
      const c30 = closeAt(candles, addDays(date, 30))
      if (c30 != null) ret30 = Math.round((c30 / entry - 1) * 1000) / 10
    }
    // 같은 창(신호일→오늘 / 신호일→+30일)의 시장 수익률
    const bc = benchMap.get(market)
    const b0 = bc ? closeAt(bc, date) : null
    let benchNow: number | null = null, bench30: number | null = null
    if (bc && b0 != null && b0 > 0) {
      if (retNow != null) benchNow = Math.round((bc[bc.length - 1].close / b0 - 1) * 1000) / 10
      if (ret30 != null) { const b30 = closeAt(bc, addDays(date, 30)); if (b30 != null) bench30 = Math.round((b30 / b0 - 1) * 1000) / 10 }
    }
    return { date, ticker, name, market, src, kind, label, ageDays, entry, retNow, ret30, benchNow, bench30 }
  }

  const events: SigEvent[] = []
  for (const e of jarvisEvents) {
    const mkt = tickers.get(e.ticker)!.market
    const ev = score(e.date, e.ticker, e.name, mkt, 'jarvis', e.kind, e.kind === 'sell' ? 'SELL(매도검토) 판정' : 'BUY(매수기회) 판정')
    if (ev) events.push(ev)
  }
  for (const h of hist) {
    const ev = score(h.date, h.ticker, h.name, h.market, 'timing', h.kind, h.label)
    if (ev) events.push(ev)
  }
  for (const c of confluenceEvents) {
    const ev = score(c.date, c.ticker, c.name, c.market, 'confluence', c.kind, '⭐ 가치+타이밍 이중 확인')
    if (ev) events.push(ev)
  }
  // 🌟 핵심 추천 — 크론(core-reco)이 적립한 3중 통과분. 매수 전용(⭐는 매수 후보 개념이라 sell 이 없다)
  for (const c of coreHist) {
    const ev = score(c.date, c.ticker, c.name, c.market, 'core', 'buy', `🌟 3중 통과${c.prime ? '(정예 타점)' : ''}`)
    if (ev) events.push(ev)
  }

  // ── ④-b 📐 축별 성적 — "6축 중 어느 축이 실제로 맞았나". 각 축의 상위 1/3 vs 하위 1/3 30일 수익률 비교.
  //    ⚠️ 30일 경과분만 채점한다(retNow 를 쓰면 최근 적립분이 며칠짜리 노이즈로 결과를 흔든다).
  //    ⚠️ 같은 종목이 여러 날 적립되면 자기상관이 생긴다. 그렇다고 **종목당 1건**만 쓰면 표본이 고유 종목 수에서
  //       멈춘다 — 실측(2026-08-10)에서 적립 이틀째 신규 종목이 0이었다(추천 목록이 안정적이라 같은 35종 반복).
  //       그 상태로 30건을 넘기면 '전부 같은 날 진입'한 표본이 정식 성적으로 나가버린다.
  //       → 채점 창(30일)만큼 벌어진 재등장은 **새 표본**으로 센다(구간이 안 겹쳐 자기상관이 없다).
  const axisRows = pickAxisSamples(axisHist, dayDiff).map(a => {
    const candles = candleMap.get(a.ticker)
    const entry = candles?.length ? closeAt(candles, a.date) : null
    let ret: number | null = null
    if (entry != null && entry > 0 && dayDiff(a.date, today) >= 30) {
      const c30 = closeAt(candles!, addDays(a.date, 30))
      if (c30 != null) ret = Math.round((c30 / entry - 1) * 1000) / 10
    }
    return { axes: a.axes, ret, date: a.date }
  })
  const axisGrades = gradeAxes(axisRows)
  const axisSince = axisHist.length ? axisHist.reduce((m, a) => a.date < m ? a.date : m, axisHist[0].date) : null
  // ⚠️ 채점 n=0 이 '적립 안 됨'인지 '적립됐는데 아직 안 익음'인지 화면이 구분할 수 있어야 한다
  //    (빈 화면은 최소 네 가지 사실 — 입력 없음/로딩/실패/데이터는 왔는데 그릴 게 없음).
  const axisPending = axisRows.filter(r => r.ret == null).length
  // ⚠️ 첫 채점일은 '+30일'이 아니다 — 그날은 표본이 **전부 같은 날 진입**이라 여전히 보류된다(cohorts=1).
  //    두 번째 진입 시점이 생기고(+재적립 30일) 그것마저 익어야(+채점 30일) 비로소 숫자가 나온다.
  //    화면에 +30일을 적어두면 그날 학생이 숫자를 기대했다가 못 본다 — 날짜를 약속했으면 지켜야 한다.
  const axisFirstScoreDate = axisSince ? addDays(axisSince, AXIS_REENTRY_DAYS + 30) : null

  // ── ⑤ 그룹 통계(소스×방향) — buy 승=상승 / sell 승=하락(매도검토 신호는 공매도가 아님·UI 명시) ──
  // ⚠️ '합류'는 학생에게 낯선 말이라 '이중 확인'으로(사용자 지적). '통합'은 이미 통합추천(unified-reco)이 써서 충돌한다.
  const TITLES: Record<string, string> = {
    'core:buy': '🌟 핵심 추천 매수(가치×타이밍×위원회 3중)',
    'confluence:buy': '⭐ 이중 확인 매수(가치+타이밍)', 'confluence:sell': '⭐ 이중 확인 매도(가치+타이밍)',
    'jarvis:sell': '🤖 가치 신호 매도검토(SELL)', 'jarvis:buy': '🤖 가치 신호 매수기회(BUY)',
    'timing:sell': '🚦 타이밍 매도·경계 전환', 'timing:buy': '🚦 타이밍 매수 전환',
  }
  const groups: GroupStat[] = []
  for (const src of ['core', 'confluence', 'jarvis', 'timing'] as SigSrc[]) {
    // 🌟 core 는 매수 전용 — 빈 sell 그룹을 만들면 화면에 '표본 0' 카드만 는다
    for (const kind of (src === 'core' ? ['buy'] : ['sell', 'buy']) as ('sell' | 'buy')[]) {
      const evs = events.filter(e => e.src === src && e.kind === kind).sort((a, b) => b.date.localeCompare(a.date))
      const e7 = evs.filter(e => e.retNow != null)
      const e30 = evs.filter(e => e.ret30 != null)
      const hit = (r: number) => kind === 'buy' ? r > 0 : r < 0
      const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length * 10) / 10 : null
      const sortedBySignal = e7.slice().sort((a, b) => kind === 'buy' ? (b.retNow! - a.retNow!) : (a.retNow! - b.retNow!))
      // 📏 시장 대비 — buy는 시장보다 더 오르면 승, sell은 시장보다 더 떨어지면 승(그만큼 더 피한 손실)
      const eb = e7.filter(e => e.benchNow != null)
      const beat = (e: SigEvent) => kind === 'buy' ? e.retNow! > e.benchNow! : e.retNow! < e.benchNow!
      groups.push({
        src, kind, title: TITLES[`${src}:${kind}`],
        n: evs.length, n7: e7.length, n30: e30.length,
        winNow: e7.length ? Math.round(e7.filter(e => hit(e.retNow!)).length / e7.length * 100) : null,
        win30: e30.length ? Math.round(e30.filter(e => hit(e.ret30!)).length / e30.length * 100) : null,
        avgNow: avg(e7.map(e => e.retNow!)), avg30: avg(e30.map(e => e.ret30!)),
        avgBenchNow: avg(eb.map(e => e.benchNow!)),
        winVsNow: eb.length ? Math.round(eb.filter(beat).length / eb.length * 100) : null,
        best: sortedBySignal[0] ?? null, worst: sortedBySignal[sortedBySignal.length - 1] ?? null,
        recent: evs.slice(0, 10),
        scored: full ? e7 : e7.slice(0, 12), pendingN: evs.length - e7.length,
        hitN: e7.filter(e => hit(e.retNow!)).length, missN: e7.filter(e => !hit(e.retNow!)).length,
      })
    }
  }

  const result: SignalReportResult = { asOf: new Date().toISOString(), jarvisSince, timingSince, groups, axisGrades, axisSince, axisPending, axisFirstScoreDate, tickers: tickers.size, unscored: failedTickers.size }
  // 이벤트 0건(콜드·이력 부재)이면 캐시 박제 금지
  if (events.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
