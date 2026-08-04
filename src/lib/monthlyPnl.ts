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
  /** 대시보드가 쓰는 실시간 현재가 — 현재 월에만 사용(과거 월은 일봉 종가가 정답).
   *  이걸 안 쓰면 마지막 달이 '종가 기준'이라 평가손익 카드(실시간)와 미세하게 어긋난다. */
  currentPrice?: number | null
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
  /**
   * 가격 이력이 닿지 않아 '표시하지 못한' 앞쪽 구간.
   * ⚠️ 예전엔 이 구간을 손익 0 으로 그려서, 1년 전 매수분이 7개월간 "0원"으로 보이고
   *    이력이 시작되는 달에 그동안의 변화가 몰려 튀었다(실측 확인). 이제 잘라내고 알린다.
   */
  truncated: { from: string; to: string; months: number } | null
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

/** 'YYYY-MM' 에 개월 수를 더한다(음수 가능) */
function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const t = (y * 12 + (mo - 1)) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** 두 'YYYY-MM' 사이 개월 차 */
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
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
  /** 현재 월에만 쓸 실시간 환율 — 없으면 KRW=X 캔들.
   *  ⚠️ 캔들 환율(전일 종가)로만 계산하면 누적 끝이 대시보드 평가손익(실시간 환율)과
   *  ~1% 어긋나 같은 화면에 '손익' 두 값이 생긴다(제2원칙). 과거 월은 캔들이 정답. */
  usdKrwNow?: number | null,
): { points: MonthlyPnlPoint[]; skipped: string[]; truncated: MonthlyPnlResult['truncated'] } {
  const skipped = Array.from(new Set(
    lots.filter(l => !(candleMap.get(l.ticker.toUpperCase())?.length)).map(l => l.ticker.toUpperCase())
  ))
  const usable = lots.filter(l => candleMap.get(l.ticker.toUpperCase())?.length)
  if (!usable.length) return { points: [], skipped, truncated: null }

  // 최초 매수월 ~ 현재월. 단 최근 MAX_MONTHS 개월로 제한한다.
  // ⚠️ 예전엔 최초 매수월부터 세며 36 에서 끊어서, 오래 보유한 학생은 '최신 달'이 잘렸다
  //    (3년 전 매수 → 2026-04 에서 끝남). 상한은 반드시 '최근' 쪽에서 잡는다.
  const MAX_MONTHS = 36
  const firstMonth = usable.map(l => l.purchase_date.slice(0, 7)).sort()[0]
  const capStart = addMonths(nowMonth, -(MAX_MONTHS - 1))
  const startMonth = firstMonth > capStart ? firstMonth : capStart
  const months: string[] = []
  for (let m = startMonth; m <= nowMonth; m = addMonths(m, 1)) months.push(m)

  const raw: (MonthlyPnlPoint & { complete: boolean })[] = []
  let prevCum = 0
  for (const m of months) {
    // 그 달에 '보유 중이어야 할' 로트 수 — 실제 반영 수와 다르면 이력이 모자란 달이다
    const expected = usable.filter(l => l.purchase_date.slice(0, 7) <= m).length
    const endMax = `${m}-99`
    const fx = (m === nowMonth && usdKrwNow && isFinite(usdKrwNow) && usdKrwNow > 0)
      ? usdKrwNow
      : closeAtOrBefore(fxCandles, endMax)
    let value = 0, cum = 0, lotCount = 0
    const isNow = m === nowMonth
    for (const lot of usable) {
      if (lot.purchase_date.slice(0, 7) > m) continue          // 아직 안 산 로트
      const candleClose = closeAtOrBefore(candleMap.get(lot.ticker.toUpperCase())!, endMax)
      // 현재 월은 대시보드와 같은 실시간 현재가로 — 과거 월은 그 달 말 종가
      const close = (isNow && lot.currentPrice && isFinite(lot.currentPrice) && lot.currentPrice > 0)
        ? lot.currentPrice : candleClose
      if (close == null) continue                              // 상장 전(SPCX 5월 등)
      const rate = lot.currency === 'USD' ? (fx ?? 0) : 1
      if (!rate) continue                                      // 환율 이력 없으면 USD 로트 제외(조용한 0 환산 금지)
      value += close * lot.quantity * rate
      cum   += (close - lot.purchase_price) * lot.quantity * rate
      lotCount++
    }
    const [y, mo] = m.split('-')
    raw.push({
      month: m, label: `${y.slice(2)}년 ${parseInt(mo)}월`,
      pnl: Math.round(cum - prevCum), cumPnl: Math.round(cum),
      valueKrw: Math.round(value), lotCount,
      complete: expected > 0 && lotCount === expected,
    })
    prevCum = cum
  }

  // ── 이력이 모자란 앞쪽 구간을 잘라낸다 ────────────────────────────────
  // 이력은 과거로 갈수록 없으므로 불완전 구간은 항상 앞쪽에 연속으로 몰린다.
  const firstOk = raw.findIndex(p => p.complete)
  if (firstOk < 0) return { points: [], skipped, truncated: null }

  let cut = firstOk
  // 잘린 구간이 있으면 첫 완전월의 pnl 도 못 믿는다 — 직전 달(불완전)과의 차이라서.
  // 그 달은 누적만 유효하므로 한 달 더 버리고 시작한다.
  if (cut > 0) cut += 1
  const points = raw.slice(cut).map(({ complete, ...p }) => { void complete; return p })

  // 잘린 구간 = (36개월 상한으로 아예 안 만든 앞부분) + (이력이 모자라 버린 부분)
  const capCut = startMonth > firstMonth
  const truncFrom = capCut ? firstMonth : (cut > 0 ? raw[0].month : null)
  const truncTo = cut > 0 ? raw[cut - 1].month : (capCut ? addMonths(startMonth, -1) : null)
  const truncated = truncFrom && truncTo && truncFrom <= truncTo
    ? { from: truncFrom, to: truncTo, months: monthDiff(truncFrom, truncTo) + 1 }
    : null
  return { points, skipped, truncated }
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
