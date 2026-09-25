// 매수·매도 쓰기 계획 검증 — 기존 두 모달과 같은 규칙인지(가중평단·실현손익·전량매도 삭제·과매도 거부·저장 후 사이드이펙트)
import { createRequire } from 'module'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-trade`
// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src` }, include: [`${ROOT}/src/lib/tradeWrite.ts`, `${ROOT}/src/lib/bustCache.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)); process.exit(1) }
const outFile = `${OUT}/lib/tradeWrite.js`
if (!existsSync(outFile)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
// '@/x' → 컴파일된 .bt-trade/x (소스 .ts 가 아니라 tsc 출력 .js 로 매핑해야 require 가 성공한다)
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const T = require2(outFile)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }
const IN = { ticker: '005930', name: '삼성전자', market: 'KR', currency: 'KRW', price: 70000, quantity: 10, date: '2026-09-26', role: 'SATELLITE' }

const n = T.planBuy('u1', null, IN)
check('새 종목 → kind new', n.kind === 'new')
check('  investments insert 필드', n.insert.purchase_price === 70000 && n.insert.quantity === 10 && n.insert.asset_role === 'SATELLITE' && n.insert.lynch_category === null && n.insert.purchase_date === '2026-09-26')
check('  거래 = buy · 총액 700,000 · 메모 최초 매수', n.tx.type === 'buy' && n.tx.total_amount === 700000 && n.tx.memo === '최초 매수' && n.tx.fee === 0)

const trimmed = T.planBuy('u1', null, { ...IN, ticker: ' 005930 ' })
check('티커 공백 trim + 대문자 (모달과 같음)', trimmed.insert.ticker === '005930' && trimmed.tx.ticker === '005930')

const ex = { id: 'inv1', quantity: 10, purchase_price: 60000, name: '삼성전자', asset_role: 'SATELLITE' }
const d = T.planBuy('u1', ex, IN)
check('같은 종목 → kind dca', d.kind === 'dca' && d.investmentId === 'inv1')
check('  가중평단 65,000 · 수량 20', d.update.purchase_price === 65000 && d.update.quantity === 20)
check('  거래 investment_id 연결 · 메모 추가 매수', d.tx.investment_id === 'inv1' && d.tx.memo === '추가 매수')
const odd = T.planBuy('u1', { ...ex, quantity: 3, purchase_price: 100 }, { ...IN, price: 101, quantity: 4 })
check('  평단 소수 둘째 자리 반올림', odd.update.purchase_price === Math.round((3 * 100 + 4 * 101) / 7 * 100) / 100)
const microEx = { id: 'm1', quantity: 1000, purchase_price: 0.015, name: '소액코인', asset_role: 'SATELLITE' }
const micro = T.planBuy('u1', microEx, { ...IN, ticker: 'XYZ', market: 'CRYPTO', price: 0.015, quantity: 1000 })
check('  소액 코인 평단 0.015원 → 0.015 유지(0.02 로 망가지지 않음)', micro.update.purchase_price === 0.015)
const micro2 = T.planBuy('u1', microEx, { ...IN, ticker: 'XYZ', market: 'CRYPTO', price: 0.016, quantity: 2000 })
check('  소액 코인 가중평단 (15+32)/3000 = 0.015666667 (유효숫자 8)', micro2.update.purchase_price === Number((47 / 3000).toPrecision(8)))
const mid = T.planBuy('u1', { ...ex, quantity: 3, purchase_price: 50 }, { ...IN, price: 51, quantity: 4 })
check('  100 미만 평단 → 유효숫자 8자리', mid.update.purchase_price === Number(((150 + 204) / 7).toPrecision(8)))

const s = T.planSell('u1', ex, { ...IN, price: 66000, quantity: 4 })
check('일부 매도 → 잔여 6주 update', s.kind === 'sell' && s.after.type === 'update' && s.after.quantity === 6)
check('  실현손익 (66,000−60,000)×4 = 24,000 · 평단 기록', s.tx.realized_pnl === 24000 && s.tx.avg_cost_basis === 60000 && s.tx.type === 'sell')
const all = T.planSell('u1', ex, { ...IN, price: 50000, quantity: 10 })
check('전량 매도 → 보유 삭제 · 손실 −100,000', all.after.type === 'delete' && all.tx.realized_pnl === -100000)
const over = T.planSell('u1', ex, { ...IN, quantity: 11 })
check('보유보다 많이 팔기 → 오류 · 주식은 "주"', over.kind === 'error' && over.message === '최대 10주까지 팔 수 있어요.')
const coinEx = { id: 'c1', quantity: 0.1 + 0.2, purchase_price: 50000000, name: '비트코인', asset_role: 'SATELLITE' }
const coinOver = T.planSell('u1', coinEx, { ...IN, ticker: 'BTC', market: 'CRYPTO', quantity: 1 })
check('코인 과매도 → "개" · 부동소수 잡음 없이(0.3)', coinOver.kind === 'error' && coinOver.message === '최대 0.3개까지 팔 수 있어요.')
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

// ── executeTrade — 실제 DB 없이 가짜 Supabase 로 순서·오류 분기 검증 ─────────
// 각 연산은 table.op 문자열을 log 에 남기고, select/eq/single 체이닝은 같은 결과로 흘려보낸다(thenable + 체이닝 겸용)
function makeFakeSb(overrides = {}) {
  const log = []
  const defaultData = (table, op) => table === 'investments' && op === 'insert' ? { id: 'newId' } : (op === 'update' || op === 'delete') ? [{ id: 'row' }] : null
  const canned = (table, op) => overrides[`${table}.${op}`] ?? { data: defaultData(table, op), error: null }
  // select 가 불렸는지도 남긴다 — 안 부르면 실제 Supabase 는 update·delete 의 반영 행을 돌려주지 않는다
  const leaf = (result, tag) => {
    const self = {
      then: (res, rej) => Promise.resolve(result).then(res, rej),
      select: () => { log.push(`${tag}.select`); return self },
      single: () => self,
      eq: () => self,
    }
    return self
  }
  const sb = {
    from: (table) => ({
      insert: () => { log.push(`${table}.insert`); return leaf(canned(table, 'insert'), `${table}.insert`) },
      update: () => { log.push(`${table}.update`); return leaf(canned(table, 'update'), `${table}.update`) },
      delete: () => { log.push(`${table}.delete`); return leaf(canned(table, 'delete'), `${table}.delete`) },
    }),
  }
  return { sb, log }
}

const ops = (log) => log.filter((x) => !x.endsWith('.select'))   // 순서 검사는 쓰기 연산만
const { sb: sbA, log: logA } = makeFakeSb()
const rA = await T.executeTrade(sbA, n)
check('executeTrade 신규 → investments.insert 후 transactions.insert · ok', rA.ok === true && ops(logA)[0] === 'investments.insert' && ops(logA)[1] === 'transactions.insert')

const { sb: sbB, log: logB } = makeFakeSb()
const rB = await T.executeTrade(sbB, d)
check('executeTrade DCA → investments.update 후 transactions.insert · ok', rB.ok === true && ops(logB)[0] === 'investments.update' && ops(logB)[1] === 'transactions.insert')

const { sb: sbC, log: logC } = makeFakeSb()
const rC = await T.executeTrade(sbC, all)
check('executeTrade 전량매도 → transactions.insert 후 investments.delete · ok', rC.ok === true && ops(logC)[0] === 'transactions.insert' && ops(logC)[1] === 'investments.delete')

const { sb: sbD, log: logD } = makeFakeSb({ 'transactions.insert': { data: null, error: { message: 'tx insert boom' } } })
const rD = await T.executeTrade(sbD, all)
check('executeTrade 매도 중 거래기록 실패 → 실패 · partial 아님 · investments 쓰기 없음', rD.ok === false && rD.partial === false && typeof rD.message === 'string' && !logD.some((x) => x.startsWith('investments.')))

const { sb: sbE } = makeFakeSb({ 'investments.delete': { data: null, error: { message: 'delete boom' } } })
const rE = await T.executeTrade(sbE, all)
check('executeTrade 매도 중 보유삭제 실패 → 절반기록 메시지 · partial', rE.ok === false && rE.partial === true && rE.message === '거래는 기록됐지만 보유 수량 반영에 실패했어요 — 선생님께 알려 주세요 (delete boom)')

const { sb: sbF, log: logF } = makeFakeSb()
const rF = await T.executeTrade(sbF, over)
check('executeTrade 오류 계획 → DB 호출 0 · 메시지 그대로', rF.ok === false && rF.partial === false && rF.message === over.message && logF.length === 0)

// ── 반영 0행 — 다른 탭에서 지웠거나 RLS 가 막으면 update·delete 가 오류 없이 0행을 돌려준다 ─────────
const STALE = '이 종목 정보가 바뀌었어요 — 새로고침 후 다시 기록해 주세요.'
const { sb: sbG, log: logG } = makeFakeSb({ 'investments.update': { data: [], error: null } })
const rG = await T.executeTrade(sbG, d)
check('DCA 반영 0행 → 실패(바뀜 안내) · partial 아님 · 거래 기록 안 씀', rG.ok === false && rG.partial === false && rG.message === STALE && !logG.includes('transactions.insert'))
const { sb: sbH } = makeFakeSb({ 'investments.delete': { data: [], error: null } })
const rH = await T.executeTrade(sbH, all)
check('전량매도 삭제 0행 → 절반기록 메시지 · partial', rH.ok === false && rH.partial === true && rH.message.startsWith('거래는 기록됐지만') && rH.message.includes(STALE))
const { sb: sbI } = makeFakeSb({ 'investments.update': { data: [], error: null } })
const rI = await T.executeTrade(sbI, s)
check('일부매도 수량 반영 0행 → 절반기록 메시지 · partial', rI.ok === false && rI.partial === true && rI.message.startsWith('거래는 기록됐지만'))
const { sb: sbJ } = makeFakeSb({ 'investments.update': { data: null, error: null } })
const rJ = await T.executeTrade(sbJ, d)
const { sb: sbL, log: logL } = makeFakeSb()
await T.executeTrade(sbL, d)
const { sb: sbM, log: logM } = makeFakeSb()
await T.executeTrade(sbM, all)
const { sb: sbN, log: logN } = makeFakeSb()
await T.executeTrade(sbN, s)
check('update·delete 는 모두 .select 로 반영 행을 돌려받는다(DCA·전량·일부 매도)', logL.includes('investments.update.select') && logM.includes('investments.delete.select') && logN.includes('investments.update.select'))
check('DCA 반영 결과 없음(null) → 실패(1행 아님)', rJ.ok === false && rJ.message === STALE)
const { sb: sbK } = makeFakeSb({ 'investments.update': { data: [{ id: 'a' }, { id: 'b' }], error: null } })
const rK = await T.executeTrade(sbK, d)
check('DCA 반영 2행 → 실패(정확히 1행이어야)', rK.ok === false)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (매수·매도 쓰기 규칙)')
process.exit(fail ? 1 : 0)
