// 🚦 타점 신호등 SSOT — "WHAT은 펀더멘탈, WHEN은 기술" 분리 레이어.
// EMA112·224 정배열 + 일목 구름 위치 + ATR 손절선을 결정론 판정(기술차트 화면과 동일 계산).
// ⛔ 원칙: 추천 '점수·선정·정렬'에는 절대 미반영 — 카드에 배지(정보)로만 표시. 자동매매 없음.
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import { calcATR, calcADX, readRaschke, computeAnchoredVWAP, computePOC, computeTTMSqueeze, detectFVG, readPrimeSetup, type PrimeSetup } from '@/lib/techSignals'

export type TimingLight = 'green' | 'yellow' | 'red'
/** 📊 매물·평단 지지 요약(카드용 lite) — 같은 캔들에서 추가 fetch 0.
 *  신호등(추세)·라쉬케(모멘텀)가 못 보는 '매물/평단' 축: 기관평단(VWAP)·매물대(POC)·되돌림 갭(FVG)·변동성(스퀴즈).
 *  매수=지지 확인+되돌림 매수 존, 매도=과대이격+머리 위 저항 갭. ⛔ 점수·선정 미반영(배지만). */
export interface SupplyLite {
  vwap: number | null; aboveVwap: boolean; vwapDistPct: number | null      // ⚓ 기관 평균단가(앵커 이후 매수자 평단)
  vwapCross: { dir: 'up' | 'down'; barsAgo: number } | null                // ⚓ 최근 12봉 내 평단 회복(up)/이탈(down) — 주도권 교체 후보(맥락·단독 신호 아님)
  poc: number | null; abovePoc: boolean; pocDistPct: number | null          // 📊 매물대 중심선(최대 거래 가격대)
  supportStrong: boolean       // VWAP·POC 둘 다 위 = 지지 탄탄
  supportWeak: boolean         // 둘 다 아래 = 지지 약함
  overExtended: boolean        // 기관평단 대비 +15%↑ 과대이격(되돌림·익절 리스크)
  choppy: boolean; adx: number | null   // ⬛ 관망 = ADX<20 추세 강도 약함(방향 확신 낮음) — 영상 '회색 지대'(돌파도 가짜일 수 있는 자제 구간)
  fvgBuyLo: number | null; fvgBuyHi: number | null; fvgBuyDistPct: number | null   // 현재가 아래 가장 가까운 상승 갭(되돌림 매수 존)
  fvgSellLo: number | null; fvgSellHi: number | null; fvgSellDistPct: number | null // 현재가 위 가장 가까운 하락 갭(저항·익절 타겟)
  squeezeOn: boolean; squeezeFired: 'up' | 'down' | null    // 🔥 TTM 스퀴즈 압축/분출(변동성 돌파 타이밍)
  // 📉 최근 고점 대비 급락 — **신호등(구조)이 못 보는 속도**를 보완한다.
  //    신호등은 EMA112·224·구름으로 '구조'를 보므로 느리다. 1년 급등한 종목이 며칠 만에 20% 빠져도
  //    구조는 아직 정배열·구름 위라 🟢 진입 적기로 남는다(실측 2026-07-29: S-Oil 3거래일 −16.4%인데 🟢).
  //    ⛔ 판정을 뒤집지 않는다 — 구조 판단은 그대로 두고 '지금 들어가면 칼받이일 수 있다'는 맥락만 준다.
  dropFromHigh: number | null   // 최근 20봉 고점 대비 %(음수)
  highBarsAgo: number | null    // 그 고점이 몇 봉 전인가(작을수록 급락)
  sharpDrop: boolean            // 20봉 고점 대비 −12%↓ & 고점이 10봉 이내 = 급락 직후
}
/** 🎼 라쉬케 요약(카드용 lite) — 같은 캔들에서 추가 fetch 0. 매수=연쇄 stage/첫눌림목, 매도=하락 다이버전스 조기경보 */
export interface RaschkeLite {
  stage: 0 | 1 | 2 | 3 | 4        // 0 대기 · 1 CCI 신호탄 · 2 RSI50 돌파 · 3 MACD 영선 · 4 첫 눌림목(최적 타점)
  pullback: boolean               // 첫 눌림목(추세 확립 + 되돌림)
  pullbackPct: number | null
  parabolicRun: boolean           // 급등(수직) 이력 — 첫 눌림목 함정 경고
  bearDiv: boolean                // 하락 다이버전스(신고가권 에너지 소진)
  bullDiv: boolean                // 상승 다이버전스(바닥 반전 후보) — 정예 타점 방아쇠
  divPrevHi: number | null; divPriceHi: number | null; divRsiPrev: number | null; divRsiHi: number | null
}
export interface EntryTiming {
  /** 🏅 정예 타점 — 자체 백테스트(60종목·12,594봉)로 선별한 합류 조건: 정배열+구름 위 × (상승 다이버전스 | 첫 눌림목).
   *  표본 323건·42종목 · 20봉 승률 60.7%(기준 50.1%) · 중위 초과 +3.4%p. ⛔ 점수·선정 미반영(배지·근거 전용) */
  prime: PrimeSetup | null
  light: TimingLight
  label: string          // 배지 문구
  guide: string          // 실행 가이드 한 줄
  aligned: boolean       // EMA112 > EMA224 정배열
  cloud: 'above' | 'in' | 'below'
  atrStop: number | null // 현재가 − 2×ATR(14)
  trendBreak: boolean    // 역배열 + 구름 아래 = 최후 방어선 붕괴(보유 종목 경고용)
  price: number          // 최근 종가(매매 플랜 계산용)
  cloudTop: number       // 현재 봉 위치의 구름 상단(분할 매수 기준선)
  atr: number | null     // ATR(14) 원값
  raschke?: RaschkeLite | null  // 🎼 라쉬케 연쇄/다이버전스(같은 캔들·추가 fetch 0)
  supply?: SupplyLite | null    // 📊 매물·평단 지지(VWAP·POC·FVG·스퀴즈, 같은 캔들·추가 fetch 0)
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
const emaLast = (c: number[], p: number): number | null => {
  if (c.length < p) return null
  const k = 2 / (p + 1)
  let v = avg(c.slice(0, p))
  for (let i = p; i < c.length; i++) v = c[i] * k + v * (1 - k)
  return v
}
const hl = (D: TechCandle[], p: number, i: number): number | null => {
  if (i < p - 1) return null
  let hi = -Infinity, lo = Infinity
  for (let j = i - p + 1; j <= i; j++) { if (D[j].high > hi) hi = D[j].high; if (D[j].low < lo) lo = D[j].low }
  return (hi + lo) / 2
}

/** 일봉 캔들 → 타점 판정(순수 함수). 데이터 부족(신생·ETF 미해석)이면 null — 배지 정직 생략 */
export function timingFromCandles(D: TechCandle[]): EntryTiming | null {
  const N = D.length
  if (N < 224 + 1) return null   // EMA224·구름 모두 필요 — 부족하면 판정 안 함(신규상장 등)
  const c = D.map(x => x.close)
  const e112 = emaLast(c, 112), e224 = emaLast(c, 224)
  if (e112 == null || e224 == null) return null
  const aligned = e112 > e224
  // 현재 봉 위치의 구름 = 26봉 전 선행스팬(기술차트와 동일 정의)
  const src = N - 1 - 26
  const t9 = hl(D, 9, src), k26 = hl(D, 26, src), b52 = hl(D, 52, src)
  if (t9 == null || k26 == null || b52 == null) return null
  const spanA = (t9 + k26) / 2, spanB = b52
  const price = c[N - 1]
  const cloud: EntryTiming['cloud'] = price > Math.max(spanA, spanB) ? 'above' : price < Math.min(spanA, spanB) ? 'below' : 'in'
  const atrArr = calcATR(D)
  const atr = atrArr[atrArr.length - 1]
  const atrStop = atr != null && price - 2 * atr > 0 ? Math.round((price - 2 * atr) * 100) / 100 : null

  const cloudTop = Math.round(Math.max(spanA, spanB) * 100) / 100
  // 🎼 라쉬케(같은 캔들·추가 fetch 0) — lite 요약. 224봉 이상이라 항상 산출 가능
  const rk = readRaschke(D)
  const raschke: RaschkeLite | null = rk ? {
    stage: rk.stage, pullback: rk.pullback, pullbackPct: rk.pullbackPct, parabolicRun: rk.parabolicRun,
    bearDiv: rk.bearDivergence != null, bullDiv: rk.bullDivergence != null,
    divPrevHi: rk.bearDivergence?.prevHi ?? null, divPriceHi: rk.bearDivergence?.priceHi ?? null,
    divRsiPrev: rk.bearDivergence?.rsiAtPrev ?? null, divRsiHi: rk.bearDivergence?.rsiAtHi ?? null,
  } : null
  // 📊 매물·평단(같은 캔들·추가 fetch 0) — VWAP·POC·FVG·스퀴즈·ADX(관망)
  const avwap = computeAnchoredVWAP(D), pocR = computePOC(D), sq = computeTTMSqueeze(D), gaps = detectFVG(D)
  const adxArr = calcADX(D); const adx = adxArr[adxArr.length - 1]
  const bg = gaps.filter(g => g.type === 'bull' && g.hi <= price).sort((a, b) => b.hi - a.hi)[0]   // 현재가 아래 가장 가까운 상승 갭
  const sg = gaps.filter(g => g.type === 'bear' && g.lo >= price).sort((a, b) => a.lo - b.lo)[0]   // 현재가 위 가장 가까운 하락 갭
  const pct = (v: number) => Math.round((v - price) / price * 1000) / 10
  // 📉 최근 20봉 고점 대비 급락 — 느린 구조 지표(EMA·구름)가 못 보는 '속도'를 잡는다
  const win = D.slice(-20)
  const hiIdx = win.reduce((bi, c, i) => (c.close > win[bi].close ? i : bi), 0)
  const hiClose = win[hiIdx]?.close ?? null
  const dropFromHigh = hiClose && hiClose > 0 ? Math.round((price / hiClose - 1) * 1000) / 10 : null
  const highBarsAgo = hiClose != null ? win.length - 1 - hiIdx : null
  const supply: SupplyLite = {
    vwap: avwap?.vwap ?? null, aboveVwap: !!avwap?.above, vwapDistPct: avwap?.distPct ?? null,
    vwapCross: avwap?.cross ?? null,
    poc: pocR?.poc ?? null, abovePoc: !!pocR?.above, pocDistPct: pocR?.distPct ?? null,
    supportStrong: !!(avwap?.above && pocR?.above),
    supportWeak: !!(avwap && !avwap.above && pocR && !pocR.above),
    overExtended: !!(avwap && avwap.distPct >= 15),
    choppy: adx != null && adx < 20, adx: adx != null ? Math.round(adx) : null,
    fvgBuyLo: bg?.lo ?? null, fvgBuyHi: bg?.hi ?? null, fvgBuyDistPct: bg ? pct(bg.hi) : null,
    fvgSellLo: sg?.lo ?? null, fvgSellHi: sg?.hi ?? null, fvgSellDistPct: sg ? pct(sg.lo) : null,
    squeezeOn: !!sq?.on, squeezeFired: sq?.fired ?? null,
    dropFromHigh, highBarsAgo,
    // 지금 진입이 '칼받이'가 되는 경우는 두 가지이고, 둘 다 독립적으로 성립한다 → OR 로 둔다.
    //  ① 속도: 최근 급락(고점 10봉 이내 −12%↓) — 하락 모멘텀이 아직 살아 있다
    //  ② 크기: 창 전체에서 낙폭 자체가 깊음(−20%↓) — 며칠 더 걸렸어도 위험은 같다
    // 임계 근거: 상승 추세의 건강한 되돌림은 통상 5~10%(실측 에퀴노르 −6.6% = 정상 눌림목, 경고 불필요).
    //   ①만 두면 **미래에셋증권 −31.4%(16봉 전 고점)가 빠진다** — 느리게 빠졌다고 안전한 게 아니다.
    sharpDrop: dropFromHigh != null
      && ((dropFromHigh <= -12 && highBarsAgo != null && highBarsAgo <= 10) || dropFromHigh <= -20),
  }
  // 🏅 정예 타점 — 백테스트 검증 합류 조건. 게이트는 신호등 green과 동일 정의(정배열+구름 위)를 그대로 넘긴다
  const prime = readPrimeSetup(D, aligned && cloud === 'above')
  const base = {
    prime, aligned, cloud, atrStop, raschke, supply,
    price: Math.round(price * 100) / 100, cloudTop,
    atr: atr != null ? Math.round(atr * 100) / 100 : null,
  }
  // 🚦 신호등(결정론): 🟢 정배열+구름 위 / 🔴 역배열+구름 아래 / 🟡 그 외(구름 속·눌림·전환기)
  if (aligned && cloud === 'above') return {
    ...base, light: 'green', trendBreak: false,
    label: '🟢 진입 적기', guide: '정배열+구름 위 — 추세·매물대 둘 다 확인, 계획 비중대로 분할 진입',
  }
  if (!aligned && cloud === 'below') return {
    ...base, light: 'red', trendBreak: true,
    label: '🔴 진입 유예', guide: '역배열+구름 아래 — 재무가 좋아도 추세 바닥(기회비용 주의), 반등·돌파 확인까지 관망',
  }
  return {
    ...base, light: 'yellow', trendBreak: false,
    label: cloud === 'in' ? '🟡 매물대 소화 중' : aligned ? '🟡 눌림목·대기' : '🟡 전환 시도',
    guide: '절반만 진입, 나머지는 구름 상단 돌파(매물 소화) 확인 후',
  }
}

/** 단일 종목 타점(일봉 fetch — tech-chart와 캐시 공유) */
export async function getEntryTiming(ticker: string, market: 'KR' | 'US'): Promise<EntryTiming | null> {
  try {
    const candles = await getTechCandles(ticker, market, 'D')
    return timingFromCandles(candles)
  } catch { return null }
}

/** 배치 타점(동시성 제한) — 실패·데이터부족은 null */
export async function getEntryTimings(list: { ticker: string; market: 'KR' | 'US' }[], concurrency = 4): Promise<Map<string, EntryTiming | null>> {
  const out = new Map<string, EntryTiming | null>()
  const queue = [...list]
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) break
      out.set(`${item.ticker}:${item.market}`, await getEntryTiming(item.ticker, item.market))
    }
  }))
  return out
}
