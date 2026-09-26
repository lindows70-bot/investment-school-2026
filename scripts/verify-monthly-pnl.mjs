// 월별 자산 흐름(monthlySeries.buildMonthlySeries) 검증 — 판 날이 없으면 예전과 한 글자도 다르지 않은지, 판 로트가 판 달부터 빠지는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-mpnl`

const tsconfig = {
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/monthlySeries.ts`],
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
const outFile = `${OUT}/lib/monthlySeries.js`
if (!existsSync(outFile)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }

const require2 = Module.createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const M = require2(outFile)

let fail = 0
const check = (label, ok) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) fail++ }

// ── 고정 픽스처 — 월마다 15일·28일 두 봉 ──────────────────────────────────
const addM = (m, d) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + mo - 1 + d; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}` }
const series = (from, to, base, step) => { const out = []; let k = 0; for (let m = from; m <= to; m = addM(m, 1), k++) { out.push({ date: `${m}-15`, close: base + k * step }); out.push({ date: `${m}-28`, close: base + k * step + (k % 3) * 2 }) } return out }
function fixtureA() {
  const candleMap = new Map([
    ['AAA', series('2025-01', '2026-09', 100, 3)],
    ['USX', series('2025-06', '2026-09', 40, 2)],     // 2025-02 매수인데 이력은 06월부터 → 앞쪽 잘림
  ])
  const fx = series('2024-12', '2026-09', 1300, 5)
  const lots = [
    { ticker: 'AAA', market: 'KR', currency: 'KRW', purchase_price: 100, quantity: 10, purchase_date: '2025-03-10' },
    { ticker: 'aaa', market: 'KR', currency: 'KRW', purchase_price: 130, quantity: 5, purchase_date: '2025-11-05', currentPrice: 150 },
    { ticker: 'USX', market: 'US', currency: 'USD', purchase_price: 50, quantity: 3, purchase_date: '2025-02-01', currentPrice: 70 },
    { ticker: 'NOC', market: 'KR', currency: 'KRW', purchase_price: 10, quantity: 1, purchase_date: '2025-05-01' },   // 캔들 없음 → skipped
  ]
  return { lots, candleMap, fx, now: '2026-09', usdKrwNow: 1390 }
}
function fixtureB() {   // 36개월 상한에 걸리는 오래된 보유
  const candleMap = new Map([['OLD', series('2021-12', '2026-09', 200, 1)], ['NEW', series('2021-12', '2026-09', 50, 1)]])
  const fx = series('2021-12', '2026-09', 1200, 2)
  const lots = [
    { ticker: 'OLD', market: 'KR', currency: 'KRW', purchase_price: 190, quantity: 2, purchase_date: '2022-01-20' },
    { ticker: 'NEW', market: 'US', currency: 'USD', purchase_price: 60, quantity: 1.5, purchase_date: '2024-07-02' },
  ]
  return { lots, candleMap, fx, now: '2026-09', usdKrwNow: null }
}
const run = (x, lots = x.lots) => M.buildMonthlySeries(lots, x.candleMap, x.fx, x.now, x.usdKrwNow)
const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex')

// ── ① 판 날이 없으면 예전과 같다 — 옮기기 전 monthlyPnl.buildMonthlySeries(HEAD d72038a)로 같은 픽스처를 돌린 결과의 해시 ──
const GOLD_A = 'fa841f7bdf370d5efcdb6d59caddade01ad68ceec65371c0e86e4c42ccdb5d86'
const GOLD_B = '3fabf59c729bcb3e03037e6354f14afd65ff8b267585eae8bf6fb344f9de4a9c'
const A = fixtureA(), B = fixtureB()
const ra = run(A), rb = run(B)
check('판 날 없음(픽스처 A: 추가매수·달러·이력 잘림·시세 없음) → 옮기기 전 결과와 동일', sha(ra) === GOLD_A)
check('판 날 없음(픽스처 B: 36개월 상한) → 옮기기 전 결과와 동일', sha(rb) === GOLD_B)
if (sha(ra) !== GOLD_A) console.log(JSON.stringify(ra))
check('픽스처 A 모양: 2025-07 시작 · 잘림 2025-02~06 · NOC 제외', ra.points[0]?.month === '2025-07' && ra.truncated?.from === '2025-02' && ra.truncated?.to === '2025-06' && ra.skipped.join() === 'NOC')
check('sold_date: null 은 안 적은 것과 같다', sha(run(A, A.lots.map(l => ({ ...l, sold_date: null })))) === GOLD_A)

