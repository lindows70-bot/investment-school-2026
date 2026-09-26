// 시장 탭 원천 도달 확인 — 이 라우트가 도는 서버(Vercel icn1)에서 새 원천 호스트마다 한 번씩 불러 성공·시간·기준 시각을 돌려준다
//   배경: stock.naver.com/api·m.stock.naver.com/front-api 는 로컬에서만 200 을 확인했다(해외 IP·데이터센터 차단 여부 미확인).
//   가벼운 요청만(목록 3줄·첫 쪽) — 캐시하지 않는다. 공개 시장 데이터라 로그인 불필요.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { fetchKrIndices, fetchKrIndexMinute, fetchKrIntegration, fetchKrMovers, fetchKrIndustry, fetchKrMainNews } from '@/lib/krMarketBoard'
import { fetchFlowRank, fetchStockTrend } from '@/lib/foreignOrgFlow'
import { fetchUsMovers, fetchUsEtfIntraday } from '@/lib/usMarketBoard'
import { fetchCoinBoard } from '@/lib/upbitMarket'
import { fetchCnnFngYear } from '@/lib/cnnFng'
import { fetchCryptoFngYear } from '@/lib/cryptoFng'
import { getJson } from '@/lib/marketBoardShared'
import { parseFxPages } from '@/lib/fxTrend'

type Check = { name: string; host: string; ok: boolean; ms: number; detail: string; asOf: string | null }

async function timed(name: string, host: string, fn: () => Promise<{ ok: boolean; detail: string; asOf?: string | null }>): Promise<Check> {
  const t0 = Date.now()
  try {
    const r = await fn()
    return { name, host, ok: r.ok, ms: Date.now() - t0, detail: r.detail, asOf: r.asOf ?? null }
  } catch (e) {
    return { name, host, ok: false, ms: Date.now() - t0, detail: `예외: ${(e as Error).message}`, asOf: null }
  }
}
// Part → 확인 결과
const fromPart = (p: { ok: boolean; asOf?: string | null; reason?: string }, what: string) =>
  ({ ok: p.ok, detail: p.ok ? what : (p.reason ?? '실패'), asOf: p.ok ? p.asOf ?? null : null })

export async function GET() {
  const checks = await Promise.all([
    timed('국내 지수(polling)', 'polling.finance.naver.com', async () => fromPart(await fetchKrIndices(), '지수 3종')),
    timed('지수 분봉', 'api.stock.naver.com', async () => fromPart(await fetchKrIndexMinute('KOSPI'), '분봉')),
    timed('투자자별·등락 수', 'm.stock.naver.com/api', async () => fromPart(await fetchKrIntegration('KOSPI'), 'integration')),
    timed('특징종목(국내)', 'm.stock.naver.com/api', async () => fromPart(await fetchKrMovers('up', 'KOSPI', 3), 'up/KOSPI')),
    timed('업종', 'm.stock.naver.com/api', async () => fromPart(await fetchKrIndustry(5), 'industry')),
    timed('주요 뉴스', 'm.stock.naver.com/front-api', async () => fromPart(await fetchKrMainNews(3), 'mainnews')),
    timed('주체별 순매매', 'stock.naver.com/api', async () => fromPart(await fetchFlowRank('FOREIGNER', 'KOSPI', 3), 'trendForeignOrg')),
    timed('종목별 추이', 'm.stock.naver.com/api', async () => {
      const t = await fetchStockTrend('005930', 3)
      return { ok: !!t?.length, detail: t?.length ? `${t.length}행` : '실패', asOf: t?.[0]?.date ?? null }
    }),
    timed('특징종목(미국)', 'stock.naver.com/api', async () => fromPart(await fetchUsMovers('marketValue', 3), 'global usa')),
    timed('환율(하나은행)', 'stock.naver.com/api', async () => {
      const r = await getJson('https://stock.naver.com/api/securityService/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=5')
      if (!r.ok) return { ok: false, detail: r.reason }
      const rows = parseFxPages([r.json])
      return { ok: rows.length > 0, detail: rows.length ? `${rows.length}행` : '행 없음', asOf: rows[rows.length - 1]?.date ?? null }
    }),
    timed('SPY 5분봉', 'query1.finance.yahoo.com', async () => fromPart(await fetchUsEtfIntraday('SPY'), 'SPY')),
    timed('코인 시세', 'api.upbit.com', async () => fromPart(await fetchCoinBoard(3), 'ticker/all')),
    timed('CNN 공포·탐욕', 'production.dataviz.cnn.io', async () => fromPart(await fetchCnnFngYear(), 'graphdata')),
    timed('코인 공포·탐욕', 'api.alternative.me', async () => {
      const v = await fetchCryptoFngYear()
      return { ok: !!v, detail: v ? `${v.points}일` : '실패', asOf: v?.date ?? null }
    }),
  ])
  const failed = checks.filter(c => !c.ok).map(c => c.name)
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? 'local',
    at: new Date().toISOString(),
    allOk: failed.length === 0,
    failed,
    checks,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
