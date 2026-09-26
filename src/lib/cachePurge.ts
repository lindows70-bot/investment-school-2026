// app_cache 정리 허용 목록과 판정(순수 함수) — cron-health 가 하루 한 번 오래된 행을 작은 묶음으로 지운다
//
// 💥 2026-09-26: app_cache 에는 지우는 장치가 없어 날짜·시각이 든 키가 영구 누적됐다(tech-chart 926 MB → DB 한도 초과·읽기 전용).
//    키에서 날짜를 뺄 수 있는 것은 뺐고(종목별 15종), 날짜가 뜻을 가지는 것(일별 문서·실행 마커·사용자별 일자 캐시)은 여기서 지운다.
//
// ⛔ 안전 원칙 — 틀리게 지우는 것이 남겨 두는 것보다 나쁘다
//   ① 허용 목록에 있는 접두어만 지운다(그 밖의 키는 절대 건드리지 않는다).
//   ② keepDays 는 그 접두어를 읽는 **모든 getCache 의 maxAge 보다 길다** — getCache 는 maxAge 보다 오래된 행을
//      어차피 null 로 버리므로, 그보다 오래된 행은 누구도 쓸 수 없다(지워도 결과가 같다는 것이 증명된다).
//   ③ cronHealth 는 최대 8일 전 일자 키(cacheDate)를 본다 → 일별 문서·마커는 10일 이상 남긴다.
//   ④ getCache 를 거치지 않는 reader(나이를 안 보는 `.in('key', …)` 직접 조회 등)가 있는 접두어는 넣지 않는다
//      — 예: rtms-trade-v2(re-map·re-apt-pins 가 최근 12개월 월 키를 나이 확인 없이 읽는다).
//   ⚠️ 키 버전을 올리면 여기 접두어도 함께 올려라 — 옛 버전 리터럴이 남으면 precommit-guard 가 막는다.
import { UNIFIED_RECO_V } from './recoCacheVersion'

export interface PurgeRule {
  prefix: string     // 키의 첫 ':' 앞(정확히 일치) — `${prefix}:` 로 시작하는 키만 대상
  keepDays: number   // updated_at 이 이보다 오래되면 지운다
  why: string        // 가장 긴 reader TTL 근거
}

export const DAY_MS = 86_400_000

/** 키의 접두어 — 첫 ':' 또는 '|' 앞(측정·SQL 과 같은 정의) */
export function prefixOf(key: string): string {
  const m = /^[^:|]*/.exec(key)
  return m ? m[0] : key
}

// 종목별(키에서 날짜를 뺀 15종) — reader 가 24h 이하 TTL + 오늘(KST)만 읽는다. 옛 날짜 키 잔여분도 이 규칙으로 걷힌다
const PER_TICKER = (prefix: string, ttl: string): PurgeRule => ({ prefix, keepDays: 3, why: `종목별 · reader ${ttl}` })
// 일별 문서·실행 마커 — cronHealth 8일 역탐색 + 가장 긴 look-back TTL(market-flow-kr 6일)보다 길게
const DAILY = (prefix: string, ttl: string): PurgeRule => ({ prefix, keepDays: 10, why: `일별 · reader ${ttl}` })
// 사용자별 일자 캐시 — reader 24h 이하(보유가 바뀌면 fp 가 바뀌어 새 키 — 옛 키는 버려진다)
const PER_USER = (prefix: string, ttl: string): PurgeRule => ({ prefix, keepDays: 3, why: `사용자별 · reader ${ttl}` })

