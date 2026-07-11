// 모멘텀 지표 계산 SSOT — MACD(12·26·9)·RSI(14 Wilder)·스토캐스틱(14·3)·CCI(20)
// TechnicalChartPro(서브패널 렌더링)와 tech-chart 페이지(신호 판독기)가 동일 계산 공유(제2원칙).
// 순수 함수·클라이언트 안전. 기술적 신호는 기술차트 화면 전용(추천·리밸런싱 점수 미반영 원칙).

export interface Ohlc { open: number; high: number; low: number; close: number; volume?: number }

const emaArr = (src: (number | null)[], period: number): (number | null)[] => {
  const k = 2 / (period + 1)
  const out: (number | null)[] = new Array(src.length).fill(null)
  let prev: number | null = null
  const seed: number[] = []
  for (let i = 0; i < src.length; i++) {
    const v = src[i]
    if (v == null) continue
    if (prev == null) {
      seed.push(v)
      if (seed.length === period) { prev = seed.reduce((a, b) => a + b, 0) / period; out[i] = prev }
    } else { prev = v * k + prev * (1 - k); out[i] = prev }
  }
  return out
}

/** MACD(12·26·9) — macd선·시그널선·히스토그램 */
export function calcMACD(close: number[]): { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const e12 = emaArr(close, 12), e26 = emaArr(close, 26)
  const macd = close.map((_, i) => e12[i] != null && e26[i] != null ? (e12[i] as number) - (e26[i] as number) : null)
  const signal = emaArr(macd, 9)
  const hist = macd.map((m, i) => m != null && signal[i] != null ? m - (signal[i] as number) : null)
  return { macd, signal, hist }
}

/** RSI(14) — Wilder 평활 */
export function calcRSI(close: number[], period = 14): (number | null)[] {
  const N = close.length
  const out: (number | null)[] = new Array(N).fill(null)
  if (N < period + 1) return out
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) {
    const d = close[i] - close[i - 1]
    if (d > 0) gain += d; else loss -= d
  }
  let aG = gain / period, aL = loss / period
  out[period] = aL === 0 ? 100 : 100 - 100 / (1 + aG / aL)
  for (let i = period + 1; i < N; i++) {
    const d = close[i] - close[i - 1]
    aG = (aG * (period - 1) + Math.max(d, 0)) / period
    aL = (aL * (period - 1) + Math.max(-d, 0)) / period
    out[i] = aL === 0 ? 100 : 100 - 100 / (1 + aG / aL)
  }
  return out
}

/** 스토캐스틱(14·3) — %K(3평활)·%D */
export function calcStoch(data: Ohlc[], period = 14, smooth = 3): { k: (number | null)[]; d: (number | null)[] } {
  const N = data.length
  const rawK: (number | null)[] = new Array(N).fill(null)
  for (let i = period - 1; i < N; i++) {
    let hi = -Infinity, lo = Infinity
    for (let j = i - period + 1; j <= i; j++) { if (data[j].high > hi) hi = data[j].high; if (data[j].low < lo) lo = data[j].low }
    rawK[i] = hi === lo ? 50 : ((data[i].close - lo) / (hi - lo)) * 100
  }
  const sma = (src: (number | null)[], p: number): (number | null)[] => src.map((_, i) => {
    if (i < p - 1) return null
    let s = 0
    for (let j = i - p + 1; j <= i; j++) { const v = src[j]; if (v == null) return null; s += v }
    return s / p
  })
  const k = sma(rawK, smooth)
  return { k, d: sma(k, smooth) }
}

/** CCI(20) — (TP − SMA(TP)) / (0.015 × 평균편차) */
export function calcCCI(data: Ohlc[], period = 20): (number | null)[] {
  const N = data.length
  const tp = data.map(d => (d.high + d.low + d.close) / 3)
  const out: (number | null)[] = new Array(N).fill(null)
  for (let i = period - 1; i < N; i++) {
    let s = 0
    for (let j = i - period + 1; j <= i; j++) s += tp[j]
    const m = s / period
    let dev = 0
    for (let j = i - period + 1; j <= i; j++) dev += Math.abs(tp[j] - m)
    dev /= period
    out[i] = dev === 0 ? 0 : (tp[i] - m) / (0.015 * dev)
  }
  return out
}

