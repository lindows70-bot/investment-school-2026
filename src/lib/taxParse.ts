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

/** 🚫 뜻이 없는 구간명 — "양도소득 과세표준의" 처럼 문장이 잘려 남은 조각. 숫자만 덩그러니 남으면 오해를 부른다.
 *  구간명이 **다른 조문을 가리키는 문장**인 것도 같다("제55조제1항에 따른 세율(분양권의 경우에는 …" → 60%).
 *  그 줄은 세율의 '적용 대상'이 아니라 참조라서, 학생이 읽으면 무엇에 60%가 붙는지 알 수 없다. */
const isNoiseBand = (b: string): boolean =>
  b.length < 2 || /^양도소득\s*과세표준의?$/.test(b) || /따른\s*세율에?$/.test(b) || /^그\s*세율의?$/.test(b)
  || isLegalRef(b)

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
  // ⚠️ 다만 **전부 걷어내 아무것도 안 남은 조문**은 '안 보여준 것'이 아니라 '못 읽은 것'이다.
  //    소득세법 제104조가 그렇다 — 세율은 있는데 대상이 전부 "제55조제1항에 따른 세율(…"이라
  //    무엇에 60~75%가 붙는지 읽을 수 없다. 이걸 정상으로 두면 화면엔 기본세율 6~45%만 남아
  //    "단기매매도 최대 45%"라는 **반대 방향의 오해**를 준다(처음엔 60~75%만 보여 반대로 틀렸다).
  const wipedOut = p.groups.length > 0 && groups.length === 0
  return { groups, partial: p.partial || wipedOut, hidden: p.groups.length - groups.length }
}

/** 💸 '깎아주는 것'(공제)과 '매기는 것'(세율)은 성격이 다르다 — 한 덩어리로 보여주면 세율로 오해한다. */
export const isDeduction = (title: string): boolean => /공제/.test(title)

/** 🚫 그룹 제목이 '항 서두 문장'인 경우 — 표 위의 항이 통째로 제목이 된다
 *  ("거주자의 종합소득에 대한 소득세는 해당 연도의 …"). 화면엔 조문 헤더가 이미 있으니 생략한다. */
export const isSentenceTitle = (t: string): boolean => t.length > 40

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

/** 📊 A. 박스 표 행 — `│구간│세율│`. 구분선·헤더는 null */
function tableRow(ln: string): TaxRow | null {
  const cells = ln.split('│').map(c => c.trim()).filter(Boolean)
  if (cells.length < 2) return null
  const [band, rate] = cells
  if (/^과세표준$/.test(band) || /^세\s*율$/.test(rate)) return null   // 헤더
  const pct = toPct(rate)
  return pct ? { band, rate: pct, plus: leadAmount(rate) } : null
}

/** 📋 B. 나열 행 — "N. 항목: 1천분의 35" 처럼 한 줄에 대상과 세율이 같이 오는 서식 */
function listRow(ln: string): TaxRow | null {
  const pct = toPct(ln)
  if (!pct) return null
  // 번호와 세율 표현을 걷어낸 나머지를 대상명으로
  //   `가.`·`나.`·`다.` 는 목(目) 번호다 — 세율의 절반이 여기 있다("가. 농지: 1천분의 23").
  const band = ln
    .replace(/^\s*(?:\d+\.|[가-힣]\.)\s*/, '')
    .replace(/[::]?\s*(?:1?천분의|100분의)\s*[\d.]+.*$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // 대상명이 지나치게 길면 문장이지 항목이 아니다 · '삭제'된 호는 실체가 없다
  if (!band || band.length > 60 || /^삭제/.test(band)) return null
  return { band, rate: pct }
}

/** 한 묶음을 줄 단위로 읽는다.
 *  ⚠️ **"박스 문자를 봤다"를 "표다"로 쓰면 안 된다**(2026-08-10 손 채점): 지방세법 제11조제8호에는
 *     세율표가 아니라 **지분 계산식**이 박스로 그려져 있다. 그걸 표 시작으로 읽는 순간 뒤따르는
 *     목(가·나·다)이 전부 표 파서로 넘어가 `│`가 없다는 이유로 버려졌고, 학생이 가장 알아야 할
 *     **주택 유상거래 1.0%·3.0%** 가 사라졌다. 표 여부는 **실제로 표 행을 읽었을 때만** 참이다. */
function parseLines(lines: string[]): { rows: TaxRow[]; sawTable: boolean } {
  const rows: TaxRow[] = []
  let sawTable = false
  for (const ln of lines) {
    if (ln.includes('│')) { const r = tableRow(ln); if (r) { rows.push(r); sawTable = true } ; continue }
    if (BOX.test(ln)) continue   // 표·계산식 테두리
    const r = listRow(ln)
    if (r) rows.push(r)
  }
  return { rows, sawTable }
}

/** 조문 원문 → 그룹 목록. 그룹 제목은 표/나열 **바로 위**의 "N. …" 또는 "① …" 줄. */
export function parseTaxArticle(text: string): ParsedArticle {
  const lines = text.split('\n')
  const groups: TaxGroup[] = []
  let title = ''
  let buf: string[] = []

  // ⚠️ 나열 형식엔 '그룹' 개념이 없다 — 각 호가 독립 항목이다(손 채점에서 "상속으로 인한 취득"이
  //    제목이 되고 그 아래 무관한 호들이 붙었다). 표가 있을 때만 직전 제목을 그룹명으로 쓰고,
  //    나열은 **하나로 합친다**.
  const LIST_TITLE = '적용 세율'
  const flush = () => {
    if (!buf.length) return
    const { rows, sawTable: isTable } = parseLines(buf)
    if (rows.length) {
      const prev = groups[groups.length - 1]
      if (!isTable && prev && prev.title === LIST_TITLE) prev.rows.push(...rows)
      else groups.push({ title: isTable ? (title || LIST_TITLE) : LIST_TITLE, rows })
    }
    buf = []
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
    buf.push(ln)
  }
  flush()

  // ⚠️ partial 이 묻는 것은 "빠짐없이 읽었나"가 아니라 **"화면의 대표 숫자가 오해를 부르나"** 다.
  //    개수 비교(원문 세율 표현 수 > 읽은 행 수)를 먼저 썼는데 양쪽으로 틀렸다(2026-08-10):
  //      · 놓침 — 양도세는 기본세율이 "제55조에 따른 세율"이라 **숫자가 아예 없어** 세지 못했고,
  //               남은 중과세율만으로 "60~75%"가 크게 떴다(실제 기본세율은 6~45%).
  //      · 과잉 — 취득세는 한 줄에 세율이 둘인 단서("…3.5. 다만 비영리는 2.8") 하나 때문에
  //               1~4% 를 통째로 감췄다. 2.8% 는 이미 그 범위 안이라 감출 이유가 없다.
  //    → **원문의 모든 세율 숫자가 읽어낸 범위 안에 들어오는지**로 판정한다. 밖에 있으면 대표 숫자가
  //      거짓이 되므로 감추고, 안에 있으면 범위는 여전히 참이다.
  const parsed = groups.flatMap(g => g.rows).map(r => parseFloat(r.rate)).filter(n => isFinite(n))
  if (!parsed.length) return { groups, partial: true }
  const lo = Math.min(...parsed), hi = Math.max(...parsed)
  const outside = Array.from(text.matchAll(/(?:(1?천분의)|100분의)\s*(\d+(?:\.\d+)?)/g))
    .map(m => (m[1] ? Number(m[2]) / 10 : Number(m[2])))
    .some(v => v < lo - 1e-9 || v > hi + 1e-9)
  return { groups, partial: outside }
}
