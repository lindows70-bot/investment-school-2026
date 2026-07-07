// 모멘텀 지표 계산 SSOT — MACD(12·26·9)·RSI(14 Wilder)·스토캐스틱(14·3)·CCI(20)
// TechnicalChartPro(서브패널 렌더링)와 tech-chart 페이지(신호 판독기)가 동일 계산 공유(제2원칙).
// 순수 함수·클라이언트 안전. 기술적 신호는 기술차트 화면 전용(추천·리밸런싱 점수 미반영 원칙).

export interface Ohlc { open: number; high: number; low: number; close: number }

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
  }
}
