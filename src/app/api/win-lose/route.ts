// ⚔️ 승패 해부실 데이터 조립 — 유니버스(스크리너 514 + 학교 보유 합집합)의 최근 수익률·특성을 하루 1회 계산.
//   신규 판정기 0: 펀더·추세·EPS방향 = macro-screened-universe 캐시(ScreenedStock SSOT) 재사용,
//   섹터 국면 = sector-rotation 캐시 읽기만(콜드면 null graceful), 수익률·52주 위치만 Yahoo 차트 신규 계산(알파헌터 선례).
//   🏫 school = 학생 전체 보유(주식+ETF+코인) 승패 보드 — 소섹터 라벨은 sectorConfigs 역매핑(테마 우선→GICS→ETF맵).
//   프라이버시: 보유자·인원수 절대 미포함(개인 식별 차단) — '내 보유'는 클라(RLS)에서만.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { SECTORS, SECTOR_ETF } from '@/lib/sectorConfigs'
import type { ScreenedStock } from '@/lib/macroPhaseScreener'
import type { WLRow, WLSchoolRow, WLApi, WLQuad, WLTrend, WLFwd } from '@/lib/winLose'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '')
const normKey = (market: string, ticker: string) => `${market}:${market === 'KR' ? code6(ticker) : ticker.toUpperCase()}`

// Yahoo GICS 섹터명 → 로테이션 시계 키(GICS 11만) — unified-reco와 동일 맵(제2원칙)
const SECTOR_TO_ROT: Record<string, string> = {
  'Technology': 'infotech', 'Financial Services': 'financials', 'Healthcare': 'healthcare',
  'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Energy': 'energy',
  'Industrials': 'industrials', 'Basic Materials': 'materials', 'Communication Services': 'communication',
  'Utilities': 'utilities', 'Real Estate': 'realestate',
}
type RotLite = { items?: { key: string; quadrant: WLQuad; score: number }[] }
type SubLabel = { label: string; emoji: string; color: string; sector: string }

// ── 소섹터 라벨 역매핑(정적 config → 1회 빌드) ─────────────────────
//    개별주: SECTORS 등록순 = 테마 6개 먼저 → GICS 11 — 첫 매칭 우선이라 테마 라벨(더 구체적)이 자연 우선.
//    ETF: SECTOR_ETF(소섹터→대표 ETF)를 역으로 뒤집어 ETF 티커 → 소섹터 라벨.
function buildSubMaps(): { stockSub: Map<string, SubLabel>; etfSub: Map<string, SubLabel> } {
  const stockSub = new Map<string, SubLabel>()
  for (const cfg of Object.values(SECTORS)) {
    for (const st of cfg.stocks) {
      if (st.market !== 'US' && st.market !== 'KR') continue
      const k = normKey(st.market, st.ticker)
      if (stockSub.has(k)) continue
      const m = cfg.subMeta[st.sub]
      stockSub.set(k, { label: m?.label ?? st.sub, emoji: m?.emoji ?? cfg.emoji, color: m?.color ?? '#8599ae', sector: cfg.label })
    }
  }
  const etfSub = new Map<string, SubLabel>()
  for (const [key, v] of Object.entries(SECTOR_ETF)) {
    const [secKey, subKey] = key.split(':')
    const cfg = SECTORS[secKey]
    const m = subKey && cfg ? cfg.subMeta[subKey] : null
    const label: SubLabel = { label: m?.label ?? cfg?.label ?? key, emoji: m?.emoji ?? cfg?.emoji ?? '📦', color: m?.color ?? '#8599ae', sector: cfg?.label ?? '' }
    if (v.us && !etfSub.has(`US:${v.us.t}`)) etfSub.set(`US:${v.us.t}`, label)
    if (v.kr && !etfSub.has(`KR:${v.kr.t}`)) etfSub.set(`KR:${v.kr.t}`, label)
  }
  return { stockSub, etfSub }
}

// Supabase service-role — Next Data Cache 박제 방지 no-store 강제(appCache 교훈)
const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { auth: { persistSession: false }, global: { fetch: (u: any, o: any) => fetch(u, { ...o, cache: 'no-store' }) } },
)

