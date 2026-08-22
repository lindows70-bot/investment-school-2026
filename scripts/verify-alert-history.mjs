// ✅ 역전 경보 truncation 테스트 — "그날 이 시스템이 있었다면 경보가 울렸을까"를 실데이터로 검증.
//    실제 lib(currentRun·curveAlertLevel)을 컴파일해 쓴다(재구현 금지) — 검증용 별도 구현은 검증이 아니다.
//    FRED 전체 시계열을 과거 날짜에서 잘라(truncate) 그날의 '최신 데이터'를 재현한다.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
let KEY = process.env.FRED_API_KEY
if (!KEY) { try { KEY = (readFileSync('.env.local', 'utf8').match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim() } catch {} }

const out = mkdtempSync(join(tmpdir(), 'yah-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')] },
  files: [join(ROOT, 'src/lib/yieldCurve.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })
const M = await import('file://' + join(out, 'src/lib/yieldCurve.js').replace(/\\/g, '/'))

const fred = async (id, start) => {
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}`, { signal: AbortSignal.timeout(25000) })
  return r.ok ? ((await r.json()).observations ?? []).map(o => ({ date: o.date, v: parseFloat(o.value) })).filter(x => isFinite(x.v)) : []
}
const [s2, s3] = await Promise.all([fred('T10Y2Y', '1976-01-01'), fred('T10Y3M', '1982-01-01')])
console.log(`T10Y2Y ${s2.length}건 · T10Y3M ${s3.length}건\n`)

// 그 날짜 시점의 '최신 데이터'를 재현해 실제 판정 함수를 호출
const asOf = (cutoff) => {
  const a = s2.filter(o => o.date <= cutoff), b = s3.filter(o => o.date <= cutoff)
  const r2 = M.currentRun(a), r3 = M.currentRun(b)
  const v2 = a[a.length - 1]?.v ?? null, v3 = b[b.length - 1]?.v ?? null
  const alert = M.curveAlertLevel([v2, v3], Math.max(r2.days, r3.days))
  return { alert, v2, v3, run2: r2.days, run3: r3.days }
}

// 기대값의 근거: NBER 침체(2008-01·2020-03)에 앞선 지속 역전 한가운데 = red / 평온기 = none
const CASES = [
  ['2006-12-01', 'red', '2008 침체 13개월 전 — 두 스프레드 모두 수개월째 역전'],
  ['2019-09-30', 'red', '2020 침체 5개월 전 — 10Y-3M 4개월째 역전'],
  ['2022-11-15', 'red', '역대급 역전 초입(훗날 오경보로 판명되지만, 그 시점 기준으론 경보가 맞다)'],
  ['2021-06-01', 'none', '평온기 — 곡선 가파름(+1%p대)'],
  ['2025-03-05', null, '얕은 단기 역전 — brief(🟠)여야 하고 red(🔴)면 임계가 무의미한 것'],
]

let fail = 0
console.log('시점         판정     10Y-2Y   10Y-3M   역전연속(2Y/3M)  기대     비고')
for (const [d, expect, why] of CASES) {
  const r = asOf(d)
  const ok = expect == null ? r.alert === 'brief' : r.alert === expect
  if (!ok) fail++
  console.log(`${d}   ${r.alert.padEnd(6)}  ${String(r.v2).padStart(6)}  ${String(r.v3).padStart(6)}   ${String(r.run2).padStart(4)}/${String(r.run3).padEnd(4)}일     ${(expect ?? 'brief').padEnd(6)} ${ok ? '✅' : '❌'} ${why}`)
}

// 남발 검사 — 2025년 전체를 하루씩 훑는다. 얕은 역전 3건(13~18일·전부 침체 없음)이 red 를 울리면 남발이다.
//   (임계 10일 시절 실측: red 17일 — 그래서 20일로 올렸다)
const days25 = s2.filter(o => o.date >= '2025-01-01' && o.date <= '2025-12-31').map(o => o.date)
let redDays = 0, briefDays = 0
for (const d of days25) { const a = asOf(d).alert; if (a === 'red') redDays++; else if (a === 'brief') briefDays++ }
console.log(`\n2025년 ${days25.length}거래일 스캔: 🔴 red ${redDays}일 · 🟠 brief ${briefDays}일`)
if (redDays > 0) fail++
console.log(`${redDays > 0 ? '❌' : '✅'} 2025년 얕은 역전들(전부 침체 없이 종료)에 red 0일`)

// 커버리지 검사 — 임계를 올려서 진짜를 놓치면 안 된다: 1980년 이후 모든 NBER 침체가
//   그 전 36개월 내에 red(≥RED_MIN_DAYS 역전)로 선행 커버되는가
const rec = await fred('USREC', '1978-01-01')
const recStarts = []
for (let i = 1; i < rec.length; i++) if (rec[i].v === 1 && rec[i - 1].v === 0) recStarts.push(rec[i].date)
const eps = [...M.findEpisodes(s2, M.RED_MIN_DAYS), ...M.findEpisodes(s3, M.RED_MIN_DAYS)]
console.log(`\n침체 선행 커버리지(red 임계 ${M.RED_MIN_DAYS}거래일 기준)`)
for (const rs of recStarts.filter(d => d >= '1980-01-01')) {
  const hit = eps.find(e => e.from < rs && (new Date(rs) - new Date(e.from)) / 864e5 / 30.44 <= 36)
  if (!hit) fail++
  console.log(`  ${hit ? '✅' : '❌'} 침체 ${rs} ← ${hit ? `역전 ${hit.from}(${hit.days}일)` : 'red 선행 없음'}`)
}

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
