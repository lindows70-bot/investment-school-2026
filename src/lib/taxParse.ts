// 💰 세율 조문 → 학생이 읽을 수 있는 구조로 (순수 함수·결정론)
//
// ⚠️ 이 파일의 유일한 위험: **틀리면 학생이 세금을 잘못 안다.** 그래서 규칙을 좁게 잡는다.
//  ① 표를 **고르지 않는다** — 조문 안의 모든 그룹(2주택 이하 / 3주택 이상 / 법인)을 각각 라벨과 함께 낸다.
//     하나만 뽑아 "이게 세율"이라고 하면 오설명이 되기 때문이다.
//  ② 못 읽은 줄은 **버리지 않고 raw 로 남긴다** — 조용히 사라지면 학생은 그게 없는 줄 안다.
//  ③ 화면은 원문을 접이식으로 함께 제공한다(파싱을 학생이 검증할 수 있게).
//
// 실측(2026-08-09)으로 확인한 두 가지 서식:
//  A. 표 형식(종부세 제9·14조) — `│과세표준│세율│` 박스 표. 그룹 제목은 표 바로 위의 "N. …인 경우".
//  B. 나열 형식(지방세법 제11조·소득세법 제104조) — "N. 항목명: 1천분의 35" / "… 100분의 40".

export interface TaxRow {
  band: string      // 구간·대상 (예: "3억원 초과 6억원 이하", "원시취득")
  rate: string      // 사람이 읽는 세율 (예: "0.7%")
  plus?: string     // 누진공제 성격의 가산액 (예: "+150만원")
}
export interface TaxGroup {
  title: string     // 적용 대상 (예: "납세의무자가 2주택 이하를 소유한 경우")
  rows: TaxRow[]
}
export interface ParsedArticle {
  groups: TaxGroup[]
  /** 규칙으로 못 읽은 부분이 있으면 true — 화면이 "원문도 함께 보세요"를 강조한다 */
  partial: boolean
}

/** 🚫 학생이 못 읽는 제목 — "제94조제1항제4호다목 및 라목에 따른 자산 중 …"을 읽을 수 있는 학생은 없다.
 *  법률끼리 서로를 가리키는 참조는 원문에서 보면 되고, 요약 화면에는 **읽히는 것만** 남긴다. */
export const isLegalRef = (t: string): boolean =>
  /제\s*\d+\s*조/.test(t) || /제\s*\d+\s*항/.test(t) || /제\s*\d+\s*호/.test(t)

/** 🚫 뜻이 없는 구간명 — "양도소득 과세표준의" 처럼 문장이 잘려 남은 조각. 숫자만 덩그러니 남으면 오해를 부른다. */
const isNoiseBand = (b: string): boolean =>
  b.length < 2 || /^양도소득\s*과세표준의?$/.test(b) || /따른\s*세율에?$/.test(b) || /^그\s*세율의?$/.test(b)

/** 📉 세율 범위 — 카드 앞면에 "한눈에" 보여줄 대표 숫자(예: `0.5~2.7%`) */
export function rateRange(rows: TaxRow[]): string | null {
  const ns = rows.map(r => parseFloat(r.rate)).filter(n => isFinite(n))
  if (!ns.length) return null
  const lo = Math.min(...ns), hi = Math.max(...ns)
  return lo === hi ? `${lo}%` : `${lo}~${hi}%`
}

/** 🧹 화면용 정리 — 읽히지 않는 그룹·구간을 걷어낸다.
 *  ⚠️ **`hidden`(안 보여준 것)과 `partial`(못 읽은 것)은 다르다.** 둘을 같은 플래그로 묶었더니
 *     정리만 해도 partial 이 켜져 **세 카드가 전부 "원문 확인"** 이 됐다(2026-08-09 라이브).
 *     종부세는 세율표를 완전히 읽었는데도 숫자를 잃었다 — 숨긴 것은 신뢰도를 떨어뜨리지 않는다. */
export function cleanForStudents(p: ParsedArticle): ParsedArticle & { hidden: number } {
  const groups = p.groups
    .map(g => ({ ...g, rows: g.rows.filter(r => !isNoiseBand(r.band)) }))
    .filter(g => g.rows.length > 0)
    .filter(g => !isLegalRef(g.title))
  return { groups, partial: p.partial, hidden: p.groups.length - groups.length }
}

/** 💸 '깎아주는 것'(공제)과 '매기는 것'(세율)은 성격이 다르다 — 한 덩어리로 보여주면 세율로 오해한다. */
export const isDeduction = (title: string): boolean => /공제/.test(title)

/** `1천분의 7` → `0.7%` · `100분의 40` → `40%` · `천분의 5` → `0.5%` */
function toPct(s: string): string | null {
  const m1 = /(?:1)?천분의\s*(\d+(?:\.\d+)?)/.exec(s)
  if (m1) return `${Math.round(Number(m1[1]) * 10) / 100}%`
  const m2 = /100분의\s*(\d+(?:\.\d+)?)/.exec(s)
  if (m2) return `${Number(m2[1])}%`
  const m3 = /(\d+(?:\.\d+)?)\s*(?:퍼센트|%)/.exec(s)
  if (m3) return `${Number(m3[1])}%`
  return null
}