/** MFI(14) — 거래량 가중 RSI(돈의 흐름). 거래량 없으면 null(무늬만 반등 필터) */
export function calcMFI(data: Ohlc[], period = 14): (number | null)[] {
  const N = data.length
  const out: (number | null)[] = new Array(N).fill(null)
  if (N < period + 1) return out
  if (!data.some(d => (d.volume ?? 0) > 0)) return out   // 거래량 데이터 없음 → 정직하게 null
  const tp = data.map(d => (d.high + d.low + d.close) / 3)
  for (let i = period; i < N; i++) {
    let pos = 0, neg = 0
    for (let j = i - period + 1; j <= i; j++) {
      const mf = tp[j] * (data[j].volume ?? 0)
      if (tp[j] > tp[j - 1]) pos += mf
      else if (tp[j] < tp[j - 1]) neg += mf
    }
    out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg)
  }
  return out
}

/** ATR(14) — 평균 실측 변동폭(Wilder). 갭 포함 참변동성 → 종목 고유 손절폭 산출용 */
export function calcATR(data: Ohlc[], period = 14): (number | null)[] {
  const N = data.length
  const out: (number | null)[] = new Array(N).fill(null)
  if (N < period + 1) return out
  const tr: number[] = new Array(N).fill(0)
  for (let i = 1; i < N; i++)
    tr[i] = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close))
  let atr = 0
  for (let i = 1; i <= period; i++) atr += tr[i]
  atr /= period
  out[period] = atr
  for (let i = period + 1; i < N; i++) { atr = (atr * (period - 1) + tr[i]) / period; out[i] = atr }
  return out
}

/** ADX(14) — 추세 강도(방향 무관). <20=박스권(오실레이터 휩쏘 위험) / ≥25=추세장 */
export function calcADX(data: Ohlc[], period = 14): (number | null)[] {
  const N = data.length
  const out: (number | null)[] = new Array(N).fill(null)
  if (N < period * 2 + 1) return out
  const tr: number[] = new Array(N).fill(0), pDM: number[] = new Array(N).fill(0), mDM: number[] = new Array(N).fill(0)
  for (let i = 1; i < N; i++) {
    tr[i] = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close))
    const up = data[i].high - data[i - 1].high, dn = data[i - 1].low - data[i].low
    if (up > dn && up > 0) pDM[i] = up
    if (dn > up && dn > 0) mDM[i] = dn
  }
  // Wilder 평활
  let sTR = 0, sP = 0, sM = 0
  for (let i = 1; i <= period; i++) { sTR += tr[i]; sP += pDM[i]; sM += mDM[i] }
  const dx: number[] = new Array(N).fill(0)
  const dxNow = () => {
    const pDI = sTR === 0 ? 0 : 100 * sP / sTR, mDI = sTR === 0 ? 0 : 100 * sM / sTR
    const sum = pDI + mDI
    return sum === 0 ? 0 : 100 * Math.abs(pDI - mDI) / sum
  }
  dx[period] = dxNow()
  for (let i = period + 1; i < N; i++) {
    sTR = sTR - sTR / period + tr[i]; sP = sP - sP / period + pDM[i]; sM = sM - sM / period + mDM[i]
    dx[i] = dxNow()
  }
  let adx = 0
  for (let i = period; i < period * 2; i++) adx += dx[i]
  adx /= period
  out[period * 2 - 1] = adx
  for (let i = period * 2; i < N; i++) { adx = (adx * (period - 1) + dx[i]) / period; out[i] = adx }
  return out
}

/* ── 교과서 신호 판독(결정론) — 최근 LOOK봉 내 크로스/구간 이벤트 ── */
export interface TechRead {
  macdCross: { type: 'golden' | 'dead'; barsAgo: number } | null   // MACD↔시그널 교차
  macdAbove: boolean | null                                        // 현재 MACD > 시그널
  rsi: number | null
  rsiZone: 'oversold' | 'overbought' | 'neutral' | null            // <30 / >70
  rsiCross30: number | null                                        // 30 상향돌파 barsAgo
  rsiCross70: number | null                                        // 70 하향이탈 barsAgo
  stochCross: { type: 'golden' | 'dead'; barsAgo: number; zone: 'low' | 'high' | 'mid' } | null
  cci: number | null
  cciCross100: { type: 'up' | 'down'; barsAgo: number } | null
  mfi: number | null    // 자금흐름지수(거래량 가중) — <20 소외 / >80 과열, RSI와 괴리 시 '무늬만 반등'
  adx: number | null    // 추세 강도 — <20 박스권(휩쏘) / ≥25 추세장
  atr: number | null    // 평균 실측 변동폭 — 손절 참고선(현재가 − 2×ATR) 산출용
}

