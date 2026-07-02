// 🌊 레이 달리오 매크로 진단 — 부채 사이클 위치(FRED 실데이터 자동 추정) + 버블 지표 체크 + 역사 오버레이 + All Weather 백테스트.
// ⚠️ '몇 단계'를 단정하지 않고 근거 지표와 함께 '추정'으로 제시(제1원칙). 계절은 macro-regime SSOT 재사용(제2원칙).
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getCurrentSeason } from '@/lib/currentSeason'

export const dynamic = 'force-dynamic'
export const maxDuration = 40

interface Signal { key: string; label: string; value: string; reading: string; lean: 'early' | 'late' | 'stimulus' | 'neutral' }
interface BubbleFactor { label: string; status: 'hot' | 'warm' | 'cool' | 'link'; note: string }
interface AllWeatherYear { year: string; awPct: number; spyPct: number }
export interface DalioCycleResult {
  debt: {
    debtGdp: number; debtGdpTrend: 'up' | 'down' | 'flat'
    dsr: number; realRate: number; fedBsTrend: 'expanding' | 'contracting' | 'flat'; yieldCurve: number; m2Yoy: number | null
    signals: Signal[]
    stageIndex: number; stageLabel: string; stageNote: string
  }
  bubble: { score: number; level: '냉각' | '중립' | '주의' | '과열'; factors: BubbleFactor[] }
  worldPower: {
    metrics: { label: string; us: number; cn: number; year: string; disp: 'money' | 'pct' | 'pop'; note: string; leader: 'US' | 'CN' }[]
    reserve: { usd: number; cny: number; source: string }
  } | null
  history: { metric: string; now: number; y2008: number; y2020: number; unit: string }[]
  allWeather: { usSeason: string; years: AllWeatherYear[]; cagr: number; worstYear: { year: string; pct: number } | null; note: string }
  asOf: string
}

const FRED = 'https://api.stlouisfed.org/fred/series/observations'
async function fred(series: string, units = 'lin'): Promise<{ date: string; v: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`${FRED}?series_id=${series}&units=${units}&api_key=${key}&file_type=json&observation_start=2005-01-01`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) })).filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}
const last = (a: { v: number }[]) => a.length ? a[a.length - 1].v : null
const atOrBefore = (a: { date: string; v: number }[], year: string) => { const f = a.filter(x => x.date <= `${year}-12-31`); return f.length ? f[f.length - 1].v : null }

// All Weather ETF 월봉(Yahoo max) → 연평균
async function yahooAnnual(ticker: string): Promise<Record<string, number>> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${ticker}?range=max&interval=1mo`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
      if (!r.ok) continue
      const j = await r.json(); const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []; const c: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const byYear: Record<string, number[]> = {}
      ts.forEach((t, i) => { const yr = new Date(t * 1000).getUTCFullYear().toString(); const v = c[i]; if (v != null && isFinite(v)) (byYear[yr] ??= []).push(v) })
      const out: Record<string, number> = {}
      for (const [yr, arr] of Object.entries(byYear)) out[yr] = arr.reduce((a, b) => a + b, 0) / arr.length
      if (Object.keys(out).length > 3) return out
    } catch { /* 다음 host */ }
  }
  return {}
}

// ② 빅 사이클 — 제국 국력지표 US vs 중국 (World Bank 공개 실데이터, 무료·무키). 브릿지워터 독점 점수 대신 실측만.
const WB = [
  { id: 'NY.GDP.MKTP.CD', label: '명목 GDP', disp: 'money' as const, note: '경제 규모 — 국력의 바탕' },
  { id: 'NE.EXP.GNFS.CD', label: '수출(재화+서비스)', disp: 'money' as const, note: '무역·공급망 장악력' },
  { id: 'MS.MIL.XPND.CD', label: '국방비', disp: 'money' as const, note: '기득 질서를 지키는 힘' },
  { id: 'GB.XPD.RSDV.GD.ZS', label: 'R&D 투자(GDP 대비)', disp: 'pct' as const, note: '혁신 = 미래 생산성' },
  { id: 'SP.POP.TOTL', label: '인구', disp: 'pop' as const, note: '노동력·내수 잠재력' },
]
async function worldBank(id: string): Promise<{ us: number; cn: number; year: string } | null> {
  try {
    // mrv=5로 최근 5개 관측 → 두 국가 모두 값 있는 가장 최근 '공통 연도'로 공정 비교(최신값이 한쪽만 null인 경우 방어, 예: 미 수출 2025 null)
    const r = await fetch(`https://api.worldbank.org/v2/country/USA;CHN/indicator/${id}?format=json&mrv=5&per_page=12`, { signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const j = await r.json()
    const rows: { country: { value: string }; date: string; value: number | null }[] = j?.[1] ?? []
    const us: Record<string, number> = {}, cn: Record<string, number> = {}
    for (const row of rows) {
      if (row.value == null) continue
      if (row.country.value.includes('United States')) us[row.date] = row.value
      else if (row.country.value.includes('China')) cn[row.date] = row.value
    }
    const common = Object.keys(us).filter(y => y in cn).sort()
    if (!common.length) return null
    const year = common[common.length - 1]
    return { us: us[year], cn: cn[year], year }
  } catch { return null }
}

