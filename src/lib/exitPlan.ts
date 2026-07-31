// 🚪 출구 플랜 SSOT — 보유 종목의 매도 계획(두 참고선 + 매도 압력 집계 + 결정론 행동 한 줄)
// 매수 플랜 카드(TradePlanCard)의 거울: 매수엔 1%룰·분할이 있는데 매도 계획이 없던 비대칭 해소.
// 전부 기존 SSOT 재사용(캔들 일별 캐시·timingFromCandles·rotation 캐시·Jarvis 판정) — 신규 판정기 0.
// ⛔ 매도 지시 아님(참고선·신호 집계) · 저점 매도 강요 금지 · 자동매매 없음.
import { getTechCandles } from './techChartData'
import { timingFromCandles } from './entryTiming'
import { loadRotationBySector, SECTOR_TO_ROT, type RotQuadShared } from './rotationShared'
import { getSector } from './schoolIndex'
import { getCanonicalFundamentals, isPegBaseEffect } from './canonicalFundamentals'
import { getMoneyFlow } from './moneyFlow'
import { getCurrentSeason } from './currentSeason'
import { holdingFit, type Quadrant } from './seasonNavigator'
import { classifyLynchMece } from './lynchAnalysis'

export interface ExitSignal { icon: string; label: string; detail: string }

// ── 🧭 매수 이유 유효성 점검("산 이유가 아직 맞는가") ──────────────────────
// 매수 순간 박제된 snapshot_data(decision-snapshot)와 현재 SSOT 값을 대조.
// 린치: "산 이유가 사라지면 판다" — 손절을 감정이 아니라 근거 소멸로 판단하게 훈련.
export interface BuySnapshot {
  peg?: number | null; growth_rate?: number | null; opMargin?: number | null
  flow?: string | null; seasonTag?: string | null; sector?: string | null; category?: string | null
}
export interface ThesisAxis { icon: string; label: string; then: string; now: string; state: 'ok' | 'chg' | 'bad' }
export interface ThesisCheck { boughtAt: string; verdict: 'intact' | 'partial' | 'broken'; axes: ThesisAxis[] }

const fmtPeg = (v: number) => v.toFixed(2)
const fmtOm = (v: number) => `${Math.round(v * 1000) / 10}%`
const FLOW_KO: Record<string, string> = { INFLOW: '유입', CROWDED: '이탈', NEGLECTED: '소외', NEUTRAL: '중립' }
const TAG_KO: Record<string, string> = { favored: '유리', neutral: '중립', unfavored: '불리' }

/** 매수 시점 스냅샷 vs 현재 값 → 축별 상태 + 종합 판정(결정론).
 *  임계는 전부 기존 SSOT 관례: PEG 저평가 <1 · 고평가 >2.2(Jarvis SELL) · 영업적자 −10%(opLoss) ·
 *  seasonTag 75/50(decision-snapshot과 동일 holdingFit 공식). */
