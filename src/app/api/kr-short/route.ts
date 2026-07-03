// 🇰🇷 한국 공매도 데이터 서빙 — 로컬 러너(scripts/krx-short-runner.py, KRX 로그인)가 적재한 app_cache를 읽기만 함.
// 웹앱은 KRX 계정에 접근하지 않음(계정은 선생님 PC 러너 전용). 러너 미실행 시 stale 캐시라도 서빙(날짜 표기).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'

export interface KrShortMarketRow { ticker: string; name: string; market: 'KOSPI' | 'KOSDAQ'; shortVol: number; buyVol: number; ratio: number }
export type KrShortSignal = 'heavy' | 'rising' | 'covering' | 'spike' | 'calm'
export interface KrShortHolding {
  ticker: string; name: string
  series: { date: string; shortVol: number; ratio: number }[]   // 60일 공매도 거래 추이
  balance: { date: string; qty: number; pct: number; chg20d: number | null } | null    // 순보유잔고(T+2 공시) + 20일 변화율
  balSeries?: { date: string; qty: number; pct: number }[]      // 잔고 60일 추이(스파크용)
  signal?: KrShortSignal
}
export interface KrShortResult { date: string; marketTop: KrShortMarketRow[]; holdings: KrShortHolding[]; asOf: string }

// 신호 판정(결정론·미국판과 동형): 🔴숏과다=잔고 3%↑ / 🟠숏증가=잔고 20일 +20%↑ / 🔵숏커버링=잔고 20일 −20%↓ / 🟡당일집중=거래비중 10%↑ / 🟢평온
function judge(h: KrShortHolding): KrShortSignal {
  const pct = h.balance?.pct ?? 0, chg = h.balance?.chg20d ?? 0
  const lastRatio = h.series.length ? h.series[h.series.length - 1].ratio : 0
  if (pct >= 3) return 'heavy'
  if (chg >= 20 && pct >= 0.3) return 'rising'
  if (chg <= -20 && pct >= 0.1) return 'covering'
  if (lastRatio >= 10) return 'spike'
  return 'calm'
}

export async function GET() {
  // 러너가 일 1회 갱신 — 주말·연휴 포함 7일까지는 최신 거래일 데이터로 유효
  const data = await getCache<KrShortResult>('krx-short-daily', 7 * 24 * 3600_000)
  if (!data) return NextResponse.json({ error: '러너 미적재 — 선생님 PC에서 krx-short-runner.py 실행 필요' }, { status: 503 })

  // ⚠️ 러너는 전체 학생 합집합을 수집(공유 캐시) — 서빙 시 로그인 사용자의 보유 종목으로 필터('내 종목' 의미 보장).
  //    미로그인이면 시장 Top만 제공(holdings 비움).
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: rows } = await admin.from('investments').select('ticker').eq('user_id', user.id)
    const mine = new Set((rows ?? []).map(r => (r.ticker ?? '').trim()))
    data.holdings = data.holdings.filter(h => mine.has(h.ticker))
  } else {
    data.holdings = []
  }
  data.holdings = data.holdings.map(h => ({ ...h, signal: judge(h) }))
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
