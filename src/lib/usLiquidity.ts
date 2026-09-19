// 🇺🇸 미국 유동성 한 화면 — "지금 돈이 풀리고 있나, 마르고 있나"를 기존 SSOT 다섯 개를 **조립**해 답한다(신규 판정기 0 · 제2원칙).
//    순유동성·HY 스프레드 = /api/macro-weather · 수익률곡선 = /api/yield-curve · 금리 방향·다음 FOMC = /api/macro-regime
//    계절(유리/불리 섹터) = currentSeason + SEASON_META · 은행 대출태도 = FRED DRTSCILM(신규, 분기) · 달러·BTC·S&P 4주 = techChartData
//    ⛔ 보고서의 "3개월 Bull/Base/Bear 확률"은 만들지 않는다 — 근거 없는 확률은 가짜 정밀. 국면은 4계절 SSOT 가 이미 말한다.
//    설계: docs/us-smart-money/plan.md (절 1)
import { getCache, setCache } from '@/lib/appCache'
import { getCurrentSeason } from '@/lib/currentSeason'
import { SEASON_META, type Quadrant } from '@/lib/seasonNavigator'
import { sectorMeta } from '@/lib/gicsSectorMeta'
import { getTechCandles, dropIncompleteBar } from '@/lib/techChartData'

export const US_LIQUIDITY_KEY = (kst: string) => `us-liquidity-v1:${kst}`

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'
export interface Gauge {
  key: string; label: string
  value: string                       // 표시값(단위 포함)
  sub: string | null                  // 기준일·변화
  meaning: string                     // 학생용 한 줄 — "이게 뭔 뜻인가"
  tone: Tone
}
export interface UsLiquidity {
  asOf: string
  answer: string                      // 답 한 줄
  weather: { emoji: string; label: string; advice: string } | null
  gauges: Gauge[]
  season: { quad: Quadrant; ko: string; guide: string; favored: { sector: string; ko: string; icon: string }[]; unfavored: { sector: string; ko: string; icon: string }[] } | null
  cross: { label: string; chg4wPct: number | null; note: string }[]
  nextFomc: { date: string; dDay: number } | null
  sources: string[]
  missing: string[]                   // 못 구한 것 — 화면에 그대로
}

const j = async <T,>(url: string): Promise<T | null> => {
  try { const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) }); return r.ok ? await r.json() as T : null } catch { return null }
}
const pct = (a: number, b: number) => Math.round((a / b - 1) * 1000) / 10

