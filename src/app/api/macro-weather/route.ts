/**
 * GET /api/macro-weather
 *
 * 🌤️ 피터 린치의 13분 날씨예보 (비밀병기 6단계)
 *
 * 피터 린치: "거시경제 분석에 1년에 13분 이상 쓴다면, 그중 10분은 낭비다."
 *  → 복잡한 유동성·신용 지표를 '날씨' 하나로 치환해 학생의 공포를 다스린다.
 *
 * ── 데이터 (FRED, 무료 · 서버사이드 키) ──
 *  · 순유동성(Net Liquidity) = WALCL − WTREGEN − RRPONTSYD
 *      (연준 대차대조표 − 재무부 TGA − 역레포). 시중 유동성의 핵심 프록시.
 *  · 신용 스트레스 = BAMLH0A0HYM2 (하이일드 스프레드, %). 기업 부도위험 체온계.
 *
 * 날씨 판정: HY 스프레드(주신호) + 순유동성 추세(보조) + HY 급등(블랙스완)
 * Cron 불필요 — 실시간 fetch + 12시간 캐시
 */

import { NextResponse } from 'next/server'

export interface MacroWeather {
  weather:      'clear' | 'cloudy' | 'storm'
  emoji:        string
  label:        string
  advice:       string
  lynchQuote:   string
  hySpread:     number | null     // 하이일드 스프레드 (%)
  hySpike:      number | null     // 4주간 변화 (%p, +면 악화)
  netLiquidity: number | null     // 순유동성 ($조)
  nlTrend:      number | null     // 4주간 변화 ($십억)
  nlRising:     boolean
  source:       'fred' | 'fallback'
  asOf:         string
}

const CACHE: { data: MacroWeather | null; expiresAt: number } = { data: null, expiresAt: 0 }
const CACHE_TTL = 12 * 3600_000   // 12시간 (FRED 일/주 단위 갱신)

// ── FRED 시리즈 조회 (최신순, 재시도) ────────────────────────────────────────
// ⚠️ 동시 호출 시 일부 시리즈가 빈 응답을 주는 일이 있어(순유동성 null 버그) → 2회 재시도 + no-store
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function fredSeries(id: string, limit: number): Promise<{ date: string; value: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}` +
              `&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d: any = await res.json()
        const out = (d?.observations ?? [])
          .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }))
          .filter((o: { value: number }) => isFinite(o.value))
        if (out.length) return out
      }
    } catch { /* 재시도 */ }
    if (attempt < 2) await sleep(500)
  }
  return []
}

// ── 날씨 판정 (HY 스프레드 주신호) ───────────────────────────────────────────
function decide(hy: number | null, hySpike: number | null, nlRising: boolean): MacroWeather['weather'] {
  if (hy == null) return 'cloudy'
  // 블랙스완: 신용 스프레드 급등(부도위험 폭증)
  if (hy > 5.5 || (hySpike != null && hySpike > 1.0)) return 'storm'
  // 경계: 신용시장 불안 조짐
  if (hy > 4.0) return 'cloudy'
  // 평온: 단, 유동성이 빠르게 마르면 한 단계 흐림
  if (!nlRising && hy > 3.4) return 'cloudy'
  return 'clear'
}

