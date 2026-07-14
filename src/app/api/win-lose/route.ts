// ⚔️ 승패 해부실 데이터 조립 — 유니버스(스크리너 514 + 학교 보유 합집합)의 최근 수익률·특성을 하루 1회 계산.
//   신규 판정기 0: 펀더·추세·EPS방향 = macro-screened-universe 캐시(ScreenedStock SSOT) 재사용,
//   섹터 국면 = sector-rotation 캐시 읽기만(콜드면 null graceful), 수익률·52주 위치만 Yahoo 차트 신규 계산(알파헌터 선례).
//   프라이버시: 학교 보유 종목은 유니버스에 섞되 '보유' 표식 없음(단독보유 노출 차단) — '내 보유'는 클라(RLS)에서만.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import type { ScreenedStock } from '@/lib/macroPhaseScreener'
import type { WLRow, WLApi, WLQuad, WLTrend, WLFwd } from '@/lib/winLose'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '')

// Yahoo GICS 섹터명 → 로테이션 시계 키(GICS 11만) — unified-reco와 동일 맵(제2원칙)
const SECTOR_TO_ROT: Record<string, string> = {
  'Technology': 'infotech', 'Financial Services': 'financials', 'Healthcare': 'healthcare',
  'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Energy': 'energy',
  'Industrials': 'industrials', 'Basic Materials': 'materials', 'Communication Services': 'communication',
  'Utilities': 'utilities', 'Real Estate': 'realestate',
}
type RotLite = { items?: { key: string; quadrant: WLQuad; score: number }[] }

// Supabase service-role — Next Data Cache 박제 방지 no-store 강제(appCache 교훈)
const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { auth: { persistSession: false }, global: { fetch: (u: any, o: any) => fetch(u, { ...o, cache: 'no-store' }) } },
)

