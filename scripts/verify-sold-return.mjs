// 내 자산 '판 종목 손익까지 더한 수익률' 검증 — studentTotalReturn 이 스쿨 리그 라우트의 옛 계산과 같은 입력에 바이트 단위로 같은 값을 내는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-sold-return`

const tsconfig = {
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT,
    module: 'commonjs',
    moduleResolution: 'node',
    noEmit: false,
    declaration: false,
    incremental: false,
    noEmitOnError: true,
    target: 'es2020',
    rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/realizedPnl.ts`, `${ROOT}/src/lib/portfolioSummary.ts`],
}
writeFileSync(`${ROOT}/.bt-sold-return.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 타입 에러로 아무것도 못 내놔도 옛 .js 로 거짓 green 이 난다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-sold-return.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/realizedPnl.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/' 별칭 해석 — 컴파일 결과 안의 '@/lib/…' 를 OUT 아래로 돌린다
const { createRequire, default: Module } = await import('node:module')
const origResolve = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) req = `${OUT}/${req.slice(2)}`
  return origResolve.call(this, req, ...rest)
}
const require = createRequire(import.meta.url)
const M = require(`${OUT}/lib/realizedPnl.js`)

let fail = 0
function check(label, cond) {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}`); fail++ }
}

// 커밋 30d571b 의 school-league 라우트 342~354 행을 그대로 옮긴 기준 계산(바뀌기 전 코드)
function routeBefore(totalCost, totalCurrent, mySells, fxCandles, usdKrw) {
  const rt = mySells.length
    ? M.buildRealizedTotals(mySells, fxCandles, usdKrw)
    : { realizedKrw: 0, soldCostKrw: 0, sellCount: 0, fxFallbackCount: 0 }
  const denom = totalCost + rt.soldCostKrw
  const unrealized = totalCurrent - totalCost
  const raw = M.totalReturnPct(unrealized, totalCost, rt.realizedKrw, rt.soldCostKrw)
  const totalReturn = raw == null ? null : parseFloat(raw.toFixed(1))
  const realizedPp = denom > 0 ? parseFloat((rt.realizedKrw / denom * 100).toFixed(1)) : 0
  return { totalReturn, realizedPp, sellCount: rt.sellCount }
}
const routeAfter = (...a) => {
  const r = M.studentTotalReturn(...a)
  return { totalReturn: r.totalReturn, realizedPp: r.realizedPp, sellCount: r.realized.sellCount }
}

const fx = [
  { date: '2026-05-01', open: 0, high: 0, low: 0, close: 1380.5, volume: 0 },
  { date: '2026-06-02', open: 0, high: 0, low: 0, close: 1402.25, volume: 0 },
  { date: '2026-08-14', open: 0, high: 0, low: 0, close: 1391.1, volume: 0 },
]
const S = (o) => ({ ticker: 'X', transaction_date: '2026-06-10', ...o })
const cases = [
  ['매도 없음', 32_000_000, 29_883_442, [], fx, 1395.7],
  ['원화 매도만', 10_000_000, 11_234_567, [S({ currency: 'KRW', realized_pnl: 450_000, price: 70_000, quantity: 30 })], [], 1395.7],
  ['달러 매도(매도일 환율)', 20_000_000, 18_500_000, [
    S({ currency: 'USD', realized_pnl: 1234.56, price: 210.5, quantity: 20, transaction_date: '2026-06-03' }),
    S({ currency: 'USD', realized_pnl: -88.2, price: 45.1, quantity: 7, transaction_date: '2026-08-20' }),
  ], fx, 1395.7],
  ['환율 이력보다 오래된 매도(최신 환율 폴백)', 5_000_000, 5_100_000, [S({ currency: 'USD', realized_pnl: 50, price: 100, quantity: 3, transaction_date: '2025-12-01' })], fx, 1395.7],
  ['가격·수량 없는 옛 매도행', 3_000_000, 2_900_000, [S({ currency: 'KRW', realized_pnl: 120_000, price: null, quantity: null })], [], 1395.7],
  ['날짜 깨진 매도행', 3_000_000, 2_900_000, [S({ currency: 'USD', realized_pnl: 10, price: 50, quantity: 2, transaction_date: 'bad' })], fx, 1395.7],
  ['보유 0 + 매도만(분모는 매도분 원가)', 0, 0, [S({ currency: 'KRW', realized_pnl: -30_000, price: 10_000, quantity: 10 })], [], 1395.7],
  ['분모 0 → null', 0, 0, [], [], 1395.7],
]
for (const [label, ...args] of cases) {
  const a = JSON.stringify(routeBefore(...args)), b = JSON.stringify(routeAfter(...args))
  check(`${label}: 라우트 옛 계산 = studentTotalReturn (${b})`, a === b)
}

// 뜻 검산 — 손으로 푼 값
const r1 = M.studentTotalReturn(10_000_000, 11_234_567, cases[1][3], [], 1395.7)
// 실현 450,000 · 매도분 원가 = 2,100,000 − 450,000 = 1,650,000 · (1,234,567 + 450,000) / 11,650,000 = 14.46%
check('손계산: 원화 매도 14.5% · 실현 기여 3.9%p', r1.totalReturn === 14.5 && r1.realizedPp === 3.9 && r1.realized.soldCostKrw === 1_650_000)
const r2 = M.studentTotalReturn(5_000_000, 5_100_000, cases[3][3], fx, 1395.7)
check('매도일 환율을 못 찾은 행은 fxFallbackCount 로 센다(조용한 폴백 금지)', r2.realized.fxFallbackCount === 1)
check('매도 없음 → 실현 기여 0 · 평가 수익률과 같음', (() => { const r = M.studentTotalReturn(32_000_000, 29_883_442, [], fx, 1395.7); return r.realizedPp === 0 && r.totalReturn === parseFloat(((29_883_442 - 32_000_000) / 32_000_000 * 100).toFixed(1)) })())

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (판 종목 손익까지 더한 수익률 = 스쿨 리그 계산)')
process.exit(fail ? 1 : 0)
