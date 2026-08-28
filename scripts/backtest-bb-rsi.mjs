// 🎯 볼린저+RSI 백테스트 — 골드핑거 영상(캐시 리엔 기법) 주장을 우리 표본에서 검증
//   ⛔ 재구현 금지: 실제 src/lib/techSignals.ts 를 컴파일해 쓴다(calcRSI·computeBollinger)
//   ⛔ 룩어헤드 금지: 봉 i 판정은 [0..i] 만 본다(calcRSI·computeBollinger 는 각 i 가 과거만 참조 — 확인함)
//   ⛔ baseline 대비 초과분만 본다 · 상하위 10% 절사 edge 병기
//   전방 구간 5·10·20봉 — 20봉은 techScreener 의 edge20 과 같은 잣대라 SCREEN_SETUPS 와 직접 비교된다
//   실행: node scripts/backtest-bb-rsi.mjs
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
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 300)) }
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${ROOT}/src/${r.slice(2)}` : r, ...a) }
const TS = require2(`${OUT}/techSignals.js`)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

// 유니버스 — backtest-swing.mjs 와 동일(시점·종목 분산 확보용)
const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','NOW','UBER','PANW','SNPS','LRCX','KLAC','AMAT','ADI','MRVL','ANET',
  'XOM','CVX','COP','JPM','BAC','GS','UNH','LLY','ABBV','CAT']
const HOR = [5, 10, 20]

const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : Math.round(n * 100) / 100

const hits = {
  entryE: [],   // 영상 진입조건: 50일선 완전 돌파(전환) + RSI가 RSI-BB 상단 위
  stateE: [],   // 같은 조건의 '상태형'(전환 아님) — 전환 vs 상태 어느 쪽이 나은지
  rsiOnly: [],  // 기여도 분해: RSI-BB 상단 돌파만
  ma50Only: [], // 기여도 분해: 50일선 완전 돌파만
  dblBb: [],    // 더블 볼린저 내부 σ0.5 상단 돌파(매수 우위 구간 진입)
}
const base = { KR: {}, US: {} }
for (const m of ['KR', 'US']) for (const h of HOR) base[m][h] = []

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.low === 'number')
  } catch { return }
  if (q.length < 400) return

  const c = q.map(x => x.close), lo = q.map(x => x.low)
  const ohlc = q.map(x => ({ open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume ?? 0 }))

  // 각 인덱스가 과거만 참조하므로 전 구간 일괄 계산해도 룩어헤드가 없다(probe 로 확인)
  const rsi = TS.calcRSI(c, 14)
  const rsiSeries = rsi.map(v => ({ open: 0, high: 0, low: 0, close: v ?? 50 }))
  const bbR = TS.computeBollinger(rsiSeries, 30, 2)        // 영상: RSI 에 BB 오버레이(길이 30)
  const bbIn = TS.computeBollinger(ohlc, 20, 0.5)          // 더블 볼린저 내부 밴드
  if (!bbR || !bbIn) return

  for (const h of HOR) for (let i = 0; i + h < c.length; i++) base[market][h].push((c[i + h] / c[i] - 1) * 100)

  const maxH = Math.max(...HOR)
  const rsiAbove = i => rsi[i] != null && bbR.upper[i] != null && rsi[i] > bbR.upper[i]
  const ma50Full = i => { const m = sma(c, 50, i); return m != null && lo[i] > m }   // 꼬리까지 전부 위 = '완전 돌파'

  for (let i = 250; i + maxH < c.length; i++) {
    const ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    if (ma50 == null || ma50p == null) continue
    const regime = ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    const ret = {}; for (const h of HOR) ret[h] = (c[i + h] / c[i] - 1) * 100
    const ym = (q[i].date instanceof Date ? q[i].date : new Date(q[i].date)).toISOString().slice(0, 7)
    const meta = { ticker, market, ym, regime, ret }

    const mFull = ma50Full(i), mFullPrev = ma50Full(i - 1)
    const rUp = rsiAbove(i), rUpPrev = rsiAbove(i - 1)

    // E — 영상 롱 진입: 50일선을 **완전히** 상향 돌파한 그 캔들 + RSI 가 BB 상단 위
    if (mFull && !mFullPrev && rUp) hits.entryE.push(meta)
    // E' — 같은 조건의 상태형(매일 성립하면 매일 신호)
    if (mFull && rUp) hits.stateE.push(meta)
    // 분해 ① RSI-BB 상단 돌파만
    if (rUp && !rUpPrev) {
      // 🔍 중복 검사 — 이미 앱에 있는 1위 셋업(엘리펀트 바 +2.77)과 겹치면 '새 알파'가 아니라 재발견이다
      const ele = TS.detectElephantBar(ohlc.slice(0, i + 1), 10)
      const dup = !!(ele && ele.type === 'bull' && ele.barsAgo <= 5)
      hits.rsiOnly.push({ ...meta, dup })
    }
    // 분해 ② 50일선 완전 돌파만
    if (mFull && !mFullPrev) hits.ma50Only.push(meta)
    // 더블 볼린저 — 내부 σ0.5 상단 돌파(매수 우위 구간 진입)
    if (bbIn.upper[i] != null && bbIn.upper[i - 1] != null && c[i] > bbIn.upper[i] && c[i - 1] <= bbIn.upper[i - 1])
      hits.dblBb.push(meta)
  }
}

for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')

function report(title, rows) {
  console.log(`\n${'═'.repeat(80)}\n${title}\n${'═'.repeat(80)}`)
  if (!rows.length) { console.log('  신호 없음'); return }
  const tk = {}; for (const r of rows) tk[r.ticker] = (tk[r.ticker] ?? 0) + 1
  const top = Object.entries(tk).sort((a, b) => b[1] - a[1])[0]
  const months = new Set(rows.map(r => r.ym)).size
  const yr = {}; for (const r of rows) { const y = r.ym.slice(0, 4); yr[y] = (yr[y] ?? 0) + 1 }
  const maxYr = Object.entries(yr).sort((a, b) => b[1] - a[1])[0]
  const a1 = Object.keys(tk).length >= 10, a2 = top[1] / rows.length <= 0.30
  const a3 = months >= 12 && maxYr[1] / rows.length <= 0.50
  console.log(`  신호 ${rows.length}건 · 종목 ${Object.keys(tk).length}종 · 최다 ${top[0]} ${Math.round(top[1] / rows.length * 100)}% · ${months}개월 분산 · 최다연도 ${maxYr[0]} ${Math.round(maxYr[1] / rows.length * 100)}%`)
  console.log(`  autopsy ①종목분산 ${a1 ? '✅' : '❌기각'} ②최다점유 ${a2 ? '✅' : '❌기각'} ③시점분산 ${a3 ? '✅' : '⚠️편중'}`)

  for (const mk of ['KR', 'US']) {
    const g = rows.filter(r => r.market === mk)
    if (!g.length) { console.log(`  [${mk}] 신호 없음`); continue }
    const line = HOR.map(h => {
      const s = g.map(r => r.ret[h]), b = base[mk][h]
      const e = avg(s) - avg(b), te = avg(trim(s)) - avg(trim(b))
      const w = s.filter(x => x > 0).length / s.length * 100
      const bw = b.filter(x => x > 0).length / b.length * 100
      return `${h}봉 edge ${String(r2(e)).padStart(6)}(절사 ${String(r2(te)).padStart(6)}) 승률 ${String(r2(w)).padStart(5)}%(기준 ${r2(bw)}%)`
    }).join('\n        ')
    console.log(`  [${mk}] ${String(g.length).padStart(4)}건 · ${line}`)
  }
  console.log('  레짐(20봉 절사 edge):')
  const allB = [...base.KR[20], ...base.US[20]]
  for (const [k, lb] of [['up', '상승'], ['flat', '중립'], ['down', '하락']]) {
    const g = rows.filter(r => r.regime === k)
    if (g.length < 10) { console.log(`    ${lb}장 ${g.length}건 — 표본 부족(10 미만)`); continue }
    const s = g.map(r => r.ret[20])
    const te = avg(trim(s)) - avg(trim(allB))
    const w = s.filter(x => x > 0).length / s.length * 100
    console.log(`    ${lb}장 ${String(g.length).padStart(4)}건 · 절사 edge ${String(r2(te)).padStart(6)}%p · 승률 ${r2(w)}%`)
  }
}

const bKR = base.KR[20], bUS = base.US[20]
console.log(`\nbaseline 20봉 — KR ${r2(avg(bKR))}%(승률 ${r2(bKR.filter(x => x > 0).length / bKR.length * 100)}%, n=${bKR.length}) · US ${r2(avg(bUS))}%(승률 ${r2(bUS.filter(x => x > 0).length / bUS.length * 100)}%, n=${bUS.length})`)

report('🅴 영상 진입조건 — 50일선 완전 돌파(전환) + RSI가 RSI-BB(30) 상단 위', hits.entryE)
report("🅴' 같은 조건의 상태형 — 50일선 완전 위 + RSI 상단 위 (매일 성립 시 매일 신호)", hits.stateE)
report('분해① RSI-BB(30) 상단 돌파만', hits.rsiOnly)
report('분해② 50일선 완전 돌파만(꼬리까지)', hits.ma50Only)
report('🅷 더블 볼린저 — 내부 σ0.5 상단 돌파(매수 우위 구간 진입)', hits.dblBb)

// ── 🔍 중복 검사 — RSI-BB 가 '새 알파'인가, 이미 있는 엘리펀트 바(+2.77)의 재발견인가 ──
console.log(`\n${'═'.repeat(80)}\n🔍 중복 검사 — RSI-BB 상단 돌파 vs 기존 엘리펀트 바(불)\n${'═'.repeat(80)}`)
for (const mk of ['KR', 'US']) {
  const g = hits.rsiOnly.filter(r => r.market === mk)
  if (!g.length) continue
  const dup = g.filter(r => r.dup), solo = g.filter(r => !r.dup)
  const b = base[mk][20]
  const te = s => s.length >= 10 ? r2(avg(trim(s.map(r => r.ret[20]))) - avg(trim(b))) : '표본부족'
  console.log(`  [${mk}] 전체 ${g.length}건 중 엘리펀트 중복 ${dup.length}건(${Math.round(dup.length / g.length * 100)}%)`)
  console.log(`        중복분 20봉 절사 edge ${te(dup)}%p · **중복 제외분** ${te(solo)}%p (n=${solo.length})`)
}
