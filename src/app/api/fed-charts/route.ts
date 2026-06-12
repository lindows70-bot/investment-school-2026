// 📊 연준 핵심지표 차트보드 API — 물가 3겹(노이즈 벗기기)·PPI(물가의 상류)·고용 듀얼·연준의 실탄(금리-기조물가 갭)
// Zero Cost(FRED 무료)·12h 캐시·전 시리즈 Promise.all(BFF — 호출 폭주 방지)·해석 문구는 전부 동적 계산(박제 금지)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const KEY = process.env.FRED_API_KEY
// extra: '&units=pc1'(전년비%) · '&units=pch'(전월비%) · '&frequency=m&aggregation_method=eop'(일별→월말 다운샘플링)
async function fred(series: string, limit: number, extra = ''): Promise<{ date: string; v: number }[]> {
  if (!KEY) return []
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${KEY}&file_type=json&sort_order=desc&limit=${limit}${extra}`, { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) }))
      .filter((o: { v: number }) => isFinite(o.v))
      .reverse()   // 오래된 → 최신 (차트용)
  } catch { return [] }
}

const ym = (d: string) => d.slice(0, 7)   // YYYY-MM 조인 키
const r2 = (n: number) => Math.round(n * 100) / 100

export interface FedChartsResult {
  // ① 물가 4겹 — 헤드라인 CPI vs 근원 CPI vs 근원 PCE(연준 공식 목표) vs 절사평균 PCE (5년, 전년비%)
  inflation: { date: string; headline: number | null; core: number | null; corePce: number | null; trimmed: number | null }[]
  inflationNote: string
  // ② PPI 전월비(%) — CPI의 상류 (36개월)
  ppi: { date: string; v: number }[]
  ppiReaccel: boolean         // 최근 2개월 평균이 직전 6개월 평균 대비 크게 상회 → 재가속 경고
  ppiNote: string
  // ③ 고용 듀얼 — 비농업 MoM(천명) 막대 + 실업률(%) 라인 (24개월)
  labor: { date: string; payemsK: number; unrate: number | null }[]
  laborNote: string
  // ④ 연준의 실탄 — FF금리(월말) vs 절사평균 PCE, 갭 = 실질 긴축 강도 (5년)
  ammo: { date: string; ffr: number | null; trimmed: number | null; gap: number | null }[]
  ammoNote: string
  asOf: string
}

export async function GET() {
  const cacheKey = 'fed-charts-v3'   // v3: 근원 PCE 라인 + CPI↔PCE 괴리 양방향 해석
  const cached = await getCache<FedChartsResult>(cacheKey, 12 * 3600_000)
  if (cached && cached.inflation.length > 0) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 전 시리즈 일괄 수집(BFF) — 분당 제한 회피·요청 1회로 응집
  const [cpiH, cpiC, pceC, trimmed, ppi, payems, unrate, ffr] = await Promise.all([
    fred('CPIAUCSL', 61, '&units=pc1'),                              // 헤드라인 CPI YoY
    fred('CPILFESL', 61, '&units=pc1'),                              // 근원 CPI YoY
    fred('PCEPILFE', 61, '&units=pc1'),                              // 근원 PCE YoY — 연준 공식 목표 지표(2000년~)
    fred('PCETRIM12M159SFRBDAL', 61),                                // 절사평균 PCE(이미 12M %)
    fred('PPIFIS', 37, '&units=pch'),                                // PPI 최종수요 MoM
    fred('PAYEMS', 26),                                              // 비농업(레벨, 천명) → diff
    fred('UNRATE', 25),                                              // 실업률
    fred('DFEDTARU', 61, '&frequency=m&aggregation_method=eop'),    // 일별 상단금리 → 월말 다운샘플링(주기 불일치 해소)
  ])

  // ① 물가 3겹 — 월 키로 조인(시리즈별 발행 시차는 null 허용, 차트가 끊김 없이 그리도록 connectNulls)
  const months = Array.from(new Set([...cpiH, ...cpiC, ...pceC, ...trimmed].map(o => ym(o.date)))).sort().slice(-60)
  const byYm = (arr: { date: string; v: number }[]) => new Map(arr.map(o => [ym(o.date), o.v]))
  const hM = byYm(cpiH), cM = byYm(cpiC), pM = byYm(pceC), tM = byYm(trimmed)
  const inflation = months.map(m => ({
    date: m, headline: hM.has(m) ? r2(hM.get(m)!) : null, core: cM.has(m) ? r2(cM.get(m)!) : null,
    corePce: pM.has(m) ? r2(pM.get(m)!) : null, trimmed: tM.has(m) ? r2(tM.get(m)!) : null,
  }))
  const lastH = [...cpiH].pop()?.v, lastC = [...cpiC].pop()?.v, lastP = [...pceC].pop()?.v, lastT = [...trimmed].pop()?.v
  // CPI-PCE 괴리(주거비 가중치 차이) 동적 언급 — 근원끼리 비교
  const cpiPceGap = lastC != null && lastP != null ? r2(lastC - lastP) : null
  const inflationNote = lastH != null && lastC != null && lastT != null
    ? `노이즈를 한 겹씩 벗기면 — 헤드라인 CPI ${r2(lastH)}% → 근원 CPI ${r2(lastC)}%${lastP != null ? ` → 근원 PCE ${r2(lastP)}%(연준 공식 목표)` : ''} → 절사평균 ${r2(lastT)}%${lastT <= 2.2 ? '로 목표(2%)에 근접합니다. 헤드라인 공포에 속지 마세요.' : '. 기조 물가가 아직 목표(2%) 위라 연준은 신중할 명분이 있습니다.'}` +
      (cpiPceGap != null && cpiPceGap >= 0.3 ? ` 근원 CPI가 근원 PCE보다 ${cpiPceGap}%p 높습니다 — 주거비 가중치 차이(CPI ~34% vs PCE ~15%)로 임대료 시차가 CPI를 부풀리는 국면, 연준이 보는 물가는 그보다 낮습니다.`
        : cpiPceGap != null && cpiPceGap <= -0.3 ? ` 근원 PCE가 근원 CPI보다 ${r2(-cpiPceGap)}%p 높습니다 — 의료·서비스 쪽 물가 압력이 큰 국면이라, 연준이 보는 물가가 뉴스의 CPI보다 오히려 높다는 뜻이니 인하 기대를 서두르지 마세요.` : '')
    : '자료 수집 중'

  // ② PPI — 재가속 판정: 최근 2개월 평균 vs 직전 6개월 평균
  const ppiSeries = ppi.slice(-36).map(o => ({ date: ym(o.date), v: r2(o.v) }))
  const recent2 = ppiSeries.slice(-2).reduce((s, x) => s + x.v, 0) / Math.max(1, Math.min(2, ppiSeries.length))
  const prev6 = ppiSeries.slice(-8, -2)
  const prev6avg = prev6.length ? prev6.reduce((s, x) => s + x.v, 0) / prev6.length : recent2
  const ppiReaccel = recent2 >= 0.7 && recent2 > prev6avg + 0.3
  const lastPpi = ppiSeries[ppiSeries.length - 1]
  const ppiNote = lastPpi
    ? `생산자물가(PPI)는 소비자물가(CPI)의 상류 — 2~3개월 시차로 전가됩니다. 최근 ${lastPpi.date} 전월비 ${lastPpi.v > 0 ? '+' : ''}${lastPpi.v}%${ppiReaccel ? ' — 최근 흐름이 직전 추세를 크게 웃돌아 CPI 재가속 경고등이 켜졌습니다.' : ' — 상류 물가는 추세 범위 안입니다.'}`
    : '자료 수집 중'

  // ③ 고용 듀얼 — PAYEMS diff(MoM 천명) + 실업률
  const uM = byYm(unrate)
  const labor: FedChartsResult['labor'] = []
  for (let i = 1; i < payems.length; i++) {
    const m = ym(payems[i].date)
    labor.push({ date: m, payemsK: Math.round(payems[i].v - payems[i - 1].v), unrate: uM.has(m) ? r2(uM.get(m)!) : null })
  }
  const labor24 = labor.slice(-24)
  const recent3 = labor24.slice(-3).reduce((s, x) => s + x.payemsK, 0) / Math.max(1, Math.min(3, labor24.length))
  const prior12 = labor24.slice(0, -3)
  const prior12avg = prior12.length ? prior12.reduce((s, x) => s + x.payemsK, 0) / prior12.length : recent3
  const laborNote = labor24.length
    ? `최근 3개월 평균 +${Math.round(recent3)}K vs 그 이전 평균 +${Math.round(prior12avg)}K — 고용 증가세가 ${recent3 < prior12avg * 0.6 ? '뚜렷이 둔화 중(연준의 무게중심이 고용으로 이동할 수 있음)' : recent3 > prior12avg * 1.4 ? '재가속 중(임금발 인플레 주의)' : '완만하게 유지 중(연착륙 경로)'}입니다.`
    : '자료 수집 중'

  // ④ 연준의 실탄 — FF금리(월말) vs 절사평균, 갭 = 실질 긴축 강도
  const fM = byYm(ffr)
  const ammo = months.map(m => {
    const f = fM.has(m) ? r2(fM.get(m)!) : null
    const t = tM.has(m) ? r2(tM.get(m)!) : null
    return { date: m, ffr: f, trimmed: t, gap: f != null && t != null ? r2(f - t) : null }
  })
  const lastGap = [...ammo].reverse().find(a => a.gap != null)?.gap ?? null
  const ammoNote = lastGap != null
    ? `기준금리 − 기조물가 갭 = 연준의 '실탄'(실질 긴축 강도). 현재 ${lastGap}%p — ${lastGap >= 1.5 ? '갭이 넉넉해 물가만 안정되면 내릴 여유가 충분합니다.' : lastGap >= 0.5 ? '여유가 줄어드는 중 — 인하 카드를 아껴 쓸 구간입니다.' : '실탄이 거의 소진 — 추가 완화 여력이 제한적입니다.'}`
    : '자료 수집 중'

  const result: FedChartsResult = {
    inflation, inflationNote,
    ppi: ppiSeries, ppiReaccel, ppiNote,
    labor: labor24, laborNote,
    ammo, ammoNote,
    asOf: new Date().toISOString(),
  }
  if (inflation.length > 0 && ppiSeries.length > 0) await setCache(cacheKey, result)   // 불완전 데이터 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
