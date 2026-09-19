// 🇺🇸 내부자 매수 30일 초기 적재(PC 에서 1회) — 실제 src/lib/insiderMarket.ts 를 tsc 로 컴파일해 그대로 돌린다(재구현 금지).
//    크론은 회당 600건이라 30일 4만 건을 채우려면 며칠 걸린다 → 첫 적재만 여기서. 같은 코드·같은 app_cache 문서라 크론과 충돌 없음(멱등).
//    실행: node scripts/insider-backfill.mjs [예산건수=60000]   (.env.local 의 Supabase 키 사용 — 값은 출력하지 않는다)
import { createRequire } from 'module'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'

const ROOT = process.cwd().replace(/\\/g, '/')
const OUT = `${ROOT}/.bt-insider`
mkdirSync(OUT, { recursive: true })
for (const line of readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src` },
  include: [`${ROOT}/src/lib/insiderMarket.ts`],
}, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const { scanRecent } = require2(`${OUT}/lib/insiderMarket.js`)

const budget = +(process.argv[2] ?? 60000)
const t0 = Date.now()
let left = budget, round = 0
while (left > 0) {
  round++
  const r = await scanRecent(Math.min(left, 3000), 20 * 60_000)
  const processed = r.runs.reduce((s, x) => s + x.processed, 0), errors = r.runs.reduce((s, x) => s + x.errors, 0)
  const days = r.runs.map(x => `${x.day}:${x.processed}/${x.remaining}남${x.complete ? '✓' : ''}${x.errors ? `!${x.errors}` : ''}`).join(' ')
  console.log(`[${round}] +${processed}건 오류 ${errors} · ${((Date.now() - t0) / 60000).toFixed(1)}분 · ${days || '처리할 날 없음'}`)
  if (processed === 0) break   // 오류만 남으면 멈춘다(실측: 404 3건이 무한 반복 — 4시간을 태웠다)
  left -= processed + errors
}
console.log(`✅ 적재 종료 — ${budget - left}건 처리 · ${((Date.now() - t0) / 60000).toFixed(1)}분`)
