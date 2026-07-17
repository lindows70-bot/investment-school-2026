// ⭐ 관심 단지 워치리스트 API — 주식 관심종목의 부동산판(우리 집·이사 갈 집 모니터링). RLS 본인 것만.
// GET=목록+시세 요약(매매·전세 중위 6개월, rtms 월캐시 재사용) · POST=등록 · DELETE=해제. 테이블 없으면 needsSetup 정직 반환.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache } from '@/lib/appCache'
import { rtmsTradeMonth, rtmsRentMonth, LAWD_SIDO, LAWD_REGIONS, type AptDeal } from '@/lib/rtms'

export interface ReWatchItem {
  id: number; lawd: string; apt: string; area: number | null
  regionName: string; sido: string
  saleMed6: number | null       // 최근 6개월 매매 중위(억)
  jeonseMed6: number | null     // 전세 중위(억)
  jeonseRatio: number | null    // 전세가율 %
  lastDeal: string | null       // 최근 매매 거래일(YYYY-MM-DD)
  dealsN6: number               // 6개월 매매 표본
  regionPhase: string | null    // 벌집 국면
}
export interface ReWatchApi { items: ReWatchItem[]; needsSetup?: boolean; asOf: string }

// 중위값 — re-apt·re-map과 동일 관례(짝수면 가운데 두 값 평균 = 제2원칙: 같은 단지는 어느 화면에서든 같은 중위가)
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const eok = (man: number) => Math.round(man / 1000) / 10
const ymList = (n: number) => {
  const d = new Date(Date.now() + 9 * 3600_000); const out: string[] = []
  for (let k = 0; k < n; k++) { const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1 - k; const yy = y + Math.floor((m - 1) / 12); const mm = ((m - 1) % 12 + 12) % 12 + 1; out.push(`${yy}${String(mm).padStart(2, '0')}`) }
  return out
}
const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || /re_watchlist.*(does not exist|schema cache)/i.test(e.message ?? ''))

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { data: rows, error } = await supabase.from('re_watchlist').select('id, lawd, apt, area').order('created_at')
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ items: [], needsSetup: true, asOf: new Date().toISOString() })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const entries = rows ?? []
  const yms = ymList(6)
  const keyOf = (d: AptDeal) => `${d.dong} ${d.aptNm}`.trim()

  // 벌집 국면(캐시 읽기만)
  const phases: Record<string, string> = {}
  try {
    const hc = await getCache<{ regions: { name: string; phaseName: string }[] }>('re-honeycomb-v3', 14 * 86400_000)
    for (const r of hc?.regions ?? []) phases[r.name] = r.phaseName
  } catch { /* graceful */ }

  const items: ReWatchItem[] = []
  for (const e of entries.slice(0, 10)) {   // 상한 10개(rtms 콜 보호)
    let saleMed6: number | null = null, jeonseMed6: number | null = null, lastDeal: string | null = null, dealsN6 = 0
    try {
      const [tr, rn] = await Promise.all([
        Promise.all(yms.map(ym => rtmsTradeMonth(e.lawd, ym))),
        Promise.all(yms.map(ym => rtmsRentMonth(e.lawd, ym))),
      ])
      const trades = tr.flat().filter(d => d && keyOf(d) === e.apt && (e.area == null || Math.abs(d.area - e.area) <= 2)) as AptDeal[]
      const rents = rn.flat().filter(d => d && keyOf(d) === e.apt && (d.monthlyRent ?? 0) === 0 && (e.area == null || Math.abs(d.area - e.area) <= 2)) as AptDeal[]
      dealsN6 = trades.length
      saleMed6 = med(trades.map(d => d.price!))
      jeonseMed6 = med(rents.map(d => d.deposit!))
      const latest = trades.sort((a, b) => (b.ym + String(b.day).padStart(2, '0')).localeCompare(a.ym + String(a.day).padStart(2, '0')))[0]
      if (latest) lastDeal = `${latest.ym.slice(0, 4)}-${latest.ym.slice(4)}-${String(latest.day).padStart(2, '0')}`
    } catch { /* 단지 단위 graceful */ }
    const sido = LAWD_SIDO[e.lawd.slice(0, 2)] ?? ''
    items.push({
      id: e.id, lawd: e.lawd, apt: e.apt, area: e.area,
      regionName: LAWD_REGIONS.find(r => r.lawd === e.lawd)?.name ?? e.lawd, sido,
      saleMed6: saleMed6 != null ? eok(saleMed6) : null,
      jeonseMed6: jeonseMed6 != null ? eok(jeonseMed6) : null,
      jeonseRatio: saleMed6 && jeonseMed6 ? Math.round(jeonseMed6 / saleMed6 * 1000) / 10 : null,
      lastDeal, dealsN6, regionPhase: phases[sido] ?? null,
    })
  }
  return NextResponse.json({ items, asOf: new Date().toISOString() } as ReWatchApi, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  const body = await req.json().catch(() => null) as { lawd?: string; apt?: string; area?: number | null } | null
  if (!body?.lawd || !body?.apt) return NextResponse.json({ error: 'lawd·apt 필요' }, { status: 400 })
  const { error } = await supabase.from('re_watchlist').insert({ user_id: user.id, lawd: body.lawd, apt: body.apt.slice(0, 120), area: body.area ?? null })
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ needsSetup: true }, { status: 409 })
    if (error.code === '23505') return NextResponse.json({ ok: true, dup: true })   // 이미 등록
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const lawd = url.searchParams.get('lawd'), apt = url.searchParams.get('apt')
  let q = supabase.from('re_watchlist').delete()
  if (id) q = q.eq('id', Number(id))
  else if (lawd && apt) q = q.eq('lawd', lawd).eq('apt', apt)
  else return NextResponse.json({ error: 'id 또는 lawd+apt 필요' }, { status: 400 })
  const { error } = await q
  if (error && !isMissingTable(error)) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
