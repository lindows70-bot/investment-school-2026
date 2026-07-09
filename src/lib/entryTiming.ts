// 🚦 타점 신호등 SSOT — "WHAT은 펀더멘탈, WHEN은 기술" 분리 레이어.
// EMA112·224 정배열 + 일목 구름 위치 + ATR 손절선을 결정론 판정(기술차트 화면과 동일 계산).
// ⛔ 원칙: 추천 '점수·선정·정렬'에는 절대 미반영 — 카드에 배지(정보)로만 표시. 자동매매 없음.
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import { calcATR } from '@/lib/techSignals'

export type TimingLight = 'green' | 'yellow' | 'red'
export interface EntryTiming {
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
  const base = {
    aligned, cloud, atrStop,
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