export function readSignals(data: Ohlc[], look = 5): TechRead {
  const close = data.map(d => d.close)
  const { macd, signal } = calcMACD(close)
  const rsiA = calcRSI(close)
  const { k, d } = calcStoch(data)
  const cciA = calcCCI(data)
  const N = data.length
  const last = <T,>(a: T[]): T => a[N - 1]

  const findCross = (a: (number | null)[], b: (number | null)[]): { type: 'golden' | 'dead'; barsAgo: number } | null => {
    for (let ago = 0; ago < look; ago++) {
      const i = N - 1 - ago
      if (i < 1) break
      const a0 = a[i - 1], b0 = b[i - 1], a1 = a[i], b1 = b[i]
      if (a0 == null || b0 == null || a1 == null || b1 == null) continue
      if (a0 <= b0 && a1 > b1) return { type: 'golden', barsAgo: ago }
      if (a0 >= b0 && a1 < b1) return { type: 'dead', barsAgo: ago }
    }
    return null
  }
  const findLevelCross = (a: (number | null)[], level: number, dir: 'up' | 'down'): number | null => {
    for (let ago = 0; ago < look; ago++) {
      const i = N - 1 - ago
      if (i < 1) break
      const p = a[i - 1], c = a[i]
      if (p == null || c == null) continue
      if (dir === 'up' && p <= level && c > level) return ago
      if (dir === 'down' && p >= level && c < level) return ago
    }
    return null
  }

  const rsiNow = last(rsiA)
  const stochC = findCross(k, d)
  const kNow = last(k)
  const cciNow = last(cciA)
  const cciUp = findLevelCross(cciA, 100, 'up'), cciDn = findLevelCross(cciA, 100, 'down')
  const mfiNow = last(calcMFI(data))
  const adxNow = last(calcADX(data))
  const atrNow = last(calcATR(data))

  return {
    macdCross: findCross(macd, signal),
    macdAbove: last(macd) != null && last(signal) != null ? (last(macd) as number) > (last(signal) as number) : null,
    rsi: rsiNow != null ? Math.round(rsiNow * 10) / 10 : null,
    rsiZone: rsiNow == null ? null : rsiNow < 30 ? 'oversold' : rsiNow > 70 ? 'overbought' : 'neutral',
    rsiCross30: findLevelCross(rsiA, 30, 'up'),
    rsiCross70: findLevelCross(rsiA, 70, 'down'),
    stochCross: stochC ? { ...stochC, zone: kNow == null ? 'mid' : kNow < 20 ? 'low' : kNow > 80 ? 'high' : 'mid' } : null,
    cci: cciNow != null ? Math.round(cciNow) : null,
    cciCross100: cciUp != null ? { type: 'up', barsAgo: cciUp } : cciDn != null ? { type: 'down', barsAgo: cciDn } : null,
    mfi: mfiNow != null ? Math.round(mfiNow * 10) / 10 : null,
    adx: adxNow != null ? Math.round(adxNow * 10) / 10 : null,
    atr: atrNow != null ? Math.round(atrNow * 100) / 100 : null,
  }
}

/* ── 🎼 린다 라쉬케式 3박자 판독(결정론) — MACD(방향)×RSI(에너지)×거래량(연료)의 시너지.
   핵심 규칙(영상 분석 기반): ① MACD 영선(0) 아래 바닥권 골든크로스 → 영선 강한 돌파 = 추세 전환 확정
   ② RSI는 30/70이 아니라 '50선 돌파'가 에너지 우위의 신호 ③ 신호 봉에 평균 1.5배+ 거래량 동반 시 진짜.
   연쇄: CCI(선행 신호탄, −100 탈출) → RSI 50 돌파 → MACD 영선 돌파 → '첫 번째 눌림목'이 최적 진입.
   매도: 하락 다이버전스(가격 고점↑ vs RSI 고점↓) 또는 데드크로스+RSI 70 하향이탈.
   ⛔ 점수·추천 미반영(기술차트 화면 전용) · 전부 결정론(주관 0) · 홀리그레일의 ADX 필터는 기존 adx 재사용. ── */
