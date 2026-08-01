// 📉 커버드콜 X-Ray API — 커버드콜 ETF vs 본주 총수익(TR) 갭·원금 침식 (배당 인컴 랩)
//    Yahoo chart 1회/종목(adjclose+close). 벤치마크는 중복 제거해 1회만 조회.
//    ⛔ 매수·매도 지시 아님(관측 전용) · 성공 60% 미만이면 캐시 박제 금지.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { CC_PAIRS, CC_XRAY_KEY, yahooSymbol, buildRow, type Bar, type CcXrayRow } from '@/lib/coveredCall'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface CcXrayResult { asOf: string; rows: CcXrayRow[]; scanned: number; okCount: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const key = CC_XRAY_KEY(kstDate())
  if (!refresh) {
    const cached = await getCache<CcXrayResult>(key, 24 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
    for (let back = 1; back <= 3; back++) {   // 장 시작 전 등 — 최근 3일 폴백
      const d = new Date(Date.now() + 9 * 3600_000 - back * 86_400_000).toISOString().slice(0, 10)
      const prev = await getCache<CcXrayResult>(CC_XRAY_KEY(d), 4 * 86_400_000)
      if (prev) return NextResponse.json(prev, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  const { default: YF } = await import('yahoo-finance2')
  const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
  const period1 = new Date(Date.now() - 4 * 365 * 86_400_000).toISOString().slice(0, 10)
  const period2 = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  const barsOf = async (sym: string): Promise<Bar[]> => {
    const c = await yf.chart(sym, { period1, period2, interval: '1d' }, { validateResult: false })
    return (c?.quotes ?? [])
      .filter((q: any) => q?.adjclose != null && q?.close != null && q.close > 0)
      .map((q: any) => ({
        date: (q.date instanceof Date ? q.date : new Date(q.date)).toISOString().slice(0, 10),
        close: Number(q.close), adj: Number(q.adjclose),
      }))
  }

  // 벤치마크는 여러 커버드콜이 공유 → 중복 제거 후 1회씩
  const benchSyms = Array.from(new Set(CC_PAIRS.map(p => p.bench)))
  const benchMap = new Map<string, Bar[]>()
  const bq = [...benchSyms]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const s = bq.shift(); if (!s) break
      try { benchMap.set(s, await barsOf(s.match(/^\d{6}$/) ? `${s}.KS` : s)) } catch { /* 실패 → 해당 쌍 생략 */ }
    }
  }))

  const rows: CcXrayRow[] = []
  const cq = [...CC_PAIRS]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const p = cq.shift(); if (!p) break
      const bench = benchMap.get(p.bench)
      if (!bench?.length) continue
      try {
        const cc = await barsOf(yahooSymbol(p))
        const row = buildRow(p, cc, bench)
        if (row) rows.push(row)
      } catch { /* 종목 실패 — 정직 생략 */ }
    }
  }))

  // 뒤처짐이 큰 순(= 경고가 필요한 순) — ⚠️ 분배율 순 정렬은 이 화면이 경고하려는 착시 그 자체
  rows.sort((a, b) => a.primary.trGap - b.primary.trGap)

  const result: CcXrayResult = { asOf: new Date().toISOString(), rows, scanned: CC_PAIRS.length, okCount: rows.length }
  if (rows.length >= CC_PAIRS.length * 0.6) await setCache(key, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
