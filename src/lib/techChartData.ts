// 기술차트용 장기 OHLCV 수집 SSOT — tech-chart 라우트와 entryTiming(타점 신호등)이 동일 캐시 공유(제2원칙)
import { getCache, setCache } from '@/lib/appCache'

export interface TechCandle { date: string; open: number; high: number; low: number; close: number; volume: number }
export type TechTf = 'D' | 'W' | 'M'

/** KR — 네이버 fchart OHLCV (일 480 / 주 320 / 월 240) */
async function krCandles(code: string, tf: TechTf): Promise<TechCandle[]> {
  const m = { D: { timeframe: 'day', count: 480 }, W: { timeframe: 'week', count: 320 }, M: { timeframe: 'month', count: 240 } }[tf]
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=${m.timeframe}&count=${m.count}&requestType=0`,
      { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const xml = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
    const out: TechCandle[] = []
    for (const mm of Array.from(xml.matchAll(/data="([^"]+)"/g))) {
      const p = mm[1].split('|')
      if (p.length < 6) continue
      const ds = p[0], close = parseFloat(p[4])
      if (!isFinite(close) || close <= 0) continue
      const open = parseFloat(p[1]), high = parseFloat(p[2]), low = parseFloat(p[3]), volume = parseFloat(p[5])
      out.push({
        date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`,
        open: isFinite(open) && open > 0 ? open : close,
        high: isFinite(high) && high > 0 ? high : close,
        low: isFinite(low) && low > 0 ? low : close,
        close, volume: isFinite(volume) ? volume : 0,
      })
    }
    return out
  } catch { return [] }
}

/** US — Yahoo v8 chart OHLCV (일=2y / 주=7y / 월=20y) */
async function usCandles(ticker: string, tf: TechTf): Promise<TechCandle[]> {
  const m = { D: { range: '2y', interval: '1d' }, W: { range: '7y', interval: '1wk' }, M: { range: '20y', interval: '1mo' } }[tf]
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${m.range}&interval=${m.interval}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? []
    const q = res?.indicators?.quote?.[0]
    if (!ts.length || !q) return []
    const out: TechCandle[] = []
    for (let i = 0; i < ts.length; i++) {
      const c = q.close?.[i]
      if (typeof c !== 'number' || !isFinite(c) || c <= 0) continue
      const d = new Date(ts[i] * 1000)
      out.push({
        date: d.toISOString().slice(0, 10),
        open: typeof q.open?.[i] === 'number' && q.open[i] > 0 ? q.open[i] : c,
        high: typeof q.high?.[i] === 'number' && q.high[i] > 0 ? q.high[i] : c,
        low: typeof q.low?.[i] === 'number' && q.low[i] > 0 ? q.low[i] : c,
        close: c, volume: typeof q.volume?.[i] === 'number' ? q.volume[i] : 0,
      })
    }
    // Yahoo 주/월봉 '진행중 현재봉' 중복 트레일링 바 제거(sectorEngine 교훈)
    if (out.length >= 2 && tf !== 'D' && out[out.length - 1].close === out[out.length - 2].close
      && out[out.length - 1].open === out[out.length - 2].open) out.pop()
    return out
  } catch { return [] }
}

/** KR 종목명 해석 — 네이버 모바일 basic API(stockName). 7일 캐시(이름은 거의 안 바뀜) */
export async function getKrName(code: string): Promise<string | null> {
  const key = `kr-name-v1:${code}`
  const cached = await getCache<{ name: string }>(key, 7 * 24 * 3600_000)
  if (cached?.name) return cached.name
  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return null
    const j = await r.json()
    const name: string | null = j?.stockName ?? j?.itemName ?? null
    if (name) { await setCache(key, { name }); return name }
    return null
  } catch { return null }
}

/** 🕯️ 진행 중인 마지막 봉을 버린다 — 네이버·야후 일봉은 둘 다 **오늘 진행 중인 봉**을 마지막 행으로 준다.
 *  그 봉을 종가로 쓰면 판정이 장중가로 이뤄진다(2026-09-11 실측: 이수페타시스 09-02 진입 기록 115,200 vs 종가 112,000 ·
 *  롯데케미칼 09-04 '급등' 추천이 종가 −1.6%·거래량 1.45배 — 조건 미달). 백테스트는 완성 종가로 쟀으므로 잣대를 맞춘다.
 *  session = 그 봉의 시장. 봉 날짜는 네이버=KST 날짜, 야후=세션 시작 UTC 날짜(미국 ET 날짜·^KS11 은 KST 날짜)라 그대로 쓴다.
 *  ⏰ 완성 시각 — KR 은 정규장 15:30 이 아니라 **NXT 애프터마켓 20:00 KST** (2026-09-17 실측: 쎄트렉아이 네이버 일봉 종가가
 *     19:48 79,100 → 19:50 79,000 으로 시간외에 계속 바뀌었고 폴링 API 는 marketSessionType=afterMarket 를 줬다.
 *     19:42 에 만든 레이더가 79,100 을 진입가로 적었다). US 는 16:00 ET — EST 기준 21:00 UTC 로 잡아 EDT 땐 1시간 늦게 본다.
 *     둘 다 +35분 여유 = getTechCandles 캐시 TTL(30분) + 5분 — 마감 직전에 받아 캐시된 장중 봉이 마감 직후 '완성'으로 통과하지 않게. */
export function dropIncompleteBar<T extends { date: string }>(D: T[], session: 'KR' | 'US', now = Date.now()): T[] {
  if (!D.length) return D
  const last = String(D[D.length - 1].date).slice(0, 10)
  const closeUtc = Date.parse(session === 'KR' ? `${last}T11:35:00Z` : `${last}T21:35:00Z`)
  return isFinite(closeUtc) && now < closeUtc ? D.slice(0, -1) : D
}

/** 캐시 공유 getter — tech-chart 라우트와 동일 키(tech-chart-v2) */
export async function getTechCandles(ticker: string, market: 'KR' | 'US', tf: TechTf = 'D'): Promise<TechCandle[]> {
  // 키에 날짜를 넣지 않는다 — v1 은 날짜별로 새 행을 쌓아 82일 만에 4.7만 행·DB 900MB+ 로 무료 한도(500MB)를 넘겼다(2026-09-26 실측).
  // 신선도는 30분 TTL(updated_at)이 판정하므로 종목·시장·봉 단위 한 행을 덮어쓰면 충분하다.
  const cacheKey = `tech-chart-v2:${ticker.toUpperCase()}:${market}:${tf}`
  const cached = await getCache<{ candles: TechCandle[] }>(cacheKey, 30 * 60_000)
  if (cached?.candles?.length) return cached.candles
  const candles = market === 'KR' ? await krCandles(ticker, tf) : await usCandles(ticker, tf)
  if (candles.length >= 10)
    await setCache(cacheKey, { ticker: ticker.toUpperCase(), market, tf, candles })
  return candles
}
