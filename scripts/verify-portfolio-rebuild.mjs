// ✅ 재구성 SSOT 단위검증 — 실제 lib 컴파일 + **실제 계좌 데이터**로 대조.
//    핵심 질문: 재구성 결과가 DB 에 저장된 보유(수량·평단)와 일치하는가.
//    일치하면 "거래가 진실의 원천"이라는 전제가 성립하고, 수정·삭제를 안전하게 붙일 수 있다.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'pr-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')] },
  files: [join(ROOT, 'src/lib/portfolioRebuild.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })
const M = await import('file://' + join(out, 'src/lib/portfolioRebuild.js').replace(/\\/g, '/'))

let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }

// ── ① 합성 케이스 — 규약이 의도대로 도는가 ────────────────────────────────────
console.log('═══ ① 합성 케이스 ═══')
const t = (id, type, price, quantity, d) => ({ id, type, price, quantity, transaction_date: d })
{
  // 10주@100 매수 → 5주@120 매도 → 평단 100 유지, 실현 +100
  const r = M.rebuildFromTransactions([t('a', 'buy', 100, 10, '2026-01-01'), t('b', 'sell', 120, 5, '2026-02-01')])
  check(r.quantity === 5, `잔여 수량 5 (실제 ${r.quantity})`)
  check(r.avgPrice === 100, `평단 100 유지 — 한국식 이동평균 (실제 ${r.avgPrice})`)
  check(r.realizedTotal === 100, `실현손익 +100 (실제 ${r.realizedTotal})`)
}
{
  // 물타기: 10주@100 + 10주@200 → 평단 150
  const r = M.rebuildFromTransactions([t('a', 'buy', 100, 10, '2026-01-01'), t('b', 'buy', 200, 10, '2026-02-01')])
  check(r.avgPrice === 150, `물타기 평단 150 (실제 ${r.avgPrice})`)
}
{
  // 입력 순서를 뒤집어도 같은 결과여야 한다(내부 정렬)
  const asc = M.rebuildFromTransactions([t('a', 'buy', 100, 10, '2026-01-01'), t('b', 'sell', 120, 5, '2026-02-01')])
  const desc = M.rebuildFromTransactions([t('b', 'sell', 120, 5, '2026-02-01'), t('a', 'buy', 100, 10, '2026-01-01')])
  check(asc.avgPrice === desc.avgPrice && asc.realizedTotal === desc.realizedTotal, '입력 순서에 의존하지 않는다')
}
{
  // 전량 매도 → 수량 0
  const r = M.rebuildFromTransactions([t('a', 'buy', 100, 10, '2026-01-01'), t('b', 'sell', 120, 10, '2026-02-01')])
  check(r.quantity === 0, `전량 매도 후 수량 0 (실제 ${r.quantity})`)
}
{
  // 보유보다 많이 판 기록 → problems 에 남는다(조용히 넘어가지 않는다)
  const r = M.rebuildFromTransactions([t('a', 'buy', 100, 5, '2026-01-01'), t('b', 'sell', 120, 10, '2026-02-01')])
  check(r.problems.length > 0, `과다 매도를 problems 로 보고 (${r.problems[0] ?? '없음'})`)
}

// ── ② 실제 계좌 전 종목 대조 ─────────────────────────────────────────────────
console.log('\n═══ ② 실제 계좌 대조 — 재구성 vs DB 저장값 ═══')
const env = readFileSync('.env.local', 'utf8')
const URL_ = (env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m) || [])[1]?.trim()
const KEY = (env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) || [])[1]?.trim()
const q = async (p) => {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(25000) })
  return r.ok ? r.json() : []
}
const profs = await q('profiles?select=id,email,full_name')
const me = profs.find(p => p.email === 'lindows70@gmail.com')
const [txs, invs] = await Promise.all([
  q(`transactions?user_id=eq.${me.id}&select=id,ticker,type,price,quantity,transaction_date,created_at,realized_pnl&limit=2000`),
  q(`investments?user_id=eq.${me.id}&select=id,ticker,quantity,purchase_price,currency`),
])
console.log(`  거래 ${txs.length}건 · 보유 ${invs.length}종\n`)
console.log('  종목       재구성수량   DB수량    재구성평단    DB평단      판정')
let match = 0, mismatch = 0
for (const inv of invs) {
  const k = inv.ticker.toUpperCase()
  const mine = txs.filter(x => x.ticker.toUpperCase() === k)
  if (!mine.length) { console.log(`  ${k.padEnd(10)} (거래 기록 없음 — 재구성 불가)`); continue }
  const r = M.rebuildFromTransactions(mine)
  const d = M.diffAgainstStored(r, inv)
  const ok = !d.qtyChanged && !d.avgChanged
  ok ? match++ : mismatch++
  console.log(`  ${k.padEnd(10)} ${String(r.quantity).padStart(10)} ${String(inv.quantity).padStart(9)} ${String(r.avgPrice).padStart(11)} ${String(inv.purchase_price).padStart(10)}   ${ok ? '✅' : `⚠️ Δ수량 ${d.qtyDelta} Δ평단 ${d.avgDelta}`}`)
  if (r.problems.length) for (const p of r.problems) console.log(`      ⚠️ ${p}`)
}
console.log(`\n  일치 ${match}종 · 불일치 ${mismatch}종`)
check(match > 0, `재구성이 실제 보유와 일치하는 종목이 있다(${match}종)`)

// ── ③ GOOGL 집중 확인 — 잘못 기입 사건의 실제 영향 ───────────────────────────
console.log('\n═══ ③ GOOGL — 잘못 기입 사건 영향 ═══')
const g = txs.filter(x => x.ticker.toUpperCase() === 'GOOGL')
const rg = M.rebuildFromTransactions(g)
console.log(`  재구성: ${rg.quantity}주 @ ${rg.avgPrice} · 실현손익 합계 ${rg.realizedTotal}`)
for (const s of rg.sells) {
  const stored = g.find(x => x.id === s.id)
  const same = Math.abs(Number(stored?.realized_pnl ?? 0) - s.realizedPnl) < 0.02
  console.log(`    매도 ${stored?.transaction_date} — 재계산 ${s.realizedPnl} vs 저장값 ${stored?.realized_pnl} ${same ? '✅' : '⚠️ 다름'}`)
}
// 잘못된 두 건(2026-08-23 매수 + 매도)을 뺐을 때 어떻게 되나
const cleaned = g.filter(x => x.transaction_date !== '2026-08-23')
const rc = M.rebuildFromTransactions(cleaned)
console.log(`\n  ⓘ 8/23 두 건을 제거하면: ${rc.quantity}주 @ ${rc.avgPrice} · 실현손익 ${rc.realizedTotal}`)
console.log(`     (지금은 ${rg.quantity}주 @ ${rg.avgPrice} · 실현손익 ${rg.realizedTotal})`)

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
