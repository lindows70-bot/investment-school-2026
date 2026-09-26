// 시장 탭 '주체별 순매매' 공개 데이터 — 외국인·기관 × 순매수·순매도 상위 5(KRX, 코스피·코스닥) + 며칠째·함께 삼/팖·주가 역행·거래량 대비 비중
//   ⛔ 이 값은 6축 점수·추천에 넣지 않는다(WHAT/WHEN). 개인 순위는 원천이 없다 — 응답에 그 사실을 싣는다.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import type { KrMarket } from '@/lib/krMarketBoard'
import {
  type Investor, type TrendDay, fetchFlowRank, fetchStockTrend, buildFlowSide, INDIVIDUAL_NOTE, SRC_TREND,
} from '@/lib/foreignOrgFlow'
import { okPart, failPart, krSessionTtlMs } from '@/lib/marketBoardShared'
import { boardCached } from '@/lib/marketBoardCache'

const KEY = 'market-board-flow-v3'   // 🗓️ 날짜 없는 키 — 장중 10분(잠정치)·그 밖 60분 · v3: together false(함께 아님)·역행 양방향·ETF 는 가격제한 표시 제외
const MARKETS: KrMarket[] = ['KOSPI', 'KOSDAQ']
const INVESTORS: Investor[] = ['FOREIGNER', 'ORGANIZATION']
const TOP = 5
// ⏱️ 시간 예산 — maxDuration 30초 안에 app_cache 읽기·쓰기까지 끝나야 한다.
//    순위 4건(동시, 최대 6초) → 종목별 추이 최대 40종(동시 10, 건당 최대 5초·남은 시간 안에서).
//    예산이 바닥나면 남은 종목 추이는 부르지 않고 null('며칠째 못 셈')로 둔다 — 부분 실패라 저장되지 않는다(짧게만).
const BUDGET_MS = 24_000
const RANK_TIMEOUT_MS = 6_000
const TREND_TIMEOUT_MS = 5_000
const TREND_CONCURRENCY = 10

/** 동시에 limit 개씩만 — 종목별 추이를 최대 40종 부르므로 원천에 한꺼번에 몰리지 않게 */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

async function build() {
  const deadline = Date.now() + BUDGET_MS
  const ranks = await Promise.all(MARKETS.flatMap(m => INVESTORS.map(async inv => ({ m, inv, part: await fetchFlowRank(inv, m, 10, RANK_TIMEOUT_MS) }))))
  const codes = Array.from(new Set(ranks.flatMap(r => r.part.ok ? [...r.part.data.buy.slice(0, TOP), ...r.part.data.sell.slice(0, TOP)].map(x => x.code) : [])))
  let skipped = 0
  const trendRows = await pool(codes, TREND_CONCURRENCY, c => {
    const left = deadline - Date.now()
    if (left < 1_000) { skipped++; return Promise.resolve(null) }   // 시간 예산 소진 — 부르지 않는다
    return fetchStockTrend(c, undefined, Math.min(TREND_TIMEOUT_MS, left))
  })
  const trends = new Map<string, TrendDay[] | null>(codes.map((c, i) => [c, trendRows[i]]))
  const trendFailed = trendRows.filter(x => !x).length

  const markets: Record<string, Record<string, unknown>> = {}
  for (const { m, inv, part } of ranks) {
    markets[m] ??= {}
    markets[m][inv] = part.ok
      ? okPart({ bizdate: part.data.bizdate, ...buildFlowSide(part.data, trends, TOP) }, part.asOf, part.source)
      : failPart(part.reason, part.source)
  }
  return {
    basis: 'KRX 기준(원천 tradeType=KRX — NXT 체결은 빠짐) · 그날(DAY)',
    units: { net: '억원(원천 원 ÷ 1e8)', volShare: '%(그날 KRX 거래량 대비 순매매 수량)' },
    individual: { available: false, note: INDIVIDUAL_NOTE },
    streakRule: '며칠째 = 기준일부터 거슬러 같은 방향(순매수 +/순매도 −)이 이어진 날 수(종목별 일별 수량). 기준일 행이 없으면 null. capped = 받은 30일이 전부 같은 방향',
    // 종목별 추이가 하나라도 빠지면 부분 실패 — 저장하지 않는다(빠진 종목의 '며칠째'가 TTL 내내 비어 보이지 않게)
    trends: trendFailed > 0
      ? failPart<{ checked: number }>(`${codes.length}종 중 ${trendFailed}종 추이 못 가져옴${skipped ? `(시간 예산 소진으로 ${skipped}종 건너뜀)` : ''} — 그 종목의 며칠째·함께는 null`, SRC_TREND)
      : okPart({ checked: codes.length }, null, SRC_TREND),
    markets,
  }
}

export async function GET() {
  const ttl = krSessionTtlMs(Date.now(), 10 * 60_000, 60 * 60_000)
  const body = await boardCached(KEY, ttl, build)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
