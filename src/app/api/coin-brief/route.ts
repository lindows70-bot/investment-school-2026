// 🪙 비트코인 한 줄 요약 — 브리핑에 붙이는 **가벼운** 요약(캐시만 읽고 계산·외부 호출 0). 본 응답(/api/coin-lab)은 ~100KB.
//    ⚠️ 급등락 배너는 '당일 ±5%'만 본다 — 3개월 +37% 같은 꾸준한 흐름은 브리핑에 한 번도 안 떴다(2026-09-24). 이 줄이 그 공백을 메운다.
//    캐시가 차갑면 null 을 돌려준다 — 브리핑은 그때 줄 자체를 그리지 않는다(없음 ≠ 못 불러옴).
import { NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export interface CoinBrief {
  usd: number | null; krw: number | null
  change: { w1: number | null; m1: number | null; m3: number | null }
  fng: number | null; mayer: number | null; ddPct: number | null; kimchiPct: number | null
  answer: { line: string; action: string; verdict: string }
  tone: 'accumulate' | 'caution' | 'neutral'
  asOf: string
}

export async function GET() {
  // 키 리터럴을 여기 다시 쓰지 않는다 — route 파일은 임의 export 를 못 하므로 coin-lab 의 상수를 import 할 수 없고,
  // 그렇다고 두 곳에 흩어두면 범프 때 한쪽만 올라간다(캐시 키 34건 재발 유형) → 한 곳(coin-lab)의 값을 그대로 옮겨 적고 주석으로 묶는다
  const brief = await getCache<CoinBrief>('coin-brief-v1', 26 * 3600_000)   // = coin-lab 의 COIN_BRIEF_KEY
  return NextResponse.json(brief ?? null, { headers: { 'Cache-Control': 'no-store' } })
}
