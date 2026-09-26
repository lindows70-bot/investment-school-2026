// docs/student-mode/quotes.md 표를 그대로 파싱해 src/lib/quotes.ts 를 생성하는 1회성 스크립트 — 명언 텍스트를 손으로 옮기지 않는다
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const MD_PATH = `${ROOT}/docs/student-mode/quotes.md`
const OUT_PATH = `${ROOT}/src/lib/quotes.ts`

const lines = readFileSync(MD_PATH, 'utf8').split('\n')

/** 인물 소제목의 짧은 성만으로 전체 이름을 되찾기 (B22 처럼 '~의 말을 ~이 인용' 문구에서만 쓴다) */
const NAME_MAP = {
  그레이엄: '벤저민 그레이엄',
  버핏: '워런 버핏',
  린치: '피터 린치',
  멍거: '찰리 멍거',
  막스: '하워드 막스',
  보글: '존 보글',
  템플턴: '존 템플턴',
  피셔: '필립 피셔',
}

/**
 * source 원문에서 화면에 보일 문구만 뽑아낸다(source 자체는 안 건드리고 그대로 둔다).
 * quotes.md 전수 스캔 결과(2026-09-26) 제거 대상은 이 두 가지뿐이다:
 *   ① 마크다운 강조 기호 **, __, ` — B22 "**그레이엄의 말을 버핏이 인용**" 하나뿐
 *   ② "(화면에 ... 표기)" 형태의 편집 지시 괄호 — B22 "(화면에 그렇게 표기)" 하나뿐
 * (책 제목 안의 괄호 — 예: L01 "『One Up on Wall Street』" 의 영문 원제 괄호, C01 『Poor Charlie's
 *  Almanack』 — 는 출처의 일부이므로 건드리지 않는다. "화면에" 가 없는 괄호는 전부 보존한다.)
 */
function toSourceLabel(source) {
  let label = source
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/\(화면에[^)]*\)/g, '')
  label = label.replace(/\s+/g, ' ').trim()
  return label
}

let person = null
let headingNote = null // 소제목에만 있고 표 각 행 출처엔 없는 맥락(예: 템플턴 "16 Rules ... (1993)")
const quotes = []

for (const line of lines) {
  const h = line.match(/^## (.+)$/)
  if (h) {
    const text = h[1].trim()
    if (/\(다시 넣지 말 것\)/.test(text)) {
      person = null
      headingNote = null
      continue
    }
    const countMatch = text.match(/\((\d+)\)\s*$/)
    if (!countMatch) {
      person = null
      headingNote = null
      continue
    }
    const withoutCount = text.slice(0, countMatch.index).trim()
    const dashIdx = withoutCount.indexOf('—')
    if (dashIdx === -1) {
      person = withoutCount.trim()
      headingNote = null
    } else {
      person = withoutCount.slice(0, dashIdx).trim()
      headingNote = withoutCount.slice(dashIdx + 1).trim()
    }
    continue
  }

  const row = line.match(/^\|\s*([A-Z][0-9]{2})\s*\|(.*)\|(.*)\|(.*)\|\s*$/)
  if (row && person) {
    const [, id, koRaw, originalRaw, sourceRaw] = row
    const ko = koRaw.trim()
    const original = originalRaw.trim()
    const source = sourceRaw.trim()

    const q = { id, person, ko, original, source, sourceLabel: toSourceLabel(source) }

    // 표 각 행 출처에 4자리 연도가 없으면(=소제목에만 있으면) 소제목 맥락을 note 로 그대로 옮긴다
    if (headingNote && !/\d{4}/.test(source)) {
      q.note = headingNote
    }

    // B22 같은 "OO의 말을 XX이 인용" 표기 — source 문자열 자체는 원문 그대로 두고
    // person/quotedBy 로 화면 표시용 귀속만 분리해 둔다
    const quoted = source.match(/\*\*(\S+?)의 말을 (\S+?)이 인용\*\*/)
    if (quoted) {
      const [, who, by] = quoted
      q.person = NAME_MAP[who] || who
      q.quotedBy = NAME_MAP[by] || by
    }

    quotes.push(q)
  }
}

if (quotes.length !== 51) {
  console.error(`❌ 51개가 아니라 ${quotes.length}개 파싱됨 — quotes.md 표 형식을 확인하라`)
  process.exit(1)
}

const body = quotes
  .map((q) => {
    const fields = [
      `id: ${JSON.stringify(q.id)}`,
      `person: ${JSON.stringify(q.person)}`,
      `ko: ${JSON.stringify(q.ko)}`,
      `original: ${JSON.stringify(q.original)}`,
      `source: ${JSON.stringify(q.source)}`,
      `sourceLabel: ${JSON.stringify(q.sourceLabel)}`,
    ]
    if (q.quotedBy) fields.push(`quotedBy: ${JSON.stringify(q.quotedBy)}`)
    if (q.note) fields.push(`note: ${JSON.stringify(q.note)}`)
    return `  { ${fields.join(', ')} },`
  })
  .join('\n')

const ts = `// 오늘의 명언 51개 상수 — docs/student-mode/quotes.md 원문 확인 목록에서 scripts/generate-quotes.mjs 로 그대로 옮김(손으로 옮기지 않음)
export interface Quote {
  id: string
  person: string
  ko: string
  original: string
  source: string
  /** 화면 표시용 — source 에서 마크다운 강조 기호와 "(화면에 ... 표기)" 같은 편집 지시 괄호를 뺀 문구 */
  sourceLabel: string
  /** B22 처럼 person 이 실제로 한 말을 다른 사람이 인용한 경우, 인용한 사람 */
  quotedBy?: string
  /** 표 각 행 출처엔 없고 소제목에만 있는 맥락(예: 템플턴 "16 Rules for Investment Success (1993)") */
  note?: string
}

export const QUOTES: Quote[] = [
${body}
]

const EPOCH_UTC = Date.UTC(2026, 0, 1) // 2026-01-01 고정 기준일 — 이 값을 바꾸면 기존에 나간 날짜별 명언이 전부 바뀐다
const DAY_MS = 24 * 60 * 60 * 1000

/** todayKst 는 'YYYY-MM-DD' 형식의 KST 날짜 문자열. Date.now() 를 쓰지 않는 순수 함수 — 기준일부터 며칠째인지를 51로 나눈 나머지로 순환한다 */
export function quoteOfDay(todayKst: string): Quote {
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(todayKst)
  if (!m) throw new Error(\`quoteOfDay: 잘못된 날짜 형식 "\${todayKst}" (YYYY-MM-DD 필요)\`)
  const [, y, mo, d] = m
  const ts = Date.UTC(Number(y), Number(mo) - 1, Number(d))
  const days = Math.floor((ts - EPOCH_UTC) / DAY_MS)
  const idx = ((days % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[idx]
}
`

writeFileSync(OUT_PATH, ts, 'utf8')
console.log(`✅ ${quotes.length}개 명언 → ${OUT_PATH}`)
