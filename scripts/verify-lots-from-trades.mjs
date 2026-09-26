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
check('평단 차이 0.01(0.009%) → mismatch 아님 · 1% 이내 보정(adjusted)', r5f.fallback.length === 0 && r5f.adjusted.length === 1 && r5f.adjusted[0].ticker === 'KKK')
// 평단을 나중에 손으로 고친 경우 — 1% 이내면 되짚은 로트를 지금 평단에 맞춰 보정(판 로트는 그대로), 넘으면 mismatch
{
  const trs = [T('ADJ', 'buy', 100, 10, '2025-03-10'), T('ADJ', 'buy', 130, 5, '2025-11-05'), T('ADJ', 'sell', 150, 6, '2026-02-02')]   // 되짚은 평단 110 · 남은 9주
  const hAvg = 110 * 1.0025                                                                                                          // 0.25% 높게 고침
  const ra = L.lotsFromTrades(trs, [H('ADJ', 9, hAvg, '2025-03-10')])
  check('평단 0.25% 차이 → adjusted(gapPct≈0.25) · fallback 아님', ra.fallback.length === 0 && ra.adjusted.length === 1 && near(ra.adjusted[0].gapPct, 0.25, 1e-9) && ra.adjusted[0].name === 'ADJ보유')
  check('보정 후 열린 로트 원가 합 = 9주 × 지금 평단(정확히)', near(sumC(open(ra, 'ADJ')), 9 * hAvg, 1e-9) && near(sumQ(open(ra, 'ADJ')), 9))
  check('보정해도 산 날·판 로트(가격 100·130, 판 날 2026-02-02)는 그대로', closed(ra, 'ADJ').every(l => (l.purchase_price === 100 || l.purchase_price === 130) && l.sold_date === '2026-02-02') && open(ra, 'ADJ').map(l => l.purchase_date).join() === '2025-03-10,2025-11-05')
  const rm = L.lotsFromTrades(trs, [H('ADJ', 9, 110 * 1.015, '2025-03-10')])
  check('평단 1.5% 차이 → mismatch · 보정 안 함', rm.fallback[0]?.reason === 'mismatch' && rm.adjusted.length === 0 && rm.lots.length === 1)
  check('평단이 반올림 범위로 맞으면 adjusted 에 안 넣는다', L.lotsFromTrades(trs, [H('ADJ', 9, 110.004, '2025-03-10')]).adjusted.length === 0)
}
// 앱은 매수마다 평단을 반올림해 저장한다 — 여러 번 쌓인 반올림(앱 저장값)과 같으면 통과
{
  const buys = [[101.333, 3], [99.777, 7], [100.555, 1], [102.111, 9], [98.999, 2]]
  let q = 0, a = 0, c = 0
  for (const [p, n] of buys) { a = q === 0 ? p : (Math.round(((q * a + n * p) / (q + n)) * 100) / 100); q += n; c += p * n }
  const trs = buys.map(([p, n], i) => T('RND', 'buy', p, n, `2025-0${i + 1}-10`))
  const rr = L.lotsFromTrades(trs, [H('RND', q, a, '2025-01-10')])
  check(`여러 번 반올림된 앱 평단(${a}, 정확값 ${(c / q).toFixed(4)})도 통과`, rr.fallback.length === 0)
}

// 선생님 AddInvestmentModal 추가 매수는 가격과 무관하게 매번 소수 둘째 자리 — $37~57 적립 12번이면 정확값과 0.0139 벌어진다
{
  const buys = [[44.7, 8.796], [43.23, 6.603], [50.5, 8.222], [37.99, 2.871], [56.74, 1.62], [45.12, 4.278], [42.7, 5.254], [55.02, 6.994], [50.41, 8.689], [51.11, 5.739], [54.71, 1.74], [44.67, 2.48]]
  let q = 0, a = 0, c = 0
  for (const [p, n] of buys) { a = q === 0 ? p : Math.round(((q * a + n * p) / (q + n)) * 100) / 100; q += n; c += p * n }
  const trs = buys.map(([p, n], i) => ({ ...T('DCA2', 'buy', p, n, `2025-${String(i + 1).padStart(2, '0')}-10`), currency: 'USD', market: 'US' }))
  const rr = L.lotsFromTrades(trs, [H('DCA2', q, a, '2025-01-10', { currency: 'USD', market: 'US' })])
  check(`둘째 자리로 12번 반올림된 평단(${a}) vs 정확값 ${(c / q).toFixed(4)} — 차이 ${Math.abs(a - c / q).toFixed(4)} 도 통과`, Math.abs(a - c / q) > 0.012 && rr.fallback.length === 0 && rr.lots.length === 12)
}

