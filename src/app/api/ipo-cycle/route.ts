// 🚀 IPO 하이프 사이클 — 신규 상장 혁신주의 6단계 수명주기(HYPE→REALITY→PAIN→SMART MONEY→RECOVERY→UPTREND).
// ⚠️ 제미나이 안의 '가상 슬라이더' 대신, 실제 상장주를 상장가·주봉 실데이터로 곡선 위에 자동 매핑(제1원칙).
//    티커 재사용 오염(SPCX·CRCL 등 옛 동명 티커) 자동 가드: 상장 후 주봉수 > 경과주×1.4면 제외.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export type Phase = 'hype' | 'reality' | 'pain' | 'smart' | 'recovery' | 'uptrend'
export interface IpoStock {
  ticker: string; name: string; ipo: string
  months: number; ipoPrice: number; peak: number; trough: number; current: number
  ddFromPeak: number; upFromTrough: number; multiple: number   // 현재/상장가
  phase: Phase; curveX: number                                  // 0~100 곡선상 위치
  spark: number[]                                               // 상장 후 주봉(정규화 100 시작)
}
export interface IpoCycleResult { stocks: IpoStock[]; asOf: string }

// 큐레이션 유니버스 — 유명 IPO(상장일 검증). 오염 티커는 런타임 가드로 자동 제외.
const UNIVERSE: { ticker: string; name: string; ipo: string }[] = [
  { ticker: 'PLTR', name: '팔란티어', ipo: '2020-09-30' },
  { ticker: 'RDDT', name: '레딧', ipo: '2024-03-21' },
  { ticker: 'ARM', name: 'ARM', ipo: '2023-09-14' },
  { ticker: 'RBLX', name: '로블록스', ipo: '2021-03-10' },
  { ticker: 'COIN', name: '코인베이스', ipo: '2021-04-14' },
  { ticker: 'HOOD', name: '로빈후드', ipo: '2021-07-29' },
  { ticker: 'RIVN', name: '리비안', ipo: '2021-11-10' },
  { ticker: 'ABNB', name: '에어비앤비', ipo: '2020-12-10' },
  { ticker: 'SNOW', name: '스노우플레이크', ipo: '2020-09-16' },
  { ticker: 'DASH', name: '도어대시', ipo: '2020-12-09' },
  { ticker: 'RKLB', name: '로켓랩', ipo: '2021-08-25' },
  { ticker: 'ALAB', name: '아스테라랩스', ipo: '2024-03-20' },
  { ticker: 'TEM', name: '템퍼스AI', ipo: '2024-06-14' },
  { ticker: 'CART', name: '인스타카트', ipo: '2023-09-19' },
  { ticker: 'BIRK', name: '버켄스탁', ipo: '2023-10-11' },
  { ticker: 'LUNR', name: '인튜이티브머신', ipo: '2024-02-09' },
  { ticker: 'HIMS', name: '힘스앤허스', ipo: '2021-01-21' },
]

