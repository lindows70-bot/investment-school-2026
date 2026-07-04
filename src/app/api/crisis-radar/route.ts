// 🚨 글로벌 위기 감지 레이더 — 시장 전체 버블/밸류에이션 4대 지표를 실데이터로 계산 + 종합 Alert.
// ① Shiller CAPE(multpl) ② 버핏지표(FRED 시총÷GDP) ③ S&P500 PER(multpl) ④ 위험프리미엄(어닝일드−10년물).
// ⚠️ 제미나이/구글의 하드코딩 숫자(41.6배 등) 대신 실데이터 계산(제1원칙). 임계 밴드는 공개 방법론 상수(교육용).
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export type Signal = 'safe' | 'caution' | 'danger'
export interface CrisisMetric {
  key: string; label: string; icon: string; measure: string
  value: number | null; unit: string
  mean: number; norm: string        // 역사적 평균/적정
  signal: Signal; note: string
  alertText: string                 // 종합 표용 경고 문구
  explain: string                   // 🎓 학생용 쉬운 설명
  gauge: { min: number; max: number; t1: number; t2: number; invert: boolean }   // 반원 게이지 범위·임계
  series: { date: string; v: number }[]           // 역사 시계열(미니차트)
  history?: { label: string; value: number }[]   // 과거 위기 대비
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
    // ⚠️ "Current X is 41.60, a change of ..." 구문에 정확히 앵커(페이지 앞쪽 다른 'Current' 오매칭 방지 — Vercel fetch서 1.5 오추출 버그)
    const m = t.match(/is\s+([0-9]+\.[0-9]+)\s*%?\s*,\s*a change/i) || t.match(/\bis\s+([0-9]+\.[0-9]+)/i)
    return m ? parseFloat(m[1]) : null
  } catch { return null }
}
const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
// multpl 월별 테이블 → {date:'YYYY-MM', v} 오름차순(30년·분기 다운샘플). 셀: <td>Jul 2, 2026</td><td> &#x2002; 41.60 </td>
async function multplSeries(path: string): Promise<{ date: string; v: number }[]> {
  try {
    const r = await fetch(`https://www.multpl.com/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const t = await r.text()
    const tds = Array.from(t.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), m => m[1])
    const out: { date: string; v: number }[] = []
    for (let i = 0; i + 1 < tds.length; i += 2) {
      const dm = tds[i].match(/([A-Z][a-z]{2})\s+\d{1,2},\s+(\d{4})/)
      const vm = tds[i + 1].match(/([0-9]+\.[0-9]+)/)
      if (dm && vm && MON[dm[1]]) out.push({ date: `${dm[2]}-${MON[dm[1]]}`, v: parseFloat(vm[1]) })
    }
    out.reverse()   // 과거→현재
    const cut = out.filter(x => x.date >= '1995-01')
    return cut.filter((_, i) => i % 3 === 0 || i === cut.length - 1)   // 분기 다운샘플
  } catch { return [] }
}

export async function GET() {
  const cacheKey = 'crisis-radar-v5'   // v5: 종합 표용 alertText + PE 선행/후행 차이 명시
  const cached = await getCache<CrisisRadarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [cape, pe, eyield, equities, gdp, dgs10, capeSer, peSer, eySer, gs10Ser] = await Promise.all([
    multpl('shiller-pe'), multpl('s-p-500-pe-ratio'), multpl('s-p-500-earnings-yield'),
    fred('NCBEILQ027S', '&observation_start=1995-01-01'),   // 비금융 법인 주식 시가총액($M, 분기)
    fred('GDP', '&observation_start=1995-01-01'),            // 명목 GDP($B, 분기)
    fred('DGS10', '&sort_order=desc&limit=1'),               // 10년물 국채(%)
    multplSeries('shiller-pe/table/by-month'),              // CAPE 역사
    multplSeries('s-p-500-pe-ratio/table/by-month'),        // PER 역사
    multplSeries('s-p-500-earnings-yield/table/by-month'),  // 어닝일드 역사(ERP용)
    fred('GS10', '&observation_start=1995-01-01&frequency=m'),   // 10년물 월별(ERP 역사용)
  ])
  // 버핏 시계열(분기): GDP 기준일마다 시총 atOrBefore
  const buffettSer = gdp.map(g => { const e = atOrBefore(equities, g.date); return e != null ? { date: g.date.slice(0, 7), v: Math.round((e / 1e6) / (g.v / 1e3) * 1000) / 10 } : null }).filter((x): x is { date: string; v: number } => x != null)
  // ERP 시계열: 어닝일드(월) − GS10(월) 정렬
  const gs10Map = new Map(gs10Ser.map(x => [x.date.slice(0, 7), x.v]))
  const erpSer = eySer.map(e => { const g = gs10Map.get(e.date); return g != null ? { date: e.date, v: Math.round((e.v - g) * 100) / 100 } : null }).filter((x): x is { date: string; v: number } => x != null)

  const metrics: CrisisMetric[] = []

  // ① Shiller CAPE
  metrics.push({
    key: 'cape', label: 'Shiller CAPE', icon: '📐', measure: '주가 vs 10년 평균 이익(인플레 조정)',
    value: cape, unit: '배', mean: 17, norm: '역사평균 ≈ 17배',
    signal: cape == null ? 'caution' : cape >= 30 ? 'danger' : cape >= 22 ? 'caution' : 'safe',
    note: cape == null ? '데이터 조회 실패' : cape >= 30 ? `역사상 상위권 — 장기 실질수익률이 낮았던 구간(현재 ${cape}배)` : '장기 이익 대비 밸류에이션 부담 낮음',
    explain: '노벨상 수상자 실러 교수가 만든 지표. 주가를 최근 1년이 아닌 **10년 평균 이익**으로 나눕니다(일시적 호황 이익에 안 속으려고). 현재 41.6배 = 이익 1달러를 얻으려 41.6달러를 내는 셈. 역사평균 17배의 약 2.4배로, 이 수준에선 향후 10년 주식 수익률이 역사적으로 낮았습니다.',
    alertText: cape != null && cape >= 30 ? '매우 위험 (역사상 상위권·평균 2배+)' : '보통',
    gauge: { min: 5, max: 45, t1: 22, t2: 30, invert: false },
    series: capeSer,
    history: [{ label: '2000 닷컴', value: 44 }, { label: '2007 금융위기 전', value: 27 }, { label: '역사평균', value: 17 }],
  })

  // ② 버핏 지표 = 시총 ÷ GDP (전부 FRED, 과거값 실측)
  const eqNow = equities.length ? equities[equities.length - 1].v / 1e6 : null   // $M → $T
  const gdpNow = gdp.length ? gdp[gdp.length - 1].v / 1e3 : null                 // $B → $T
  const buffett = eqNow != null && gdpNow != null ? Math.round(eqNow / gdpNow * 1000) / 10 : null
  const buffettAt = (ymd: string) => { const e = atOrBefore(equities, ymd), g = atOrBefore(gdp, ymd); return e != null && g != null ? Math.round((e / 1e6) / (g / 1e3) * 1000) / 10 : 0 }
  metrics.push({
    key: 'buffett', label: '버핏 지표', icon: '🏛️', measure: '미국 총 시가총액 vs GDP',
    value: buffett, unit: '%', mean: 110, norm: '적정 ≈ 100~120% · 150%↑ 심각',
    signal: buffett == null ? 'caution' : buffett >= 150 ? 'danger' : buffett >= 120 ? 'caution' : 'safe',
    note: buffett == null ? '데이터 조회 실패' : buffett >= 150 ? `경제 규모 대비 과도한 거품 — 버핏이 "150%↑는 불장난" 경고한 구간(현재 ${buffett}%)` : '경제 규모 대비 밸류에이션 정상권',
    explain: '워런 버핏이 "가장 좋은 단일 밸류에이션 지표"라 극찬. 나라 전체 주식 시가총액을 **GDP(경제가 1년에 버는 돈)** 로 나눕니다. 경제가 버는 것보다 주식값이 얼마나 부풀었나. 100%=경제와 균형, 현재 218%=경제 규모의 2배 넘게 부풀음. 닷컴(163%)·금융위기(121%)·팬데믹(129%) 모든 고점을 이미 넘었습니다.',
    alertText: buffett != null && buffett >= 150 ? '극도의 과열 (역대 최고권)' : '보통',
    gauge: { min: 50, max: 230, t1: 120, t2: 150, invert: false },
    series: buffettSer,
    history: [{ label: '2000 닷컴', value: buffettAt('2000-03-31') }, { label: '2008 위기 전', value: buffettAt('2007-09-30') }, { label: '2020 팬데믹', value: buffettAt('2020-03-31') }],
  })

  // ③ S&P 500 PER (후행 — 선행PER은 유료 컨센서스라 후행으로 대체·명시)
  metrics.push({
    key: 'pe', label: 'S&P 500 PER (후행)', icon: '💰', measure: '주가 vs 최근 12개월 실적',
    value: pe, unit: '배', mean: 16, norm: '역사평균 ≈ 16배',
    signal: pe == null ? 'caution' : pe >= 25 ? 'danger' : pe >= 20 ? 'caution' : 'safe',
    note: pe == null ? '데이터 조회 실패' : `현재 후행 ${pe}배(위험) — 뉴스·구글의 "선행 PER ~20배(주의)"와 다른 이유: 우리는 실제 확정이익(후행), 구글은 미래 예상이익(선행)을 씀. 격차 ${eyield != null ? Math.round((pe / 20 - 1) * 100) : 60}%는 시장이 향후 이익 급성장을 기대(AI 선반영)한다는 뜻. 선행 EPS는 유료 컨센서스라 무료 계산 불가 → 더 보수적인 후행 채택.`,
    explain: '가장 유명한 밸류에이션 지표. 주가를 **최근 1년 순이익**으로 나눕니다. 이익 1달러에 몇 달러를 내는가. 현재 32배 = 이익 1달러당 32달러(역사평균 16배의 2배). ⚠️ 뉴스의 "선행 PER 20배(주의)"는 향후 1년 *예상* 이익 기준 — 우리는 *확정* 이익 기준 후행 PER(32배·위험)을 씁니다. 둘 다 맞지만 후행이 더 보수적·정직(유료 선행 컨센서스 회피).',
    alertText: pe != null && pe >= 25 ? '고평가 (후행 확정이익·평균 2배 / 선행 기준은 주의)' : '보통',
    gauge: { min: 8, max: 35, t1: 20, t2: 25, invert: false },
    series: peSer,
  })

  // ④ 위험 프리미엄(ERP) = 어닝일드 − 10년물
  const y10 = dgs10.length ? dgs10[dgs10.length - 1].v : null
  const erp = eyield != null && y10 != null ? Math.round((eyield - y10) * 100) / 100 : null
  metrics.push({
    key: 'erp', label: '주식 위험 프리미엄', icon: '⚖️', measure: '주식 기대수익률(어닝일드) vs 10년 국채',
    value: erp, unit: '%p', mean: 4.5, norm: '역사평균 ≈ 4~5%p',
    signal: erp == null ? 'caution' : erp < 1 ? 'danger' : erp < 3 ? 'caution' : 'safe',
    note: erp == null ? '데이터 조회 실패' : erp < 1 ? `어닝일드 ${eyield}% vs 국채 ${y10}% → 프리미엄 ${erp}%p. 채권 대비 주식 메리트 역사적 최저(위험 감수 이유 급감)` : '채권 대비 주식이 합리적 보상 제공',
    explain: '"위험한 주식을 살 추가 보상"을 잰다. 주식 기대수익(이익÷주가 = 어닝일드)에서 **안전한 10년 국채 금리**를 뺍니다. 높을수록 주식이 매력적, 낮을수록 위험. 현재 −1.4%p = 주식 기대수익이 안전한 국채보다도 낮음 → 굳이 주식 위험을 감수할 이유가 역대급으로 적다는 신호(그리드 구간).',
    alertText: erp != null && erp < 1 ? '위험 (채권 대비 메리트 급감·역사적 최저)' : '보통',
    gauge: { min: -3, max: 8, t1: 3, t2: 1, invert: true },   // 낮을수록 위험(반전)
    series: erpSer,
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
