// 🚪 게이트 가설 검정 — 사전 등록: docs/gate-hypothesis/plan.md (커밋 9370031, 측정 전)
//   ⛔ 탐색 금지: 셀 8개는 전부 사전 지정. 1차 검정은 prime 재현 단 하나.
//   ⛔ 재구현 금지: 실제 techSignals 를 컴파일해 쓴다. 게이트는 entryTiming SSOT 와 같은 공식.
//   ⛔ 룩어헤드 금지: 봉 i 판정은 [0..i] 만 본다.
//   판정은 out-of-sample(신규 120종) 로만 한다.
//   실행: node scripts/backtest-gate.mjs
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-gate`
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

// ── in-sample = 지금까지 모든 측정이 나온 80종(오염) ────────────────────────
const IN_KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']
const IN_US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','NOW','UBER','PANW','SNPS','LRCX','KLAC','AMAT','ADI','MRVL','ANET',
  'XOM','CVX','COP','JPM','BAC','GS','UNH','LLY','ABBV','CAT']

// ── out-of-sample = 한 번도 안 본 120종 ─────────────────────────────────────
const OOS_KR = ['207940.KS','051900.KS','090430.KS','097950.KS','271560.KS','033780.KS','000100.KS','128940.KS','302440.KS','326030.KS',
  '069620.KS','185750.KS','009830.KS','011170.KS','010060.KS','005490.KS','004990.KS','023530.KS','069960.KS','139480.KS',
  '007070.KS','282330.KS','161390.KS','204320.KS','011210.KS','018880.KS','298040.KS','112610.KS','336260.KS','000880.KS',
  '012450.KS','047810.KS','079550.KS','036460.KS','052690.KS','034020.KS','267260.KS','010620.KS','009540.KS','000720.KS',
  '375500.KS','006360.KS','028050.KS','047040.KS','294870.KS','002380.KS','001120.KS','011790.KS','093370.KS','240810.KQ',
  '042700.KS','058470.KQ','357780.KQ','000990.KS','039030.KQ','108320.KQ','041510.KQ','035900.KQ','251270.KS','036570.KS']
const OOS_US = ['WMT','COST','TGT','HD','LOW','MCD','SBUX','NKE','PG','KO','PEP','PM','MO','V','MA',
  'AXP','PYPL','SCHW','MS','C','WFC','BLK','SPGI','ICE','CME','JNJ','PFE','MRK','ABT','TMO',
  'DHR','BMY','AMGN','GILD','ISRG','VRTX','REGN','BA','LMT','RTX','GE','HON','MMM','DE','UNP',
  'UPS','FDX','T','VZ','CMCSA','DIS','TMUS','DUK','SO','NEE','SLB','PSX','VLO','LIN','FCX']

// 교집합 0 확인 — hold-out 이 오염되면 이 작업 전체가 무의미하다
const inSet = new Set([...IN_KR, ...IN_US])
const dup = [...OOS_KR, ...OOS_US].filter(t => inSet.has(t))
if (dup.length) { console.error('❌ hold-out 오염 — in-sample 과 겹침:', dup.join(', ')); process.exit(1) }
console.log(`유니버스 — in-sample ${IN_KR.length + IN_US.length}종 / out-of-sample ${OOS_KR.length + OOS_US.length}종 · 교집합 0 확인 ✅`)

const HOR = 20   // edge20 — SCREEN_SETUPS 와 같은 잣대
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : Math.round(n * 100) / 100

// ── 게이트 정의 = entryTiming SSOT 동일 공식 ────────────────────────────────
//    aligned = EMA112 > EMA224 · cloud = 26봉 전 선행스팬 대비 종가 위치
const emaSeries = (arr, n) => { const k = 2 / (n + 1); const o = []; let p = null
  for (let i = 0; i < arr.length; i++) { p = p == null ? arr[i] : arr[i] * k + p * (1 - k); o.push(p) } return o }
const hlMid = (h, l, n, i) => { if (i + 1 < n || i < 0) return null
  let hi = -Infinity, lo = Infinity; for (let k = i - n + 1; k <= i; k++) { if (h[k] > hi) hi = h[k]; if (l[k] < lo) lo = l[k] }
  return (hi + lo) / 2 }

const CELLS = ['T1', 'T2', 'G1', 'G2', 'G1T1', 'G1T2', 'G2T1', 'G2T2', 'PRIME']
const hits = {}; for (const c of CELLS) hits[c] = []
const base = {}   // base[sample][market] = []
for (const s of ['IN', 'OOS']) { base[s] = { KR: [], US: [] } }

async function run(ticker, market, sample) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.low === 'number' && typeof x.high === 'number')
  } catch { return false }
  if (q.length < 400) return false

  const c = q.map(x => x.close), h = q.map(x => x.high), l = q.map(x => x.low)
  const ohlc = q.map(x => ({ open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume ?? 0 }))
  const e112 = emaSeries(c, 112), e224 = emaSeries(c, 224)

  for (let i = 0; i + HOR < c.length; i++) base[sample][market].push((c[i + HOR] / c[i] - 1) * 100)

  for (let i = 250; i + HOR < c.length; i++) {
    // 게이트 G1 — 신호등 green
    const src = i - 26
    const t9 = hlMid(h, l, 9, src), k26 = hlMid(h, l, 26, src), b52 = hlMid(h, l, 52, src)
    if (t9 == null || k26 == null || b52 == null) continue
    const spanA = (t9 + k26) / 2, spanB = b52
    const aligned = e112[i] > e224[i]
    const cloudAbove = c[i] > Math.max(spanA, spanB)
    const G1 = aligned && cloudAbove

    const win = ohlc.slice(0, i + 1)
    // 게이트 G2 — 기간 조정 충족
    const tc = TS.readTimeCorrection(win, 5)
    // ⚠️ 필드명 실측 확인 — TimeCorrRead 는 `filled` 가 아니라 `phase: 'early'|'mid'|'filled'` 다.
    //    `tc.filled` 로 썼으면 전부 undefined → G2 신호 0건으로 조용히 죽었다(backtest-autopsy §0 함정).
    const G2 = !!(tc && tc.phase === 'filled')
    // 트리거 — 라쉬케 SSOT
    const rk = TS.readRaschke(win)
    const T1 = !!(rk && rk.stage === 4 && rk.pullback)
    const T2 = !!(rk && rk.bullDivergence)

    const ret = (c[i + HOR] / c[i] - 1) * 100
    const ym = (q[i].date instanceof Date ? q[i].date : new Date(q[i].date)).toISOString().slice(0, 7)
    const ma50 = (() => { let s = 0; for (let k = i - 49; k <= i; k++) s += c[k]; return s / 50 })()
    const ma50p = (() => { let s = 0; for (let k = i - 69; k <= i - 20; k++) s += c[k]; return s / 50 })()
    const regime = ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    const m = { ticker, market, sample, ym, regime, ret }

    if (T1) hits.T1.push(m)
    if (T2) hits.T2.push(m)
    if (G1) hits.G1.push(m)
    if (G2) hits.G2.push(m)
    if (G1 && T1) hits.G1T1.push(m)
    if (G1 && T2) hits.G1T2.push(m)
    if (G2 && T1) hits.G2T1.push(m)
    if (G2 && T2) hits.G2T2.push(m)
    if (G1 && (T1 || T2)) hits.PRIME.push(m)        // ★ 1차 검정 셀 = 앱의 prime 정의
  }
  return true
}

let okIn = 0, okOos = 0
for (const t of IN_KR) if (await run(t, 'KR', 'IN')) okIn++
for (const t of IN_US) if (await run(t, 'US', 'IN')) okIn++
for (const t of OOS_KR) if (await run(t, 'KR', 'OOS')) okOos++
for (const t of OOS_US) if (await run(t, 'US', 'OOS')) okOos++
console.log(`수집 성공 — in-sample ${okIn}/80 · out-of-sample ${okOos}/120\n`)

// ── 지표 산출 ───────────────────────────────────────────────────────────────
function stat(rows, sample) {
  const g = rows.filter(r => r.sample === sample)
  if (!g.length) return null
  const byMk = {}
  for (const mk of ['KR', 'US']) {
    const s = g.filter(r => r.market === mk).map(r => r.ret)
    if (s.length < 10) { byMk[mk] = null; continue }
    byMk[mk] = avg(trim(s)) - avg(trim(base[sample][mk]))
  }
  const allB = [...base[sample].KR, ...base[sample].US]
  const all = g.map(r => r.ret)
  const tk = {}; for (const r of g) tk[r.ticker] = (tk[r.ticker] ?? 0) + 1
  const topShare = Math.max(...Object.values(tk)) / g.length
  const regimePos = ['up', 'flat', 'down'].filter(k => {
    const s = g.filter(r => r.regime === k).map(r => r.ret)
    return s.length >= 10 && (avg(trim(s)) - avg(trim(allB))) > 0
  }).length
  return {
    n: g.length, edge: avg(trim(all)) - avg(trim(allB)),
    kr: byMk.KR, us: byMk.US, tickers: Object.keys(tk).length, topShare, regimePos,
    win: all.filter(x => x > 0).length / all.length * 100,
  }
}

const fmt = s => s ? `n=${String(s.n).padStart(5)} 절사edge ${String(r2(s.edge)).padStart(6)}%p · KR ${String(r2(s.kr)).padStart(6)} · US ${String(r2(s.us)).padStart(6)} · 종목 ${String(s.tickers).padStart(3)} · 최다 ${Math.round(s.topShare * 100)}% · 레짐양수 ${s.regimePos}/3` : '표본 부족'

console.log('═'.repeat(104))
console.log('셀별 결과 — 판정은 OOS 로만 한다')
console.log('═'.repeat(104))
const LABEL = { T1: 'T1 눌림목 단독', T2: 'T2 상승다이버전스 단독', G1: 'G1 신호등green(상태)', G2: 'G2 기간조정충족(상태)',
  G1T1: 'G1∧T1', G1T2: 'G1∧T2', G2T1: 'G2∧T1', G2T2: 'G2∧T2', PRIME: '★PRIME = G1∧(T1∨T2)' }
for (const k of CELLS) {
  console.log(`\n${LABEL[k]}`)
  console.log(`  [in ] ${fmt(stat(hits[k], 'IN'))}`)
  console.log(`  [OOS] ${fmt(stat(hits[k], 'OOS'))}`)
}

// ── ★ 1차 검정 — 통과 기준은 사전 등록값 하드코딩(재고 나서 못 고친다) ─────
const CRIT = { edge: 1.0, n: 200, topShare: 0.30, regimePos: 2 }
console.log(`\n${'═'.repeat(104)}\n★ 1차 검정 — PRIME 의 out-of-sample 재현 (기준: 사전 등록 커밋 9370031)\n${'═'.repeat(104)}`)
const p = stat(hits.PRIME, 'OOS')
const t1 = stat(hits.T1, 'OOS'), t2 = stat(hits.T2, 'OOS')
const trigEdge = t1 && t2 ? (t1.edge * t1.n + t2.edge * t2.n) / (t1.n + t2.n) : null   // 트리거 단독 가중평균
if (!p) console.log('  ❌ OOS 표본 없음')
else {
  const c1 = p.edge >= CRIT.edge
  const c2 = p.kr != null && p.us != null && Math.sign(p.kr) === Math.sign(p.us)
  const c3 = p.n >= CRIT.n
  const c4 = p.topShare <= CRIT.topShare
  const c5 = p.regimePos >= CRIT.regimePos
  const c6 = trigEdge != null && (p.edge - trigEdge) > 0
  const mark = b => b ? '✅' : '❌'
  console.log(`  ① 절사 edge20 ≥ +${CRIT.edge}      ${mark(c1)}  실측 ${r2(p.edge)}%p`)
  console.log(`  ② KR·US 부호 동일             ${mark(c2)}  KR ${r2(p.kr)} · US ${r2(p.us)}`)
  console.log(`  ③ n ≥ ${CRIT.n}                    ${mark(c3)}  실측 ${p.n}`)
  console.log(`  ④ 최다 종목 ≤ ${CRIT.topShare * 100}%           ${mark(c4)}  실측 ${Math.round(p.topShare * 100)}%`)
  console.log(`  ⑤ 레짐 양수 ≥ ${CRIT.regimePos}/3            ${mark(c5)}  실측 ${p.regimePos}/3`)
  console.log(`  ⑥ 게이트 기여 Δ > 0           ${mark(c6)}  PRIME ${r2(p.edge)} − 트리거단독 ${r2(trigEdge)} = ${r2(p.edge - (trigEdge ?? 0))}%p`)
  const pass = c1 && c2 && c3 && c4 && c5 && c6
  console.log(`\n  ${pass ? '✅ 통과 — 게이트 가설이 안 본 종목에서 재현됨' : '❌ 기각 — 위 기준 중 하나 이상 미달'}`)
  console.log(`  (참고) in-sample PRIME: ${fmt(stat(hits.PRIME, 'IN'))}`)
}
