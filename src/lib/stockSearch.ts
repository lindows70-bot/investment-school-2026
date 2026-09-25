// 종목 이름 검색 SSOT — 네이버 자동완성(한국·미국) + 업비트 원화 마켓(코인), 한글 ETF 브랜드 별칭
//   실측(2026-09-25): "타이거·코덱스"는 네이버가 못 찾고, 일본 종목이 섞인다 → 별칭 치환 + 국가 필터.
export type Market = 'US' | 'KR' | 'CRYPTO'
export interface SearchResult { ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'; exchange: string }

const BRAND_ALIAS: [string, string][] = [
  ['타이거', 'TIGER'], ['코덱스', 'KODEX'], ['에이스', 'ACE'], ['라이즈', 'RISE'], ['킨덱스', 'KINDEX'],
  ['하나로', 'HANARO'], ['아리랑', 'ARIRANG'], ['플러스', 'PLUS'], ['케이비스타', 'KBSTAR'], ['쏠', 'SOL'],
]
export function expandQuery(q: string): string {
  const t = q.trim()
  for (const [ko, en] of BRAND_ALIAS) if (t.startsWith(ko)) return en + t.slice(ko.length)
  return t
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseNaverItems(items: any[]): SearchResult[] {
  return (items ?? [])
    .filter(i => i?.category === 'stock' && (i.nationCode === 'KOR' || i.nationCode === 'USA') && i.code && i.name)
    .map(i => i.nationCode === 'KOR'
      ? { ticker: String(i.code), name: String(i.name), market: 'KR' as const, currency: 'KRW' as const, exchange: String(i.typeName ?? i.typeCode ?? '') }
      : { ticker: String(i.code).toUpperCase(), name: String(i.name), market: 'US' as const, currency: 'USD' as const, exchange: String(i.typeName ?? i.typeCode ?? '') })
}

// 실측: 업비트 마켓 목록은 관련도·거래량 순이 아니라 임의 순서다(KRW-BTC 가 289개 중 268번째)
//   → 이름이 검색어로 시작하는(또는 티커가 검색어와 정확히 같은) 것을 먼저, 그 안에서 24시간 거래대금 내림차순, 마지막으로 짧은 이름 우선으로 재정렬한다.
export function rankCrypto(results: SearchResult[], q: string, volume: Record<string, number>): SearchResult[] {
  const t = q.trim()
  const up = t.toUpperCase()
  return [...results].sort((a, b) => {
    const aPrefix = a.name.startsWith(t) || a.ticker.toUpperCase() === up
    const bPrefix = b.name.startsWith(t) || b.ticker.toUpperCase() === up
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1
    const aVol = volume[a.ticker] ?? 0
    const bVol = volume[b.ticker] ?? 0
    if (aVol !== bVol) return bVol - aVol
    return a.name.length - b.name.length
  })
}

export interface UpbitMarket { market: string; korean_name: string; english_name: string }
export function matchUpbit(markets: UpbitMarket[], q: string): SearchResult[] {
  const t = q.trim(); if (!t) return []
  const up = t.toUpperCase()
  return markets
    .filter(m => m.market.startsWith('KRW-'))
    .filter(m => m.korean_name.includes(t) || m.english_name.toUpperCase().includes(up) || m.market.slice(4) === up)
    .map(m => ({ ticker: m.market.slice(4), name: m.korean_name, market: 'CRYPTO' as const, currency: 'KRW' as const, exchange: '업비트' }))
}

// 실측(2026-09-25): "비트" → 네이버가 주식 이름 매치 10개로 상한을 채워 비트코인이 사라짐
//   → 코인 자리를 최대 3개까지 예약해두고(주식이 그보다 적으면 코인이 남은 자리를 더 채운다), 그 다음 주식으로 나머지를 채운다.
export function mergeResults(stocks: SearchResult[], crypto: SearchResult[], limit: number): SearchResult[] {
  const reserved = Math.min(crypto.length, 3, limit)
  const stockBudget = limit - reserved
  const seen = new Set<string>(); const out: SearchResult[] = []
  for (const r of stocks) {
    if (out.length >= stockBudget) break
    const k = `${r.market}:${r.ticker}`
    if (seen.has(k)) continue
    seen.add(k); out.push(r)
  }
  for (const r of crypto) {
    if (out.length >= limit) break
    const k = `${r.market}:${r.ticker}`
    if (seen.has(k)) continue
    seen.add(k); out.push(r)
  }
  return out
}
