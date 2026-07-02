// 🕯️ 주간 캔들 리스크 신호 — 장악형(Engulfing) 패턴만 취급. 완전히 객관적 계산(주관 개입 0)이라 앱의
// 반-기술적분석 원칙(MACD·RSI 등 '소음' 배제)과 별개로 허용. 엘리어트 파동(주관적 카운팅)은 의도적 배제.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

type Pattern = 'bearish' | 'bullish' | 'none'
interface AnchorResult {
  label: string; ticker: string; market: 'US' | 'KR'
  weekOf: string; pattern: Pattern
  prevOpen: number; prevClose: number; curOpen: number; curClose: number
}
export interface CandlePatternResult { anchors: AnchorResult[]; asOf: string }

const ANCHORS: { label: string; ticker: string; market: 'US' | 'KR' }[] = [
  { label: '나스닥100(미국 성장)', ticker: 'QQQ', market: 'US' },
  { label: 'S&P500(미국 전체)', ticker: 'SPY', market: 'US' },
  { label: '코스피200(한국)', ticker: '069500', market: 'KR' },
]

function detect(prevO: number, prevC: number, curO: number, curC: number): Pattern {
  const prevBull = prevC > prevO, curBear = curC < curO
  const prevBear = prevC < prevO, curBull = curC > curO
  if (prevBull && curBear && curO >= prevC && curC <= prevO) return 'bearish'
  if (prevBear && curBull && curO <= prevC && curC >= prevO) return 'bullish'
  return 'none'
}

async function yahooWeekly(ticker: string): Promise<{ date: string; o: number; c: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1wk`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []
      const o: (number | null)[] = res?.indicators?.quote?.[0]?.open ?? []
      const c: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const out = ts.map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), o: o[i], c: c[i] }))
        .filter((x): x is { date: string; o: number; c: number } => x.o != null && x.c != null)
      if (out.length > 5) return out
    } catch { /* 다음 host */ }
  }
  return []
}

async function naverWeekly(code: string): Promise<{ date: string; o: number; c: number }[]> {
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=week&count=60&requestType=0`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    const out: { date: string; o: number; c: number }[] = []
    const re = /data="([^"]+)"/g; let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const p = m[1].split('|'); const ds = p[0]
      const o = parseFloat(p[1]), c = parseFloat(p[4])
      if (isFinite(o) && isFinite(c) && o > 0 && c > 0) out.push({ date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`, o, c })
    }
    return out
  } catch { return [] }
}

export async function GET() {
  const cacheKey = 'candle-pattern-v2'   // v2: 주 분절 조각(월말·분기 경계) 완결주 오인 수정 — 이번 주 월요일 이후 봉 전부 제거
  const cached = await getCache<CandlePatternResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ⚠️ 이번 주(진행 중) 봉 제거 — Yahoo는 월말·분기 경계에서 현재 주를 두 조각(예: 06-29+07-01)으로
  //    쪼개기도 해서 '마지막 1개만 제거'로는 부족(조각이 완결주로 오인돼 신호 조기 해제). 이번 주 월요일
  //    이후 날짜의 봉을 전부 걸러 진짜 완결주만 남긴다(네이버는 주 마지막 거래일 라벨이라 같은 기준으로 안전).
  const now = new Date()
  const monday = new Date(now); monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7)); monday.setUTCHours(0, 0, 0, 0)
  const mondayStr = monday.toISOString().slice(0, 10)

  const anchors: AnchorResult[] = []
  for (const a of ANCHORS) {
    const raw = a.market === 'KR' ? await naverWeekly(a.ticker) : await yahooWeekly(a.ticker)
    const bars = raw.filter(b => b.date < mondayStr)   // 완결주만
    if (bars.length < 2) continue
    const n = bars.length
    const prev = bars[n - 2], cur = bars[n - 1]
    anchors.push({
      label: a.label, ticker: a.ticker, market: a.market, weekOf: cur.date,
      pattern: detect(prev.o, prev.c, cur.o, cur.c),
      prevOpen: Math.round(prev.o * 100) / 100, prevClose: Math.round(prev.c * 100) / 100,
      curOpen: Math.round(cur.o * 100) / 100, curClose: Math.round(cur.c * 100) / 100,
    })
  }

  const result: CandlePatternResult = { anchors, asOf: new Date().toISOString() }
  if (anchors.length >= 2) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
