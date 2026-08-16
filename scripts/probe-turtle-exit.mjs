// 🐢➕ 결정적 검증 — **우리 진입 + 터틀 청산** vs **우리 진입 + 고정 보유기간**
//   probe-turtle.mjs 결과: 20일 돌파 '진입'은 baseline 초과 0~음수(무효)인데, 트레이드 성적은 PF 1.5~2.1.
//   → 값어치는 진입이 아니라 **비대칭 청산**(빨리 자르고 오래 들고 간다)에 있다는 뜻이다.
//   그렇다면 엣지가 검증된 우리 진입(A/C/D)에 그 청산을 붙이면 고정 보유기간을 이기는가?
//
//   ⛔ 진입 조건은 backtest-swing.mjs 와 **완전히 동일**해야 비교가 성립한다(복붙이 아니라 같은 식을 옮김)
//   ⛔ 손절 체결가 = min(손절선, 그날 시가) — 갭 하락 실측 반영
//   실행: node scripts/probe-turtle-exit.mjs
import { createRequire } from 'module'
const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const require2 = createRequire(`${ROOT}/package.json`)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','NOW','UBER','PANW','SNPS','LRCX','KLAC','AMAT','ADI','MRVL','ANET',
  'XOM','CVX','COP','JPM','BAC','GS','UNH','LLY','ABBV','CAT']

const EXIT_N = 10, ATR_N = 20, ATR_MULT = 2, MAX_HOLD = 120
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)
const ema = (arr, n) => { const k = 2 / (n + 1); const o = []; let p = null
  for (let i = 0; i < arr.length; i++) { p = p == null ? arr[i] : arr[i] * k + p * (1 - k); o.push(p) } return o }
const trixOf = (close, n = 15) => { const e3 = ema(ema(ema(close, n), n), n)
  return e3.map((v, i) => i === 0 || e3[i - 1] === 0 ? null : ((v - e3[i - 1]) / e3[i - 1]) * 100) }
const spanAOf = (h, l) => { const mid = (n, i) => { if (i + 1 < n) return null
    let hi = -Infinity, lo = Infinity; for (let k = i - n + 1; k <= i; k++) { if (h[k] > hi) hi = h[k]; if (l[k] < lo) lo = l[k] }
    return (hi + lo) / 2 }
  return h.map((_, i) => { const t = mid(9, i), k = mid(26, i); return t == null || k == null ? null : (t + k) / 2 }) }
function atrOf(h, l, c, period) {
  const N = c.length, out = new Array(N).fill(null)
  if (N < period + 1) return out
  const tr = new Array(N).fill(0)
  for (let i = 1; i < N; i++) tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))
  let s = 0; for (let i = 1; i <= period; i++) s += tr[i]
  out[period] = s / period
  for (let i = period + 1; i < N; i++) out[i] = (out[i - 1] * (period - 1) + tr[i]) / period
  return out
}

