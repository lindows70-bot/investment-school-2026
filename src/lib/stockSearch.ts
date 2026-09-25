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

export interface UpbitMarket { market: string; korean_name: string; english_name: string }
export function matchUpbit(markets: UpbitMarket[], q: string): SearchResult[] {
  const t = q.trim(); if (!t) return []
  const up = t.toUpperCase()
  return markets
    .filter(m => m.market.startsWith('KRW-'))
    .filter(m => m.korean_name.includes(t) || m.english_name.toUpperCase().includes(up) || m.market.slice(4) === up)
    .map(m => ({ ticker: m.market.slice(4), name: m.korean_name, market: 'CRYPTO' as const, currency: 'KRW' as const, exchange: '업비트' }))
}

export function mergeResults(stocks: SearchResult[], crypto: SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>(); const out: SearchResult[] = []
  for (const r of [...stocks, ...crypto]) {
    const k = `${r.market}:${r.ticker}`
    if (seen.has(k)) continue
    seen.add(k); out.push(r)
    if (out.length >= limit) break
  }
  return out
}
