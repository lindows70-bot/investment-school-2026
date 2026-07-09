// 🔔 타점 전환 워처 크론 — 전 학생 보유 종목(KR/US)의 타점 신호등을 매일 스캔해 전일 대비 전환(🟡→🟢 돌파 / →🔴 이탈) 감지
//    매일 08:30 KST(미 장 마감 후·한국 개장 전). "기다리는 것도 전략"이 실제로 작동하게 만드는 마감재.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { getEntryTimings, type TimingLight } from '@/lib/entryTiming'

interface WatchSnap { date: string; snap: Record<string, TimingLight | null>; names: Record<string, string> }
export interface WatchChange { ticker: string; name: string; market: 'KR' | 'US'; from: TimingLight; to: TimingLight }
export interface WatchResult { asOf: string; prevDate: string | null; scanned: number; changes: WatchChange[] }

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const LABEL: Record<TimingLight, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

export async function GET(req: Request) {
  // CRON_SECRET 설정 시 검증(기존 크론 패턴)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: rows, error } = await admin.from('investments').select('ticker,name,market')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 전 학생 보유 KR/US 종목 dedup(크립토 제외 — 캔들 미지원)
  const uniq = new Map<string, { ticker: string; name: string; market: 'KR' | 'US' }>()
  for (const r of rows ?? []) {
    const mkt = String(r.market ?? '').toUpperCase()
    if (mkt !== 'KR' && mkt !== 'US') continue
    if (getAssetType(r.ticker, r.name, mkt) === 'CRYPTO') continue
    uniq.set(`${r.ticker}:${mkt}`, { ticker: String(r.ticker), name: String(r.name ?? r.ticker), market: mkt as 'KR' | 'US' })
  }
  const list = Array.from(uniq.values())

  const tmap = await getEntryTimings(list, 4)
  const snap: Record<string, TimingLight | null> = {}
  const names: Record<string, string> = {}
  for (const it of list) {
    const key = `${it.ticker}:${it.market}`
    snap[key] = tmap.get(key)?.light ?? null
    names[key] = it.name
  }

  // 전일 스냅과 비교 → 전환 감지(같은 날 재실행이면 비교 스킵·스냅만 갱신)
  const prev = await getCache<WatchSnap>('timing-watch-latest', 7 * 86400_000)
  const today = kstDate()
  const changes: WatchChange[] = []
  if (prev && prev.date !== today) {
    for (const key of Object.keys(snap)) {
      const from = prev.snap[key], to = snap[key]
      if (from && to && from !== to) {
        const [ticker, market] = key.split(':')
        changes.push({ ticker, name: names[key] ?? ticker, market: market as 'KR' | 'US', from, to })
      }
    }
    // 🟢 승급(돌파) 먼저, 🔴 강등(이탈) 다음
    const rank = (c: WatchChange) => c.to === 'green' ? 0 : c.to === 'red' ? 1 : 2
    changes.sort((a, b) => rank(a) - rank(b))
    await setCache('timing-watch-changes', { asOf: new Date().toISOString(), prevDate: prev.date, scanned: list.length, changes } satisfies WatchResult)
  }
  await setCache('timing-watch-latest', { date: today, snap, names } satisfies WatchSnap)

  return NextResponse.json({
    ok: true, scanned: list.length, resolved: Object.values(snap).filter(v => v != null).length,
    prevDate: prev?.date ?? null, changes: changes.map(c => `${c.name} ${LABEL[c.from]}→${LABEL[c.to]}`),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
