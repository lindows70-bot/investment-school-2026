// 🪙 코인 랩(Coin Lab) — 비트코인 독립 분석 엔진(주식 PER/EPS 엔진과 완전 분리)
// 4축: 사이클(반감기·메이어멀티플) · 심리(공포탐욕·도미넌스) · 온체인(해시레이트) · 유동성(M2) + 김치프리미엄
// 전부 무료·무인증 소스(CoinGecko·alternative.me·mempool.space·업비트·FRED) · 1h 캐시 · 추정치 금지(없으면 null)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const HALVING = '2024-04-20'   // 4차 반감기(블록 840,000)
const CYCLE_DAYS = 1461        // 4년 ≈ 다음 반감기까지
const STABLES = new Set(['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'USDS', 'PYUSD'])

export interface CoinLabResult {
  price: { usd: number | null; krw: number | null; ma200: number | null; mayer: number | null; kimchiPct: number | null }
  cycle: { halving: string; daysSince: number; cyclePct: number; phase: string; phaseDesc: string }
  sentiment: { fng: number | null; fngClass: string; fngYesterday: number | null; btcDom: number | null; ethDom: number | null; altHint: string }
  market: { totalMcapUsdT: number | null; stablecoinPct: number | null; top: { symbol: string; name: string; price: number; ch24: number | null; ch7: number | null; mcapB: number }[] }
  network: { hashrateEH: number | null; difficultyT: number | null; trend: 'up' | 'down' | 'flat'; spark: number[] }
  macro: { points: { date: string; m2: number | null; btc: number | null }[]; note: string }   // 100 기준 정규화 오버레이
  longChart: { points: { date: string; price: number }[]; halvings: { date: string; label: string }[] }   // 10년 가격 + 반감기 마커
  supply: { circulatingM: number; maxM: number; pct: number } | null   // 유통량/최대발행(희석 리스크)
  correlation: { labels: string[]; matrix: (number | null)[][]; window: string; note: string; series: { date: string; btc: number; nasdaq: number; gold: number }[] } | null   // BTC vs 증시·금 상관계수 + 정규화 시계열
  prescription: { regime: string; tone: 'accumulate' | 'caution' | 'neutral'; text: string }
  guardrailNote: string
  asOf: string
}

// 비트코인 반감기(채굴보상 절반 — 약 4년/21만 블록 주기). 차트 세로선 마커용
const HALVINGS: { date: string; label: string }[] = [
  { date: '2012-11-28', label: '1차 반감기 (50→25 BTC)' },
  { date: '2016-07-09', label: '2차 반감기 (25→12.5 BTC)' },
  { date: '2020-05-11', label: '3차 반감기 (12.5→6.25 BTC)' },
  { date: '2024-04-20', label: '4차 반감기 (6.25→3.125 BTC)' },
]
// Yahoo Finance BTC-USD 10년 주봉(무료) — CoinGecko 무료는 365일 초과 401이라 장기 차트는 Yahoo 사용
async function btcLongPrices(): Promise<{ date: string; price: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/BTC-USD?range=10y&interval=1wk`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
      if (!r.ok) continue
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []
      const cl: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const out: { date: string; price: number }[] = []
      for (let i = 0; i < ts.length; i += 2) {   // 격주 다운샘플(~260p)
        const c = cl[i]
        if (c != null && isFinite(c) && c > 0) out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), price: Math.round(c) })
      }
      if (out.length > 20) return out
    } catch { /* 다음 host */ }
  }
  return []
}

// CoinGecko 무료 API — 브라우저형 UA 필수(기본 fetch UA는 종종 차단), 429 시 1회 재시도. 절대 동시 버스트 금지
const CG_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
async function cg<T = unknown>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3${path}`, { signal: AbortSignal.timeout(12_000), headers: { accept: 'application/json', 'User-Agent': CG_UA } })
      if (r.ok) return await r.json() as T
      if (r.status !== 429) return null
    } catch { /* 재시도 */ }
    await new Promise(res => setTimeout(res, 1500))   // 429·실패 후 백오프
  }
  return null
}
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

