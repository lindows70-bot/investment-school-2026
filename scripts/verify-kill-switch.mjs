// 🔌 킬스위치 독립 재계산 검증 — 실제 lib 을 컴파일해 돌린다(재구현 금지: 재구현하면 검증이 무의미)
//   ① FRED 원천에서 임계값을 다시 계산해 lib 출력과 대조
//   ② 임계값이 seasonNavigator 판정식과 **정말 같은지** 경계 동작으로 확인(상수 복붙 드리프트 탐지)
//   ③ 축을 뒤집었을 때의 계절 매핑을 seasonOf 로 독립 재유도
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Module, { createRequire } from 'node:module'

// .mjs 안에서 CJS 산출물을 읽으려면 명시적 require 가 필요하다(top-level await 와 require 가 섞이면 모듈 형식이 모호해진다)
const require = createRequire(import.meta.url)

const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'ks-verify-'))
const tscfg = join(out, 'tsconfig.json')
writeFileSync(tscfg, JSON.stringify({
  extends: join(ROOT, 'tsconfig.json'),
  compilerOptions: {
    noEmit: false, outDir: out, rootDir: join(ROOT, 'src'),
    module: 'commonjs', moduleResolution: 'node', target: 'es2020',
    // ⚠️ 임시 tsconfig 가 tmpdir 에 있어 @types 를 못 찾는다 — typeRoots 를 프로젝트로 못박는다
    jsx: 'react-jsx', types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types')],
    skipLibCheck: true, incremental: false,
  },
  include: [],
  files: [join(ROOT, 'src/lib/killSwitch.ts'), join(ROOT, 'src/lib/seasonNavigator.ts')],
}))
execSync(`npx tsc -p "${tscfg}"`, { cwd: ROOT, stdio: 'inherit' })

// '@/...' 별칭을 컴파일 산출물로 해석
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, join(out, req.slice(2)), ...rest)
  return orig.call(this, req, ...rest)
}
const { killSwitch, CPI_HOT_PCT } = require(join(out, 'lib/killSwitch.js'))
const { seasonOf, growthFromCli, inflationFromRegime } = require(join(out, 'lib/seasonNavigator.js'))

let fail = 0
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '  ✅' : '  ❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!cond) fail++
}