// ── ② 판 로트는 판 달 말부터 빠진다 ──────────────────────────────────────
const sell = A.lots.map((l, i) => i === 0 ? { ...l, sold_date: '2025-12-20' } : l)   // AAA 10주 2025-12 에 매도
const rs = run(A, sell)
const at = (r, m) => r.points.find(p => p.month === m)
const aaaClose = (m) => A.candleMap.get('AAA').filter(c => c.date <= `${m}-99`).slice(-1)[0].close
check('판 달 직전(2025-11)엔 그대로 들어 있다', at(rs, '2025-11')?.valueKrw === at(ra, '2025-11')?.valueKrw && at(rs, '2025-11')?.lotCount === at(ra, '2025-11')?.lotCount)
check('판 달(2025-12) 말엔 빠진다 — 평가액이 AAA 10주만큼 줄고 로트 수 −1',
  at(rs, '2025-12')?.valueKrw === at(ra, '2025-12')?.valueKrw - aaaClose('2025-12') * 10 && at(rs, '2025-12')?.lotCount === at(ra, '2025-12')?.lotCount - 1)
check('판 달 이후(2026-05)도 계속 빠져 있다', at(rs, '2026-05')?.lotCount === at(ra, '2026-05')?.lotCount - 1)
check('판 달 이후 누적손익 = 남은 로트 것만(판 로트의 평가손익 제외)',
  at(rs, '2026-05')?.cumPnl === at(ra, '2026-05')?.cumPnl - (aaaClose('2026-05') - 100) * 10)
check('판 로트가 있어도 시작월·잘림은 그대로(이력이 멀쩡하면 거짓 잘림 없음)', rs.points[0]?.month === '2025-07' && JSON.stringify(rs.truncated) === JSON.stringify(ra.truncated))

// ── ③ expected 가 판 로트를 세지 않는다 — 셌다면 판 달부터 전부 '모자란 달'이 된다 ──
const C = { candleMap: new Map([['KKK', series('2025-01', '2026-09', 100, 1)], ['LLL', series('2025-01', '2026-09', 20, 1)]]), fx: series('2025-01', '2026-09', 1300, 1), now: '2026-09', usdKrwNow: null }
const rc = run(C, [
  { ticker: 'KKK', market: 'KR', currency: 'KRW', purchase_price: 100, quantity: 4, purchase_date: '2025-02-03', sold_date: '2025-06-10' },
  { ticker: 'LLL', market: 'KR', currency: 'KRW', purchase_price: 20, quantity: 7, purchase_date: '2025-04-01' },
])
check('판 로트 뒤에도 잘림 없음 · 첫 매수월(2025-02)부터 끝까지', rc.truncated === null && rc.points[0]?.month === '2025-02' && rc.points[rc.points.length - 1]?.month === '2026-09')
check('판 달(2025-06)부터 로트 1개 · 그 전(2025-05)은 2개', at(rc, '2025-05')?.lotCount === 2 && at(rc, '2025-06')?.lotCount === 1)
// 첫 '완전한 달'이 매도 뒤에야 오는 경우 — 판 로트를 세면 어느 달도 완전하지 않아 차트가 통째로 비었다
const C2 = { ...C, candleMap: new Map([['KKK', series('2025-01', '2026-09', 100, 1)], ['LLL', series('2025-07', '2026-09', 20, 1)]]) }
const rc2 = run(C2, [
  { ticker: 'KKK', market: 'KR', currency: 'KRW', purchase_price: 100, quantity: 4, purchase_date: '2025-02-03', sold_date: '2025-06-10' },
  { ticker: 'LLL', market: 'KR', currency: 'KRW', purchase_price: 20, quantity: 7, purchase_date: '2025-02-05' },
])
check('판 로트 뒤에야 이력이 갖춰져도 차트가 나온다(2025-08 부터 · 잘림 2025-02~07)',
  rc2.points[0]?.month === '2025-08' && rc2.truncated?.from === '2025-02' && rc2.truncated?.to === '2025-07')

