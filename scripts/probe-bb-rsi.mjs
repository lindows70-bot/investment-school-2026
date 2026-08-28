// 🔎 Phase 0 — 판정 코드를 짜기 전에 **실제 객체를 덤프해 키를 눈으로 본다**
//   (이 프로젝트에서 firedBarsAgo·sweptBarsAgo·lagAbove·low/high 4개가 존재하지 않는 필드였고,
//    조용히 undefined 가 되어 신호가 0건 또는 전건이 됐다 — backtest-autopsy §0)
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-bbrsi`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020' },
  include: [`${ROOT}/src/lib/techSignals.ts`],
}, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 400)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const TS = require2(`${OUT}/techSignals.js`)

const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const r = await yf.chart('NVDA', { period1: new Date(Date.now() - 3 * 365 * 864e5), interval: '1d' })
const q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0)
console.log('봉 수:', q.length, '| 첫 봉 키:', Object.keys(q[0]).join(', '))

const close = q.map(x => x.close)
const ohlc = q.map(x => ({ open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume ?? 0 }))

// ① calcRSI 반환 형태
const rsi = TS.calcRSI(close, 14)
console.log('\ncalcRSI → 타입', Array.isArray(rsi) ? 'array' : typeof rsi, '· 길이', rsi.length,
  '· null 개수', rsi.filter(v => v == null).length)
console.log('  마지막 5개:', rsi.slice(-5).map(v => v == null ? 'null' : v.toFixed(2)).join(', '))

// ② computeBollinger 를 **가격**에 적용
const bbPrice = TS.computeBollinger(ohlc, 20, 2)
console.log('\ncomputeBollinger(가격) → 키:', bbPrice ? Object.keys(bbPrice).join(', ') : 'null')
console.log('  upper 길이', bbPrice.upper.length, '· 마지막', bbPrice.upper.at(-1)?.toFixed(2),
  '/ mid', bbPrice.mid.at(-1)?.toFixed(2), '/ lower', bbPrice.lower.at(-1)?.toFixed(2))

// ③ computeBollinger 를 **RSI 시계열**에 적용(영상 기법: RSI 에 BB 오버레이, length 30)
//    computeBollinger 는 d.close 만 읽으므로 {close: rsi} 로 넣는다 — 실제로 되는지 확인한다
const rsiSeries = rsi.map(v => ({ open: 0, high: 0, low: 0, close: v ?? 50 }))
const bbRsi = TS.computeBollinger(rsiSeries, 30, 2)
console.log('\ncomputeBollinger(RSI, n=30) → 키:', bbRsi ? Object.keys(bbRsi).join(', ') : 'null')
const i = rsiSeries.length - 1
console.log(`  마지막: RSI ${rsi[i]?.toFixed(2)} | 상단 ${bbRsi.upper[i]?.toFixed(2)} | 중심 ${bbRsi.mid[i]?.toFixed(2)} | 하단 ${bbRsi.lower[i]?.toFixed(2)}`)
const above = rsi.map((v, k) => v != null && bbRsi.upper[k] != null && v > bbRsi.upper[k]).filter(Boolean).length
const below = rsi.map((v, k) => v != null && bbRsi.lower[k] != null && v < bbRsi.lower[k]).filter(Boolean).length
console.log(`  RSI가 상단 위: ${above}봉(${(above / q.length * 100).toFixed(1)}%) · 하단 아래: ${below}봉(${(below / q.length * 100).toFixed(1)}%)`)

// ④ 더블 볼린저 — 내부 σ0.5 / 외부 σ3 이 실제로 얼마나 자주 뚫리나(신호 폭발 여부 사전 확인)
const bbIn = TS.computeBollinger(ohlc, 20, 0.5)
const bbOut = TS.computeBollinger(ohlc, 20, 3)
const inAbove = close.filter((c, k) => bbIn.upper[k] != null && c > bbIn.upper[k]).length
const outAbove = close.filter((c, k) => bbOut.upper[k] != null && c > bbOut.upper[k]).length
console.log(`\n더블 볼린저 — 내부σ0.5 상단 위 ${(inAbove / q.length * 100).toFixed(1)}% · 외부σ3 상단 위 ${(outAbove / q.length * 100).toFixed(1)}%`)

// ⑤ '50일선 완전 돌파'(몸통+꼬리 전부 위) 빈도 — 영상의 진입 게이트
const sma = (a, n, k) => { if (k + 1 < n) return null; let s = 0; for (let j = k - n + 1; j <= k; j++) s += a[j]; return s / n }
let fullBreak = 0, simpleAbove = 0
for (let k = 60; k < q.length; k++) {
  const m = sma(close, 50, k); if (m == null) continue
  if (close[k] > m) simpleAbove++
  if (q[k].low > m) fullBreak++          // 꼬리까지 전부 위 = '완전 돌파'
}
console.log(`50일선 — 종가만 위 ${(simpleAbove / q.length * 100).toFixed(1)}% · 저가(꼬리)까지 전부 위 ${(fullBreak / q.length * 100).toFixed(1)}%`)
