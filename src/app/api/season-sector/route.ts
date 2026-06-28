// 4계절 × GICS 섹터 실제 수익률 — S&P 섹터 ETF(US 11)·KR 섹터 ETF(10)로 '유리 섹터가 실제로 오르나' 검증
import { NextResponse } from 'next/server'
import { getCurrentSeason } from '@/lib/currentSeason'
import { SEASON_META, type Quadrant } from '@/lib/seasonNavigator'
import { SECTORS } from '@/lib/sectorConfigs'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Fit = 'favored' | 'neutral' | 'unfavored'
interface SectorRet { gics: string; ko: string; ref: string; ret1m: number | null; ret3m: number | null; fit: Fit }
interface MarketBlock {
  quad: Quadrant; seasonKo: string; favored: string[]; unfavored: string[]
  sectors: SectorRet[]
  validation: { favAvg1m: number | null; unfavAvg1m: number | null; favAvg3m: number | null; unfavAvg3m: number | null; spread3m: number | null; verdict: 'aligned' | 'diverge' | 'mixed' }
}
export interface SeasonSectorResult { us: MarketBlock; kr: MarketBlock; asOf: string }

// GICS(Yahoo 표기) → 섹터 ETF 매핑. US=S&P SPDR(공식 섹터지수), KR=대표 섹터 ETF 프록시(완전 GICS 아님)
const US_ETF: { gics: string; ko: string; etf: string }[] = [
  { gics: 'Energy', ko: '에너지', etf: 'XLE' },
  { gics: 'Basic Materials', ko: '소재', etf: 'XLB' },
  { gics: 'Industrials', ko: '산업재', etf: 'XLI' },
  { gics: 'Consumer Cyclical', ko: '자유소비재', etf: 'XLY' },
  { gics: 'Consumer Defensive', ko: '필수소비재', etf: 'XLP' },
  { gics: 'Healthcare', ko: '헬스케어', etf: 'XLV' },
  { gics: 'Financial Services', ko: '금융', etf: 'XLF' },
  { gics: 'Technology', ko: '기술', etf: 'XLK' },
  { gics: 'Communication Services', ko: '커뮤니케이션', etf: 'XLC' },
  { gics: 'Utilities', ko: '유틸리티', etf: 'XLU' },
  { gics: 'Real Estate', ko: '부동산', etf: 'XLRE' },
]
// KR은 GICS 11 ETF가 완비되지 않아 대표 프록시만(유틸리티는 깨끗한 KR ETF 없어 제외 — 정직)
const KR_ETF: { gics: string; ko: string; code: string; proxy: string }[] = [
  { gics: 'Energy', ko: '에너지', code: '117460', proxy: 'KODEX 에너지화학(에너지+화학)' },
  { gics: 'Basic Materials', ko: '소재', code: '117680', proxy: 'KODEX 철강' },
  { gics: 'Industrials', ko: '산업재', code: '117700', proxy: 'KODEX 건설' },
  { gics: 'Consumer Cyclical', ko: '자유소비재', code: '091180', proxy: 'KODEX 자동차' },
  { gics: 'Consumer Defensive', ko: '필수소비재', code: '227560', proxy: 'TIGER 생활소비재' },
  { gics: 'Healthcare', ko: '헬스케어', code: '266420', proxy: 'KODEX 헬스케어' },
  { gics: 'Financial Services', ko: '금융', code: '091170', proxy: 'KODEX 은행' },
  { gics: 'Technology', ko: '기술', code: '091160', proxy: 'KODEX 반도체' },
  { gics: 'Communication Services', ko: '커뮤니케이션', code: '266360', proxy: 'KODEX 미디어&엔터' },
  { gics: 'Real Estate', ko: '부동산', code: '329200', proxy: 'TIGER 리츠부동산인프라' },
]

// 종가 배열 → 최근 N거래일 수익률(%)
function retPct(closes: number[], n: number): number | null {
  if (closes.length <= n) return null
  const last = closes[closes.length - 1], past = closes[closes.length - 1 - n]
  if (!(last > 0) || !(past > 0)) return null
  return Math.round((last / past - 1) * 1000) / 10
}

async function yahooCloses(etf: string): Promise<number[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${etf}?range=6mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const j = await r.json()
      const cl: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      const out = cl.filter((c): c is number => c != null && isFinite(c) && c > 0)
      if (out.length > 40) return out
    } catch { /* 다음 host */ }
  }
  return []
}

