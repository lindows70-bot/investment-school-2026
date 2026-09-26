// 거래 기록 → 로트(lotsFromTrades) 검증 — 평균단가 보존·판 날·보유 수량 대조·대신 그리기(fallback)·합치기
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-lft`

const tsconfig = {
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/lotsFromTrades.ts`, `${ROOT}/src/lib/monthlySeries.ts`],
}
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
const outFile = `${OUT}/lib/lotsFromTrades.js`
if (!existsSync(outFile) || !existsSync(`${OUT}/lib/monthlySeries.js`)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }

const require2 = Module.createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const L = require2(outFile)
const S = require2(`${OUT}/lib/monthlySeries.js`)

let fail = 0
const check = (label, ok) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) fail++ }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

let seq = 0
const T = (ticker, type, price, quantity, date, created) => ({
  ticker, name: `${ticker}이름`, market: 'KR', currency: 'KRW', type, price, quantity, transaction_date: date,
  created_at: created ?? `2026-01-01T00:00:${String(seq++).padStart(2, '0')}Z`,
})
const H = (ticker, quantity, purchase_price, purchase_date, extra = {}) => ({ ticker, name: `${ticker}보유`, market: 'KR', currency: 'KRW', quantity, purchase_price, purchase_date, currentPrice: 999, ...extra })
const open = (r, t) => r.lots.filter(l => l.ticker === t && !l.sold_date)
const closed = (r, t) => r.lots.filter(l => l.ticker === t && l.sold_date)
const sumQ = (ls) => ls.reduce((s, l) => s + l.quantity, 0)
const sumC = (ls) => ls.reduce((s, l) => s + l.quantity * l.purchase_price, 0)

// ① 한 번 산 종목
const r1 = L.lotsFromTrades([T('AAA', 'buy', 100, 10, '2025-03-10')], [H('AAA', 10, 100, '2025-03-10')])
check('한 번 매수 → 로트 1개(산 날·가격·수량 그대로, 판 날 없음)', r1.lots.length === 1 && r1.lots[0].purchase_date === '2025-03-10' && r1.lots[0].purchase_price === 100 && r1.lots[0].quantity === 10 && !r1.lots[0].sold_date)
check('한 번 매수 → 대신 그린 것 없음 · 현재가는 보유에서', r1.fallback.length === 0 && r1.soldOut.length === 0 && r1.lots[0].currentPrice === 999)

// ② 적립(두 번 매수) — 각자 산 날로
const r2 = L.lotsFromTrades([T('AAA', 'buy', 100, 10, '2025-03-10'), T('AAA', 'buy', 130, 5, '2025-11-05')], [H('AAA', 15, 110, '2025-03-10')])
check('두 번 매수 → 로트 2개, 각자 산 날·가격', r2.lots.length === 2 && r2.lots[0].purchase_date === '2025-03-10' && r2.lots[1].purchase_date === '2025-11-05' && r2.lots[1].purchase_price === 130 && r2.lots[1].quantity === 5)

// ③ 일부 매도 — 열린 로트 전부를 같은 비율로 → 평단 보존
const r3 = L.lotsFromTrades([
  T('AAA', 'buy', 100, 10, '2025-03-10'), T('AAA', 'buy', 130, 5, '2025-11-05'), T('AAA', 'sell', 150, 6, '2026-02-02'),
], [H('AAA', 9, 110, '2025-03-10')])
const avg = (10 * 100 + 5 * 130) / 15
check('일부 매도 → 남은 수량 9 · 판 몫 6(판 날 2026-02-02)', near(sumQ(open(r3, 'AAA')), 9) && near(sumQ(closed(r3, 'AAA')), 6) && closed(r3, 'AAA').every(l => l.sold_date === '2026-02-02'))
check('일부 매도 → 남은 로트 원가 합 = 남은 수량 × 평단(평균단가 보존)', near(sumC(open(r3, 'AAA')), 9 * avg))
check('일부 매도 → 로트마다 같은 비율(각 60%)이 남는다', near(open(r3, 'AAA').find(l => l.purchase_date === '2025-03-10').quantity, 6) && near(open(r3, 'AAA').find(l => l.purchase_date === '2025-11-05').quantity, 3))
check('일부 매도 → 판 로트도 원래 산 날·가격을 지닌다', closed(r3, 'AAA').some(l => l.purchase_date === '2025-03-10' && l.purchase_price === 100 && near(l.quantity, 4)))
check('일부 매도 → 수량이 맞으니 대신 그린 것 없음', r3.fallback.length === 0)

