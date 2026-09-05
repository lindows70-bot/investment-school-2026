// 🚨 글로벌 위기 감지 레이더 — 시장 전체 버블/밸류에이션 4대 지표를 실데이터로 계산 + 종합 Alert.
// ① Shiller CAPE(multpl) ② 버핏지표(FRED 시총÷GDP) ③ S&P500 PER(multpl) ④ 위험프리미엄(어닝일드−10년물).
// ⚠️ 제미나이/구글의 하드코딩 숫자(41.6배 등) 대신 실데이터 계산(제1원칙). 임계 밴드는 공개 방법론 상수(교육용).
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { FACTSET_FWD_KEY } from '@/lib/localRunners'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
// FactSet 선행 12개월 PER — 로컬 러너(scripts/factset-forward.mjs)가 주간 PDF 파싱 후 app_cache에 적재한 값을 읽음.
// ⚠️ Vercel 서버는 FactSet CDN이 데이터센터 IP 차단으로 직접 파싱 불가 → 선생님 PC 러너 경유(KRX·토스 러너와 동일 보안·경로).
interface FactsetFwd { fwd: number; avg5: number | null; avg10: number | null; trailing?: number | null; date: string }
async function factsetForward(): Promise<FactsetFwd | null> {
  return await getCache<FactsetFwd>(FACTSET_FWD_KEY, 30 * 24 * 3600_000)   // 러너 적재분(주간 갱신, 30일 유효)
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
  // v9: 선행 PER 미수집 시 후행으로 **축을 함께** 전환(라벨·판정·게이지) — 옛 응답엔 잘못된 판정이 박혀 있어 반드시 범프
  const cacheKey = 'crisis-radar-v9'   // v8: explain 의 작성시점 하드코딩 제거 + 허위 인용 제거(내용만 바뀌어도 키를 올린다)
  const cached = await getCache<CrisisRadarResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [cape, pe, eyield, equities, gdp, dgs10, capeSer, peSer, eySer, gs10Ser, fwd] = await Promise.all([
    multpl('shiller-pe'), multpl('s-p-500-pe-ratio'), multpl('s-p-500-earnings-yield'),
    fred('NCBEILQ027S', '&observation_start=1995-01-01'),   // 비금융 법인 주식 시가총액($M, 분기)
    fred('GDP', '&observation_start=1995-01-01'),            // 명목 GDP($B, 분기)
    fred('DGS10', '&sort_order=desc&limit=1'),               // 10년물 국채(%)
    multplSeries('shiller-pe/table/by-month'),              // CAPE 역사
    multplSeries('s-p-500-pe-ratio/table/by-month'),        // PER 역사
    multplSeries('s-p-500-earnings-yield/table/by-month'),  // 어닝일드 역사(ERP용)
    fred('GS10', '&observation_start=1995-01-01&frequency=m'),   // 10년물 월별(ERP 역사용)
    factsetForward(),                                  // 🆕 S&P500 선행 12개월 PER(FactSet 실측)
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
    // ⚠️ 설명문에 작성시점 수치를 박지 마라 — value 는 매 요청 실계산이라 한 카드 안에서 두 숫자가 어긋난다(2026-08-30 감사).
    explain: `노벨상 수상자 실러 교수가 만든 지표. 주가를 최근 1년이 아닌 **10년 평균 이익**으로 나눕니다(일시적 호황 이익에 안 속으려고). ${cape != null ? `현재 ${cape}배 = 이익 1달러를 얻으려 ${cape}달러를 내는 셈. 역사평균 17배의 약 ${Math.round(cape / 17 * 10) / 10}배` : '역사평균은 약 17배'}로, 이 수준에선 향후 10년 주식 수익률이 역사적으로 낮았습니다.`,
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
    // ⚠️ 버핏이 말한 임계는 "200% 근접"이지 150% 가 아니다 — 허위 인용으로 임계값 근거를 위장하지 마라(2026-08-30 감사).
    //    150% 는 **이 앱이 정한 경고선**이므로 그렇게 밝힌다. 과거 고점도 하드코딩 대신 buffettAt() 실계산을 쓴다.
    note: buffett == null ? '데이터 조회 실패' : buffett >= 150 ? `경제 규모 대비 과도한 거품 — 앱 경고선 150% 초과(현재 ${buffett}%)` : '경제 규모 대비 밸류에이션 정상권',
    explain: `워런 버핏이 "가장 좋은 단일 밸류에이션 지표"라 극찬. 나라 전체 주식 시가총액을 **GDP(경제가 1년에 버는 돈)** 로 나눕니다. 경제가 버는 것보다 주식값이 얼마나 부풀었나. 100%=경제와 균형${buffett != null ? `, 현재 ${buffett}%` : ''}. 과거 고점: 닷컴 ${buffettAt('2000-03-31')}% · 금융위기 전 ${buffettAt('2007-09-30')}% · 팬데믹 ${buffettAt('2020-03-31')}% (전부 FRED 실계산).`,
    alertText: buffett != null && buffett >= 150 ? '극도의 과열 (역대 최고권)' : '보통',
    gauge: { min: 50, max: 230, t1: 120, t2: 150, invert: false },
    series: buffettSer,
    history: [{ label: '2000 닷컴', value: buffettAt('2000-03-31') }, { label: '2008 위기 전', value: buffettAt('2007-09-30') }, { label: '2020 팬데믹', value: buffettAt('2020-03-31') }],
  })

  // ③ S&P 500 PER — 선행(FactSet 러너 실측)이 원칙, 없으면 **후행으로 축을 바꿔** 표시한다.
  //
  // ⚠️ 2026-09-05 실사고: 예전엔 러너가 없으면 `fwd ? fwd.fwd : pe` 로 후행 값을 넣고도
  //    **선행 임계(18/22)로 판정**했다. 성장 기대가 있으면 후행 > 선행이 정상이라(실측 후행 26.5 vs 선행 19.5)
  //    폴백 상태에선 거의 항상 22를 넘어 'danger' 가 떴고, 경보문은 `고평가 (예상이익 기준)` 이라고
  //    **확정이익 숫자에 예상이익 이름표**를 달았다. 게다가 러너가 두 달간 죽어 있었는데 문구는 '일시 조회 실패'였다.
  //    → 폴백은 **판정에 넣지 않는다**(앱 규칙: 결과 배지는 원천 값 존재를 확인한 뒤에만).
  //       값은 그대로 보여주되 라벨·잣대·게이지를 **후행 규격으로 함께** 바꾼다.
  //    후행 규격 16/25 는 지어낸 값이 아니라 이 카드의 차트 기준선이 이미 쓰던 값이다
  //    (CrisisRadar.tsx 의 `m.key === 'pe'` 분기 — 평균16·위험25).
  metrics.push({
    key: 'pe',
    label: fwd ? 'S&P 500 선행 PER' : 'S&P 500 후행 PER',
    icon: '💰',
    measure: fwd ? '주가 vs 향후 12개월 예상이익' : '주가 vs 지난 12개월 확정이익',
    value: fwd ? fwd.fwd : pe, unit: '배',
    mean: fwd?.avg10 ?? 16,
    norm: fwd ? `FactSet 5년평균 ${fwd.avg5}·10년평균 ${fwd.avg10}` : '후행 30년 평균 ≈ 16배 · 25배↑ 과열',
    // 선행 PER 임계(FactSet 기준): <18 안전 / 18~22 주의 / 22↑ 위험
    // 선행이 없으면 **판정 보류** — 다른 잣대(후행)로 잰 값에 선행 판정을 붙이지 않는다.
    signal: fwd == null ? 'caution' : fwd.fwd >= 22 ? 'danger' : fwd.fwd >= 18 ? 'caution' : 'safe',
    note: fwd
      ? `선행 ${fwd.fwd}배(FactSet ${fwd.date} 실측) — 향후 1년 예상이익 기준. 5년평균 ${fwd.avg5}·10년평균 ${fwd.avg10}보다 높아 '주의'. 참고: 후행(확정이익) PER은 ${pe ?? '—'}배로 더 비쌈(성장 기대가 큰 만큼 선행이 낮게 나옴).`
      : (pe == null ? '데이터 조회 실패' : `선행 PER 미수집(선생님 PC 러너가 주 1회 적재) → 지금 보이는 ${pe}배는 **후행**(확정이익) 값이고, 선행 기준 판정은 보류했습니다.`),
    explain: fwd
      ? `주가를 **향후 1년 예상이익**으로 나눈 값(월가 애널리스트 컨센서스). 뉴스에서 가장 많이 인용하는 밸류에이션. 현재 ${fwd.fwd}배 = FactSet(권위 원천)의 매주 발표치. 5년평균 ${fwd.avg5}배보다 조금 높아 '주의'. 후행 PER(확정이익 기준 ${pe}배)보다 낮은 건, 시장이 앞으로 이익이 크게 늘 것으로 기대(AI 등)하기 때문입니다.`
      : `지금은 **후행 PER**입니다 — 주가를 **지난 1년 확정이익**으로 나눈 값. 원래 보여주려던 선행 PER(향후 1년 예상이익 기준)은 FactSet 주간 발표치라 선생님 PC 러너가 적재하는데, 아직 안 들어왔습니다. 두 숫자는 잣대가 달라(보통 후행이 더 큽니다) 선행 기준 판정은 붙이지 않았습니다.`,
    alertText: fwd == null
      ? '선행 PER 미수집 — 판정 보류'
      : fwd.fwd >= 22 ? '고평가 (예상이익 기준)' : fwd.fwd >= 18 ? '주의 (5년평균 상회·실적 기대 선반영)' : '보통',
    // 게이지 눈금도 축을 따라간다 — 후행 값에 선행 임계 밴드를 그리면 문구로 상쇄되지 않는다
    gauge: fwd ? { min: 10, max: 30, t1: 18, t2: 22, invert: false } : { min: 10, max: 35, t1: 16, t2: 25, invert: false },
    series: peSer,   // 차트는 후행 PER 30년(선행 장기 시계열은 무료 미제공) — 카드에 라벨 명시
  })

  // ④ 위험 프리미엄(ERP) = 어닝일드 − 10년물
  const y10 = dgs10.length ? dgs10[dgs10.length - 1].v : null
  const erp = eyield != null && y10 != null ? Math.round((eyield - y10) * 100) / 100 : null
  metrics.push({
    key: 'erp', label: '주식 위험 프리미엄', icon: '⚖️', measure: '주식 기대수익률(어닝일드) vs 10년 국채',
    value: erp, unit: '%p', mean: 4.5, norm: '역사평균 ≈ 4~5%p',
    signal: erp == null ? 'caution' : erp < 1 ? 'danger' : erp < 3 ? 'caution' : 'safe',
    note: erp == null ? '데이터 조회 실패' : erp < 1 ? `어닝일드 ${eyield}% vs 국채 ${y10}% → 프리미엄 ${erp}%p. 채권 대비 주식 메리트 역사적 최저(위험 감수 이유 급감)` : '채권 대비 주식이 합리적 보상 제공',
    // ⚠️ '역대급/역사적 최저'는 이력 대비 검증 없이 쓰지 마라 — 설명문 수치도 실계산 보간으로(2026-08-30 감사).
    explain: `"위험한 주식을 살 추가 보상"을 잰다. 주식 기대수익(이익÷주가 = 어닝일드)에서 **안전한 10년 국채 금리**를 뺍니다. 높을수록 주식이 매력적, 낮을수록 위험. ${erp != null ? `현재 ${erp}%p${erp < 0 ? ' = 주식 기대수익이 안전한 국채보다도 낮음 → 굳이 주식 위험을 감수할 이유가 적다는 신호' : ''}` : '역사평균은 약 4~5%p'}.`,
    alertText: erp != null && erp < 1 ? '위험 (채권 대비 메리트 급감)' : '보통',
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
