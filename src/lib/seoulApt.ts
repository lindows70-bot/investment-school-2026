// 서울 열린데이터광장 공용 fetcher(SEOUL_API_KEY 서버 전용) — ① 아파트 매매 실거래(tbLnOpendataRtmsV: 국토부와 건별 100% 일치 실측·10건 더 신선) ② 공동주택 마스터(OpenAptInfo: 좌표·세대수, 의무관리 ~2,900단지)
//   실거래 보관 범위 = 2024년~현재(2023 이전 없음 실측) — 범위 밖·장애 시 null 반환(호출부가 국토부 폴백).
//   전월세(tbLnOpendataRentV)는 연 7만행(전 유형·필터 불가)이라 미사용 — 전월세는 국토부 유지.
import { getCache, setCache } from '@/lib/appCache'
import type { AptDeal } from '@/lib/rtms'

const KEY = () => process.env.SEOUL_API_KEY ?? null
const kstYear = () => new Date(Date.now() + 9 * 3600_000).getUTCFullYear()

// 페이징 일괄 수집(1회 1,000건 규격). 실패=null / 데이터 없음=[](정상)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seoulRows(service: string, params: string, maxRows = 60_000): Promise<any[] | null> {
  const key = KEY()
  if (!key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  for (let s = 1; s <= maxRows; s += 1000) {
    try {
      const r = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/${service}/${s}/${s + 999}/${params}`, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
      if (!r.ok) return null
      const j = await r.json()
      const t = j?.[service]
      if (!t) return j?.RESULT?.CODE === 'INFO-200' ? out : null   // INFO-200 = 해당 데이터 없음(정상 빈 결과)
      out.push(...(t.row ?? []))
      if (s + 999 >= (t.list_total_count ?? 0)) break
    } catch { return null }
  }
  return out
}

// ── 매매 실거래(연도×자치구 단위 캐시 — RCPT_YR=접수연도라 계약월 조회는 해당연도+익년 스캔) ──
interface SeoulTradeRow { n: string; d: string; c: string; p: number; a: number; f: number | null; b: number | null }   // n=단지 d=법정동 c=계약일 p=만원 a=전용㎡

const num = (v: unknown): number | null => {
  const x = parseFloat(String(v ?? '').replace(/,/g, ''))
  return isFinite(x) ? x : null
}

const yearMemo = new Map<string, Promise<SeoulTradeRow[] | null>>()   // 동시 월 요청의 중복 연도 fetch 방지(버스트 dedup)
function tradeYear(cgg: string, yr: string): Promise<SeoulTradeRow[] | null> {
  const ck = `seoul-rtms-trade-v1:${cgg}:${yr}`
  const hit = yearMemo.get(ck)
  if (hit) return hit
  const p = (async () => {
    const ttl = +yr < kstYear() ? 7 * 86400_000 : 6 * 3600_000
    const cached = await getCache<SeoulTradeRow[]>(ck, ttl)
    if (cached) return cached
    const rows = await seoulRows('tbLnOpendataRtmsV', `${yr}/${cgg}/`)
    if (rows == null) return null
    const out: SeoulTradeRow[] = []
    for (const r of rows) {
      if (r.BLDG_USG !== '아파트' || r.RTRCN_DAY) continue   // 아파트만 · 해제 거래 제외(국토부 cdealType과 동일 규칙)
      const price = num(r.THING_AMT), area = num(r.ARCH_AREA)   // ARCH_AREA=전용면적(국토부 excluUseAr와 건별 일치 실측)
      if (!price || !area || !r.CTRT_DAY) continue
      out.push({ n: String(r.BLDG_NM ?? '?'), d: String(r.STDG_NM ?? ''), c: String(r.CTRT_DAY), p: price, a: area, f: num(r.FLR), b: num(r.ARCH_YR) })
    }
    await setCache(ck, out)
    return out
  })()
  yearMemo.set(ck, p)
  p.finally(() => yearMemo.delete(ck))
  return p
}

/** 한 자치구·한 계약월의 아파트 매매 — 서울 API 보관 범위 밖(2024 이전)·장애 시 null(호출부 국토부 폴백) */
export async function seoulTradeMonth(lawd: string, ym: string): Promise<AptDeal[] | null> {
  const y = +ym.slice(0, 4)
  if (y < 2024) return null
  const years = [String(y)]
  if (y + 1 <= kstYear()) years.push(String(y + 1))   // 계약 후 30일 신고 → 12월 계약이 익년 접수분에 실림
  const all: SeoulTradeRow[] = []
  for (const yr of years) {
    const r = await tradeYear(lawd, yr)
    if (r == null) return null
    all.push(...r)
  }
  return all.filter(r => r.c.startsWith(ym)).map(r => ({
    aptNm: r.n, dong: r.d, ym, day: +r.c.slice(6) || 1,
    price: r.p, deposit: null, monthlyRent: null, area: r.a, floor: r.f, buildYear: r.b,
  }))
}

// ── 공동주택 마스터(좌표·세대수) — 의무관리대상만이라 소단지는 없음(정직 한계) ──
export interface SeoulAptInfo {
  name: string; gu: string; dong: string
  lng: number; lat: number
  hh: number | null       // 세대수
  dongs: number | null    // 동 수
  aprv: string | null     // 준공(YYYY-MM)
  park: number | null     // 주차대수
  heat: string | null     // 난방방식
}

export async function getSeoulAptMaster(): Promise<SeoulAptInfo[]> {
  const ck = 'seoul-apt-master-v1'
  const cached = await getCache<SeoulAptInfo[]>(ck, 7 * 86400_000)
  if (cached) return cached
  const rows = await seoulRows('OpenAptInfo', '')
  if (rows == null) return []
  const out: SeoulAptInfo[] = []
  for (const r of rows) {
    const lng = num(r.XCRD), lat = num(r.YCRD)
    if (r.USE_YN !== 'Y' || !lng || !lat) continue
    out.push({
      name: String(r.APT_NM ?? '').trim(), gu: String(r.SGG_ADDR ?? '').trim(), dong: String(r.EMD_ADDR ?? '').trim(),
      lng, lat, hh: num(r.TNOHSH), dongs: num(r.WHOL_DONG_CNT),
      aprv: r.USE_APRV_YMD ? String(r.USE_APRV_YMD).slice(0, 7) : null,
      park: num(r.PRK_CNTOM), heat: r.MN_MTHD ? String(r.MN_MTHD) : null,
    })
  }
  if (out.length) await setCache(ck, out)
  return out
}

// RTMS 단지명 ↔ 마스터 단지명 매칭(표기 차이: '아파트' 접미·공백·괄호) — 같은 법정동 우선
const norm = (s: string) => s.replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/아파트$/, '')
export function matchAptMaster(list: SeoulAptInfo[], guName: string, dong: string, aptNm: string): SeoulAptInfo | null {
  const q = norm(aptNm)
  if (!q) return null
  const cands = list.filter(m => m.gu === guName && (norm(m.name).includes(q) || q.includes(norm(m.name))))
  if (!cands.length) return null
  cands.sort((a, b) =>
    (Number(b.dong === dong) - Number(a.dong === dong)) ||
    (Math.abs(norm(a.name).length - q.length) - Math.abs(norm(b.name).length - q.length)))
  return cands[0]
}
