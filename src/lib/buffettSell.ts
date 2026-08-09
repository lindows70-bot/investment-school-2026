// 🏰 버핏 매도 점검 SSOT — '가격이 떨어졌는가'가 아니라 '기업이 변했는가'를 결정론으로 판정
// 버핏의 매도 사유 3가지를 앱 데이터로 매핑(docs/buffett-sell/plan.md · Phase 0 실측 2026-08-08):
//   ① 해자 침식 — 연간 총마진이 4년 고점 대비 −5%p↓ 그리고 (최신=기간 최저 또는 2년 연속 하락)
//      대조군 실측: INTC 발동(42.6→32.7%) · NVDA 미발동(고점 −3.9%p) · 삼성전자 미발동(2023 침체 후 회복)
//   ② 이익의 실재 훼손 — 영업흑자인데 영업현금흐름 적자(quality_gap — 스크리너 SSOT 재사용)
//   ③ 논거 붕괴 — 매수 시점 스냅샷 대비 근거 소멸(출구 플랜 ThesisCheck 재사용)
// ⛔ 고평가는 사유가 아니다(HOLD_DIP) — 기각: 내부자 매도(보상성 노이즈 — NVDA 건재한데 $574M 실측), 경영진(정량화 불가)
import { getCache, setCache } from '@/lib/appCache'
import type { RoeTrendKind } from '@/lib/roeTrend'   // 📈 해자 침식의 교차 확인용(판정기 아님)

