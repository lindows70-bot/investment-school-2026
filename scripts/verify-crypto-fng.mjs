// 코인 공포·탐욕 파서 검증 — 지금·어제·1주·1달 인덱스, 짧은 응답·깨진 값·빈 응답, KST 기준일 변환
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-cfng`

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
  include: [`${ROOT}/src/lib/cryptoFng.ts`],
}
writeFileSync(`${ROOT}/.bt-cfng.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 타입 에러로 아무것도 못 내놔도 옛 .js 로 거짓 green
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-cfng.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/cryptoFng.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const M = require(`${OUT}/lib/cryptoFng.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

// 실측 모양(최신순, 문자열 값, 초 단위 UTC 자정 timestamp, 하루 1행 연속). 값 = 100 - (며칠 전) 로 어느 날을 골랐는지 드러낸다
const DAY = 86400
const T0 = 1790380800   // 2026-09-26T00:00:00Z (2026-09-26 실측 data[0])
const mk = (n) => ({
  name: 'Fear and Greed Index',
  data: Array.from({ length: n }, (_, i) => ({ value: String(100 - i), value_classification: i === 0 ? 'Greed' : 'Fear', timestamp: String(T0 - i * DAY) })),
  metadata: { error: null },
})

const full = M.parseFng(mk(31))
check('31개 → now = data[0]', full?.now === 100)
check('31개(연속) → yesterday = 1일 전', full?.yesterday === 99)
check('31개(연속) → weekAgo = 7일 전', full?.weekAgo === 93)
check('31개(연속) → monthAgo = 30일 전', full?.monthAgo === 70)
check('31개 → cls = data[0] 분류', full?.cls === 'Greed')
check('실측 timestamp 1790380800 → 2026-09-26', full?.date === '2026-09-26')

const short = M.parseFng(mk(5))
check('5개뿐 → now·yesterday 있음', short?.now === 100 && short?.yesterday === 99)
check('5개뿐 → weekAgo null', short?.weekAgo === null)
check('5개뿐 → monthAgo null', short?.monthAgo === null)

const one = M.parseFng(mk(1))
check('1개뿐 → yesterday null', one?.now === 100 && one?.yesterday === null)

// 빠진 날 — 원천 이력에 실제로 있다(2024-10-26, 2018-04-14~16). 줄 번호로 세면 기간이 조용히 밀린다
const without = (n, ...daysAgo) => {
  const j = mk(n)
  j.data = j.data.filter(r => !daysAgo.includes((T0 - Number(r.timestamp)) / DAY))
  return j
}
const g3 = M.parseFng(without(40, 3))
check('3일 전이 빠져도 weekAgo = 정확히 7일 전 값(93)', g3?.weekAgo === 93)
check('3일 전이 빠져도 monthAgo = 정확히 30일 전 값(70)', g3?.monthAgo === 70)
check('3일 전이 빠져도 yesterday = 1일 전 값(99)', g3?.yesterday === 99)
const g7 = M.parseFng(without(40, 7))
check('7일 전이 빠지면 weekAgo null(6·8일 전으로 메우지 않음)', g7?.weekAgo === null)
check('7일 전이 빠져도 monthAgo 는 그대로(70)', g7?.monthAgo === 70)
const g1 = M.parseFng(without(40, 1))
check('1일 전이 빠지면 yesterday null(2일 전 98 아님)', g1?.yesterday === null)
const g30 = M.parseFng(without(40, 30))
check('30일 전이 빠지면 monthAgo null(31일 전 69 아님)', g30?.monthAgo === null)

const bad = mk(31)
bad.data[1].value = 'abc'
bad.data[7].value = ''
bad.data[30].value = null
const b = M.parseFng(bad)
check('숫자 아닌 값 → null(yesterday)', b?.yesterday === null)
check('빈 문자열 → 0 이 아니라 null(weekAgo)', b?.weekAgo === null)
check('null 값 → null(monthAgo)', b?.monthAgo === null)

const badNow = mk(31)
badNow.data[0].value = 'N/A'
check('now 가 숫자 아님 → 전체 null', M.parseFng(badNow) === null)

const noCls = mk(3)
delete noCls.data[0].value_classification
check('분류 없음 → cls null', M.parseFng(noCls)?.cls === null)

check('빈 배열 → null', M.parseFng({ data: [] }) === null)
check('data 없음 → null', M.parseFng({ metadata: { error: 'x' } }) === null)
check('null 입력 → null', M.parseFng(null) === null)
check('문자열 입력 → null', M.parseFng('oops') === null)
check('data 가 객체 → null', M.parseFng({ data: { value: '5' } }) === null)

// UTC 20:00 = KST 다음 날 05:00 — +9h 를 증명(UTC 날짜를 그대로 쓰면 09-25 가 나온다)
const late = { data: [{ value: '40', value_classification: 'Fear', timestamp: String(T0 - 4 * 3600) }] }
check('UTC 2026-09-25 20:00 → KST 2026-09-26', M.parseFng(late)?.date === '2026-09-26')
const early = { data: [{ value: '40', value_classification: 'Fear', timestamp: String(T0 - 10 * 3600) }] }
check('UTC 2026-09-25 14:00 → KST 2026-09-25(경계 아래)', M.parseFng(early)?.date === '2026-09-25')
const noTs = { data: [{ value: '40', value_classification: 'Fear' }] }
check('timestamp 없음 → date null(값은 유지)', M.parseFng(noTs)?.date === null && M.parseFng(noTs)?.now === 40)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (코인 공포·탐욕)')
process.exit(fail ? 1 : 0)
