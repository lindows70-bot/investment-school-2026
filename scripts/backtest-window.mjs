// 📏 창 의존성 + 자기상관 보정 — 화면에 공개한 주장("창을 바꾸면 부호가 뒤집힌다")을 근거로 뒷받침한다
//
//   ① 같은 셀을 1년/2년/3년/5년 창에서 각각 잰다 (5년 한 번 받아서 잘라 쓴다 — 재수집 없음)
//   ② 자기상관 보정 — 같은 종목에서 20봉 안에 겹쳐 나온 신호는 **한 에피소드**로 접는다.
//      n=2,027 같은 숫자는 겹치는 창의 중복이라 액면대로 믿으면 안 된다.
//
//   ⛔ 재구현 금지 · 룩어헤드 금지 · baseline 대비 절사 edge — 기존 하네스와 동일 규약
//   실행: node scripts/backtest-window.mjs
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-win`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020' },
  include: [`${ROOT}/src/lib/techSignals.ts`],
}, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 300)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const TS = require2(`${OUT}/techSignals.js`)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '207940.KS','051900.KS','090430.KS','097950.KS','271560.KS','033780.KS','000100.KS','128940.KS','005490.KS','009830.KS',
  '011170.KS','139480.KS','161390.KS','012450.KS','047810.KS','034020.KS','009540.KS','000720.KS','006360.KS','028050.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','XOM','CVX','JPM','BAC','GS','UNH','LLY','ABBV','CAT','BA',
  'WMT','COST','HD','MCD','NKE','PG','KO','PEP','V','MA','JNJ','PFE','MRK','ABT','TMO',
  'LMT','RTX','GE','HON','DE','UNP','UPS','T','VZ','DIS','DUK','NEE','SLB','LIN','FCX']

const HOR = 20
const WINDOWS = [
  { label: '1년', bars: 250 },
  { label: '2년', bars: 500 },
  { label: '3년', bars: 750 },
  { label: '5년(전체)', bars: 99999 },
]
const CELLS = ['pullback', 'bullDiv', 'greenState', 'timeFilled', 'prime', 'G1T1']
const LABEL = { pullback: '첫 눌림목', bullDiv: '상승 다이버전스', greenState: '상승추세 유지',
  timeFilled: '기간조정 충족', prime: '정예 타점(PRIME)', G1T1: '게이트×눌림목' }

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : Math.round(n * 100) / 100
const emaSeries = (arr, n) => { const k = 2 / (n + 1); const o = []; let p = null
  for (let i = 0; i < arr.length; i++) { p = p == null ? arr[i] : arr[i] * k + p * (1 - k); o.push(p) } return o }
const hlMid = (h, l, n, i) => { if (i + 1 < n || i < 0) return null
  let hi = -Infinity, lo = Infinity; for (let k = i - n + 1; k <= i; k++) { if (h[k] > hi) hi = h[k]; if (l[k] < lo) lo = l[k] }
  return (hi + lo) / 2 }

// rec[cell] = [{ticker, market, barsFromEnd, ret}] · baseAll = [{market, barsFromEnd, ret}]
const rec = {}; for (const c of CELLS) rec[c] = []
const baseAll = []

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.low === 'number' && typeof x.high === 'number')
  } catch { return }
  if (q.length < 400) return
  const c = q.map(x => x.close), h = q.map(x => x.high), l = q.map(x => x.low)
  const ohlc = q.map(x => ({ open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume ?? 0 }))
  const e112 = emaSeries(c, 112), e224 = emaSeries(c, 224)
  const N = c.length

  for (let i = 0; i + HOR < N; i++) baseAll.push({ market, bfe: N - 1 - i, ret: (c[i + HOR] / c[i] - 1) * 100 })

  for (let i = 250; i + HOR < N; i++) {
    const src = i - 26
    const t9 = hlMid(h, l, 9, src), k26 = hlMid(h, l, 26, src), b52 = hlMid(h, l, 52, src)
    if (t9 == null || k26 == null || b52 == null) continue
    const G1 = e112[i] > e224[i] && c[i] > Math.max((t9 + k26) / 2, b52)
    const win = ohlc.slice(0, i + 1)
    const tc = TS.readTimeCorrection(win, 5)
    const G2 = !!(tc && tc.phase === 'filled')
    const rk = TS.readRaschke(win)
    const T1 = !!(rk && rk.stage === 4 && rk.pullback)
    const T2 = !!(rk && rk.bullDivergence)
    const m = { ticker, market, bfe: N - 1 - i, ret: (c[i + HOR] / c[i] - 1) * 100, idx: i }
    if (T1) rec.pullback.push(m)
    if (T2) rec.bullDiv.push(m)
    if (G1) rec.greenState.push(m)
    if (G2) rec.timeFilled.push(m)
    if (G1 && (T1 || T2)) rec.prime.push(m)
    if (G1 && T1) rec.G1T1.push(m)
  }
}

for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')
console.log(`수집 완료 — 종목 ${KR.length + US.length} · 전체 봉 ${baseAll.length.toLocaleString()}\n`)

const edgeOf = (rows, bars) => {
  const s = rows.filter(r => r.bfe <= bars).map(r => r.ret)
  const b = baseAll.filter(r => r.bfe <= bars).map(r => r.ret)
  if (s.length < 20 || b.length < 100) return null
  return { n: s.length, edge: avg(trim(s)) - avg(trim(b)) }
}

console.log('═'.repeat(96))
console.log('📏 창 의존성 — 같은 셀을 다른 기간에서 재면 값이 얼마나 흔들리나 (20봉 절사 edge)')
console.log('═'.repeat(96))
console.log('셋업'.padEnd(20) + WINDOWS.map(w => w.label.padStart(16)).join(''))
for (const k of CELLS) {
  const cells = WINDOWS.map(w => { const e = edgeOf(rec[k], w.bars); return e ? `${r2(e.edge)}(n=${e.n})`.padStart(16) : '—'.padStart(16) })
  console.log(LABEL[k].padEnd(20) + cells.join(''))
}
console.log('\n  ※ 앱 화면 표시값(2026-07-26 측정): 눌림목 −0.95 · 다이버전스 −0.90 · 정예 +1.33 · 추세유지 +0.87 · 기간조정 +1.04')

// ── 자기상관 보정 — 같은 종목에서 HOR 봉 안에 겹친 신호는 한 에피소드로 접는다 ──
function fold(rows) {
  const byTk = {}
  for (const r of rows) (byTk[r.ticker] ??= []).push(r)
  const out = []
  for (const tk of Object.keys(byTk)) {
    const s = byTk[tk].sort((a, b) => a.idx - b.idx)
    let lastIdx = -Infinity
    for (const r of s) { if (r.idx - lastIdx >= HOR) { out.push(r); lastIdx = r.idx } }
  }
  return out
}
console.log(`\n${'═'.repeat(96)}\n🔗 자기상관 보정 — 겹치는 20봉 신호를 한 에피소드로 접으면 표본이 얼마나 줄고 edge 는 어떻게 되나\n${'═'.repeat(96)}`)
const b5 = baseAll.map(r => r.ret)
for (const k of CELLS) {
  const raw = rec[k], fd = fold(raw)
  const eR = avg(trim(raw.map(r => r.ret))) - avg(trim(b5))
  const eF = fd.length >= 20 ? avg(trim(fd.map(r => r.ret))) - avg(trim(b5)) : null
  const se = 11.23 / Math.sqrt(fd.length)
  console.log(`  ${LABEL[k].padEnd(18)} 원시 n=${String(raw.length).padStart(5)} edge ${String(r2(eR)).padStart(6)} → 접은 뒤 n=${String(fd.length).padStart(4)}(${Math.round(fd.length / raw.length * 100)}%) edge ${String(r2(eF)).padStart(6)} · 표준오차 ${r2(se)}%p · ${eF != null ? r2(eF / se) : '—'}σ`)
}
console.log('\n  ※ σ는 "이 값이 우연일 가능성"의 눈금이다. 2σ 미만이면 표본 우연과 구분하기 어렵다.')
