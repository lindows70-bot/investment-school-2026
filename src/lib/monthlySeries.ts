// 월별 자산 흐름 순수 계산 — 로트(매수일·매도일) × 일봉 종가로 월말 평가액·누적 평가손익을 만든다(서버 모듈 의존 없음 · monthlyPnl 이 다시 내보낸다)
// ⚠️ 관례: 원가·평가 모두 '그 달 말 환율'로 환산(대시보드 toKrw 와 동일) → 마지막 달 누적 == 대시보드 평가손익

/** 계산에 필요한 캔들 필드만 — techChartData.TechCandle 이 그대로 들어온다(서버 모듈을 끌고 오지 않으려고 따로 둔다) */
export interface SeriesCandle { date: string; close: number }

export interface PnlLot {
  ticker: string
  market: string            // 'KR' | 'CRYPTO' | 그 외(='US 경로', Yahoo)
  currency: string          // 'KRW' | 'USD'
  purchase_price: number
  quantity: number
  purchase_date: string     // 'YYYY-MM-DD'
  /** 판 날('YYYY-MM-DD') — 판 달 말부터 빠진다. 없으면 지금까지 보유(대시보드는 안 보낸다 = 예전과 같은 계산) */
  sold_date?: string | null
  /** 대시보드가 쓰는 실시간 현재가 — 현재 월에만 사용(과거 월은 일봉 종가가 정답).
   *  이걸 안 쓰면 마지막 달이 '종가 기준'이라 평가손익 카드(실시간)와 미세하게 어긋난다. */
  currentPrice?: number | null
}

export interface MonthlyPnlPoint {
  month: string             // 'YYYY-MM'
  label: string             // '26년 5월'
  /** 그 달의 손익(원) = cum(M) - cum(M-1).
   *  ⚠️ sold_date 가 있는 로트는 판 달에 누적에서 빠지므로 그 달 pnl 에 '판 로트의 평가손익 소멸'이 섞인다 — 월 손익으로 읽으려면 sold_date 없이 부른다 */
  pnl: number
  cumPnl: number            // 월말 기준 누적 평가손익(원) — 그 달 말 들고 있던 로트만
  valueKrw: number          // 월말 평가액(원)
  lotCount: number          // 그 달 말 기준 반영된 로트 수
}

/** 가격 이력이 닿지 않아(또는 36개월 상한으로) 표시하지 못한 앞쪽 구간 */
export type MonthlyTruncated = { from: string; to: string; months: number } | null

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
function closeAtOrBefore(candles: SeriesCandle[], dateMax: string): number | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].date <= dateMax) return candles[i].close
  }
  return null
}

/** m 월 말에 이 로트를 들고 있었나 — 산 달 ≤ m 이고, 안 팔았거나 판 달 > m (lotsFromTrades 의 구간 묶기도 이 판정을 쓴다) */
export function heldAt(lot: PnlLot, m: string): boolean {
  if (lot.purchase_date.slice(0, 7) > m) return false
  return !lot.sold_date || lot.sold_date.slice(0, 7) > m
}

/** 순수 계산 — 캔들 맵을 받아 월별 시계열을 만든다(테스트 가능) */
export function buildMonthlySeries(
  lots: PnlLot[],
  candleMap: Map<string, SeriesCandle[]>,
  fxCandles: SeriesCandle[],
  nowMonth: string,          // 'YYYY-MM' (KST)
  /** 현재 월에만 쓸 실시간 환율 — 없으면 KRW=X 캔들.
   *  ⚠️ 캔들 환율(전일 종가)로만 계산하면 누적 끝이 대시보드 평가손익(실시간 환율)과
   *  ~1% 어긋나 같은 화면에 '손익' 두 값이 생긴다(제2원칙). 과거 월은 캔들이 정답. */
  usdKrwNow?: number | null,
): { points: MonthlyPnlPoint[]; skipped: string[]; truncated: MonthlyTruncated } {
  // 같은 달에 사고 판 로트는 어느 월말에도 없다 — 계산·시세 수집 대상에서 뺀다(sold_date 없는 대시보드 입력엔 해당 없음)
  const relevant = lots.filter(l => heldAt(l, l.purchase_date.slice(0, 7)))
  const skipped = Array.from(new Set(
    relevant.filter(l => !(candleMap.get(l.ticker.toUpperCase())?.length)).map(l => l.ticker.toUpperCase())
  ))
  const usable = relevant.filter(l => candleMap.get(l.ticker.toUpperCase())?.length)
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
    // 그 달 말에 '보유 중이어야 할' 로트 수 — 실제 반영 수와 다르면 이력이 모자란 달이다.
    // 판 로트는 판 달부터 세지 않는다(세면 이력이 멀쩡한데도 '모자란 달'로 잘린다)
    const expected = usable.filter(l => heldAt(l, m)).length
    const endMax = `${m}-99`
    const fx = (m === nowMonth && usdKrwNow && isFinite(usdKrwNow) && usdKrwNow > 0)
      ? usdKrwNow
      : closeAtOrBefore(fxCandles, endMax)
    let value = 0, cum = 0, lotCount = 0
    const isNow = m === nowMonth
    for (const lot of usable) {
      if (!heldAt(lot, m)) continue                            // 아직 안 샀거나 이미 판 로트
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
      // 다 팔아 빈 달(expected 0)은 모자란 게 아니라 '들고 있던 게 없는' 달이다 — 완전한 달로 본다.
      // sold_date 가 없으면 firstMonth 이후 expected 는 항상 1 이상이라 예전 판정과 같다
      complete: lotCount === expected,
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
