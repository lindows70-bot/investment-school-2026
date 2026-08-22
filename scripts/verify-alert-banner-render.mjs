// ✅ Red Alert 배너 렌더 검증 — 역전은 몇 년에 한 번이라 실전 발동 전까지 렌더 결함을 알 수 없다.
//    실제 컴포넌트(YieldCurveAlertBanner.tsx)를 컴파일해 react-dom/server 로 강제 렌더:
//    ①red 페이로드 → 경보 문구·수치·캐비엇이 전부 마크업에 있는가 ②none → 아무것도 렌더하지 않는가
//    산출 HTML 은 화면 미리보기용으로 저장(.alert-banner-preview.html — 프로덕션 페이지에 주입해 스크린샷).
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Module from 'node:module'

const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'ban-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  compilerOptions: {
    outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'),
    module: 'commonjs', moduleResolution: 'node', jsx: 'react-jsx',
    noEmit: false, declaration: false, types: ['node', 'react'],
    typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')],
  },
  files: [
    join(ROOT, 'src/lib/theme.ts').replace(/\\/g, '/'),
    join(ROOT, 'src/app/components/YieldCurveAlertBanner.tsx').replace(/\\/g, '/'),
  ],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })

// @/ 별칭 + react 류를 프로젝트 node_modules 로 — 재구현 없이 실제 코드를 실행하기 위한 배선
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, join(out, 'src', req.slice(2)), ...rest)
  if (req === 'react' || req.startsWith('react/') || req.startsWith('react-dom')) return orig.call(this, join(ROOT, 'node_modules', req), ...rest)
  return orig.call(this, req, ...rest)
}
const { createRequire } = Module
const req = createRequire(import.meta.url)
const React = req(join(ROOT, 'node_modules', 'react'))
const { renderToString } = req(join(ROOT, 'node_modules', 'react-dom', 'server'))
const Banner = req(join(out, 'src/app/components/YieldCurveAlertBanner.js')).default

// 강제 페이로드 — 2022-11 실측값 기반(그 시점이었다면 이렇게 왔을 값)
const RED = {
  alert: 'red',
  spreads: [
    { key: 't10y2y', label: '10년 − 2년', meaning: '시장이 보는 중기 성장·금리 경로.', value: -0.45, date: '2022-11-15', invertedDays: 23, minPp: -0.58, chg1m: -0.2, chg3m: -0.6 },
    { key: 't10y3m', label: '10년 − 3개월', meaning: '연준 정책금리와 시장 기대의 차이.', value: -0.52, date: '2022-11-15', invertedDays: 14, minPp: -0.57, chg1m: -0.7, chg3m: -1.2 },
  ],
  leadSummary: { n: 11, medianMonths: 14, minMonths: 5, maxMonths: 34, noRecession: 1 },
}

let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }

const html = renderToString(React.createElement(Banner, { initial: RED }))
console.log('═══ ① red 페이로드 렌더 ═══')
check(html.length > 500, `마크업 생성됨(${html.length}자)`)
for (const [needle, why] of [
  ['장단기 금리 역전 경보', '경보 제목'],
  ['10년 − 2년', '스프레드 1 라벨'],
  ['10년 − 3개월', '스프레드 2 라벨'],
  ['-0.45', '스프레드 1 수치'],
  ['23<!-- -->거래일째', '역전 지속일(SSR 은 표현식 경계에 주석을 끼운다)'],
  ['중앙값 <!-- -->14<!-- -->개월', '리드타임 통계(데이터 파생)'],
  ['침체가 오지 않았습니다', '2022 오경보 캐비엇(상설)'],
  ['매도 신호가 아니라', '⛔ 매도 지시 아님'],
  ['/bonds', '채권 페이지 링크'],
]) check(html.includes(needle), `"${needle.replace(/<!-- -->/g, '')}" 포함 — ${why}`)

console.log('\n═══ ② none 페이로드 → 렌더 0 ═══')
const none = renderToString(React.createElement(Banner, { initial: { ...RED, alert: 'none' } }))
check(none === '', `alert=none 이면 아무것도 렌더하지 않는다(실제 ${none.length}자)`)
const empty = renderToString(React.createElement(Banner, {}))
check(empty === '', `데이터 없으면(fetch 전) 렌더 0(실제 ${empty.length}자)`)

// 미리보기 파일 — 프로덕션 대시보드에 주입해 '발동한 날의 화면'을 확인하는 용도
writeFileSync(join(ROOT, '.alert-banner-preview.html'), html, 'utf8')
console.log('\n미리보기 저장: .alert-banner-preview.html')

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
