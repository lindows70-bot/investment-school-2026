// 🌪️ 국가별 시장 변동성 SSOT — 지수 실현변동성·자국 역사 백분위·급변동일(사이드카/서킷브레이커 프록시)
//   ⚠️ 절대 변동성만 보면 한국은 늘 빨간불(구조적으로 미국보다 큼) → '자국 5년 역사 백분위'가 공정한 척도.
//   ⛔ 추천 점수·선정에 절대 미반영 — 리스크·맥락 레이어(타점 신호등·라쉬케와 동일 취급). 배지·경고 전용.
//   실측(2026-07): VKOSPI·닛케이VI·VSTOXX는 야후 미제공 → 실현변동성이 전 시장을 공평하게 재는 유일한 무료 척도.

import { getCache, setCache } from '@/lib/appCache'
import { volVerdict, type VolOrigin, type CountryVolItem, type CountryVolResult } from '@/lib/countryVolShared'

// ⚠️ 타입·상수·판정은 countryVolShared.ts(클라 공용)에 있음 — 클라 컴포넌트는 그쪽에서 import할 것(이 파일은 Node 전용 의존을 끌어옴)
export type { VolVerdict, VolOrigin, CountryVolItem, CountryVolResult } from '@/lib/countryVolShared'

// 대표 지수 — origin이 지정된 것이 해당 국가 종목의 배지 기준
//   중화권은 상장지로 분기: 홍콩 상장(.HK)=항셍(CN) / 본토 A주(.SS·.SZ)=상해종합(CN_A). 실제 거래되는 시장의 변동성을 적용
const INDICES: { key: string; origin: VolOrigin | null; label: string; flag: string; symbol: string }[] = [
  { key: 'sp500',   origin: 'US', label: 'S&P 500',      flag: '🇺🇸', symbol: '^GSPC' },
  { key: 'nasdaq',  origin: null, label: '나스닥',        flag: '🇺🇸', symbol: '^IXIC' },
  { key: 'kospi',   origin: 'KR', label: '코스피',        flag: '🇰🇷', symbol: '^KS11' },
  { key: 'kosdaq',  origin: null, label: '코스닥',        flag: '🇰🇷', symbol: '^KQ11' },
  { key: 'nikkei',  origin: 'JP', label: '닛케이 225',    flag: '🇯🇵', symbol: '^N225' },
  { key: 'hsi',     origin: 'CN', label: '항셍(홍콩)',    flag: '🇭🇰', symbol: '^HSI' },
  { key: 'sse',     origin: 'CN_A', label: '상해 종합',    flag: '🇨🇳', symbol: '000001.SS' },   // 본토 A주(.SS/.SZ) 종목의 대표 지수(volForStock이 티커로 분기)
  { key: 'stoxx',   origin: 'EU', label: '유로스톡스 50', flag: '🇪🇺', symbol: '^STOXX50E' },
  { key: 'dax',     origin: null, label: 'DAX(독일)',     flag: '🇩🇪', symbol: '^GDAXI' },
]

// 내재변동성(VIX류) — 실측 결과 미국·나스닥·중국ETF만 무료 제공(VKOSPI·닛케이VI·VSTOXX 없음)
const IMPLIED: { symbol: string; label: string }[] = [
  { symbol: '^VIX', label: '🇺🇸 VIX (S&P500 내재변동성)' },
  { symbol: '^VXN', label: '🇺🇸 VXN (나스닥100)' },
  { symbol: '^VXFXI', label: '🇨🇳 VXFXI (중국 대형주 ETF)' },
]

const stdev = (a: number[]) => {
  const m = a.reduce((s, x) => s + x, 0) / a.length
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}

/** 지수 하나의 변동성 프로필 — 5년 일봉으로 실현변동성·백분위·급변동일 산출(전부 결정론 산수) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function profile(yf: any, m: typeof INDICES[number]): Promise<CountryVolItem | null> {
  try {
    const r = await yf.chart(m.symbol, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const px: number[] = (r?.quotes ?? []).map((q: any) => q?.close).filter((c: unknown): c is number => typeof c === 'number' && isFinite(c))
    if (px.length < 300) return null   // 이력 부족 시 정직 생략
    const ret = px.slice(1).map((c, i) => (c - px[i]) / px[i])
    const annV = (w: number) => stdev(ret.slice(-w)) * Math.sqrt(252) * 100
    const vol20 = annV(20), vol60 = annV(60)
    // 5년 롤링 20일 변동성 분포 → 현재 값의 백분위(자국 기준 — 국가 간 구조적 변동성 차이 보정)
    const hist: number[] = []
    for (let i = 20; i <= ret.length; i++) hist.push(stdev(ret.slice(i - 20, i)) * Math.sqrt(252) * 100)
    const pctile = Math.round(hist.filter(v => v <= vol20).length / hist.length * 100)
    const hi52 = Math.max(...px.slice(-252))
    const drawdown = (px[px.length - 1] / hi52 - 1) * 100
    const last20 = ret.slice(-20)
    const big2 = last20.filter(x => Math.abs(x) >= 0.02).length
    const big3 = last20.filter(x => Math.abs(x) >= 0.03).length
    const ret20 = (px[px.length - 1] / px[px.length - 21] - 1) * 100
    const r1 = (n: number) => Math.round(n * 10) / 10
    return {
      key: m.key, origin: m.origin, label: m.label, flag: m.flag, symbol: m.symbol,
      vol20: r1(vol20), vol60: r1(vol60), pctile, drawdown: r1(drawdown), big2, big3, ret20: r1(ret20),
      verdict: volVerdict(pctile, big3, vol20),
    }
  } catch { return null }
}

/** 전 지수 변동성 계산(6h 캐시). 절반 미만 성공 시 캐시 박제 금지(부분 실패 방어) */
export async function computeCountryVol(): Promise<CountryVolResult | null> {
  const key = `country-vol-v2:${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`   // v2: 상해종합 origin CN_A(본토 A주 분기)
  const cached = await getCache<CountryVolResult>(key, 6 * 3600_000)
  if (cached) return cached

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: YF } = await import('yahoo-finance2') as any
  const yf = new YF({ suppressNotices: ['yahooSurvey'] })

  const items: CountryVolItem[] = []
  for (let i = 0; i < INDICES.length; i += 3) {
    const batch = INDICES.slice(i, i + 3)
    const res = await Promise.all(batch.map(m => profile(yf, m)))
    for (const r of res) if (r) items.push(r)
  }
  if (items.length < INDICES.length / 2) return null   // 과반 실패 → 캐시 박제 금지

  const implied: CountryVolResult['implied'] = []
  for (const iv of IMPLIED) {
    try {
      const q = await yf.quote(iv.symbol)
      const v = q?.regularMarketPrice
      if (typeof v === 'number' && isFinite(v)) implied.push({ symbol: iv.symbol, label: iv.label, value: Math.round(v * 100) / 100 })
    } catch { /* 개별 실패 무시 */ }
  }

  const byOrigin: Record<string, CountryVolItem> = {}
  for (const it of items) if (it.origin) byOrigin[it.origin] = it

  const out: CountryVolResult = { items, byOrigin, implied, asOf: new Date().toISOString() }
  await setCache(key, out)
  return out
}
