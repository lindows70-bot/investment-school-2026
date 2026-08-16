// 🔬 트랙 D 임계값 그리드 — 하승훈 영상(달란트투자, 실전대회 1위) 주장 vs 우리 현행 임계
//   영상 주장: 매집(장기 횡보 중 대량거래 반복 + 저점 유지) 후 **첫 장대양봉 15%+ · 평소 거래량 1000%(10배)+
//              · 거래대금 300~500억+** 이 터지면 시세 출발. 우리 트랙 D 는 **+5% · 거래량 2배 · 거래대금 조건 없음**.
//   → 임계를 영상 수준으로 올리면 우리 표본에서 성적이 오르는가? 전수 그리드로 잰다.
//
//   ⛔ 진입 외 조건(224 아래 45/60봉 체류 · runup ≤30% · KR 하락장)은 현행 그대로 고정 — 임계만 바꾼다
//   ⛔ baseline 대비 절사초과로 본다 · 표본 30건 미만은 통계가 아니라 일화
//   실행: node scripts/probe-spike-grid.mjs
import { createRequire } from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const require2 = createRequire(`${ROOT}/package.json`)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']

const CHG = [5, 8, 10, 15]        // 당일 상승률 임계(%) — 현행 5 / 영상 15
const VX  = [2, 3, 5, 10]         // 평소(20일 평균) 거래량 대비 배수 — 현행 2 / 영상 10(=1000%)
const VAL = [0, 300, 500]         // 거래대금 하한(억원) — 현행 없음 / 영상 300~500
const HOLD = 10

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)

const cell = {}                    // `${chg}|${vx}|${val}` → [{ret, ticker, ym}]
for (const a of CHG) for (const b of VX) for (const c of VAL) cell[`${a}|${b}|${c}`] = []
const base = []

// 🔎 영상의 '매집 흔적' — 장기 횡보 중 대량거래가 3회 이상 터졌는데 **저점을 지킨** 종목.
//    ⚠️ 우리가 이미 기각한 '조용한 매집'(가격 변동 없이 순매수, −2.4~−2.7%p)과는 **다른 정의**다:
//    저쪽은 거래가 조용한 상태, 이쪽은 **거래가 터지는데도 안 빠지는** 상태다. 그래서 따로 잰다.
const accumOk = (c, l, vol, i) => {
  let bursts = 0, v20
  for (let k = i - 120; k < i - 5; k++) {
    if (k < 25) continue
    v20 = 0; for (let m = k - 20; m < k; m++) v20 += vol[m]; v20 /= 20
    if (v20 > 0 && vol[k] >= v20 * 3) bursts++
  }
  if (bursts < 3) return false
  // 저점 유지 — 최근 60봉 저가가 그 이전 60봉 저가를 크게 깨지 않았다(−10% 이내)
  let loA = Infinity, loB = Infinity
  for (let k = i - 60; k < i; k++) if (l[k] < loA) loA = l[k]
  for (let k = i - 120; k < i - 60; k++) if (l[k] < loB) loB = l[k]
  return loB > 0 && loA >= loB * 0.9
}
const accumCell = { on: [], off: [] }   // 현행 임계(5%·2배)에서 매집흔적 유무로 가른다

async function run(ticker) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => ['open','high','low','close'].every(k => typeof x[k] === 'number' && x[k] > 0))
  } catch { return }
  if (q.length < 400) return
  const l = q.map(x => x.low), c = q.map(x => x.close), vol = q.map(x => x.volume ?? 0)
  const dt = q.map(x => String(x.date).slice(0, 10))
  const N = c.length
  const sma = (n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += c[k]; return s / n }

  for (let i = 250; i + HOLD < N; i++) {
    const ma50 = sma(50, i), ma50p = sma(50, i - 20)
    if (ma50 == null || ma50p == null) continue
    if (!(ma50 < ma50p * 0.99)) continue                       // KR 하락장만(현행 트랙 D 조건)
    base.push((c[i + HOLD] / c[i] - 1) * 100)

    const ma224 = sma(224, i - 1)
    if (ma224 == null || !(vol[i] > 0)) continue
    let below = 0
    for (let k = i - 60; k < i; k++) { const m = sma(224, k); if (m != null && c[k] < m) below++ }
    if (below < 45) continue                                    // 224 아래 장기 체류
    let min20 = Infinity; for (let k = i - 19; k <= i; k++) if (l[k] < min20) min20 = l[k]
    if ((c[i] / min20 - 1) * 100 > 30) continue                 // 추격 가드(현행)

    let v20 = 0; for (let k = i - 20; k < i; k++) v20 += vol[k]; v20 /= 20
    if (!(v20 > 0)) continue
    const chg = (c[i] / c[i - 1] - 1) * 100
    const vx = vol[i] / v20
    const valEok = c[i] * vol[i] / 1e8                          // 거래대금(억원) — 종가×거래량 근사
    const ret = (c[i + HOLD] / c[i] - 1) * 100

    for (const a of CHG) for (const b of VX) for (const d of VAL)
      if (chg >= a && vx >= b && valEok >= d) cell[`${a}|${b}|${d}`].push({ ret, ticker, ym: dt[i].slice(0, 7) })

    if (chg >= 5 && vx >= 2) (accumOk(c, l, vol, i) ? accumCell.on : accumCell.off).push({ ret, ticker, ym: dt[i].slice(0, 7) })
  }
}

