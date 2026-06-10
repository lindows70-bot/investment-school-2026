/**
 * src/lib/schoolIndex.ts — 🏫 투자학교 전용 13F 인덱스 (School Insider Flow) · 1단계 집계 로직
 *
 * 학생들의 집단지성을 '동일 가중(equal-weight)' 인덱스로 결합한다.
 *
 * ── 핵심 원칙 ──
 *  ① 동일 가중: 자산가 왜곡 방지 — '개인별 포트폴리오 내 비중(%)'을 먼저 구한 뒤 그 값들을 평균.
 *     (예: A의 NVDA 비중 40%, B의 10% → 인덱스 비중 25% = 보유자 평균)
 *  ② 익명성 가드레일: 단 1명만 보유한 종목은 개인 식별 위험 → 'ETC'(기타 자산) 가상 티커로 합산.
 *     2명 이상 공동 보유 종목만 개별 노출.
 *  ③ '전체 자산 중' 비중: 분모는 학생의 전 자산(주식+ETF+코인) 평가액. 인덱스엔 개별주식(STOCK)만 편입.
 *
 * 모든 학생 연산은 try/catch로 격리 — 한 명 실패해도 전체 집계는 계속.
 * 순수 집계 함수(aggregateSchoolIndex) + 데이터 소스 헬퍼(getSector). 하드코딩 없음.
 */

import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'

const USDKRW = 1350   // 통화 통일(평가액 비교용 대략 환율) — 비중은 비율이라 절대 환율값에 둔감

export function kstDate(d = new Date()): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)  // Asia/Seoul 달력일
}
const round2 = (n: number) => Math.round(n * 100) / 100

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface Inv {
  user_id: string; ticker: string; name: string | null; market: string | null
  currency: string | null; purchase_price: number | null; quantity: number | null
}
export interface StockSnapshotRow {
  base_date: string; ticker: string; stock_name: string; gics_sector: string
  avg_weight: number; student_count: number; weight_change: number
}
export interface SectorSnapshotRow {
  base_date: string; gics_sector: string; avg_weight: number
}

// ── GICS 섹터 조회 (종목별 7일 app_cache · KR .KS→.KQ 폴백) ─────────────────────
async function getYF() {
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
}
export async function getSector(ticker: string, market: string): Promise<string> {
  const tk = ticker.trim().toUpperCase()
  const cacheKey = `gics-sector:${tk}:${market}`
  const cached = await getCache<{ s: string }>(cacheKey, 7 * 24 * 3600_000)
  if (cached) return cached.s
  let sector = '기타'
  try {
    const yf = await getYF()
    const code = tk.replace(/\D/g, '')
    const tries = market === 'KR' ? [`${code}.KS`, `${code}.KQ`] : [tk]
    for (const s of tries) {
      try {
        const q = await yf.quoteSummary(s, { modules: ['assetProfile'] })
        const sec = q?.assetProfile?.sector
        if (sec) { sector = String(sec); break }
      } catch { /* 다음 심볼 */ }
    }
    await setCache(cacheKey, { s: sector })
  } catch { /* 실패 → '기타' */ }
  return sector
}

