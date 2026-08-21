// ⏱️ 로테이션 시계 성적표 SSOT — 사분면 스냅샷 적립 + 4규칙 전향 채점(2026-08-21, 사용자 승인 설계)
//
// 왜: "시계대로 매매하면 기준선을 이기나" 논쟁은 소급 백테스트로 정산 불가(테마 멤버십 선별 편향 —
//     17섹터 +712% vs GICS만 +104% 실측). 오늘부터의 **전향 기록**만이 답한다. 90일 첫 판정·1년 결론.
// ⛔ 소급 백필 금지(시뮬 오염 유입) · 6축 점수 미반영(WHAT/WHEN 분리) · 매매 지시 아님(관측·채점)
import { getCache, setCache } from '@/lib/appCache'
import { SECTOR_ROTATION_KEY, type RotQuadShared } from '@/lib/rotationShared'

/** 사분면 스냅샷 이력 키 — writer: sector-rotation(신규 계산 시) + scorecard(self-heal). 날짜 중복 금지 */
export const ROT_QUAD_HIST_KEY = 'rot-quad-hist-v1'
const HIST_CAP = 600

export interface QuadSnapshot { d: string; q: Record<string, RotQuadShared> }

/** 채점 프록시 — 학생이 실제로 살 물건 기준(ETF 우선). Phase 0 실측 2026-08-21: 17/17 시세 정상.
 *  ⚠️ AI바이오만 섹터 ETF 부재 → 앵커(대장주) 프록시 — 화면에 반드시 명시(단일 종목 노이즈 존재) */
