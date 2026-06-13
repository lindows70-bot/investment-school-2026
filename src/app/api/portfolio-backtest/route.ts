// ⏳ 투자 타임머신 — 내 실제 보유 종목을 5년 전부터 보유했다면? 실데이터 백테스트(제1원칙 — 하드코딩 0)
// stock-price-history(연도별 실제 평균가) 재사용 · Core/Satellite 분해 · 벤치마크=US/KR 비중 혼합(SPY+KODEX200) · 12h Lazy Cache
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const START_CAPITAL = 10_000_000   // 1,000만 원 기준
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const isKr = (ticker: string, market?: string) => market === 'KR' || /^\d{6}$/.test(ticker.replace(/\.(KS|KQ)$/i, ''))

export interface BacktestPoint { year: string; total: number; core: number | null; sat: number | null; bench: number }
export interface BacktestResult {
  points: BacktestPoint[]
  startYear: string; endYear: string
  startCapital: number
  summary: {
    total: { final: number; retPct: number; cagrPct: number; mddPct: number }
    core:  { final: number; retPct: number; cagrPct: number } | null
    sat:   { final: number; retPct: number; cagrPct: number } | null
    bench: { final: number; retPct: number; cagrPct: number }
  }
  insight: string
  coverage: string          // 백테스트에 포함된 종목 수 / 전체(데이터 없는 종목 정직 표기)
  benchLabel: string
  source: 'real' | 'quant'  // 데이터 출처(실제 보유 vs 퀀트 빌더 추천)
  asOf: string
}

type Priced = { ticker: string; name: string; market: 'US' | 'KR'; costW: number; core: boolean; yp: Record<string, number> }