export interface RaschkeRead {
  // 매수 3박자
  macdGoldenBelowZero: number | null   // 영선 아래에서 골든크로스 발생(barsAgo, 최근 15봉)
  macdZeroBreak: number | null         // MACD 영선 상향 돌파(barsAgo, 최근 15봉)
  macdAboveZero: boolean               // 현재 MACD > 0
  histRising: boolean                  // 히스토그램 최근 3봉 연속 확대(에너지 증가)
  rsi50Break: number | null            // RSI 50 상향 돌파(barsAgo, 최근 10봉)
  rsiAbove50: boolean | null           // 현재 RSI > 50(매수세 장악)
  volBoost: boolean | null             // 최근 매수신호 봉 거래량 ≥ 1.5×20봉 평균(null=거래량 데이터 없음)
  buyCount: number                     // 3박자 충족 수(0~3): MACD방향·RSI에너지·거래량
  // 연쇄 단계: 0=대기 / 1=CCI 신호탄 / 2=RSI 50 돌파 / 3=MACD 영선 돌파 / 4=첫 눌림목(최적 타점)
  stage: 0 | 1 | 2 | 3 | 4
  cciSignal: number | null             // CCI −100 상향 탈출(barsAgo, 최근 15봉) — 선행 신호탄
  pullback: boolean                    // 영선 돌파 후 첫 눌림목(추세 확립: MACD>0·RSI>50 + 히스토 2봉 축소 + 고점 대비 2~8% 되돌림)
  pullbackPct: number | null           // 눌림목의 10봉 고점 대비 되돌림 %(양수)
  parabolicRun: boolean                // 직전 상승이 급등(수직) — 첫 눌림목이 함정일 수 있음(EMA20 대비 25%+ 이격 이력)
  // 매도 신호
  bearDivergence: { priceHi: number; prevHi: number; rsiAtHi: number; rsiAtPrev: number } | null   // 하락 다이버전스
  exitCross: boolean                   // MACD 데드크로스 + RSI 70 하향이탈 동시(최근 5봉)
}