const COPY: Record<MacroWeather['weather'], Pick<MacroWeather, 'emoji' | 'label' | 'advice' | 'lynchQuote'>> = {
  clear: {
    emoji: '☀️', label: '맑음 — 순항 중',
    advice: '신용시장이 평온하고 유동성도 넉넉합니다. 거시경제는 잊고, 좋은 기업의 실적에만 집중하세요.',
    lynchQuote: '"거시경제에 1년에 13분 이상 쓰면 그중 10분은 낭비다." — 피터 린치',
  },
  cloudy: {
    emoji: '⛅', label: '흐림 — 약간의 긴장',
    advice: '유동성이 줄거나 신용 스프레드가 들썩입니다. 겁먹을 정도는 아니지만, 부채 많은 기업은 점검해 두세요.',
    lynchQuote: '"준비된 자에게 하락은 기회다. 단, 빚 많은 기업은 폭풍에 약하다." — 피터 린치',
  },
  storm: {
    emoji: '⛈️', label: '폭풍우 — 신용 경보',
    advice: '하이일드 스프레드가 급등 중입니다(기업 부도위험↑). 적자·고부채 기업은 위험합니다. 단, 실적 탄탄한 우량주를 헐값에 줍줍할 기회이기도 합니다.',
    lynchQuote: '"공포가 극에 달했을 때, 살아남을 기업과 죽을 기업이 갈린다." — 피터 린치',
  },
}

export async function GET() {
  if (CACHE.data && Date.now() < CACHE.expiresAt) {
    return NextResponse.json(CACHE.data, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    // WALCL·WTREGEN(주간) + RRP·HY(일간) — 순차 조회(동시 호출 시 빈응답 버그 회피)
    const walcl = await fredSeries('WALCL', 6)          // 주간 6주
    const tga   = await fredSeries('WTREGEN', 6)        // 주간 6주
    const rrp   = await fredSeries('RRPONTSYD', 25)     // 일간 ~5주
    const hy    = await fredSeries('BAMLH0A0HYM2', 25)  // 일간 ~5주

    if (!hy.length || !walcl.length) {
      if (CACHE.data) return NextResponse.json({ ...CACHE.data, source: 'fallback' as const })
      throw new Error('FRED 데이터 없음')
    }

    // 순유동성 ($M): WALCL − WTREGEN − RRP(×1000, $B→$M)
    const nlAt = (wi: number, ri: number) => {
      const w = walcl[wi]?.value, t = tga[wi]?.value, r = rrp[ri]?.value
      if (w == null || t == null || r == null) return null
      return w - t - r * 1000
    }
    const nlNow = nlAt(0, 0)
    const nl4wk = nlAt(Math.min(4, walcl.length - 1), Math.min(20, rrp.length - 1))
    const nlTrend = (nlNow != null && nl4wk != null) ? nlNow - nl4wk : null   // $M
    const nlRising = (nlTrend ?? 0) > 0

    const hyNow = hy[0]?.value ?? null
    const hy4wk = hy[Math.min(20, hy.length - 1)]?.value ?? null
    const hySpike = (hyNow != null && hy4wk != null) ? hyNow - hy4wk : null

    const weather = decide(hyNow, hySpike, nlRising)
    const result: MacroWeather = {
      weather, ...COPY[weather],
      hySpread:     hyNow != null ? Math.round(hyNow * 100) / 100 : null,
      hySpike:      hySpike != null ? Math.round(hySpike * 100) / 100 : null,
      netLiquidity: nlNow != null ? Math.round(nlNow / 1e6 * 100) / 100 : null,   // $조
      nlTrend:      nlTrend != null ? Math.round(nlTrend / 1e3) : null,           // $십억
      nlRising,
      source:       'fred',
      asOf:         new Date().toISOString(),
    }

    CACHE.data = result
    // 순유동성이 비면(일부 시리즈 실패) 12h 대신 20분만 캐시 → 곧 재시도
    CACHE.expiresAt = Date.now() + (result.netLiquidity != null ? CACHE_TTL : 20 * 60_000)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })

  } catch (e) {
    if (CACHE.data) return NextResponse.json({ ...CACHE.data, source: 'fallback' as const })
    const neutral: MacroWeather = {
      weather: 'cloudy', ...COPY.cloudy,
      hySpread: null, hySpike: null, netLiquidity: null, nlTrend: null, nlRising: false,
      source: 'fallback', asOf: new Date().toISOString(),
    }
    console.warn('[macro-weather]', (e as Error).message)
    return NextResponse.json(neutral)
  }
}