// ④ 전량 매도 · 지금 보유 없음 → 전부 판 로트 · soldOut
const r4 = L.lotsFromTrades([T('BBB', 'buy', 50, 4, '2025-01-02'), T('BBB', 'sell', 60, 4, '2025-06-01')], [H('AAA', 1, 1, '2025-01-01')])
check('전량 매도 → 판 로트만(판 날 2025-06-01) · soldOut=[BBB]', open(r4, 'BBB').length === 0 && closed(r4, 'BBB').length === 1 && closed(r4, 'BBB')[0].sold_date === '2025-06-01' && r4.soldOut.join() === 'BBB')
check('전량 매도한 종목은 fallback 이 아니다', !r4.fallback.some(f => f.ticker === 'BBB'))
// 앱은 남은 수량 ≤ 0.0001 이면 보유 행을 지운다 — 코인 자투리가 '안 맞음'이 되면 안 된다
const r4b = L.lotsFromTrades([T('BTC', 'buy', 100, 0.50005, '2025-01-02'), T('BTC', 'sell', 120, 0.5, '2025-03-01')], [])
check('자투리(0.00005) 남기고 판 코인 → 앱처럼 전량 매도 · soldOut', r4b.soldOut.join() === 'BTC' && r4b.fallback.length === 0 && open(r4b, 'BTC').length === 0 && near(sumQ(closed(r4b, 'BTC')), 0.50005))
// 전량 매도 뒤 다시 사면 새 평단으로 시작(자투리를 섞지 않는다)
const r4c = L.lotsFromTrades([T('BTC', 'buy', 100, 0.50005, '2025-01-02'), T('BTC', 'sell', 120, 0.5, '2025-03-01'), T('BTC', 'buy', 90, 1, '2025-04-01')], [H('BTC', 1, 90, '2025-04-01')])
check('전량 매도 뒤 재매수 → 열린 로트는 새로 산 1개(가격 90)', open(r4c, 'BTC').length === 1 && open(r4c, 'BTC')[0].purchase_price === 90 && r4c.fallback.length === 0)

// ⑤ 가진 것보다 많이 판 기록 → mismatch · 지금 보유 한 줄로 대신
const r5 = L.lotsFromTrades([T('CCC', 'buy', 10, 3, '2025-01-02'), T('CCC', 'sell', 12, 5, '2025-02-01')], [H('CCC', 2, 11, '2024-12-01')])
check('가진 것보다 많이 매도 → mismatch', r5.fallback.length === 1 && r5.fallback[0].reason === 'mismatch' && r5.fallback[0].ticker === 'CCC')
check('mismatch → 보유 한 줄(수량 2·평단 11·보유 매수일)로 대신', r5.lots.length === 1 && r5.lots[0].quantity === 2 && r5.lots[0].purchase_price === 11 && r5.lots[0].purchase_date === '2024-12-01' && !r5.lots[0].sold_date)
// 되짚은 수량 ≠ 보유 수량(첫 매수 기록이 빠진 경우)
const r5b = L.lotsFromTrades([T('CCC', 'buy', 10, 3, '2025-01-02')], [H('CCC', 8, 11, '2024-12-01')])
check('되짚은 수량 3 ≠ 보유 8 → mismatch · 보유 한 줄', r5b.fallback[0]?.reason === 'mismatch' && r5b.lots.length === 1 && r5b.lots[0].quantity === 8)
// 보유는 없는데 기록상 남아 있다(매도 기록 누락) → mismatch · 그릴 로트 없음
const r5c = L.lotsFromTrades([T('DDD', 'buy', 10, 3, '2025-01-02')], [])
check('보유 없음 + 기록상 3주 남음 → mismatch · 로트 없음 · soldOut 아님', r5c.fallback[0]?.reason === 'mismatch' && r5c.lots.length === 0 && r5c.soldOut.length === 0)

