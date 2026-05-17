/**
 * GET /api/macro-data
 *
 * 실시간 글로벌 거시경제 + 주가 데이터 집계 엔드포인트
 *
 * 데이터 소스:
 *  ① Yahoo Finance (yahoo-finance2)  — NVDA, PLTR 36개월 월봉
 *  ② World Bank Open API (무료, 무인증) — 주요국 CPI·실업률·부채
 *  ③ 정적 폴백                          — 중앙은행 기준금리 (변경 빈도 낮음)
 *
 * 캐싱: 6시간 (s-maxage=21600)
 */

import { NextResponse } from 'next/server'

// ─── 기준금리 폴백 (현재 시점 수동 업데이트, ISO3 기준) ──────────────────────
// 중앙은행 정책금리는 공개 무료 API가 없으므로 분기 1회 업데이트 권장
const FALLBACK_RATES: Record<string, number> = {
  USA: 3.63, KOR: 2.50, JPN: 0.50, CHN: 3.10, DEU: 2.65,
  GBR: 4.50, FRA: 2.65, IND: 6.25, BRA: 13.25, AUS: 4.10,
  CAN: 2.75, RUS: 21.0, TUR: 42.5, SAU: 5.00, ZAF: 7.75,
}

// ─── World Bank API 헬퍼 ─────────────────────────────────────────────────────
async function fetchWorldBank(
  indicator: string,
  countryStr: string,
  mrv = 3,
): Promise<Record<string, number | null>> {
  const url =
    `https://api.worldbank.org/v2/country/${countryStr}/indicator/${indicator}` +
    `?format=json&mrv=${mrv}&per_page=200`
  try {
    const res = await fetch(url, {
      next: { revalidate: 21600 },  // 6시간 캐시
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return {}
    const json = await res.json()
    const items: { countryiso3code: string; value: number | null }[] = json?.[1] ?? []
    const result: Record<string, number | null> = {}
    for (const item of items) {
      const iso3 = item.countryiso3code
      if (iso3 && item.value != null && !(iso3 in result)) {
        result[iso3] = Math.round(item.value * 100) / 100
      }
    }
    return result
  } catch {
    return {}
  }
}

// ─── Yahoo Finance 월봉 헬퍼 ─────────────────────────────────────────────────
async function fetchMonthlyHistory(
  ticker: string,
  months = 38,   // 여유 있게 38개월 (rollingwindow 36개월 + 버퍼)
): Promise<{ date: string; close: number }[]> {
  const endDate   = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  try {
    const { default: yf } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yfinance = new (yf as any)({ suppressNotices: ['yahooSurvey'] })
    const data = await yfinance.historical(ticker, {
      period1:  startDate,
      period2:  endDate,
      interval: '1mo',
    })
    return data
      .filter((d: { close?: number }) => d.close != null)
      .map((d: { date: Date; close: number }) => ({
        date:  `${d.date.getFullYear()}.${String(d.date.getMonth() + 1).padStart(2, '0')}`,
        close: Math.round(d.close * 100) / 100,
      }))
  } catch (e) {
    console.error(`[macro-data] ${ticker} history error:`, (e as Error).message)
    return []
  }
}

// ─── US 기준금리 (FRED CSV — 무료, 인증 불필요) ──────────────────────────────
async function fetchFedFundsHistory(months = 38): Promise<{ date: string; rate: number }[]> {
  try {
    const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS'
    const res = await fetch(url, { next: { revalidate: 21600 } })
    if (!res.ok) return []
    const csv  = await res.text()
    const rows = csv.trim().split('\n').slice(1)  // 헤더 제거
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)

    return rows
      .map(row => {
        const [dateStr, rateStr] = row.split(',')
        const date = new Date(dateStr)
        return { date, rate: parseFloat(rateStr) }
      })
      .filter(r => !isNaN(r.rate) && r.date >= cutoff)
      .map(r => ({
        date: `${r.date.getFullYear()}.${String(r.date.getMonth() + 1).padStart(2, '0')}`,
        rate: Math.round(r.rate * 100) / 100,
      }))
  } catch {
    return []
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET() {
  const COUNTRIES_STR = 'USA;KOR;JPN;CHN;DEU;GBR;FRA;IND;BRA;AUS;CAN;RUS;TUR;SAU;ZAF'

  // 모든 소스 병렬 fetch
  const [
    cpiResult,
    unempResult,
    debtResult,
    nvdaResult,
    pltrResult,
    fedRateResult,
  ] = await Promise.allSettled([
    fetchWorldBank('FP.CPI.TOTL.ZG',     COUNTRIES_STR),   // 소비자물가
    fetchWorldBank('SL.UEM.TOTL.ZS',     COUNTRIES_STR),   // 실업률
    fetchWorldBank('GC.DOD.TOTL.GD.ZS',  COUNTRIES_STR),   // 정부부채/GDP
    fetchMonthlyHistory('NVDA', 38),
    fetchMonthlyHistory('PLTR', 38),
    fetchFedFundsHistory(38),
  ])

  const cpi      = cpiResult.status   === 'fulfilled' ? cpiResult.value   : {}
  const unemp    = unempResult.status === 'fulfilled' ? unempResult.value : {}
  const debt     = debtResult.status  === 'fulfilled' ? debtResult.value  : {}
  const nvda     = nvdaResult.status  === 'fulfilled' ? nvdaResult.value  : []
  const pltr     = pltrResult.status  === 'fulfilled' ? pltrResult.value  : []
  const fedRates = fedRateResult.status === 'fulfilled' ? fedRateResult.value : []

  // 소스별 성공 여부 로그
  console.info('[macro-data] sources:', {
    cpi:      Object.keys(cpi).length > 0 ? 'OK' : 'FALLBACK',
    unemp:    Object.keys(unemp).length > 0 ? 'OK' : 'FALLBACK',
    debt:     Object.keys(debt).length > 0 ? 'OK' : 'FALLBACK',
    nvda:     nvda.length > 0 ? `${nvda.length}pts` : 'FALLBACK',
    pltr:     pltr.length > 0 ? `${pltr.length}pts` : 'FALLBACK',
    fedRates: fedRates.length > 0 ? `${fedRates.length}pts` : 'FALLBACK',
  })

  return NextResponse.json(
    {
      countries: {
        cpi,
        unemp,
        debt,
        rates: FALLBACK_RATES,   // 기준금리는 폴백값 사용 (분기 수동 업데이트)
      },
      stocks: { nvda, pltr },
      fedRates,
      dataQuality: {
        cpiSource:   Object.keys(cpi).length  > 5  ? 'worldbank' : 'fallback',
        stockSource: nvda.length > 12 ? 'yahoo' : 'fallback',
        fedSource:   fedRates.length > 12 ? 'fred' : 'fallback',
      },
      lastUpdated: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    },
  )
}
