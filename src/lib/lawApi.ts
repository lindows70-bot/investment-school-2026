// 📜 국가법령정보 공동활용 API 클라이언트 — 부동산 정책의 **1차 출처**(확정·시행된 것만)
//
// 왜 뉴스가 아니라 이걸 쓰나(Phase 0 실측 2026-08-09): 부동산 대책은 법률 개정보다
// **고시·훈령**(행정규칙)으로 집행된다. 뉴스는 "발표 예정"까지 섞이지만 여기 있는 건 전부
// 이미 발령된 것이다. 실측: 9개 키워드 × 부처 필터 → 111건, 2026년 발령 42건.
//
// ⚠️ 실측으로 확인한 것(추측 금지 — 원문 라벨을 눈으로 봤다):
//   · `<admrul id="1">` — **태그에 속성이 있다.** `<admrul>` 로 정규식을 짜면 0건이 된다(실제로 겪음).
//   · `sort=ddes` 작동(발령일자 내림차순) · `org=1613000`(국토부 **코드**) 작동
//     — `org=국토교통부` 처럼 **이름 문자열은 안 먹는다**.
//   · 날짜는 `YYYYMMDD` 문자열.
import { getCache, setCache } from '@/lib/appCache'

/** ⚠️ `test` 는 공식 샘플 계정이다 — 실서비스는 law.go.kr 에서 무료 OC 발급 후 env 등록.
 *  폴백을 두되 **샘플 사용 중임을 화면에 경고**한다(조용히 샘플로 도는 게 최악). */
export const LAW_OC = process.env.LAW_API_OC ?? 'test'
export const LAW_OC_IS_SAMPLE = !process.env.LAW_API_OC

export interface AdmRule {
  name: string        // 행정규칙명
  kind: string        // 고시 / 훈령 / 예규 …
  org: string         // 소관부처명
  change: string      // 제정 / 일부개정 / 타법개정 / 폐지
  issued: string      // 발령일자 YYYYMMDD
  effective: string   // 시행일자 YYYYMMDD
  link: string        // 원문 상세 링크(절대 URL로 변환) — 학생이 2차 해석 없이 확인할 수 있게
}

const BASE = 'https://www.law.go.kr'
const tag = (x: string, t: string): string => {
  const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(x)
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''
}

/** 행정규칙 검색 — 키워드 1개. 실패는 빈 배열(호출부가 부분 실패를 감지할 수 있게 throw 하지 않는다) */
export async function searchAdmRules(query: string, display = 100): Promise<AdmRule[]> {
  const url = `${BASE}/DRF/lawSearch.do?OC=${encodeURIComponent(LAW_OC)}&target=admrul&type=XML`
    + `&query=${encodeURIComponent(query)}&display=${display}&sort=ddes`
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return []
    const xml = await r.text()
    if (!/<resultCode>00<\/resultCode>/.test(xml)) return []   // 키 오류·검증 실패 등
    // ⚠️ 속성 포함 매칭 — `<admrul id="1">`
    return Array.from(xml.matchAll(/<admrul[^>]*>([\s\S]*?)<\/admrul>/g)).map(m => {
      const it = m[1]
      const link = tag(it, '행정규칙상세링크')
      return {
        name: tag(it, '행정규칙명'),
        kind: tag(it, '행정규칙종류'),
        org: tag(it, '소관부처명'),
        change: tag(it, '제개정구분명'),
        issued: tag(it, '발령일자'),
        effective: tag(it, '시행일자'),
        link: link ? `${BASE}${link.replace(/&amp;/g, '&')}` : '',
      }
    }).filter(x => x.name)
  } catch { return [] }
}

/** 여러 키워드를 모아 **행정규칙명 기준 중복 제거**. 캐시 6h(고시는 하루에 몇 건 수준). */
export async function collectAdmRules(keywords: string[]): Promise<{ rules: AdmRule[]; failed: number }> {
  const ck = `law-admrul-v1:${keywords.join(',')}`
  const cached = await getCache<{ rules: AdmRule[]; failed: number }>(ck, 6 * 3600_000)
  if (cached) return cached

  const seen = new Map<string, AdmRule>()
  let failed = 0
  for (const k of keywords) {
    const rs = await searchAdmRules(k)
    if (!rs.length) failed++
    for (const r of rs) if (!seen.has(r.name)) seen.set(r.name, r)
  }
  const rules = Array.from(seen.values()).sort((a, b) => (b.issued || '').localeCompare(a.issued || ''))
  const out = { rules, failed }
  // ⛔ 전멸(모든 키워드 실패)이면 캐시하지 않는다 — 한 번의 장애를 6시간 박제하지 않기 위해
  if (rules.length) await setCache(ck, out)
  return out
}
