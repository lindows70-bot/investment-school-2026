// 진짜 월별 손익 시계열 SSOT — 보유 로트 × 일봉 이력으로 월말 평가액을 재구성한다
// ⚠️ 관례: 원가·평가 모두 '그 달 말 환율'로 환산(대시보드 toKrw 와 동일) → 마지막 달 누적 == 대시보드 평가손익
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import { getCache, setCache } from '@/lib/appCache'

export interface PnlLot {
  ticker: string
  market: string            // 'KR' | 'CRYPTO' | 그 외(='US 경로', Yahoo)
  currency: string          // 'KRW' | 'USD'
  purchase_price: number
  quantity: number
  purchase_date: string     // 'YYYY-MM-DD'
}

export interface MonthlyPnlPoint {
  month: string             // 'YYYY-MM'
  label: string             // '26년 5월'
  pnl: number               // 그 달의 손익(원) = cum(M) - cum(M-1)
  cumPnl: number            // 월말 기준 누적 평가손익(원)
  valueKrw: number          // 월말 평가액(원)
  lotCount: number          // 그 달 말 기준 반영된 로트 수
}

export interface MonthlyPnlResult {
  points: MonthlyPnlPoint[]
  /** 캔들을 아예 못 구해 계산에서 빠진 티커 — 조용한 폴백 금지, 화면에 명시한다 */
  skipped: string[]
  asOf: string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 업비트 일봉 — 기존 SSOT(getTechCandles)는 KR|US 뿐이라 크립토만 여기서 수집. 30분 공유 캐시 */
async function cryptoCandles(ticker: string): Promise<TechCandle[]> {
  const key = `crypto-candles-v1:${ticker.toUpperCase()}:${kstDate()}`
  const cached = await getCache<{ candles: TechCandle[] }>(key, 30 * 60_000)
  if (cached?.candles?.length) return cached.candles
  try {
    const r = await fetch(`https://api.upbit.com/v1/candles/days?market=KRW-${ticker.toUpperCase()}&count=200`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const j: { candle_date_time_kst: string; trade_price: number }[] = await r.json()
    if (!Array.isArray(j)) return []
    const candles: TechCandle[] = j
      .map(c => ({ date: c.candle_date_time_kst.slice(0, 10), open: c.trade_price, high: c.trade_price, low: c.trade_price, close: c.trade_price, volume: 0 }))
      .filter(c => isFinite(c.close) && c.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (candles.length >= 10) await setCache(key, { candles })
    return candles
  } catch { return [] }
}

/** 'M월말 이하 가장 최근 종가' — 캔들 date 는 YYYY-MM-DD 라 'YYYY-MM-99' 사전순 비교로 월말을 잡는다 */
function closeAtOrBefore(candles: TechCandle[], dateMax: string): number | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].date <= dateMax) return candles[i].close
  }
  return null
}

/** 순수 계산 — 캔들 맵을 받아 월별 시계열을 만든다(테스트 가능) */
export function buildMonthlySeries(
  lots: PnlLot[],
  candleMap: Map<string, TechCandle[]>,
  fxCandles: TechCandle[],
  nowMonth: string,          // 'YYYY-MM' (KST)
): { points: MonthlyPnlPoint[]; skipped: string[] } {
  const skipped = Array.from(new Set(
    lots.filter(l => !(candleMap.get(l.ticker.toUpperCase())?.length)).map(l => l.ticker.toUpperCase())
  ))
  const usable = lots.filter(l => candleMap.get(l.ticker.toUpperCase())?.length)
  if (!usable.length) return { points: [], skipped }

  // 최초 매수월 ~ 현재월
  const firstMonth = usable.map(l => l.purchase_date.slice(0, 7)).sort()[0]
  const months: string[] = []
  for (let m = firstMonth; m <= nowMonth && months.length < 36;) {
    months.push(m)
    const [y, mo] = m.split('-').map(Number)
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
  }

  const points: MonthlyPnlPoint[] = []
  let prevCum = 0
  for (const m of months) {
    const endMax = `${m}-99`
    const fx = closeAtOrBefore(fxCandles, endMax)
    let value = 0, cum = 0, lotCount = 0
    for (const lot of usable) {
      if (lot.purchase_date.slice(0, 7) > m) continue          // 아직 안 산 로트
      const close = closeAtOrBefore(candleMap.get(lot.ticker.toUpperCase())!, endMax)
      if (close == null) continue                              // 상장 전(SPCX 5월 등)
      const rate = lot.currency === 'USD' ? (fx ?? 0) : 1
      if (!rate) continue                                      // 환율 이력 없으면 USD 로트 제외(조용한 0 환산 금지)
      value += close * lot.quantity * rate
      cum   += (close - lot.purchase_price) * lot.quantity * rate
      lotCount++
    }
    const [y, mo] = m.split('-')
    points.push({
      month: m, label: `${y.slice(2)}년 ${parseInt(mo)}월`,
      pnl: Math.round(cum - prevCum), cumPnl: Math.round(cum),
      valueKrw: Math.round(value), lotCount,
    })
    prevCum = cum
  }
  return { points, skipped }
}

/** 수집 + 계산 오케스트레이션 (라우트에서 호출) */
export async function computeMonthlyPnl(lots: PnlLot[]): Promise<MonthlyPnlResult> {
  const tickers = Array.from(new Set(lots.map(l => l.ticker.toUpperCase())))
  const candleMap = new Map<string, TechCandle[]>()
  // 순차+소배치 — 외부 API 부하 방지(업비트·네이버 rate limit)
  const BATCH = 5
  for (let i = 0; i < tickers.length; i += BATCH) {
    await Promise.all(tickers.slice(i, i + BATCH).map(async t => {
      const lot = lots.find(l => l.ticker.toUpperCase() === t)!
      const candles = lot.market === 'CRYPTO' ? await cryptoCandles(t)
        : await getTechCandles(t, lot.market === 'KR' ? 'KR' : 'US', 'D')
      candleMap.set(t, candles)
    }))
  }
  const fxCandles = await getTechCandles('KRW=X', 'US', 'D')
  const nowMonth = kstDate().slice(0, 7)
  const { points, skipped } = buildMonthlySeries(lots, candleMap, fxCandles, nowMonth)
  return { points, skipped, asOf: new Date().toISOString() }
}
