// 로그인 착지 규칙 검증 — 역할·모드 쿠키별 착지 경로와, next 가 외부로 새는 열린 리다이렉트를 막는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-landing`

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
  include: [`${ROOT}/src/lib/landing.ts`],
}
writeFileSync(`${ROOT}/.bt-landing.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일 실패 시 옛 .js 로 거짓 green 이 난다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-landing.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/landing.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const M = require(`${OUT}/lib/landing.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

// ── 착지 경로 ──
check('쿠키 이름 = view_mode', M.VIEW_MODE_COOKIE === 'view_mode')
check('선생님 · 쿠키 없음 → 대시보드(지금 그대로)', M.landingPath('teacher', null) === '/dashboard')
check('학생 · 쿠키 없음 → 학생 홈', M.landingPath('student', null) === '/s')
check('역할 모름 · 쿠키 없음 → 학생 홈', M.landingPath(null, null) === '/s')
check('이상한 역할 문자열 → 학생 홈', M.landingPath('admin', null) === '/s')
check('학생 · full → 대시보드', M.landingPath('student', 'full') === '/dashboard')
check('선생님 · simple → 학생 홈', M.landingPath('teacher', 'simple') === '/s')
check('선생님 · full → 대시보드', M.landingPath('teacher', 'full') === '/dashboard')
check('학생 · simple → 학생 홈', M.landingPath('student', 'simple') === '/s')
check('모르는 쿠키 값 → 역할대로(선생님)', M.landingPath('teacher', 'weird') === '/dashboard')
check('모르는 쿠키 값 → 역할대로(학생)', M.landingPath('student', '') === '/s')

// ── next: 받아들이는 것 ──
const ok = (v) => M.safeNext(v) === v
check('허용: /s/assets', ok('/s/assets'))
check('허용: /dashboard?tab=rotation', ok('/dashboard?tab=rotation'))
check('허용: /research?q=%EC%82%BC%EC%84%B1%20%EC%A0%84%EC%9E%90(인코딩된 공백)', ok('/research?q=%EC%82%BC%EC%84%B1%20%EC%A0%84%EC%9E%90'))
check('허용: /s', ok('/s'))
check('허용: /', ok('/'))
check('허용: /loginhelp(접두사만 같은 다른 경로)', ok('/loginhelp'))
check('허용: 512자', ok('/' + 'a'.repeat(511)))

// ── next: 막는 것(열린 리다이렉트·되돌이) ──
const no = (v) => M.safeNext(v) === null
check('차단: null/undefined/빈 문자열', no(null) && no(undefined) && no(''))
check('차단: //evil.com', no('//evil.com'))
check('차단: /\\evil', no('/\\evil'))
check('차단: /\\/evil.com', no('/\\/evil.com'))
check('차단: https://x', no('https://x'))
check('차단: http://evil.com/s', no('http://evil.com/s'))
check('차단: javascript:alert(1)', no('javascript:alert(1)'))
check('차단: /%2F%2Fevil(인코딩으로 숨긴 //)', no('/%2F%2Fevil'))
check('차단: /%5Cevil(인코딩으로 숨긴 \\)', no('/%5Cevil'))
check('차단: %2F%2Fevil(/ 로 시작 안 함)', no('%2F%2Fevil'))
check('차단: /\\t/evil(탭 — 브라우저가 지우면 //evil)', no('/\t/evil'))
check('차단: /%09/evil(인코딩된 탭)', no('/%09/evil'))
check('차단: /\\n/evil(줄바꿈)', no('/\n/evil'))
check('차단: 상대 경로 evil.com', no('evil.com'))
check('차단: 깨진 인코딩 /%E0%A4%A', no('/%E0%A4%A'))
check('차단: 513자', no('/' + 'a'.repeat(512)))
check('차단: /login', no('/login'))
check('차단: /login?next=/s', no('/login?next=/s'))
check('차단: /LOGIN(대소문자)', no('/LOGIN'))
check('차단: /signup', no('/signup'))
check('차단: /start', no('/start'))
check('차단: /start?next=/s', no('/start?next=/s'))
check('차단: /start/', no('/start/'))

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (로그인 착지)')
process.exit(fail ? 1 : 0)