export async function GET(req: Request) {
  const base = new URL(req.url).origin
  const cacheKey = 'dalio-cycle-v3'   // v3: World Bank 공통 연도 비교(미 수출 최신값 null 방어) — v2가 4지표만 캐시한 것 무효화
  const cached = await getCache<DalioCycleResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [debtGdpS, dsrS, realS, fedS, curveS, m2S, season] = await Promise.all([
    fred('GFDEGDQ188S'), fred('TDSP'), fred('DFII10'), fred('WALCL'), fred('T10Y2Y'), fred('M2SL', 'pc1'),
    getCurrentSeason(base).catch(() => null),
  ])
  const debtGdp = last(debtGdpS) ?? 0
  const debtGdpPrev = debtGdpS.length > 4 ? debtGdpS[debtGdpS.length - 5].v : debtGdp   // 1년 전(분기 4개)
  const debtGdpTrend: 'up' | 'down' | 'flat' = debtGdp > debtGdpPrev + 1 ? 'up' : debtGdp < debtGdpPrev - 1 ? 'down' : 'flat'
  const dsr = last(dsrS) ?? 0
  const realRate = last(realS) ?? 0
  const fedNow = last(fedS) ?? 0, fed6mo = fedS.length > 6 ? fedS[fedS.length - 7].v : fedNow
  const fedBsTrend: 'expanding' | 'contracting' | 'flat' = fedNow > fed6mo * 1.01 ? 'expanding' : fedNow < fed6mo * 0.99 ? 'contracting' : 'flat'
  const yieldCurve = last(curveS) ?? 0
  const m2Yoy = last(m2S)

  // ── 부채 사이클 신호(각 지표가 어느 국면 쪽인지) ──
  const signals: Signal[] = [
    { key: 'debtgdp', label: '총부채 / GDP', value: `${debtGdp.toFixed(0)}%`, reading: debtGdp > 100 ? '역사적 고부채(정점권 위험)' : '중간', lean: debtGdp > 100 ? 'late' : 'neutral' },
    { key: 'real', label: '실질금리(10년 TIPS)', value: `${realRate.toFixed(1)}%`, reading: realRate > 1 ? '긴축적(부채에 부담)' : realRate < 0 ? '완화적(부양·디레버리징)' : '중립', lean: realRate > 1 ? 'late' : realRate < 0 ? 'stimulus' : 'neutral' },
    { key: 'fedbs', label: '연준 대차대조표', value: `$${(fedNow / 1e6).toFixed(1)}T`, reading: fedBsTrend === 'expanding' ? '돈 풀기(QE·부양)' : fedBsTrend === 'contracting' ? '돈 거두기(QT·긴축)' : '유지', lean: fedBsTrend === 'expanding' ? 'stimulus' : fedBsTrend === 'contracting' ? 'late' : 'neutral' },
    { key: 'curve', label: '장단기 금리차(10Y-2Y)', value: `${yieldCurve > 0 ? '+' : ''}${yieldCurve.toFixed(2)}%p`, reading: yieldCurve < 0 ? '역전(정점·침체 선행)' : yieldCurve < 0.5 ? '평탄(후기)' : '정상', lean: yieldCurve < 0.5 ? 'late' : 'neutral' },
    { key: 'dsr', label: '가계 부채원리금 상환비율', value: `${dsr.toFixed(1)}%`, reading: dsr > 13 ? '상환 부담 큼' : '관리 가능', lean: dsr > 13 ? 'late' : 'neutral' },
  ]

  // ── 단계 추정(0 초기 ~ 5 정상화). 근거 조합 — 단정 아님 ──
  //   고부채 + 긴축(실질금리↑·QT·평탄곡선) = 정점/불황 압력 국면 / 완화(QE·마이너스 실질금리) = 디레버리징·부양
  const lateCount = signals.filter(s => s.lean === 'late').length
  const stimCount = signals.filter(s => s.lean === 'stimulus').length
  let stageIndex: number, stageLabel: string, stageNote: string
  if (stimCount >= 2 && debtGdp > 90) {
    stageIndex = 4; stageLabel = '아름다운 디레버리징(부양)'; stageNote = '고부채 상태에서 통화 완화(돈 풀기·마이너스 실질금리)로 부채 부담을 녹이는 국면 신호입니다.'
  } else if (lateCount >= 3 && debtGdp > 100) {
    stageIndex = 2; stageLabel = '정점 통과 · 긴축 압력'; stageNote = '역사적 고부채 위에 긴축(높은 실질금리·QT)이 겹친 후기 국면 신호. 달리오가 말한 "정점(Top)" 전후의 압력 구간입니다.'
  } else if (lateCount >= 2) {
    stageIndex = 1; stageLabel = '버블 형성 · 후기'; stageNote = '부채·자산가격이 높아진 후기 신호. 아직 긴축이 본격화되지 않았다면 버블 단계일 수 있습니다.'
  } else {
    stageIndex = 0; stageLabel = '초기 · 정상 확장'; stageNote = '부채 부담과 긴축 압력이 크지 않은 비교적 초·중기 국면 신호입니다.'
  }

  // ── 버블 7지표(달리오) → 앱 데이터 매핑. 정량 가능한 것만 실데이터, 나머지는 앱 내 도구로 안내 ──
  const bubble = await (async (): Promise<DalioCycleResult['bubble']> => {
    const factors: BubbleFactor[] = []
    // 1) 완화적 통화 → 실질금리
    factors.push({ label: '완화적 통화정책', status: realRate < 0 ? 'hot' : realRate < 1 ? 'warm' : 'cool', note: `실질금리 ${realRate.toFixed(1)}% — 낮을수록 버블 연료` })
    // 2) 부채 기반 구매 → 부채/GDP 추세
    factors.push({ label: '부채 기반 구매(신용 팽창)', status: debtGdpTrend === 'up' && debtGdp > 100 ? 'hot' : debtGdp > 100 ? 'warm' : 'cool', note: `부채/GDP ${debtGdp.toFixed(0)}% ${debtGdpTrend === 'up' ? '상승' : '안정'}` })
    // 3) 유동성 팽창 → M2 YoY
    factors.push({ label: '유동성(통화량) 팽창', status: m2Yoy != null && m2Yoy > 8 ? 'hot' : m2Yoy != null && m2Yoy > 4 ? 'warm' : 'cool', note: m2Yoy != null ? `M2 전년비 ${m2Yoy.toFixed(1)}%` : '자료없음' })
    // 4) 투기 열풍 → 앱의 칵테일 파티 지수(CNN F&G)로 안내
    let fng: number | null = null
    try { const c = await fetch(`${base}/api/cocktail-party`, { signal: AbortSignal.timeout(8_000) }); if (c.ok) { const cj = await c.json(); fng = cj?.score ?? cj?.fng ?? null } } catch { /* graceful */ }
    factors.push({ label: '투기 열풍(신규 구매자)', status: fng != null ? (fng >= 75 ? 'hot' : fng >= 55 ? 'warm' : 'cool') : 'link', note: fng != null ? `칵테일 파티 지수 ${fng}(탐욕↑=버블)` : '→ 대시보드 🍸 칵테일 파티 지수로 확인' })
    // 5) 가격 vs 역사평균(밸류에이션) → 앱 종목 밸류 도구로 안내(단일 숫자 부재)
    factors.push({ label: '가격 vs 역사평균(고평가)', status: 'link', note: '→ 종목별 역-DCF·PSR·모닝스타 별점으로 확인' })
    const hotN = factors.filter(f => f.status === 'hot').length, warmN = factors.filter(f => f.status === 'warm').length
    const score = Math.min(100, Math.round((hotN * 25 + warmN * 12) * (100 / 100)))
    const level: DalioCycleResult['bubble']['level'] = score >= 65 ? '과열' : score >= 40 ? '주의' : score >= 20 ? '중립' : '냉각'
    return { score, level, factors }
  })()

  // ── ② 빅 사이클: 제국 국력지표 US vs 중국 (World Bank 실데이터) ──
  const wbRaw = await Promise.all(WB.map(m => worldBank(m.id)))
  const wbMetrics = WB.map((m, i) => {
    const d = wbRaw[i]; if (!d) return null
    return { label: m.label, us: d.us, cn: d.cn, year: d.year, disp: m.disp, note: m.note, leader: (d.us >= d.cn ? 'US' : 'CN') as 'US' | 'CN' }
  }).filter((x): x is NonNullable<typeof x> => x != null)
  // 기축통화 비중은 무료 실시간 API 부재 → IMF COFER 공개 통계(출처·시점 명시). 달리오 "최후의 특권" 포인트.
  const worldPower = wbMetrics.length ? { metrics: wbMetrics, reserve: { usd: 57.8, cny: 2.2, source: 'IMF COFER 2024' } } : null

  // ── 역사 오버레이(현재 vs 2008 vs 2020) ──
  const history = [
    { metric: '총부채 / GDP', now: Math.round(debtGdp), y2008: Math.round(atOrBefore(debtGdpS, '2008') ?? 0), y2020: Math.round(atOrBefore(debtGdpS, '2020') ?? 0), unit: '%' },
    { metric: '실질금리(10Y)', now: Math.round(realRate * 10) / 10, y2008: Math.round((atOrBefore(realS, '2008') ?? 0) * 10) / 10, y2020: Math.round((atOrBefore(realS, '2020') ?? 0) * 10) / 10, unit: '%' },
    { metric: '장단기 금리차', now: Math.round(yieldCurve * 100) / 100, y2008: Math.round((atOrBefore(curveS, '2008') ?? 0) * 100) / 100, y2020: Math.round((atOrBefore(curveS, '2020') ?? 0) * 100) / 100, unit: '%p' },
  ]

  // ── All Weather 백테스트(리스크패리티 근사 비중, Yahoo max 연평균) ──
  const AW = { SPY: 0.30, TLT: 0.40, IEF: 0.15, GLD: 0.075, DBC: 0.075 }
  const ann = await Promise.all(Object.keys(AW).map(t => yahooAnnual(t)))
  const annMap: Record<string, Record<string, number>> = {}; Object.keys(AW).forEach((t, i) => { annMap[t] = ann[i] })
  const years: AllWeatherYear[] = []
  const allYears = Array.from(new Set(Object.values(annMap).flatMap(m => Object.keys(m)))).sort()
  let awGrowth = 1
  for (let i = 1; i < allYears.length; i++) {
    const y = allYears[i], py = allYears[i - 1]
    let awRet = 0, ok = true
    for (const [t, w] of Object.entries(AW)) { const cur = annMap[t][y], prev = annMap[t][py]; if (cur == null || prev == null) { ok = false; break } awRet += w * (cur / prev - 1) }
    const spyCur = annMap.SPY[y], spyPrev = annMap.SPY[py]
    if (!ok || spyCur == null || spyPrev == null) continue
    const spyRet = spyCur / spyPrev - 1
    awGrowth *= 1 + awRet
    years.push({ year: y, awPct: Math.round(awRet * 1000) / 10, spyPct: Math.round(spyRet * 1000) / 10 })
  }
  const n = years.length
  const cagr = n > 0 ? Math.round((Math.pow(awGrowth, 1 / n) - 1) * 1000) / 10 : 0
  const worstAw = years.length ? years.reduce((w, y) => (y.awPct < w.awPct ? y : w), years[0]) : null
  const worstYear = worstAw ? { year: worstAw.year, pct: worstAw.awPct } : null
  const usSeason = season?.usQuad ?? 'unknown'
  const allWeather = {
    usSeason, years, cagr, worstYear,
    note: '리스크 패리티 근사 비중(주식30·장기채40·중기채15·금7.5·원자재7.5). 연평균가 기준 근사치라 실제 리밸런싱 수익률과 차이 있음 — 교육용.',
  }

  const result: DalioCycleResult = {
    debt: { debtGdp: Math.round(debtGdp * 10) / 10, debtGdpTrend, dsr: Math.round(dsr * 10) / 10, realRate: Math.round(realRate * 10) / 10, fedBsTrend, yieldCurve: Math.round(yieldCurve * 100) / 100, m2Yoy: m2Yoy != null ? Math.round(m2Yoy * 10) / 10 : null, signals, stageIndex, stageLabel, stageNote },
    bubble, worldPower, history, allWeather, asOf: new Date().toISOString(),
  }
  if (debtGdp > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
