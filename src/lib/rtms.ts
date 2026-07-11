// 국토부 RTMS 실거래가 공용 fetcher(서버 전용, DATA_GO_KR_SERVICE_KEY) — 아파트 매매(TradeDev)·전월세(Rent)
// 과거월 실거래는 불변 → 월별 캐시(과거 30일·당월 6시간). XML은 정규식 파싱(DART 패턴).
import { getCache, setCache } from '@/lib/appCache'

export interface AptDeal {
  aptNm: string; ym: string; day: number
  price: number | null      // 매매가(만원) — 매매만
  deposit: number | null    // 보증금(만원) — 전월세만
  monthlyRent: number | null // 월세(만원) — 0이면 전세
  area: number               // 전용면적(㎡)
  floor: number | null
  buildYear: number | null
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))
  return m ? m[1].trim() : null
}
const num = (s: string | null): number | null => {
  if (!s) return null
  const v = parseFloat(s.replace(/,/g, ''))
  return isFinite(v) ? v : null
}

async function fetchRtmsXml(service: string, op: string, lawd: string, ym: string): Promise<string | null> {
  const key = process.env.DATA_GO_KR_SERVICE_KEY
  if (!key) return null
  try {
    const url = `https://apis.data.go.kr/1613000/${service}/${op}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=2000`
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return null
    const t = await r.text()
    if (!t.includes('<resultCode>000</resultCode>')) return null
    return t
  } catch { return null }
}

/** 한 지역·한 달의 매매 실거래(캐시: 과거월 30일·당월 6h) */
export async function rtmsTradeMonth(lawd: string, ym: string): Promise<AptDeal[]> {
  const nowYm = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7).replace('-', '')
  const ttl = ym < nowYm ? 30 * 86400_000 : 6 * 3600_000
  const ck = `rtms-trade-v1:${lawd}:${ym}`
  const cached = await getCache<AptDeal[]>(ck, ttl)
  if (cached) return cached
  const xml = await fetchRtmsXml('RTMSDataSvcAptTradeDev', 'getRTMSDataSvcAptTradeDev', lawd, ym)
  if (!xml) return []
  const deals: AptDeal[] = []
  for (const m of Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))) {
    const it = m[1]
    if (tag(it, 'cdealType')?.includes('O')) continue   // 해제된 거래 제외
    const area = num(tag(it, 'excluUseAr'))
    const price = num(tag(it, 'dealAmount'))
    if (!area || !price) continue
    deals.push({
      aptNm: tag(it, 'aptNm') ?? '?', ym, day: num(tag(it, 'dealDay')) ?? 1,
      price, deposit: null, monthlyRent: null, area,
      floor: num(tag(it, 'floor')), buildYear: num(tag(it, 'buildYear')),
    })
  }
  await setCache(ck, deals)
  return deals
}

/** 한 지역·한 달의 전월세 실거래 */
export async function rtmsRentMonth(lawd: string, ym: string): Promise<AptDeal[]> {
  const nowYm = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7).replace('-', '')
  const ttl = ym < nowYm ? 30 * 86400_000 : 6 * 3600_000
  const ck = `rtms-rent-v1:${lawd}:${ym}`
  const cached = await getCache<AptDeal[]>(ck, ttl)
  if (cached) return cached
  const xml = await fetchRtmsXml('RTMSDataSvcAptRent', 'getRTMSDataSvcAptRent', lawd, ym)
  if (!xml) return []
  const deals: AptDeal[] = []
  for (const m of Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))) {
    const it = m[1]
    const area = num(tag(it, 'excluUseAr'))
    const deposit = num(tag(it, 'deposit'))
    if (!area || deposit == null) continue
    deals.push({
      aptNm: tag(it, 'aptNm') ?? '?', ym, day: num(tag(it, 'dealDay')) ?? 1,
      price: null, deposit, monthlyRent: num(tag(it, 'monthlyRent')) ?? 0, area,
      floor: num(tag(it, 'floor')), buildYear: num(tag(it, 'buildYear')),
    })
  }
  await setCache(ck, deals)
  return deals
}

