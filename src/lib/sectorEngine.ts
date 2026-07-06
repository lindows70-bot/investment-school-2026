// 🧬 테마·섹터 분석 제네릭 엔진 — 주봉 수익률·대장주 베타·서브섹터 집계·테마지수/MDD·실적 D-day·미니차트
// 여러 섹터(양자·AI반도체·…)가 공유. 섹터별 차이는 SectorConfig(유니버스+서브섹터+앵커+옵션 패널)로만 표현.
import type { QMarket } from '@/lib/quantumUniverse'

export type { QMarket }

export interface SectorStock {
  ticker: string
  name: string
  market: QMarket
  yahoo?: string            // 해외는 Yahoo 심볼(.T/.PA/.L/.SS/.V)
  sub: string               // 서브섹터 키
  purePlay: boolean         // 순수주(테마 매출 비중 큼) vs 대형주(다각화·비중 희석)
  tags?: string[]           // 모달리티/역할 등(섹터별 의미)
  govAwardUsdM?: number     // 정책 보조금($M)
  note: string
}
export interface SubMeta { label: string; emoji: string; color: string; desc: string }
export interface PolicyAward { name: string; modality: string; usdM: number; cap?: boolean; listed?: string; structure: string }
export interface PreIpoCompany { name: string; modality: string; govAwardUsdM?: number; proxy: { ticker: string; name: string }[]; note: string }

export interface SectorConfig {
  key: string
  label: string
  emoji: string
  tagline: string           // 한 줄 철학(가드레일)
  anchor: string            // 대장주 티커(베타·상관 기준)
  tagHeader: string         // 태그 컬럼 헤더('모달리티'·'역할' 등)
  subMeta: Record<string, SubMeta>
  stocks: SectorStock[]
  overlayTickers: string[]  // 테마 오버레이 차트 대장주
  policy?: PolicyAward[]
  preIpo?: PreIpoCompany[]
}

// ── 주봉 수집 ──────────────────────────────────────────────────────────────────
async function fetchUsWeekly(ticker: string): Promise<number[]> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1wk`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
    const cl = Array.isArray(q) ? q.filter((c: number | null): c is number => typeof c === 'number' && c > 0) : []
    // Yahoo 주봉 '진행중 현재주' 중복 트레일링 바 제거(1주 수익률 0% 버그)
    if (cl.length >= 2 && cl[cl.length - 1] === cl[cl.length - 2]) cl.pop()
    return cl
  } catch { return [] }
}
async function fetchKrWeekly(code: string): Promise<number[]> {
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=week&count=110&requestType=0`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const xml = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
    const out: number[] = []
    for (const m of Array.from(xml.matchAll(/data="([^"]+)"/g))) {
      const c = Number(m[1].split('|')[4]); if (isFinite(c) && c > 0) out.push(c)
    }
    return out
  } catch { return [] }
}
const fetchWeekly = (s: SectorStock) => s.yahoo ? fetchUsWeekly(s.yahoo) : s.market === 'KR' ? fetchKrWeekly(s.ticker) : fetchUsWeekly(s.ticker)

// ── 통계 ──────────────────────────────────────────────────────────────────────
const retPct = (w: number[], back: number): number | null => {
  if (w.length < back + 1) return null
  const past = w[w.length - 1 - back], now = w[w.length - 1]
  return past > 0 ? Math.round((now / past - 1) * 1000) / 10 : null
}
const weeklyRets = (w: number[]): number[] => w.slice(1).map((c, i) => w[i] > 0 ? c / w[i] - 1 : 0)
function betaCorr(stockW: number[], anchorW: number[]): { beta: number | null; corr: number | null } {
  const rs = weeklyRets(stockW), ra = weeklyRets(anchorW)
  const n = Math.min(rs.length, ra.length, 52)
  if (n < 12) return { beta: null, corr: null }
  const S = rs.slice(-n), A = ra.slice(-n)
  const mS = S.reduce((a, b) => a + b, 0) / n, mA = A.reduce((a, b) => a + b, 0) / n
  let cov = 0, vA = 0, vS = 0
  for (let i = 0; i < n; i++) { const ds = S[i] - mS, da = A[i] - mA; cov += ds * da; vA += da * da; vS += ds * ds }
  if (vA === 0 || vS === 0) return { beta: null, corr: null }
  return { beta: Math.round((cov / vA) * 100) / 100, corr: Math.round((cov / Math.sqrt(vA * vS)) * 100) / 100 }
}
const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

// 📅 실적일(ms) — Yahoo quoteSummary calendarEvents. KR은 null
async function fetchEarnings(stocks: SectorStock[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    await Promise.all(stocks.filter(s => s.market !== 'KR').map(async s => {
      try {
        const qs = await yf.quoteSummary(s.yahoo ?? s.ticker, { modules: ['calendarEvents'] }, { validateResult: false })
        const ed = qs?.calendarEvents?.earnings?.earningsDate
        const d = Array.isArray(ed) && ed.length ? ed[0] : null
        const ms = d ? new Date(d).getTime() : NaN
        if (isFinite(ms)) out.set(s.ticker, ms)
      } catch { /* skip */ }
    }))
  } catch { /* graceful */ }
  return out
}

