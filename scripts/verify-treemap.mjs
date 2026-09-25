// 히트맵 배치 검증 — 칸 면적이 값에 비례하고 상자 밖으로 안 나가며, 색이 등락 규칙을 따르는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-treemap`

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
  include: [`${ROOT}/src/lib/treemap.ts`],
}
writeFileSync(`${ROOT}/.bt-treemap.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

try {
  execSync(`npx tsc -p "${ROOT}/.bt-treemap.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
}

if (!existsSync(`${OUT}/lib/treemap.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/x' 를 컴파일된 ${OUT}/x 로 잇는 리졸버 (이 lib은 '@/' import가 없어 실제로는 안 쓰인다)
const Module = await import('node:module')
const origResolve = Module.default._resolveFilename
Module.default._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    request = `${OUT}/${request.slice(2)}`
  }
  return origResolve.call(this, request, ...rest)
}

const { createRequire } = Module.default
const require = createRequire(import.meta.url)
const M = require(`${OUT}/lib/treemap.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

const vals = [421, 356, 192, 176, 103]
const box = { x: 0, y: 0, w: 358, h: 230 }
const rs = M.squarify(vals, box)
const total = vals.reduce((a, b) => a + b, 0)
check('칸 수 = 값 수', rs.length === vals.length)
check('면적 비례(오차 0.5%)', rs.every((r, i) => Math.abs(r.w * r.h - vals[i] / total * box.w * box.h) < box.w * box.h * 0.005))
check('상자 안', rs.every(r => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= box.w + 0.01 && r.y + r.h <= box.h + 0.01))
check('빈 입력 → 빈 배열', M.squarify([], box).length === 0 && M.squarify([0, 0], box).length === 0)

// 0이 다른 양수값과 섞이면(worst()가 최소값으로 나누므로) NaN/Infinity 없이 0칸을 만들어야 한다
const rz = M.squarify([5, 0, 3], box)
check('0 섞임: 칸 수 유지', rz.length === 3)
check('0 섞임: 0값 칸은 크기 0', rz[1].w === 0 && rz[1].h === 0)
check('0 섞임: 나머지 칸은 유한값(NaN/Infinity 없음)', [rz[0].w, rz[0].h, rz[2].w, rz[2].h].every(Number.isFinite))
check('0 섞임: 순서 = 입력 순서 유지', rz[0].w > 0 && rz[2].w > 0)
check('음수값도 0칸 취급', M.squarify([5, -3, 3], box)[1].w === 0)

const TK = { red500: '#ef4444', blue500: '#3b82f6', flat2: '#2a2d3a' }
check('색: 시세 없음 → null', M.heatFill(null, TK) === null)
check('색: 보합(±0.1%) → 회색', M.heatFill(0.05, TK) === TK.flat2)
check('색: 상승 → 빨강 계열', M.heatFill(2.1, TK).startsWith(TK.red500))
check('색: 하락 → 파랑 계열', M.heatFill(-0.9, TK).startsWith(TK.blue500))
check('색: 클수록 진하다', M.heatFill(3, TK) !== M.heatFill(0.5, TK))
check('색: NaN/Infinity → null', M.heatFill(NaN, TK) === null && M.heatFill(Infinity, TK) === null)

const g = M.splitGroups(420, 580, box)
check('묶음 나누기: 코어 폭 = 42%', Math.abs(g.core.w - 358 * 0.42) < 0.01 && Math.abs(g.core.w + g.sat.w - 358) < 0.01)
check('묶음 나누기: 한쪽 0 → 다른 쪽 전폭', M.splitGroups(0, 5, box).sat.w === 358 && M.splitGroups(0, 5, box).core.w === 0)
check('묶음 나누기: 반대쪽 0 → 코어 전폭', M.splitGroups(5, 0, box).core.w === 358 && M.splitGroups(5, 0, box).sat.w === 0)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (히트맵 배치)')
process.exit(fail ? 1 : 0)
