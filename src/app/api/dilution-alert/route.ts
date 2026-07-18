// 🚨 DART 희석 경보 API — 보유 KR 종목의 유상증자·CB·BW·EB·감자 공시(최근 180일)를 감시
//    Phase 0 실측 반영: 종속회사/자회사 증자(모회사 희석 아님)·만기전취득/상환(오버행 축소=호재) 제외,
//    주요사항보고서(…결정) 본공시만(발행가액확정·청약결과 후속 노이즈 컷). 종목별 공유 캐시(제2원칙).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { dartJson, getCorpCode } from '@/lib/dart'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const DART_KEY = process.env.DART_API_KEY

export type DilutionType = '유상증자' | 'CB' | 'BW' | 'EB' | '감자'
export interface DilutionAlert {
  ticker: string
  name: string
  type: DilutionType
  title: string        // 공시 제목(report_nm)
  date: string         // YYYY-MM-DD(접수일)
  rcpNo: string
  recent: boolean      // 30일 이내
}
export interface DilutionResult { asOf: string; scanned: number; alerts: DilutionAlert[] }

// 본공시(결정)만 — 후속(발행가액확정·청약결과) 제외
const CORE = /주요사항보고서.*\((?:\s*)?(유상증자결정|전환사채권발행결정|신주인수권부사채권발행결정|교환사채권발행결정|감자결정)/
// 자회사 증자·만기전취득 등 비희석 제외
const EXCLUDE = /종속회사|자회사|타법인|취득|상환/
const typeOf = (nm: string): DilutionType =>
  /유상증자/.test(nm) ? '유상증자' : /전환사채/.test(nm) ? 'CB' : /신주인수권부/.test(nm) ? 'BW' : /교환사채/.test(nm) ? 'EB' : '감자'

/** 종목 1개 스캔(일별 공유 캐시) — 실패·비상장·ETF는 빈 배열 */
async function scanTicker(ticker: string, name: string): Promise<DilutionAlert[]> {
  const day = kstDate()
  const key = `dilution-v1:${ticker}:${day}`
  const cached = await getCache<DilutionAlert[]>(key, 24 * 3600_000)
  if (cached) return cached
  const cc = await getCorpCode(ticker)
  if (!cc || !DART_KEY) return []
  const end = day.replace(/-/g, '')
  const bgn = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
  const j = await dartJson(`list.json?crtfc_key=${DART_KEY}&corp_code=${cc}&bgn_de=${bgn}&end_de=${end}&page_count=100`)
  if (j?.status !== '000') {
    if (j?.status === '013') await setCache(key, [])   // 013=조회 결과 없음(정상) — 캐시로 재조회 방지
    return []
  }
  const nowMs = Date.now()
  const alerts: DilutionAlert[] = []
  for (const r of (j.list ?? []) as { report_nm?: string; rcept_dt?: string; rcept_no?: string }[]) {
    const nm = String(r.report_nm ?? '').trim()
    if (!CORE.test(nm) || EXCLUDE.test(nm)) continue
    const d = String(r.rcept_dt ?? '')
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
    alerts.push({
      ticker, name, type: typeOf(nm), title: nm, date, rcpNo: String(r.rcept_no ?? ''),
      recent: nowMs - Date.parse(date) <= 30 * 86_400_000,
    })
  }
  await setCache(key, alerts)
  return alerts
}

export async function GET() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: rows } = await sb.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const kr = new Map<string, string>()
  for (const r of rows ?? []) {
    if (r.market !== 'KR' || !/^\d{6}$/.test(r.ticker)) continue
    if (getAssetType(r.ticker, r.name ?? '', 'KR') !== 'STOCK') continue
    kr.set(r.ticker, String(r.name ?? r.ticker))
  }

  const alerts: DilutionAlert[] = []
  const queue = Array.from(kr.entries())
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const it = queue.shift(); if (!it) break
      try { alerts.push(...await scanTicker(it[0], it[1])) } catch { /* graceful */ }
    }
  }))
  alerts.sort((a, b) => b.date.localeCompare(a.date))
  // 같은 이벤트의 [기재정정] 중복 제거 — 종목×유형별 최신 1건만(실측: SK하이닉스 유상증자 결정+정정 2회 = 1이벤트)
  const seen = new Set<string>()
  const deduped = alerts.filter(a => {
    const k = `${a.ticker}:${a.type}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  return NextResponse.json({ asOf: new Date().toISOString(), scanned: kr.size, alerts: deduped } satisfies DilutionResult,
    { headers: { 'Cache-Control': 'no-store' } })
}