interface Px { ret1w: number | null; ret1m: number | null; ret3m: number | null; pos52: number | null; closes: number[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPx(yf: any, ticker: string, market: 'US' | 'KR'): Promise<Px | null> {
  const syms = market === 'KR' ? [`${code6(ticker)}.KS`, `${code6(ticker)}.KQ`] : [ticker]
  for (const sym of syms) {
    try {
      const r = await yf.chart(sym, { period1: new Date(Date.now() - 400 * 86_400_000), interval: '1d' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: number[] = (r?.quotes || []).filter((x: any) => x?.close != null).map((x: any) => x.close as number)
      if (c.length < 60) continue
      const last = c[c.length - 1]
      const at = (n: number) => c[c.length - 1 - n] ?? c[0]
      const pct = (base: number) => (base ? (last / base - 1) * 100 : null)
      const w = c.slice(-252)
      const hi = Math.max(...w), lo = Math.min(...w)
      return {
        ret1w: pct(at(5)), ret1m: pct(at(21)), ret3m: pct(at(63)),
        pos52: hi > lo ? ((last - lo) / (hi - lo)) * 100 : null, closes: c,
      }
    } catch { /* 다음 심볼 */ }
  }
  return null
}

// 유니버스 밖 보유 종목용 추세 폴백 — priceTrendKnife(SSOT)와 동일한 50·200일선 정렬 철학(캔들 재사용·추가 fetch 0)
function trendFromCloses(c: number[]): WLTrend {
  if (c.length < 200) return 'unknown'
  const last = c[c.length - 1]
  const sma = (n: number) => c.slice(-n).reduce((a, b) => a + b, 0) / n
  const ma50 = sma(50), ma200 = sma(200)
  if (last > ma50 && ma50 > ma200) return 'up'
  if (last < ma50 && ma50 < ma200) return 'down'
  return 'side'
}

export async function GET() {
  const cacheKey = `win-lose-v1:${kstDate()}`
  const cached = await getCache<WLApi>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 유니버스 — 스크리너 캐시(주간 크론이 적재한 ScreenedStock 전체)
  const screened = (await getCache<ScreenedStock[]>('macro-screened-universe:v7', 8 * 24 * 3600_000)) ?? []
  const byKey = new Map<string, ScreenedStock>()
  for (const s of screened) byKey.set(`${s.market}:${s.market === 'KR' ? code6(s.ticker) : s.ticker.toUpperCase()}`, s)

  // ② 학교 보유 합집합(개별주식만) — 유니버스에 없는 종목 추가(표식 없이)
  const merged: { ticker: string; name: string; market: 'US' | 'KR'; s: ScreenedStock | null }[] = []
  const added = new Set<string>()
  for (const s of screened) {
    const k = `${s.market}:${s.market === 'KR' ? code6(s.ticker) : s.ticker.toUpperCase()}`
    if (added.has(k)) continue
    added.add(k); merged.push({ ticker: s.ticker, name: s.name, market: s.market, s })
  }
  try {
    const { data } = await admin().from('investments').select('ticker,name,market')
    for (const inv of data ?? []) {
      if (inv.market !== 'US' && inv.market !== 'KR') continue
      if (getAssetType(inv.ticker, inv.name ?? '', inv.market) !== 'STOCK') continue
      const k = `${inv.market}:${inv.market === 'KR' ? code6(inv.ticker) : inv.ticker.toUpperCase()}`
      if (added.has(k)) continue
      added.add(k); merged.push({ ticker: inv.ticker, name: inv.name ?? inv.ticker, market: inv.market, s: null })
    }
  } catch { /* 보유 조회 실패해도 유니버스만으로 진행 */ }

  // ③ 섹터 로테이션 국면(v11·최근 3일 캐시 읽기만 — 콜드면 null graceful)
  let rotBySector: Map<string, { q: WLQuad; score: number }> | null = null
  for (let d = 0; d < 3 && !rotBySector; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    const rot = await getCache<RotLite>(`sector-rotation-v11:${dt}`, 3 * 24 * 3600_000)
    if (rot?.items?.length) rotBySector = new Map(rot.items.map(i => [i.key, { q: i.quadrant, score: i.score }]))
  }

  // ④ 종목별 수익률(Yahoo 차트·동시성 8) + 행 조립
  const { default: YF } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'], validation: { logErrors: false } })
  const rows: WLRow[] = []
  const CONC = 8
  for (let i = 0; i < merged.length; i += CONC) {
    const batch = merged.slice(i, i + CONC)
    const rs = await Promise.all(batch.map(async (m) => {
      const px = await fetchPx(yf, m.ticker, m.market)
      if (!px || px.ret1m == null) return null
      const s = m.s
      const sector = s?.sector ?? null
      const rot = sector && rotBySector ? rotBySector.get(SECTOR_TO_ROT[sector] ?? '') ?? null : null
      return {
        ticker: m.market === 'KR' ? code6(m.ticker) : m.ticker.toUpperCase(),
        name: m.name, market: m.market,
        ret1w: px.ret1w, ret1m: px.ret1m, ret3m: px.ret3m, pos52: px.pos52,
        trend: (s?.priceTrend as WLTrend | undefined) && s?.priceTrend !== 'unknown' ? (s!.priceTrend as WLTrend) : trendFromCloses(px.closes),
        fwd: (s?.fwdEpsDir ?? 'unknown') as WLFwd,
        peg: s?.peg ?? null, opMargin: s?.opMargin ?? null, sector,
        rotQuad: rot?.q ?? null, rotScore: rot?.score ?? null,
        knife: s?.knife ?? false,
      } satisfies WLRow
    }))
    for (const r of rs) if (r) rows.push(r)
  }

  const result: WLApi = {
    rows, asOf: new Date().toISOString(), total: merged.length,
    rotJoined: rows.filter(r => r.rotQuad != null).length,
  }
  // 성공률 60% 미만이면 캐시 박제 금지(부분실패 방지 — 앱 공통 원칙)
  if (rows.length >= merged.length * 0.6) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
