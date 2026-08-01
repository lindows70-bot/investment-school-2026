// 어닝 결과 SSOT — 발표일 사전 적립(earn-dates 맵) + 발표 후 beat/miss(earningsHistory)·주가 반응(getTechCandles)
//    ⚠️ Yahoo는 '지나간 발표일'을 안 줌(발표 후 calendarEvents가 다음 분기로 점프 — 2026-08-01 실측) →
//    미래 발표일을 공유 맵에 미리 적립해 두고, 날짜가 지나면 그 날을 앵커로 결과를 계산한다.
//    beat/miss는 Yahoo surprisePercent 제공값 사용(재계산 금지 — 제2원칙). AI 미사용·전부 결정론.
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles } from '@/lib/techChartData'

export const EARN_DATES_KEY = 'earn-dates-v1'   // 공유 적립 맵: { "TICKER:MKT": { date, name } }

const KST_MS = 9 * 3600_000
const kstDate = (offsetDays = 0) => new Date(Date.now() + KST_MS - offsetDays * 86_400_000).toISOString().slice(0, 10)

export interface EarnDateEntry { date: string; name: string }
export type EarnDatesMap = Record<string, EarnDateEntry>   // key = `${ticker}:${market}`

export interface EarnResultRow {
  ticker: string
  name: string
  market: 'KR' | 'US'
  reportDate: string            // 적립된 발표(예정)일
  daysAgo: number               // 오늘 기준 며칠 전(0=오늘)
  // 컨센서스 대비 — earningsHistory 최신 분기(결합 검증 통과 시)
  epsActual: number | null
  epsEstimate: number | null
  surprisePct: number | null    // Yahoo surprisePercent×100 (+상회/−미달)
  beat: boolean | null          // null = 집계 중(발표 직후 미반영)
  // 주가 반응 — 발표일 이전 마지막 종가 → 최신 종가
  reactionPct: number | null    // null = 발표 후 새 봉 없음(반응 집계 전)
  summary: string               // 결정론 한 줄
}

interface Holding { ticker: string; name: string; market: 'KR' | 'US' }

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 보유 종목의 다음 발표일을 조회해 공유 맵에 적립(과거 21일 유지) + 현재 맵 반환 */
export async function refreshEarnDates(holdings: Holding[]): Promise<EarnDatesMap> {
  const prev = (await getCache<EarnDatesMap>(EARN_DATES_KEY, 30 * 86_400_000)) ?? {}
  const cutoff = kstDate(21)
  const map: EarnDatesMap = {}
  for (const [k, v] of Object.entries(prev)) if (v?.date >= cutoff) map[k] = v

  const { default: YF } = await import('yahoo-finance2')
  const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
  const today = kstDate()

  const queue = [...holdings]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const h = queue.shift(); if (!h) break
      const key = `${h.ticker.toUpperCase()}:${h.market}`
      // 이미 오늘 이후 예정일이 적립돼 있으면 재조회 생략(발표가 지나 과거가 된 항목은 보존 — 결과 앵커)
      if (map[key] && map[key].date >= today) continue
      const symbols = h.market === 'KR' ? [`${h.ticker}.KS`, `${h.ticker}.KQ`] : [h.ticker]
      for (const sym of symbols) {
        try {
          const qs = await yf.quoteSummary(sym, { modules: ['calendarEvents'] }, { validateResult: false })
          const ed = qs?.calendarEvents?.earnings?.earningsDate
          const ms = Array.isArray(ed) && ed.length ? new Date(ed[0]).getTime() : NaN
          if (isFinite(ms)) {
            const d = new Date(ms).toISOString().slice(0, 10)
            // 미래(또는 오늘) 예정일만 신규 적립 — 과거 날짜는 앵커 보존 원칙과 충돌하지 않게 무시
            if (d >= today) map[key] = { date: d, name: h.name }
          }
          break
        } catch { /* 다음 심볼 폴백 */ }
      }
    }
  }))

  await setCache(EARN_DATES_KEY, map)
  return map
}

