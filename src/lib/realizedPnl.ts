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