export interface MoatYear { d: string; gmPct: number | null; omPct: number | null }
export interface MoatErosion {
  hit: boolean | null            // null = 데이터 부족(3년 미만) — 지어내지 않는다
  years: MoatYear[]
  peakGm: number | null; latestGm: number | null; dropPp: number | null
  detail: string
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

/** 연간 총마진(폴백: 영업이익률) 다년 추세로 해자 침식 판정. 캐시 24h — 연간 재무는 분기에 한 번 변한다. */
export async function computeMoatErosion(ticker: string, market: 'KR' | 'US'): Promise<MoatErosion> {
  const cacheKey = `buffett-moat-v1:${ticker}:${market}`
  const cached = await getCache<MoatErosion>(cacheKey, 24 * 3600_000)
  if (cached) return cached
  const NA: MoatErosion = { hit: null, years: [], peakGm: null, latestGm: null, dropPp: null, detail: '연간 재무 데이터 부족 — 판정 보류' }
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    const p1 = new Date(); p1.setFullYear(p1.getFullYear() - 5)
    const fts = await yf.fundamentalsTimeSeries(sym, { period1: p1.toISOString().slice(0, 10), type: 'annual', module: 'financials' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(fts) ? fts : (fts?.timeSeries ?? [])
    const years: MoatYear[] = arr
      .map(r => {
        const rev = num(r.totalRevenue), gp = num(r.grossProfit), oi = num(r.operatingIncome)
        const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
        return rev && rev > 0 ? {
          d,
          gmPct: gp != null ? Math.round(gp / rev * 1000) / 10 : null,
          omPct: oi != null ? Math.round(oi / rev * 1000) / 10 : null,
        } : null
      })
      .filter((x): x is MoatYear => x != null)
      .sort((a, b) => a.d.localeCompare(b.d))

    // 총마진 우선, 없으면(일부 금융·KR) 영업이익률로 같은 규칙 — 어느 쪽인지 detail에 명시
    const gmSeries = years.map(y => y.gmPct).filter((v): v is number => v != null)
    const useGm = gmSeries.length >= 3
    const series = useGm ? gmSeries : years.map(y => y.omPct).filter((v): v is number => v != null)
    const label = useGm ? '총마진' : '영업이익률'
    if (series.length < 3) { await setCache(cacheKey, NA); return NA }

    const peak = Math.max(...series)
    const latest = series[series.length - 1]
    const drop = Math.round((peak - latest) * 10) / 10
    const isMin = latest <= Math.min(...series)                             // 일시 침체 후 회복(삼성 2023)과 구조 침식을 가르는 조건
    const twoDown = series.length >= 3 && series[series.length - 1] < series[series.length - 2] && series[series.length - 2] < series[series.length - 3]
    const hit = drop >= 5 && (isMin || twoDown)
    const out: MoatErosion = {
      hit, years, peakGm: peak, latestGm: latest, dropPp: drop,
      detail: hit
        ? `${label}이 ${peak}% → ${latest}%로 ${drop}%p 낮아졌고 회복 없이 ${isMin ? '기간 최저' : '2년 연속 하락'}입니다 — 제품 경쟁력(해자)이 깎이고 있다는 구조 신호. 단, 언제 팔지의 타이밍 신호는 아닙니다 — 소급 실측(표본 164·발동 17종·2025-06 단일 시점)에선 마진 바닥이 반등의 출발점인 경우가 더 많았습니다`
        : `${label} ${latest}% (${series.length}년 고점 ${peak}% 대비 −${drop}%p) — 구조적 침식 아님`,
    }
    await setCache(cacheKey, out)
    return out
  } catch { return NA }
}

export interface BuffettSellCheck { key: 'moat_erosion' | 'earning_real' | 'thesis_broken'; icon: string; label: string; hit: boolean | null; detail: string }
export interface BuffettSellResult {
  checks: BuffettSellCheck[]
  hitCount: number
  level: 'strong' | 'watch' | 'pass' | 'na'   // 2+=강력 매도 검토 · 1=주의 관찰 · 0=통과 · 전축 데이터 없음=na
  headline: string                             // 학생 언어 한 줄
}

/** 3원칙 종합 — 순수 함수(판정은 코드·결정론). qualityGap/thesisBroken 은 각 SSOT 값을 호출부가 전달(중복 계산 금지).
 *  cyclical: 경기순환 업종(에너지·소재 등)은 마진 하락이 해자 훼손이 아니라 사이클 하강일 수 있어 문구를 가른다
 *  (COP 실사고 — 유가 사이클 마진 하락이 '제품 경쟁력 훼손'으로 읽힐 뻔. 경고는 원인까지 맞아야 한다).
 *  financial: 금융주는 이익-현금·총마진 잣대가 원천 부적합(예금·대출·보험 float) — 스크리너의 false 를
 *  '정상'으로 단정하면 오표기(KB금융 화면검증 발견). 무의미한 지표는 정상이 아니라 보류다. */
export function combineBuffettSell(
  moat: MoatErosion, qualityGap: boolean | null, thesisBroken: boolean | null,
  cyclical = false, financial = false,
  // 📈 ROE 추세 — ⛔ 새 판정기가 아니라 **교차 확인 레이어**다(손주부 인터뷰 2026-08-08 반영).
  //    해자 침식 판정은 총마진 그대로 유지하고, ROE가 같은 방향인지만 문구로 덧붙인다.
  //    단독 규칙으로 만들지 않은 이유: 인텔 실측(7.9→1.6→−18.9→−0.2)에서 보듯 ROE 단독은
  //    '최저 후 반등'을 개선으로 읽어 오히려 오판한다. 발동률만 올리고 검증은 안 되는 판정기는 짐이다.
  roeTrend: RoeTrendKind = 'na',
): BuffettSellResult {
  const base = moat.hit && cyclical
    ? moat.detail + ' · 단 경기순환 업종이라 해자 훼손이 아니라 업황(사이클) 하강일 수 있습니다 — 경쟁사 대비 마진도 함께 보세요'
    : moat.detail
  // 두 지표가 함께 꺾이면 신뢰도↑ · 마진만 꺾였으면 완화(자본효율은 살아 있다는 사실을 숨기지 않는다)
  const moatDetail = !moat.hit ? base
    // ⚠️ '신뢰도가 높다'는 **기업이 변했다는 서술**의 신뢰도지 파는 타이밍의 신뢰도가 아니다.
    //    ROE 소급 확인에서 꺾인 구간이 오히려 반등 출발점인 경우가 많았다(roeTrend.ROE_TREND_BACKTEST).
    //    마진 캐비엇과 같은 말을 해야 한다 — 한 화면에서 두 지표가 반대 온도로 읽히면 안 된다.
    : roeTrend === 'deteriorating' ? base + ' · 🔁 자본효율(ROE)도 같은 기간 함께 꺾였습니다 — 두 지표가 같은 방향이라 "기업이 변했다"는 진단의 신뢰도는 높습니다. 다만 지금 팔라는 뜻은 아닙니다(마진·ROE 바닥은 반등의 출발점인 경우도 많습니다)'
    : roeTrend === 'improving' ? base + ' · 🔁 다만 자본효율(ROE)은 오히려 좋아지는 중입니다 — 마진은 눌렸지만 자본을 굴리는 힘은 살아 있다는 뜻이라, 팔기 전에 원인을 더 확인하세요'
    : roeTrend === 'stable' ? base + ' · 🔁 자본효율(ROE)은 유지되고 있습니다 — 마진만 눌린 것인지 함께 보세요'
    : base
  const qg = financial ? null : qualityGap   // 🏦 금융주는 판정 자체를 보류(가드 값 false 를 '정상'으로 둔갑시키지 않는다)
  const checks: BuffettSellCheck[] = [
    {
      key: 'moat_erosion', icon: '🏰', label: cyclical && moat.hit ? '마진 하락(사이클?)' : '해자 침식',
      hit: financial ? (moat.hit === true ? true : null) : moat.hit,   // 금융주 마진 데이터는 대부분 무의미 — 발동만 존중, 미발동은 보류
      detail: financial && moat.hit !== true ? '금융주 — 은행·증권·보험은 마진 잣대가 맞지 않아 판정 보류' : moatDetail,
    },
    {
      key: 'earning_real', icon: '💵', label: '이익의 실재', hit: qg,
      detail: financial ? '금융주 — 예금·대출·보험 구조라 이익-현금 잣대가 맞지 않습니다(보류)'
        : qg == null ? '데이터 없음 — 판정 보류'
        : qg ? '장부상 이익은 흑자인데 실제 현금은 들어오지 않고 있습니다 — 이익의 실재가 의심되는 구조 신호'
        : '이익이 현금으로 들어오고 있습니다 — 정상',
    },
    {
      key: 'thesis_broken', icon: '🧭', label: '산 이유', hit: thesisBroken,
      detail: thesisBroken == null ? '매수 시점 기록 없음 — 판정 보류(기록 시작 이전 매수)'
        : thesisBroken ? '처음 샀을 때의 이유(저평가·이익 체력)가 사라졌습니다 — "산 이유가 사라지면 판다"(린치·버핏 공통)'
        : '산 이유가 아직 유효합니다',
    },
  ]
  const known = checks.filter(c => c.hit != null)
  const hitCount = checks.filter(c => c.hit === true).length
  const level: BuffettSellResult['level'] = known.length === 0 ? 'na' : hitCount >= 2 ? 'strong' : hitCount === 1 ? 'watch' : 'pass'
  const headline =
    level === 'strong' ? '🔴 기업이 변했다는 신호가 여럿 — 버핏 기준 강력 매도 검토(분할·계획적으로)'
    : level === 'watch' ? '🟡 기업 변질 신호 1개 — 다음 실적까지 주의 관찰'
    : level === 'pass' ? '🟢 기업은 그대로 — 가격 변동은 버핏 매도 사유가 아닙니다'
    : '⚪ 데이터 부족 — 판정 보류'
  return { checks, hitCount, level, headline }
}