async function naverCloses(code: string): Promise<number[]> {
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=70&requestType=0`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    const out: number[] = []
    const re = /data="([^"]+)"/g; let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) { const p = m[1].split('|'); const c = parseFloat(p[4]); if (isFinite(c) && c > 0) out.push(c) }
    return out
  } catch { return [] }
}

function classify(gics: string, favored: string[], unfavored: string[]): Fit {
  return favored.includes(gics) ? 'favored' : unfavored.includes(gics) ? 'unfavored' : 'neutral'
}
function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null); if (!v.length) return null
  return Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10
}
function buildValidation(sectors: SectorRet[]) {
  const fav = sectors.filter(s => s.fit === 'favored'), unf = sectors.filter(s => s.fit === 'unfavored')
  const favAvg3m = avg(fav.map(s => s.ret3m)), unfAvg3m = avg(unf.map(s => s.ret3m))
  const favAvg1m = avg(fav.map(s => s.ret1m)), unfAvg1m = avg(unf.map(s => s.ret1m))
  const spread3m = favAvg3m != null && unfAvg3m != null ? Math.round((favAvg3m - unfAvg3m) * 10) / 10 : null
  const verdict: 'aligned' | 'diverge' | 'mixed' = spread3m == null ? 'mixed' : spread3m >= 1.5 ? 'aligned' : spread3m <= -1.5 ? 'diverge' : 'mixed'
  return { favAvg1m, unfavAvg1m: unfAvg1m, favAvg3m, unfavAvg3m: unfAvg3m, spread3m, verdict }
}

export async function GET(req: Request) {
  const base = new URL(req.url).origin
  const cacheKey = 'season-sector-v2'   // v2: 키명 정정(unfavAvg) + KR 유틸리티 테마지수 추가
  const cached = await getCache<SeasonSectorResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const season = await getCurrentSeason(base)
  const usMeta = SEASON_META[season.usQuad], krMeta = SEASON_META[season.krQuad]

  // US: 11 ETF 병렬
  const usCloses = await Promise.all(US_ETF.map(e => yahooCloses(e.etf)))
  const usSectors: SectorRet[] = US_ETF.map((e, i) => ({
    gics: e.gics, ko: e.ko, ref: e.etf,
    ret1m: retPct(usCloses[i], 21), ret3m: retPct(usCloses[i], 63),
    fit: classify(e.gics, usMeta.favored, usMeta.unfavored),
  })).sort((a, b) => (b.ret3m ?? -999) - (a.ret3m ?? -999))

  // KR: 10 ETF 병렬(네이버)
  const krRaw = await Promise.all(KR_ETF.map(e => naverCloses(e.code)))
  const krSectorsRaw: SectorRet[] = KR_ETF.map((e, i) => ({
    gics: e.gics, ko: e.ko, ref: e.proxy,
    ret1m: retPct(krRaw[i], 21), ret3m: retPct(krRaw[i], 63),
    fit: classify(e.gics, krMeta.favored, krMeta.unfavored),
  }))
  // KR 유틸리티: 깨끗한 ETF 없음 → 🏛️GICS 섹터 차트와 동일한 '테마지수'(config 구성종목 동일가중 수익률)로 대체
  const utilCodes = (SECTORS['utilities']?.stocks ?? []).filter(s => s.market === 'KR').map(s => s.ticker)
  if (utilCodes.length) {
    const utilRaw = await Promise.all(utilCodes.map(c => naverCloses(c)))
    const themeRet = (n: number) => {
      const rs = utilRaw.map(c => retPct(c, n)).filter((x): x is number => x != null)
      return rs.length ? Math.round((rs.reduce((s, x) => s + x, 0) / rs.length) * 10) / 10 : null
    }
    krSectorsRaw.push({
      gics: 'Utilities', ko: '유틸리티', ref: `테마지수(${utilCodes.length}종 동일가중)`,
      ret1m: themeRet(21), ret3m: themeRet(63), fit: classify('Utilities', krMeta.favored, krMeta.unfavored),
    })
  }
  const krSectors = krSectorsRaw.sort((a, b) => (b.ret3m ?? -999) - (a.ret3m ?? -999))

  const result: SeasonSectorResult = {
    us: { quad: season.usQuad, seasonKo: usMeta.seasonKo, favored: usMeta.favored, unfavored: usMeta.unfavored, sectors: usSectors, validation: buildValidation(usSectors) },
    kr: { quad: season.krQuad, seasonKo: krMeta.seasonKo, favored: krMeta.favored, unfavored: krMeta.unfavored, sectors: krSectors, validation: buildValidation(krSectors) },
    asOf: new Date().toISOString(),
  }
  // US 섹터가 충분히 채워졌을 때만 캐시(부분 실패 박제 방지)
  if (usSectors.filter(s => s.ret3m != null).length >= 8) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