/** 큐레이션 시군구(LAWD_CD 5자리) — 정적 참조 데이터(법정동코드 앞 5자리, 허용 하드코딩) */
export const LAWD_REGIONS: { sido: string; name: string; lawd: string }[] = [
  // 서울 25개구
  { sido: '서울', name: '강남구', lawd: '11680' }, { sido: '서울', name: '서초구', lawd: '11650' },
  { sido: '서울', name: '송파구', lawd: '11710' }, { sido: '서울', name: '강동구', lawd: '11740' },
  { sido: '서울', name: '용산구', lawd: '11170' }, { sido: '서울', name: '성동구', lawd: '11200' },
  { sido: '서울', name: '광진구', lawd: '11215' }, { sido: '서울', name: '마포구', lawd: '11440' },
  { sido: '서울', name: '양천구', lawd: '11470' }, { sido: '서울', name: '영등포구', lawd: '11560' },
  { sido: '서울', name: '동작구', lawd: '11590' }, { sido: '서울', name: '관악구', lawd: '11620' },
  { sido: '서울', name: '강서구', lawd: '11500' }, { sido: '서울', name: '구로구', lawd: '11530' },
  { sido: '서울', name: '금천구', lawd: '11545' }, { sido: '서울', name: '종로구', lawd: '11110' },
  { sido: '서울', name: '중구', lawd: '11140' }, { sido: '서울', name: '성북구', lawd: '11290' },
  { sido: '서울', name: '강북구', lawd: '11305' }, { sido: '서울', name: '도봉구', lawd: '11320' },
  { sido: '서울', name: '노원구', lawd: '11350' }, { sido: '서울', name: '은평구', lawd: '11380' },
  { sido: '서울', name: '서대문구', lawd: '11410' }, { sido: '서울', name: '동대문구', lawd: '11230' },
  { sido: '서울', name: '중랑구', lawd: '11260' },
  // 경기 주요
  { sido: '경기', name: '성남 분당구', lawd: '41135' }, { sido: '경기', name: '성남 수정구', lawd: '41131' },
  { sido: '경기', name: '수원 영통구', lawd: '41117' }, { sido: '경기', name: '용인 수지구', lawd: '41465' },
  { sido: '경기', name: '고양 일산동구', lawd: '41285' }, { sido: '경기', name: '안양 동안구', lawd: '41173' },
  { sido: '경기', name: '과천시', lawd: '41290' }, { sido: '경기', name: '광명시', lawd: '41210' },
  { sido: '경기', name: '하남시', lawd: '41450' }, { sido: '경기', name: '화성시', lawd: '41590' },
  { sido: '경기', name: '부천시', lawd: '41190' },
  // 광역시·기타
  { sido: '인천', name: '연수구(송도)', lawd: '28185' }, { sido: '인천', name: '서구(청라)', lawd: '28260' },
  { sido: '부산', name: '해운대구', lawd: '26350' }, { sido: '부산', name: '수영구', lawd: '26500' },
  { sido: '대구', name: '수성구', lawd: '27260' }, { sido: '대전', name: '유성구', lawd: '30200' },
  { sido: '광주', name: '남구', lawd: '29155' }, { sido: '울산', name: '남구', lawd: '31140' },
  { sido: '세종', name: '세종시', lawd: '36110' }, { sido: '제주', name: '제주시', lawd: '50110' },
]

/** LAWD 앞 2자리 → 시도명(벌집 국면 연동용) */
export const LAWD_SIDO: Record<string, string> = {
  '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주', '30': '대전', '31': '울산',
  '36': '세종', '41': '경기', '42': '강원', '51': '강원', '43': '충북', '44': '충남', '45': '전북', '52': '전북',
  '46': '전남', '47': '경북', '48': '경남', '50': '제주',
}