export function computeThesis(
  snap: BuySnapshot, boughtAt: string,
  now: { peg: number | null; growth: number | null; opMargin: number | null; flow: string | null; seasonTag: string | null },
): ThesisCheck | null {
  const axes: ThesisAxis[] = []

  // 💎 가치(PEG) — 핵심축
  if (snap.peg != null && now.peg != null) {
    const thenLow = snap.peg < 1, nowHigh = now.peg > 2.2
    const state: ThesisAxis['state'] =
      thenLow && nowHigh ? 'bad'
      : thenLow && now.peg >= 1 ? 'chg'
      : !thenLow && snap.peg <= 2.2 && nowHigh ? 'chg'
      : 'ok'
    const baseNote = isPegBaseEffect(now.peg, now.growth) ? '(기저효과 의심)' : ''
    axes.push({ icon: '💎', label: 'PEG', then: fmtPeg(snap.peg), now: fmtPeg(now.peg) + baseNote, state })
  }
  // 📊 이익 체력(영업이익률) — 핵심축(린치: 이익 훼손이 진짜 매도 사유)
  if (snap.opMargin != null && now.opMargin != null) {
    const state: ThesisAxis['state'] =
      snap.opMargin > 0 && now.opMargin <= -0.10 ? 'bad'
      : snap.opMargin > 0 && now.opMargin < 0 ? 'chg'
      : 'ok'
    axes.push({ icon: '📊', label: '영업이익률', then: fmtOm(snap.opMargin), now: fmtOm(now.opMargin), state })
  }
  // 📡 수급 — 보조축(빨리 변하는 축이라 판정 가중 낮음)
  if (snap.flow && now.flow && FLOW_KO[snap.flow] && FLOW_KO[now.flow]) {
    const state: ThesisAxis['state'] =
      snap.flow === 'INFLOW' && now.flow === 'CROWDED' ? 'bad'
      : now.flow === 'CROWDED' && snap.flow !== 'CROWDED' ? 'chg'
      : snap.flow === 'INFLOW' && now.flow !== 'INFLOW' ? 'chg'
      : 'ok'
    axes.push({ icon: '📡', label: '수급', then: FLOW_KO[snap.flow], now: FLOW_KO[now.flow], state })
  }
  // 🌦️ 계절 — 보조축
  if (snap.seasonTag && now.seasonTag && TAG_KO[snap.seasonTag] && TAG_KO[now.seasonTag]) {
    const state: ThesisAxis['state'] =
      snap.seasonTag === 'favored' && now.seasonTag === 'unfavored' ? 'bad'
      : snap.seasonTag !== now.seasonTag && now.seasonTag !== 'favored' ? 'chg'
      : 'ok'
    axes.push({ icon: '🌦️', label: '계절', then: TAG_KO[snap.seasonTag], now: TAG_KO[now.seasonTag], state })
  }

  if (axes.length === 0) return null
  const bad = axes.filter(a => a.state === 'bad')
  const chg = axes.filter(a => a.state === 'chg')
  const profitBad = bad.some(a => a.label === '영업이익률')
  const valueBad = bad.some(a => a.label === 'PEG')
  const verdict: ThesisCheck['verdict'] =
    profitBad ? 'broken'                                     // 이익 체력 훼손은 단독으로도 thesis 붕괴(린치)
    : valueBad && (bad.length >= 2 || chg.length >= 1) ? 'broken'
    : valueBad ? 'partial'                                   // 가격 근거만 약화 — 단순 고평가로 손절 강요 금지
    : bad.length >= 1 || chg.length >= 2 ? 'partial'
    : 'intact'
  return { boughtAt, verdict, axes }
}

export interface ExitPlanItem {
  ticker: string; name: string; market: 'KR' | 'US'
  price: number; avgPrice: number; qty: number; pnlPct: number
  /** 🛎️ 이익 보호선 = 샹들리에(22봉 최고가 − 3×ATR22) — 번 것을 지키는 선 */
  protLine: number | null; protDistPct: number | null; protBroken: boolean
  /** 🛡️ 최후 방어선 = 구름 하단 — 여기까지 깨지면 장기 구조 붕괴 */
  defLine: number; defDistPct: number; defBroken: boolean   // defBroken = cloud === 'below'
  light: 'green' | 'yellow' | 'red'
  signals: ExitSignal[]          // 켜진 매도 압력 신호만
  fund: 'SELL' | 'BUY' | 'HOLD' | null   // Jarvis 최신 펀더 판정(WHAT축)
  action: string                 // 결정론 행동 한 줄(학생 언어)
  rotQuad: RotQuadShared | null
  /** 🧭 산 이유 점검 — 매수 시점 스냅샷 대비. null = 기록 없음(6/19 기록 시작 이전 매수) */
  thesis: ThesisCheck | null
}

export interface ExitHolding { ticker: string; name: string; market: 'KR' | 'US'; avgPrice: number; qty: number }

const pctOf = (price: number, line: number) => Math.round((price / line - 1) * 1000) / 10