// ── ④ 다 팔고 빈 달 → 평가액 0(모자란 달이 아니라 들고 있던 게 없는 달) · 다시 사면 이어진다 ──
const rd = run(C, [
  { ticker: 'KKK', market: 'KR', currency: 'KRW', purchase_price: 100, quantity: 4, purchase_date: '2025-02-03', sold_date: '2025-04-10' },
  { ticker: 'LLL', market: 'KR', currency: 'KRW', purchase_price: 20, quantity: 7, purchase_date: '2025-07-01' },
])
check('빈 달(2025-04~06) 평가액 0 · 로트 0', ['2025-04', '2025-05', '2025-06'].every(m => at(rd, m)?.valueKrw === 0 && at(rd, m)?.lotCount === 0))
check('빈 달이 있어도 잘림 없음 · 2025-02 부터', rd.truncated === null && rd.points[0]?.month === '2025-02')
// 이력이 모자란 달 바로 뒤의 빈 달도 '완전한 달'이다 — 빈 달을 불완전으로 보면 다시 산 첫 달(2025-06)까지 잘려 나간다
const C3 = { ...C, candleMap: new Map([['KKK', series('2025-04', '2026-09', 100, 1)], ['LLL', series('2025-01', '2026-09', 20, 1)]]) }
const rg = run(C3, [
  { ticker: 'KKK', market: 'KR', currency: 'KRW', purchase_price: 100, quantity: 4, purchase_date: '2025-02-03', sold_date: '2025-04-10' },
  { ticker: 'LLL', market: 'KR', currency: 'KRW', purchase_price: 20, quantity: 7, purchase_date: '2025-06-01' },
])
check('이력 모자란 달 → 빈 달 → 다시 매수: 2025-05(빈 달)부터 · 2025-06 이 남는다 · 잘림 2025-02~04',
  rg.points[0]?.month === '2025-05' && at(rg, '2025-06')?.lotCount === 1 && rg.truncated?.from === '2025-02' && rg.truncated?.to === '2025-04')

// ── ⑤ 같은 달에 사고 판 로트는 어느 월말에도 없다 — 앞쪽 빈 달·거짓 잘림을 만들지 않는다 ──
const re = run(C, [
  { ticker: 'KKK', market: 'KR', currency: 'KRW', purchase_price: 100, quantity: 4, purchase_date: '2025-02-03', sold_date: '2025-02-25' },
  { ticker: 'LLL', market: 'KR', currency: 'KRW', purchase_price: 20, quantity: 7, purchase_date: '2025-05-01' },
])
check('같은 달 매수·매도 로트 무시 → 2025-05 부터 · 잘림 없음', re.points[0]?.month === '2025-05' && re.truncated === null)
const rf = run(C, [{ ticker: 'NOPE', market: 'KR', currency: 'KRW', purchase_price: 1, quantity: 1, purchase_date: '2025-02-03', sold_date: '2025-02-25' }])
check('같은 달 매수·매도뿐 + 캔들 없음 → 빈 결과 · skipped 에도 안 넣음', rf.points.length === 0 && rf.skipped.length === 0 && rf.truncated === null)

// ── ⑥ 창(최근 36개월) 시작 전에 판 로트 — 시세를 안 모으고(needsCandles), '못 가져옴'에도 안 넣고, 잘린 구간엔 남긴다 ──
const early = { ticker: 'GONE', market: 'KR', currency: 'KRW', purchase_price: 5, quantity: 3, purchase_date: '2021-03-02', sold_date: '2023-05-10' }
const lateSold = { ...early, ticker: 'LATE', sold_date: '2023-11-10' }   // 창 첫 달(2023-10) 이후에 판 것 → 필요
check('needsCandles: 창 전(2023-05)에 판 로트 false · 창 안(2023-11)에 판 로트 true', M.needsCandles(early, '2026-09') === false && M.needsCandles(lateSold, '2026-09') === true)
check('needsCandles: 창 첫 달(2023-10)에 판 로트 false(그 달 말엔 이미 없다)', M.needsCandles({ ...early, sold_date: '2023-10-31' }, '2026-09') === false && M.windowStart('2026-09') === '2023-10')
check('needsCandles: 판 날 없는 로트(대시보드)는 늘 true — 창 전 매수·미래 날짜도', [...A.lots, ...B.lots, { ...A.lots[0], purchase_date: '2027-01-01' }].every(l => M.needsCandles(l, '2026-09')))
check('needsCandles: 같은 달에 사고 판 로트 false', M.needsCandles({ ...early, purchase_date: '2025-02-01', sold_date: '2025-02-20' }, '2026-09') === false)
const rh = run(B, [...B.lots, early])   // GONE 은 캔들이 없다(안 모았으니까)
check('창 전에 판 로트(캔들 없음) → skipped 아님 · 점은 판 로트 없을 때와 같다 · 잘림은 그 매수월(2021-03)부터',
  rh.skipped.length === 0 && JSON.stringify(rh.points) === JSON.stringify(rb.points) && rh.truncated?.from === '2021-03' && rh.truncated?.to === '2023-09')

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (월별 자산 흐름)')
process.exit(fail ? 1 : 0)