// 트랙별 버킷 — fixed = 고정 보유기간(현행) · turtle = 터틀 청산 · turtleNoStop = 터틀 청산만(ATR 손절 없이)
const TRACKS = {
  'A 역매공파(KR·하락장)': { hold: 10, rows: [] },
  'C 킴스(US·상승장)':    { hold: 5,  rows: [] },
  'D 바닥급등(KR·하락장)': { hold: 10, rows: [] },
}

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => ['open','high','low','close'].every(k => typeof x[k] === 'number' && x[k] > 0))
  } catch { return }
  if (q.length < 400) return
  const o = q.map(x => x.open), h = q.map(x => x.high), l = q.map(x => x.low), c = q.map(x => x.close)
  const vol = q.map(x => x.volume ?? 0)
  const dt = q.map(x => String(x.date).slice(0, 10))
  const N = c.length
  const atr = atrOf(h, l, c, ATR_N)
  const trix = trixOf(c), spanA = spanAOf(h, l)
  const sma = (n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += c[k]; return s / n }

  // 터틀 청산 시뮬 — 진입봉 i, 손절 적용 여부 선택
  const simulate = (i, useStop) => {
    const entry = c[i]
    const stop = useStop && atr[i] != null ? entry - ATR_MULT * atr[i] : null
    for (let k = i + 1; k < N && k <= i + MAX_HOLD; k++) {
      if (stop != null && l[k] <= stop) return { ret: ((o[k] > 0 ? Math.min(stop, o[k]) : stop) / entry - 1) * 100, bars: k - i, why: 'stop' }
      let ll = Infinity
      for (let m = k - EXIT_N; m <= k - 1; m++) if (l[m] < ll) ll = l[m]
      if (c[k] < ll) return { ret: (c[k] / entry - 1) * 100, bars: k - i, why: 'exit10' }
    }
    if (i + MAX_HOLD < N) return { ret: (c[i + MAX_HOLD] / entry - 1) * 100, bars: MAX_HOLD, why: 'cap' }
    return null
  }

  const push = (name, i) => {
    const t = TRACKS[name]
    if (i + t.hold >= N) return
    const tur = simulate(i, true), turNo = simulate(i, false)
    if (!tur || !turNo) return
    t.rows.push({ ticker, ym: dt[i].slice(0, 7),
      fixed: (c[i + t.hold] / c[i] - 1) * 100, turtle: tur.ret, turtleBars: tur.bars, turtleWhy: tur.why,
      turtleNoStop: turNo.ret, noStopBars: turNo.bars })
  }

  for (let i = 250; i < N - 1; i++) {
    const ma50 = sma(50, i), ma50p = sma(50, i - 20)
    if (ma50 == null || ma50p == null) continue
    const regime = ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'

    // 🅰️ A — 역배열(224>112) + 이격도≤95 이력 + 112선 당일 회복 · KR 하락장
    if (market === 'KR' && regime === 'down') {
      const mS = sma(112, i), mL = sma(224, i), mSp = sma(112, i - 1)
      if (mS != null && mL != null && mSp != null && mL > mS && c[i] > mS && c[i - 1] <= mSp) {
        let disp = false
        for (let k = Math.max(0, i - 20); k <= i; k++) { const m = sma(20, k); if (m != null && (c[k] / m) * 100 <= 95) { disp = true; break } }
        if (disp) push('A 역매공파(KR·하락장)', i)
      }
    }
    // 🅲 C — 선행스팬1 상승 + TRIX 영선 상향돌파 + 강도 증가 + 11일선 위 · US 상승장
    if (market === 'US' && regime === 'up') {
      const ma11 = sma(11, i)
      if (spanA[i] != null && spanA[i - 1] != null && trix[i] != null && trix[i - 1] != null && ma11 != null
        && spanA[i] > spanA[i - 1] && trix[i] > 0 && trix[i - 1] <= 0 && trix[i] > trix[i - 1] && c[i] > ma11)
        push('C 킴스(US·상승장)', i)
    }
    // 🅳 D — 224 아래 60봉 중 45봉+ 체류 → 당일 +5% + 거래량 2배 + runup ≤30% · KR 하락장
    if (market === 'KR' && regime === 'down') {
      const ma224 = sma(224, i - 1)
      if (ma224 != null && vol[i] > 0) {
        let below = 0
        for (let k = i - 60; k < i; k++) { const m = sma(224, k); if (m != null && c[k] < m) below++ }
        let v20 = 0; for (let k = i - 20; k < i; k++) v20 += vol[k]; v20 /= 20
        let min20 = Infinity; for (let k = i - 19; k <= i; k++) if (l[k] < min20) min20 = l[k]
        if (below >= 45 && (c[i] / c[i - 1] - 1) * 100 >= 5 && v20 > 0 && vol[i] >= v20 * 2 && (c[i] / min20 - 1) * 100 <= 30)
          push('D 바닥급등(KR·하락장)', i)
      }
    }
  }
}

console.log('🐢➕ 우리 진입 + 터틀 청산  vs  우리 진입 + 고정 보유기간')
console.log('   터틀 청산 = 10일 최저 이탈 종가마감 · 손절 = 진입가 − 2×ATR(20) · 최대 120봉\n')
for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')

const stat = (a) => {
  const w = a.filter(x => x > 0), lo = a.filter(x => x <= 0)
  const gw = w.reduce((s, x) => s + x, 0), gl = -lo.reduce((s, x) => s + x, 0)
  return { n: a.length, win: Math.round(w.length / a.length * 100), mean: avg(a), trimmed: avg(trim(a)),
    med: med(a), pf: gl > 0 ? gw / gl : null, ge10: Math.round(a.filter(x => x >= 10).length / a.length * 100) }
}
for (const [name, t] of Object.entries(TRACKS)) {
  if (t.rows.length < 30) { console.log(`\n■ ${name} — ${t.rows.length}건 (표본 부족)`); continue }
  console.log(`\n■ ${name} — ${t.rows.length}건 · 종목 ${new Set(t.rows.map(r => r.ticker)).size}종 · ${new Set(t.rows.map(r => r.ym)).size}개월`)
  console.log('  청산 방식              승률   평균     절사     중위    ≥10%   PF     평균보유')
  const variants = [
    [`고정 ${t.hold}봉(현행)`, t.rows.map(r => r.fixed), t.hold],
    ['터틀(10일이탈+2ATR)', t.rows.map(r => r.turtle), avg(t.rows.map(r => r.turtleBars))],
    ['터틀(손절 없이)', t.rows.map(r => r.turtleNoStop), avg(t.rows.map(r => r.noStopBars))],
  ]
  for (const [lbl, a, bars] of variants) {
    const s = stat(a)
    console.log(`  ${lbl.padEnd(21)} ${String(s.win).padStart(4)}% ${String(r2(s.mean)).padStart(7)}% ${String(r2(s.trimmed)).padStart(7)}%` +
      ` ${String(r2(s.med)).padStart(7)}% ${String(s.ge10).padStart(5)}% ${String(r2(s.pf)).padStart(6)} ${String(Math.round(bars)).padStart(6)}봉`)
  }
  const why = {}; for (const r of t.rows) why[r.turtleWhy] = (why[r.turtleWhy] ?? 0) + 1
  console.log('  터틀 청산 사유: ' + Object.entries(why).map(([k, v]) => `${k} ${Math.round(v / t.rows.length * 100)}%`).join(' · '))
}
