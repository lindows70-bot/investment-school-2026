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
// 키에서 날짜를 뺀 공유 문서 — 새 키엔 ':' 가 없어 대상이 아니다. 옛 날짜 행 잔여분만(reader 24h 이하 + 오늘(KST)만)
const UNDATED = (prefix: string, ttl: string): PurgeRule => ({ prefix, keepDays: 3, why: `날짜 뺀 공유 문서 · 옛 날짜 행만 · reader ${ttl}` })

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
  // btc-etf-v8(2026-09-27 편입): 앱 reader 는 오늘 키만(btc-etf 3h · crypto-demand 24h). scripts/seed-btc-etf-lastgood.mjs 는
  //   like 'btc-etf-v%' 최신 60행 중 flow 가 가장 늦은 문서 **하나**만 고르고, lastgood 보다 새것일 때만 쓴다 — 옛 문서가 지워져도
  //   lastgood(btc-etf-flow-lastgood-v1 · 라우트가 성공마다 갱신 · 규칙 밖)을 되돌리지 못한다. 옛 버전 v1~v7 문서는 접두어가 달라 남는다.
  DAILY('btc-etf-v8', '24h(crypto-demand) · seed 는 최신 1건만'),
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
  // 2026-09-27 추가(M1) — 날짜 키인데 목록에 없던 사용자별 12종. fp 가 바뀌면 어차피 옛 키가 버려져 정리 규칙이 필요하다
  PER_USER('alpha-hunter-v3', '24h'),
  PER_USER('earn-results-v1', '6h'),
  PER_USER('fx-attribution-v2', '6h'),
  PER_USER('guidance-radar', '24h'),
  PER_USER('lynch-matrix-v2', '12h'),
  PER_USER('morningstar-rating-v6', '24h'),
  PER_USER('permanent-loss-v2', '12h'),
  PER_USER('portfolio-backtest-v5', '12h'),
  PER_USER('portfolio-flow-v12', '12h'),
  PER_USER('portfolio-reco-kr-v8', '12h'),
  PER_USER('tax-helper-v1', '6h'),
  PER_USER('weekly-report-me-v6', '6h(교사 열람 키 포함)'),
  PER_USER('corr-matrix-v2', '24h'),   // M1 목록 밖 — 날짜 키 커밋 검사(cacheDateGuard)로 src 전수를 훑다 발견

  // 키에서 날짜를 뺀 공유 문서 5종(2026-09-27)
  UNDATED('bonds-v8', '6h'),
  UNDATED('crypto-demand-v2', '6h'),
  UNDATED('dividend-portfolio-v2', '12h'),
  UNDATED('ultra-dividend-v4', '12h'),
  UNDATED('cofix-v1', '12h'),

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

/** 한 번 실행에서 규칙 하나가 쓸 수 있는 묶음 수 — 앞 규칙의 밀린 행이 예산을 다 먹지 않게 */
export const MAX_BATCHES_PER_RULE = 5

/**
 * 오늘 규칙을 도는 순서(인덱스) — 시작점을 KST 연중 일자로 날마다 한 칸씩 돌린다.
 * 매번 0번부터 돌면 20초 예산을 앞 규칙이 다 써서 맨 끝(rtms-rent-v2 — 행당 최대)이 영영 밀린다.
 */
export function purgeOrder(n: number, nowMs: number): number[] {
  if (n <= 0) return []
  const kst = new Date(nowMs + 9 * 3600_000)
  const dayOfYear = Math.floor((Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - Date.UTC(kst.getUTCFullYear(), 0, 1)) / DAY_MS)
  const start = dayOfYear % n
  return Array.from({ length: n }, (_, i) => (start + i) % n)
}

/**
 * delete 의 in(keys) 묶음 — 개수(maxCount)와 URL 바이트(maxBytes, 인코딩 후)를 둘 다 넘지 않게 자른다.
 * PostgREST 는 `key=in.("k1","k2")` 로 URL 에 싣는다 — 사용자 id 가 든 긴 키 100개면 8 KB 를 넘을 수 있다.
 * 키 하나가 혼자 상한을 넘으면 그 키만 한 묶음으로 둔다(버리지 않는다 — 판정은 이미 끝났다).
 */
export function chunkKeys(keys: string[], maxCount = 100, maxBytes = 8 * 1024): string[][] {
  const out: string[][] = []
  let cur: string[] = []
  let bytes = 0
  for (const k of keys) {
    const b = encodeURIComponent(`"${k}"`).length + 3   // 구분자 ',' 인코딩(%2C)
    if (cur.length && (cur.length >= maxCount || bytes + b > maxBytes)) { out.push(cur); cur = []; bytes = 0 }
    cur.push(k)
    bytes += b
  }
  if (cur.length) out.push(cur)
  return out
}