// ⑤-b 수량은 맞는데 평단이 다르다(보유를 손으로 고친 경우) → mismatch
const r5d = L.lotsFromTrades([T('KKK', 'buy', 100, 10, '2025-03-10'), T('KKK', 'buy', 130, 5, '2025-11-05')], [H('KKK', 15, 120, '2025-03-10')])
check('수량 15 는 맞지만 보유 평단 120 ≠ 되짚은 평단 110 → mismatch · 보유 한 줄', r5d.fallback[0]?.reason === 'mismatch' && r5d.lots.length === 1 && r5d.lots[0].purchase_price === 120)
const r5e = L.lotsFromTrades([T('KKK', 'buy', 100, 10, '2025-03-10'), T('KKK', 'buy', 130, 5, '2025-11-05')], [H('KKK', 15, 110.004, '2025-03-10')])
check('평단 차이 0.004(반올림 범위) → 되짚은 로트 그대로', r5e.fallback.length === 0 && r5e.lots.length === 2)
const r5f = L.lotsFromTrades([T('KKK', 'buy', 100, 10, '2025-03-10'), T('KKK', 'buy', 130, 5, '2025-11-05')], [H('KKK', 15, 110.01, '2025-03-10')])
check('평단 차이 0.01 → mismatch', r5f.fallback[0]?.reason === 'mismatch')
// 앱은 매수마다 평단을 반올림해 저장한다 — 여러 번 쌓인 반올림(앱 저장값)과 같으면 통과
{
  const buys = [[101.333, 3], [99.777, 7], [100.555, 1], [102.111, 9], [98.999, 2]]
  let q = 0, a = 0, c = 0
  for (const [p, n] of buys) { a = q === 0 ? p : (Math.round(((q * a + n * p) / (q + n)) * 100) / 100); q += n; c += p * n }
  const trs = buys.map(([p, n], i) => T('RND', 'buy', p, n, `2025-0${i + 1}-10`))
  const rr = L.lotsFromTrades(trs, [H('RND', q, a, '2025-01-10')])
  check(`여러 번 반올림된 앱 평단(${a}, 정확값 ${(c / q).toFixed(4)})도 통과`, rr.fallback.length === 0)
}

// ⑥ 거래 기록이 없는 보유 → no-trades · 보유 한 줄
const r6 = L.lotsFromTrades([], [H('EEE', 7, 20, '2025-05-05'), H('FFF', 1, 5, null)])
check('기록 없는 보유 → no-trades 2건', r6.fallback.length === 2 && r6.fallback.every(f => f.reason === 'no-trades'))
check('기록 없는 보유 → 매수일 있는 것만 로트(EEE), 없는 것(FFF)은 로트 없음', r6.lots.length === 1 && r6.lots[0].ticker === 'EEE' && r6.lots[0].quantity === 7 && r6.lots[0].currentPrice === 999)

// ⑥-b '자동 동기화' 행(거래 내역 화면이 방문일·역산가로 끼워 넣은 매수)이 섞이면 되짚지 않는다 — 수량이 '만들어서' 맞기 때문
const syn = { ...T('JJJ', 'buy', 123, 2, '2026-09-20'), memo: '자동 동기화 (편집으로 누락된 거래 복구)' }
const r6b = L.lotsFromTrades([T('JJJ', 'buy', 100, 3, '2025-01-02'), syn], [H('JJJ', 5, 110, '2025-01-02')])
check('자동 동기화 행이 섞인 종목 → synthetic · 수량이 맞아도 되짚지 않고 보유 한 줄(5주·매수일 2025-01-02)',
  r6b.fallback.length === 1 && r6b.fallback[0].reason === 'synthetic' && r6b.lots.length === 1 && r6b.lots[0].quantity === 5 && r6b.lots[0].purchase_date === '2025-01-02')
const r6c = L.lotsFromTrades([{ ...T('JJJ', 'buy', 100, 5, '2025-01-02'), memo: '최초 매수' }], [H('JJJ', 5, 100, '2025-01-02')])
check('보통 메모(최초 매수)는 그대로 되짚는다', r6c.fallback.length === 0 && r6c.lots.length === 1)

