// 🛰️ AI 1억 백지 퀀트 빌더 엔진 — 코어-새틀라이트 설계 본체(route와 copy가 공유)
// Core(50~70%): 국면별 시장 ETF(SPY·QQQ·SCHD) · Satellite(30~50%): 3축 SSOT(버핏 ROE·린치 PEG·수급) 통과 5~7종
// 모든 점수는 unified-reco SSOT 재사용(제2원칙 — 통합매수와 동일 점수·동일 기저효과 가드) · ETF 투시경으로 실질 섹터 합성
import { getCache, setCache } from '@/lib/appCache'
import { getEtfComposition } from '@/lib/etfLookThrough'
import type { UnifiedRecoResult, UnifiedRecoItem } from '@/app/api/unified-reco/route'
import type { Quadrant } from '@/lib/seasonNavigator'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// ── 국면별 Core 설계(교육용 고정 룰 — 박제 아님: 국면이 바뀌면 자동으로 바뀜) ──────
// coreRatio: 국면이 위험할수록 Core(시장 ETF) 비중↑ — 50~70% 범위
const CORE_PLAN: Record<Quadrant, { coreRatio: number; mix: { ticker: string; name: string; weight: number; role: string }[]; rationale: string }> = {
  goldilocks: {
    coreRatio: 50,
    mix: [
      { ticker: 'QQQ',  name: 'Invesco QQQ (나스닥100)',   weight: 40, role: '성장 엔진' },
      { ticker: 'SPY',  name: 'SPDR S&P 500',              weight: 40, role: '시장 본체' },
      { ticker: 'SCHD', name: 'Schwab 미국 배당 (SCHD)',   weight: 20, role: '배당 안전판' },
    ],
    rationale: '골디락스(성장↑·물가↓) — 성장주가 가장 빛나는 국면이라 Core를 최소(50%)로 줄이고 QQQ 비중을 키워 위성과 함께 공격적으로.',
  },
  inflation: {
    coreRatio: 60,
    mix: [
      { ticker: 'SPY',  name: 'SPDR S&P 500',              weight: 40, role: '시장 본체' },
      { ticker: 'SCHD', name: 'Schwab 미국 배당 (SCHD)',   weight: 35, role: '배당 안전판' },
      { ticker: 'QQQ',  name: 'Invesco QQQ (나스닥100)',   weight: 25, role: '성장 엔진' },
    ],
    rationale: '인플레이션(성장↑·물가↑) — 금리 부담으로 성장주 멀티플이 눌리는 국면. 배당(SCHD)을 키우고 Core 60%로 무게중심을 낮춥니다.',
  },
  stagflation: {
    coreRatio: 70,
    mix: [
      { ticker: 'SCHD', name: 'Schwab 미국 배당 (SCHD)',   weight: 45, role: '배당 안전판' },
      { ticker: 'SPY',  name: 'SPDR S&P 500',              weight: 40, role: '시장 본체' },
      { ticker: 'QQQ',  name: 'Invesco QQQ (나스닥100)',   weight: 15, role: '성장 엔진' },
    ],
    rationale: '스태그플레이션(성장↓·물가↑) — 4계절 중 가장 어려운 국면. Core를 최대(70%)로 올리고 배당 중심으로 버팁니다.',
  },
  recession: {
    coreRatio: 70,
    mix: [
      { ticker: 'SPY',  name: 'SPDR S&P 500',              weight: 45, role: '시장 본체' },
      { ticker: 'SCHD', name: 'Schwab 미국 배당 (SCHD)',   weight: 40, role: '배당 안전판' },
      { ticker: 'QQQ',  name: 'Invesco QQQ (나스닥100)',   weight: 15, role: '성장 엔진' },
    ],
    rationale: '리세션(성장↓·물가↓) — 금리 인하가 오기 전까지 방어 우선. Core 70%로 시장 평균에 묻어가며 위성은 최정예만.',
  },
  shoulder: {
    coreRatio: 65,
    mix: [
      { ticker: 'SPY',  name: 'SPDR S&P 500',              weight: 40, role: '시장 본체' },
      { ticker: 'SCHD', name: 'Schwab 미국 배당 (SCHD)',   weight: 35, role: '배당 안전판' },
      { ticker: 'QQQ',  name: 'Invesco QQQ (나스닥100)',   weight: 25, role: '성장 엔진' },
    ],
    rationale: '간절기(지표 상충) — 방향이 불확실할 땐 시장 평균에 가깝게. Core 65%의 중립 배합으로 명확한 국면을 기다립니다.',
  },
}

