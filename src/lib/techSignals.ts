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
