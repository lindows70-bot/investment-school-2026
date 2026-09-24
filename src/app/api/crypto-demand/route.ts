// 📊 현물 vs 선물 수요 증가(30일 합) — 크립토퀀트 스타일 차트의 무료 재현 (2026-08-22 사용자 요청)
//
// 정의(화면에 그대로 밝힌다 — 원본과 같지 않다):
//   · 선물 수요 = 무기한 선물 **미결제약정(OI) 30일 변화량(BTC)**  ← 레버리지가 늘었나 줄었나
//   · 현물 수요 = 현물 ETF **순유입 30일 합을 BTC로 환산**          ← 제도권 현물 창구로 들어온 실물
//   · 가격 = BTC 일별 종가
//   ⚠️ 크립토퀀트 원본은 전 거래소 + **온체인** 현물 수요다. 우리는 바이비트 OI + ETF 창구만이라
//      값의 절대 크기가 다르다. '방향과 국면'을 보는 용도로만 쓴다.
//
// ⚠️ Phase 0 실측(2026-08-22) — 기간 상한이 이 기능의 한계를 정한다:
//   바이낸스 OI 30일 / OKX rubik 179일(USD 단위) / **바이비트 200일·BTC 단위** → 바이비트 채택.
//   200일 − 30일 = **170포인트(약 5.7개월)**. 원본(1.5년)은 무료로 불가능.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import type { BtcEtfResult } from '@/app/api/btc-etf/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface DemandPoint {
  d: string
  futures: number | null   // OI 30일 변화(BTC) — 양수=레버리지 유입
  spot: number | null      // ETF 순유입 30일 합(BTC 환산) — 양수=현물 매집
  price: number | null
}
export interface CryptoDemandApi {
  points: DemandPoint[]
  latest: { futures: number | null; spot: number | null; total: number | null; price: number | null } | null
  windowDays: number
  spotAvailable: boolean
  note: string
  asOf: string
}

const j = async (u: string) => {
  const r = await fetch(u, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

export async function GET(req: Request) {
  const key = `crypto-demand-v2:${kstDate()}`   // v2: 현물 축이 TheBlock 순유입(btc-etf v8)으로 — 옛 문서는 Farside 09-04 까지라 spot 이 null 로 박제돼 있었다
  const cached = await getCache<CryptoDemandApi>(key, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 선물: 바이비트 무기한 OI 일별(BTC 단위 — 실측 확인) 200일
  const oiByDate = new Map<string, number>()
  try {
    const by = await j('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200')
    for (const x of by?.result?.list ?? []) {
      const v = Number(x.openInterest), t = Number(x.timestamp)
      if (v > 0 && isFinite(t)) oiByDate.set(new Date(t).toISOString().slice(0, 10), v)
    }
  } catch { /* 선물 축 없이도 현물 축만으로 그린다 */ }

  // ② 가격: 야후 BTC-USD 일별
  const priceByDate = new Map<string, number>()
  try {
    const y = await j('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=1y&interval=1d')
    const r0 = y?.chart?.result?.[0]
    const ts: number[] = r0?.timestamp ?? []
    const cl: (number | null)[] = r0?.indicators?.quote?.[0]?.close ?? []
    for (let i = 0; i < ts.length; i++) {
      if (typeof cl[i] === 'number' && (cl[i] as number) > 0) priceByDate.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), cl[i] as number)
    }
  } catch { /* 가격 라인만 빠진다 */ }

  // ③ 현물: 기존 btc-etf 캐시 재사용(제2원칙 — 같은 값). 콜드면 self-fetch 로 워밍 후 재조회
  let etfFlow: { date: string; net: number }[] = []
  const etfKey = `btc-etf-v8:${kstDate()}`   // ⚠️ writer(btc-etf 라우트)와 반드시 함께 올린다 — 안 그러면 현물 축이 조용히 빈다
  // v7 부터 flow 가 '마지막 성공분'(flowStale)일 수 있다 — 그 뒤 날짜는 flowByDate 에 없어 아래 60% 규칙이 spot 을 null 로 비운다(거짓 합계 없음)
  let etf = await getCache<BtcEtfResult>(etfKey, 24 * 3600_000)
  if (!etf) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
      await fetch(`${base}/api/btc-etf`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      etf = await getCache<BtcEtfResult>(etfKey, 24 * 3600_000)
    } catch { /* 현물 축 생략 */ }
  }
  if (etf?.flow?.length) etfFlow = etf.flow.map(f => ({ date: f.date, net: f.net }))
  const flowByDate = new Map(etfFlow.map(f => [f.date, f.net]))

  // ④ 30일 창 계산 — OI 가 있는 날짜를 축으로(가장 짧은 축이 기간을 정한다)
  const dates = Array.from(oiByDate.keys()).sort()
  const W = 30
  const points: DemandPoint[] = []
  for (let i = W; i < dates.length; i++) {
    const d = dates[i], d0 = dates[i - W]
    const oiNow = oiByDate.get(d), oiPrev = oiByDate.get(d0)
    const futures = oiNow != null && oiPrev != null ? Math.round(oiNow - oiPrev) : null
    // 현물: 그 30일 구간의 ETF 순유입($M)을 각 날짜 가격으로 BTC 환산해 합산
    let spotBtc = 0, spotDays = 0
    for (let k = i - W + 1; k <= i; k++) {
      const dk = dates[k]
      const net = flowByDate.get(dk)               // $M
      const px = priceByDate.get(dk)
      if (net == null || px == null || !(px > 0)) continue
      spotBtc += (net * 1e6) / px
      spotDays++
    }
    points.push({
      d, futures,
      spot: spotDays >= Math.floor(W * 0.6) ? Math.round(spotBtc) : null,   // 구간의 60% 미만이면 합계가 거짓이 된다
      price: priceByDate.get(d) ?? null,
    })
  }

  const last = points[points.length - 1] ?? null
  const out: CryptoDemandApi = {
    points,
    latest: last ? {
      futures: last.futures, spot: last.spot,
      total: last.futures != null && last.spot != null ? last.futures + last.spot : null,
      price: last.price,
    } : null,
    windowDays: W,
    spotAvailable: points.some(p => p.spot != null),
    note: '선물 수요=바이비트 무기한 OI 30일 변화(BTC) · 현물 수요=현물 ETF 순유입 30일 합의 BTC 환산 · 크립토퀀트 원본은 전 거래소+온체인 기반이라 절대 크기가 다릅니다(방향·국면 비교용)',
    asOf: new Date().toISOString(),
  }
  if (points.length > 10) await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
