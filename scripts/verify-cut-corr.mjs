// ✅ 인하 사이클 · 조건부 상관 SSOT 단위검증(실제 lib 컴파일).
//    핵심: Phase 0 에서 드러난 오분류 3건(1975·1992·2019)이 새 판정 축으로 바로잡혔나
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
if (!process.env.FRED_API_KEY) {
  try { process.env.FRED_API_KEY = (readFileSync('.env.local', 'utf8').match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim() } catch {}
}
const out = mkdtempSync(join(tmpdir(), 'bc-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')] },
  files: [join(ROOT, 'src/lib/cutCycleHistory.ts').replace(/\\/g, '/'), join(ROOT, 'src/lib/bondCorrelation.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })
const CC = await import('file://' + join(out, 'src/lib/cutCycleHistory.js').replace(/\\/g, '/'))
const BC = await import('file://' + join(out, 'src/lib/bondCorrelation.js').replace(/\\/g, '/'))

let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }

// ── ① 인하 사이클 ─────────────────────────────────────────────────────────────
const c = await CC.buildCutCycles()
if (!c) { console.error('❌ buildCutCycles() null'); process.exit(1) }
console.log(`═══ ① 인하 사이클 ${c.cycles.length}건 ═══`)
console.log('시작월        금리   실업률 Δ12M   침체중 유형        12M내침체   SPX 6M/12M/24M      10Y Δ12M')
for (const x of c.cycles) {
  const p = (v) => v == null ? '   —  ' : String((v >= 0 ? '+' : '') + v).padStart(6)
  console.log(`${x.start}  ${String(x.fedRate).padEnd(6)} ${String(x.unrate ?? '—').padEnd(5)} ${String(x.unrateChg12 ?? '—').padStart(5)}  ${x.inRecessionAtStart ? ' Y ' : ' N '}   ${(x.kind === 'insurance' ? '🟢보험성' : '🔴위기성')}  ${(x.recessionWithin12m ?? '—').padEnd(11)} ${p(x.spx6m)}${p(x.spx12m)}${p(x.spx24m)}   ${p(x.dgs10Chg12)}`)
}
console.log('\n유형별 요약')
for (const s of c.summary) {
  console.log(`  ${s.label} — ${s.n}건(주가표본 ${s.nWithSpx}건) · 12개월 SPX 평균 ${s.avgSpx12}% 중위 ${s.medSpx12}% 승률 ${s.winRate12}% · 10Y ${s.avgDgs10Chg12}%p · 12개월내 침체율 ${s.recessionRate}%`)
}
console.log(`\n현재 사이클: ${c.current?.start} (${c.current?.kind})`)

console.log('\n═══ 판정 — Phase 0 오분류가 바로잡혔나 ═══')
const at = (d) => c.cycles.find(x => x.start === d)
const k1975 = at('1975-11-01'), k1992 = at('1992-08-01'), k2019 = at('2019-10-01'), k2024 = at('2024-10-01')
check(k1975?.kind === 'crisis', `1975-11 (실업률 ${k1975?.unrate}·Δ${k1975?.unrateChg12}) → ${k1975?.kind} [기대 crisis]`)
check(k1992?.kind === 'crisis', `1992-08 (실업률 ${k1992?.unrate}·Δ${k1992?.unrateChg12}) → ${k1992?.kind} [기대 crisis]`)
check(k2019?.kind === 'insurance', `2019-10 (실업률 ${k2019?.unrate}·Δ${k2019?.unrateChg12}) → ${k2019?.kind} [기대 insurance — 코로나는 외생 충격]`)
check(k2024?.kind === 'insurance', `2024-10 (실업률 ${k2024?.unrate}·Δ${k2024?.unrateChg12}) → ${k2024?.kind} [현재 사이클]`)
check(c.summary.every(s => s.n >= 5), '두 유형 모두 표본 5건 이상')
check(c.cycles.filter(x => x.spx12m != null).length >= 8, `주가 성과 표본 ${c.cycles.filter(x => x.spx12m != null).length}건`)

// ── ② 조건부 상관 ─────────────────────────────────────────────────────────────
const b = await BC.buildBondCorrelation()
if (!b) { console.error('❌ buildBondCorrelation() null'); process.exit(1) }
console.log(`\n═══ ② 채권 상관 (${b.from} ~ ${b.to}, ${b.days}일) ═══`)
console.log(`발작일 ${b.stressDays}일 · 규칙 ${b.stressRule}`)
console.log(`MOVE ${b.move?.last} (${b.move?.date}) · 1년 백분위 ${b.move?.pct1y}% · 국면 ${b.move?.regime}`)
console.log('\n자산            평상시   발작기   변화    발작일 평균수익')
for (const r of b.rows) {
  const f = (v, u = '') => v == null ? '  —  ' : String(v > 0 ? '+' + v : v).padStart(6) + u
  console.log(`  ${r.label.padEnd(14)} ${f(r.all)} ${f(r.stress)} ${f(r.shift)}   ${f(r.stressAvgRet, '%')}`)
}
console.log('\n최근 큰 발작일:', b.recentStress.map(s => `${s.date} TLT ${s.tltRet > 0 ? '+' : ''}${s.tltRet}%`).join(' · '))

console.log('\n═══ 판정 ═══')
check(b.rows.length === BC.CORR_ASSETS.length, `자산 ${b.rows.length}종 전부 계산됨`)
check(b.rows.every(r => r.all == null || (r.all >= -1 && r.all <= 1)), '상관계수가 −1~+1 범위')
check(b.stressDays >= 50 && b.stressDays <= b.days * 0.15, `발작일 ${b.stressDays}일이 전체의 10%대(표본 충분·과다 아님)`)
const ief = b.rows.find(r => r.sym === 'IEF')
check(ief?.all != null && ief.all > 0.8, `IEF(중기국채) 상관 ${ief?.all} — 같은 채권이라 0.8 이상이어야 정상`)
check(b.rows.some(r => r.shift != null && Math.abs(r.shift) >= 0.1), '평상시↔발작기 상관 변화가 실제로 존재(조건부 분리의 의미)')
check(b.notes.some(n => n.includes('2022')), '2022년 통념 붕괴 캐비엇 포함')

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
