// 보유 요약 SSOT 검증 — 실제 lib 을 컴파일해 합계·환율·시세 실패·비중·투자 체크를 확인
import { createRequire } from 'module'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-psum`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({ extends: `${ROOT}/tsconfig.json`, compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src`, incremental: false }, include: [`${ROOT}/src/lib/portfolioSummary.ts`] }, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const outFile = `${OUT}/lib/portfolioSummary.js`
if (!existsSync(outFile)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const P = require2(outFile)
let fail = 0
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail++ }
const near = (a, b) => Math.abs(a - b) < 0.01

const H = (o) => ({ id: o.t, ticker: o.t, name: o.t, market: o.m ?? 'KR', currency: o.c ?? 'KRW', purchase_price: o.p, quantity: o.q, asset_role: o.r ?? 'SATELLITE' })
const s1 = P.summarizePortfolio(
  [H({ t: '005930', p: 60000, q: 10 }), H({ t: '360750', p: 20000, q: 10, r: 'CORE' })],
  { '005930': { currentPrice: 66000, change: 1000, changePct: 1.54 }, '360750': { currentPrice: 20000, change: 0, changePct: 0 } },
  1350)
check('원가 합계 = 600,000 + 200,000', s1.totalCostKrw === 800000)
check('평가 합계 = 660,000 + 200,000', s1.totalEvalKrw === 860000)
check('손익 = +60,000 / +7.5%', s1.pnlKrw === 60000 && near(s1.pnlPct, 7.5))
check('오늘 = +10,000 (어제 평가 850,000 기준 +1.18%)', s1.todayKrw === 10000 && near(s1.todayPct, 10000 / 850000 * 100))
check('코어 비중 = 200,000/860,000', near(s1.corePct, 200000 / 860000 * 100) && near(s1.corePct + s1.satPct, 100))
check('행은 평가금액 큰 순', s1.rows[0].ticker === '005930')

const s2 = P.summarizePortfolio([H({ t: 'NVDA', m: 'US', c: 'USD', p: 100, q: 2 })], { NVDA: { currentPrice: 110, change: 5, changePct: 4.76 } }, 1400)
check('달러 종목은 환율 곱', s2.totalEvalKrw === 110 * 2 * 1400 && s2.todayKrw === 5 * 2 * 1400)

const s3 = P.summarizePortfolio([H({ t: 'BTC', m: 'CRYPTO', p: 100000000, q: 0.01 })], { BTC: { currentPrice: 0, change: 0, changePct: 0, error: 'timeout' } }, 1350)
check('시세 실패 → priced:false, 평가는 매수가', s3.rows[0].priced === false && s3.totalEvalKrw === 1000000)
check('시세 실패 → 오늘 등락 null, 개수 1', s3.todayKrw === 0 && s3.todayPct === null && s3.unpricedCount === 1)

const s4 = P.summarizePortfolio([], {}, 1350)
check('빈 보유 → 0 · null', s4.totalEvalKrw === 0 && s4.pnlPct === null && s4.todayPct === null && s4.corePct === 0)

check('체크: 코어 42 vs 목표 60 → 코어 18%p 부족', P.rebalanceCheck(42, 60)?.kind === 'core-short' && P.rebalanceCheck(42, 60)?.gapPp === 18)
check('체크: 코어 75 vs 목표 60 → 위성 15%p 부족', P.rebalanceCheck(75, 60)?.kind === 'sat-short' && P.rebalanceCheck(75, 60)?.gapPp === 15)
check('체크: ±3%p 안 → 균형', P.rebalanceCheck(58, 60)?.kind === 'balanced')
check('체크: 목표 없음 → null', P.rebalanceCheck(58, null) === null)

// ── 코드리뷰 반영: 전부 시세 실패 시 수익률 null · 경계 반올림 일치 · 입력 방어 ──────────────

const s5 = P.summarizePortfolio(
  [H({ t: 'BTC', m: 'CRYPTO', p: 100000000, q: 0.01 }), H({ t: 'ETH', m: 'CRYPTO', p: 3000000, q: 1 })],
  { BTC: { currentPrice: 0, change: 0, changePct: 0, error: 'timeout' }, ETH: { currentPrice: 0, change: 0, changePct: 0, error: 'timeout' } },
  1350)
check('전부 시세 실패 → pnlPct null · allUnpriced true', s5.pnlPct === null && s5.allUnpriced === true && s5.unpricedCount === 2)

const s6 = P.summarizePortfolio(
  [H({ t: '005930', p: 60000, q: 10 }), H({ t: '360750', p: 20000, q: 10 })],
  { '005930': { currentPrice: 66000, change: 1000, changePct: 1.54 } }, // 360750 은 시세 없음
  1350)
check('혼재(1개만 시세) → allUnpriced false · unpricedCount 1', s6.allUnpriced === false && s6.unpricedCount === 1)
check('혼재 → pnlPct 는 계산된 값(null 아님)', s6.pnlPct !== null && near(s6.pnlPct, (s6.totalEvalKrw - s6.totalCostKrw) / s6.totalCostKrw * 100))
check('혼재 → todayPct 는 시세 있는 행만 반영(어제 평가 650,000 기준)', near(s6.todayKrw, 10000) && near(s6.todayPct, 10000 / 650000 * 100))

const s7 = P.summarizePortfolio([H({ t: 'nvda', m: 'US', c: 'USD', p: 100, q: 1 })], { NVDA: { currentPrice: 120, change: 2, changePct: 1.67 } }, 1400)
check('소문자 티커가 대문자 시세 키와 매칭', s7.rows[0].priced === true && s7.rows[0].currentPrice === 120)

const s8 = P.summarizePortfolio([H({ t: 'BTC', m: 'CRYPTO', p: 100000000, q: 0.01 })], { BTC: { currentPrice: 100000000, change: NaN, changePct: 0 } }, 1350)
check('change 가 NaN → 시세 실패로 취급', s8.rows[0].priced === false && s8.unpricedCount === 1)

check('경계: 56.6 vs 60 → 반올림 gap 3 → balanced gapPp 3', P.rebalanceCheck(56.6, 60)?.kind === 'balanced' && P.rebalanceCheck(56.6, 60)?.gapPp === 3)
check('경계: 56.4 vs 60 → 반올림 gap 4 → core-short gapPp 4', P.rebalanceCheck(56.4, 60)?.kind === 'core-short' && P.rebalanceCheck(56.4, 60)?.gapPp === 4)

let threwOnZeroFx = false
try { P.summarizePortfolio([H({ t: 'NVDA', m: 'US', c: 'USD', p: 100, q: 1 })], {}, 0) } catch { threwOnZeroFx = true }
check('달러 보유 + 환율 0 → throw', threwOnZeroFx)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (보유 요약 SSOT)')
process.exit(fail ? 1 : 0)
