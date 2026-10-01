// 린치 고정 분류표(lib/lynchKnown) 검증 — 스크리너 유니버스 표와 어긋남 0 · 스크리너가 고정표를 따르는 코드가 살아 있는지 · 프로덕션 분류 라우트가 같은 값을 주는지
//   2026-10-01 신설 — 같은 종목의 분류가 두 곳에 따로 적혀 겹치는 94종 중 25종이 달랐다(삼성전자: 보유 화면 경기순환주 / 추천 계산 우량주). 값이 그럴듯해 빌드·화면검증으로는 안 잡힌다.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-lynch-known`
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src` },
  include: [`${ROOT}/src/lib/lynchKnown.ts`],
}, null, 2))
rmSync(OUT, { recursive: true, force: true })
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) }
catch (e) { console.log('❌ 컴파일 실패'); console.log(e.stdout?.toString() ?? ''); process.exit(1) }
if (!existsSync(`${OUT}/lib/lynchKnown.js`)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const require = Module.createRequire(`${ROOT}/package.json`)
const { US_KNOWN, KR_KNOWN, knownLynch } = require(`${OUT}/lib/lynchKnown.js`)

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }
const CATS = new Set(['slow_grower', 'stalwart', 'fast_grower', 'cyclical', 'turnaround', 'asset_play'])

// ── 고정표 자체 ──
const nUS = Object.keys(US_KNOWN).length, nKR = Object.keys(KR_KNOWN).length
check(`고정표 크기 — 미국 ${nUS}종 · 국내 ${nKR}종(둘 다 40종 이상)`, nUS >= 40 && nKR >= 40)
check('고정표 값이 전부 6대 분류', [...Object.values(US_KNOWN), ...Object.values(KR_KNOWN)].every(v => CATS.has(v)))
check('찾기 — 국내는 .KS/.KQ 를 떼고, 미국은 대소문자 무시, 없으면 null', knownLynch('005930.KS', 'KR') === KR_KNOWN['005930'] && knownLynch('aapl', 'US') === US_KNOWN.AAPL && knownLynch('ZZZZ', 'US') === null)
// 같은 키가 표 안에 두 번 적히면 뒤의 값이 조용히 이긴다 — 원문에서 센다
const src = readFileSync(`${ROOT}/src/lib/lynchKnown.ts`, 'utf8')
const keyRe = /(?:^|[\s,{])'?([A-Z0-9][A-Z0-9.\-]*)'?\s*:\s*'(?:slow_grower|stalwart|fast_grower|cyclical|turnaround|asset_play)'/g
const dupIn = (name) => { const i = src.indexOf(`export const ${name}`); const body = src.slice(i, src.indexOf('\n}', i)); const seen = new Set(), dup = []; for (const m of body.matchAll(keyRe)) { if (seen.has(m[1])) dup.push(m[1]); seen.add(m[1]) } return dup }
const dups = [...dupIn('US_KNOWN'), ...dupIn('KR_KNOWN')]
check(`고정표 안에 같은 종목이 두 번 적히지 않음${dups.length ? `(${dups.join(', ')})` : ''}`, dups.length === 0)

// ── 스크리너 유니버스 표와 대조 ──
const scr = readFileSync(`${ROOT}/src/lib/macroPhaseScreener.ts`, 'utf8')
const block = (name) => { const i = scr.indexOf(`const ${name}`); return scr.slice(i, scr.indexOf('\n]', i)) }
const rowRe = /ticker:\s*'([^']+)'\s*,\s*lynch:\s*'([a-z_]+)'/g
const diff = []; let both = 0, rows = 0
for (const [name, mk] of [['US_UNIVERSE', 'US'], ['KR_UNIVERSE', 'KR']]) {
  for (const m of block(name).matchAll(rowRe)) { rows++; const k = knownLynch(m[1], mk); if (k) { both++; if (k !== m[2]) diff.push(`${m[1]} 고정표 ${k} / 유니버스 ${m[2]}`) } }
}
check(`유니버스 표를 읽음(미국+국내 ${rows}종 · 고정표와 겹침 ${both}종 — 50종 이상)`, rows > 300 && both >= 50)
check(`겹치는 종목의 분류가 두 표에서 같음${diff.length ? ` — 어긋남 ${diff.length}: ${diff.slice(0, 6).join(' · ')}` : ''}`, diff.length === 0)
check('스크리너가 고정표를 따르는 코드가 있음(knownLynch(s.ticker, s.market) ?? s.lynch)', /knownLynch\(s\.ticker,\s*s\.market\)\s*\?\?\s*s\.lynch/.test(scr))
check('분류 라우트가 고정표를 lib 에서 가져옴(라우트 안에 표를 다시 적지 않음)', (() => { const r = readFileSync(`${ROOT}/src/app/api/lynch-classify/route.ts`, 'utf8'); return /from '@\/lib\/lynchKnown'/.test(r) && !/const (US|KR)_KNOWN\s*:/.test(r) })())

// ── 라이브: 프로덕션 분류 라우트 = 고정표 ──
try {
  for (const [t, mk] of [['005930', 'KR'], ['440110', 'KR'], ['GOOGL', 'US']]) {
    const j = await fetch(`https://investment-school-2026.vercel.app/api/lynch-classify?ticker=${t}&market=${mk}`, { signal: AbortSignal.timeout(30_000) }).then(r => r.json())
    check(`프로덕션 분류 라우트 ${t} = 고정표(${j.category} = ${knownLynch(t, mk)})`, j.category === knownLynch(t, mk))
  }
} catch (e) { fail++; console.log(`❌ 프로덕션 호출 실패 — ${e.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (린치 고정 분류표)')
process.exitCode = fail ? 1 : 0
