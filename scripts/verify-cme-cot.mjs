// ✅ CME COT SSOT 단위검증 — 실제 lib 컴파일(재구현 금지).
//    핵심: ①영상 주장("숏→롱 일제 전환")을 우리 판정이 그대로 반복하지 않는가
//          ②'전환(flipped)'이 부호가 실제 바뀔 때만 켜지는가 ③베이시스 캐비엇이 항상 실리는가
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'cot-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')] },
  files: [join(ROOT, 'src/lib/cmeCot.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })
const M = await import('file://' + join(out, 'src/lib/cmeCot.js').replace(/\\/g, '/'))

const d = await M.buildCmeCot()
if (!d) { console.error('❌ buildCmeCot() null'); process.exit(1) }

console.log(`═══ CME 비트코인 선물 COT (${d.reportDate} 기준 · ${d.staleDays}일 전) ═══`)
console.log(`  총 미결제약정 ${d.openInterest.toLocaleString()}계약`)
console.log('\n주체            롱      숏      순      숏%OI   최근8주  직전8주  방향        전환')
for (const g of d.groups) {
  console.log(`  ${g.label.padEnd(10)} ${String(g.long).padStart(7)} ${String(g.short).padStart(7)} ${String((g.net >= 0 ? '+' : '') + g.net).padStart(8)} ${String(g.shortPctOi ?? '—').padStart(6)}% ${String(g.netRecent).padStart(8)} ${String(g.netPrior).padStart(8)}  ${g.trend.padEnd(10)} ${g.flipped ? '★' : '-'}`)
}
console.log(`\n헤드라인: ${d.headline}`)
console.log(`해석: ${d.reading}`)
console.log(`\n시계열 ${d.series.length}주 · 캐비엇 ${d.caveats.length}건`)

let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }
console.log('\n═══ 판정 ═══')
const lev = d.groups.find(g => g.key === 'lev')
const asset = d.groups.find(g => g.key === 'asset')
check(d.groups.length === 3, '3주체(헤지펀드·자산운용사·딜러) 전부 계산됨')
check(d.groups.every(g => g.net === g.long - g.short), '순포지션 = 롱 − 숏 항등식')
check(d.series.length >= 12, `시계열 ${d.series.length}주(차트 충분)`)
check(d.staleDays >= 0 && d.staleDays <= 14, `보고 지연 ${d.staleDays}일이 상식 범위(주간 보고·금요일 공표)`)

// ★ 영상 주장 반증 — 우리 판정이 "숏→롱 전환"을 주장하면 안 된다(실데이터가 그렇지 않으므로)
check(!lev.flipped || lev.netRecent > 0, `헤지펀드 flipped=${lev.flipped} — 부호가 실제 바뀐 경우만 켜져야 한다(순 ${lev.net})`)
// ⚠️ 단순 부분문자열 검사는 **부정문을 긍정으로 오탐한다**(해석문이 『"하락에 걸었다"로 읽으면 안 됩니다』이다).
//    "그 표현이 없는가"가 아니라 "부정어와 함께 쓰였는가"를 본다.
check(lev.net >= 0 || /하락에 걸었다[^.]*(안 됩니다|아닙니다|아니다)/.test(d.reading),
  '순숏일 때 "하락 베팅"을 단정이 아니라 **부정문**으로만 언급한다')
check(d.reading.includes('차익거래'), '해석문에 베이시스(차익거래) 구분이 포함됨')
check(d.caveats.some(c => c.includes('차익거래')), '캐비엇에 베이시스 트레이드 경고 포함')
check(d.caveats.some(c => c.includes('화요일')), '캐비엇에 후행성(화요일 마감·금요일 공표) 명시')
check(d.caveats.some(c => c.includes('펀딩비')), '캐비엇에 "글로벌 개인 레버리지와 다른 축"임을 명시')
check(d.caveats.some(c => c.includes('5%')), '⛔ 코인 가드 5% 포함')

// flipped 로직 자체 검사 — 부호 안 바뀌면 false 여야
const flipCases = d.groups.map(g => ({ l: g.label, prior: g.netPrior, recent: g.netRecent, f: g.flipped }))
for (const c of flipCases) {
  const expect = (c.prior < 0 && c.recent > 0) || (c.prior > 0 && c.recent < 0)
  check(c.f === expect, `${c.l} 전환판정 ${c.f} (직전 ${c.prior} → 최근 ${c.recent}, 기대 ${expect})`)
}

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
