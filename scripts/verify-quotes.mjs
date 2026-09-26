// 명언 상수(src/lib/quotes.ts)가 docs/student-mode/quotes.md 원문과 글자 그대로 일치하는지, 순환 함수가 규칙대로 도는지 검증
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-quotes`

const tsconfig = {
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT,
    module: 'commonjs',
    moduleResolution: 'node',
    noEmit: false,
    declaration: false,
    incremental: false,
    noEmitOnError: true,
    target: 'es2020',
    rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/quotes.ts`],
}
writeFileSync(`${ROOT}/.bt-quotes.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-quotes.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/quotes.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const M = require(`${OUT}/lib/quotes.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

// ── quotes.md 를 독립적으로 다시 파싱한다(생성 스크립트를 신뢰하지 않고, 원문과 직접 대조) ──
const md = readFileSync(`${ROOT}/docs/student-mode/quotes.md`, 'utf8')
const mdLines = md.split('\n')

let person = null
let headingNote = null
const mdQuotes = new Map() // id -> { person, ko, original, source, note? }

for (const line of mdLines) {
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
    const source = sourceRaw.trim()
    const entry = { person, ko: koRaw.trim(), original: originalRaw.trim(), source }
    if (headingNote && !/\d{4}/.test(source)) entry.note = headingNote
    mdQuotes.set(id, entry)
  }
}

check('quotes.md 에 51개 행', mdQuotes.size === 51)
check('QUOTES 도 51개', M.QUOTES.length === 51)

// ── id 중복 없음 ──
const ids = M.QUOTES.map((q) => q.id)
check('id 중복 없음', new Set(ids).size === ids.length)

// ── ko/original/source(+note) 글자 그대로 일치 — B22 는 person 이 인용 대상(그레이엄)으로 바뀌므로 별도 비교 ──
let mismatch = 0
for (const q of M.QUOTES) {
  const ref = mdQuotes.get(q.id)
  if (!ref) {
    console.log(`❌ ${q.id}: quotes.md 에 없는 id`)
    mismatch++
    continue
  }
  if (q.ko !== ref.ko) {
    console.log(`❌ ${q.id}: ko 불일치\n  코드: ${q.ko}\n  원문: ${ref.ko}`)
    mismatch++
  }
  if (q.original !== ref.original) {
    console.log(`❌ ${q.id}: original 불일치\n  코드: ${q.original}\n  원문: ${ref.original}`)
    mismatch++
  }
  if (q.source !== ref.source) {
    console.log(`❌ ${q.id}: source 불일치\n  코드: ${q.source}\n  원문: ${ref.source}`)
    mismatch++
  }
  if ((q.note ?? null) !== (ref.note ?? null)) {
    console.log(`❌ ${q.id}: note 불일치\n  코드: ${q.note}\n  원문: ${ref.note}`)
    mismatch++
  }
}
for (const id of mdQuotes.keys()) {
  if (!ids.includes(id)) {
    console.log(`❌ quotes.md 의 ${id} 가 QUOTES 에 없음`)
    mismatch++
  }
}
check('ko/original/source/note 51개 전부 원문과 글자 그대로 일치', mismatch === 0)

// ── B22: 그레이엄의 말을 버핏이 인용 — 표시용 귀속이 코드에 있는지 ──
const b22 = M.QUOTES.find((q) => q.id === 'B22')
check('B22 person = 벤저민 그레이엄', b22?.person === '벤저민 그레이엄')
check('B22 quotedBy = 워런 버핏', b22?.quotedBy === '워런 버핏')

// ── 제외 목록("다시 넣지 말 것")의 문구가 하나도 쓰이지 않았는지 ──
const exclSectionIdx = mdLines.findIndex((l) => /^## .*\(다시 넣지 말 것\)/.test(l))
const exclLines = mdLines.slice(exclSectionIdx + 1)
const excludedPhrases = []
for (const line of exclLines) {
  const cells = line.match(/^\|(.*)\|(.*)\|\s*$/)
  if (!cells) continue
  const firstCol = cells[1]
  const quoted = firstCol.match(/"([^"]+)"/g)
  if (quoted) {
    for (const q of quoted) excludedPhrases.push(q.slice(1, -1))
  }
}
check('제외 목록에서 인용문 파싱됨(0건이면 파서가 깨진 것)', excludedPhrases.length > 0)

const haystack = M.QUOTES.map((q) => `${q.ko}\u0000${q.original}\u0000${q.source}`).join('\u0001')
const foundExcluded = excludedPhrases.filter((p) => haystack.includes(p))
check('제외 목록 문구가 QUOTES 어디에도 없음', foundExcluded.length === 0)
if (foundExcluded.length) console.log('  발견됨:', foundExcluded)

// ── quoteOfDay: 순수성 · 같은 입력 → 같은 출력 ──
check('같은 날짜 → 같은 명언(호출 2회)', M.quoteOfDay('2026-09-26').id === M.quoteOfDay('2026-09-26').id)
check('같은 날짜 → 같은 명언(다른 순서로 재호출해도)', (() => {
  const a = M.quoteOfDay('2026-01-01')
  M.quoteOfDay('2027-05-05')
  const b = M.quoteOfDay('2026-01-01')
  return a.id === b.id
})())

// ── 연속 51일 → 51개 전부 다름(어느 시작일에서 재도 51일이면 한 바퀴) ──
function addDaysKst(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

for (const start of ['2026-01-01', '2026-09-26', '2027-01-01']) {
  const seen = new Set()
  for (let i = 0; i < 51; i++) {
    seen.add(M.quoteOfDay(addDaysKst(start, i)).id)
  }
  check(`연속 51일(${start} 부터) → 51개 전부 다른 id`, seen.size === 51)
}

// ── 52일째는 시작일과 같은 명언으로 되돌아온다(순환 확인) ──
check('52일째 = 시작일과 같은 명언(순환)', M.quoteOfDay(addDaysKst('2026-09-26', 51)).id === M.quoteOfDay('2026-09-26').id)

// ── 월/연도 경계 날짜도 동작(예외 없이 유효한 id 반환) ──
const boundaryDates = ['2026-01-31', '2026-02-01', '2026-12-31', '2027-01-01', '2028-02-29', '2028-03-01']
check('월/연도 경계 날짜 전부 유효한 id 반환', boundaryDates.every((d) => ids.includes(M.quoteOfDay(d).id)))

// ── 날짜 형식이 틀리면 던진다(조용히 잘못된 값을 돌려주지 않는다) ──
check('잘못된 날짜 형식은 예외', (() => {
  try {
    M.quoteOfDay('2026/09/26')
    return false
  } catch {
    return true
  }
})())

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (명언)')
process.exit(fail ? 1 : 0)
