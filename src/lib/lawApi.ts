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
  id: string          // 행정규칙일련번호 — 본문(목적) 조회 키
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
        id: tag(it, '행정규칙일련번호'),
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

// ── 📖 법령 본문(조문) ───────────────────────────────────────────────────────
// Phase 0 실측(2026-08-09): `lawService.do` 로 **조문 전문**이 온다(종합부동산세법 35조·54KB).
//   세율 조문에는 `┌─┬─┐` 박스 문자로 그린 **세율표가 원문 그대로** 들어 있다.
// ⛔ 그 표를 우리가 파싱해 "당신 세율은 X%"라고 말하지 않는다 —
//    조문 하나에 기본·중과·단기 표가 섞여 있어 잘못 고르면 **학생이 세금을 틀리게 안다**(실질 피해).
//    원문을 그대로 보여주고 해석은 학생·세무사에게 맡긴다(개인 세무 조언 금지 원칙과도 일치).

export interface LawArticle {
  no: string        // 조문번호
  title: string     // 조문제목 (예: 세율 및 세액)
  text: string      // 조문 원문(표 포함·박스 문자 유지)
  revised: string   // 조문에 적힌 최근 개정 이력(있으면)
}
export interface LawDoc {
  name: string      // 법령명한글
  effective: string // 시행일자 YYYYMMDD
  promulgated: string
  link: string      // 원문 링크
  articles: LawArticle[]
}