export const SECTOR_PROXY: Record<string, { sym: string; kind: 'etf' | 'anchor' }> = {
  energy: { sym: 'XLE', kind: 'etf' }, materials: { sym: 'XLB', kind: 'etf' },
  industrials: { sym: 'XLI', kind: 'etf' }, discretionary: { sym: 'XLY', kind: 'etf' },
  staples: { sym: 'XLP', kind: 'etf' }, healthcare: { sym: 'XLV', kind: 'etf' },
  financials: { sym: 'XLF', kind: 'etf' }, infotech: { sym: 'XLK', kind: 'etf' },
  communication: { sym: 'XLC', kind: 'etf' }, utilities: { sym: 'XLU', kind: 'etf' },
  realestate: { sym: 'XLRE', kind: 'etf' },
  'ai-semi': { sym: 'SMH', kind: 'etf' }, defense: { sym: 'ITA', kind: 'etf' },
  quantum: { sym: 'QTUM', kind: 'etf' }, power: { sym: 'GRID', kind: 'etf' },
  'phys-ai': { sym: 'BOTZ', kind: 'etf' }, 'ai-bio': { sym: 'TEM', kind: 'anchor' },
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 스냅샷 append(날짜 중복이면 무시·불변 기록). 두 writer(로테이션 계산·성적표 self-heal) 모두 이것만 쓴다 */
export async function appendQuadSnapshot(date: string, items: { key: string; quadrant: RotQuadShared }[]): Promise<boolean> {
  if (!items?.length) return false
  const hist = (await getCache<QuadSnapshot[]>(ROT_QUAD_HIST_KEY, 3650 * 86400_000)) ?? []
  if (hist.some(h => h.d === date)) return false          // 하루 한 장 — 이미 있으면 기존 기록 불변(수정 불가 원칙)
  const q: Record<string, RotQuadShared> = {}
  for (const it of items) if (it.key && it.quadrant) q[it.key] = it.quadrant
  if (Object.keys(q).length < 10) return false            // 판정 부실한 날은 적립하지 않는다(부분실패 박제 금지)
  hist.push({ d: date, q })
  hist.sort((a, b) => a.d.localeCompare(b.d))
  await setCache(ROT_QUAD_HIST_KEY, hist.slice(-HIST_CAP))
  return true
}

/** self-heal — 오늘 스냅샷이 없고 오늘의 로테이션 캐시가 있으면 거기서 적립(같은 데이터·결정론) */
export async function ensureTodaySnapshot(): Promise<void> {
  try {
    const today = kstDate()
    const hist = (await getCache<QuadSnapshot[]>(ROT_QUAD_HIST_KEY, 3650 * 86400_000)) ?? []
    if (hist.some(h => h.d === today)) return
    const rot = await getCache<{ items?: { key: string; quadrant: RotQuadShared }[] }>(SECTOR_ROTATION_KEY(today), 24 * 3600_000)
    if (rot?.items?.length) await appendQuadSnapshot(today, rot.items)
  } catch { /* 성적표는 부가 기능 — 실패해도 조용히 */ }
}

// ── 채점(순수 함수) ──────────────────────────────────────────────────────────
export type RuleKey = 'A' | 'B' | 'C' | 'D'
export interface ScorecardResult {
  startDate: string; days: number; sampleGate: number
  /** 스냅샷 날짜별 자산(1 = 시작) — 차트용 */
  curve: { d: string; A: number; B: number; C: number; D: number }[]
  stats: Record<RuleKey, { total: number; mdd: number; heldNow: number }>
  basketToday: string[]           // A 규칙이 지금 들고 있는 섹터 키(주도∪과열)
  proxyNote: string
}

/** closesBySym: sym → { dates asc, closes } (US 캘린더). KST 스냅샷일 d 에는 'd 이하 마지막 종가'를 쓴다 */
export function computeScorecard(
  histRaw: QuadSnapshot[],
  closes: Record<string, { dates: string[]; closes: number[] }>,
  sampleGate = 90,
): ScorecardResult | null {
  // 날짜 중복 제거(먼저 적립된 기록 우선 — 불변 원칙) + 정렬
  const seen = new Set<string>()
  const hist = histRaw.filter(h => (seen.has(h.d) ? false : (seen.add(h.d), true))).sort((a, b) => a.d.localeCompare(b.d))
  if (hist.length === 0) return null
  const keys = Object.keys(SECTOR_PROXY)

  const lastCloseAt = (sym: string, d: string): number | null => {
    const s = closes[sym]; if (!s) return null
    let lo = 0, hi = s.dates.length - 1, ans = -1
    while (lo <= hi) { const m = (lo + hi) >> 1; if (s.dates[m] <= d) { ans = m; lo = m + 1 } else hi = m - 1 }
    return ans >= 0 ? s.closes[ans] : null
  }

  // 규칙별 상태 — 신호는 다음 스냅샷일부터 반영
  const held: Record<RuleKey, Set<string>> = { A: new Set(), B: new Set(), C: new Set(keys), D: new Set() }
  const eq: Record<RuleKey, number> = { A: 1, B: 1, C: 1, D: 1 }
  const peak: Record<RuleKey, number> = { A: 1, B: 1, C: 1, D: 1 }
  const mdd: Record<RuleKey, number> = { A: 0, B: 0, C: 0, D: 0 }
  const curve: ScorecardResult['curve'] = [{ d: hist[0].d, A: 1, B: 1, C: 1, D: 1 }]

  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1], cur = hist[i]
    // ① 어제까지의 판정으로 오늘 보유 확정(다음 날 반영)
    for (const k of keys) {
      const q = prev.q[k]; if (!q) continue
      const p = i >= 2 ? hist[i - 2].q[k] : undefined
      // A: 주도∪과열이면 보유
      if (q === 'leading' || q === 'weakening') held.A.add(k); else held.A.delete(k)
      // B: 태동→주도 교차 매수 · 이탈 매도(그 외 유지)
      if (!held.B.has(k)) { if (p === 'improving' && q === 'leading') held.B.add(k) }
      else if (q === 'lagging') held.B.delete(k)
      // D: 반대 대조군
      if (q === 'lagging' || q === 'improving') held.D.add(k); else held.D.delete(k)
    }
    // ② 스냅샷일 간 프록시 수익률로 자산 갱신
    const ret = (set: Set<string>): number => {
      let s = 0, n = 0
      for (const k of Array.from(set)) {
        const a = lastCloseAt(SECTOR_PROXY[k].sym, cur.d), b = lastCloseAt(SECTOR_PROXY[k].sym, prev.d)
        if (a != null && b != null && b > 0) { s += a / b - 1; n++ }
      }
      return n ? s / n : 0
    }
    for (const r of ['A', 'B', 'C', 'D'] as RuleKey[]) {
      eq[r] *= 1 + ret(held[r])
      if (eq[r] > peak[r]) peak[r] = eq[r]
      mdd[r] = Math.max(mdd[r], 1 - eq[r] / peak[r])
    }
    curve.push({ d: cur.d, A: +eq.A.toFixed(4), B: +eq.B.toFixed(4), C: +eq.C.toFixed(4), D: +eq.D.toFixed(4) })
  }

  const latest = hist[hist.length - 1]
  const basketToday = keys.filter(k => latest.q[k] === 'leading' || latest.q[k] === 'weakening')
  const stats = Object.fromEntries((['A', 'B', 'C', 'D'] as RuleKey[]).map(r => [r, {
    total: +((eq[r] - 1) * 100).toFixed(2), mdd: +(mdd[r] * 100).toFixed(1), heldNow: held[r].size,
  }])) as ScorecardResult['stats']

  return {
    startDate: hist[0].d, days: hist.length, sampleGate, curve, stats, basketToday,
    proxyNote: 'GICS 11=미국 섹터 ETF(SPDR) · 테마=대표 ETF(SMH·ITA·QTUM·GRID·BOTZ) · AI바이오=대장주(TEM) 프록시',
  }
}
