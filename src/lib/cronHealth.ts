// 크론 13개의 산출물(app_cache updated_at·DB 스냅샷)로 미발화를 감지하는 헬스 판정 SSOT
//    배경: 2026-08-01 타점 워처 크론이 조용히 미발화(코드 정상·수동 복구) → 재발 시 자동 감지·복구.
//    판정: lastExpected(KST·요일 반영) 대비 산출물 시각 — ok / pending(유예 45분) / stale.
//    ⚠️ 캐시 키는 전부 lib SSOT 상수 import(리터럴 복사 금지 — 키 버전업 시 자동 추종).
import { createClient } from '@supabase/supabase-js'
import { WIN_LOSE_KEY } from '@/lib/winLose'
import { MARKET_FLOW_KR_KEY } from '@/lib/marketFlowKr'
import { SAT_SCORE_KEY } from '@/lib/satelliteScreener'
import { UNIVERSE_KEY } from '@/lib/macroPhaseScreener'
import { FUND_CACHE_KEY } from '@/lib/guru13f'
import { BREADTH_KEY } from '@/lib/marketBreadth'

const GRACE_MS = 45 * 60_000            // 실행 지연 유예(가장 긴 크론 300s의 9배 — 오탐 방지)
const KST_MS = 9 * 3600_000

export type CronDays = 'daily' | 'weekday' | 'tue'   // tue = UTC 월요일 크론(KST 화요일 발화)

export interface CronMonitor {
  id: string
  label: string                          // 학생·선생님이 읽는 이름
  kst: string                            // 'HH:MM' 예정 시각(KST)
  days: CronDays
  artifact:
    | { type: 'cache'; key: () => string }                    // 고정 키 → updated_at 판정
    | { type: 'cacheDate'; key: (dateKst: string) => string } // 일자 키 → 존재 판정
    | { type: 'table'; name: string }                         // DB 테이블 max(base_date) 판정
  heal: string | null                    // 자동 복구 경로(null = 보고만)
  heavy?: boolean                        // 복구 시 마지막 순서(예산 가드)
  /** 워밍형 크론(라우트가 캐시 TTL로 재계산을 스스로 결정 — 크론이 돌아도 캐시가 신선하면 updated_at 불변).
   *  이 값이 있으면 '예정 시각' 대신 '최대 허용 나이(ttlH + 24h + 유예)'로 판정한다.
   *  근거: 사용자 방문이 캐시를 중간 갱신하면 다음 크론은 정상 실행돼도 스킵 → 예정 시각 판정은 오탐(라이브 대조로 확인). */
  ttlH?: number
}

// 크론 정의(vercel.json crons와 1:1 — 스케줄 바꾸면 여기도 갱신)
export const CRON_MONITORS: CronMonitor[] = [
  { id: 'nps', label: '국민연금 워밍', kst: '03:00', days: 'daily', artifact: { type: 'cache', key: () => 'nps-portfolio' }, heal: null, ttlH: 24 },
  { id: 'shadow13f', label: '슈퍼 클론 13F 워밍', kst: '03:00', days: 'daily', artifact: { type: 'cache', key: () => FUND_CACHE_KEY }, heal: null, ttlH: 12 },
  { id: 'satellite', label: '위성 점수', kst: '03:30', days: 'daily', artifact: { type: 'cache', key: () => SAT_SCORE_KEY }, heal: '/api/cron/satellite-scores' },
  { id: 'schoolIndex', label: '학교 13F 인덱스', kst: '04:00', days: 'daily', artifact: { type: 'table', name: 'school_index_stock_snapshots' }, heal: '/api/cron/school-index' },
  { id: 'macroPicks', label: '거시경제 AI 유니버스(주간)', kst: '04:00', days: 'tue', artifact: { type: 'cache', key: () => UNIVERSE_KEY }, heal: null },
  { id: 'briefing', label: 'Jarvis 모닝 처방전', kst: '05:00', days: 'daily', artifact: { type: 'table', name: 'user_daily_briefings' }, heal: '/api/cron/morning-briefing', heavy: true },
  { id: 'honeycomb', label: '부동산 벌집 워밍', kst: '05:30', days: 'daily', artifact: { type: 'cache', key: () => 're-honeycomb-v3' }, heal: '/api/re-honeycomb', ttlH: 24 },
  { id: 'blackrock', label: '블랙록 13F(주간)', kst: '06:00', days: 'tue', artifact: { type: 'cache', key: () => 'blackrock-13f-v2' }, heal: null },
  { id: 'timingWatch', label: '타점 전환 워처', kst: '08:30', days: 'daily', artifact: { type: 'cache', key: () => 'timing-watch-latest-v2' }, heal: '/api/cron/timing-watch' },
  { id: 'winLose', label: '승패 해부실', kst: '08:50', days: 'daily', artifact: { type: 'cacheDate', key: d => WIN_LOSE_KEY(d) }, heal: '/api/win-lose' },
  { id: 'techScreener', label: '기술 검색기 스캔', kst: '09:10', days: 'daily', artifact: { type: 'cacheDate', key: d => `tech-screener-v1:${d}` }, heal: '/api/tech-screener' },
  { id: 'hi52', label: '신고가 레이더 스캔', kst: '09:25', days: 'daily', artifact: { type: 'cacheDate', key: d => `hi52-radar-v2:${d}` }, heal: '/api/hi52-radar' },
  { id: 'breadth', label: '시장 폭 레이더 스캔', kst: '09:35', days: 'daily', artifact: { type: 'cacheDate', key: d => BREADTH_KEY(d) }, heal: '/api/market-breadth' },
  { id: 'marketFlowKr', label: '국내 시장 수급 워밍', kst: '20:00', days: 'weekday', artifact: { type: 'cacheDate', key: d => MARKET_FLOW_KR_KEY(d) }, heal: '/api/market-flow-kr' },
]