/** 법령 1건의 조문 전문. `articleFilter` 로 필요한 조문만 남긴다(전문은 수십~수백 조라 무겁다). */
export async function getLawDoc(name: string, articleFilter: (title: string, no: string) => boolean): Promise<LawDoc | null> {
  const ck = `law-doc-v2:${name}`   // v2: 항·호 구조 보존(메타 노이즈 제거 + 적용 대상 맥락 살림)
  const cached = await getCache<LawDoc>(ck, 24 * 3600_000)   // 법률은 자주 안 바뀐다
  if (cached) return cached
  try {
    const s = await fetch(`${BASE}/DRF/lawSearch.do?OC=${encodeURIComponent(LAW_OC)}&target=law&type=XML&query=${encodeURIComponent(name)}&display=5`,
      { cache: 'no-store', signal: AbortSignal.timeout(15_000) }).then(r => r.text())
    const laws = Array.from(s.matchAll(/<law[^>]*>([\s\S]*?)<\/law>/g)).map(m => m[1])
    // ⚠️ 부분일치가 아니라 **정확히 같은 법령명**을 고른다('소득세법' 검색에 '소득세법 시행령'이 섞인다)
    const hit = laws.find(l => tag(l, '법령명한글') === name)
    if (!hit) return null
    const mst = tag(hit, '법령일련번호')
    const body = await fetch(`${BASE}/DRF/lawService.do?OC=${encodeURIComponent(LAW_OC)}&target=law&MST=${mst}&type=XML`,
      { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then(r => r.text())

    const articles: LawArticle[] = Array.from(body.matchAll(/<조문단위[^>]*>([\s\S]*?)<\/조문단위>/g))
      .map(m => m[1])
      .map(a => {
        const no = tag(a, '조문번호'), title = tag(a, '조문제목')
        // ⚠️ 태그를 일괄로 벗기면 안 된다(2026-08-09 실사고):
        //   ① 조문번호·시행일자·변경여부 같은 **메타 값이 본문에 섞여** 표 위에 `9 / 조문 / 20260101 / N` 이 찍혔다.
        //   ② 더 심각한 건 **맥락 소실**이다 — 종부세 제9조는 호(號)마다 적용 대상이 다르다
        //      (호1 "2주택 이하", 호2 "3주택 이상", 항② "법인"). 표만 나열하면 학생이 첫 표를
        //      자기 세율로 오인한다. **항·호 서두를 표와 함께** 살려야 원문이 원문 구실을 한다.
        //   ③ 표 일부는 `<img>` 로도 제공된다 — 텍스트 표는 그대로 두고 img 태그만 제거한다.
        const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<img[^>]*>/gi, '').replace(/<[^>]+>/g, '').trimEnd()
        const parts: string[] = []
        const push = (s: string) => { const t = clean(s); if (t.trim()) parts.push(t) }
        push(tag(a, '조문내용'))
        for (const h of Array.from(a.matchAll(/<항>([\s\S]*?)<\/항>/g))) {
          push(tag(h[1], '항내용'))
          for (const ho of Array.from(h[1].matchAll(/<호>([\s\S]*?)<\/호>/g))) push(tag(ho[1], '호내용'))
        }
        const text = parts.join('\n\n')
        const rev = /개정\s*[\d., ]+/.exec(text)?.[0]?.trim() ?? ''
        return { no, title, text, revised: rev }
      })
      .filter(a => a.title && articleFilter(a.title, a.no))

    const out: LawDoc = {
      name: tag(hit, '법령명한글'),
      effective: tag(hit, '시행일자'),
      promulgated: tag(hit, '공포일자'),
      link: `${BASE}/DRF/lawService.do?OC=${encodeURIComponent(LAW_OC)}&target=law&MST=${mst}&type=HTML`,
      articles,
    }
    if (out.articles.length) await setCache(ck, out)   // 조문 0개면 캐시하지 않는다(파싱 실패 박제 금지)
    return out
  } catch { return null }
}

/** 📌 고시·훈령이 **무엇을 정하는 것인지** 한 줄 — 제목만으론 알 수 없어서 붙인다.
 *  예: "수도권 분양가상한제 인근지역 주택매매가격의 결정지침" → "거주의무기간·전매제한기간·매입금액을 정함"
 *
 *  ⚠️ 실측(2026-08-09): 행정규칙 본문은 `<조문단위>` 가 없고 `<조문내용>` 이 나열된다(법률과 구조가 다르다).
 *     `조문형식여부=Y` 면 첫 조문내용이 대개 제1조(목적)이고, `N` 이면 목적 조문 없이 바로 본문이다
 *     (예: '기본형건축비' 고시는 "1. 지상층건축비 …"로 시작). 둘 다 첫 내용을 쓰되 접두만 정리한다.
 *  ⛔ 정규식을 늘려 문장을 재조립하지 않는다 — 이 프로젝트에서 그 방향은 11번째 표기가 나올 때까지 끝나지 않았다.
 *     원문 문장을 그대로 주고 **자르는 건 화면**이 한다. */
export async function getAdmRulePurpose(id: string): Promise<string | null> {
  if (!id) return null
  const ck = `law-admrul-purpose-v2:${id}`   // v2: 접두 제거 폐기(문장 훼손) — 저장된 문자열이 바뀌므로 범프
  const cached = await getCache<{ p: string }>(ck, 30 * 86400_000)   // 이미 발령된 고시 본문은 바뀌지 않는다
  if (cached) return cached.p || null
  try {
    const r = await fetch(`${BASE}/DRF/lawService.do?OC=${encodeURIComponent(LAW_OC)}&target=admrul&ID=${encodeURIComponent(id)}&type=XML`,
      { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return null
    const xml = await r.text()
    const raw = tag(xml, '조문내용')
    if (!raw) return null
    // ⚠️ "이 지침은/이 고시는" 접두까지 지우려다 문장을 망가뜨렸다(2026-08-09 라이브):
    //    `은?` 이 '는'을 못 잡아 "는 「주택법」…"이 되고, 목록에 없는 '기준'은 아예 안 잘렸다.
    //    종류 이름을 계속 추가하는 방향은 11번째 표기가 나올 때까지 끝나지 않는다 —
    //    **접두 제거를 포기한다.** "이 지침은 ~을 목적으로 한다"가 원래 자연스러운 문장이다.
    const p = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s*제1조\s*\(\s*목적\s*\)\s*/, '')   // 조문 번호만 뗀다(화면에 이미 조문 맥락이 있다)
      .replace(/\s+/g, ' ')
      .trim()
    if (p) await setCache(ck, { p })
    return p || null
  } catch { return null }
}

/** 여러 키워드를 모아 **행정규칙명 기준 중복 제거**. 캐시 6h(고시는 하루에 몇 건 수준). */
export async function collectAdmRules(keywords: string[]): Promise<{ rules: AdmRule[]; failed: number }> {
  // ⚠️ v2: AdmRule 에 `id`(목적 조회 키)를 **추가**했다 → 키를 올리지 않으면 옛 캐시가 id 없이 서빙돼
  //    목적이 전부 undefined 로 온다(실제로 겪었다). "필드가 늘어도 키를 올려라"는 이래서 있다.
  const ck = `law-admrul-v2:${keywords.join(',')}`
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