// ── 출력 타입 ──────────────────────────────────────────────────────────────────
export interface SectorStockOut {
  ticker: string; name: string; market: QMarket; sub: string; tags: string[]; purePlay: boolean
  govAwardUsdM?: number; note: string
  ret1w: number | null; ret1m: number | null; ret1y: number | null
  beta: number | null; corr: number | null
  earningsTs: number | null; spark: number[]; weeks: number   // 주봉 개수(신규상장 판별)
  hi52: number | null   // 현재가 ÷ 최근 52주 최고가 × 100 (100=신고가) — 52주 미만이면 상장 후 전체 기준
}
export interface SectorSubOut { key: string; label: string; emoji: string; color: string; desc: string; count: number; ret1w: number | null; ret1m: number | null; ret1y: number | null }
export interface SectorThemeChart { len: number; theme: number[]; mdd: number; fromPeak: number; overlay: { ticker: string; name: string; norm: number[] }[] }
export interface SectorResult {
  key: string; label: string; emoji: string; tagline: string; tagHeader: string; anchor: string
  stocks: SectorStockOut[]; subsectors: SectorSubOut[]; themeChart: SectorThemeChart | null
  policy?: PolicyAward[]; preIpo?: PreIpoCompany[]; asOf: string
}

export async function computeSector(cfg: SectorConfig): Promise<SectorResult> {
  const series = new Map<string, number[]>()
  const [, earnings] = await Promise.all([
    Promise.all(cfg.stocks.map(async s => { series.set(s.ticker, await fetchWeekly(s)) })),
    fetchEarnings(cfg.stocks),
  ])
  const anchorW = series.get(cfg.anchor) ?? []

  const stocks: SectorStockOut[] = cfg.stocks.map(s => {
    const w = series.get(s.ticker) ?? []
    const { beta, corr } = s.ticker === cfg.anchor ? { beta: 1, corr: 1 } : betaCorr(w, anchorW)
    return {
      ticker: s.ticker, name: s.name, market: s.market, sub: s.sub, tags: s.tags ?? [], purePlay: s.purePlay,
      govAwardUsdM: s.govAwardUsdM, note: s.note,
      ret1w: retPct(w, 1), ret1m: retPct(w, 4), ret1y: retPct(w, 52),
      beta, corr, earningsTs: earnings.get(s.ticker) ?? null, spark: w.slice(-30).map(v => Math.round(v * 100) / 100), weeks: w.length,
      hi52: (() => { if (w.length < 2) return null; const hi = Math.max(...w.slice(-52)), now = w[w.length - 1]; return hi > 0 ? Math.round((now / hi) * 1000) / 10 : null })(),
    }
  })

  const subsectors: SectorSubOut[] = Object.keys(cfg.subMeta).map(k => {
    const m = cfg.subMeta[k], members = stocks.filter(s => s.sub === k)
    return { key: k, label: m.label, emoji: m.emoji, color: m.color, desc: m.desc, count: members.length,
      ret1w: avg(members.map(s => s.ret1w)), ret1m: avg(members.map(s => s.ret1m)), ret1y: avg(members.map(s => s.ret1y)) }
  })

  // 테마지수(퓨어플레이 동일가중 78주 rebase100) + MDD + 오버레이
  const N = 78
  const norm = (w: number[]): number[] | null => {
    if (w.length < N) return null
    const win = w.slice(w.length - N), base = win[0]
    return base > 0 ? win.map(c => Math.round((c / base) * 1000) / 10) : null
  }
  const pureNorms = cfg.stocks.filter(s => s.purePlay).map(s => norm(series.get(s.ticker) ?? [])).filter((x): x is number[] => x != null)
  let themeChart: SectorThemeChart | null = null
  if (pureNorms.length >= 3) {
    const theme: number[] = []
    for (let t = 0; t < N; t++) theme.push(Math.round((pureNorms.reduce((a, ns) => a + ns[t], 0) / pureNorms.length) * 10) / 10)
    let peak = -Infinity, mdd = 0
    for (const v of theme) { if (v > peak) peak = v; const dd = v / peak - 1; if (dd < mdd) mdd = dd }
    const fromPeak = Math.round((theme[theme.length - 1] / Math.max(...theme) - 1) * 1000) / 10
    const overlay = cfg.overlayTickers.map(tk => {
      const ns = norm(series.get(tk) ?? []); const s = cfg.stocks.find(x => x.ticker === tk)
      return ns ? { ticker: tk, name: s?.name ?? tk, norm: ns } : null
    }).filter((x): x is { ticker: string; name: string; norm: number[] } => x != null)
    themeChart = { len: N, theme, mdd: Math.round(mdd * 1000) / 10, fromPeak, overlay }
  }

  return {
    key: cfg.key, label: cfg.label, emoji: cfg.emoji, tagline: cfg.tagline, tagHeader: cfg.tagHeader, anchor: cfg.anchor,
    stocks, subsectors, themeChart, policy: cfg.policy, preIpo: cfg.preIpo, asOf: new Date().toISOString(),
  }
}
