/**
 * /api/fred — FRED API 서버 사이드 프록시
 *
 * FRED API Key를 클라이언트에 절대 노출하지 않기 위해
 * 모든 호출을 이 서버 라우트를 통해 중계한다.
 *
 * 사용 예:
 *   GET /api/fred?series_id=FEDFUNDS&units=lin&observation_start=2023-01-01
 *
 * FRED API 공식 문서:
 *   https://fred.stlouisfed.org/docs/api/fred/series_observations.html
 *
 * 지원 units:
 *   lin   = 원본 수준값
 *   pc1   = 전년 동기 대비 % 변화 (YoY %)
 *   pch   = 전 기간 대비 % 변화 (MoM %)
 *   chg   = 절대 변화량
 */

import { NextRequest, NextResponse } from 'next/server'
import { fredRaw, type FredParams } from '@/lib/fred'

// FRED API 응답 타입
interface FredApiResponse {
  observation_start: string
  observation_end:   string
  units:             string
  observations: {
    date:  string   // 'YYYY-MM-DD'
    value: string   // 숫자 문자열 또는 '.' (결측)
  }[]
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.FRED_API_KEY

  // ── API Key 미설정 시 503 반환 (클라이언트는 Mock으로 폴백)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FRED_API_KEY not configured', fallback: true },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const seriesId = searchParams.get('series_id')

  if (!seriesId) {
    return NextResponse.json({ error: 'series_id is required' }, { status: 400 })
  }

  // 쿼리 파라미터 조합 — 2026-10-18: FRED 공용 fetcher(lib/fred)로 통일. 12h 캐시는 Next Data Cache(revalidate)가 아니라
  //   아래 CDN 헤더(s-maxage) 한 겹으로만 — Data Cache 는 '첫 응답 박제' 사고가 9건이라 앱 전체에서 no-store 로 통일했다
  const units = searchParams.get('units')
  const params: FredParams = {
    sort_order: 'asc',
    units: units && units !== 'lin' ? units : undefined,
    observation_start: searchParams.get('observation_start') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  }

  const CACHE_HEADERS = {
    'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400',
  }

  try {
    const data = await fredRaw(seriesId, params) as FredApiResponse | null
    if (!data?.observations) {
      console.error('[/api/fred] FRED API error:', seriesId)
      return NextResponse.json({ error: 'FRED API request failed' }, { status: 502 })
    }

    // 결측값('.')을 제외하고 클린 데이터만 반환
    const cleaned = data.observations
      .filter(o => o.value !== '.' && o.value !== '')
      .map(o => ({ date: o.date, value: parseFloat(o.value) }))

    return NextResponse.json(
      { seriesId, units: units ?? 'lin', observations: cleaned },
      { headers: CACHE_HEADERS },
    )

  } catch (err) {
    console.error('[/api/fred] fetch error:', err)
    return NextResponse.json(
      { error: 'Internal fetch error' },
      { status: 500 },
    )
  }
}
