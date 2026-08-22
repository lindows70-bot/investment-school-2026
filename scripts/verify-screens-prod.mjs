// ✅ 배포 후 독립 검증 — 스크린샷 대응 3종이 프로덕션에서 실제로 나오는가
const P = 'https://investment-school-2026.vercel.app/api/'
let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }

const cot = await fetch(P + 'crypto-cot', { signal: AbortSignal.timeout(90000) }).then(r => r.ok ? r.json() : null)
console.log('═══ ② CME COT ═══')
if (cot) {
  const L = cot.longRecord
  console.log(`  기준 ${cot.reportDate} · 헤지펀드 순 ${cot.groups[0].net.toLocaleString()} · 자산운용사 순 ${cot.groups[1].net.toLocaleString()}`)
  console.log(`  📜 ${L?.fromDate} 이후 ${L?.totalWeeks}주 중 — 헤지펀드 순롱 ${L?.levLongWeeks}주(마지막 ${L?.levLastLongDate}) · 자산운용사 순롱 ${L?.assetLongWeeks}주`)
  check(!!L, 'longRecord 필드 존재(캐시 v2 반영)')
  check(L?.levLongWeeks === 20, `헤지펀드 전 이력 순롱 20주 — 로컬 실측과 일치(실제 ${L?.levLongWeeks})`)
  check(L?.levLastLongDate === '2019-02-05', `마지막 순롱 2019-02-05 (실제 ${L?.levLastLongDate})`)
  check(cot.caveats.some(c => c.includes('원자료 기록')), '캐비엇에 원자료 기록 포함')
} else { console.log('  ❌ 응답 없음'); fail++ }

const ar = await fetch(P + 'asset-ranking', { signal: AbortSignal.timeout(90000) }).then(r => r.ok ? r.json() : null)
console.log('\n═══ ④ 자산 시총 순위 ═══')
if (ar) {
  ar.assets.forEach((a, i) => console.log(`  ${String(i + 1).padStart(2)}. ${a.name.padEnd(14)} $${(a.cap / 1e12).toFixed(2).padStart(6)}조  ${String(a.vsBtc).padStart(6)}배`))
  console.log(`  → 비트코인 ${ar.btcRank}위 · 금의 ${ar.btcVsGoldPct}%`)
  check(ar.assets.length >= 8, `자산 ${ar.assets.length}종`)
  check(ar.assets[0].key === 'gold', `1위가 금 (실제 ${ar.assets[0].name})`)
  check(ar.btcVsGoldPct > 0 && ar.btcVsGoldPct < 30, `비트코인이 금의 ${ar.btcVsGoldPct}% — 상식 범위`)
} else { console.log('  ❌ 응답 없음'); fail++ }

const b = await fetch(P + 'bonds', { signal: AbortSignal.timeout(120000) }).then(r => r.ok ? r.json() : null)
console.log('\n═══ ③ 미국 총부채(YCC 패널 동승) ═══')
const dbt = b?.ycc?.usDebt
if (dbt) {
  console.log(`  $${(dbt.total / 1e12).toFixed(2)}조 (${dbt.date}) · 1년 전 대비 +${dbt.yoyPct}%`)
  check(dbt.total > 30e12 && dbt.total < 60e12, `총부채 ${(dbt.total / 1e12).toFixed(1)}조 — 상식 범위(스크린샷 39.0조/2026-03 대비 증가)`)
  check(dbt.yoyPct != null && dbt.yoyPct > 0, `전년비 +${dbt.yoyPct}% 계산됨`)
} else { console.log('  ❌ usDebt 없음(캐시 미범프 의심)'); fail++ }
// 기존 축 회귀 확인
check(!!b?.cutCycles && !!b?.correlation && !!b?.realYield, '채권편 기존 축(인하사이클·상관·금리3형제) 회귀 없음')

console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
