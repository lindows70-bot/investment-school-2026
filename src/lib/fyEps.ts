// 확정 결산 연도 EPS 의 최고치·기간(fyEps) SSOT — 재무 API(KR 네이버+DART 5년 · US FMP/야후 4~5년)에서 뽑아 app_cache 에 7일 저장. 경기순환주 정점 판정의 비교 기준
//
// 2026-10-03: 그전엔 종목 정보가 네이버 연간 재무의 확정 3년(KR)만 들고 있었고 US 는 아예 없어서,
// 정점 가드가 국내 종목 3년치에만 걸리는 비대칭이 있었다(코히런트처럼 적자→급반등한 미국 종목은 판정 밖).
// 재무 API 는 이미 KR 5년(네이버 3년 + DART 로 복구한 과거 연도, 네이버 기준으로 환산) · US 4~5년을 만들고 있으므로
// 그 격자에서 뽑는다 — 같은 종목의 결산 EPS 가 화면마다 다른 값이 되지 않게(제2원칙) 두 번째 계산기를 만들지 않는다.
// 결산 EPS 는 1년에 한 번 바뀌므로 7일 캐시. 날짜는 키에 넣지 않는다(app_cache 에 지우는 장치가 없다).
import { getCache, setCache } from '@/lib/appCache'

export interface FyEps { max: number; from: string; to: string; n: number }

export const FY_EPS_KEY = 'fy-eps-v1'
const TTL_MS = 7 * 24 * 3600_000

/**
 * 재무 API 격자(연도 → {eps}) 에서 확정 연도(접미사 E 제외)의 EPS 를 모아 최고치·기간을 만든다.
 * 0 은 '자료 없음'(재무 API 규약)이라 건너뛴다. 적자 연도는 비교 연도 수(n)에 포함한다(그 해도 결산이다).
 * 연도가 3개 미만이면 null — 판정하지 않는다(가짜 정밀 금지).
 */
export function fyEpsFromGrid(fin: Record<string, { eps?: number | null } | undefined>, yearKeys: string[]): FyEps | null {
  const list = yearKeys
    .filter(k => !k.endsWith('E'))
    .map(k => ({ y: k.slice(0, 4), v: fin[k]?.eps }))
    .filter((o): o is { y: string; v: number } => typeof o.v === 'number' && Number.isFinite(o.v) && o.v !== 0)
    .sort((a, b) => a.y.localeCompare(b.y))
  if (list.length < 3) return null
  return { max: Math.max(...list.map(o => o.v)), from: list[0].y, to: list[list.length - 1].y, n: list.length }
}

/** 캐시 → 없으면 재무 API 를 한 번 불러 만들고 저장. 실패하면 null(호출부가 자기 폴백을 쓴다). 결과가 없으면 저장하지 않는다(다음 요청이 다시 시도) */
export async function getFyEps(ticker: string, market: 'KR' | 'US', origin: string): Promise<FyEps | null> {
  const key = `${FY_EPS_KEY}:${market}:${ticker.toUpperCase()}`
  const cached = await getCache<FyEps>(key, TTL_MS)
  if (cached && Number.isFinite(cached.max) && cached.n >= 3) return cached
  try {
    const r = await fetch(`${origin}/api/financials?ticker=${encodeURIComponent(ticker)}&market=${market}`, {
      signal: AbortSignal.timeout(20_000), cache: 'no-store',
    })
    if (!r.ok) return null
    const f = await r.json()
    if (!f?.success) return null
    const fy = fyEpsFromGrid(f.financials ?? {}, Array.isArray(f.yearKeys) ? f.yearKeys : [])
    if (fy) await setCache(key, fy)
    return fy
  } catch { return null }
}
