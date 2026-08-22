// ✅ 수익률곡선 SSOT 단위검증 — 실제 lib 을 컴파일해 돌린다(재구현 금지).
//    핵심 질문: ①경보 3단계가 역사에서 몇 번 울리나(남발 여부) ②리드타임 통계가 실측과 맞나
//               ③곡선이 한 날짜에 다 모이나 ④2022년 오경보가 history 에 남아 있나
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
if (!process.env.FRED_API_KEY) {
  try { process.env.FRED_API_KEY = (readFileSync('.env.local', 'utf8').match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim() } catch {}
}
const out = mkdtempSync(join(tmpdir(), 'yc-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  // ⚠️ files 만 쓰면 프로젝트 include 가 안 걸려 @types/node 가 안 붙는다(process 미정의) → types 명시
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')] },
  files: [join(ROOT, 'src/lib/yieldCurve.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })
const M = await import('file://' + join(out, 'src/lib/yieldCurve.js').replace(/\\/g, '/'))

const r = await M.buildYieldCurve()
if (!r) { console.error('❌ buildYieldCurve() 가 null — FRED 키/응답 확인'); process.exit(1) }

console.log(`═══ ③ 곡선 (${r.curveDate}) ═══`)
console.log('  ' + r.curve.map(c => `${c.label}=${c.v}`).join(' · '))
console.log(`  3개월 전(${r.curvePrevDate}): ${r.curvePrev ? r.curvePrev.map(c => c.v).join(' ') : '없음'}`)
console.log(`  모양: ${r.shape}\n  ${r.shapeNote}`)

console.log(`\n═══ 스프레드 ═══`)
for (const s of r.spreads) {
  console.log(`  ${s.label.padEnd(10)} ${s.value}%p (${s.date}) · 역전 연속 ${s.invertedDays}일 · 최심 ${s.minPp ?? '—'} · 1개월 ${s.chg1m} · 3개월 ${s.chg3m}`)
}
console.log(`\n═══ 경보 ═══\n  레벨 ${r.alert}\n  ${r.alertHeadline}\n  ${r.alertDetail}`)
console.log(`\n  Sahm: ${r.sahm ? `${r.sahm.v} (${r.sahm.date}) 발동=${r.sahm.triggered}` : '없음'}`)

console.log(`\n═══ ①② 과거 지속 역전(≥${M.RED_MIN_DAYS}거래일) ${r.history.length}건 ═══`)
for (const h of r.history) {
  console.log(`  ${h.from} ~ ${h.to} (${h.days}일, 최심 ${h.minPp.toFixed(2)}%p)${h.ongoing ? ' [진행중]' : ''} → ${h.outcome.padEnd(11)} ${h.outcomeLabel}${h.leadMonths != null ? ` (${h.leadMonths}개월)` : ''}`)
}
const cnt = (o) => r.history.filter(h => h.outcome === o).length
console.log(`\n  결말 분해: 침체 ${cnt('recession')} · 오경보 ${cnt('false_alarm')} · 이미 침체 중 ${cnt('already_in')} · 판단 유보 ${cnt('too_soon')} · 진행중 ${cnt('ongoing')}`)
const L = r.leadSummary
console.log(`\n  리드타임: 표본 ${L.n}건 · 중앙값 ${L.medianMonths}개월 · 범위 ${L.minMonths}~${L.maxMonths}개월 · 침체 안 온 역전 ${L.noRecession}건`)

// ── 검사 ──────────────────────────────────────────────────────────────────────
let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }
console.log('\n═══ 판정 ═══')
check(r.curve.length === 11, '만기 11종이 한 날짜에 모두 모였다')
check(r.curve.every(c => c.v > 0 && c.v < 25), '금리 값이 상식 범위(0~25%)')
check(r.series.length > 200, `스프레드 시계열 ${r.series.length}건(차트용 충분)`)
const e2022 = r.history.find(h => h.from.startsWith('2022'))
check(e2022?.outcome === 'false_alarm', `2022년 역전이 **오경보(false_alarm)** 로 분류됨 (${e2022 ? `${e2022.days}일·${e2022.minPp}%p → ${e2022.outcome}` : '없음'})`)
const e1982 = r.history.find(h => h.from.startsWith('1982'))
check(e1982?.outcome === 'already_in', `1982년 역전은 '이미 침체 중'으로 분류됨 — 오경보와 섞이면 안 된다 (실제 ${e1982?.outcome})`)
const e2025 = r.history.find(h => h.from.startsWith('2025'))
check(e2025?.outcome === 'too_soon', `2025년 역전은 '판단 유보'로 분류됨 (실제 ${e2025?.outcome})`)
check(L.noRecession === cnt('false_alarm'), `오경보 집계(${L.noRecession})가 실제 false_alarm 건수(${cnt('false_alarm')})와 일치`)
// 🔴 표와 통계의 잣대 일치 — 0개월(2020 코로나)이 빠져 표 12건 vs 통계 11건이던 적이 있다(2026-08-23)
const leadArr = r.history.filter(h => h.leadMonths != null).map(h => h.leadMonths)
check(L.n === cnt('recession'), `통계 표본(${L.n}) = 침체 분류 건수(${cnt('recession')}) — 표와 요약이 같은 것을 센다`)
check(L.minMonths === Math.min(...leadArr) && L.maxMonths === Math.max(...leadArr),
  `리드타임 범위 ${L.minMonths}~${L.maxMonths} = 실제 ${Math.min(...leadArr)}~${Math.max(...leadArr)}`)
check(L.n >= 4 && L.medianMonths != null, '리드타임 표본이 4건 이상')
// ⚠️ 경보 임계(RED_MIN_DAYS=20)와 이력 임계(HISTORY_MIN_DAYS=10)는 **역할이 다른 상수**다.
//    이력 표는 "경보로는 못 잡는 짧은 역전"도 보여주는 게 목적이므로 이력 임계로 검사해야 한다.
check(r.history.every(h => h.days >= M.HISTORY_MIN_DAYS), `모든 에피소드가 ${M.HISTORY_MIN_DAYS}거래일 이상(하루짜리 노이즈 제거됨)`)
// 경보 남발 검사 — 지금이 정상이면 alert 가 red 이면 안 된다
const minSpread = Math.min(...r.spreads.map(s => s.value))
check((minSpread >= M.FLAT_PP) === (r.alert === 'none'), `경보 레벨이 스프레드와 정합 (최소 ${minSpread}%p → ${r.alert})`)
check(r.alertDetail.includes('2022') || r.alert !== 'red', '🔴 경보문에 2022년 오경보 사례가 병기됨')

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
