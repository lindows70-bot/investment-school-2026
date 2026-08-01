// 📊 시장 폭(breadth) SSOT — 유니버스 종목의 200/50일선 위 비율·52주 신고/신저·상승 비율 시계열
//    "지수만 보지 말고 속살을 보라" — 소수 대형주가 지수를 끌 때 breadth가 진짜 체력을 드러냄.
//    데이터 전부 기존 캐시 재사용(UNIVERSE_KEY + getTechCandles 일별 캐시 — 검색기 크론이 워밍). 신규 수집 0.
//    ⛔ 점수·선정 미반영(관측 전용 — WHAT/WHEN 분리). 신고/신저는 종가 기준(캐비엇 병기).
import { getCache } from '@/lib/appCache'
import { getTechCandles, type TechCandle } from '@/lib/techChartData'
import { UNIVERSE_KEY } from '@/lib/macroPhaseScreener'

export const BREADTH_KEY = (dateKst: string) => `market-breadth-v1:${dateKst}`   // 일별 캐시(route·크론 헬스 공유 SSOT)

const SERIES_DAYS = 250          // 표시·백분위 창(자기 역사)
const HI_LO_WINDOW = 252         // 52주 신고/신저 창
const DIV_LOOKBACK = 60          // 다이버전스 비교 창(거래일)

export interface BreadthMarket {
  market: 'KR' | 'US'
  asOfDate: string
  n: number                        // 오늘 유효 종목수
  pctAbove200: number
  pctAbove50: number
  pctile: number                   // 현재 pctAbove200의 자기 역사(250일) 백분위
  newHighs: number                 // 오늘 52주 신고가(종가) 경신 종목수
  newLows: number
  advPct: number                   // 오늘 상승 종목 비율
  band: 'hot' | 'healthy' | 'weak' | 'washout'
  divergence: 'top' | 'bottom' | null
  series: { date: string; pct200: number; idx: number }[]   // idx = 지수 rebase 100
}

interface StockDay { above200: boolean; above50: boolean; newHigh: boolean; newLow: boolean; up: boolean }

/** 종목 1개 → 날짜별 판정 맵(최근 SERIES_DAYS+여유) */
function perStock(candles: TechCandle[]): Map<string, StockDay> | null {
  const closes = candles.map(c => c.close)
  const n = closes.length
  if (n < 210) return null                      // MA200 계산 불가(신규상장 등) — 정직 제외
  const out = new Map<string, StockDay>()
  // prefix sum으로 SMA 롤링
  const pre = new Array(n + 1).fill(0)
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + closes[i]
  const start = Math.max(200, n - SERIES_DAYS - 10)
  for (let i = start; i < n; i++) {
    const sma200 = (pre[i + 1] - pre[i - 199]) / 200
    const sma50 = (pre[i + 1] - pre[i - 49]) / 50
    const winStart = Math.max(0, i - HI_LO_WINDOW + 1)
    let hi = -Infinity, lo = Infinity
    for (let j = winStart; j < i; j++) { if (closes[j] > hi) hi = closes[j]; if (closes[j] < lo) lo = closes[j] }
    out.set(candles[i].date, {
      above200: closes[i] > sma200,
      above50: closes[i] > sma50,
      newHigh: isFinite(hi) && closes[i] >= hi,
      newLow: isFinite(lo) && closes[i] <= lo,
      up: i > 0 && closes[i] > closes[i - 1],
    })
  }
  return out
}

const pct1 = (v: number) => Math.round(v * 1000) / 10