// ⑥-c 같은 티커 보유가 두 줄(옛 데이터) → 합쳐서 대조(수량 합·가중평단)
const r6d = L.lotsFromTrades([T('MMM', 'buy', 100, 10, '2025-03-10'), T('MMM', 'buy', 130, 5, '2025-11-05')],
  [H('MMM', 10, 100, '2025-03-10'), H('mmm', 5, 130, '2025-11-05', { currentPrice: null })])
check('보유 두 줄(10주@100 + 5주@130) → 15주@110 으로 합쳐 대조 · 되짚은 로트 그대로', r6d.fallback.length === 0 && r6d.lots.length === 2 && r6d.lots.every(l => l.currentPrice === 999))
const r6e = L.lotsFromTrades([], [H('MMM', 10, 100, '2025-03-10'), H('MMM', 5, 130, '2024-11-05')])
check('기록 없는 보유 두 줄 → 한 로트 15주 · 가중평단 110 · 이른 매수일 2024-11-05', r6e.lots.length === 1 && r6e.lots[0].quantity === 15 && near(r6e.lots[0].purchase_price, 110) && r6e.lots[0].purchase_date === '2024-11-05')

// ⑦ 부동소수 — 0.1 + 0.2 를 사서 보유 0.3
const r7 = L.lotsFromTrades([T('ETH', 'buy', 100, 0.1, '2025-01-02'), T('ETH', 'buy', 110, 0.2, '2025-01-03')], [H('ETH', 0.3, 106.67, '2025-01-02')])
check('0.1 + 0.2 vs 보유 0.3 → 같은 수량으로 본다', r7.fallback.length === 0 && open(r7, 'ETH').length === 2)
const r7b = L.lotsFromTrades([T('ETH', 'buy', 100, 0.1, '2025-01-02'), T('ETH', 'buy', 110, 0.2, '2025-01-03'), T('ETH', 'sell', 120, 0.3, '2025-02-01')], [])
check('0.1 + 0.2 를 사서 0.3 을 팔면 전량 매도(가진 것보다 많이 판 게 아니다)', r7b.soldOut.join() === 'ETH' && r7b.fallback.length === 0)

// ⑧ 같은 날이면 적은 순서(created_at) — 받은 순서가 뒤섞여 있어도
const r8 = L.lotsFromTrades([
  T('GGG', 'sell', 12, 2, '2025-03-01', '2025-03-01T10:00:00Z'),
  T('GGG', 'buy', 10, 5, '2025-03-01', '2025-03-01T09:00:00Z'),
], [H('GGG', 3, 10, '2025-03-01')])
check('같은 날 매수(09시)·매도(10시)가 거꾸로 와도 매수 먼저 → 수량 맞음', r8.fallback.length === 0 && near(sumQ(open(r8, 'GGG')), 3))
const r8b = L.lotsFromTrades([
  T('GGG', 'buy', 10, 5, '2025-03-02', '2025-03-01T09:00:00Z'),
  T('GGG', 'sell', 12, 2, '2025-03-01', '2025-03-01T10:00:00Z'),
], [H('GGG', 3, 10, '2025-03-01')])
check('거래일이 우선 — 매도(3/1)가 매수(3/2)보다 먼저면 가진 것보다 많이 판 것 → mismatch', r8b.fallback[0]?.reason === 'mismatch')

// ⑨ 합치기 — 같은 종목·산 날·판 날·가격이면 한 로트
const r9 = L.lotsFromTrades([T('HHH', 'buy', 10, 1, '2025-03-01'), T('HHH', 'buy', 10, 2, '2025-03-01'), T('HHH', 'buy', 11, 1, '2025-03-01')], [H('HHH', 4, 10.25, '2025-03-01')])
check('같은 날·같은 가격 두 번 매수 → 한 로트(수량 3) · 가격 다른 건 따로', r9.lots.length === 2 && r9.lots.some(l => l.purchase_price === 10 && l.quantity === 3))
check('티커는 대소문자·공백을 무시하고 같은 종목으로 본다', L.lotsFromTrades([T(' aaa ', 'buy', 1, 2, '2025-01-01')], [H('AAA', 2, 1, '2025-01-01')]).fallback.length === 0)