async function weekly(ticker: string): Promise<{ ts: number; c: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${ticker}?range=max&interval=1wk`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const j = await r.json(); const res = j?.chart?.result?.[0]
      const ts: number[] = res?.timestamp ?? []; const cl: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
      const out = ts.map((t, i) => ({ ts: t, c: cl[i] })).filter((x): x is { ts: number; c: number } => x.c != null && x.c > 0)
      if (out.length > 3) return out
    } catch { /* 다음 host */ }
  }
  return []
}

// 국면 판정 — 상장 경과월 + 주가 경로(peak 대비 낙폭·trough 대비 반등·상장가 배수)
function judge(mo: number, ipoP: number, peak: number, trough: number, cur: number): { phase: Phase; curveX: number } {
  const dd = (cur - peak) / peak            // peak 대비(음수)
  const up = (cur - trough) / trough        // trough 대비(양수)
  const mult = cur / ipoP                   // 상장가 대비 배수(핵심 게이트)
  let phase: Phase
  // ⭐ 상장가 배수로 게이팅: '저점 대비 반등'만으로 recovery 오판 금지(RIVN 0.14배인데 +116% 반등 = 여전히 폭락 → 매집)
  if (mult >= 2.5 && dd > -0.45) phase = 'uptrend'                   // 졸업: 상장가 2.5배+ & 고점권 유지
  else if (dd >= -0.12) phase = mo <= 4 ? 'hype' : 'uptrend'         // 전고점 근처
  else if (mo <= 4 && mult > 1.2 && dd > -0.30) phase = 'hype'        // 갓 상장 광기(상장가 위·미붕괴)
  else if (mo <= 12 && dd <= -0.30 && up < 0.25) phase = 'reality'    // 락업/실적 붕괴 초입(1년 내)
  else if ((dd <= -0.50 || mult < 0.55) && up < 0.25) phase = 'pain'  // 깊은 낙폭·상장가 절반↓·바닥권
  else if (mult >= 1.0 && up >= 0.25 && dd > -0.45) phase = 'recovery' // 상장가 회복 + 반등 + 고점권 접근
  else if (up >= 0.15) phase = 'smart'                              // 바닥 탈출·아직 상장가 이하(매집)
  else if (dd <= -0.20) phase = 'reality'
  else phase = 'smart'
  // 곡선 x(0~100): 6국면을 구간에 매핑
  const band: Record<Phase, [number, number]> = { hype: [3, 15], reality: [17, 30], pain: [33, 50], smart: [53, 66], recovery: [69, 84], uptrend: [87, 98] }
  const [a, b] = band[phase]
  // 국면 내 세부 위치: pain=낙폭 깊이, recovery/smart=반등 크기, uptrend=배수
  let t = 0.5
  if (phase === 'pain') t = Math.min(1, Math.max(0, -dd - 0.45) / 0.4)
  else if (phase === 'smart' || phase === 'recovery') t = Math.min(1, up / 0.8)
  else if (phase === 'uptrend') t = Math.min(1, (mult - 1) / 6)
  else if (phase === 'reality') t = Math.min(1, (-dd - 0.18) / 0.3)
  else t = Math.min(1, mo / 4)
  return { phase, curveX: Math.round((a + (b - a) * t) * 10) / 10 }
}

export async function GET() {
  const cacheKey = 'ipo-cycle-v2'   // v2: 상장가 배수 게이트(RIVN·RBLX 오판 수정) + 유니버스 확장
  const cached = await getCache<IpoCycleResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const stocks: IpoStock[] = []
  const results = await Promise.all(UNIVERSE.map(async u => {
    const rows = await weekly(u.ticker)
    if (rows.length < 4) return null
    const ipoTs = new Date(u.ipo).getTime() / 1000
    const after = rows.filter(x => x.ts >= ipoTs - 7 * 86400)
    if (after.length < 4) return null
    const mo = Math.round((Date.now() / 1000 - ipoTs) / (30.4 * 86400))
    const weeksSince = Math.round((Date.now() / 1000 - ipoTs) / (7 * 86400))
    // ⚠️ 티커 재사용 오염 가드: 상장 후 주봉수가 경과주보다 40%+ 많으면 옛 동명 티커 데이터 → 제외
    if (weeksSince > 6 && after.length > weeksSince * 1.4) return null
    const c = after.map(x => x.c)
    const ipoP = c[0], peak = Math.max(...c), cur = c[c.length - 1]
    const peakIdx = c.indexOf(peak), trough = Math.min(...c.slice(peakIdx))
    const { phase, curveX } = judge(mo, ipoP, peak, trough, cur)
    // 스파크: 상장가=100 정규화, 최대 60포인트
    const step = Math.max(1, Math.floor(c.length / 60))
    const spark = c.filter((_, i) => i % step === 0).map(v => Math.round(v / ipoP * 100))
    return {
      ticker: u.ticker, name: u.name, ipo: u.ipo, months: mo,
      ipoPrice: Math.round(ipoP * 100) / 100, peak: Math.round(peak * 100) / 100, trough: Math.round(trough * 100) / 100, current: Math.round(cur * 100) / 100,
      ddFromPeak: Math.round((cur - peak) / peak * 1000) / 10, upFromTrough: Math.round((cur - trough) / trough * 1000) / 10, multiple: Math.round(cur / ipoP * 100) / 100,
      phase, curveX, spark,
    } as IpoStock
  }))
  for (const r of results) if (r) stocks.push(r)
  stocks.sort((a, b) => a.curveX - b.curveX)

  const result: IpoCycleResult = { stocks, asOf: new Date().toISOString() }
  if (stocks.length >= 4) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
