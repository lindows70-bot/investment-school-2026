// 🇰🇷 한국 공매도 데이터 서빙 — 로컬 러너(scripts/krx-short-runner.py, KRX 로그인)가 적재한 app_cache를 읽기만 함.
// 웹앱은 KRX 계정에 접근하지 않음(계정은 선생님 PC 러너 전용). 러너 미실행 시 stale 캐시라도 서빙(날짜 표기).
import { NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'

export interface KrShortMarketRow { ticker: string; name: string; market: 'KOSPI' | 'KOSDAQ'; shortVol: number; buyVol: number; ratio: number }
export interface KrShortHolding {
  ticker: string; name: string
  series: { date: string; shortVol: number; ratio: number }[]   // 60일 공매도 거래 추이
  balance: { date: string; qty: number; pct: number } | null    // 순보유잔고(T+2 공시)
}
export interface KrShortResult { date: string; marketTop: KrShortMarketRow[]; holdings: KrShortHolding[]; asOf: string }

export async function GET() {
  // 러너가 일 1회 갱신 — 주말·연휴 포함 7일까지는 최신 거래일 데이터로 유효
  const data = await getCache<KrShortResult>('krx-short-daily', 7 * 24 * 3600_000)
  if (!data) return NextResponse.json({ error: '러너 미적재 — 선생님 PC에서 krx-short-runner.py 실행 필요' }, { status: 503 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