/** `150만원+(3억원을 …)` → `+150만원` (누진공제 성격의 정액) */
function leadAmount(s: string): string | undefined {
  const m = /^\s*([\d,]+(?:억)?(?:\s*)?(?:천)?[\d,]*\s*만?원)\s*\+/.exec(s)
  return m ? `+${m[1].replace(/\s/g, '')}` : undefined
}

const BOX = /[┌┬┐├┼┤└┴┘─]/

/** 📊 A. 박스 표 파싱 — `│구간│세율│` 행만 취한다(구분선·헤더 제외) */
function parseTable(lines: string[]): TaxRow[] {
  const rows: TaxRow[] = []
  for (const ln of lines) {
    if (!ln.includes('│')) continue
    const cells = ln.split('│').map(c => c.trim()).filter(Boolean)
    if (cells.length < 2) continue
    const [band, rate] = cells
    if (/^과세표준$/.test(band) || /^세\s*율$/.test(rate)) continue   // 헤더
    const pct = toPct(rate)
    if (!pct) continue
    rows.push({ band, rate: pct, plus: leadAmount(rate) })
  }
  return rows
}

/** 📋 B. 나열 파싱 — "N. 항목: 1천분의 35" 처럼 한 줄에 대상과 세율이 같이 오는 서식 */
function parseList(lines: string[]): TaxRow[] {
  const rows: TaxRow[] = []
  for (const ln of lines) {
    if (BOX.test(ln)) continue
    const pct = toPct(ln)
    if (!pct) continue
    // 번호와 세율 표현을 걷어낸 나머지를 대상명으로
    const band = ln
      .replace(/^\s*\d+\.\s*/, '')
      .replace(/[::]?\s*(?:1?천분의|100분의)\s*[\d.]+.*$/, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    // 대상명이 지나치게 길면 문장이지 항목이 아니다 · '삭제'된 호는 실체가 없다
    if (!band || band.length > 60 || /^삭제/.test(band)) continue
    rows.push({ band, rate: pct })
  }
  return rows
}

/** 조문 원문 → 그룹 목록. 그룹 제목은 표/나열 **바로 위**의 "N. …" 또는 "① …" 줄. */
export function parseTaxArticle(text: string): ParsedArticle {
  const lines = text.split('\n')
  const groups: TaxGroup[] = []
  let title = ''
  let buf: string[] = []
  let sawTable = false

  // ⚠️ 나열 형식엔 '그룹' 개념이 없다 — 각 호가 독립 항목이다(손 채점에서 "상속으로 인한 취득"이
  //    제목이 되고 그 아래 무관한 호들이 붙었다). 표가 있을 때만 직전 제목을 그룹명으로 쓰고,
  //    나열은 **하나로 합친다**.
  const LIST_TITLE = '적용 세율'
  const flush = () => {
    if (!buf.length) return
    const rows = sawTable ? parseTable(buf) : parseList(buf)
    if (rows.length) {
      const prev = groups[groups.length - 1]
      if (!sawTable && prev && prev.title === LIST_TITLE) prev.rows.push(...rows)
      else groups.push({ title: sawTable ? (title || LIST_TITLE) : LIST_TITLE, rows })
    }
    buf = []; sawTable = false
  }

  for (const ln of lines) {
    // ⚠️ 번호 줄이라고 무조건 '제목'으로 삼으면 안 된다(2026-08-09 손 채점에서 취득세 파싱이 0이었다):
    //    지방세법 제11조는 "2. 제1호 외의 무상취득: 1천분의 35" 처럼 **번호 줄 자체에 세율**이 있다.
    //    그 줄을 제목으로 소비해버려 항목이 하나도 안 남았다.
    //    → 세율이 없는 번호 줄만 제목이고, 세율이 있으면 항목으로 흘려보낸다.
    const numbered = /^\s*(?:\d+\.|[①②③④⑤⑥⑦⑧⑨⑩])\s*\S/.test(ln) && !BOX.test(ln)
    if (numbered && !toPct(ln)) {
      flush()   // 새 제목을 만나면 직전 묶음을 마감한다(그래야 표와 제목이 어긋나지 않는다)
      title = ln.replace(/^\s*(?:\d+\.|[①②③④⑤⑥⑦⑧⑨⑩])\s*/, '').replace(/\s+/g, ' ').trim()
      continue
    }
    if (BOX.test(ln)) sawTable = true
    buf.push(ln)
  }
  flush()

  const totalRows = groups.reduce((s, g) => s + g.rows.length, 0)
  // ⚠️ '전부 실패'만 잡으면 **부분 누락을 놓친다**(손 채점에서 실제로 겪었다):
  //    지방세법 제11조는 별표 참조가 섞여 있어, 정작 가장 중요한 **주택 유상거래 취득세(1~3%)** 가
  //    빠진 채 무상취득 3.5%만 남았다. 그대로 두면 학생이 "취득세는 3.5%"로 오해한다.
  //    → 원문의 세율 표현 개수와 실제로 읽어낸 행 수를 비교해 **못 읽은 게 있으면 알린다**.
  const rateWords = (text.match(/(?:1?천분의|100분의)\s*\d/g) ?? []).length
  return { groups, partial: rateWords > totalRows }
}
