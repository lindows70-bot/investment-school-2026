// 🚨 글로벌 위기 감지 레이더 — 시장 전체 버블/밸류에이션 4대 지표를 실데이터로 계산 + 종합 Alert.
// ① Shiller CAPE(multpl) ② 버핏지표(FRED 시총÷GDP) ③ S&P500 PER(multpl) ④ 위험프리미엄(어닝일드−10년물).
// ⚠️ 제미나이/구글의 하드코딩 숫자(41.6배 등) 대신 실데이터 계산(제1원칙). 임계 밴드는 공개 방법론 상수(교육용).
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export type Signal = 'safe' | 'caution' | 'danger'
export interface CrisisMetric {
  key: string; label: string; measure: string
  value: number | null; unit: string
  mean: number; norm: string        // 역사적 평균/적정
  signal: Signal; note: string
  history?: { label: string; value: number }[]   // 과거 위기 대비(실측 가능한 지표만)
}
export interface CrisisRadarResult {
  metrics: CrisisMetric[]
  alertLevel: Signal; dangerCount: number; summary: string
  asOf: string
}

const FRED = 'https://api.stlouisfed.org/fred/series/observations'
async function fred(series: string, extra = ''): Promise<{ date: string; v: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`${FRED}?series_id=${series}&api_key=${key}&file_type=json${extra}`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) })).filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}
const atOrBefore = (a: { date: string; v: number }[], ymd: string) => { const f = a.filter(x => x.date <= ymd); return f.length ? f[f.length - 1].v : null }

