// 🌊 엘리어트 파동 교육 차트 — 실제 파동 카운트는 분석가마다 다른 주관적 기법이라(제1원칙 위반)
// '몇 번 파동인가'를 단정하지 않는다. 대신 객관적 ZigZag(%임계) 알고리즘으로 실제 가격의 상승/하락
// 스윙을 순서대로 표시해 '엘리어트가 파동을 세는 방식'의 개념만 가르친다. 스윙 번호 ≠ 공식 파동 라벨.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

interface Swing { date: string; price: number; type: 'high' | 'low'; seq: number; confirmed: boolean }
export interface ElliottEduResult {
  market: 'US' | 'KR'; ticker: string; label: string
  points: { date: string; price: number }[]
  swings: Swing[]
  current: { price: number; date: string; sincePivotPct: number; direction: 'up' | 'down'; pivotsUp: number; pivotsDown: number }
  zigzagPct: number
  asOf: string
}

const ANCHOR = { US: { ticker: 'QQQ', label: '나스닥100(QQQ)' }, KR: { ticker: '069500', label: '코스피200(KODEX200)' } } as const
const ZIGZAG_PCT = 8   // 8% 임계 — 주봉 기준 노이즈 필터(임계 낮추면 스윙 과다, 높이면 과소)

async function yahooWeeklyClose(ticker: string): Promise<{ date: string; price: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1wk`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []
      const c: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const out = ts.map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), price: c[i] }))
        .filter((x): x is { date: string; price: number } => x.price != null && x.price > 0)
      if (out.length > 20) return out
    } catch { /* 다음 host */ }
  }
  return []
}

async function naverWeeklyClose(code: string): Promise<{ date: string; price: number }[]> {
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=week&count=150&requestType=0`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    const out: { date: string; price: number }[] = []
    const re = /data="([^"]+)"/g; let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const p = m[1].split('|'); const ds = p[0]; const c = parseFloat(p[4])
      if (isFinite(c) && c > 0) out.push({ date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`, price: c })
    }
    return out
  } catch { return [] }
}

// 표준 ZigZag: 현재 추세 반대방향으로 임계% 이상 되돌리면 직전 극값을 스윙으로 확정하고 추세 반전
function zigzag(points: { date: string; price: number }[], pct: number): Swing[] {
  if (points.length < 3) return []
  const swings: Swing[] = []
  let dir: 'up' | 'down' | null = null
  let extremeIdx = 0
  for (let i = 1; i < points.length; i++) {
    const extreme = points[extremeIdx].price
    const cur = points[i].price
    const chgFromExtreme = ((cur - extreme) / extreme) * 100
    if (dir === null) {
      if (Math.abs(chgFromExtreme) >= pct) { dir = chgFromExtreme > 0 ? 'up' : 'down'; extremeIdx = i }
      else if ((dir === 'up' && cur > extreme) || (dir === 'down' && cur < extreme)) extremeIdx = i
    } else if (dir === 'up') {
      if (cur > extreme) extremeIdx = i
      else if (chgFromExtreme <= -pct) {
        swings.push({ date: points[extremeIdx].date, price: points[extremeIdx].price, type: 'high', seq: swings.length + 1, confirmed: true })
        dir = 'down'; extremeIdx = i
      }
    } else {
      if (cur < extreme) extremeIdx = i
      else if (chgFromExtreme >= pct) {
        swings.push({ date: points[extremeIdx].date, price: points[extremeIdx].price, type: 'low', seq: swings.length + 1, confirmed: true })
        dir = 'up'; extremeIdx = i
      }
    }
  }
  // 마지막 미확정 극값도 참고용으로 포함('진행 중' 스윙 — 아직 반전 임계% 미도달)
  if (dir) swings.push({ date: points[extremeIdx].date, price: points[extremeIdx].price, type: dir === 'up' ? 'high' : 'low', seq: swings.length + 1, confirmed: false })
  return swings
}

export async function GET(req: Request) {
  const market = (new URL(req.url).searchParams.get('market') ?? 'US').toUpperCase() === 'KR' ? 'KR' : 'US'
  const cacheKey = `elliott-wave-edu-v1:${market}`
  const cached = await getCache<ElliottEduResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const anchor = ANCHOR[market]
  const points = market === 'KR' ? await naverWeeklyClose(anchor.ticker) : await yahooWeeklyClose(anchor.ticker)
  if (points.length < 20) return NextResponse.json({ error: 'no_data' }, { status: 502 })

  const swings = zigzag(points, ZIGZAG_PCT)
  const last = points[points.length - 1]
  const confirmedSwings = swings.filter(s => s.confirmed)
  const lastConfirmed = confirmedSwings[confirmedSwings.length - 1] ?? null
  const sincePivotPct = lastConfirmed ? Math.round(((last.price - lastConfirmed.price) / lastConfirmed.price) * 1000) / 10 : 0
  const pivotsUp = confirmedSwings.filter(s => s.type === 'high').length
  const pivotsDown = confirmedSwings.filter(s => s.type === 'low').length

  const result: ElliottEduResult = {
    market, ticker: anchor.ticker, label: anchor.label,
    points, swings,
    current: { price: Math.round(last.price * 100) / 100, date: last.date, sincePivotPct, direction: sincePivotPct >= 0 ? 'up' : 'down', pivotsUp, pivotsDown },
    zigzagPct: ZIGZAG_PCT, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