// ⑤-c 이미 판 종목(지금 보유 없음) — 대조할 보유가 없으니 기록을 되짚고, 안 맞으면 마지막 매도를 전량 매도로 본다
{
  // GE 버노바 모양: 자동 동기화 매수가 섞였지만 그걸 넣으면 딱 0 으로 끝난다 → 그린다(synthetic)
  const gev = L.lotsFromTrades([
    T('GEV', 'buy', 400, 1.20093, '2025-03-05'),
    { ...T('GEV', 'buy', 610, 0.094543, '2025-06-21'), memo: '자동 동기화 (편집으로 누락된 거래 복구)' },
    T('GEV', 'sell', 650, 1.295474, '2025-07-15'),
  ], [])
  check('판 종목 + 자동 동기화 행(끝이 0) → 그린다 · 전부 7/15 에 판 로트 · approxSold synthetic · fallback 아님',
    gev.fallback.length === 0 && gev.soldOut.join() === 'GEV' && gev.lots.length === 2 && gev.lots.every(l => l.sold_date === '2025-07-15')
    && gev.approxSold.length === 1 && gev.approxSold[0].reason === 'synthetic')
  // 이튼 모양: 첫 매수가 두 번 기록(최초 매수 · 기존 포트폴리오 이전) → 다 팔았는데 기록상 0.953 이 남는다 → 마지막 매도일에 전량 매도로
  const etnTr = [
    { ...T('ETN', 'buy', 427.49, 1.201567, '2025-04-02', '2025-04-02T05:13:56Z'), memo: '최초 매수' },
    { ...T('ETN', 'buy', 427.49, 1.201567, '2025-04-02', '2025-04-02T05:16:44Z'), memo: '기존 포트폴리오 이전' },
    T('ETN', 'buy', 300, 0.157324, '2025-04-20'), T('ETN', 'buy', 310, 0.299222, '2025-05-02'), T('ETN', 'buy', 320, 0.237505, '2025-05-20'),
    T('ETN', 'sell', 350, 1.143838, '2025-06-15', '2025-06-15T01:00:00Z'), T('ETN', 'sell', 350, 1, '2025-06-15', '2025-06-15T02:00:00Z'),
  ]
  const etn = L.lotsFromTrades(etnTr, [])
  const bought = 1.201567 * 2 + 0.157324 + 0.299222 + 0.237505
  check('판 종목 + 기록상 0.953 남음 → 남은 몫까지 마지막 매도일(6/15)에 전량 매도 · approxSold residual',
    etn.fallback.length === 0 && etn.lots.length > 0 && etn.lots.every(l => l.sold_date === '2025-06-15') && near(sumQ(etn.lots), bought) && etn.approxSold[0]?.reason === 'residual' && etn.soldOut.join() === 'ETN')
  // 가진 것보다 많이 판 판 종목 → 가진 것을 전부 그 매도에 판 것으로(뒤 매도는 넘어감)
  const over = L.lotsFromTrades([T('OVR', 'buy', 10, 2, '2025-01-02'), T('OVR', 'sell', 12, 3, '2025-02-01'), T('OVR', 'sell', 12, 1, '2025-03-01')], [])
  check('판 종목 + 가진 것보다 많이 매도 → 2/1 에 전량 매도 · residual', over.fallback.length === 0 && over.lots.length === 1 && over.lots[0].sold_date === '2025-02-01' && over.lots[0].quantity === 2 && over.approxSold[0]?.reason === 'residual')
  // 판 종목인데 매도가 하나도 없다 → 언제 팔았는지 알 수 없어 뺀다
  const nosell = L.lotsFromTrades([T('NOS', 'buy', 10, 2, '2025-01-02')], [])
  check('판 종목 + 매도 기록 없음 → mismatch · 로트 없음 · approxSold 아님', nosell.fallback[0]?.reason === 'mismatch' && nosell.lots.length === 0 && nosell.approxSold.length === 0)
  // 마지막 매도 뒤에 산 기록이 남았다 → 그 몫을 언제 팔았는지 모른다 → 뺀다
  const after = L.lotsFromTrades([T('AFT', 'buy', 10, 2, '2025-01-02'), T('AFT', 'sell', 12, 2, '2025-02-01'), T('AFT', 'buy', 11, 1, '2025-03-01')], [])
  check('판 종목 + 마지막 매도 뒤 매수 → mismatch · 로트 없음', after.fallback[0]?.reason === 'mismatch' && after.lots.length === 0)
  // 깔끔하게 다 판 종목은 approxSold 에 안 넣는다
  check('기록대로 딱 0 으로 끝난 판 종목 → approxSold 없음', r4.approxSold.length === 0)
  // 지금 들고 있는 종목은 그대로 — 자동 동기화 행이 있으면 synthetic 대체
  const heldSyn = L.lotsFromTrades([T('GEV', 'buy', 400, 1, '2025-03-05'), { ...T('GEV', 'buy', 610, 1, '2025-06-21'), memo: '자동 동기화 (편집으로 누락된 거래 복구)' }], [H('GEV', 2, 505, '2025-03-05')])
  check('보유 중 + 자동 동기화 → 여전히 synthetic 대체(되짚지 않음)', heldSyn.fallback[0]?.reason === 'synthetic' && heldSyn.approxSold.length === 0 && heldSyn.lots.length === 1)
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

// ⑩ 상한을 넘으면 종목마다 '월말 상태가 같은 구간'을 한 로트로 — 월별 계산 결과는 그대로여야 한다
const addM = (m, d) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + mo - 1 + d; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}` }
const heldEnd = (l, m) => l.purchase_date.slice(0, 7) <= m && (!l.sold_date || l.sold_date.slice(0, 7) > m)
/** 종목·월마다 월말 (수량 합, 원가 합) — 월별 계산이 로트에서 쓰는 것은 이것뿐이다 */
const stateOf = (lots, from, to) => { const o = {}; for (const t of new Set(lots.map(l => l.ticker))) for (let m = from; m <= to; m = addM(m, 1)) { const h = lots.filter(l => l.ticker === t && heldEnd(l, m)); o[`${t}|${m}`] = [h.reduce((s, l) => s + l.quantity, 0), h.reduce((s, l) => s + l.quantity * l.purchase_price, 0)] } return o }
const sameState = (a, b) => Object.keys({ ...a, ...b }).every(k => { const x = a[k] ?? [0, 0], y = b[k] ?? [0, 0]; return Math.abs(x[0] - y[0]) <= 1e-6 * Math.max(1, x[0]) && Math.abs(x[1] - y[1]) <= 1e-6 * Math.max(1, x[1]) })

const many = []
for (let d = 1; d <= 20; d++) many.push(T('III', 'buy', 100 + d, 1 + d / 10, `2025-02-${String(d).padStart(2, '0')}`))
for (let d = 1; d <= 20; d++) many.push(T('III', 'buy', 90 + d, 1, `2025-03-${String(d).padStart(2, '0')}`))
many.push(T('III', 'sell', 130, 5, '2025-06-10'), T('III', 'sell', 130, 5, '2025-06-20'), T('III', 'sell', 140, 3, '2025-09-03'))
const heldQ = (() => { let q = 0; for (const t of many) q += t.type === 'buy' ? t.quantity : -t.quantity; return q })()
const avgIII = (() => { let q = 0, c = 0; for (const t of many) if (t.type === 'buy') { q += t.quantity; c += t.quantity * t.price } return c / q })()   // 매도는 평단을 안 바꾼다
const full = L.lotsFromTrades(many, [H('III', heldQ, avgIII, '2025-02-01', { currentPrice: 150 })])
const small = L.lotsFromTrades(many, [H('III', heldQ, avgIII, '2025-02-01', { currentPrice: 150 })], { maxLots: 10 })
check(`상한 전: 로트 ${full.lots.length}개 · 상한 10 → ${small.lots.length}개(거래 있던 달 4개 이하)`, full.fallback.length === 0 && full.lots.length > 10 && small.lots.length <= 4 && !small.tooMany && !full.tooMany)
check('묶어도 월말 수량·원가 합 그대로(2025-01~2026-09)', sameState(stateOf(full.lots, '2025-01', '2026-09'), stateOf(small.lots, '2025-01', '2026-09')))
check('묶은 로트: 산 날은 실제 첫 매수일(2025-02-01) · 들고 있는 구간만 현재가', small.lots[0].purchase_date === '2025-02-01' && small.lots.filter(l => !l.sold_date).every(l => l.currentPrice === 150) && small.lots.filter(l => l.sold_date).every(l => l.currentPrice === null))
const candles = []; { let k = 0; for (let m = '2025-01'; m <= '2026-09'; m = addM(m, 1), k++) candles.push({ date: `${m}-20`, close: 100 + k * 1.7 }) }
const fx = [{ date: '2025-01-01', close: 1300 }]
const sf = S.buildMonthlySeries(full.lots, new Map([['III', candles]]), fx, '2026-09', null)
const ss = S.buildMonthlySeries(small.lots, new Map([['III', candles]]), fx, '2026-09', null)
check('묶은 로트로 그린 월별 흐름 = 묶기 전(평가액·누적손익 ±1원)',
  sf.points.length === ss.points.length && sf.points.length > 0 && sf.points.every((p, i) => p.month === ss.points[i].month && Math.abs(p.valueKrw - ss.points[i].valueKrw) <= 1 && Math.abs(p.cumPnl - ss.points[i].cumPnl) <= 1))
check('묶은 로트도 판 날 ≥ 산 날(라우트 검증 통과)', small.lots.every(l => !l.sold_date || l.sold_date >= l.purchase_date))

// ⑩-b 무작위 거래 300세트 — 매달 적립 + 주기적 매도(로트가 개월²로 불어나는 모양)에서도 묶기가 정확하고 상한 안에 든다
{
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let bad = 0, worst = 0, maxFull = 0, tooMany = 0
  for (let n = 0; n < 300; n++) {
    const trs = [], hs = []
    for (const tk of ['P1', 'P2', 'P3']) {
      let q = 0, avg = 0
      for (let m = '2023-01'; m <= '2026-09'; m = addM(m, 1)) {
        const r = rnd()
        if (r < 0.7) {                                             // 적립(같은 달 두 번도)
          const times = r < 0.15 ? 2 : 1
          for (let k = 0; k < times; k++) {
            const p = Math.round((50 + rnd() * 100) * 100) / 100, qty = 1 + Math.floor(rnd() * 5)
            avg = q <= 0.0001 ? p : (q * avg + qty * p) / (q + qty); q += qty
            trs.push(T(tk, 'buy', p, qty, `${m}-${String(3 + k * 10).padStart(2, '0')}`))
          }
        }
        if (q > 0 && rnd() < 0.25) {                               // 일부·전량 매도
          const qty = rnd() < 0.2 ? q : Math.round(q * (0.1 + rnd() * 0.5) * 1000) / 1000
          if (qty > 0) { trs.push(T(tk, 'sell', 100, qty, `${m}-25`)); q -= qty; if (q <= 0.0001) { q = 0; avg = 0 } }
        }
      }
      if (q > 0) hs.push(H(tk, q, avg, '2023-01-03'))
    }
    const f = L.lotsFromTrades(trs, hs, { maxLots: Infinity })
    const c = L.lotsFromTrades(trs, hs, { maxLots: 1 })
    maxFull = Math.max(maxFull, f.lots.length)
    if (f.fallback.length) { bad++; continue }
    if (!sameState(stateOf(f.lots, '2023-01', '2026-09'), stateOf(c.lots, '2023-01', '2026-09'))) bad++
    if (c.lots.some(l => l.sold_date && l.sold_date < l.purchase_date)) bad++
    worst = Math.max(worst, c.lots.length)
    if (L.lotsFromTrades(trs, hs).tooMany) tooMany++
  }
  check(`무작위 300세트: 묶기 전 최대 ${maxFull}개 → 묶은 뒤 최대 ${worst}개 · 월말 상태 전부 일치 · 기본 상한 400 초과 ${tooMany}건`, bad === 0 && worst <= 3 * 45 && tooMany === 0)
}
check('묶어도 상한을 넘으면 tooMany', L.lotsFromTrades(many, [H('III', heldQ, avgIII, '2025-02-01')], { maxLots: 2 }).tooMany === true)

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
