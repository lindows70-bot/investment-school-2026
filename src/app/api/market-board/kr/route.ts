// 시장 탭 '국내' 공개 데이터 — 지수 3종·장중 분봉·투자자별 합계·등락 수·특징종목·업종·주요 뉴스(네이버 원천, 로그인 불필요·LLM 안 씀)
//   원천별로 { ok, data, asOf, source } 또는 { ok:false, reason } — 화면이 '없음'과 '못 가져옴'을 가른다.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import {
  KR_INDEX_CODES, KR_MOVER_KINDS, KR_PRICE_LIMIT_PCT, type KrMarket,
  fetchKrIndices, fetchKrIndexMinute, fetchKrIntegration, fetchKrMovers, fetchKrIndustry, fetchKrMainNews,
} from '@/lib/krMarketBoard'
import { krSessionTtlMs } from '@/lib/marketBoardShared'
import { boardCached } from '@/lib/marketBoardCache'

const KEY = 'market-board-kr-v3'   // 🗓️ 날짜 없는 키 — TTL 로 신선도(장중 3분·그 밖 30분) · v2: ETF/ETN 은 가격제한 필터 제외·시고저 0 → null · v3: 특징종목을 주식 10개 모일 때까지 담음
const MARKETS: KrMarket[] = ['KOSPI', 'KOSDAQ']

async function build() {
  const [indices, charts, integ, movers, industry, news] = await Promise.all([
    fetchKrIndices(),
    Promise.all(KR_INDEX_CODES.map(async c => [c, await fetchKrIndexMinute(c)] as const)).then(Object.fromEntries),
    Promise.all(MARKETS.map(async m => [m, await fetchKrIntegration(m)] as const)).then(Object.fromEntries),
    Promise.all(MARKETS.map(async m => [m,
      await Promise.all(KR_MOVER_KINDS.map(async k => [k, await fetchKrMovers(k, m)] as const)).then(Object.fromEntries),
    ] as const)).then(Object.fromEntries),
    fetchKrIndustry(),
    fetchKrMainNews(10),
  ])
  return {
    indices, charts,
    investorsAndBreadth: integ,   // 시장별 { investors(억원), upDown(종목 수) }
    movers, industry, news,
    units: { investors: '억원', tradeValue: '억원', marketCap: '억원' },
    rules: {
      moversPriceLimit: `등락률이 ±${KR_PRICE_LIMIT_PCT}%(KRX 주식 가격제한폭)를 넘는 **주식**은 뺐습니다 — 가격제한폭이 없는 날(상장 첫날·거래 재개처럼 기준가가 새로 정해진 날, 정리매매)에만 나옵니다(원천에 상장일 필드가 없어 이 규칙으로 판정). ETF·ETN 은 레버리지 배율만큼 제한폭이 넓어 거르지 않습니다.`,
      industryLimitBreak: '업종 등락이 ±30%를 넘으면 가격제한폭 밖 종목(상장 첫날·정리매매 등)이 섞인 것입니다(limitBreakSuspect) — 상승·하락 종목 수를 함께 보세요.',
      breadth: '등락 종목 수는 시장 전체의 오늘 등락입니다(앱의 200일선 시장 폭과 다른 지표).',
    },
  }
}

export async function GET() {
  const ttl = krSessionTtlMs(Date.now(), 3 * 60_000, 30 * 60_000)
  const body = await boardCached(KEY, ttl, build)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
