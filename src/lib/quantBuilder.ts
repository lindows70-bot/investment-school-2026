// 🛰️ AI 1억 백지 퀀트 빌더 엔진 — 코어-새틀라이트 설계 본체(route와 copy가 공유)
// Core(50~70%): 국면별 시장 ETF(SPY·QQQ·SCHD) · Satellite(30~50%): 3축 SSOT(버핏 ROE·린치 PEG·수급) 통과 + 섹터당 최대 2종(분산) 5~7종
// 모든 점수는 unified-reco SSOT 재사용(제2원칙 — 통합매수와 동일 점수·동일 기저효과 가드) · ETF 투시경으로 실질 섹터 합성
import { getCache, setCache } from '@/lib/appCache'
import { getEtfComposition } from '@/lib/etfLookThrough'
import type { UnifiedRecoResult, UnifiedRecoItem } from '@/app/api/unified-reco/route'
import type { Quadrant } from '@/lib/seasonNavigator'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// ── 국면별 Core 설계(교육용 고정 룰 — 박제 아님: 국면이 바뀌면 자동으로 바뀜) ──────
// coreRatio: 국면이 위험할수록 Core(시장 ETF) 비중↑ — 50~70% 범위
// 🇰🇷 KODEX 200 상시 포함 — 한국 학생용 앱에서 Core가 100% 미국이면 홈 마켓 무시(사용자 피드백 반영)
type CoreMix = { ticker: string; name: string; market: 'US' | 'KR'; weight: number; role: string }
const CORE_PLAN: Record<Quadrant, { coreRatio: number; mix: CoreMix[]; rationale: string }> = {
  goldilocks: {
    coreRatio: 50,
    mix: [
      { ticker: 'QQQ',    name: 'Invesco QQQ (나스닥100)',  market: 'US', weight: 35, role: '성장 엔진' },
      { ticker: 'SPY',    name: 'SPDR S&P 500',             market: 'US', weight: 30, role: '시장 본체' },
      { ticker: '069500', name: 'KODEX 200 (코스피200)',    market: 'KR', weight: 20, role: '홈 마켓' },
      { ticker: 'SCHD',   name: 'Schwab 미국 배당 (SCHD)',  market: 'US', weight: 15, role: '배당 안전판' },
    ],
    rationale: '골디락스(성장↑·물가↓) — 성장주가 가장 빛나는 국면이라 Core를 최소(50%)로 줄이고 QQQ 비중을 키워 위성과 함께 공격적으로.',
  },
  inflation: {
    coreRatio: 60,
    mix: [
      { ticker: 'SPY',    name: 'SPDR S&P 500',             market: 'US', weight: 35, role: '시장 본체' },
      { ticker: 'SCHD',   name: 'Schwab 미국 배당 (SCHD)',  market: 'US', weight: 25, role: '배당 안전판' },
      { ticker: '069500', name: 'KODEX 200 (코스피200)',    market: 'KR', weight: 20, role: '홈 마켓' },
      { ticker: 'QQQ',    name: 'Invesco QQQ (나스닥100)',  market: 'US', weight: 20, role: '성장 엔진' },
    ],
    rationale: '인플레이션(성장↑·물가↑) — 금리 부담으로 성장주 멀티플이 눌리는 국면. 배당(SCHD)을 키우고 Core 60%로 무게중심을 낮춥니다.',
  },
  stagflation: {
    coreRatio: 70,
    mix: [
      { ticker: 'SCHD',   name: 'Schwab 미국 배당 (SCHD)',  market: 'US', weight: 40, role: '배당 안전판' },
      { ticker: 'SPY',    name: 'SPDR S&P 500',             market: 'US', weight: 30, role: '시장 본체' },
      { ticker: '069500', name: 'KODEX 200 (코스피200)',    market: 'KR', weight: 15, role: '홈 마켓' },
      { ticker: 'QQQ',    name: 'Invesco QQQ (나스닥100)',  market: 'US', weight: 15, role: '성장 엔진' },
    ],
    rationale: '스태그플레이션(성장↓·물가↑) — 4계절 중 가장 어려운 국면. Core를 최대(70%)로 올리고 배당 중심으로 버팁니다.',
  },
  recession: {
    coreRatio: 70,
    mix: [
      { ticker: 'SPY',    name: 'SPDR S&P 500',             market: 'US', weight: 35, role: '시장 본체' },
      { ticker: 'SCHD',   name: 'Schwab 미국 배당 (SCHD)',  market: 'US', weight: 35, role: '배당 안전판' },
      { ticker: '069500', name: 'KODEX 200 (코스피200)',    market: 'KR', weight: 15, role: '홈 마켓' },
      { ticker: 'QQQ',    name: 'Invesco QQQ (나스닥100)',  market: 'US', weight: 15, role: '성장 엔진' },
    ],
    rationale: '리세션(성장↓·물가↓) — 금리 인하가 오기 전까지 방어 우선. Core 70%로 시장 평균에 묻어가며 위성은 최정예만.',
  },
  shoulder: {
    coreRatio: 65,
    mix: [
      { ticker: 'SPY',    name: 'SPDR S&P 500',             market: 'US', weight: 35, role: '시장 본체' },
      { ticker: 'SCHD',   name: 'Schwab 미국 배당 (SCHD)',  market: 'US', weight: 25, role: '배당 안전판' },
      { ticker: '069500', name: 'KODEX 200 (코스피200)',    market: 'KR', weight: 20, role: '홈 마켓' },
      { ticker: 'QQQ',    name: 'Invesco QQQ (나스닥100)',  market: 'US', weight: 20, role: '성장 엔진' },
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
// fail은 '명백한 결격'만(추정 하향·기저효과·PEG>2·저ROE·수급 이탈) — 중간 지대는 na(무탈락).
// v1은 fail 기준이 너무 엄격해 12 후보 중 1종만 생존 → 위성 예산 독식 버그(사용자 피드백)
function judgeAxes(it: UnifiedRecoItem): SatelliteAxes {
  const suspect = it.badges.includes('⚠️ 저PEG 기저효과 의심')
  const buffett: AxisStatus = it.epsRevision === 'down' ? 'fail'
    : it.roe == null ? 'na'
    : it.roe >= 0.15 ? 'pass'
    : it.roe < 0.08 ? 'fail' : 'na'          // 8~15%는 중간 지대(무탈락)
  const lynch: AxisStatus = suspect ? 'fail'
    : it.peg == null ? 'na'
    : it.peg > 0 && it.peg <= 1.0 ? 'pass'
    : it.peg > 2.0 ? 'fail' : 'na'           // 1.0~2.0은 적정 범위(린치 상한 2.0)
  const supply: AxisStatus = !it.supplyKnown ? 'na'
    : it.supplyScore >= 60 ? 'pass' : it.supplyScore < 40 ? 'fail' : 'na'
  return { buffett, lynch, supply }
}

// 📈 주가 컨텍스트 — 52주 위치 + 1년 주봉 스파크라인("현재 어느 위치에서 사라는 건지" 시각화)
export interface PriceContext {
  price: number          // 최근 종가(종목 통화)
  low52: number
  high52: number
  posPct: number         // 52주 밴드 내 현재 위치 0~100 (0=52주 최저, 100=52주 최고)
  spark: number[]        // 1년 주봉 종가(다운샘플 ≤32포인트) — UI 스파크라인용
}

async function fetchPriceContext(ticker: string, market: string): Promise<PriceContext | null> {
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const code = ticker.replace(/\D/g, '')
    const tries = market === 'KR' ? [`${code}.KS`, `${code}.KQ`] : [ticker]
    const period1 = new Date(Date.now() - 370 * 86400_000)
    for (const sym of tries) {
      try {
        const r = await yf.chart(sym, { period1, interval: '1wk' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const closes: number[] = (r?.quotes ?? []).map((q: any) => q.close).filter((v: unknown) => typeof v === 'number' && isFinite(v as number))
        if (closes.length >= 10) {
          const price = closes[closes.length - 1]
          const low52 = Math.min(...closes), high52 = Math.max(...closes)
          const posPct = high52 > low52 ? Math.round(((price - low52) / (high52 - low52)) * 100) : 50
          // 다운샘플 ≤32포인트(페이로드 절약)
          const step = Math.max(1, Math.ceil(closes.length / 32))
          const spark = closes.filter((_, i) => i % step === 0 || i === closes.length - 1).map(v => Math.round(v * 100) / 100)
          return { price: Math.round(price * 100) / 100, low52: Math.round(low52 * 100) / 100, high52: Math.round(high52 * 100) / 100, posPct, spark }
        }
      } catch { /* 다음 심볼 */ }
    }
    return null
  } catch { return null }
}

export interface QuantSatellite {
  ticker: string; name: string; market: string; sector: string
  combined: number; peg: number | null; psr: number | null; roePct: number | null; epsRevision: string | null; supplyScore: number
  axes: SatelliteAxes
  passCount: number              // 3축 중 pass 수(3=최정예, 2=정예)
  weightPct: number              // 총투자금 대비 비중 %
  badges: string[]
  priceCtx: PriceContext | null  // 📈 52주 위치 + 스파크라인(수집 실패 시 null — 정직)
  timing?: import('@/lib/entryTiming').EntryTiming | null   // 🚦 타점 신호등(unified-reco 상속 — 점수 미반영 WHEN 레이어)
}
export interface QuantBuilderResult {
  quadrant: Quadrant
  seasonLabel: string
  coreRatio: number              // Core % (50~70)
  satelliteRatio: number
  rationale: string
  core: { ticker: string; name: string; market: string; role: string; mixPct: number; weightPct: number; priceCtx: PriceContext | null }[]   // mixPct=Core 내, weightPct=전체
  unallocatedNote: string | null   // 위성 미달분 → Core 증액 안내(있을 때만)
  satellites: QuantSatellite[]
  effectiveSectors: { sector: string; weightPct: number }[]   // ETF 투시경 합성 실질 섹터(전체 기준)
  axisRule: string
  warming: boolean               // 유니버스 캐시 콜드(크론 전) — 위성 비어있을 수 있음
  asOf: string
}

/** 빌드 본체 — GET과 copy(POST)가 공유. base=요청 origin, cookie=인증 전달용 */
export async function buildQuantPlan(base: string, cookie: string): Promise<QuantBuilderResult | null> {
  const cacheKey = `quant-builder-v6:${kstDate()}`   // v6: 🧭 위성 섹터 분산(섹터당 최대 2종) / v5: 🚦 타점 신호등(timing) 상속
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
  const satelliteBudget = 100 - plan.coreRatio

  // ② 3축 게이트 — fail 0개 + pass 1개 이상. 3축 전부 pass(최정예)→2축→1축 순, 섹터당 최대 2종·최대 7종
  const judgedAll = (ur.items ?? []).map(it => {
    const axes = judgeAxes(it)
    const vals = [axes.buffett, axes.lynch, axes.supply]
    return { it, axes, passCount: vals.filter(v => v === 'pass').length, hasFail: vals.includes('fail') }
  }).filter(j => !j.hasFail && j.passCount >= 1)
    .sort((a, b) => b.passCount - a.passCount || b.it.combined - a.it.combined)
  // 🧭 섹터 분산 — 종목당 상한(10%) 외에 섹터당 최대 2종(금융 등 한 섹터 쏠림 방지). 품질순 정렬 유지하며 그리디 선별
  const SAT_SECTOR_CAP = 2
  const secCnt = new Map<string, number>()
  const picked: typeof judgedAll = []
  for (const j of judgedAll) {
    if (picked.length >= 7) break
    const sec = j.it.sector ?? '기타'
    if ((secCnt.get(sec) ?? 0) >= SAT_SECTOR_CAP) continue
    secCnt.set(sec, (secCnt.get(sec) ?? 0) + 1)
    picked.push(j)
  }
  // 후보가 적으면 있는 만큼만(추정치로 채우지 않음 — 정직). 섹터 상한에 막힌 종목은 Core로 환류

  // ③ 위성 비중 — 통합점수 비례 배분하되 **종목당 상한 10%**(분산 원칙: 1종 독식 방지).
  //    상한 때문에 못 채운 미달분은 Core로 환류(미배치 현금 없이 시장 본체에 묻어감)
  const SAT_CAP = 10
  const csum = picked.reduce((s, j) => s + j.it.combined, 0) || 1
  const satellites: QuantSatellite[] = picked.map(j => ({
    ticker: j.it.ticker, name: j.it.name, market: j.it.market, sector: j.it.sector,
    combined: j.it.combined, peg: j.it.peg, psr: j.it.psr ?? null, timing: j.it.timing ?? null,
    roePct: j.it.roe != null ? Math.round(j.it.roe * 1000) / 10 : null,
    epsRevision: j.it.epsRevision, supplyScore: j.it.supplyScore,
    axes: j.axes, passCount: j.passCount,
    weightPct: Math.min(SAT_CAP, Math.round(satelliteBudget * (j.it.combined / csum) * 10) / 10),
    badges: j.it.badges,
    priceCtx: null,   // ③-b에서 채움
  }))
  const satAllocated = Math.round(satellites.reduce((s, x) => s + x.weightPct, 0) * 10) / 10
  const leftover = Math.round((satelliteBudget - satAllocated) * 10) / 10   // 위성 미달분 → Core 증액
  const coreEffective = Math.round((plan.coreRatio + Math.max(0, leftover)) * 10) / 10

  // ③-b 📈 주가 컨텍스트(52주 위치 + 1년 스파크라인) — 코어 ETF + 위성 전 종목, 동시성 4
  const ctxTargets = [
    ...plan.mix.map(m => ({ key: `C:${m.ticker}`, ticker: m.ticker, market: m.market as string })),
    ...satellites.map(s => ({ key: `S:${s.ticker}`, ticker: s.ticker, market: s.market })),
  ]
  const ctxMap = new Map<string, PriceContext | null>()
  for (let i = 0; i < ctxTargets.length; i += 4) {
    const batch = ctxTargets.slice(i, i + 4)
    const rs = await Promise.all(batch.map(t => fetchPriceContext(t.ticker, t.market).catch(() => null)))
    batch.forEach((t, k) => ctxMap.set(t.key, rs[k]))
  }
  for (const s of satellites) s.priceCtx = ctxMap.get(`S:${s.ticker}`) ?? null

  // ④ ETF 투시경 — Core ETF 섹터 분해 × 전체 비중 + 위성 섹터 합성 = 1억 전체의 실질 섹터
  const comps = await Promise.all(plan.mix.map(m => getEtfComposition(m.ticker, m.market).catch(() => null)))
  const secSum = new Map<string, number>()
  plan.mix.forEach((m, i) => {
    const overall = coreEffective * m.weight / 100   // 전체 기준 %(위성 미달분 환류 반영)
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
    coreRatio: coreEffective, satelliteRatio: satAllocated, rationale: plan.rationale,
    core: plan.mix.map(m => ({ ticker: m.ticker, name: m.name, market: m.market, role: m.role, mixPct: m.weight, weightPct: Math.round(coreEffective * m.weight / 100 * 10) / 10, priceCtx: ctxMap.get(`C:${m.ticker}`) ?? null })),
    satellites, effectiveSectors,
    axisRule: '3축 게이트: 🏰 버핏(ROE 15%↑) · 💎 린치(PEG 1.0↓ & 기저효과 가드) · 📡 수급(60↑) — 결격(추정하향·PEG 2↑·저ROE·수급이탈) 0개 + 1축 이상 통과 · 🧭 섹터당 최대 2종(쏠림 방지) · 종목당 상한 10% · 최대 7종',
    unallocatedNote: leftover >= 0.5 ? `위성 분산 상한(종목당 10%) 때문에 ${leftover}%는 Core(시장 ETF)로 환류했습니다 — 정예 후보가 늘어나면 자동으로 위성에 재배분됩니다.` : null,
    warming: (ur.items ?? []).length === 0,
    asOf: new Date().toISOString(),
  }
  if (!result.warming) await setCache(cacheKey, result)
  return result
}
