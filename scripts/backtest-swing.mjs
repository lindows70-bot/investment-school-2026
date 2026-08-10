// 🎯 스윙 본 백테스트 — 두 트랙(평균회귀 / 추세추종)을 시장·레짐별로 가른다
//   ⛔ 재구현 금지: 실제 src/lib/techSignals.ts 를 tsc 컴파일해 쓴다(백테스트용 별도 구현은 검증을 무의미하게 만든다)
//   ⛔ 룩어헤드 금지: 봉 i 판정은 data[0..i] 만 본다
//   ⛔ baseline 대비 초과분만 본다 — 승률 단독은 국면을 신호 탓으로 돌린다
//   실행: node scripts/backtest-swing.mjs
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-swing`
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

// ── 유니버스 — KR/US 각각 넓게(시점·종목 분산 확보용) ──────────────────────
const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','NOW','UBER','PANW','SNPS','LRCX','KLAC','AMAT','ADI','MRVL','ANET',
  'XOM','CVX','COP','JPM','BAC','GS','UNH','LLY','ABBV','CAT']
const HOR = [5, 10, 15]
const MA_SETS = { '112/224 (단테)': [112, 224], '122/245 (실제 6개월/1년)': [122, 245], '60/200 (우리 관례)': [60, 200] }

const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : Math.round(n * 100) / 100

const hits = { revA: [], pullB: [] }          // 트랙별 신호
const maCompare = {}                           // 이평선 세트 비교(트랙 A)
for (const k of Object.keys(MA_SETS)) maCompare[k] = []
const base = { KR: { 5: [], 10: [], 15: [] }, US: { 5: [], 10: [], 15: [] } }

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.open === 'number')
  } catch { return }
  if (q.length < 400) return
  const c = q.map(x => x.close)
  const ohlc = q.map(x => ({ open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume ?? 0 }))
  const vol = q.map(x => x.volume ?? 0)

  for (const h of HOR) for (let i = 0; i + h < c.length; i++) base[market][h].push((c[i + h] / c[i] - 1) * 100)

  const maxH = Math.max(...HOR)
  for (let i = 250; i + maxH < c.length; i++) {
    const ma20 = sma(c, 20, i), ma5 = sma(c, 5, i), ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    if (ma20 == null || ma5 == null || ma50 == null || ma50p == null) continue
    const regime = ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    const ret = {}; for (const h of HOR) ret[h] = (c[i + h] / c[i] - 1) * 100
    const ym = (q[i].date instanceof Date ? q[i].date : new Date(q[i].date)).toISOString().slice(0, 7)
    const meta = { ticker, market, ym, regime, ret }

    // ── 트랙 A: 역매공파(평균 회귀) — 이평선 세트별로 각각 판정 ──
    for (const [label, [sL, lL]] of Object.entries(MA_SETS)) {
      const mS = sma(c, sL, i), mL = sma(c, lL, i), mSp = sma(c, sL, i - 1)
      if (mS == null || mL == null || mSp == null) continue
      if (!(mL > mS)) continue                                   // 역배열
      if (!(c[i] > mS && c[i - 1] <= mSp)) continue              // 단기선 당일 회복
      let disp = false
      for (let k = Math.max(0, i - 20); k <= i; k++) { const m = sma(c, 20, k); if (m != null && (c[k] / m) * 100 <= 95) { disp = true; break } }
      if (!disp) continue
      maCompare[label].push(meta)
      if (label.startsWith('112/224')) hits.revA.push(meta)
    }

    // ── 트랙 B: 급등 눌림목(추세 추종) — 기준봉 → 거래량 급감 → 5일선 지지 양봉 ──
    //    기준봉은 실제 detectElephantBar(우리 1위 셋업 +2.77%p) 를 쓴다
    const eleWin = ohlc.slice(0, i + 1)
    const ele = TS.detectElephantBar(eleWin, 10)
    if (ele && ele.type === 'bull' && ele.barsAgo >= 1 && ele.barsAgo <= 5) {
      const bi = i - ele.barsAgo                                  // 기준봉 위치
      const vBase = vol[bi]
      const quiet = vBase > 0 && vol[i] <= vBase / 3              // 거래량 1/3 이하로 급감
      const nearMa5 = ma5 > 0 && Math.abs(c[i] / ma5 - 1) <= 0.02 // 5일선 근접(±2%)
      const green = c[i] > q[i].open                              // 양봉 확인
      const aboveBase = c[i] > c[bi - 1]                          // 기준봉 시작가 위 유지
      if (quiet && nearMa5 && green && aboveBase) hits.pullB.push(meta)
    }
  }
}

const all = [...KR.map(t => [t, 'KR']), ...US.map(t => [t, 'US'])]
for (let i = 0; i < all.length; i += 6) {
  await Promise.all(all.slice(i, i + 6).map(([t, m]) => run(t, m)))
  process.stdout.write(`\r  수집 ${Math.min(i + 6, all.length)}/${all.length}`)
}
console.log('\n')

function report(title, rows) {
  console.log(`\n${'═'.repeat(78)}\n${title}\n${'═'.repeat(78)}`)
  if (!rows.length) { console.log('  신호 없음'); return }
  const tk = {}; for (const r of rows) tk[r.ticker] = (tk[r.ticker] ?? 0) + 1
  const top = Object.entries(tk).sort((a, b) => b[1] - a[1])[0]
  const months = new Set(rows.map(r => r.ym)).size
  const yr = {}; for (const r of rows) { const y = r.ym.slice(0, 4); yr[y] = (yr[y] ?? 0) + 1 }
  const maxYr = Object.entries(yr).sort((a, b) => b[1] - a[1])[0]
  console.log(`  신호 ${rows.length}건 · 종목 ${Object.keys(tk).length}종 · 최다 ${top[0]} ${Math.round(top[1] / rows.length * 100)}% · ${months}개월 분산 · 최다 연도 ${maxYr[0]} ${Math.round(maxYr[1] / rows.length * 100)}%`)
  const a1 = Object.keys(tk).length >= 10, a2 = top[1] / rows.length <= 0.30
  console.log(`  autopsy ①종목분산 ${a1 ? '✅' : '❌ 기각'} ②최다점유 ${a2 ? '✅' : '❌ 기각'}`)

  for (const mk of ['KR', 'US']) {
    const g = rows.filter(r => r.market === mk)
    if (!g.length) { console.log(`  [${mk}] 신호 없음`); continue }
    const line = HOR.map(h => {
      const s = g.map(r => r.ret[h]), b = base[mk][h]
      const e = avg(s) - avg(b), te = avg(trim(s)) - avg(trim(b))
      const w = s.filter(x => x > 0).length / s.length * 100
      return `${h}봉 edge ${String(r2(e)).padStart(6)}%p(절사 ${String(r2(te)).padStart(6)}) 승률 ${String(r2(w)).padStart(5)}%`
    }).join(' | ')
    console.log(`  [${mk}] ${String(g.length).padStart(4)}건 · ${line}`)
  }
  console.log('  레짐(10봉):')
  for (const [k, lb] of [['up', '상승'], ['flat', '중립'], ['down', '하락']]) {
    const g = rows.filter(r => r.regime === k)
    if (g.length < 5) { console.log(`    ${lb}장 ${g.length}건 — 표본 부족`); continue }
    const s = g.map(r => r.ret[10])
    const w = s.filter(x => x > 0).length / s.length * 100
    console.log(`    ${lb}장 ${String(g.length).padStart(4)}건 · 평균 ${String(r2(avg(s))).padStart(6)}% · 절사 ${String(r2(avg(trim(s)))).padStart(6)}% · 승률 ${r2(w)}%`)
  }
}

console.log(`baseline 10봉 — KR ${r2(avg(base.KR[10]))}%(승률 ${r2(base.KR[10].filter(x => x > 0).length / base.KR[10].length * 100)}%) · US ${r2(avg(base.US[10]))}%(승률 ${r2(base.US[10].filter(x => x > 0).length / base.US[10].length * 100)}%)`)
report('🅰️ 트랙 A — 역매공파(평균 회귀): 역배열 + 이격도≤95 + 단기선 회복 [112/224]', hits.revA)
report('🅱️ 트랙 B — 급등 눌림목(추세 추종): 기준봉 → 거래량 1/3 급감 → 5일선 양봉', hits.pullB)

console.log(`\n${'═'.repeat(78)}\n📏 이평선 세트 비교 (트랙 A · 10봉 · 시장 합산)\n${'═'.repeat(78)}`)
for (const [label, rows] of Object.entries(maCompare)) {
  if (!rows.length) { console.log(`  ${label.padEnd(26)} 신호 없음`); continue }
  const s = rows.map(r => r.ret[10])
  const b = [...base.KR[10], ...base.US[10]]
  const e = avg(s) - avg(b), te = avg(trim(s)) - avg(trim(b))
  const dn = rows.filter(r => r.regime === 'down')
  const dnEdge = dn.length >= 5 ? avg(trim(dn.map(r => r.ret[10]))) - avg(trim(b)) : null
  console.log(`  ${label.padEnd(26)} ${String(rows.length).padStart(4)}건 · edge ${String(r2(e)).padStart(6)}%p · 절사 ${String(r2(te)).padStart(6)}%p · 하락장절사 ${String(r2(dnEdge)).padStart(6)}%p`)
}
