// 🤝 거장들의 합의 종목 — 9인 전설의 '상위 10위권'에서 2명 이상 겹치는 종목(consensus picks). 투자의 재미·교육용.
//   loadFunds(12h 캐시) 재사용, CUSIP으로 종목 동일성 판정(이름 드리프트 방어). 몇 명이 겹치나·각자 순위·비중.
import { NextResponse } from 'next/server'
import { loadFunds } from '@/lib/guru13f'
import { issuerToTicker } from '@/lib/guru13fTickers'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export interface ConsensusHolder { mgr: string; rank: number; pctPort: number }
export interface ConsensusStock { name: string; ticker: string | null; count: number; holders: ConsensusHolder[] }
export interface GuruConsensusResult {
  status: 'ok' | 'error'
  asOf: string
  trackedFunds: number
  stocks: ConsensusStock[]      // 2명 이상 겹치는 종목, 겹친 수 많은 순
  message?: string
}

const TOP_N = 10   // 각 거장의 상위 N위권만 대상(핵심 확신 종목)

export async function GET() {
  try {
    const funds = await loadFunds()
    if (!funds.length) return NextResponse.json({ status: 'error', asOf: '', trackedFunds: 0, stocks: [], message: 'SEC 13F 데이터를 불러오지 못했습니다.' } satisfies GuruConsensusResult)

    // key(티커 우선, 없으면 CUSIP) → { name, ticker, holders[] } — 티커 병합으로 GOOGL/GOOG·BRK-A/B 등 주식클래스 합침(회사 단위 합의)
    const map = new Map<string, { name: string; ticker: string | null; holders: ConsensusHolder[] }>()
    for (const fd of funds) {
      // 이 거장의 현재 보유를 회사 단위(티커||CUSIP)로 합산 → 비중 → 상위 N
      const agg = new Map<string, { name: string; ticker: string | null; val: number }>()
      for (const h of fd.cur) {
        const tk = issuerToTicker(h.name)
        const key = tk || h.cusip || h.name
        const a = agg.get(key) ?? { name: h.name, ticker: tk, val: 0 }
        a.val += h.val; agg.set(key, a)
      }
      const ranked = Array.from(agg.entries())
        .map(([key, a]) => ({ key, name: a.name, ticker: a.ticker, pctPort: fd.total > 0 ? Math.round((a.val / fd.total) * 1000) / 10 : 0 }))
        .sort((x, y) => y.pctPort - x.pctPort)
        .slice(0, TOP_N)
      ranked.forEach((p, i) => {
        const e = map.get(p.key) ?? { name: p.name, ticker: p.ticker, holders: [] }
        e.holders.push({ mgr: fd.mgr, rank: i + 1, pctPort: p.pctPort })
        map.set(p.key, e)
      })
    }

    const stocks: ConsensusStock[] = Array.from(map.values())
      .filter(e => e.holders.length >= 2)
      .map(e => ({
        name: e.name, ticker: e.ticker, count: e.holders.length,
        holders: e.holders.sort((a, b) => a.rank - b.rank),
      }))
      // 많이 겹친 순 → 최고 비중 순
      .sort((a, b) => b.count - a.count || Math.max(...b.holders.map(h => h.pctPort)) - Math.max(...a.holders.map(h => h.pctPort)))

    const asOf = funds.map(f => f.asOf).sort().reverse()[0] ?? ''
    return NextResponse.json({ status: 'ok', asOf, trackedFunds: funds.length, stocks } satisfies GuruConsensusResult, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ status: 'error', asOf: '', trackedFunds: 0, stocks: [], message: (e as Error).message } satisfies GuruConsensusResult)
  }
}