interface Px { ret1w: number | null; ret1m: number | null; ret3m: number | null; pos52: number | null; closes: number[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPx(yf: any, ticker: string, market: 'US' | 'KR' | 'CRYPTO'): Promise<Px | null> {
  const syms = market === 'KR' ? [`${code6(ticker)}.KS`, `${code6(ticker)}.KQ`]
    : market === 'CRYPTO' ? [`${ticker.toUpperCase()}-USD`] : [ticker]
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

// 유니버스 밖 종목용 추세 폴백 — priceTrendKnife(SSOT)와 동일한 50·200일선 정렬 철학(캔들 재사용·추가 fetch 0)
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
  const cacheKey = `win-lose-v2:${kstDate()}`   // v2: 🏫 school(학교 보유 승패 보드 — ETF·코인 포함) 추가
  const cached = await getCache<WLApi>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 유니버스 — 스크리너 캐시(주간 크론이 적재한 ScreenedStock 전체)
  const screened = (await getCache<ScreenedStock[]>('macro-screened-universe:v7', 8 * 24 * 3600_000)) ?? []
  const byKey = new Map<string, ScreenedStock>()
  for (const s of screened) byKey.set(normKey(s.market, s.ticker), s)

  // ② 학교 보유 전체(주식+ETF+코인·중복 제거) — 승패 보드 + 유니버스 보강
  type Holding = { ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO'; assetType: WLSchoolRow['assetType'] }
  const holdings: Holding[] = []
  try {
    const { data } = await admin().from('investments').select('ticker,name,market')
    const seen = new Set<string>()
    for (const inv of data ?? []) {
      if (inv.market !== 'US' && inv.market !== 'KR' && inv.market !== 'CRYPTO') continue
      const k = normKey(inv.market, inv.ticker)
      if (seen.has(k)) continue
      seen.add(k)
      holdings.push({ ticker: inv.ticker, name: inv.name ?? inv.ticker, market: inv.market, assetType: getAssetType(inv.ticker, inv.name ?? '', inv.market) as WLSchoolRow['assetType'] })
    }
  } catch { /* 보유 조회 실패해도 유니버스만으로 진행 */ }

  // ③ 통계 유니버스(개별주식만) = 스크리너 + 유니버스 밖 보유 주식
  const merged: { ticker: string; name: string; market: 'US' | 'KR'; s: ScreenedStock | null }[] = []
  const added = new Set<string>()
  for (const s of screened) {
    const k = normKey(s.market, s.ticker)
    if (added.has(k)) continue
    added.add(k); merged.push({ ticker: s.ticker, name: s.name, market: s.market, s })
  }
  for (const h of holdings) {
    if (h.market === 'CRYPTO' || h.assetType !== 'STOCK') continue
    const k = normKey(h.market, h.ticker)
    if (added.has(k)) continue
    added.add(k); merged.push({ ticker: h.ticker, name: h.name, market: h.market, s: null })
  }

  // ④ 섹터 로테이션 국면(v11·최근 3일 캐시 읽기만 — 콜드면 null graceful)
  let rotBySector: Map<string, { q: WLQuad; score: number }> | null = null
  for (let d = 0; d < 3 && !rotBySector; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    const rot = await getCache<RotLite>(`sector-rotation-v11:${dt}`, 3 * 24 * 3600_000)
    if (rot?.items?.length) rotBySector = new Map(rot.items.map(i => [i.key, { q: i.quadrant, score: i.score }]))
  }

  // ⑤ 가격 일괄 수집(유니버스∪보유, 중복 fetch 0) — Yahoo 차트 동시성 8
  const { default: YF } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'], validation: { logErrors: false } })
  const targets = new Map<string, { ticker: string; market: 'US' | 'KR' | 'CRYPTO' }>()
  for (const m of merged) targets.set(normKey(m.market, m.ticker), { ticker: m.ticker, market: m.market })
  for (const h of holdings) { const k = normKey(h.market, h.ticker); if (!targets.has(k)) targets.set(k, { ticker: h.ticker, market: h.market }) }
  const pxMap = new Map<string, Px | null>()
  const entries = Array.from(targets.entries())
  const CONC = 8
  for (let i = 0; i < entries.length; i += CONC) {
    const batch = entries.slice(i, i + CONC)
    const rs = await Promise.all(batch.map(async ([k, t]) => [k, await fetchPx(yf, t.ticker, t.market)] as const))
    for (const [k, px] of rs) pxMap.set(k, px)
  }

  // ⑥ 통계 행(개별주식 유니버스)
  const rows: WLRow[] = []
  for (const m of merged) {
    const px = pxMap.get(normKey(m.market, m.ticker))
    if (!px || px.ret1m == null) continue
    const s = m.s
    const sector = s?.sector ?? null
    const rot = sector && rotBySector ? rotBySector.get(SECTOR_TO_ROT[sector] ?? '') ?? null : null
    rows.push({
      ticker: m.market === 'KR' ? code6(m.ticker) : m.ticker.toUpperCase(),
      name: m.name, market: m.market,
      ret1w: px.ret1w, ret1m: px.ret1m, ret3m: px.ret3m, pos52: px.pos52,
      trend: s?.priceTrend && s.priceTrend !== 'unknown' ? (s.priceTrend as WLTrend) : trendFromCloses(px.closes),
      fwd: (s?.fwdEpsDir ?? 'unknown') as WLFwd,
      peg: s?.peg ?? null, opMargin: s?.opMargin ?? null, sector,
      rotQuad: rot?.q ?? null, rotScore: rot?.score ?? null,
      knife: s?.knife ?? false,
    })
  }

  // ⑦ 🏫 학교 보유 승패 보드(주식+ETF+코인 전부) — 소섹터 라벨 역매핑
  const { stockSub, etfSub } = buildSubMaps()
  const school: WLSchoolRow[] = []
  for (const h of holdings) {
    const k = normKey(h.market, h.ticker)
    const px = pxMap.get(k)
    const s = h.market !== 'CRYPTO' ? byKey.get(k) ?? null : null
    const sub = h.market === 'CRYPTO'
      ? { label: '암호화폐', emoji: '🪙', color: '#f59e0b', sector: '코인' }
      : (h.assetType === 'STOCK' ? stockSub.get(k) : etfSub.get(k)) ?? null
    school.push({
      ticker: h.market === 'KR' ? code6(h.ticker) : h.ticker.toUpperCase(),
      name: h.name, market: h.market, assetType: h.assetType,
      ret1w: px?.ret1w ?? null, ret1m: px?.ret1m ?? null, ret3m: px?.ret3m ?? null,
      pos52: px?.pos52 ?? null,
      trend: s?.priceTrend && s.priceTrend !== 'unknown' ? (s.priceTrend as WLTrend) : (px ? trendFromCloses(px.closes) : 'unknown'),
      sub,
    })
  }
  school.sort((a, b) => (b.ret1m ?? -999) - (a.ret1m ?? -999))

  const result: WLApi = {
    rows, school, asOf: new Date().toISOString(), total: merged.length,
    rotJoined: rows.filter(r => r.rotQuad != null).length,
  }
  // 성공률 60% 미만이면 캐시 박제 금지(부분실패 방지 — 앱 공통 원칙)
  if (rows.length >= merged.length * 0.6) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
