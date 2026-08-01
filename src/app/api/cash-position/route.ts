// 💰 현금 포지션 API — GET=현금+자산 평가액→비중·막스 밴드 대비 / PUT=현금 등록(upsert)
//    ⚠️ user_cash 테이블 미생성 시 needsSetup 정직 반환(re_watchlist 관례). 개인 데이터라 auth 필수·캐시 개인 키.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { evaluateAssets, buildCashPosition, type CashPosition } from '@/lib/cashPosition'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FALLBACK_KRW = 1380
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /user_cash.*(does not exist|schema cache)/i.test(e.message ?? ''))

export interface CashApi extends Partial<CashPosition> { needsSetup?: boolean; asOf: string }

async function fxRate(base: string): Promise<number> {
  try {
    const r = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
    if (r.ok) { const j = await r.json(); if (typeof j.rate === 'number' && j.rate > 0) return j.rate }
  } catch { /* 폴백 */ }
  return FALLBACK_KRW
}

/** 막스 탐욕 온도(권장 현금 밴드 SSOT) — 캐시 읽기만, 실패 시 밴드 없이 비중만 */
async function marksTemp(base: string): Promise<number | null> {
  try {
    const r = await fetch(`${base}/api/marks-cycle`, { signal: AbortSignal.timeout(12_000), cache: 'no-store' })
    if (r.ok) { const j = await r.json(); if (typeof j.temp === 'number') return j.temp }
  } catch { /* graceful */ }
  return null
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: cashRow, error } = await sb.from('user_cash').select('krw,usd,memo,updated_at').eq('user_id', user.id).maybeSingle()
  if (error && isMissingTable(error)) return NextResponse.json({ needsSetup: true, asOf: new Date().toISOString() } as CashApi)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cashSig = `${cashRow?.krw ?? 0}:${cashRow?.usd ?? 0}`
  const cacheKey = `cash-position-v1:${user.id}:${kstDate()}:${fp}:${cashSig}`
  const cached = await getCache<CashApi>(cacheKey, 3 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const { data: rows } = await sb.from('investments')
    .select('ticker,name,market,currency,quantity,purchase_price').eq('user_id', user.id)

  const [usdKrw, temp] = await Promise.all([fxRate(base), marksTemp(base)])
  const assets = await evaluateAssets(rows ?? [], base, usdKrw)
  const pos = buildCashPosition(
    { krw: Number(cashRow?.krw ?? 0), usd: Number(cashRow?.usd ?? 0), memo: cashRow?.memo ?? null, updatedAt: cashRow?.updated_at ?? null },
    assets, usdKrw, temp,
  )
  const result: CashApi = { ...pos, asOf: new Date().toISOString() }
  // 평가액이 통째로 0(가격·원가 모두 실패)이면 박제 금지
  if (pos.totalKrw > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { krw?: number; usd?: number; memo?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const num = (v: unknown) => {
    const n = Number(v)
    if (!isFinite(n) || n < 0) return 0
    return Math.min(n, 1e15)   // 오타 방어(상한)
  }
  const payload = {
    user_id: user.id,
    krw: num(body.krw), usd: num(body.usd),
    memo: (body.memo ?? '').slice(0, 120) || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('user_cash').upsert(payload, { onConflict: 'user_id' })
  if (error && isMissingTable(error)) return NextResponse.json({ needsSetup: true }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
