// 네이버 종목 integration 응답(totalInfos)에서 기본 지표를 읽는 순수 파서 — PER·EPS·PBR·배당·시가총액·52주 최고/최저
//   2026-10-01 실측: m.stock.naver.com/api/stock/{code}/basic 에서 per·eps·dividendYield·marketValue·high52week·low52week·industryCodeType 이
//   전부 사라졌다(업종만 9/30 에 먼저 발견). 그래서 basic 에 기대던 주가 라우트(stock-price)와 린치 분류(lynch-classify)의 국내 지표가 통째로 null 이었다.
//   같은 종목의 integration.totalInfos 에 값이 그대로 있다 — code 로 찾고 "12.25배"·"22,292원"·"0.61%"·"1,596조 341억" 문자열을 숫자로 푼다.
//   여기 PER·EPS 는 네이버 화면의 최근 4분기 기준이다. 종목 정보(stock-info)의 PER 도 이 값을 쓴다(2026-10-01 — 재무제표 PER 행은 작년 말 주가 기준이라 폐기).

export interface NaverBasics {
  per: number | null            // 배(음수·N/A 는 null — 적자 판정은 eps 로)
  eps: number | null            // 원(적자면 음수)
  pbr: number | null
  dividendYield: number | null  // 소수(0.0061 = 0.61%)
  annualDividend: number | null // 주당 배당금(원)
  marketCap: number | null      // 원
  high52w: number | null
  low52w: number | null
}
export const EMPTY_BASICS: NaverBasics = { per: null, eps: null, pbr: null, dividendYield: null, annualDividend: null, marketCap: null, high52w: null, low52w: null }

/** "22,292원"·"-1,234원"·"12.25배"·"0.61%" → 숫자. 숫자가 없으면("N/A"·"-") null */
export function numOf(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) ? n : null
}

/** "1,596조 341억"·"8,471억"·"2조" → 원. 조·억 어느 것도 없으면 null(단위를 짐작하지 않는다) */
export function wonOfJoEok(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/,/g, '')
  const jo = s.match(/(\d+(?:\.\d+)?)\s*조/), eok = s.match(/(\d+(?:\.\d+)?)\s*억/)
  if (!jo && !eok) return null
  const n = (jo ? parseFloat(jo[1]) * 1e12 : 0) + (eok ? parseFloat(eok[1]) * 1e8 : 0)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** integration 응답 → 기본 지표. 응답이 없거나 모양이 다르면 전부 null */
export function parseNaverBasics(integ: unknown): NaverBasics {
  const infos = (integ as { totalInfos?: unknown } | null)?.totalInfos
  if (!Array.isArray(infos)) return { ...EMPTY_BASICS }
  const val = (code: string): unknown => (infos as { code?: unknown; value?: unknown }[]).find(x => x?.code === code)?.value
  const pos = (n: number | null) => (n != null && n > 0 ? n : null)
  const dy = numOf(val('dividendYieldRatio'))
  return {
    per: pos(numOf(val('per'))),
    eps: numOf(val('eps')),
    pbr: pos(numOf(val('pbr'))),
    dividendYield: dy != null && dy > 0 ? Math.round(dy * 100) / 10000 : null,
    annualDividend: pos(numOf(val('dividend'))),
    marketCap: wonOfJoEok(val('marketValue')),
    high52w: pos(numOf(val('highPriceOf52Weeks'))),
    low52w: pos(numOf(val('lowPriceOf52Weeks'))),
  }
}