/** 보유 1종목 → 출구 플랜. 224봉 미만(신생·미해석 ETF)은 null — 정직 생략 */
async function buildOne(
  h: ExitHolding,
  fund: ExitPlanItem['fund'],
  rotBySector: Map<string, { q: RotQuadShared }> | null,
  snap: (BuySnapshot & { boughtAt: string }) | null,
  quads: { us: Quadrant | null; kr: Quadrant | null },
  base: string,
): Promise<ExitPlanItem | null> {
  const D = await getTechCandles(h.ticker, h.market, 'D')
  if (!D || D.length < 225) return null
  const t = timingFromCandles(D)
  if (!t) return null

  const price = t.price
  const pnlPct = h.avgPrice > 0 ? Math.round((price / h.avgPrice - 1) * 1000) / 10 : 0
  const chand = t.chand ?? null
  const defBroken = t.cloud === 'below'

  // ── 매도 압력 신호 집계(켜진 것만 — 발명 없음, 전부 기존 검증 신호) ──
  const signals: ExitSignal[] = []
  if (t.trendBreak) signals.push({ icon: '🚨', label: '구조 붕괴', detail: 'EMA 역배열+구름 아래 — 최후 방어선까지 무너짐' })
  else if (defBroken) signals.push({ icon: '🛡️', label: '방어선 아래', detail: '구름 하단 이탈 — 구조 약화(역배열 전이면 아직 최후는 아님)' })
  if (chand?.broken && pnlPct > 0) signals.push({ icon: '🛎️', label: '이익 보호선 이탈', detail: `샹들리에(22봉 고점−3×ATR) 아래 — 수익 반납 진행 중` })
  if (t.raschke?.bearDiv) signals.push({ icon: '📉', label: '하락 다이버전스', detail: '주가 고점↑ vs RSI↓ — 상승 에너지 소진' })
  if (t.supply?.overExtended && t.supply.vwapDistPct != null) signals.push({ icon: '⚓', label: `과대이격 +${t.supply.vwapDistPct}%`, detail: '기관평단 대비 크게 위 — 되돌림·차익실현 리스크' })
  if (t.supply?.sharpDrop && t.supply.dropFromHigh != null) signals.push({ icon: '📉', label: `급락 ${t.supply.dropFromHigh}%`, detail: '최근 고점 대비 급락 진행 — 물타기 전 thesis 재점검' })

  // 섹터 로테이션 국면(캐시 읽기만 — 콜드면 생략)
  let rotQuad: RotQuadShared | null = null
  try {
    const gics = await getSector(h.ticker, h.market)
    const rotKey = gics ? SECTOR_TO_ROT[gics] : undefined
    rotQuad = (rotKey ? rotBySector?.get(rotKey)?.q : null) ?? null
    if (rotQuad === 'weakening') signals.push({ icon: '🍂', label: '섹터 과열(익절 국면)', detail: '보유 섹터가 로테이션 과열 — 강했으나 모멘텀 꺾이는 중' })
    if (rotQuad === 'lagging') signals.push({ icon: '🍂', label: '섹터 자금 이탈', detail: '보유 섹터에서 자금이 빠지는 국면' })
  } catch { /* graceful — 섹터 미확인이면 신호 생략 */ }

  if (fund === 'SELL') signals.push({ icon: '🧠', label: '펀더 매도검토', detail: 'Jarvis 정량 룰(고PEG·마진 연속 하락·FCF 적자·칼날) 발동 — WHAT축 경고' })

  // 🧭 산 이유 점검 — 매수 시점 스냅샷 vs 현재(전부 캐시된 SSOT: canonical 6h·moneyFlow 일별)
  let thesis: ThesisCheck | null = null
  if (snap) {
    try {
      const [cf, mf] = await Promise.all([
        getCanonicalFundamentals(h.ticker, h.market, base).catch(() => null),
        getMoneyFlow(h.ticker, h.market, h.name).catch(() => null),
      ])
      // 계절 now = decision-snapshot과 동일 공식(holdingFit 75/50) — 섹터는 스냅샷 GICS 재사용(드리프트·재fetch 방지)
      let seasonTagNow: string | null = null
      const quad = h.market === 'KR' ? quads.kr : quads.us
      if (quad) {
        const lynch = classifyLynchMece(null, cf?.growth ?? null, snap.sector ?? null).cat
        const fit = Math.round(holdingFit({ ticker: '', weight: 0, lynchCategory: lynch === 'na' ? null : lynch, sector: snap.sector ?? undefined }, quad) * 100)
        seasonTagNow = fit >= 75 ? 'favored' : fit <= 50 ? 'unfavored' : 'neutral'
      }
      const flowNow = mf && mf.status !== 'UNSUPPORTED' ? mf.status : null
      thesis = computeThesis(snap, snap.boughtAt, {
        peg: cf?.peg ?? null, growth: cf?.growth ?? null, opMargin: cf?.opMargin ?? null,
        flow: flowNow, seasonTag: seasonTagNow,
      })
    } catch { /* graceful — 점검 실패 시 표시 생략 */ }
  }

  // ── 결정론 행동 한 줄(우선순위 — 학생 언어·저점 매도 강요 금지) ──
  let action: string
  if (t.trendBreak) {
    action = pnlPct < -15
      ? '구조가 무너졌지만 깊은 손실 중 — 전량 투매 금물. 반등(구름 하단 회복 시도)에 일부만 축소하며 thesis 재점검'
      : '최후 방어선까지 무너짐 — 반등 시 비중 축소 우선. 재무가 좋아도 기회비용을 생각할 자리'
  } else if (chand?.broken && pnlPct > 0) {
    action = `번 것(+${pnlPct}%)을 지킬 구간 — 이익 보호선 이탈, 일부 익절로 수익 확정 검토(전량 아님)`
  } else if (pnlPct > 0 && (t.raschke?.bearDiv || t.supply?.overExtended)) {
    action = '수익 중 + 에너지 소진 신호 — 분할 익절 검토 구간(추세 유지분은 보유)'
  } else if (fund === 'SELL' && signals.length > 1) {
    action = '펀더 경고 + 기술 신호 동시 — 정리 우선순위 상위. 반등을 정리 기회로'
  } else if (signals.length > 0 && pnlPct < 0 && fund !== 'SELL') {
    action = '신호 점검 중 — 펀더가 멀쩡하면 변동성일 수 있음(무서워서 파는 건 손실 확정). 방어선 사수 여부만 확인'
  } else if (signals.length === 0) {
    action = '출구 조건 미발동 — 보유 유지. 아래 두 참고선만 기억'
  } else {
    action = '경계 신호 있음 — 신규 추가매수는 보류, 참고선 이탈 시 대응'
  }

  if (thesis?.verdict === 'broken') action += ' · 🧭 산 이유(매수 근거)도 훼손 — 아래 점검 참조'

  return {
    ticker: h.ticker, name: h.name, market: h.market,
    price, avgPrice: h.avgPrice, qty: h.qty, pnlPct,
    protLine: chand?.line ?? null,
    protDistPct: chand ? chand.distPct : null,
    protBroken: !!chand?.broken,
    defLine: t.cloudBottom,
    defDistPct: pctOf(price, t.cloudBottom),
    defBroken,
    light: t.light,
    signals, fund, action, rotQuad, thesis,
  }
}