// Yahoo 일별 종가(상관관계용) — 6개월
async function yahooDaily(symbol: string): Promise<Map<string, number>> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
      if (!r.ok) continue
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []
      const cl: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const m = new Map<string, number>()
      for (let i = 0; i < ts.length; i++) { const c = cl[i]; if (c != null && isFinite(c) && c > 0) m.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), c) }
      if (m.size > 30) return m
    } catch { /* 다음 host */ }
  }
  return new Map()
}
// 피어슨 상관계수(일별 수익률 기준)
function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length); if (n < 10) return null
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n
  let cov = 0, va = 0, vb = 0
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db }
  const d = Math.sqrt(va * vb); return d > 0 ? Math.round((cov / d) * 100) / 100 : null
}
// BTC·나스닥(QQQ)·S&P500(SPY)·금(GLD) 6개월 일별 수익률 상관 매트릭스
async function buildCorrelation(): Promise<CoinLabResult['correlation']> {
  const syms: [string, string][] = [['비트코인', 'BTC-USD'], ['나스닥', 'QQQ'], ['S&P500', 'SPY'], ['금', 'GLD']]
  const maps = await Promise.all(syms.map(([, s]) => yahooDaily(s)))
  // 공통 거래일(증시 기준 — 모든 자산에 종가 존재)
  const common = Array.from(maps[0].keys()).filter(d => maps.every(m => m.has(d))).sort()
  if (common.length < 20) return null
  // 일별 수익률
  const rets = maps.map(m => common.slice(1).map((d, i) => m.get(d)! / m.get(common[i])! - 1))
  const matrix = rets.map(a => rets.map(b => pearson(a, b)))
  // 정규화 시계열(100 기준) — 오버레이 비교 차트용. 격일 다운샘플
  const norm = (mi: number) => { const base = maps[mi].get(common[0])!; return (d: string) => Math.round((maps[mi].get(d)! / base) * 1000) / 10 }
  const nBtc = norm(0), nNas = norm(1), nGold = norm(3)
  const series = common.filter((_, i) => i % 2 === 0 || i === common.length - 1).map(d => ({ date: d, btc: nBtc(d), nasdaq: nNas(d), gold: nGold(d) }))
  return {
    labels: syms.map(s => s[0]), matrix,
    window: `${common[0]} ~ ${common[common.length - 1]} (일별)`,
    note: '1.0에 가까울수록 같이 움직임. 비트코인이 나스닥(기술주)과 상관이 높고 금과는 낮다면, 코인은 &lsquo;디지털 금&rsquo;보다 &lsquo;고위험 기술주&rsquo;처럼 유동성·위험선호에 반응한다는 뜻입니다.',
    series,
  }
}