export function readRaschke(data: Ohlc[]): RaschkeRead | null {
  const N = data.length
  if (N < 60) return null
  const close = data.map(d => d.close)
  const { macd, signal, hist } = calcMACD(close)
  const rsiA = calcRSI(close)
  const cciA = calcCCI(data)

  const levelUp =(a: (number | null)[], level: number, look: number): number | null => {
    for (let ago = 0; ago < look; ago++) {
      const i = N - 1 - ago
      if (i < 1) break
      const p = a[i - 1], c = a[i]
      if (p == null || c == null) continue
      if (p <= level && c > level) return ago
    }
    return null
  }
  const levelDn = (a: (number | null)[], level: number, look: number): number | null => {
    for (let ago = 0; ago < look; ago++) {
      const i = N - 1 - ago
      if (i < 1) break
      const p = a[i - 1], c = a[i]
      if (p == null || c == null) continue
      if (p >= level && c < level) return ago
    }
    return null
  }

  // ① MACD 방향: 영선 아래 골든크로스(바닥권 전환 시도) → 영선 돌파(추세 확정)
  let goldenBelowZero: number | null = null
  for (let ago = 0; ago < 15; ago++) {
    const i = N - 1 - ago
    if (i < 1) break
    const m0 = macd[i - 1], s0 = signal[i - 1], m1 = macd[i], s1 = signal[i]
    if (m0 == null || s0 == null || m1 == null || s1 == null) continue
    if (m0 <= s0 && m1 > s1 && m1 < 0) { goldenBelowZero = ago; break }   // 골든크로스가 영선 아래에서
  }
  const zeroBreak = levelUp(macd, 0, 15)
  const macdNow = macd[N - 1], histNow = hist[N - 1]
  const macdAboveZero = macdNow != null && macdNow > 0
  const histRising = hist[N - 1] != null && hist[N - 2] != null && hist[N - 3] != null &&
    (hist[N - 1] as number) > (hist[N - 2] as number) && (hist[N - 2] as number) > (hist[N - 3] as number)

  // ② RSI 에너지: 50선 돌파(30/70보다 중요 — 매수세 장악 신호)
  const rsi50Break = levelUp(rsiA, 50, 10)
  const rsiNow = rsiA[N - 1]
  const rsiAbove50 = rsiNow != null ? rsiNow > 50 : null

  // ③ 거래량: 가장 최근 매수신호 봉의 거래량 ≥ 1.5×20봉 평균
  const hasVol = data.some(d => (d.volume ?? 0) > 0)
  let volBoost: boolean | null = null
  if (hasVol) {
    const sigAgo = [goldenBelowZero, zeroBreak, rsi50Break].filter((x): x is number => x != null)
    if (sigAgo.length) {
      const i = N - 1 - Math.min(...sigAgo)
      let s = 0, n = 0
      for (let j = Math.max(0, i - 20); j < i; j++) { s += data[j].volume ?? 0; n++ }
      volBoost = n > 0 && (data[i].volume ?? 0) > (s / n) * 1.5
    } else volBoost = false
  }

  // 연쇄 단계 판정(CCI → RSI 50 → MACD 영선 → 첫 눌림목)
  const cciSignal = levelUp(cciA, -100, 15)   // 바닥권(−100 아래) 탈출 = 선행 신호탄
  // 첫 눌림목: 추세 확립(영선 돌파 20봉 이력 + MACD>0 + RSI>50 = 에너지 유지) + 히스토 2봉 축소(숨 고르기) + 10봉 고점 대비 2~8% 되돌림
  // ⚠️ RSI>50 게이트 필수 — 눌림목에 RSI가 50 아래로 빠지면 '에너지 소진'이라 라쉬케 진입 자리 아님(3박자와의 0/3 모순 해소의 핵심)
  let pullback = false
  let pullbackPct: number | null = null
  const zeroBreak20 = levelUp(macd, 0, 20)
  if (zeroBreak20 != null && macdAboveZero && rsiAbove50 === true && histNow != null &&
      hist[N - 2] != null && hist[N - 3] != null &&
      (hist[N - 1] as number) < (hist[N - 2] as number) && (hist[N - 2] as number) < (hist[N - 3] as number)) {
    let hi10 = -Infinity
    for (let j = N - 10; j < N; j++) if (data[j].high > hi10) hi10 = data[j].high
    const dd = (hi10 - close[N - 1]) / hi10
    pullback = dd >= 0.02 && dd <= 0.08
    if (pullback) pullbackPct = Math.round(dd * 1000) / 10
  }
  // 급등(수직) 감지: 직전 30봉 내 종가가 EMA20 대비 25%+ 이격된 적이 있으면 '첫 눌림목도 함정' 경고(홀리그레일은 '건강한 추세' 전제)
  const ema20 = emaArr(close, 20)
  let parabolicRun = false
  for (let j = Math.max(20, N - 30); j < N; j++) {
    const e = ema20[j]
    if (e != null && (close[j] - e) / e > 0.25) { parabolicRun = true; break }
  }
  const stage: RaschkeRead['stage'] =
    pullback ? 4
    : (zeroBreak != null && macdAboveZero) ? 3
    : (rsi50Break != null && rsiAbove50 === true) ? 2
    : cciSignal != null ? 1
    : 0

  // 매수 3박자 충족 수
  const macdOk = (goldenBelowZero != null || zeroBreak != null) && (histRising || macdAboveZero)
  const rsiOk = rsiAbove50 === true && rsi50Break != null
  const buyCount = (macdOk ? 1 : 0) + (rsiOk ? 1 : 0) + (volBoost === true ? 1 : 0)

  // 매도 ①: 하락 다이버전스 — 최근 60봉 스윙 고점(좌우 5봉) 2개 비교: 가격 고점↑ & RSI 고점↓
  let bearDivergence: RaschkeRead['bearDivergence'] = null
  const pivots: number[] = []
  for (let i = Math.max(5, N - 60); i < N - 5; i++) {
    let isHigh = true
    for (let j = i - 5; j <= i + 5; j++) { if (j !== i && data[j].high > data[i].high) { isHigh = false; break } }
    if (isHigh) pivots.push(i)
  }
  if (pivots.length >= 2) {
    const p1 = pivots[pivots.length - 2], p2 = pivots[pivots.length - 1]
    const r1 = rsiA[p1], r2 = rsiA[p2]
    if (r1 != null && r2 != null && data[p2].high > data[p1].high && r2 < r1 - 2 && r1 > 60)
      bearDivergence = { priceHi: data[p2].high, prevHi: data[p1].high, rsiAtHi: Math.round(r2 * 10) / 10, rsiAtPrev: Math.round(r1 * 10) / 10 }
  }
  // 매도 ②: MACD 데드크로스 + RSI 70 하향이탈 동시(각 최근 5봉)
  const deadAgo = (() => {
    for (let ago = 0; ago < 5; ago++) {
      const i = N - 1 - ago
      if (i < 1) break
      const m0 = macd[i - 1], s0 = signal[i - 1], m1 = macd[i], s1 = signal[i]
      if (m0 == null || s0 == null || m1 == null || s1 == null) continue
      if (m0 >= s0 && m1 < s1) return ago
    }
    return null
  })()
  const exitCross = deadAgo != null && levelDn(rsiA, 70, 5) != null

  return {
    macdGoldenBelowZero: goldenBelowZero, macdZeroBreak: zeroBreak, macdAboveZero, histRising,
    rsi50Break, rsiAbove50, volBoost, buyCount, stage, cciSignal, pullback, pullbackPct, parabolicRun, bearDivergence, exitCross,
  }
}

