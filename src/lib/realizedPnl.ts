// 💰 실현손익(매도 확정 손익) 월별 집계 SSOT
// ⚠️ 왜 필요한가: 대시보드가 평가손익만 보여줘서 학생이 "−541만 잃었다"고 읽는데,
//    실제로는 매도로 +$3,879.93(≈₩555만)을 이미 확정해 뒀다. 성적의 절반이 화면에 없었다.
// ⚠️ 환율 관례: 실현손익은 '그날 원화로 확정된 금액'이라 **매도일 종가 환율**로 환산한다.
//    (평가손익은 현재 환율 — 두 축의 기준이 다르다는 걸 UI 캐비엇에 명시할 것)
import type { TechCandle } from '@/lib/techChartData'

export interface SellTx {
  ticker: string
  name?: string | null
  market?: string | null
  currency?: string | null      // 'USD' | 'KRW'
  realized_pnl?: number | null  // 통화 단위(USD 거래면 달러)
  transaction_date: string      // 'YYYY-MM-DD'
  /** 매도 단가·수량 — '매도한 물량의 원가'를 역산할 때만 쓴다(buildRealizedTotals). */
  price?: number | null
  quantity?: number | null
}

export interface RealizedMonth {
  month: string      // 'YYYY-MM'
  krw: number        // 그 달 실현손익(원)
  count: number      // 그 달 매도 건수
}

export interface RealizedResult {
  byMonth: RealizedMonth[]
  totalKrw: number
  totalCount: number
  /** 환율 이력을 못 구해 매도일 대신 최신 환율로 환산한 건수 — 조용한 폴백 금지 */
  fxFallbackCount: number
}

/** 사용자 한 명의 매도 총계 — 스쿨 리그 랭킹이 '총 투입 원금 대비 총 손익'을 계산할 때 쓴다. */
export interface RealizedTotals {
  realizedKrw: number   // 실현손익 합(원) — 매도일 환율
  soldCostKrw: number   // 매도한 물량의 매수원가 합(원) = 매도금액 − 실현손익
  sellCount: number
  fxFallbackCount: number
}

/**
 * 매도 거래 → (실현손익, 매도분 원가) 총계.
 * ⚠️ 원가를 '매도금액 − 실현손익'으로 역산하는 이유: transactions 에 매도분의 매수단가가 없다.
 *    두 값을 **같은 날 환율**로 환산해야 역산이 성립한다(다른 환율을 섞으면 원가가 왜곡된다).
 * ⚠️ price·quantity 가 없는 옛 행은 원가를 못 구하므로 실현손익만 반영한다(분모 과소 → 수익률 과대).
 *    그런 행이 있으면 호출부가 캐비엇을 띄울 수 있게 별도로 세지 않고 soldCostKrw 에 0 을 더한다.
 */
export function buildRealizedTotals(
  sells: SellTx[],
  fxCandles: TechCandle[],
  latestFx: number,
): RealizedTotals {
  let realizedKrw = 0, soldCostKrw = 0, sellCount = 0, fxFallbackCount = 0
  for (const t of sells) {
    const date = (t.transaction_date ?? '').slice(0, 10)
    const pnl = typeof t.realized_pnl === 'number' && isFinite(t.realized_pnl) ? t.realized_pnl : 0
    let rate = 1
    if (t.currency === 'USD') {
      const r = /^\d{4}-\d{2}-\d{2}$/.test(date) ? rateAt(fxCandles, date) : null
      if (r == null) fxFallbackCount++
      rate = r ?? latestFx
    }
    const amount = (t.price ?? 0) * (t.quantity ?? 0)     // 매도금액(거래 통화)
    realizedKrw += pnl * rate
    if (amount > 0) soldCostKrw += Math.max(0, (amount - pnl) * rate)
    sellCount++
  }
  return {
    realizedKrw: Math.round(realizedKrw),
    soldCostKrw: Math.round(soldCostKrw),
    sellCount,
    fxFallbackCount,
  }
}

/**
 * 🏆 총 수익률 % = (평가손익 + 실현손익) ÷ (보유원가 + 매도분 원가) — **대시보드와 스쿨 리그의 공통 잣대.**
 *
 * ⚠️ 2026-08-17 실사고: 같은 학생이 스쿨 리그에선 +22.6% 로 1등인데 대시보드는 −9.86% 였다.
 *    대시보드가 실현손익을 아예 안 셌던 게 1차 원인이고, 고치는 과정에서 분모를
 *    'costPricedKrw(현재가 로드된 종목만)'로 잡아 **두 번째 균열**이 생길 뻔했다.
 *    그래서 공식을 여기 한 곳에 두고 양쪽이 이 함수만 호출한다(제2원칙).
 *
 * ⚠️ 분모에 **매도분 원가**를 넣는 이유: 매도로 회수한 자본도 '투입했던 원금'이다.
 *    빼면 매도가 많은 사람일수록 분모가 작아져 수익률이 부풀려진다(잣대가 사람마다 달라진다).
 * ⚠️ 분모의 보유원가는 **현재가를 못 불러온 종목까지 포함**한다 — 원금을 넣은 건 사실이고
 *    수익률만 미상이므로 0% 로 보는 편이 보수적이다. 분모에서 빼면 결측이 많을수록 부풀려진다.
 *
 * @param unrealizedKrw 평가손익(원) — 현재가가 있는 종목의 (평가액 − 원가) 합
 * @param costKrw       보유원가(원) — **전 종목**(가격 결측 포함)
 */
export function totalReturnPct(
  unrealizedKrw: number,
  costKrw: number,
  realizedKrw: number,
  soldCostKrw: number,
): number | null {
  const denom = costKrw + soldCostKrw
  if (!(denom > 0)) return null
  return ((unrealizedKrw + realizedKrw) / denom) * 100
}

/** 'YYYY-MM-DD' 이하 가장 최근 종가 — 캔들은 오름차순 */
function rateAt(fxCandles: TechCandle[], date: string): number | null {
  for (let i = fxCandles.length - 1; i >= 0; i--) {
    if (fxCandles[i].date <= date) return fxCandles[i].close
  }
  return null
}

/**
 * 순수 계산 — 매도 거래를 월별 원화 실현손익으로 접는다(테스트 가능).
 * @param latestFx 매도일 환율을 못 구했을 때만 쓰는 최신 환율(폴백 건수를 따로 보고한다)
 */
export function buildRealizedByMonth(
  sells: SellTx[],
  fxCandles: TechCandle[],
  latestFx: number,
): RealizedResult {
  const map = new Map<string, { krw: number; count: number }>()
  let totalKrw = 0, totalCount = 0, fxFallbackCount = 0

  for (const t of sells) {
    const pnl = typeof t.realized_pnl === 'number' && isFinite(t.realized_pnl) ? t.realized_pnl : 0
    const date = (t.transaction_date ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const month = date.slice(0, 7)

    let krw: number
    if (t.currency === 'USD') {
      const r = rateAt(fxCandles, date)
      if (r == null) fxFallbackCount++
      krw = pnl * (r ?? latestFx)
    } else {
      krw = pnl                                   // KRW 거래는 그대로
    }
    krw = Math.round(krw)

    const cur = map.get(month) ?? { krw: 0, count: 0 }
    cur.krw += krw; cur.count += 1
    map.set(month, cur)
    totalKrw += krw; totalCount += 1
  }

  const byMonth = Array.from(map.entries())
    .map(([month, v]) => ({ month, krw: v.krw, count: v.count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return { byMonth, totalKrw, totalCount, fxFallbackCount }
}
