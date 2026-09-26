// 진짜 월별 손익 시계열 SSOT — 보유 로트 × 일봉 이력으로 월말 평가액을 재구성한다
// ⚠️ 관례: 원가·평가 모두 '그 달 말 환율'로 환산(대시보드 toKrw 와 동일) → 마지막 달 누적 == 대시보드 평가손익
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import { getCache, setCache } from '@/lib/appCache'
// 로트·시점 타입과 순수 계산은 monthlySeries.ts(서버 의존 없음 — 단위검증용)로 옮겼다. 기존 import 경로는 그대로 쓴다
import { buildMonthlySeries, type PnlLot, type MonthlyPnlPoint, type MonthlyTruncated } from '@/lib/monthlySeries'
export { buildMonthlySeries }
export type { PnlLot, MonthlyPnlPoint }

export interface MonthlyPnlResult {
  points: MonthlyPnlPoint[]
  /** 캔들을 아예 못 구해 계산에서 빠진 티커 — 조용한 폴백 금지, 화면에 명시한다 */
  skipped: string[]
  /**
   * 가격 이력이 닿지 않아 '표시하지 못한' 앞쪽 구간.
   * ⚠️ 예전엔 이 구간을 손익 0 으로 그려서, 1년 전 매수분이 7개월간 "0원"으로 보이고
   *    이력이 시작되는 달에 그동안의 변화가 몰려 튀었다(실측 확인). 이제 잘라내고 알린다.
   */
  truncated: MonthlyTruncated
  /** 매도 확정 손익 — 라우트가 서버에서 transactions 를 읽어 붙인다(평가손익만 보면 성적의 절반이 없다) */
  realized?: {
    byMonth: { month: string; krw: number; count: number }[]
    totalKrw: number
    totalCount: number
    fxFallbackCount: number
  } | null
  /** 💰 매도한 물량의 **매수원가** 합(원) — 총수익률 분모용(보유원가 + 이 값).
   *  ⚠️ 라우트가 buildRealizedTotals(스쿨 리그와 같은 SSOT)로 채운다. 이게 없어서 대시보드가
   *     분모를 못 만들고 평가손익만 보여줬다(2026-08-17 — 스쿨 리그 +22.6% vs 대시보드 −9.86%). */
  soldCostKrw?: number
  /** 💰 실현손익 합(원) — **총수익률 분자용**. realized.totalKrw(차트용)와 달리 날짜가 깨진 매도행도 센다. */
  realizedTotalKrw?: number | null
  asOf: string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/**
 * 업비트 일봉 — 기존 SSOT(getTechCandles)는 KR|US 뿐이라 크립토만 여기서 수집.
 * ⚠️ count 는 200 에서 하드캡이다(400 을 요청해도 200행 — 실측). 그래서 `to=` 로 페이지네이션해
 *    최초 매수월까지 거슬러 올라간다. 안 하면 6.6개월 이전 매수분이 통째로 누락된다.
 */
async function cryptoCandles(ticker: string, needFrom: string): Promise<TechCandle[]> {
  const key = `crypto-candles-v2:${ticker.toUpperCase()}:${needFrom}:${kstDate()}`
  const cached = await getCache<{ candles: TechCandle[] }>(key, 30 * 60_000)
  if (cached?.candles?.length) return cached.candles
  const out: TechCandle[] = []
  let to: string | null = null
  try {
    for (let page = 0; page < 8; page++) {          // 최대 1,600일 ≈ 4.4년
      const url = `https://api.upbit.com/v1/candles/days?market=KRW-${ticker.toUpperCase()}&count=200${to ? `&to=${to}` : ''}`
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) break
      const j: { candle_date_time_kst: string; candle_date_time_utc: string; trade_price: number }[] = await r.json()
      if (!Array.isArray(j) || j.length === 0) break
      for (const c of j) {
        const close = c.trade_price
        if (!isFinite(close) || close <= 0) continue
        out.push({ date: c.candle_date_time_kst.slice(0, 10), open: close, high: close, low: close, close, volume: 0 })
      }
      const oldest = j[j.length - 1]
      if (oldest.candle_date_time_kst.slice(0, 10) <= needFrom) break   // 필요한 시점까지 확보
      to = `${oldest.candle_date_time_utc}Z`                            // 다음 페이지는 이 시점 이전
      await new Promise(res => setTimeout(res, 120))                    // 업비트 rate limit 배려
    }
  } catch { /* 확보한 만큼만 사용 */ }
  const candles = Array.from(new Map(out.map(c => [c.date, c])).values())
    .sort((a, b) => a.date.localeCompare(b.date))
  if (candles.length >= 10) await setCache(key, { candles })
  return candles
}

/** 수집 + 계산 오케스트레이션 (라우트에서 호출) */
export async function computeMonthlyPnl(lots: PnlLot[], usdKrwNow?: number | null): Promise<MonthlyPnlResult> {
  const tickers = Array.from(new Set(lots.map(l => l.ticker.toUpperCase())))
  const candleMap = new Map<string, TechCandle[]>()
  // 순차+소배치 — 외부 API 부하 방지(업비트·네이버 rate limit)
  const BATCH = 5
  for (let i = 0; i < tickers.length; i += BATCH) {
    await Promise.all(tickers.slice(i, i + BATCH).map(async t => {
      const lot = lots.find(l => l.ticker.toUpperCase() === t)!
      // 그 티커의 가장 이른 매수일까지만 거슬러 올라가면 된다(크립토 페이지네이션 기준)
      const needFrom = lots.filter(l => l.ticker.toUpperCase() === t)
        .map(l => l.purchase_date.slice(0, 10)).sort()[0]
      const candles = lot.market === 'CRYPTO' ? await cryptoCandles(t, needFrom)
        : await getTechCandles(t, lot.market === 'KR' ? 'KR' : 'US', 'D')
      candleMap.set(t, candles)
    }))
  }
  const fxCandles = await getTechCandles('KRW=X', 'US', 'D')
  const nowMonth = kstDate().slice(0, 7)
  const { points, skipped, truncated } = buildMonthlySeries(lots, candleMap, fxCandles, nowMonth, usdKrwNow)
  return { points, skipped, truncated, asOf: new Date().toISOString() }
}
