// 🏷️ 국면 라벨 정합성 검증 — "같은 지표가 화면마다 다르게 나오면 절대 안 된다"(제2원칙)
//
//   2026-08-28 실사고: detectMacroPhase 의 peak_rate 라벨이 rateDir 과 무관하게 '금리 고점·동결'로 고정돼,
//   FedWatch 가 인상을 반영하는 날 같은 화면에 "국면 SSOT: 금리 고점·동결" 과 "기준금리 방향: 인상" 이 동시에 떴다.
//   그 사이 portfolio-reco-kr·MacroDashboard 가 각자 우회 라벨을 만들어 표면이 셋으로 갈렸다.
//
//   ⛔ 재발 방지: 라벨이 금리 방향과 **말이 어긋나는 조합**을 전 경우의 수로 돌려 막는다.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'regime-label-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json'),
  compilerOptions: {
    noEmit: false, outDir: out, rootDir: join(ROOT, 'src'),
    module: 'commonjs', moduleResolution: 'node', target: 'es2020', jsx: 'react-jsx',
    types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types')], skipLibCheck: true, incremental: false,
  },
  include: [],
  files: [join(ROOT, 'src/lib/macroPhaseScreener.ts')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { cwd: ROOT, stdio: 'inherit' })
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, join(out, req.slice(2)), ...rest)
  return orig.call(this, req, ...rest)
}
const { detectMacroPhase } = require(join(out, 'lib/macroPhaseScreener.js'))

let fail = 0
const ok = (label, cond, detail = '') => { console.log(`${cond ? '  ✅' : '  ❌'} ${label}${detail ? ' — ' + detail : ''}`); if (!cond) fail++ }
const RATE_KO = { cut: '인하', hold: '동결', hike: '인상' }

// ── ① 라벨이 금리 방향과 모순되지 않는가 — 전 경우의 수 ────────────────────────
console.log('① 라벨 × 금리방향 모순 전수 검사\n')
const rows = []
for (const rateDir of ['cut', 'hold', 'hike']) {
  for (const cpiYoY of [1.5, 3.5, 4.8, 6.0]) {
    for (const fedRate of [1.0, 3.6]) {
      for (const yieldCurve of [-0.6, 0.5]) {
        for (const hySpread of [3.0, 6.0]) {
          const r = detectMacroPhase({ fedRate, cpiYoY, yieldCurve, hySpread, rateDir })
          rows.push({ rateDir, cpiYoY, fedRate, yieldCurve, hySpread, ...r })
        }
      }
    }
  }
}
// 모순 = 금리가 '인상'인데 라벨이 '동결'이라 말하거나, '인하'인데 '인상'이라 말하는 것
const contradictions = rows.filter(r =>
  (r.rateDir === 'hike' && /동결/.test(r.label)) ||
  (r.rateDir === 'cut' && /인상/.test(r.label)) ||
  (r.rateDir === 'hold' && /인상 경계/.test(r.label)))
ok(`${rows.length}개 조합에서 라벨이 금리 방향을 부정하지 않음`, contradictions.length === 0,
  contradictions.length ? contradictions.slice(0, 3).map(c => `${RATE_KO[c.rateDir]}인데 "${c.label}"`).join(' / ') : '')

// ── ② 화면에 실제로 나갈 조합(오늘 값)에서 두 문장이 같이 읽히는가 ─────────────
console.log('\n② 오늘 프로덕션 값으로 재현\n')
const m = await fetch('https://investment-school-2026.vercel.app/api/macro-regime', { cache: 'no-store' })
const md = await m.json()
console.log(`  원천: rateDir=${md.rateDir} · rateDirLabel=${md.rateDirLabel} · label=${md.label} · phase=${md.phase}`)
ok('프로덕션 라벨이 금리 방향을 부정하지 않음',
  !(md.rateDir === 'hike' && /동결/.test(md.label ?? '')),
  `"${md.label}" vs 기준금리 방향 "${md.rateDirLabel}"`)

// ── ③ peak_rate 라벨이 rateDir 로 실제 갈리는가(회귀 방지) ────────────────────
console.log('\n③ peak_rate 라벨이 금리 방향에 따라 갈리는가\n')
const base = { fedRate: 3.6, cpiYoY: 3.5, yieldCurve: 0.5, hySpread: 3.0 }
const hike = detectMacroPhase({ ...base, rateDir: 'hike' })
const hold = detectMacroPhase({ ...base, rateDir: 'hold' })
ok('둘 다 peak_rate 로 판정', hike.phase === 'peak_rate' && hold.phase === 'peak_rate')
ok('라벨이 서로 다르다', hike.label !== hold.label, `hike "${hike.label}" · hold "${hold.label}"`)
ok('설명도 서로 다르다(기존 분기 유지)', hike.description !== hold.description)

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