// ⑩ 상한을 넘으면 같은 달 로트를 가중평단으로 합친다 — 월별 계산 결과는 그대로여야 한다
const many = []
for (let d = 1; d <= 20; d++) many.push(T('III', 'buy', 100 + d, 1 + d / 10, `2025-02-${String(d).padStart(2, '0')}`))
for (let d = 1; d <= 20; d++) many.push(T('III', 'buy', 90 + d, 1, `2025-03-${String(d).padStart(2, '0')}`))
many.push(T('III', 'sell', 130, 5, '2025-06-10'), T('III', 'sell', 130, 5, '2025-06-20'), T('III', 'sell', 140, 3, '2025-09-03'))
const heldQ = (() => { let q = 0; for (const t of many) q += t.type === 'buy' ? t.quantity : -t.quantity; return q })()
const avgIII = (() => { let q = 0, c = 0; for (const t of many) if (t.type === 'buy') { q += t.quantity; c += t.quantity * t.price } return c / q })()   // 매도는 평단을 안 바꾼다
const full = L.lotsFromTrades(many, [H('III', heldQ, avgIII, '2025-02-01', { currentPrice: 150 })])
const small = L.lotsFromTrades(many, [H('III', heldQ, avgIII, '2025-02-01', { currentPrice: 150 })], { maxLots: 10 })
check(`상한 전: 로트 ${full.lots.length}개 · 상한 10 → ${small.lots.length}개로 합쳐짐`, full.fallback.length === 0 && full.lots.length > 10 && small.lots.length <= 10)
check('합쳐도 수량 합·원가 합 그대로', near(sumQ(full.lots), sumQ(small.lots)) && near(sumC(full.lots), sumC(small.lots), 1e-6))
const addM = (m, d) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + mo - 1 + d; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}` }
const candles = []; { let k = 0; for (let m = '2025-01'; m <= '2026-09'; m = addM(m, 1), k++) candles.push({ date: `${m}-20`, close: 100 + k * 1.7 }) }
const fx = [{ date: '2025-01-01', close: 1300 }]
const sf = S.buildMonthlySeries(full.lots, new Map([['III', candles]]), fx, '2026-09', null)
const ss = S.buildMonthlySeries(small.lots, new Map([['III', candles]]), fx, '2026-09', null)
check('합친 로트로 그린 월별 흐름 = 합치기 전(평가액·누적손익 ±1원)',
  sf.points.length === ss.points.length && sf.points.length > 0 && sf.points.every((p, i) => p.month === ss.points[i].month && Math.abs(p.valueKrw - ss.points[i].valueKrw) <= 1 && Math.abs(p.cumPnl - ss.points[i].cumPnl) <= 1))
check('합친 로트도 판 날 ≥ 산 날(라우트 검증 통과)', small.lots.every(l => !l.sold_date || l.sold_date >= l.purchase_date))

// ⑪ 거래 기록 로트를 월별 계산에 넣으면: 판 달 말부터 빠진다(두 lib 연결)
const g = S.buildMonthlySeries(r3.lots, new Map([['AAA', candles]]), fx, '2026-09', null)
const lotsAt = (m) => g.points.find(p => p.month === m)?.lotCount
check('일부 매도 달(2026-02) 전후 — 1월 말엔 판 몫까지 4조각 · 2월 말엔 남은 몫 2조각', lotsAt('2026-01') === 4 && lotsAt('2026-02') === 2)
const closeAt = (m) => candles.filter(c => c.date <= `${m}-99`).slice(-1)[0].close
check('2026-01 말 평가액 = 15주 × 종가 · 2026-02 말 = 남은 9주 × 종가',
  g.points.find(p => p.month === '2026-01')?.valueKrw === Math.round(15 * closeAt('2026-01')) && g.points.find(p => p.month === '2026-02')?.valueKrw === Math.round(9 * closeAt('2026-02')))
check('2026-02 말 넣은 돈(평가액 − 누적손익) = 9주 × 평단', Math.abs((g.points.find(p => p.month === '2026-02').valueKrw - g.points.find(p => p.month === '2026-02').cumPnl) - 9 * avg) <= 1)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (거래 기록 → 로트)')
process.exit(fail ? 1 : 0)