// ── 순수 집계 함수 ─────────────────────────────────────────────────────────────
export function aggregateSchoolIndex(
  invs: Inv[],
  priceMap: Record<string, number>,            // ticker(UPPER) → 현재가 (없으면 매입가 폴백)
  sectorMap: Record<string, string>,           // ticker(UPPER) → GICS 섹터 (주식만)
  prevStockWeight: Record<string, number>,     // ticker → 직전 스냅샷 avg_weight
  baseDate: string,
): { stockRows: StockSnapshotRow[]; sectorRows: SectorSnapshotRow[]; registered: number } {
  // 1) 학생별 그룹
  const byUser: Record<string, Inv[]> = {}
  for (const inv of invs) (byUser[inv.user_id] ??= []).push(inv)

  // ticker → 보유자별 비중 엔트리 (주식만)
  const stockEntries: Record<string, { name: string; sector: string; entries: { user: string; weight: number }[] }> = {}
  // user → sector → 비중합 (섹터 인덱스용)
  const sectorByUser: Record<string, Record<string, number>> = {}
  let registered = 0

  for (const [uid, list] of Object.entries(byUser)) {
    try {
      // 전 자산 평가액(분모) — 주식+ETF+코인 모두 포함
      let total = 0
      const vals: { inv: Inv; value: number; isStock: boolean }[] = []
      for (const inv of list) {
        const fx = inv.currency === 'USD' ? USDKRW : 1
        const price = priceMap[(inv.ticker ?? '').toUpperCase()]
        const unit = (price && price > 0) ? price : (inv.purchase_price ?? 0)
        const value = unit * (inv.quantity ?? 0) * fx
        if (value > 0) {
          const isStock = getAssetType(inv.ticker ?? '', inv.name ?? '', inv.market ?? 'US') === 'STOCK'
          total += value
          vals.push({ inv, value, isStock })
        }
      }
      if (total <= 0) continue
      registered++
      sectorByUser[uid] = {}

      for (const { inv, value, isStock } of vals) {
        if (!isStock) continue                       // 인덱스엔 개별주식만 편입
        const weight = (value / total) * 100         // ← '전체 자산 중' 개인 비중(%)
        const tk = (inv.ticker ?? '').toUpperCase()
        const sector = sectorMap[tk] || '기타'
        ;(stockEntries[tk] ??= { name: inv.name ?? tk, sector, entries: [] }).entries.push({ user: uid, weight })
        sectorByUser[uid][sector] = (sectorByUser[uid][sector] ?? 0) + weight
      }
    } catch { /* 이 학생 연산 실패 → 격리하고 전체 계속 */ }
  }

  // 2) 종목 스냅샷: 2명 이상 공동보유만 개별 노출, 1명은 ETC로 합산
  const stockRows: StockSnapshotRow[] = []
  const etcByUser: Record<string, number> = {}
  for (const [tk, v] of Object.entries(stockEntries)) {
    if (v.entries.length >= 2) {                     // ★ 익명성: 2명 이상만
      const avg = v.entries.reduce((s, e) => s + e.weight, 0) / v.entries.length
      stockRows.push({
        base_date: baseDate, ticker: tk, stock_name: v.name, gics_sector: v.sector,
        avg_weight: round2(avg), student_count: v.entries.length,
        weight_change: round2(avg - (prevStockWeight[tk] ?? avg)),   // 직전 없으면 0
      })
    } else {                                          // 단독 보유 → ETC 버킷(학생별 합산)
      const e = v.entries[0]
      etcByUser[e.user] = (etcByUser[e.user] ?? 0) + e.weight
    }
  }
  const etcUsers = Object.keys(etcByUser)
  if (etcUsers.length > 0) {
    const avg = etcUsers.reduce((s, u) => s + etcByUser[u], 0) / etcUsers.length
    stockRows.push({
      base_date: baseDate, ticker: 'ETC', stock_name: '기타 자산 (소수 보유)', gics_sector: 'ETC',
      avg_weight: round2(avg), student_count: etcUsers.length,
      weight_change: round2(avg - (prevStockWeight['ETC'] ?? avg)),
    })
  }
  stockRows.sort((a, b) => b.avg_weight - a.avg_weight)

  // 3) 섹터 스냅샷: 등록 학생 전체 평균(미보유=0) → 학교의 집단 섹터 배분(합 ~100%)
  const sectorTotals: Record<string, number> = {}
  for (const uid of Object.keys(sectorByUser)) {
    for (const [sec, w] of Object.entries(sectorByUser[uid])) sectorTotals[sec] = (sectorTotals[sec] ?? 0) + w
  }
  const sectorRows: SectorSnapshotRow[] = Object.entries(sectorTotals)
    .map(([sec, sum]) => ({ base_date: baseDate, gics_sector: sec, avg_weight: round2(registered > 0 ? sum / registered : 0) }))
    .sort((a, b) => b.avg_weight - a.avg_weight)

  return { stockRows, sectorRows, registered }
}