// ── ① FRED 원천에서 다시 가져온다(앱 캐시를 안 거친다) ──────────────────────────
const env = Object.fromEntries(readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
  .filter(l => /^\s*[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))

const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=USALOLITOAASTSAM&api_key=${env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=4`)
const obs = (await r.json()).observations.map(o => ({ d: o.date, v: parseFloat(o.value) })).filter(o => isFinite(o.v))
const [cli, , nextPrev, prev] = obs.map(o => o.v)
console.log(`\n원천(FRED USALOLITOAASTSAM): 최신 ${obs[0].d} ${cli} · 3개월전 ${prev} · 다음 비교기준 ${nextPrev}\n`)

const m = await fetch('https://investment-school-2026.vercel.app/api/macro-regime', { cache: 'no-store' })
const md = await m.json()
console.log(`원천(macro-regime): cpiYoY ${md.cpiYoY} · rateDir ${md.rateDir}\n`)

const ks = killSwitch({ cli, cliPrev: prev, cliNextPrev: nextPrev, cpiYoY: md.cpiYoY, rateDir: md.rateDir })

// ── ② 판정 재현 — lib 이 낸 계절이 판정식을 직접 태운 것과 같은가 ────────────────
console.log('① 판정 재현')
const expectQuad = seasonOf(growthFromCli(cli, prev), inflationFromRegime(md.cpiYoY, md.rateDir))
ok('killSwitch 의 현재 계절 = seasonOf 직접 호출', ks.quadrant === expectQuad, `${ks.quadrant} (${ks.seasonKo})`)

// ── ③ 임계값이 판정식과 같은가 — 상수 복붙 드리프트 탐지 ────────────────────────
console.log('\n② 임계값이 판정식과 동일한가(경계 동작으로 확인)')
ok(`CPI ${CPI_HOT_PCT} 이하는 hot 아님`, inflationFromRegime(CPI_HOT_PCT, 'hold').hot === false)
ok(`CPI ${CPI_HOT_PCT} 초과는 hot`, inflationFromRegime(CPI_HOT_PCT + 0.01, 'hold').hot === true)
ok('금리 hike 는 CPI 무관하게 hot', inflationFromRegime(0.1, 'hike').hot === true)

// ── ④ 성장축 임계선 — 다음 발표가 nextPrev 미만이면 정말 뒤집히는가 ──────────────
console.log('\n③ 성장축 임계선 재계산')
const gapRow = ks.rows.find(x => x.key === 'growth')
const expectGap = (cli - nextPrev).toFixed(3)
// 문구는 바뀔 수 있으니 **수치가 들어 있는지**로 본다(문자열 완전일치는 표현만 다듬어도 깨진다)
ok('남은 거리 = 현재 CLI − 다음 비교기준', gapRow.gap.includes(expectGap), `표시 ${gapRow.gap} / 재계산 ${expectGap}`)
const justBelow = seasonOf(growthFromCli(nextPrev - 0.001, nextPrev), inflationFromRegime(md.cpiYoY, md.rateDir))
const justAbove = seasonOf(growthFromCli(nextPrev + 0.001, nextPrev), inflationFromRegime(md.cpiYoY, md.rateDir))
ok('임계선 바로 아래면 계절이 실제로 바뀐다', justBelow !== expectQuad, `${expectQuad} → ${justBelow}`)
ok('임계선 바로 위면 계절 유지', justAbove === expectQuad)
ok('임계선 아래 계절 = ifGrowthFlips 가 예고한 계절', justBelow === ks.ifGrowthFlips.quadrant)

// ── ⑤ 물가축 OR 게이트 — 한쪽만 꺼서는 안 바뀌는가(화면 문구의 근거) ─────────────
console.log('\n④ 물가축 OR 게이트(화면이 주장하는 내용)')
const inf = inflationFromRegime(md.cpiYoY, md.rateDir)
if (inf.hot && md.cpiYoY > CPI_HOT_PCT && md.rateDir === 'hike') {
  const cpiOnly = seasonOf(growthFromCli(cli, prev), inflationFromRegime(CPI_HOT_PCT, 'hike'))
  const rateOnly = seasonOf(growthFromCli(cli, prev), inflationFromRegime(md.cpiYoY, 'hold'))
  const both = seasonOf(growthFromCli(cli, prev), inflationFromRegime(CPI_HOT_PCT, 'hold'))
  ok('CPI만 임계 아래로 → 계절 그대로(= 화면 경고가 참)', cpiOnly === expectQuad, `${cpiOnly}`)
  ok('금리만 해제 → 계절 그대로', rateOnly === expectQuad, `${rateOnly}`)
  ok('둘 다 꺼야 뒤집힘', both !== expectQuad, `${expectQuad} → ${both}`)
  ok('둘 다 껐을 때 계절 = ifInflationFlips 예고', both === ks.ifInflationFlips.quadrant)
  ok('문구가 "두 겹"을 명시', /두 겹/.test(ks.inflationGateNote))
} else {
  console.log('  ⏭️ 지금은 두 조건이 동시에 켜진 상태가 아니라 이 검사는 건너뜀')
}

// ── ⑥ 지어낸 숫자가 없는가 — 표의 모든 수치가 원천에서 나왔는가 ────────────────
console.log('\n⑤ 표에 지어낸 숫자가 없는가')
const nowTxt = ks.rows.map(x => x.now).join(' | ')
ok('CLI 행이 원천 값을 그대로 쓴다', nowTxt.includes(cli.toFixed(3)) && nowTxt.includes(prev.toFixed(3)))
ok('CPI 행이 원천 값을 그대로 쓴다', nowTxt.includes(md.cpiYoY.toFixed(1)))
ok('제외 사유가 비어 있지 않다', ks.excluded.length >= 3 && ks.excluded.every(e => e.why.length > 10))

console.log('\n── 킬스위치 표(화면에 나갈 값) ──')
ks.rows.forEach(x => console.log(`  ${x.lit ? '🔴' : '⚪'} ${x.what}\n      지금 ${x.now}\n      켜짐 ${x.trip}  |  남은 거리 ${x.gap ?? '—'}`))
console.log(`\n  성장만 켜지면 → ${ks.ifGrowthFlips.seasonKo}`)
console.log(`  물가만 켜지면 → ${ks.ifInflationFlips.seasonKo}`)
console.log(`  둘 다 켜지면 → ${ks.ifBothFlip.seasonKo}`)
console.log(`\n  ⚠️ ${ks.inflationGateNote.replace(/\*\*/g, '')}`)

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