/** FRED 은행 대출태도(DRTSCILM: 대·중견기업 C&I 대출 기준을 강화한 은행 순비율, 분기) — 양수·상승이면 돈 빌리기가 어려워진다 */
async function sloos(): Promise<{ v: number; date: string; prev: number | null } | null> {
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DRTSCILM&api_key=${key}&file_type=json&sort_order=desc&limit=3`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return null
    const obs = ((await r.json()).observations ?? []).filter((o: { value: string }) => o.value !== '.')
    if (!obs.length) return null
    return { v: +obs[0].value, date: obs[0].date, prev: obs[1] ? +obs[1].value : null }
  } catch { return null }
}

export async function buildUsLiquidity(base: string): Promise<UsLiquidity> {
  type Weather = { weather: 'clear' | 'cloudy' | 'storm'; emoji: string; label: string; advice: string; hySpread: number | null; hySpike: number | null; netLiquidity: number | null; nlTrend: number | null; nlRising: boolean; source: string }
  type Curve = { shape: string; shapeNote: string; spreads: { key: string; label: string; value: number | null; date: string | null; invertedDays: number }[]; alert: string; alertHeadline: string }
  type Regime = { fedRate: number; rateDir: 'cut' | 'hold' | 'hike'; rateDirLabel: string; nextFomc: { date: string; dDay: number } | null; label: string; description: string }
  const [w, c, r, season, s, dxy, btc, spx] = await Promise.all([
    j<Weather>(`${base}/api/macro-weather`), j<Curve>(`${base}/api/yield-curve`), j<Regime>(`${base}/api/macro-regime`),
    getCurrentSeason(base).catch(() => null), sloos(),
    // 상관 레이더와 같은 티커(UUP·BTC-USD·SPY) — 같은 축을 다른 심볼로 재지 않는다
    getTechCandles('UUP', 'US', 'D').then(d => dropIncompleteBar(d, 'US')).catch(() => []),
    getTechCandles('BTC-USD', 'US', 'D').then(d => dropIncompleteBar(d, 'US')).catch(() => []),
    getTechCandles('SPY', 'US', 'D').then(d => dropIncompleteBar(d, 'US')).catch(() => []),
  ])
  const missing: string[] = []
  const gauges: Gauge[] = []

  // ① 순유동성 — 연준 자산 − 재무부 계좌 − 역레포. 4주 변화 방향이 곧 "풀리나/마르나"
  if (w && w.netLiquidity != null && w.source === 'fred') {
    gauges.push({ key: 'netLiq', label: '시중 유동성(순유동성)', value: `$${w.netLiquidity}조`, sub: w.nlTrend != null ? `4주 ${w.nlTrend >= 0 ? '+' : ''}$${(w.nlTrend * 10).toLocaleString()}억` : null,   // nlTrend 단위 $십억 → 억
      meaning: w.nlRising ? '연준이 푼 돈에서 정부 계좌·역레포에 묶인 돈을 뺀 값이 4주째 늘고 있습니다 — 시장에 돈이 들어오는 쪽.' : '연준 자산에서 정부 계좌·역레포에 묶인 돈을 뺀 값이 줄고 있습니다 — 시장에서 돈이 빠지는 쪽.',
      tone: w.nlRising ? 'good' : 'warn' })
  } else missing.push('순유동성(FRED)')
  // ② 신용 스트레스 — HY 스프레드
  if (w && w.hySpread != null) {
    const hy = w.hySpread, spike = w.hySpike ?? 0
    gauges.push({ key: 'hy', label: '기업 돈줄 온도(하이일드 스프레드)', value: `${hy.toFixed(2)}%p`, sub: w.hySpike != null ? `4주 ${spike >= 0 ? '+' : ''}${spike.toFixed(2)}%p` : null,
      meaning: hy > 5 ? '신용등급 낮은 기업이 빌리는 이자가 국채보다 5%p 넘게 비쌉니다 — 부도 공포 구간. 빚 많은 기업이 먼저 흔들립니다.' : hy > 3.4 ? '위험한 기업의 조달 비용이 들썩입니다 — 겁먹을 정도는 아니지만 부채 많은 종목은 점검.' : '신용등급 낮은 기업도 싸게 돈을 빌립니다 — 신용시장이 평온하다는 뜻.',
      tone: hy > 5 ? 'bad' : hy > 3.4 || spike > 0.5 ? 'warn' : 'good' })
  } else missing.push('하이일드 스프레드(FRED)')
  // ③ 수익률곡선
  if (c && c.spreads?.length) {
    const s2 = c.spreads.find(x => x.key === 't10y2y'), s3 = c.spreads.find(x => x.key === 't10y3m')
    const inv = c.shape === 'inverted'
    gauges.push({ key: 'curve', label: '수익률곡선(10년−2년 · 10년−3개월)', value: `${s2?.value != null ? (s2.value >= 0 ? '+' : '') + s2.value.toFixed(2) : '—'} · ${s3?.value != null ? (s3.value >= 0 ? '+' : '') + s3.value.toFixed(2) : '—'}%p`,
      sub: `${c.shape === 'normal' ? '정상' : c.shape === 'flat' ? '평평' : c.shape === 'inverted' ? '역전' : '혹'} 곡선 · ${s2?.date ?? ''}`,
      meaning: inv ? '단기 금리가 장기보다 높은 역전 상태 — 역사적으로 침체가 7~23개월 뒤에 왔지만 2022년엔 안 왔습니다. 타이밍 신호가 아니라 경계 신호.' : c.shape === 'flat' ? '장·단기 금리 차가 거의 없습니다 — 경기 전망이 갈리는 구간.' : '장기 금리가 단기보다 높은 정상 모양 — 경기 확장 전망을 시장이 유지하고 있습니다.',
      tone: c.alert === 'red' ? 'bad' : inv || c.alert === 'watch' || c.alert === 'brief' ? 'warn' : 'good' })
  } else missing.push('수익률곡선(FRED)')
  // ④ 금리 방향(FF 선물)
  if (r) {
    gauges.push({ key: 'rate', label: '기준금리 · 시장이 보는 방향', value: `${r.fedRate}% · ${r.rateDirLabel}`, sub: r.nextFomc ? `다음 FOMC ${r.nextFomc.date} (D-${r.nextFomc.dDay})` : null,
      meaning: r.rateDir === 'cut' ? '연방기금 선물이 인하를 반영합니다 — 돈값이 싸지는 쪽. 성장주가 먼저 반응하는 국면.' : r.rateDir === 'hike' ? '선물이 인상을 반영합니다 — 돈값이 비싸지는 쪽. 빚 많은 성장주가 불리.' : '선물이 동결을 반영합니다 — 방향보다 물가·고용 지표 하나하나에 시장이 흔들리는 국면.',
      tone: r.rateDir === 'cut' ? 'good' : r.rateDir === 'hike' ? 'warn' : 'neutral' })
  } else missing.push('금리 방향(FedWatch)')
  // ⑤ 은행 대출태도(분기)
  if (s) {
    const tight = s.v > 0
    gauges.push({ key: 'sloos', label: '은행 대출 문턱(대출기준 강화 은행 순비율)', value: `${s.v >= 0 ? '+' : ''}${s.v.toFixed(1)}%`, sub: `${s.date.slice(0, 7)} 분기${s.prev != null ? ` · 직전 ${s.prev >= 0 ? '+' : ''}${s.prev.toFixed(1)}%` : ''}`,
      meaning: tight ? '기업 대출 기준을 조인 은행이 푼 은행보다 많습니다 — 돈이 있어도 기업까지 안 흘러갑니다(신용 임펄스 약화).' : '기업 대출 기준을 푼 은행이 더 많습니다 — 유동성이 실물로 흘러가는 쪽.',
      tone: s.v > 20 ? 'bad' : tight ? 'warn' : 'good' })
  } else missing.push('은행 대출태도(FRED DRTSCILM)')

  // 교차 자산 — 사실만(4주 변화). 해석은 한 줄 주의로
  const last4w = (d: { close: number }[]) => d.length > 20 ? pct(d[d.length - 1].close, d[d.length - 21].close) : null
  const cross = [
    { label: '달러(UUP)', chg4wPct: last4w(dxy), note: '강달러는 미국 기업의 해외 이익을 깎고 신흥국에서 돈을 빼갑니다.' },
    { label: '비트코인', chg4wPct: last4w(btc), note: '유동성에 가장 먼저 반응하는 자산으로 통하지만, 선행지표라는 증거는 약합니다 — 참고만.' },
    { label: 'S&P 500(SPY)', chg4wPct: last4w(spx), note: '같은 4주의 주식.' },
  ]

  const meta = season ? SEASON_META[season.usQuad] : null
  const sec = (arr: string[]) => arr.map(x => { const m = sectorMeta(x); return { sector: x, ko: m?.ko ?? x, icon: m?.icon ?? '📦' } })
  const answer = w
    ? `${w.emoji} ${w.label.split(' — ')[0]} — 유동성 ${w.nlRising ? '늘고' : '줄고'} 있고, 신용 스프레드 ${w.hySpread != null ? w.hySpread.toFixed(2) + '%p' : '?'}${c ? `, 수익률곡선 ${c.shape === 'inverted' ? '역전' : c.shape === 'flat' ? '평평' : '정상'}` : ''}${r ? `, 금리는 ${r.rateDirLabel}` : ''}`
    : '유동성 지표를 불러오지 못했습니다'
  return {
    asOf: new Date().toISOString(),
    answer,
    weather: w ? { emoji: w.emoji, label: w.label, advice: w.advice } : null,
    gauges,
    season: season && meta ? { quad: season.usQuad, ko: meta.seasonKo, guide: meta.guide, favored: sec(meta.favored), unfavored: sec(meta.unfavored) } : null,
    cross,
    nextFomc: r?.nextFomc ?? null,
    sources: ['FRED(WALCL·WTREGEN·RRPONTSYD·BAMLH0A0HYM2·T10Y2Y·T10Y3M·DRTSCILM)', 'CME FF 선물(야후)', 'OECD CLI(4계절)', '야후 일봉(달러·BTC·S&P)'],
    missing,
  }
}

export async function getUsLiquidity(base: string, refresh = false): Promise<UsLiquidity> {
  const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const key = US_LIQUIDITY_KEY(kst)
  if (!refresh) { const c = await getCache<UsLiquidity>(key, 6 * 3600_000); if (c) return c }
  const out = await buildUsLiquidity(base)
  if (out.gauges.length >= 3) await setCache(key, out)   // 절반도 못 구했으면 박제하지 않는다
  return out
}