export const PURGE_RULES: PurgeRule[] = [
  PER_TICKER('jarvis-metrics-v17', '12h'),
  PER_TICKER('money-flow-v7', '24h'),
  PER_TICKER('jarvis-brief-v6', '20h'),
  PER_TICKER('news-catalyst-v7', '3h'),
  PER_TICKER('kr-intraday-v1', '3h'),
  PER_TICKER('dilution-v1', '24h'),
  PER_TICKER('masters-committee-v14', '24h'),
  PER_TICKER('masters-brief-v14', '24h'),
  PER_TICKER('mf-timeline-v1', '24h'),
  PER_TICKER('short-int-v1', '24h'),
  PER_TICKER('stock-profile-v5', '6h'),
  PER_TICKER('research-verdict-v25', '6h'),
  PER_TICKER('research-report-v4', '6h'),
  PER_TICKER('crypto-candles-v2', '30m'),
  PER_TICKER('sector-v3', '6h'),

  DAILY('market-flow-kr-v10', '6d(supplyScore·unified-reco·market-catalyst)'),
  DAILY('sector-rotation-v15', '3d(rotationShared·unified-reco·win-lose·research-verdict)'),
  DAILY('win-lose-v9', '2d(unified-reco·hi52Radar)'),
  DAILY('market-breadth-v2', '4d'),
  DAILY('covered-call-xray-v2', '4d'),
  DAILY('tech-screener-v4', '12h'),
  DAILY('hi52-radar-v3', '12h'),
  DAILY('yield-curve-v4', '6h'),
  DAILY('market-catalyst-v4', '24h(weekly-report)'),
  DAILY('cme-cot-v2', '12h'),
  DAILY('crypto-funding-v1', '1h'),
  DAILY('crypto-regulation-v2', '6h'),
  DAILY('stablecoin-v5', '6h'),
  DAILY('country-vol-v2', '6h'),
  DAILY('us-liquidity-v1', '6h'),
  DAILY('analyst-rerating-v1', '12h'),
  DAILY('insider-market-v1', '24h(analystRerating)'),
  DAILY('usm-grade-v1', '12h'),
  DAILY('asset-rank-v2', '3h'),
  DAILY('swing-radar-v15', '12h'),
  DAILY('signal-report-v13', '12h'),
  DAILY('weekly-report-common-v12', '6h'),
  DAILY('correlation-radar-v2', '12h'),
  DAILY('rot-scorecard-v1', '6h'),
  DAILY('fomc-decoder-v9', '6h'),
  DAILY('ghost-discovery-v1', '24h'),
  DAILY('re-policy-v6', '6h'),
  DAILY('re-tax-v3', '24h'),
  DAILY('re-redevelop-v3', '24h'),
  DAILY('global-top10-v3', '12h'),
  DAILY('index-flow-v3', '24h'),
  DAILY('marks-cycle-v4', '12h(scoreTilts — 오늘 키만)'),
  DAILY('mkt-investor-v4', '6h'),
  DAILY('etf-flow-v3', '6h'),
  DAILY('core-reco-run-v1', 'cronHealth 마커'),
  DAILY('swing-cron-run-v1', 'cronHealth 마커'),
  DAILY('etf-snap-run-v1', 'cronHealth 마커'),
  DAILY('insider-scan-run-v1', 'cronHealth 마커'),

  PER_USER('portfolio-xray-v5', '12h'),
  PER_USER('cash-position-v1', '3h'),
  PER_USER('event-calendar-v2', '12h'),
  PER_USER('exit-plan-v8', '6h'),
  PER_USER('season-navigator-v15', '12h'),
  PER_USER('short-interest-v1', '24h'),
  PER_USER(`ai-rebalance-v52+${UNIFIED_RECO_V}`, '24h'),
  PER_USER(`hq-briefing-v18+${UNIFIED_RECO_V}`, '12h'),
  PER_USER(`unified-reco-${UNIFIED_RECO_V}`, '12h · core-reco 는 오늘 키만 like 조회'),
  PER_USER(`quant-builder-v8+${UNIFIED_RECO_V}`, '12h'),

  // 오래 남기는 기록 — reader TTL 이 길다. 그 TTL 을 넘긴 행만(어차피 읽히지 않는다)
  { prefix: 'guidance-snap', keepDays: 40, why: '30일 전 스냅샷 비교 · reader 35d' },
  { prefix: 'etf-snap-v1', keepDays: 401, why: '45일 창 순유입 역산 · reader 400d' },
  { prefix: 'insider-day-v1', keepDays: 401, why: '일별 accession 커서 · reader 400d' },
  { prefix: 'rtms-rent-v2', keepDays: 31, why: '월별 전월세 · 유일한 reader(rtms.ts) 과거월 30d' },
]

/** 규칙 자체 검사 — LIKE 와일드카드·구분자·중복·너무 짧은 보존 기간을 막는다(빈 배열이면 정상) */
export function validateRules(rules: PurgeRule[]): string[] {
  const errs: string[] = []
  const seen = new Set<string>()
  for (const r of rules) {
    if (!r.prefix || /[%_*:|\s\\]/.test(r.prefix)) errs.push(`접두어에 금지 문자: "${r.prefix}"`)
    if (seen.has(r.prefix)) errs.push(`중복 접두어: ${r.prefix}`)
    seen.add(r.prefix)
    if (!Number.isInteger(r.keepDays) || r.keepDays < 3) errs.push(`keepDays 는 3일 이상 정수: ${r.prefix}=${r.keepDays}`)
  }
  return errs
}

/** 이 행을 지워도 되는가 — 허용 목록 접두어 + `${prefix}:` 로 시작 + updated_at 이 keepDays 보다 오래됨 */
export function shouldPurge(key: string, updatedAtIso: string, nowMs: number, rules: PurgeRule[] = PURGE_RULES): boolean {
  const p = prefixOf(key)
  const rule = rules.find(r => r.prefix === p)
  if (!rule) return false
  if (!key.startsWith(`${rule.prefix}:`)) return false   // 접두어만 있는 키·'|' 구분 키는 건드리지 않는다
  const at = Date.parse(updatedAtIso)
  if (!Number.isFinite(at)) return false                 // 시각을 못 읽으면 남긴다
  return nowMs - at > rule.keepDays * DAY_MS
}

/** 규칙의 삭제 기준 시각(ISO) — 이보다 오래된 updated_at 만 후보 */
export function cutoffIso(rule: PurgeRule, nowMs: number): string {
  return new Date(nowMs - rule.keepDays * DAY_MS).toISOString()
}