function aggregate(market: 'KR' | 'US', indexCandles: TechCandle[], stockMaps: Map<string, StockDay>[]): BreadthMarket | null {
  const calendar = indexCandles.slice(-SERIES_DAYS)      // 지수 캘린더 = 기준일
  if (calendar.length < 100 || !stockMaps.length) return null

  const series: { date: string; pct200: number; idx: number }[] = []
  const idxBase = calendar[0].close
  let today: { n: number; a200: number; a50: number; nh: number; nl: number; up: number } | null = null
  for (const c of calendar) {
    let n = 0, a200 = 0, a50 = 0, nh = 0, nl = 0, up = 0
    for (const m of stockMaps) {
      const d = m.get(c.date)
      if (!d) continue
      n++
      if (d.above200) a200++
      if (d.above50) a50++
      if (d.newHigh) nh++
      if (d.newLow) nl++
      if (d.up) up++
    }
    if (n < stockMaps.length * 0.3) continue             // 휴장 어긋남 등 표본 빈약한 날 제외
    series.push({ date: c.date, pct200: pct1(a200 / n), idx: Math.round((c.close / idxBase) * 1000) / 10 })
    today = { n, a200, a50, nh, nl, up }
  }
  if (!series.length || !today) return null

  const cur = series[series.length - 1]
  const pctile = pct1(series.filter(s => s.pct200 <= cur.pct200).length / series.length)
  const band: BreadthMarket['band'] = cur.pct200 > 75 ? 'hot' : cur.pct200 >= 45 ? 'healthy' : cur.pct200 >= 25 ? 'weak' : 'washout'

  // 다이버전스: 지수 고점권/저점권 vs breadth 방향(60거래일 전 대비)
  let divergence: BreadthMarket['divergence'] = null
  const idxCloses = calendar.map(c => c.close)
  const last = idxCloses[idxCloses.length - 1]
  const win = idxCloses.slice(-DIV_LOOKBACK)
  const winHi = Math.max(...win), winLo = Math.min(...win)
  const ago = series[Math.max(0, series.length - 1 - DIV_LOOKBACK)]
  if (ago) {
    if (last >= winHi * 0.97 && cur.pct200 <= ago.pct200 - 5) divergence = 'top'       // 지수 고점권 + 폭 축소 = 상투형
    else if (last <= winLo * 1.03 && cur.pct200 >= ago.pct200 + 5) divergence = 'bottom'
  }

  return {
    market, asOfDate: cur.date, n: today.n,
    pctAbove200: cur.pct200, pctAbove50: pct1(today.a50 / today.n), pctile,
    newHighs: today.nh, newLows: today.nl, advPct: pct1(today.up / today.n),
    band, divergence, series,
  }
}

export interface BreadthResult {
  asOf: string
  us: BreadthMarket | null
  kr: BreadthMarket | null
  scanned: number
  okCount: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function computeMarketBreadth(): Promise<BreadthResult | null> {
  const uni = await getCache<any[]>(UNIVERSE_KEY, 14 * 86_400_000)
  if (!Array.isArray(uni) || uni.length < 100) return null   // 유니버스 콜드 — 계산 불가(박제 금지)

  const stocks = uni
    .filter(s => (s?.market === 'KR' || s?.market === 'US') && s?.ticker)
    .map(s => ({ ticker: String(s.ticker), market: s.market as 'KR' | 'US' }))

  const maps: Record<'KR' | 'US', Map<string, StockDay>[]> = { KR: [], US: [] }
  let okCount = 0
  const queue = [...stocks]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (;;) {
      const s = queue.shift(); if (!s) break
      try {
        const candles = await getTechCandles(s.ticker, s.market, 'D')
        const m = perStock(candles)
        if (m) { maps[s.market].push(m); okCount++ }
      } catch { /* 종목 실패 — 정직 제외 */ }
    }
  }))

  const [idxUs, idxKr] = await Promise.all([
    getTechCandles('^GSPC', 'US', 'D').catch(() => [] as TechCandle[]),
    getTechCandles('^KS11', 'US', 'D').catch(() => [] as TechCandle[]),   // 지수는 Yahoo 경로(US)로 해석
  ])

  return {
    asOf: new Date().toISOString(),
    us: aggregate('US', idxUs, maps.US),
    kr: aggregate('KR', idxKr, maps.KR),
    scanned: stocks.length,
    okCount,
  }
}
