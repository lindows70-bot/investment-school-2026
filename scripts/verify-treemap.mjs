// 히트맵 배치 검증 — 칸 면적이 값에 비례하고 상자 밖으로 안 나가며, 색이 등락 규칙을 따르는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'

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

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-treemap.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/treemap.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

const { createRequire } = await import('node:module')
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

const inBox = (r, box, eps = 0.01) =>
  r.x >= box.x - eps && r.y >= box.y - eps && r.x + r.w <= box.x + box.w + eps && r.y + r.h <= box.y + box.h + eps
const overlaps = (a, b, eps = 0.01) =>
  a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps
const noOverlap = (rs) => {
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (overlaps(rs[i], rs[j])) return false
  return true
}

const vals = [421, 356, 192, 176, 103]
const box = { x: 0, y: 0, w: 358, h: 230 }
const rs = M.squarify(vals, box)
const total = vals.reduce((a, b) => a + b, 0)
check('칸 수 = 값 수', rs.length === vals.length)
check('면적 비례(오차 0.5%)', rs.every((r, i) => Math.abs(r.w * r.h - vals[i] / total * box.w * box.h) < box.w * box.h * 0.005))
check('상자 안', rs.every(r => inBox(r, box)))
check('겹침 없음', noOverlap(rs))
check('면적 합 = 상자 면적', Math.abs(rs.reduce((a, r) => a + r.w * r.h, 0) - box.w * box.h) < box.w * box.h * 0.005)

// 빈 입력·전량 0 이하·빈 상자도 '값 수만큼' 돌려준다 — 개수가 줄면 호출부 인덱스 매핑이 깨진다
check('빈 입력 → 빈 배열(값이 0개이므로)', M.squarify([], box).length === 0)
const zz = M.squarify([0, 0], box)
check('전량 0 → 칸 2개, 모두 면적 0', zz.length === 2 && zz.every(r => r.w === 0 && r.h === 0))
const zBox = M.squarify([5, 3], { x: 0, y: 0, w: 0, h: 230 })
check('빈 상자(w=0) → 칸 수 유지, 모두 면적 0', zBox.length === 2 && zBox.every(r => r.w === 0 && r.h === 0))

// 0이 다른 양수값과 섞이면(worst()가 최소값으로 나누므로) NaN/Infinity 없이 0칸을 만들어야 한다
const rz = M.squarify([5, 0, 3], box)
check('0 섞임: 칸 수 유지', rz.length === 3)
check('0 섞임: 0값 칸은 크기 0', rz[1].w === 0 && rz[1].h === 0)
check('0 섞임: 나머지 칸은 유한값(NaN/Infinity 없음)', [rz[0].w, rz[0].h, rz[2].w, rz[2].h].every(Number.isFinite))
check('0 섞임: 순서 = 입력 순서 유지', rz[0].w > 0 && rz[2].w > 0)
check('음수값도 0칸 취급', M.squarify([5, -3, 3], box)[1].w === 0)

// 입력이 정렬돼 있지 않아도(내부에서 desc 정렬) 상자 안·비례가 유지되고, 결과 순서는 입력 순서 그대로
const unsorted = [103, 421, 176, 192, 356]
const ru = M.squarify(unsorted, box)
const totalU = unsorted.reduce((a, b) => a + b, 0)
check('정렬 안 된 입력도 상자 안', ru.every(r => inBox(r, box)))
check('정렬 안 된 입력도 겹침 없음', noOverlap(ru))
check('정렬 안 된 입력도 면적 비례', ru.every((r, i) => Math.abs(r.w * r.h - unsorted[i] / totalU * box.w * box.h) < box.w * box.h * 0.005))
check('정렬 안 된 입력도 출력 순서 = 입력 순서(가장 작은 103이 자리[0])', Math.abs(ru[0].w * ru[0].h - 103 / totalU * box.w * box.h) < box.w * box.h * 0.005)

// 오프셋 상자(x,y 가 0이 아님)에서도 칸이 그 상자 안에 들어가야 한다
const offBox = { x: 100, y: 20, w: 358, h: 230 }
const ro = M.squarify(vals, offBox)
check('오프셋 상자 안', ro.every(r => inBox(r, offBox)))
check('오프셋 상자에서도 겹침 없음', noOverlap(ro))

// 극단적 비율(1e7 : 1)도 유한값으로 상자 안에 들어가야 한다
const rext = M.squarify([1e7, 1], box)
check('극단 비율도 전부 유한값', rext.every(r => [r.x, r.y, r.w, r.h].every(Number.isFinite)))
check('극단 비율도 상자 안', rext.every(r => inBox(r, box)))

// 칸 25개(작은 표에서 종목이 많은 경우)도 상자 안·면적 비례
const many = Array.from({ length: 25 }, (_, i) => 25 - i)
const rmany = M.squarify(many, box)
const totalMany = many.reduce((a, b) => a + b, 0)
check('25개 입력도 칸 수 유지', rmany.length === 25)
check('25개 입력도 상자 안', rmany.every(r => inBox(r, box)))
check('25개 입력도 면적 비례(오차 0.5%)', rmany.every((r, i) => Math.abs(r.w * r.h - many[i] / totalMany * box.w * box.h) < box.w * box.h * 0.005))

// 색 — theme.ts 실제 토큰 값과 일치시킨다(2026-09-26 실측: flat2 = '#1e1e1e')
const TK = { red500: '#ef4444', blue500: '#3b82f6', flat2: '#1e1e1e' }
check('색: 시세 없음 → null', M.heatFill(null, TK) === null)
check('색: 보합(0.04%) → 회색', M.heatFill(0.04, TK) === TK.flat2)
check('색: 0.06% → 회색 아니고 색이 붙음(0.05 경계)', M.heatFill(0.06, TK) !== TK.flat2 && M.heatFill(0.06, TK).startsWith(TK.red500))
check('색: 상승 → 빨강 계열', M.heatFill(2.1, TK).startsWith(TK.red500))
check('색: 하락 → 파랑 계열', M.heatFill(-0.9, TK).startsWith(TK.blue500))
check('색: 클수록 진하다', M.heatFill(3, TK) !== M.heatFill(0.5, TK))
check('색: NaN/Infinity → null', M.heatFill(NaN, TK) === null && M.heatFill(Infinity, TK) === null)

const g = M.splitGroups(420, 580, box)
check('묶음 나누기: 코어 폭 = 42%', Math.abs(g.core.w - 358 * 0.42) < 0.01 && Math.abs(g.core.w + g.sat.w - 358) < 0.01)
check('묶음 나누기: 한쪽 0 → 다른 쪽 전폭', M.splitGroups(0, 5, box).sat.w === 358 && M.splitGroups(0, 5, box).core.w === 0)
check('묶음 나누기: 반대쪽 0 → 코어 전폭', M.splitGroups(5, 0, box).core.w === 358 && M.splitGroups(5, 0, box).sat.w === 0)
check('묶음 나누기: 코어=10 위성=0 → 코어 전폭', M.splitGroups(10, 0, box).core.w === 358 && M.splitGroups(10, 0, box).sat.w === 0)
check('묶음 나누기: 코어 음수 → 0 취급 → 위성 전폭', M.splitGroups(-5, 10, box).core.w === 0 && M.splitGroups(-5, 10, box).sat.w === 358)
check('묶음 나누기: 코어 NaN → 0 취급 → 위성 전폭', M.splitGroups(NaN, 10, box).core.w === 0 && M.splitGroups(NaN, 10, box).sat.w === 358)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (히트맵 배치)')
process.exit(fail ? 1 : 0)
