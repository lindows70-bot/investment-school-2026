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
import { GICS_SECTOR_META } from '@/lib/gicsSectorMeta'
import { classifyAssetRole } from '@/lib/portfolioRole'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'
import type { ScreenedStock } from '@/lib/macroPhaseScreener'
import { splitGroups, type WLRow, type WLSchoolRow, type WLApi, type WLQuad, type WLTrend, type WLFwd } from '@/lib/winLose'
import { TK } from '@/lib/theme'

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
// 네이버 업종명 → Yahoo GICS 11 영문 섹터(키워드 매칭) — 전장 지도 sector-null 패치 전용(Yahoo가 섹터 안 주는 코스닥주 커버)
function upjongToGics(u: string | null): string | null {
  if (!u) return null
  const t = u.replace(/\s/g, '')
  const RULES: [RegExp, string][] = [
    [/반도체|디스플레이|전자장비|컴퓨터|소프트웨어|IT서비스|통신장비|핸드셋|사무용전자/, 'Technology'],
    [/게임|엔터테인먼트|미디어|방송|광고|출판|통신서비스/, 'Communication Services'],
    [/은행|증권|보험|카드|창업투자|금융|자산운용/, 'Financial Services'],
    [/제약|생물공학|바이오|건강관리|생명과학|의료/, 'Healthcare'],
    [/유틸리티|수도|전력생산/, 'Utilities'],
    [/석유|가스|에너지장비/, 'Energy'],
    [/화학|금속|광물|종이|목재|포장재/, 'Basic Materials'],
    [/부동산|리츠/, 'Real Estate'],
    [/음료|식품|담배|화장품|가정용품|개인용품/, 'Consumer Defensive'],
    [/자동차|호텔|레저|레스토랑|섬유|의류|신발|호화품|백화점|판매|소매|교육|내구소비재|가구/, 'Consumer Cyclical'],
    [/조선|기계|복합기업|건설|건축|우주항공|국방|방산|운송|항공|해운|철도|전기장비|전기제품|상업서비스|무역|물류/, 'Industrials'],
  ]
  for (const [re, sec] of RULES) if (re.test(t)) return sec
  return null
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
      stockSub.set(k, { label: m?.label ?? st.sub, emoji: m?.emoji ?? cfg.emoji, color: m?.color ?? TK.sub3, sector: cfg.label })
    }
  }
  const etfSub = new Map<string, SubLabel>()
  for (const [key, v] of Object.entries(SECTOR_ETF)) {
    const [secKey, subKey] = key.split(':')
    const cfg = SECTORS[secKey]
    const m = subKey && cfg ? cfg.subMeta[subKey] : null
    const label: SubLabel = { label: m?.label ?? cfg?.label ?? key, emoji: m?.emoji ?? cfg?.emoji ?? '📦', color: m?.color ?? TK.sub3, sector: cfg?.label ?? '' }
    if (v.us && !etfSub.has(`US:${v.us.t}`)) etfSub.set(`US:${v.us.t}`, label)
    if (v.kr && !etfSub.has(`KR:${v.kr.t}`)) etfSub.set(`KR:${v.kr.t}`, label)
  }
  return { stockSub, etfSub }
}