// multpl.com 스크랩 — "Current ... is 41.60" 패턴
async function multpl(path: string): Promise<number | null> {
  try {
    const r = await fetch(`https://www.multpl.com/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const t = await r.text()
    const m = t.match(/Current[^0-9]*([0-9]+\.[0-9]+)/i)
    return m ? parseFloat(m[1]) : null
  } catch { return null }
}

export async function GET() {
  const cacheKey = 'crisis-radar-v1'
  const cached = await getCache<CrisisRadarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [cape, pe, eyield, equities, gdp, dgs10] = await Promise.all([
    multpl('shiller-pe'), multpl('s-p-500-pe-ratio'), multpl('s-p-500-earnings-yield'),
    fred('NCBEILQ027S', '&observation_start=1995-01-01'),   // 비금융 법인 주식 시가총액($M, 분기)
    fred('GDP', '&observation_start=1995-01-01'),            // 명목 GDP($B, 분기)
    fred('DGS10', '&sort_order=desc&limit=1'),               // 10년물 국채(%)
  ])

  const metrics: CrisisMetric[] = []

  // ① Shiller CAPE
  metrics.push({
    key: 'cape', label: 'Shiller CAPE', measure: '주가 vs 10년 평균 이익(인플레 조정)',
    value: cape, unit: '배', mean: 17, norm: '역사평균 ≈ 17배',
    signal: cape == null ? 'caution' : cape >= 30 ? 'danger' : cape >= 22 ? 'caution' : 'safe',
    note: cape == null ? '데이터 조회 실패' : cape >= 30 ? `역사상 상위권 — 장기 실질수익률이 낮았던 구간(현재 ${cape}배)` : '장기 이익 대비 밸류에이션 부담 낮음',
    history: [{ label: '2000 닷컴', value: 44 }, { label: '2007 금융위기 전', value: 27 }, { label: '역사평균', value: 17 }],
  })

  // ② 버핏 지표 = 시총 ÷ GDP (전부 FRED, 과거값 실측)
  const eqNow = equities.length ? equities[equities.length - 1].v / 1e6 : null   // $M → $T
  const gdpNow = gdp.length ? gdp[gdp.length - 1].v / 1e3 : null                 // $B → $T
  const buffett = eqNow != null && gdpNow != null ? Math.round(eqNow / gdpNow * 1000) / 10 : null
  const buffettAt = (ymd: string) => { const e = atOrBefore(equities, ymd), g = atOrBefore(gdp, ymd); return e != null && g != null ? Math.round((e / 1e6) / (g / 1e3) * 1000) / 10 : 0 }
  metrics.push({
    key: 'buffett', label: '버핏 지표', measure: '미국 총 시가총액 vs GDP',
    value: buffett, unit: '%', mean: 110, norm: '적정 ≈ 100~120% · 150%↑ 심각',
    signal: buffett == null ? 'caution' : buffett >= 150 ? 'danger' : buffett >= 120 ? 'caution' : 'safe',
    note: buffett == null ? '데이터 조회 실패' : buffett >= 150 ? `경제 규모 대비 과도한 거품 — 버핏이 "150%↑는 불장난" 경고한 구간(현재 ${buffett}%)` : '경제 규모 대비 밸류에이션 정상권',
    history: [{ label: '2000 닷컴', value: buffettAt('2000-03-31') }, { label: '2008 위기 전', value: buffettAt('2007-09-30') }, { label: '2020 팬데믹', value: buffettAt('2020-03-31') }],
  })

  // ③ S&P 500 PER (후행 — 선행PER은 유료 컨센서스라 후행으로 대체·명시)
  metrics.push({
    key: 'pe', label: 'S&P 500 PER (후행)', measure: '주가 vs 최근 12개월 실적',
    value: pe, unit: '배', mean: 16, norm: '역사평균 ≈ 16배',
    signal: pe == null ? 'caution' : pe >= 25 ? 'danger' : pe >= 20 ? 'caution' : 'safe',
    note: pe == null ? '데이터 조회 실패' : `현재 ${pe}배 — ⚠️ 선행 PER(향후 12개월, ~20배 추정)은 유료 컨센서스라 무료로 정확 계산 불가 → 후행 PER로 대체. 방향성은 동일(고평가).`,
  })

  // ④ 위험 프리미엄(ERP) = 어닝일드 − 10년물
  const y10 = dgs10.length ? dgs10[dgs10.length - 1].v : null
  const erp = eyield != null && y10 != null ? Math.round((eyield - y10) * 100) / 100 : null
  metrics.push({
    key: 'erp', label: '주식 위험 프리미엄', measure: '주식 기대수익률(어닝일드) vs 10년 국채',
    value: erp, unit: '%p', mean: 4.5, norm: '역사평균 ≈ 4~5%p',
    signal: erp == null ? 'caution' : erp < 1 ? 'danger' : erp < 3 ? 'caution' : 'safe',
    note: erp == null ? '데이터 조회 실패' : erp < 1 ? `어닝일드 ${eyield}% vs 국채 ${y10}% → 프리미엄 ${erp}%p. 채권 대비 주식 메리트 역사적 최저(위험 감수 이유 급감)` : '채권 대비 주식이 합리적 보상 제공',
  })

  const dangerCount = metrics.filter(m => m.signal === 'danger').length
  const cautionCount = metrics.filter(m => m.signal === 'caution').length
  const alertLevel: Signal = dangerCount >= 2 ? 'danger' : dangerCount >= 1 || cautionCount >= 2 ? 'caution' : 'safe'
  const summary = alertLevel === 'danger'
    ? `🔴 위기 경보 — 4대 지표 중 ${dangerCount}개가 위험 신호. 시장 전반의 밸류에이션이 역사적 극단에 있어 하락 위험이 큽니다(타이밍 예측 아님, 위험 관리 신호).`
    : alertLevel === 'caution'
    ? `🟡 주의 — 일부 지표가 과열권. 무리한 레버리지·추격매수를 자제하고 현금 비중을 점검할 국면입니다.`
    : `🟢 안정 — 시장 전반 밸류에이션이 관리 가능한 범위입니다.`

  const result: CrisisRadarResult = { metrics, alertLevel, dangerCount, summary, asOf: new Date().toISOString() }
  if (metrics.some(m => m.value != null)) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