// ── 3축 판정(SSOT 값 기반) — pass/fail/na를 투명하게 기록(왜 뽑혔는지 설명 가능) ──
export type AxisStatus = 'pass' | 'fail' | 'na'
export interface SatelliteAxes {
  buffett: AxisStatus   // 🏰 ROE ≥ 15% + Fwd EPS 추정 하향 아님
  lynch:   AxisStatus   // 💎 0 < PEG ≤ 1.0 + 기저효과 가드(suspect=fail)
  supply:  AxisStatus   // 📡 수급 점수 ≥ 60(쌍끌이·스마트머니)
}
function judgeAxes(it: UnifiedRecoItem): SatelliteAxes {
  const suspect = it.badges.includes('⚠️ 저PEG 기저효과 의심')
  const buffett: AxisStatus = it.roe == null ? 'na'
    : it.roe >= 0.15 ? (it.epsRevision === 'down' ? 'fail' : 'pass') : 'fail'
  const lynch: AxisStatus = suspect ? 'fail'
    : it.peg == null ? 'na'
    : it.peg > 0 && it.peg <= 1.0 ? 'pass' : 'fail'
  const supply: AxisStatus = !it.supplyKnown ? 'na'
    : it.supplyScore >= 60 ? 'pass' : it.supplyScore < 45 ? 'fail' : 'na'
  return { buffett, lynch, supply }
}

export interface QuantSatellite {
  ticker: string; name: string; market: string; sector: string
  combined: number; peg: number | null; roePct: number | null; epsRevision: string | null; supplyScore: number
  axes: SatelliteAxes
  passCount: number              // 3축 중 pass 수(3=최정예, 2=정예)
  weightPct: number              // 총투자금 대비 비중 %
  badges: string[]
}
export interface QuantBuilderResult {
  quadrant: Quadrant
  seasonLabel: string
  coreRatio: number              // Core % (50~70)
  satelliteRatio: number
  rationale: string
  core: { ticker: string; name: string; role: string; mixPct: number; weightPct: number }[]   // mixPct=Core 내, weightPct=전체
  satellites: QuantSatellite[]
  effectiveSectors: { sector: string; weightPct: number }[]   // ETF 투시경 합성 실질 섹터(전체 기준)
  axisRule: string
  warming: boolean               // 유니버스 캐시 콜드(크론 전) — 위성 비어있을 수 있음
  asOf: string
}

