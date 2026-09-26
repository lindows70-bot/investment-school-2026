// 🚨 오늘의 급등락 알림 API — 비트코인(항상) + 본인 보유 종목의 당일 ±5% 이상 등락(매매 브리핑 배너용)
//    가격·등락률은 /api/stock-price 배치(SSOT: KR=네이버·US=야후·CRYPTO=업비트)를 그대로 쓴다(제2원칙).
//    ⚠️ 보유 목록은 개인 데이터 — 본인 세션만(RLS)·공유 캐시 저장 금지·no-store.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** 급등락 판정 임계 — 사용자 지정(2026-08-20): "5% 이상 튀어오르면/빠지면" */
const MOVE_PCT = 5

export interface DayMover {
  ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO'
  changePct: number
  held: boolean          // false = 보유 안 했지만 항상 감시하는 시장 바로미터(비트코인)
}
export interface DayMoversApi {
  surges: DayMover[]     // ≥ +5%
  drops: DayMover[]      // ≤ −5%
  checked: number        // 평가한 종목 수(비트코인 포함) — "알림 없음"이 "안 봤음"이 아니게
  failed: number         // 가격을 못 받은 종목 수 — 0이 아니면 화면이 밝힌다
  heldChecked: number    // 본인 보유 종목만 센 평가 수(보유 안 한 바로미터 BTC 제외) — 학생 홈 시황용
  heldFailed: number     // 그중 등락률을 못 받은 수(응답에서 빠진 행 포함) — BTC 만 성공하고 보유 전부 실패해도 '없음'이 되지 않게
  threshold: number
  asOf: string
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: invs } = await sb.from('investments')
    .select('ticker,name,market').eq('user_id', user.id)

  // 보유 종목 + 비트코인(항상 — 보유 여부와 무관한 시장 바로미터. 사용자 지정 2026-08-20)
  const held = new Map<string, { ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO' }>()
  for (const r of invs ?? []) {
    const t = String(r.ticker ?? '').toUpperCase()
    const m = r.market === 'KR' ? 'KR' : r.market === 'CRYPTO' ? 'CRYPTO' : 'US'
    if (t) held.set(t, { ticker: t, name: String(r.name ?? t), market: m })
  }
  const btcHeld = held.has('BTC')
  if (!btcHeld) held.set('BTC', { ticker: 'BTC', name: '비트코인', market: 'CRYPTO' })

  const list = Array.from(held.values())
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const byTicker = new Map<string, number>()
  let failed = 0
  const BATCH = 30   // school-league 와 같은 배치 관례(stock-price POST 상한 50)
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH)
    try {
      const res = await fetch(`${selfBase}/api/stock-price`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slice.map(s => ({ ticker: s.ticker, market: s.market }))),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) { failed += slice.length; continue }
      const rows = await res.json() as { ticker: string; currentPrice: number; changePct: number; error?: string }[]
      for (const d of rows) {
        // ⚠️ 실패 폴백 행은 changePct=0 으로 오므로 '보합'과 구분해야 한다 — 가격 0 또는 error 면 실패로 센다
        if (d.error || !(d.currentPrice > 0)) { failed++; continue }
        byTicker.set(d.ticker.toUpperCase(), d.changePct)
      }
    } catch { failed += slice.length }
  }

  const movers: DayMover[] = list
    .map(s => ({ ...s, changePct: byTicker.get(s.ticker), held: s.ticker !== 'BTC' || btcHeld }))
    .filter((s): s is DayMover & { changePct: number } => typeof s.changePct === 'number' && isFinite(s.changePct))
    .map(s => ({ ...s, changePct: Math.round(s.changePct * 10) / 10 }))

  const surges = movers.filter(m => m.changePct >= MOVE_PCT).sort((a, b) => b.changePct - a.changePct)
  const drops = movers.filter(m => m.changePct <= -MOVE_PCT).sort((a, b) => a.changePct - b.changePct)

  // 보유 종목만의 확인·실패 수 — 등락률을 실제로 손에 쥔 종목만 성공으로 센다(movers 필터와 같은 기준)
  const heldList = list.filter(s => s.ticker !== 'BTC' || btcHeld)
  const heldFailed = heldList.filter(s => { const v = byTicker.get(s.ticker); return !(typeof v === 'number' && isFinite(v)) }).length

  const out: DayMoversApi = {
    surges, drops, checked: list.length, failed, heldChecked: heldList.length, heldFailed, threshold: MOVE_PCT,
    asOf: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') + ' KST',
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