export interface HealthCheck {
  id: string
  label: string
  status: 'ok' | 'pending' | 'stale' | 'unknown'
  expected: string          // lastExpected ISO(KST 표기)
  lastRun: string | null    // 산출물 시각 ISO(있으면)
  healed?: boolean          // 이번 실행에서 자동 복구 성공
}

// KST 시프트 시각(now+9h를 UTC 게터로 읽는 앱 관례)
const kstNow = () => new Date(Date.now() + KST_MS)
const kstDateStr = (d: Date) => d.toISOString().slice(0, 10)

/** 지금 이전의 가장 최근 예정 시각(KST 시프트 좌표) — 요일 조건 반영, 최대 8일 역탐색 */
export function lastExpectedKst(now: Date, kst: string, days: CronDays): Date | null {
  const [hh, mm] = kst.split(':').map(Number)
  for (let back = 0; back < 9; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, hh, mm))
    if (d.getTime() > now.getTime()) continue
    const dow = d.getUTCDay()
    if (days === 'weekday' && (dow === 0 || dow === 6)) continue
    if (days === 'tue' && dow !== 2) continue
    return d
  }
  return null
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  // Next Data Cache 박제 방지(appCache와 동일 관례)
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (u, o) => fetch(u as RequestInfo, { ...o, cache: 'no-store' }) },
  })
}

/** 전 크론 판정 — app_cache 1쿼리 + DB 테이블 2쿼리 */
export async function runHealthChecks(): Promise<HealthCheck[]> {
  const db = admin()
  const now = kstNow()

  // 필요한 캐시 키 전부 수집(일자 키는 lastExpected의 KST 일자로)
  const wanted = new Map<string, string>()   // cacheKey -> monitor id
  const expectedMap = new Map<string, Date>()
  for (const m of CRON_MONITORS) {
    const exp = lastExpectedKst(now, m.kst, m.days)
    if (!exp) continue
    expectedMap.set(m.id, exp)
    if (m.artifact.type === 'cache') wanted.set(m.artifact.key(), m.id)
    else if (m.artifact.type === 'cacheDate') wanted.set(m.artifact.key(kstDateStr(exp)), m.id)
  }

  const updatedByKey = new Map<string, string>()
  if (db && wanted.size) {
    try {
      const { data } = await db.from('app_cache').select('key, updated_at').in('key', Array.from(wanted.keys()))
      for (const r of data ?? []) updatedByKey.set(String(r.key), String(r.updated_at))
    } catch { /* graceful — unknown 처리 */ }
  }

  // DB 테이블 max(base_date)
  const tableLatest = new Map<string, string>()
  if (db) {
    for (const t of ['user_daily_briefings', 'school_index_stock_snapshots']) {
      try {
        const { data } = await db.from(t).select('base_date').order('base_date', { ascending: false }).limit(1)
        if (data?.[0]?.base_date) tableLatest.set(t, String(data[0].base_date))
      } catch { /* graceful */ }
    }
  }

  return CRON_MONITORS.map((m): HealthCheck => {
    const exp = expectedMap.get(m.id)
    if (!exp || !db) return { id: m.id, label: m.label, status: 'unknown', expected: '', lastRun: null }
    const expIso = exp.toISOString().replace('.000Z', '+09:00')

    let artifactShifted: number | null = null   // KST 시프트 좌표의 산출물 시각
    let lastRun: string | null = null
    if (m.artifact.type === 'table') {
      const bd = tableLatest.get(m.artifact.name)
      if (bd) {
        lastRun = bd
        // base_date == 기대일이면 그 실행으로 간주(시각은 기대 시각으로)
        if (bd >= kstDateStr(exp)) artifactShifted = exp.getTime()
      }
    } else {
      const key = m.artifact.type === 'cache' ? m.artifact.key() : m.artifact.key(kstDateStr(exp))
      const u = updatedByKey.get(key)
      if (u) {
        lastRun = u
        artifactShifted = new Date(u).getTime() + KST_MS
      }
    }

    // 워밍형: 최대 허용 나이(ttl + 크론 주기 24h + 유예)로 판정 — 예정 시각 판정은 오탐(캐시 신선 시 크론 스킵)
    if (m.ttlH != null) {
      if (artifactShifted == null)
        return { id: m.id, label: m.label, status: 'stale', expected: expIso, lastRun }
      const ageMs = now.getTime() - artifactShifted
      const maxAgeMs = (m.ttlH + 24) * 3600_000 + GRACE_MS
      return { id: m.id, label: m.label, status: ageMs <= maxAgeMs ? 'ok' : 'stale', expected: expIso, lastRun }
    }
    // 스케줄형: 5분 이른 실행 허용
    if (artifactShifted != null && artifactShifted >= exp.getTime() - 5 * 60_000)
      return { id: m.id, label: m.label, status: 'ok', expected: expIso, lastRun }
    if (now.getTime() < exp.getTime() + GRACE_MS)
      return { id: m.id, label: m.label, status: 'pending', expected: expIso, lastRun }
    return { id: m.id, label: m.label, status: 'stale', expected: expIso, lastRun }
  })
}