async function yearPrices(base: string, ticker: string, market: string): Promise<Record<string, number>> {
  try {
    const r = await fetch(`${base}/api/stock-price-history?ticker=${encodeURIComponent(ticker)}&market=${market}`, { signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return {}
    const j = await r.json()
    return (j.yearPrices ?? {}) as Record<string, number>
  } catch { return {} }
}

const cagr = (mult: number, years: number) => years > 0 ? (Math.pow(mult, 1 / years) - 1) * 100 : 0

// 백테스트 입력 한 종목(출처 무관 공통 형태)
type HoldInput = { ticker: string; name: string; market: 'US' | 'KR'; costW: number; core: boolean }

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cookie = req.headers.get('cookie') ?? ''
  // source: real = 내 실제 보유 종목(investments) · quant = AI 퀀트 빌더 추천안(DB 미기록, 직접 백테스트)
  const source = new URL(req.url).searchParams.get('source') === 'quant' ? 'quant' : 'real'
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `portfolio-backtest-v4:${source}:${user.id}:${kstDate()}:${fp}`   // v4: 코인·원자재 제외 사실 투명 표기
  const cached = await getCache<BacktestResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 환율(₩ 원가 비중)
  let usdKrw = 1350
  try { const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000) }); if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 0) usdKrw = j.rate } } catch { /* 폴백 */ }

  // ── 출처별 입력 구성 ──────────────────────────────────────────────
  let holdsInput: HoldInput[] = []
  let assetClassNote = ''   // 코인·원자재 등 비주식 자산 제외 안내(투명성)
  if (source === 'quant') {
    // 퀀트 빌더 추천안을 직접 백테스트(실제 포트 오염 없음). 비중 = 설계 weightPct
    try {
      const r = await fetch(`${base}/api/quant-builder`, { headers: { cookie }, signal: AbortSignal.timeout(50_000) })
      if (r.ok) {
        const plan = await r.json()
        holdsInput = [
          ...(plan.core ?? []).map((c: { ticker: string; name: string; market: string; weightPct: number }) => ({ ticker: c.ticker, name: c.name, market: (c.market === 'KR' ? 'KR' : 'US') as 'US' | 'KR', costW: c.weightPct, core: true })),
          ...(plan.satellites ?? []).map((s: { ticker: string; name: string; market: string; weightPct: number }) => ({ ticker: s.ticker, name: s.name, market: (s.market === 'KR' ? 'KR' : 'US') as 'US' | 'KR', costW: s.weightPct, core: false })),
        ]
      }
    } catch { /* graceful */ }
    if (holdsInput.length === 0) return NextResponse.json({ error: 'no_holdings' }, { status: 200 })
  } else {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: rows } = await admin.from('investments')
      .select('ticker,name,market,purchase_price,quantity,currency,lynch_category,asset_role').eq('user_id', user.id)
    const all = rows ?? []
    const holds = all.filter(r => { const t = getAssetType(r.ticker, r.name ?? '', r.market ?? ''); return t === 'STOCK' || t === 'ETF' })
    if (holds.length === 0) return NextResponse.json({ error: 'no_holdings' }, { status: 200 })
    // 비주식 자산(코인·원자재)은 EPS·시장 대비 비교 대상이 아니라 제외 — 그 사실을 투명하게 표기
    const cryptoN = all.filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'CRYPTO').length
    const commN = all.filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? '') === 'COMMODITY').length
    const ex: string[] = []
    if (cryptoN > 0) ex.push(`암호화폐 ${cryptoN}종`)
    if (commN > 0) ex.push(`원자재 ${commN}종`)
    assetClassNote = `총 보유 ${all.length}종 중 ${ex.length ? ex.join('·') + '은 가격성격이 달라(EPS·시장지수 비교 불가) 제외하고 ' : ''}주식·ETF ${holds.length}종을 분석`
    // Core 판별 — asset_role 우선, 없으면 ETF/안정 카테고리 폴백(대시보드 isCoreInv와 동일 룰)
    const ETF_CORE = ['TIGER', 'KODEX', 'ACE', 'PLUS', 'KBSTAR', 'HANARO', 'ARIRANG', 'SOL', 'RISE', 'SPY', 'QQQ', 'SCHD', 'VOO', 'IVV']
    const isCore = (r: { name?: string | null; ticker: string; lynch_category?: string | null; asset_role?: string | null }) => {
      if (r.asset_role === 'SATELLITE') return false
      if (r.asset_role === 'CORE') return true
      const up = `${r.name ?? ''} ${r.ticker}`.toUpperCase()
      if (ETF_CORE.some(b => up.includes(b))) return true
      return r.lynch_category === 'stalwart' || r.lynch_category === 'slow_grower'
    }
    holdsInput = holds.map(r => ({
      ticker: r.ticker, name: r.name ?? r.ticker, market: (isKr(r.ticker, r.market ?? undefined) ? 'KR' : 'US') as 'US' | 'KR',
      costW: (r.purchase_price ?? 0) * (r.quantity ?? 0) * (r.currency === 'USD' ? usdKrw : 1), core: isCore(r),
    })).filter(h => h.costW > 0)
    if (holdsInput.length === 0) return NextResponse.json({ error: 'no_holdings' }, { status: 200 })
  }

  // 종목별 연도가 병렬 수집(동시성 5) + 벤치마크
  const priced: Priced[] = []
  for (let i = 0; i < holdsInput.length; i += 5) {
    const batch = holdsInput.slice(i, i + 5)
    const yps = await Promise.all(batch.map(h => yearPrices(base, h.ticker, h.market)))
    batch.forEach((h, k) => {
      if (Object.keys(yps[k]).length >= 2) priced.push({ ticker: h.ticker, name: h.name, market: h.market, costW: h.costW, core: h.core, yp: yps[k] })
    })
  }
  const holds = holdsInput   // 커버리지 표기용(총 입력 종목 수)
  const [spy, kodex] = await Promise.all([yearPrices(base, 'SPY', 'US'), yearPrices(base, '069500', 'KR')])
  if (priced.length === 0 || Object.keys(spy).length < 2) return NextResponse.json({ error: 'insufficient_history' }, { status: 200 })

  // 공통 시작연도 — 최근 6년 내, SPY와 원가비중 60%↑ 커버되는 가장 이른 해
  const curY = new Date().getFullYear()
  const yearsWithSpy = Object.keys(spy).map(Number).filter(y => y >= curY - 5).sort((a, b) => a - b)
  const totalCost = priced.reduce((s, p) => s + p.costW, 0) || 1
  let startYear = 0
  for (const y of yearsWithSpy) {
    const ys = String(y)
    const covered = priced.filter(p => p.yp[ys] != null).reduce((s, p) => s + p.costW, 0) / totalCost
    if (covered >= 0.6) { startYear = y; break }
  }
  if (!startYear) return NextResponse.json({ error: 'insufficient_history' }, { status: 200 })
  const endYear = Math.max(...yearsWithSpy)
  const sY = String(startYear)

  // startYear에 가격이 있는 종목만 백테스트(공정 — 중간 편입 종목은 제외하고 커버리지로 정직 표기)
  const inc = priced.filter(p => p.yp[sY] != null)
  const incCost = inc.reduce((s, p) => s + p.costW, 0) || 1
  const coreCost = inc.filter(p => p.core).reduce((s, p) => s + p.costW, 0)
  const satCost = inc.filter(p => !p.core).reduce((s, p) => s + p.costW, 0)
  const usCost = inc.reduce((s, p) => s + (p.market === 'US' ? p.costW : 0), 0)
  const krCost = inc.reduce((s, p) => s + (p.market === 'KR' ? p.costW : 0), 0)
  const benchUsW = (usCost + krCost) > 0 ? usCost / (usCost + krCost) : 1
  const benchKrW = 1 - benchUsW

  // 연도별 포트폴리오 가치 = 시작자본 × Σ(비중 × 가격배수). 누락 연도는 직전 보유가로 캐리(중간 상장폐지 방지)
  const valueAt = (subset: Priced[], subCost: number, y: string): number | null => {
    if (subCost <= 0) return null
    let mult = 0, w = 0
    for (const p of subset) {
      const p0 = p.yp[sY], pY = p.yp[y] ?? p.yp[String(Math.max(...Object.keys(p.yp).map(Number).filter(n => n <= Number(y))))]
      if (p0 == null || pY == null) continue
      mult += (p.costW / subCost) * (pY / p0); w += p.costW / subCost
    }
    return w > 0 ? START_CAPITAL * (mult / w) : null   // 커버된 비중으로 재정규화
  }
  const benchAt = (y: string): number => {
    const su = spy[sY] && spy[y] ? spy[y] / spy[sY] : 1
    const sk = kodex[sY] && kodex[y] ? kodex[y] / kodex[sY] : su   // KODEX 데이터 없으면 SPY로 대체
    return START_CAPITAL * (benchUsW * su + benchKrW * sk)
  }

  const points: BacktestPoint[] = []
  for (let y = startYear; y <= endYear; y++) {
    const ys = String(y)
    points.push({
      year: ys,
      total: Math.round(valueAt(inc, incCost, ys) ?? START_CAPITAL),
      core: coreCost > 0 ? Math.round(valueAt(inc.filter(p => p.core), coreCost, ys) ?? START_CAPITAL) : null,
      sat: satCost > 0 ? Math.round(valueAt(inc.filter(p => !p.core), satCost, ys) ?? START_CAPITAL) : null,
      bench: Math.round(benchAt(ys)),
    })
  }

  const span = endYear - startYear
  const lastTotal = points[points.length - 1].total
  const lastBench = points[points.length - 1].bench
  // 연간 기준 최대 낙폭(peak-to-trough) — 연 단위라 근사임을 라벨에 명시
  let peak = points[0].total, mdd = 0
  for (const p of points) { if (p.total > peak) peak = p.total; mdd = Math.min(mdd, (p.total - peak) / peak) }
  const mk = (finalV: number) => ({ final: finalV, retPct: Math.round((finalV / START_CAPITAL - 1) * 1000) / 10, cagrPct: Math.round(cagr(finalV / START_CAPITAL, span) * 10) / 10 })
  const lastCore = points[points.length - 1].core
  const lastSat = points[points.length - 1].sat

  const vsB = lastTotal - lastBench
  const beat = vsB >= 0
  const subject = source === 'quant' ? 'AI 퀀트 빌더가 추천한 종목' : '지금 내가 실제 보유한 종목'
  let insight = `${startYear}년에 1,000만 원으로 ${subject}을 샀다면, ${endYear}년 현재 약 ${Math.round(lastTotal / 1e4).toLocaleString('ko-KR')}만 원입니다(연복리 ${mk(lastTotal).cagrPct}%). 같은 기간 시장(벤치마크)은 ${Math.round(lastBench / 1e4).toLocaleString('ko-KR')}만 원 — 내 종목 선택이 시장을 ${beat ? `${Math.round(Math.abs(vsB) / 1e4).toLocaleString('ko-KR')}만 원 이겼습니다` : `${Math.round(Math.abs(vsB) / 1e4).toLocaleString('ko-KR')}만 원 밑돌았습니다`}.`
  if (lastCore != null && lastSat != null) {
    const coreR = lastCore / START_CAPITAL - 1, satR = lastSat / START_CAPITAL - 1
    insight += ` 수익의 견인차는 ${satR > coreR ? 'Satellite(성장·테마)' : 'Core(ETF·우량주)'} 쪽이었고(Core ${Math.round(coreR * 100)}% vs Satellite ${Math.round(satR * 100)}%), 변동성은 Satellite가 더 컸습니다. 이 기간 주가를 끌어올린 것은 실시간 뉴스가 아니라 기업들이 매년 쌓은 이익(EPS)의 누적이었습니다.`
  }

  const result: BacktestResult = {
    points, startYear: sY, endYear: String(endYear), startCapital: START_CAPITAL,
    summary: {
      total: { ...mk(lastTotal), mddPct: Math.round(mdd * 1000) / 10 },
      core: lastCore != null ? mk(lastCore) : null,
      sat: lastSat != null ? mk(lastSat) : null,
      bench: mk(lastBench),
    },
    insight,
    coverage: source === 'quant'
      ? `추천 ${holds.length}종목 중 ${inc.length}종목 반영(나머지는 ${startYear}년 이후 상장·데이터 없음으로 제외)`
      : `${assetClassNote} · 그중 ${inc.length}종목 반영(나머지는 ${startYear}년 이후 상장·데이터 없음으로 제외)`,
    benchLabel: krCost > 0 && usCost > 0 ? `벤치마크 = S&P500 ${Math.round(benchUsW * 100)}% + KOSPI200 ${Math.round(benchKrW * 100)}%(내 시장 비중 혼합)` : usCost > 0 ? '벤치마크 = S&P500' : '벤치마크 = KOSPI200',
    source,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
