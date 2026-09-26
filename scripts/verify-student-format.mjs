// 학생 화면 숫자 표기 검증 — studentFormat(원화·달러·부호·등락률·등락 색·수량)이 화면마다 같은 규칙을 내는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module, { createRequire } from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-sfmt`

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
  // studentFormat 이 '@/lib/theme' 를 import 하므로 theme.ts 도 함께 컴파일한다
  include: [`${ROOT}/src/lib/studentFormat.ts`, `${ROOT}/src/lib/theme.ts`],
}
writeFileSync(`${ROOT}/.bt-sfmt.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-sfmt.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

const outFile = `${OUT}/lib/studentFormat.js`
if (!existsSync(outFile)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/x' → 컴파일된 .bt-sfmt/x (소스 .ts 가 아니라 tsc 출력 .js 로 매핑해야 require 가 성공한다)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const require = createRequire(import.meta.url)
const F = require(outFile)
const { TK } = require(`${OUT}/lib/theme.js`)

let fail = 0
function check(label, got, want) {
  const ok = got === want
  console.log(`${ok ? '✅' : '❌'} ${label} → ${JSON.stringify(got)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`)
  if (!ok) fail++
}

check('won(1234567.4) — 100원 이상은 정수', F.won(1234567.4), '1,234,567원')
check('won(12.345) — 1~100원은 소수 둘째 자리', F.won(12.345), '12.35원')
check('won(0.015) — 1원 미만은 유효숫자 8자리(0.02 로 망가지지 않음)', F.won(0.015), '0.015원')
check('usd(12.5) — 달러는 항상 소수 둘째 자리', F.usd(12.5), '$12.50')
check('money(12.5, USD) = usd', F.money(12.5, 'USD'), '$12.50')
check('money(0.015, null) = 원화', F.money(0.015, null), '0.015원')
check('pct(0.04) — 보합은 0.0%(부호 없음)', F.pct(0.04), '0.0%')
check('pct(-0.04) — −0.0% 아님', F.pct(-0.04), '0.0%')
check('pct(-1.23) — 음수 부호는 U+2212', F.pct(-1.23), '\u22121.2%')
check('pct(2.06) — 양수는 +', F.pct(2.06), '+2.1%')
check('signWon(0) — 0 은 부호 없음', F.signWon(0), '0원')
check('signWon(-12345) — 음수 부호는 U+2212', F.signWon(-12345), '\u221212,345원')
check('signWon(500) — 양수는 +', F.signWon(500), '+500원')
check('manWon(29985275) — 만원 단위 반올림', F.manWon(29985275), '2,999만')
check('manWon(-29985275) — 음수 부호는 U+2212', F.manWon(-29985275), '−2,999만')
check('manWon(-5000) — 1만 원 미만 음수도 U+2212', F.manWon(-5000), '−5,000원')
check('qtyText(0.1+0.2, CRYPTO) — 부동소수 잡음 없음 · 코인은 개', F.qtyText(0.1 + 0.2, 'CRYPTO'), '0.3개')
check('qtyText(10, KR) — 주식은 주', F.qtyText(10, 'KR'), '10주')
check('upDown(null) — 값 없음은 회색', F.upDown(null), TK.sub)
check('upDown(0.04) — 보합은 회색(pct 0.0% 와 같은 경계)', F.upDown(0.04), TK.sub)
check('upDown(1) — 오름 빨강(한국식)', F.upDown(1), TK.red400)
check('upDown(-1) — 내림 파랑(한국식)', F.upDown(-1), TK.blue400)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (학생 화면 숫자 표기)')
process.exit(fail ? 1 : 0)
