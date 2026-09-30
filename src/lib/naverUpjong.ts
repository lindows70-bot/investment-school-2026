// 네이버 국내 업종(WICS 79개) SSOT — 업종코드→업종명 표(7일 캐시) + 업종명→야후 11개 섹터 키워드 매핑. 서버 전용(appCache)
//   2026-09-30 실측: 네이버 basic 응답의 industryCodeType 이 사라져 국내 종목 업종이 전부 null 이었다('더 알아보기' 업종 '모름').
//   업종은 종목 integration 응답의 industryCode(문자열 "278")로 오고, 이름은 stocks/industry 목록(no=278 → 반도체와반도체장비)에 있다.
//   승패 해부실(win-lose)이 이미 이 표를 쓰고 있었는데 라우트 안에 있어 종목 정보(stock-info)가 못 썼다 — 여기로 옮겨 둘이 같은 표를 본다.
import { getCache, setCache } from './appCache'   // 상대 경로 — 검증 스크립트가 별칭 없이 컴파일

export const NAVER_UPJONG_KEY = 'naver-upjong-map-v1'   // 날짜 없는 키 한 행(코드→이름) — 내용이 같아 win-lose 시절 키 그대로
const NAVER_UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', Referer: 'https://m.stock.naver.com/' }

/** 업종코드 → 업종명(79개, 7일 캐시). 목록이 30개 미만이면 빈 맵(반쪽 표를 박제하지 않는다) */
export async function naverUpjongMap(): Promise<Map<string, string>> {
  const cached = await getCache<Record<string, string>>(NAVER_UPJONG_KEY, 7 * 24 * 3600_000)
  if (cached) return new Map(Object.entries(cached))
  try {
    const r = await fetch('https://m.stock.naver.com/api/stocks/industry?page=1&pageSize=100', { headers: NAVER_UA, cache: 'no-store' })
    const groups: { no?: number | string; name?: string }[] = r.ok ? (await r.json())?.groups ?? [] : []
    const m = groups.filter(g => g.no != null && g.name)
    if (m.length < 30) return new Map()
    const obj: Record<string, string> = {}
    for (const g of m) obj[String(g.no)] = String(g.name).trim()
    await setCache(NAVER_UPJONG_KEY, obj)
    return new Map(Object.entries(obj))
  } catch { return new Map() }
}

/** 종목코드 → 업종명(integration.industryCode 를 표로 푼다). 실패·미등록이면 null */
export async function krIndustryOf(code: string, upjong: Map<string, string>): Promise<string | null> {
  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, { headers: NAVER_UA })
    if (!r.ok) return null
    const j = await r.json()
    return industryNameOf(j, upjong)
  } catch { return null }
}

/** 이미 받은 integration 응답에서 업종명 — stock-info 처럼 응답을 들고 있는 호출부용 */
export function industryNameOf(integ: unknown, upjong: Map<string, string>): string | null {
  const ic = (integ as { industryCode?: unknown } | null)?.industryCode
  return ic != null ? upjong.get(String(ic)) ?? null : null
}

// 업종명 → 야후 11개 섹터(stock-info 의 US sector 와 같은 이름 체계 — Consumer Cyclical·Financial Services…)
//   2026-09-30 79개 전수 실측: 아래 표로 '기타' 하나만 null. 야후 기준으로 맞췄다(통신장비·전자제품 = Technology, 문구류 = Industrials, 가정용기기 = Consumer Cyclical)
const RULES: [RegExp, string][] = [
  [/반도체|디스플레이|전자장비|전자제품|컴퓨터|소프트웨어|IT서비스|통신장비|핸드셋|사무용전자/, 'Technology'],
  [/게임|엔터테인먼트|미디어|방송|광고|출판|통신서비스/, 'Communication Services'],
  [/은행|증권|보험|카드|창업투자|금융|자산운용/, 'Financial Services'],
  [/제약|생물공학|바이오|건강관리|생명과학|의료/, 'Healthcare'],
  [/유틸리티|수도|전력생산/, 'Utilities'],
  [/석유|가스|에너지장비/, 'Energy'],
  [/화학|철강|금속|광물|종이|목재|포장재/, 'Basic Materials'],
  [/부동산|리츠/, 'Real Estate'],
  [/음료|식품|담배|화장품|가정용품|개인용품/, 'Consumer Defensive'],
  [/자동차|호텔|레저|레스토랑|섬유|의류|신발|호화품|백화점|판매|소매|교육|내구소비재|가구|가정용기기|소비자서비스/, 'Consumer Cyclical'],
  [/조선|기계|복합기업|건설|건축|우주항공|국방|방산|운송|항공|해운|철도|전기장비|전기제품|상업서비스|무역|물류|문구/, 'Industrials'],
]
export function upjongToGics(u: string | null): string | null {
  if (!u) return null
  const t = u.replace(/\s/g, '')
  for (const [re, sec] of RULES) if (re.test(t)) return sec
  return null
}

// 린치 분류용 — 저성장(통신서비스)·경기민감 세분(반도체·철강·화학·자동차·가전)은 야후 11개보다 곱게 본다(lynch-classify 의 SLOW/CYCLICAL 목록과 같은 라벨).
//   통신장비는 통신서비스가 아니라 Technology(옛 표가 /통신/ 으로 둘을 섞어 통신장비를 저성장주로 보냈다). 나머지는 upjongToGics 와 같다
const LYNCH_FINE: [RegExp, string][] = [
  [/통신서비스/, 'Telecommunications'],
  [/반도체/, 'Semiconductors'],
  [/철강|비철금속/, 'Steel'],
  [/화학/, 'Chemical'],
  [/자동차/, 'Auto'],
  [/가전|디스플레이|전자제품|가정용기기/, 'Consumer Durables'],
]
export function upjongToLynchSector(u: string | null): string | null {
  if (!u) return null
  const t = u.replace(/\s/g, '')
  for (const [re, sec] of LYNCH_FINE) if (re.test(t)) return sec
  return upjongToGics(t)
}
