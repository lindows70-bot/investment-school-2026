// 거시 발표일(macroReleases) 검증 — 미국 서머타임 경계에서 한국 시각(21:30/22:30)이 맞고, FRED 응답을 못 읽으면 null 인지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-macro-releases`

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
  include: [`${ROOT}/src/lib/macroReleases.ts`],
}
writeFileSync(`${ROOT}/.bt-macro-releases.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-macro-releases.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/macroReleases.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const M = require(`${OUT}/lib/macroReleases.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

const kst = (d) => M.releaseKstTime(d)
// 서머타임 경계 — 2026: 3/8(일) 02:00 시작, 11/1(일) 02:00 종료. 8:30 은 02:00 뒤
check('3/8(서머타임 시작일) 8:30 EDT → 21:30 KST', kst('2026-03-08').kstTime === '21:30' && M.usEasternIsDst('2026-03-08'))
check('3/7(시작 전날) 8:30 EST → 22:30 KST', kst('2026-03-07').kstTime === '22:30' && !M.usEasternIsDst('2026-03-07'))
check('11/1(서머타임 종료일) 8:30 EST → 22:30 KST', kst('2026-11-01').kstTime === '22:30' && !M.usEasternIsDst('2026-11-01'))
check('10/31(종료 전날) 8:30 EDT → 21:30 KST', kst('2026-10-31').kstTime === '21:30')
check('12/10(CPI) → 22:30 KST', kst('2026-12-10').kstTime === '22:30')
check('9/30(PCE) → 21:30 KST', kst('2026-09-30').kstTime === '21:30')
check('1월·12월 → 표준시', !M.usEasternIsDst('2027-01-13') && !M.usEasternIsDst('2026-12-31'))
check('2027 경계(3/14 시작·11/7 종료)', M.usEasternIsDst('2027-03-14') && !M.usEasternIsDst('2027-03-13') && M.usEasternIsDst('2027-11-06') && !M.usEasternIsDst('2027-11-07'))
check('한국 날짜 = 미국 날짜(8:30 ET 는 같은 날 밤)', kst('2026-10-14').kstDate === '2026-10-14' && kst('2026-12-10').kstDate === '2026-12-10')

// FRED 응답 읽기
const ok = { release_dates: [{ release_id: 54, date: '2026-10-29' }, { release_id: 54, date: '2026-09-30' }, { release_id: 54, date: '2026-09-30' }] }
check('정상 응답 → 정렬·중복 제거', JSON.stringify(M.parseReleaseDates(ok)) === JSON.stringify(['2026-09-30', '2026-10-29']))
check('빈 목록 → [] (못 읽음 null 과 구분)', Array.isArray(M.parseReleaseDates({ release_dates: [] })) && M.parseReleaseDates({ release_dates: [] }).length === 0)
check('null·문자열·숫자 → null', M.parseReleaseDates(null) === null && M.parseReleaseDates('x') === null && M.parseReleaseDates(3) === null)
check('release_dates 없음(에러 응답) → null', M.parseReleaseDates({ error_code: 400, error_message: 'Bad Request' }) === null)
check('release_dates 가 배열 아님 → null', M.parseReleaseDates({ release_dates: {} }) === null)
check('날짜 형식 틀림 → null', M.parseReleaseDates({ release_dates: [{ date: '2026/10/14' }] }) === null)
check('없는 날짜(2026-02-30) → null', M.parseReleaseDates({ release_dates: [{ date: '2026-02-30' }] }) === null)
check('행이 null → null', M.parseReleaseDates({ release_dates: [null] }) === null)

check('MACRO_RELEASES: CPI 10 · JOBS 50 · PCE 54', JSON.stringify(M.MACRO_RELEASES.map(r => [r.id, r.kind])) === JSON.stringify([[10, 'CPI'], [50, 'JOBS'], [54, 'PCE']]))

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (거시 발표일)')
process.exit(fail ? 1 : 0)