/** 적립 맵에서 최근 발표(오늘−3 ~ 오늘) 보유 종목의 결과 행 생성 */
export async function buildEarningsResults(holdings: Holding[], map: EarnDatesMap): Promise<EarnResultRow[]> {
  const today = kstDate()
  const from = kstDate(3)
  const heldKey = new Map(holdings.map(h => [`${h.ticker.toUpperCase()}:${h.market}`, h]))

  const targets: { h: Holding; date: string }[] = []
  for (const [k, v] of Object.entries(map)) {
    if (v.date < from || v.date > today) continue
    const h = heldKey.get(k)
    if (h) targets.push({ h, date: v.date })
  }
  if (!targets.length) return []

  const { default: YF } = await import('yahoo-finance2')
  const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
  const todayMs = Date.parse(today)

  const rows: EarnResultRow[] = []
  const queue = [...targets]
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (;;) {
      const t = queue.shift(); if (!t) break
      const { h, date } = t
      try {
        // ── beat/miss: earningsHistory 최신 actual 분기 + 결합 검증(발표일−분기말 < 100일) ──
        let epsActual: number | null = null, epsEstimate: number | null = null, surprisePct: number | null = null
        let beat: boolean | null = null
        const symbols = h.market === 'KR' ? [`${h.ticker}.KS`, `${h.ticker}.KQ`] : [h.ticker]
        for (const sym of symbols) {
          try {
            const qs = await yf.quoteSummary(sym, { modules: ['earningsHistory'] }, { validateResult: false })
            const hist: any[] = qs?.earningsHistory?.history ?? []
            const withActual = hist.filter(x => x?.epsActual != null && x?.quarter)
            const latest = withActual[withActual.length - 1]   // 과거→최근 순(실측)
            if (latest) {
              const qEndMs = new Date(latest.quarter).getTime()
              const gapDays = (Date.parse(date) - qEndMs) / 86_400_000
              if (gapDays > 0 && gapDays < 100) {   // 이 발표의 분기 맞음
                epsActual = Number(latest.epsActual)
                epsEstimate = latest.epsEstimate != null ? Number(latest.epsEstimate) : null
                surprisePct = latest.surprisePercent != null ? Math.round(Number(latest.surprisePercent) * 1000) / 10 : null
                beat = epsEstimate != null ? epsActual >= epsEstimate : (surprisePct != null ? surprisePct >= 0 : null)
              }
            }
            break
          } catch { /* 다음 심볼 */ }
        }

        // ── 주가 반응: 발표일 이전 마지막 종가 → 최신 종가 ──
        let reactionPct: number | null = null
        try {
          const candles = await getTechCandles(h.ticker, h.market, 'D')
          const before = candles.filter(c => c.date < date)
          const base = before[before.length - 1]?.close
          const last = candles[candles.length - 1]
          // 발표일 이후(당일 포함) 새 봉이 있어야 반응으로 인정
          if (base && last && last.date >= date && last.close > 0)
            reactionPct = Math.round((last.close / base - 1) * 1000) / 10
        } catch { /* 반응 미집계 */ }

        const daysAgo = Math.max(0, Math.round((todayMs - Date.parse(date)) / 86_400_000))
        const parts: string[] = []
        if (beat === true) parts.push(`컨센서스 ${surprisePct != null ? `+${surprisePct}% ` : ''}상회`)
        else if (beat === false) parts.push(`컨센서스 ${surprisePct != null ? `${surprisePct}% ` : ''}미달`)
        else parts.push('결과 집계 중(발표 직후)')
        if (reactionPct != null) parts.push(`발표 후 주가 ${reactionPct >= 0 ? '+' : ''}${reactionPct}%`)
        else parts.push('주가 반응 집계 전')

        rows.push({
          ticker: h.ticker, name: h.name, market: h.market, reportDate: date, daysAgo,
          epsActual, epsEstimate, surprisePct, beat, reactionPct,
          summary: parts.join(' · '),
        })
      } catch { /* 종목 실패 — 정직 생략 */ }
    }
  }))

  rows.sort((a, b) => a.daysAgo - b.daysAgo)
  return rows
}
