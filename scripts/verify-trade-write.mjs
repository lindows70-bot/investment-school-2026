// 매수·매도 쓰기 계획 검증 — 기존 두 모달과 같은 규칙인지(가중평단·실현손익·전량매도 삭제·과매도 거부)
import { createRequire } from 'module'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-trade`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, incremental: false, target: 'es2020', rootDir: `${ROOT}/src` }, include: [`${ROOT}/src/lib/tradeWrite.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const outFile = `${OUT}/lib/tradeWrite.js`
if (!existsSync(outFile)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const T = require2(outFile)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }
const IN = { ticker: '005930', name: '삼성전자', market: 'KR', currency: 'KRW', price: 70000, quantity: 10, date: '2026-09-26', role: 'SATELLITE' }

const n = T.planBuy('u1', null, IN)
check('새 종목 → kind new', n.kind === 'new')
check('  investments insert 필드', n.insert.purchase_price === 70000 && n.insert.quantity === 10 && n.insert.asset_role === 'SATELLITE' && n.insert.lynch_category === null && n.insert.purchase_date === '2026-09-26')
check('  거래 = buy · 총액 700,000 · 메모 최초 매수', n.tx.type === 'buy' && n.tx.total_amount === 700000 && n.tx.memo === '최초 매수' && n.tx.fee === 0)

const ex = { id: 'inv1', quantity: 10, purchase_price: 60000, name: '삼성전자', asset_role: 'SATELLITE' }
const d = T.planBuy('u1', ex, IN)
check('같은 종목 → kind dca', d.kind === 'dca' && d.investmentId === 'inv1')
check('  가중평단 65,000 · 수량 20', d.update.purchase_price === 65000 && d.update.quantity === 20)
check('  거래 investment_id 연결 · 메모 추가 매수', d.tx.investment_id === 'inv1' && d.tx.memo === '추가 매수')
const odd = T.planBuy('u1', { ...ex, quantity: 3, purchase_price: 100 }, { ...IN, price: 101, quantity: 4 })
check('  평단 소수 둘째 자리 반올림', odd.update.purchase_price === Math.round((3 * 100 + 4 * 101) / 7 * 100) / 100)

const s = T.planSell('u1', ex, { ...IN, price: 66000, quantity: 4 })
check('일부 매도 → 잔여 6주 update', s.kind === 'sell' && s.after.type === 'update' && s.after.quantity === 6)
check('  실현손익 (66,000−60,000)×4 = 24,000 · 평단 기록', s.tx.realized_pnl === 24000 && s.tx.avg_cost_basis === 60000 && s.tx.type === 'sell')
const all = T.planSell('u1', ex, { ...IN, price: 50000, quantity: 10 })
check('전량 매도 → 보유 삭제 · 손실 −100,000', all.after.type === 'delete' && all.tx.realized_pnl === -100000)
const over = T.planSell('u1', ex, { ...IN, quantity: 11 })
check('보유보다 많이 팔기 → 오류', over.kind === 'error')
check('보유 없는 매도 → 오류', T.planSell('u1', null, IN).kind === 'error')
check('가격 0 → 오류', T.planBuy('u1', null, { ...IN, price: 0 }).kind === 'error')

const dust = { id: 'inv3', quantity: 1.0, purchase_price: 50000000, name: '비트코인', asset_role: 'SATELLITE' }
const dustSell = T.planSell('u1', dust, { ...IN, price: 60000000, quantity: 0.99995 })
check('코인 먼지 매도(0.99995/1.0) → 전량 삭제(TransactionModal 기준 0.0001)', dustSell.after.type === 'delete')
const tinyOver = T.planSell('u1', ex, { ...IN, quantity: 10.0000000001 })
check('보유보다 부동소수 오차만큼만 많이 팔기 → 오류(엡실론 없음)', tinyOver.kind === 'error')

const snap = T.snapshotOf({ peg: 1.2, growth: 15, category: 'stalwart', opMargin: 10, sector: 'IT', flow: 'IN', mfi: 55, seasonTag: 's', season: 'x', fomcStance: 'h', rateDir: 'up' }, 70000)
check('스냅샷 필드 = 모달과 같은 이름', snap.peg === 1.2 && snap.growth_rate === 15 && snap.price_at_record === 70000 && 'recorded_at' in snap && snap.rateDir === 'up')
check('스냅샷 없음 → null', T.snapshotOf(null, 70000) === null)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (매수·매도 쓰기 규칙)')
process.exit(fail ? 1 : 0)