console.log('🔬 트랙 D 임계값 그리드 — 영상 주장(15%·10배·거래대금 300~500억) vs 현행(5%·2배·없음)')
console.log(`   KR ${KR.length}종 · 5년 일봉 · 하락장 · 224선 아래 45/60봉 · runup ≤30% · 보유 ${HOLD}봉\n`)
for (const t of KR) await run(t)

const bl = avg(trim(base))
console.log(`baseline(KR 하락장 전 봉 ${HOLD}봉 절사평균) = ${r2(bl)}%\n`)
console.log('  상승률  거래량배수   거래대금하한    표본   절사초과   승률   종목수')
for (const a of CHG) for (const b of VX) for (const d of VAL) {
  const rows = cell[`${a}|${b}|${d}`]
  if (!rows.length) continue
  const rets = rows.map(x => x.ret)
  const mark = (a === 5 && b === 2 && d === 0) ? ' ← 현행' : (a === 15 && b === 10 && d >= 300) ? ' ← 영상' : ''
  const ex = rets.length >= 30 ? r2(avg(trim(rets)) - bl) : '  —'
  console.log(`  ${String(a).padStart(4)}%  ${String(b).padStart(6)}배  ${String(d === 0 ? '없음' : d + '억').padStart(10)}  ` +
    `${String(rets.length).padStart(6)}  ${String(ex).padStart(7)}  ` +
    `${String(rets.length >= 30 ? Math.round(rets.filter(x => x > 0).length / rets.length * 100) + '%' : '—').padStart(5)}  ` +
    `${String(new Set(rows.map(x => x.ticker)).size).padStart(5)}종${mark}`)
}

// ── autopsy 4단 — 유망 후보를 그대로 믿지 않는다(이 프로젝트에서 여러 가짜 엣지를 죽인 절차) ──
console.log('\n── autopsy 4단 (현행 vs 유망 후보) ──')
for (const key of ['5|2|0', '5|3|0', '5|3|500', '8|2|0']) {
  const rows = cell[key]
  if (rows.length < 30) continue
  const [a, b, d] = key.split('|')
  const rets = rows.map(x => x.ret)
  const tk = {}; for (const x of rows) tk[x.ticker] = (tk[x.ticker] ?? 0) + 1
  const top = Object.entries(tk).sort((p, q) => q[1] - p[1])[0]
  const mo = {}; for (const x of rows) mo[x.ym] = (mo[x.ym] ?? 0) + 1
  const topMo = Object.entries(mo).sort((p, q) => q[1] - p[1])[0]
  const nTk = Object.keys(tk).length
  console.log(`  [${a}%·${b}배·${d === '0' ? '대금무관' : d + '억'}] n=${rets.length}`)
  console.log(`    ①종목분산 ${nTk}종 ${nTk >= 10 ? '✅' : '❌'}` +
    ` · ②최다점유 ${top[0]} ${r2(top[1] / rets.length * 100)}% ${top[1] / rets.length <= 0.3 ? '✅' : '❌'}` +
    ` · ③시점 ${Object.keys(mo).length}개월(최다 ${topMo[0]} ${r2(topMo[1] / rets.length * 100)}%)` +
    ` · ④절사초과 ${r2(avg(trim(rets)) - bl)}%p ${avg(trim(rets)) - bl > 0 ? '✅' : '❌'}`)
  // 📏 표준오차 — 임계를 조이면 엣지가 올라가 보이지만 표본이 줄어 오차도 넓어진다.
  //    개선폭이 오차보다 작으면 '더 좋아진 것'이 아니라 '덜 확실해진 것'이다.
  const t = trim(rets), mu = avg(t)
  const sd = Math.sqrt(t.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, t.length - 1))
  console.log(`    📏 절사표본 ${t.length}건 · 표준편차 ${r2(sd)}%p · 표준오차 ±${r2(sd / Math.sqrt(t.length))}%p`)
}

console.log('\n── 매집 흔적(장기 대량거래 3회+ & 저점 유지) 유무 — 현행 임계(5%·2배) 안에서 ──')
for (const [k, lbl] of [['on', '매집 흔적 있음'], ['off', '없음(대조군)']]) {
  const rows = accumCell[k], rets = rows.map(x => x.ret)
  if (rets.length < 30) { console.log(`  ${lbl}: ${rets.length}건 — 표본 부족`); continue }
  console.log(`  ${lbl.padEnd(16)} ${String(rets.length).padStart(4)}건 · 절사초과 ${String(r2(avg(trim(rets)) - bl)).padStart(6)}%p` +
    ` · 승률 ${Math.round(rets.filter(x => x > 0).length / rets.length * 100)}%` +
    ` · ${new Set(rows.map(x => x.ticker)).size}종 · ${new Set(rows.map(x => x.ym)).size}개월`)
}