// ── 최종 라벨 폴백 3종 ────────────────────────────────────────────
// ETF: portfolioRole(SSOT) — 광의지수/채권/레버리지/테마 구분
function etfRoleLabel(ticker: string, name: string, market: string): SubLabel {
  const r = classifyAssetRole(ticker, name, market)
  if (r.role === 'CORE_INDEX') return { label: '광의지수 ETF', emoji: '📈', color: TK.blue400, sector: 'ROLE' }
  if (r.role === 'CORE_BOND') return { label: '채권 ETF', emoji: '📜', color: TK.slate400, sector: 'ROLE' }
  if (r.role === 'BLOCKED') return { label: '레버리지·고위험', emoji: '⚠️', color: TK.red400, sector: 'ROLE' }
  return { label: '테마·기타 ETF', emoji: '📦', color: TK.sub3, sector: 'ROLE' }
}
// KR 주식: 네이버 업종코드→업종명 맵(목록 페이지 1콜·EUC-KR·7일 캐시) — Yahoo가 섹터를 안 주는 코스닥주 커버
async function naverUpjongMap(): Promise<Map<string, string>> {
  const cached = await getCache<Record<string, string>>('naver-upjong-map-v1', 7 * 24 * 3600_000)
  if (cached) return new Map(Object.entries(cached))
  try {
    const r = await fetch('https://finance.naver.com/sise/sise_group.naver?type=upjong', { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = new TextDecoder('euc-kr').decode(Buffer.from(await r.arrayBuffer()))
    const m = Array.from(html.matchAll(/no=(\d+)"[^>]*>([^<]+)</g))
    if (m.length < 30) return new Map()
    const obj: Record<string, string> = {}
    for (const x of m) obj[x[1]] = x[2].trim()
    await setCache('naver-upjong-map-v1', obj)
    return new Map(Object.entries(obj))
  } catch { return new Map() }
}
const NAVER_UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', Referer: 'https://m.stock.naver.com/' }
async function krIndustryOf(code: string, upjong: Map<string, string>): Promise<string | null> {
  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, { headers: NAVER_UA })
    if (!r.ok) return null
    const j = await r.json()
    const ic = j?.industryCode != null ? String(j.industryCode) : null
    return ic ? upjong.get(ic) ?? null : null
  } catch { return null }
}

// Supabase service-role — Next Data Cache 박제 방지 no-store 강제(appCache 교훈)
const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { auth: { persistSession: false }, global: { fetch: (u: any, o: any) => fetch(u, { ...o, cache: 'no-store' }) } },
)

interface Px { ret1w: number | null; ret1m: number | null; ret3m: number | null; pos52: number | null; mom12: number | null; volAdj: number | null; closes: number[] }
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
      // 🏃 12-1 모멘텀(최근 21봉=1개월 제외 12개월 수익률) + ⚖️ 변동성 조정(연율화 σ로 표준화) — 252봉 미만(신규상장)은 null 정직
      let mom12: number | null = null, volAdj: number | null = null
      if (c.length >= 252) {
        const pEnd = at(21), pStart = at(252)
        if (pStart > 0) mom12 = (pEnd / pStart - 1) * 100
        const rets: number[] = []
        for (let i = c.length - 251; i < c.length; i++) if (c[i - 1] > 0) rets.push(c[i] / c[i - 1] - 1)
        if (mom12 != null && rets.length >= 200) {
          const mean = rets.reduce((a, b) => a + b, 0) / rets.length
          const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * Math.sqrt(252) * 100
          if (sd > 0) volAdj = Math.round(mom12 / sd * 100) / 100
        }
        if (mom12 != null) mom12 = Math.round(mom12 * 10) / 10
      }
      return {
        ret1w: pct(at(5)), ret1m: pct(at(21)), ret3m: pct(at(63)),
        pos52: hi > lo ? ((last - lo) / (hi - lo)) * 100 : null, mom12, volAdj, closes: c,
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

export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const cacheKey = `win-lose-v8:${kstDate()}`   // v8: 🏃 12-1 모멘텀·⚖️ 변동성 조정 모멘텀 요인 + ⚠️ 모멘텀 크래시 국면 판정(추가 fetch 0)
  const cached = await getCache<WLApi>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 유니버스 — 스크리너 캐시(주간 크론이 적재한 ScreenedStock 전체)
  const screened = (await getCache<ScreenedStock[]>('macro-screened-universe:v9', 8 * 24 * 3600_000)) ?? []
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
    // 스크리너는 섹터 미상을 null이 아닌 '—'/'기타'로도 저장 — 유효 GICS 11만 인정, 나머지는 null로 정규화해 ⑥½ 패치 대상에 포함
    const sector = s?.sector && SECTOR_TO_ROT[s.sector] ? s.sector : null
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
      mom12: px.mom12, volAdj: px.volAdj,
    })
  }

  // ⑥½ 섹터 미분류 패치 — Yahoo가 섹터 안 주는 코스닥주·유니버스 밖 보유 주식의 sector-null 행 보강.
  //     KR=네이버 업종(industryCode→업종명)→GICS 키워드 매핑 / US=Yahoo assetProfile 직접(소수라 부담 0). 실패 시 미분류 유지(정직).
  const noSec = rows.filter(r => !r.sector)
  if (noSec.length) {
    const upjong = noSec.some(r => r.market === 'KR') ? await naverUpjongMap() : new Map<string, string>()
    for (let i = 0; i < noSec.length; i += 6) {
      await Promise.all(noSec.slice(i, i + 6).map(async (r) => {
        try {
          const sec = r.market === 'KR'
            ? upjongToGics(await krIndustryOf(r.ticker, upjong))
            : ((await yf.quoteSummary(r.ticker, { modules: ['assetProfile'] }))?.assetProfile?.sector ?? null)
          if (!sec) return
          r.sector = sec
          const rot = rotBySector ? rotBySector.get(SECTOR_TO_ROT[sec] ?? '') ?? null : null
          r.rotQuad = rot?.q ?? null
          r.rotScore = rot?.score ?? null
        } catch { /* 미분류 유지 */ }
      }))
    }
  }

  // ⑦ 🏫 학교 보유 승패 보드(주식+ETF+코인 전부) — 소섹터 라벨 역매핑
  const { stockSub, etfSub } = buildSubMaps()
  const school: WLSchoolRow[] = []
  for (const h of holdings) {
    const k = normKey(h.market, h.ticker)
    const px = pxMap.get(k)
    const s = h.market !== 'CRYPTO' ? byKey.get(k) ?? null : null
    // 라벨 폴백 체인: 소섹터(테마 우선) → GICS 대섹터(스크리너 sector) → ETF는 portfolioRole → 주식은 아래 후처리(업종)
    const gics = s?.sector ? GICS_SECTOR_META[s.sector] : null
    const sub = h.market === 'CRYPTO'
      ? { label: '암호화폐', emoji: '🪙', color: TK.amber500, sector: '코인' }
      : (h.assetType === 'STOCK' ? stockSub.get(k) : etfSub.get(k))
        ?? (gics ? { label: gics.ko, emoji: gics.icon, color: gics.color, sector: 'GICS' } : null)
        ?? (h.assetType === 'ETF' ? etfRoleLabel(h.ticker, h.name, h.market) : null)
    school.push({
      ticker: h.market === 'KR' ? code6(h.ticker) : h.ticker.toUpperCase(),
      name: h.name, market: h.market, assetType: h.assetType,
      ret1w: px?.ret1w ?? null, ret1m: px?.ret1m ?? null, ret3m: px?.ret3m ?? null,
      pos52: px?.pos52 ?? null,
      trend: s?.priceTrend && s.priceTrend !== 'unknown' ? (s.priceTrend as WLTrend) : (px ? trendFromCloses(px.closes) : 'unknown'),
      sub,
    })
  }
  // 남은 무라벨 주식 최종 폴백 — US=canonical 업종(한글·canon-fund 공유 캐시) / KR=네이버 업종(industryCode→업종명). 소수라 부담 0
  const bare = school.filter(r => !r.sub && r.assetType === 'STOCK')
  if (bare.length) {
    const upjong = await naverUpjongMap()
    for (let i = 0; i < bare.length; i += 6) {
      await Promise.all(bare.slice(i, i + 6).map(async (r) => {
        try {
          const label = r.market === 'KR'
            ? await krIndustryOf(r.ticker, upjong)
            : ((await getCanonicalFundamentals(r.ticker, r.market, origin))?.sector ?? null)
          if (label && label !== '기타') r.sub = { label, emoji: '🏷️', color: TK.slate400, sector: '업종' }
        } catch { /* 라벨 없이 유지(정직) */ }
      }))
    }
  }

  school.sort((a, b) => (b.ret1m ?? -999) - (a.ret1m ?? -999))

  // ⚠️ 모멘텀 크래시 국면 판정(Daniel-Moskowitz 2016) — 1개월 기준 '패자'의 12-1 모멘텀이 '승자'보다 뚜렷이 높으면(≥10%p 역전)
  //    지금 오르는 건 낙폭과대(12개월 패자)라는 뜻 = 반등 장에서 모멘텀 추격이 무너지는 국면. 결정론·관측(점수 미반영).
  const { win: w1, lose: l1 } = splitGroups(rows, '1m')
  const momAvg = (a: WLRow[]) => { const v = a.map(r => r.mom12).filter((x): x is number => x != null); return v.length ? v.reduce((s, b) => s + b, 0) / v.length : null }
  const wm = momAvg(w1), lm = momAvg(l1)
  const momCrash = wm != null && lm != null && w1.length >= 10 && l1.length >= 10 && lm - wm >= 10

  const result: WLApi = {
    rows, school, asOf: new Date().toISOString(), total: merged.length,
    rotJoined: rows.filter(r => r.rotQuad != null).length, momCrash,
  }
  // 성공률 60% 미만이면 캐시 박제 금지(부분실패 방지 — 앱 공통 원칙)
  if (rows.length >= merged.length * 0.6) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
