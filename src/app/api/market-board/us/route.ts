// 시장 탭 '미국' 공개 데이터 — SPY·QQQ 장중(야후 5분봉) + 특징종목(네이버 해외 순위 — 초소형주·상장 직후·권리/유닛 걸러냄, 걸러낸 개수 병기)
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import {
  US_MOVER_KINDS, US_MIN_CAP_USD, US_NEW_LISTING_DAYS, fetchUsMovers, fetchUsEtfIntraday,
} from '@/lib/usMarketBoard'
import { usSessionTtlMs } from '@/lib/marketBoardShared'
import { boardCached } from '@/lib/marketBoardCache'

const KEY = 'market-board-us-v1'   // 🗓️ 날짜 없는 키 — 미국 정규장 3분·그 밖 30분

async function build() {
  const [spy, qqq, movers] = await Promise.all([
    fetchUsEtfIntraday('SPY'),
    fetchUsEtfIntraday('QQQ'),
    Promise.all(US_MOVER_KINDS.map(async k => [k, await fetchUsMovers(k)] as const)).then(Object.fromEntries),
  ])
  return {
    etfs: { SPY: spy, QQQ: qqq },
    movers,
    rules: {
      minCapUsd: US_MIN_CAP_USD,
      newListingDays: US_NEW_LISTING_DAYS,
      note: `시가총액 ${US_MIN_CAP_USD / 1e8}억 달러 미만·상장 ${US_NEW_LISTING_DAYS}일 이내·권리/유닛(심볼에 공백)은 뺐습니다(filtered 에 개수). 원천 순위는 주식만 나오고 ETF 는 없습니다. 순위 목록엔 기준 시각이 없어 asOf 가 비어 있습니다.`,
      qqqIsNot: 'QQQ 는 나스닥100 추종 ETF 입니다(나스닥 종합 ^IXIC 와 다른 지수).',
    },
  }
}

export async function GET() {
  const ttl = usSessionTtlMs(Date.now(), 3 * 60_000, 30 * 60_000)
  const body = await boardCached(KEY, ttl, build)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