/* ── 💧 유동성 풀·스윕 탐지(결정론) — "전 고점·전 저점 = 손절 주문이 몰린 유동성"이라는 SMC 개념의 객관 버전.
   스윙 피벗(좌우 pivot봉 대비 극값)으로 유동성 레벨을 잡고,
   · 매도측(전저점) 스윕 = 꼬리(low)가 레벨을 관통했는데 종가는 위에서 마감(개미 털기 후 회복)
   · 매수측(전고점) 스윕 = 고가가 레벨을 관통했는데 종가는 아래(위꼬리 유인)
   종가가 레벨을 넘겨 마감하면 레벨 소멸(진짜 돌파/붕괴 — 스윕 아님). 거래량 델타는 무료 데이터 부재 → 거래량 1.5×평균 급증 여부로 근사(volBoost).
   차트 오버레이·신호 판독기 공유 SSOT. 점수·추천 미반영(교육·차트 전용). ── */
export interface LiqLevel {
  idx: number            // 스윙 피벗 봉 인덱스
  price: number          // 레벨 가격(스윙 low/high)
  type: 'low' | 'high'   // low=매도측 유동성(전저점) / high=매수측(전고점)
  endIdx: number | null  // 레벨 소멸 봉(스윕 or 종가 돌파). null=아직 살아있음
  swept: boolean         // 스윕으로 소멸했는가(true) vs 종가 돌파로 소멸(false)
  volBoost: boolean      // 스윕 봉 거래량이 20봉 평균의 1.5배 이상
}
export function detectLiquidity(data: Ohlc[], pivot = 5): LiqLevel[] {
  const N = data.length
  if (N < pivot * 2 + 10) return []
  const vol20 = (i: number) => {
    let s = 0, n = 0
    for (let j = Math.max(0, i - 20); j < i; j++) { s += data[j].volume ?? 0; n++ }
    return n ? s / n : 0
  }
  const levels: LiqLevel[] = []
  // 피벗 확정(idx+pivot 봉에서 확정) → 이후 봉을 순회하며 스윕/소멸 판정
  for (let i = pivot; i < N - pivot; i++) {
    const isLow = data.slice(i - pivot, i + pivot + 1).every((d, k) => k === pivot || d.low >= data[i].low)
    const isHigh = data.slice(i - pivot, i + pivot + 1).every((d, k) => k === pivot || d.high <= data[i].high)
    if (isLow) levels.push({ idx: i, price: data[i].low, type: 'low', endIdx: null, swept: false, volBoost: false })
    if (isHigh) levels.push({ idx: i, price: data[i].high, type: 'high', endIdx: null, swept: false, volBoost: false })
  }
  for (const lv of levels) {
    for (let k = lv.idx + pivot + 1; k < N; k++) {
      const d = data[k]
      if (lv.type === 'low') {
        if (d.close < lv.price) { lv.endIdx = k; break }                       // 종가 붕괴 — 스윕 아님
        if (d.low < lv.price && d.close > lv.price) {                          // 💧 꼬리 관통 + 종가 회복 = 스윕
          lv.endIdx = k; lv.swept = true
          lv.volBoost = (d.volume ?? 0) > vol20(k) * 1.5
          break
        }
      } else {
        if (d.close > lv.price) { lv.endIdx = k; break }                       // 종가 돌파 — 스윕 아님
        if (d.high > lv.price && d.close < lv.price) {                         // 위꼬리 유인 스윕
          lv.endIdx = k; lv.swept = true
          lv.volBoost = (d.volume ?? 0) > vol20(k) * 1.5
          break
        }
      }
    }
  }
  return levels
}
