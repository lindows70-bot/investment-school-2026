/**
 * GET /api/correlation-matrix
 *
 * 📐 포트폴리오 상관관계 매트릭스 (Portfolio Correlation Matrix)
 *
 * 로그인 학생의 보유 주식(STOCK만)의 최근 60거래일 일별 수익률로
 * 모든 종목 쌍 간 피어슨 상관계수(Pearson r, −1.0 ~ +1.0)를 연산.
 *
 * ── 데이터 소스 ──
 *  · US: Yahoo Finance v8 chart (1d, 3mo)
 *  · KR: Naver fchart 일봉 (timeframe=day, count=65)
 *
 * ── 캐싱 ──
 *  · app_cache 24h (user_id 포함 키 → 학생별 개인 캐시)
 *  · 데이터 부족(<10 공통 거래일) 종목 쌍은 null 처리 (graceful)
 *
 * ── 피어슨 상관계수 ──
 *   r = Σ(xi−x̄)(yi−ȳ) / (n−1)σxσy
 *   일별 수익률 = (종가[t] − 종가[t-1]) / 종가[t-1]
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse }       from 'next/server'
import { createClient }       from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { getAssetType }       from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { getSector }          from '@/lib/schoolIndex'
import https                  from 'node:https'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface CorrelationCell {
  r: number | null    // 피어슨 r (null = 공통 데이터 부족)
}
export interface CorrelationResult {
  tickers:    string[]           // 순서 고정 종목 리스트
  names:      Record<string, string>  // ticker → 표시명
  sectors:    Record<string, string>  // ticker → GICS 섹터(영문, Yahoo) — 동조화 원인 설명용
  matrix:     (number | null)[][]   // [i][j] = tickers[i]↔tickers[j]의 r
  avgR:       number             // 대각선 제외 평균 상관계수
  dataPoints: number             // 계산에 쓴 평균 공통 거래일 수
  asOf:       string
}

// ── HTTP GET 헬퍼 ─────────────────────────────────────────────────────────────
function httpGet(url: string): Promise<string> {
  return new Promise((rs, rj) => {
    const u = new URL(url)
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } },
      r => { const c: Buffer[] = []; r.on('data', d => c.push(d as Buffer)); r.on('end', () => rs(Buffer.concat(c).toString('utf8'))) })
    req.on('error', rj)
    req.setTimeout(12_000, () => req.destroy(new Error('timeout')))
  })
}

// ── 일봉 종가 수집 ────────────────────────────────────────────────────────────
async function fetchDailyPrices(ticker: string, market: string): Promise<number[]> {
  try {
    if (market === 'KR') {
      // Naver fchart — 일봉 65개 (~3개월)
      const code = ticker.replace(/\D/g, '')
      const xml = await httpGet(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=65&requestType=0`)
      const re = /data="([^"]+)"/g; let m: RegExpExecArray | null; const prices: number[] = []
      while ((m = re.exec(xml)) !== null) {
        const p = m[1].split('|')
        if (p.length >= 5) { const c = parseFloat(p[4]); if (c > 0) prices.push(c) }
      }
      return prices
    } else {
      // Yahoo Finance v8 — 1d, 3mo
      const sym = ticker.replace(/\.(KS|KQ)$/i, '')
      const json = await httpGet(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d&events=none`)
      const j = JSON.parse(json)
      const closes: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      return closes.filter((c): c is number => c != null && c > 0)
    }
  } catch { return [] }
}

// ── 일별 수익률 계산 ──────────────────────────────────────────────────────────
function dailyReturns(prices: number[]): number[] {
  const ret: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) ret.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  return ret
}

// ── 피어슨 상관계수 ───────────────────────────────────────────────────────────
function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 10) return null     // 공통 데이터 10일 미만 → 통계적으로 무의미
  const a = xs.slice(xs.length - n), b = ys.slice(ys.length - n)
  const ma = a.reduce((s, x) => s + x, 0) / n
  const mb = b.reduce((s, x) => s + x, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const ai = a[i] - ma, bi = b[i] - mb
    num += ai * bi; da += ai * ai; db += bi * bi
  }
  const denom = Math.sqrt(da) * Math.sqrt(db)
  if (denom < 1e-12) return null
  return Math.max(-1, Math.min(1, Math.round((num / denom) * 1000) / 1000))
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export async function GET() {
  // ① 인증 — 로그인 학생만
  const sb = createClient()
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // ② 24h 개인 캐시 (v2: 섹터 필드 추가로 키 버전 업)
  const cacheKey = `corr-matrix-v2:${user.id}:${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`
  const cached = await getCache<CorrelationResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ③ 보유 주식(STOCK만) 조회
  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: invRows } = await admin.from('investments').select('ticker,name,market').eq('user_id', user.id)
  const invs = (invRows ?? []).filter(inv => getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') === 'STOCK')

  if (invs.length < 2) {
    return NextResponse.json({ error: '상관관계 분석에는 주식 2개 이상이 필요합니다.' }, { status: 400 })
  }

  // ④ 종목별 일별 수익률 수집 (병렬, 동시성 5)
  const returnsMap: Record<string, number[]> = {}
  for (let i = 0; i < invs.length; i += 5) {
    const batch = invs.slice(i, i + 5)
    const results = await Promise.all(batch.map(async inv => {
      const prices = await fetchDailyPrices(inv.ticker, inv.market ?? 'US')
      return { ticker: inv.ticker, returns: dailyReturns(prices) }
    }))
    for (const { ticker, returns } of results) if (returns.length > 0) returnsMap[ticker] = returns
  }

  // 최소 데이터 있는 종목만
  const tickers = invs.map(i => i.ticker).filter(t => (returnsMap[t]?.length ?? 0) >= 10)
  const names: Record<string, string> = {}
  for (const inv of invs) names[inv.ticker] = inv.name?.slice(0, 12) || inv.ticker

  if (tickers.length < 2) {
    return NextResponse.json({ error: '주가 데이터가 충분한 종목이 2개 미만입니다. 잠시 후 다시 시도해주세요.' }, { status: 400 })
  }

  // ⑤ 상관계수 행렬 계산 (대칭 행렬이므로 절반만 계산 후 반영)
  const n = tickers.length
  const matrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null))
  let sumR = 0, countR = 0, totalDataPoints = 0

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0       // 자기 자신
    for (let j = i + 1; j < n; j++) {
      const r = pearson(returnsMap[tickers[i]], returnsMap[tickers[j]])
      matrix[i][j] = r; matrix[j][i] = r
      if (r !== null) {
        sumR += r; countR++
        totalDataPoints += Math.min(returnsMap[tickers[i]].length, returnsMap[tickers[j]].length)
      }
    }
  }

  const avgR = countR > 0 ? Math.round((sumR / countR) * 1000) / 1000 : 0
  const dataPoints = countR > 0 ? Math.round(totalDataPoints / countR) : 0

  // ⑥ GICS 섹터 수집 (동조화 원인 설명용 — getSector 7일 캐시 공유 → 대개 즉시)
  const sectors: Record<string, string> = {}
  const invByTicker = new Map(invs.map(i => [i.ticker, i.market ?? 'US']))
  for (let i = 0; i < tickers.length; i += 5) {
    const batch = tickers.slice(i, i + 5)
    const secs = await Promise.all(batch.map(t => getSector(t, invByTicker.get(t) ?? 'US').catch(() => '기타')))
    batch.forEach((t, k) => { sectors[t] = secs[k] })
  }

  const result: CorrelationResult = {
    tickers, names, sectors, matrix, avgR, dataPoints, asOf: new Date().toISOString(),
  }

  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