export async function GET(req: Request) {
  const cacheKey = 'coin-lab-v9'   // v9: 상관관계 + 정규화 오버레이 비교 차트(BTC vs 나스닥/금)
  const cached = await getCache<CoinLabResult>(cacheKey, 3600_000)   // 1h
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const FRED = process.env.FRED_API_KEY

  // 환율(김치프리미엄)
  let usdKrw = 1350
  try { const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) }); if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate } } catch { /* 폴백 */ }

  // ── CoinGecko 외 소스: 병렬(서로 다른 호스트라 충돌 없음) ──────────
  const [fngR, hashR, upbitR, m2R, longR, corrR] = await Promise.allSettled([
    fetch('https://api.alternative.me/fng/?limit=2', { signal: AbortSignal.timeout(10_000) }).then(r => r.json()),
    fetch('https://mempool.space/api/v1/mining/hashrate/3m', { signal: AbortSignal.timeout(12_000) }).then(r => r.json()),
    fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC', { signal: AbortSignal.timeout(10_000) }).then(r => r.json()),
    FRED ? fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=M2SL&api_key=${FRED}&file_type=json&sort_order=desc&limit=37`, { signal: AbortSignal.timeout(10_000) }).then(r => r.json()) : Promise.resolve(null),
    btcLongPrices(),
    buildCorrelation(),
  ])
  const val = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)
  const fng = val(fngR) as { data?: { value: string; value_classification: string }[] } | null
  const hash = val(hashR) as { currentHashrate?: number; currentDifficulty?: number; hashrates?: { avgHashrate: number }[] } | null
  const upbit = val(upbitR) as { trade_price: number }[] | null
  const m2j = val(m2R) as { observations?: { date: string; value: string }[] } | null
  const longPts = (val(longR) as { date: string; price: number }[] | null) ?? []
  const correlation = val(corrR) as CoinLabResult['correlation']

  // ── CoinGecko: 반드시 순차(무료 API 버스트 429 회피) ──────────────
  const global = await cg<{ data?: Record<string, unknown> }>('/global')
  const markets = await cg<Record<string, unknown>[]>('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&page=1&price_change_percentage=24h,7d')
  const chart = await cg<{ prices?: [number, number][] }>('/coins/bitcoin/market_chart?vs_currency=usd&days=300&interval=daily')

  // ── 가격·메이어멀티플·김치프리미엄 ──────────────────────────────
  const btcKrw = num(upbit?.[0]?.trade_price)
  const cgBtcUsd = num((markets?.find(m => m.symbol === 'btc') as { current_price?: number })?.current_price)
  // CoinGecko 실패 시 업비트÷환율로 폴백(헤드라인 가격은 항상 표시)
  const btcUsd = cgBtcUsd ?? (btcKrw != null ? Math.round(btcKrw / usdKrw) : null)
  const closes = (chart?.prices ?? []).map(p => p[1]).filter(v => isFinite(v))
  const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null
  const mayer = btcUsd != null && ma200 ? Math.round((btcUsd / ma200) * 100) / 100 : null
  const kimchiPct = btcUsd != null && btcKrw != null ? Math.round(((btcKrw / (btcUsd * usdKrw)) - 1) * 1000) / 10 : null

  // ── 반감기 사이클 ──────────────────────────────────────────────
  const daysSince = Math.floor((Date.now() - new Date(HALVING).getTime()) / 86400_000)
  const cyclePct = Math.max(0, Math.min(100, Math.round((daysSince / CYCLE_DAYS) * 1000) / 10))
  const [phase, phaseDesc] =
    daysSince < 365 ? ['반감기 직후 (축적기)', '공급 충격이 가격에 반영되기 시작하는 초기. 역사적으로 본격 상승 전 단계.']
    : daysSince < 550 ? ['상승 가속 (확산기)', '과거 사이클상 강세가 가속되던 구간 — 다만 과거가 미래를 보장하지 않음.']
    : daysSince < 760 ? ['고점 경계 (과열 위험)', '과거 3사이클 모두 반감기 후 약 12~18개월에 고점 형성. 탐욕·과열 경계 구간.']
    : daysSince < 1100 ? ['조정·하락 (인내기)', '고점 이후 깊은 조정이 잦았던 구간. 변동성 각오·분할 관점.']
    : ['바닥 다지기 (다음 사이클 전)', '다음 반감기 전 저점을 다지던 구간. 역사적 축적 기회였으나 확신 금물.']

  // ── 심리·도미넌스 ──────────────────────────────────────────────
  const fngV = fng?.data?.[0] ? parseInt(fng.data[0].value) : null
  const fngClass = fng?.data?.[0]?.value_classification ?? '—'
  const fngY = fng?.data?.[1] ? parseInt(fng.data[1].value) : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gd = (global as any)?.data
  const btcDom = num(gd?.market_cap_percentage?.btc) != null ? Math.round(gd.market_cap_percentage.btc * 10) / 10 : null
  const ethDom = num(gd?.market_cap_percentage?.eth) != null ? Math.round(gd.market_cap_percentage.eth * 10) / 10 : null
  const altHint = btcDom != null ? (btcDom >= 58 ? '비트코인 우위 — 알트코인은 상대적 약세(BTC 도미넌스 高)' : btcDom <= 45 ? '알트시즌 성격 — 자금이 알트로 분산(BTC 도미넌스 低)' : '중립 — BTC·알트 혼조') : '—'

  // ── 시장 개요 ──────────────────────────────────────────────────
  const totalMcapUsd = num(gd?.total_market_cap?.usd)
  const totalMcapUsdT = totalMcapUsd != null ? Math.round(totalMcapUsd / 1e12 * 100) / 100 : null
  const top = (markets ?? []).slice(0, 8).map(m => ({
    symbol: String(m.symbol).toUpperCase(), name: String(m.name),
    price: num(m.current_price) ?? 0, ch24: num(m.price_change_percentage_24h_in_currency ?? m.price_change_percentage_24h),
    ch7: num((m as { price_change_percentage_7d_in_currency?: number }).price_change_percentage_7d_in_currency),
    mcapB: Math.round((num(m.market_cap) ?? 0) / 1e9 * 10) / 10,
  }))
  const stableMcap = (markets ?? []).filter(m => STABLES.has(String(m.symbol).toUpperCase())).reduce((s, m) => s + (num(m.market_cap) ?? 0), 0)
  const stablecoinPct = totalMcapUsd && stableMcap > 0 ? Math.round((stableMcap / totalMcapUsd) * 1000) / 10 : null
  // 비트코인 유통량/최대발행 — 희석(언락) 리스크
  const btcM = markets?.find(m => String(m.symbol).toLowerCase() === 'btc') as { circulating_supply?: number; max_supply?: number } | undefined
  const btcCirc = num(btcM?.circulating_supply), btcMax = num(btcM?.max_supply)
  const supply = btcCirc != null && btcMax != null ? { circulatingM: Math.round(btcCirc / 1e6 * 10) / 10, maxM: Math.round(btcMax / 1e6 * 10) / 10, pct: Math.round((btcCirc / btcMax) * 1000) / 10 } : null

  // ── 네트워크(해시레이트) ────────────────────────────────────────
  const hashrateEH = num(hash?.currentHashrate) != null ? Math.round(hash!.currentHashrate! / 1e18) : null
  const difficultyT = num(hash?.currentDifficulty) != null ? Math.round(hash!.currentDifficulty! / 1e12) : null
  const hseries = (hash?.hashrates ?? []).map(h => h.avgHashrate / 1e18).filter(v => isFinite(v))
  const step = Math.max(1, Math.ceil(hseries.length / 30))
  const spark = hseries.filter((_, i) => i % step === 0 || i === hseries.length - 1).map(v => Math.round(v))
  const trend: 'up' | 'down' | 'flat' = hseries.length >= 2 ? (hseries[hseries.length - 1] > hseries[0] * 1.02 ? 'up' : hseries[hseries.length - 1] < hseries[0] * 0.98 ? 'down' : 'flat') : 'flat'

  // ── 거시 유동성(M2) vs BTC 오버레이(월별, 100 정규화) — 약 3년(M2는 연 ~3% 성장이라 단기론 평평) ──
  const m2obs = (m2j?.observations ?? []).map(o => ({ date: o.date.slice(0, 7), v: parseFloat(o.value) })).filter(o => isFinite(o.v)).reverse()
  // BTC 월별 종가: Yahoo 10년 주봉(longPts)을 월말 값으로 다운샘플 → M2 37개월 전 구간과 겹침
  const btcMonthly = new Map<string, number>()
  for (const p of longPts) btcMonthly.set(p.date.slice(0, 7), p.price)   // 같은 달은 마지막값으로 덮어씀
  // M2 전체(약 37개월) 중 BTC가 있는 달. 첫 공통월을 100 기준으로 양쪽 정규화 → 3년이라 M2 상승·BTC 변동이 모두 보임
  // 좌/우 별도 축으로 각자 스케일 — 원본값 제공(M2 = FRED M2SL $10억, BTC = 가격 $). 정규화 단일축은 BTC 스윙에 M2가 묻힘
  const common = m2obs.filter(o => btcMonthly.has(o.date))
  const macroPoints = common.map(o => ({
    date: o.date,
    m2: Math.round(o.v),                          // 미국 M2 통화량($10억 단위, ≈21000 = $21T)
    btc: Math.round(btcMonthly.get(o.date)!),     // 비트코인 가격($)
  }))
  const macroNote = '좌축 = 미국 M2 통화량 · 우축 = 비트코인 가격(각자 스케일). M2는 완만히 우상향(연 ~3%)하고, 비트코인은 그 유동성 위에서 훨씬 크게 출렁입니다 — 돈이 풀리면 먼저 오르고 죄면 먼저 빠지는 &lsquo;고베타 유동성 자산&rsquo;.'

  // ── 처방(국면×리스크 사이징 — 매수 지시 아님) ──────────────────
  let tone: 'accumulate' | 'caution' | 'neutral' = 'neutral'
  let regime = '중립'
  if (fngV != null && fngV <= 25 && mayer != null && mayer < 1.2) { tone = 'accumulate'; regime = '공포·저평가 구간' }
  else if ((fngV != null && fngV >= 75) || (mayer != null && mayer > 2.4)) { tone = 'caution'; regime = '탐욕·과열 구간' }
  const text =
    tone === 'accumulate' ? `${regime} — 공포탐욕 ${fngV}(${fngClass}), 메이어 ${mayer}로 역사적 저평가 영역입니다. "남이 두려워할 때"가 분할 축적에 유리했던 구간이나, 추가 하락도 흔하니 한 번에 몰빵 금지·분할로.`
    : tone === 'caution' ? `${regime} — 공포탐욕 ${fngV ?? '—'}(${fngClass})${mayer != null && mayer > 2.4 ? `, 메이어 ${mayer}(>2.4 과열선)` : ''}. 대중이 환호할 때가 가장 위험합니다. 신규 진입은 자제하고 일부 차익·관망을 고려하세요.`
    : `중립 구간 — 공포탐욕 ${fngV ?? '—'}(${fngClass}), 메이어 ${mayer ?? '—'}. 뚜렷한 극단 신호는 없습니다. 정해둔 비중 안에서 분할로만 접근하세요.`

  const guardrailNote = '⚠️ 비트코인은 이자·배당·이익이 없는 자산입니다. 포트폴리오의 로켓 연료로 소량만 — 권장 상한 5%, 절대 잃어도 되는 돈만. 변동성 -80% 드로다운은 코인 역사에서 정상 범위입니다.'

  const result: CoinLabResult = {
    price: { usd: btcUsd, krw: btcKrw, ma200: ma200 ? Math.round(ma200) : null, mayer, kimchiPct },
    cycle: { halving: HALVING, daysSince, cyclePct, phase, phaseDesc },
    sentiment: { fng: fngV, fngClass, fngYesterday: fngY, btcDom, ethDom, altHint },
    market: { totalMcapUsdT, stablecoinPct, top },
    network: { hashrateEH, difficultyT, trend, spark },
    macro: { points: macroPoints, note: macroNote },
    longChart: { points: longPts, halvings: longPts.length ? HALVINGS.filter(h => h.date >= longPts[0].date) : HALVINGS },
    supply,
    correlation,
    prescription: { regime, tone, text },
    guardrailNote,
    asOf: new Date().toISOString(),
  }
  // CoinGecko 핵심(가격+도미넌스)까지 살아야 캐시 — 부분 실패(429 등) 결과를 1h 박제하지 않음
  if (btcUsd != null && btcDom != null) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