/** 보유 전체 → 출구 플랜 목록(동시성 4). 신호 많은 순 → 손익 순 정렬 */
export async function buildExitPlans(
  holdings: ExitHolding[],
  fundMap: Map<string, ExitPlanItem['fund']>,
  snapMap: Map<string, BuySnapshot & { boughtAt: string }>,
  base: string,
): Promise<{ items: ExitPlanItem[]; skipped: string[] }> {
  const rotBySector = await loadRotationBySector().catch(() => null)
  const season = await getCurrentSeason(base).catch(() => null)
  const quads = { us: (season?.usQuad ?? null) as Quadrant | null, kr: (season?.krQuad ?? null) as Quadrant | null }
  const items: ExitPlanItem[] = []
  const skipped: string[] = []
  const q = [...holdings]
  async function worker() {
    while (q.length) {
      const h = q.shift(); if (!h) break
      try {
        const it = await buildOne(h, fundMap.get(h.ticker.toUpperCase()) ?? null, rotBySector, snapMap.get(h.ticker.toUpperCase()) ?? null, quads, base)
        if (it) items.push(it); else skipped.push(h.ticker)
      } catch { skipped.push(h.ticker) }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  items.sort((a, b) => b.signals.length - a.signals.length || a.pnlPct - b.pnlPct)
  return { items, skipped }
}