/** 빌드 본체 — GET과 copy(POST)가 공유. base=요청 origin, cookie=인증 전달용 */
export async function buildQuantPlan(base: string, cookie: string): Promise<QuantBuilderResult | null> {
  const cacheKey = `quant-builder-v1:${kstDate()}`   // 보유 무관(백지) — 전 사용자 공유 캐시
  const cached = await getCache<QuantBuilderResult>(cacheKey, 12 * 3600_000)
  if (cached && !cached.warming) return cached

  // ① 위성 후보 = 통합추천 SSOT(점수·기저효과 가드 동일 — 제2원칙)
  let ur: UnifiedRecoResult | null = null
  try {
    const r = await fetch(`${base}/api/unified-reco`, { headers: { cookie }, signal: AbortSignal.timeout(50_000) })
    if (r.ok) ur = await r.json()
  } catch { /* graceful */ }
  if (!ur || !ur.usSeason) return null

  const quad = ur.usSeason.quadrant
  const plan = CORE_PLAN[quad]
  const satelliteRatio = 100 - plan.coreRatio

  // ② 3축 게이트 — fail 0개 + pass 2개 이상. 3축 전부 pass(최정예) 우선, 부족하면 2축 pass로 보충. 최대 7종
  const judged = (ur.items ?? []).map(it => {
    const axes = judgeAxes(it)
    const vals = [axes.buffett, axes.lynch, axes.supply]
    return { it, axes, passCount: vals.filter(v => v === 'pass').length, hasFail: vals.includes('fail') }
  }).filter(j => !j.hasFail && j.passCount >= 2)
    .sort((a, b) => b.passCount - a.passCount || b.it.combined - a.it.combined)
  const picked = judged.slice(0, 7)
  // 5종 미만이면 있는 만큼만(추정치로 채우지 않음 — 정직)

  // ③ 위성 비중 — satellite 예산을 통합점수 비례 배분
  const csum = picked.reduce((s, j) => s + j.it.combined, 0) || 1
  const satellites: QuantSatellite[] = picked.map(j => ({
    ticker: j.it.ticker, name: j.it.name, market: j.it.market, sector: j.it.sector,
    combined: j.it.combined, peg: j.it.peg,
    roePct: j.it.roe != null ? Math.round(j.it.roe * 1000) / 10 : null,
    epsRevision: j.it.epsRevision, supplyScore: j.it.supplyScore,
    axes: j.axes, passCount: j.passCount,
    weightPct: Math.round(satelliteRatio * (j.it.combined / csum) * 10) / 10,
    badges: j.it.badges,
  }))

  // ④ ETF 투시경 — Core ETF 섹터 분해 × 전체 비중 + 위성 섹터 합성 = 1억 전체의 실질 섹터
  const comps = await Promise.all(plan.mix.map(m => getEtfComposition(m.ticker, 'US').catch(() => null)))
  const secSum = new Map<string, number>()
  plan.mix.forEach((m, i) => {
    const overall = plan.coreRatio * m.weight / 100   // 전체 기준 %
    const c = comps[i]
    if (c && c.sectorWeights.length > 0) {
      const tot = c.sectorWeights.reduce((s, x) => s + x.weight, 0) || 100
      for (const sw of c.sectorWeights)
        secSum.set(sw.sector, (secSum.get(sw.sector) ?? 0) + overall * (sw.weight / tot))
    } else {
      secSum.set('기타(미분해)', (secSum.get('기타(미분해)') ?? 0) + overall)
    }
  })
  for (const s of satellites)
    secSum.set(s.sector || '기타', (secSum.get(s.sector || '기타') ?? 0) + s.weightPct)
  const effectiveSectors = Array.from(secSum.entries())
    .map(([sector, w]) => ({ sector, weightPct: Math.round(w * 10) / 10 }))
    .filter(x => x.weightPct >= 0.1)
    .sort((a, b) => b.weightPct - a.weightPct)

  const result: QuantBuilderResult = {
    quadrant: quad, seasonLabel: ur.usSeason.label,
    coreRatio: plan.coreRatio, satelliteRatio, rationale: plan.rationale,
    core: plan.mix.map(m => ({ ticker: m.ticker, name: m.name, role: m.role, mixPct: m.weight, weightPct: Math.round(plan.coreRatio * m.weight / 100 * 10) / 10 })),
    satellites, effectiveSectors,
    axisRule: '3축 게이트: 🏰 버핏(ROE 15%↑ & 추정 하향 아님) · 💎 린치(PEG 1.0↓ & 기저효과 가드) · 📡 수급(점수 60↑) — fail 0개 + 2축 이상 통과, 최대 7종',
    warming: (ur.items ?? []).length === 0,
    asOf: new Date().toISOString(),
  }
  if (!result.warming) await setCache(cacheKey, result)
  return result
}
