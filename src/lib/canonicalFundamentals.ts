/**
 * src/lib/canonicalFundamentals.ts — 📐 종목 핵심 지표 단일 진실원(SSOT) · 서버 전용
 *
 * "같은 종목은 어느 화면에서든 동일한 데이터" — PEG가 화면마다 다르던 버그의 근본 해결.
 *
 * 단일 출처 = `/api/stock-info` (US는 FMP/Yahoo, KR은 Naver PER 기반 PER/성장률 — 분석화면과 동일).
 * 종목별 app_cache(6h)로 캐시 → 섹터피어·브리핑·밸류에이션 등 모든 기능이 같은 캐시를 공유하므로
 * 동일 종목 PEG는 전 화면에서 항상 일치한다. graceful: stock-info 실패 시 null(호출부가 폴백).
 */

import { getCache, setCache } from '@/lib/appCache'

export interface CanonicalFundamentals {
  peg:      number | null
  pe:       number | null
  growth:   number | null   // 소수(0.25=25%)
  sector:   string | null
  opMargin: number | null   // 영업이익률 소수(-0.24=-24%) — PEG null 적자기업 브레이크용
  roe:      number | null   // ROE 소수(-0.81=-81%)
  fcf:      number | null   // 잉여현금흐름 (음수=현금 소진)
}
const EMPTY: CanonicalFundamentals = { peg: null, pe: null, growth: null, sector: null, opMargin: null, roe: null, fcf: null }
const TTL = 6 * 3600_000

/** 티커('NVDA' / '000660' / '000660.KS')를 (코드, market)으로 정규화 */
function normalize(ticker: string, market?: string): { code: string; market: 'US' | 'KR' } {
  const t = ticker.trim().toUpperCase()
  if (/\.(KS|KQ)$/i.test(t) || (market ?? '').toUpperCase() === 'KR' || /^\d{6}$/.test(t.replace(/\.(KS|KQ)$/i, '')))
    return { code: t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, ''), market: 'KR' }
  return { code: t, market: 'US' }
}

/**
 * 종목 핵심 지표(SSOT). base = 내부 stock-info 호출용 절대 URL(요청 origin).
 * 동일 종목은 캐시(canon-fund:CODE:MKT)를 공유 → 전 화면 일치.
 */
export async function getCanonicalFundamentals(ticker: string, market?: string, base?: string): Promise<CanonicalFundamentals> {
  const { code, market: mkt } = normalize(ticker, market)
  const cacheKey = `canon-fund:${code}:${mkt}`
  const cached = await getCache<CanonicalFundamentals>(cacheKey, TTL)
  if (cached) return cached
  if (!base) return EMPTY   // base 없으면 호출 불가 → 폴백(호출부에서 처리)

  try {
    const r = await fetch(`${base}/api/stock-info?ticker=${encodeURIComponent(code)}&market=${mkt}`, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return EMPTY
    const j = await r.json()
    const f = j?.fundamentals ?? {}
    const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)
    const peg = typeof f.peg === 'number' && isFinite(f.peg) ? Math.round(f.peg * 100) / 100 : null
    const pe = num(f.pe)
    const growth = num(f.earningsGrowth)
    const sector = typeof f.sector === 'string' ? f.sector : null
    const opMargin = num(f.operatingMargins)
    const roe = num(f.returnOnEquity)
    const fcf = num(f.freeCashflow)
    const result: CanonicalFundamentals = { peg, pe, growth, sector, opMargin, roe, fcf }
    // 유효 데이터일 때만 캐시(실패값 캐싱 방지)
    if (peg != null || pe != null || opMargin != null) await setCache(cacheKey, result)
    return result
  } catch { return EMPTY }
}

/** PEG만 필요할 때 단축 — 동일 SSOT 캐시 사용 */
export async function getCanonicalPeg(ticker: string, market?: string, base?: string): Promise<number | null> {
  return (await getCanonicalFundamentals(ticker, market, base)).peg
}
