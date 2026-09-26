// 환율 채택 검증 — 실제 환율만 live, 고정 상수(stale-constant)·조회 실패는 live=false(= 그 결과는 캐시하지 않는다)
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-fx-live`

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
  include: [`${ROOT}/src/lib/fx.ts`, `${ROOT}/src/lib/fxAccept.ts`],
}
writeFileSync(`${ROOT}/.bt-fx-live.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일이 실패해도 옛 .js 로 거짓 green 을 낸다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-fx-live.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/fx.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/lib/…' 별칭 → 컴파일 산출물(실제 lib 을 그대로 검증한다 — 재구현 금지)
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, `${OUT}/${req.slice(2)}`, ...rest)
  return orig.call(this, req, ...rest)
}
const require = Module.createRequire(import.meta.url)
const M = require(`${OUT}/lib/fx.js`)

let fail = 0
function check(label, cond) {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}`); fail++ }
}
const F = M.USD_KRW_FALLBACK
const same = (a, b) => a.rate === b.rate && a.live === b.live

// ── 순수 판정(readUsdKrw) ──
check('외부 1순위 환율 → 그 값·live', same(M.readUsdKrw({ rate: 1391.25, source: 'fawazahmed0' }), { rate: 1391.25, live: true }))
check('외부 2순위 환율 → 그 값·live', same(M.readUsdKrw({ rate: 1402.5, source: 'exchangerate-api' }), { rate: 1402.5, live: true }))
check('마지막 성공 환율(last-good) → 실제 과거 환율이라 live', same(M.readUsdKrw({ rate: 1388, source: 'last-good' }), { rate: 1388, live: true }))
check('고정 상수(stale-constant) → 값은 같아도 live 아님', same(M.readUsdKrw({ rate: F, source: 'stale-constant' }), { rate: F, live: false }))
check('스케일 오류(500 이하) → 폴백·live 아님', same(M.readUsdKrw({ rate: 13.9, source: 'fawazahmed0' }), { rate: F, live: false }))
check('rate 가 문자열 → 폴백·live 아님', same(M.readUsdKrw({ rate: '1391', source: 'fawazahmed0' }), { rate: F, live: false }))
check('rate NaN → 폴백·live 아님', same(M.readUsdKrw({ rate: NaN }), { rate: F, live: false }))
check('rate 없음 → 폴백·live 아님', same(M.readUsdKrw({ source: 'fawazahmed0' }), { rate: F, live: false }))
check('null 응답 → 폴백·live 아님', same(M.readUsdKrw(null), { rate: F, live: false }))
check('source 없는 정상 값(하위호환) → live', same(M.readUsdKrw({ rate: 1400.01 }), { rate: 1400.01, live: true }))

// ── 네트워크 경로(fetchUsdKrw) — fetch 를 바꿔 끼워 세 갈래를 확인 ──
const realFetch = globalThis.fetch
const mock = (impl) => { globalThis.fetch = impl }
mock(async () => ({ ok: true, json: async () => ({ rate: 1391.25, source: 'fawazahmed0' }) }))
check('fetch 성공 → live', same(await M.fetchUsdKrw('http://x'), { rate: 1391.25, live: true }))
check('getUsdKrw 값 불변(정상 환율 그대로)', (await M.getUsdKrw('http://x')) === 1391.25)
mock(async () => ({ ok: true, json: async () => ({ rate: F, source: 'stale-constant' }) }))
check('HTTP 200 이지만 stale-constant → live 아님(이전엔 live 로 잘못 판정)', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
check('stale-constant 일 때 getUsdKrw 값은 이전과 같다(상수)', (await M.getUsdKrw('http://x')) === F)
mock(async () => ({ ok: false, json: async () => ({}) }))
check('HTTP 오류 → 폴백·live 아님', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
mock(async () => { throw new Error('timeout') })
check('fetch 예외(타임아웃) → 폴백·live 아님', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
mock(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json') } }))
check('JSON 파싱 실패 → 폴백·live 아님', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
globalThis.fetch = realFetch

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (환율 live 판정)')
process.exit(fail ? 1 : 0)
