// 🔮 급등 전조 프로브 — "내일 +8% 급등을 오늘 종가 시점에 알 수 있는 전조가 있나"를 실측한다
//   ⛔ 룩어헤드 금지: 봉 i 의 전조 판정은 data[0..i] 만 본다. 급등 여부는 i+1 봉으로 채점.
//   ⛔ baseline 대비 lift 만 의미 있다 — 조건부 확률 단독은 국면 착시.
//   실행: node scripts/probe-spike-precursor.mjs
import { createRequire } from 'module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const require2 = createRequire(`${ROOT}/package.json`)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

// backtest-swing.mjs 와 같은 유니버스(KR/US 각 40 — 시총 상위권)
const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','NOW','UBER','PANW','SNPS','LRCX','KLAC','AMAT','ADI','MRVL','ANET',
  'XOM','CVX','COP','JPM','BAC','GS','UNH','LLY','ABBV','CAT']

const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }

// 전조 후보 — 전부 봉 i 종가 시점에 판정 가능한 것만
const PRECURSORS = {
  '조용한 수급(거래량 2배+가격 보합 ±2%)': (c, v, i, x) => x.volX >= 2 && Math.abs(x.ret1) < 2,
  '거래량 3일 연속 증가': (c, v, i) => i >= 3 && v[i] > v[i - 1] && v[i - 1] > v[i - 2] && v[i - 2] > v[i - 3],
  '52주 신고가 5% 이내': (c, v, i, x) => x.hi52 != null && c[i] >= x.hi52 * 0.95,
  '당일 +5% 급등(관성)': (c, v, i, x) => x.ret1 >= 5,
  '224선 아래 장기체류(60봉 중 45+)': (c, v, i, x) => x.digging,
  '당일 +3%↑ + 거래량 2배': (c, v, i, x) => x.ret1 >= 3 && x.volX >= 2,
}

const stats = {}   // market → cond → { n, spike, big, drop }
const baseS = {}   // market → { n, spike, big, drop }
const bySym = {}   // market → cond → Map(ticker→spikeHits)  (autopsy ①② 용)

function bump(o, spike, big, drop) { o.n++; if (spike) o.spike++; if (big) o.big++; if (drop) o.drop++ }

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.open === 'number')
  } catch { return }
  if (q.length < 300) return
  const c = q.map(x => x.close), v = q.map(x => x.volume ?? 0), h = q.map(x => x.high)

  for (let i = 250; i + 1 < c.length; i++) {
    const v20 = sma(v, 20, i - 1)
    const ma224 = sma(c, 224, i - 1)
    let below = 0
    if (ma224 != null) for (let k = i - 60; k < i; k++) { const m = sma(c, 224, k); if (m != null && c[k] < m) below++ }
    let hi52 = -Infinity
    for (let k = Math.max(0, i - 251); k <= i; k++) if (h[k] > hi52) hi52 = h[k]
    const x = {
      ret1: (c[i] / c[i - 1] - 1) * 100,
      volX: v20 > 0 ? v[i] / v20 : 0,
      hi52: hi52 === -Infinity ? null : hi52,
      digging: ma224 != null && below >= 45,
    }
    // 채점: 익일 종가 +8%↑(spike) / 익일 고가 +8%↑(big — 장중 터치 포함) / 익일 종가 −5%↓(drop — 꼬리 위험)
    const nd = (c[i + 1] / c[i] - 1) * 100
    const ndHi = (h[i + 1] / c[i] - 1) * 100
    const spike = nd >= 8, big = ndHi >= 8, drop = nd <= -5

    baseS[market] ??= { n: 0, spike: 0, big: 0, drop: 0 }
    bump(baseS[market], spike, big, drop)
    for (const [name, fn] of Object.entries(PRECURSORS)) {
      if (!fn(c, v, i, x)) continue
      stats[market] ??= {}; stats[market][name] ??= { n: 0, spike: 0, big: 0, drop: 0 }
      bump(stats[market][name], spike, big, drop)
      if (spike) {
        bySym[market] ??= {}; bySym[market][name] ??= new Map()
        bySym[market][name].set(ticker, (bySym[market][name].get(ticker) ?? 0) + 1)
      }
    }
  }
}

const pct = (a, b) => b ? ((a / b) * 100).toFixed(2) + '%' : '—'
for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')

for (const mkt of ['KR', 'US']) {
  const b = baseS[mkt]
  console.log(`\n══ ${mkt} — baseline (표본 ${b.n.toLocaleString()} 봉) ══`)
  console.log(`  익일 종가+8%↑: ${pct(b.spike, b.n)} · 익일 고가+8% 터치: ${pct(b.big, b.n)} · 익일 −5%↓: ${pct(b.drop, b.n)}`)
  for (const [name, s] of Object.entries(stats[mkt] ?? {})) {
    const lift = b.spike / b.n > 0 ? (s.spike / s.n) / (b.spike / b.n) : 0
    const syms = bySym[mkt]?.[name]
    const symN = syms?.size ?? 0
    const top = syms ? Math.max(0, ...syms.values()) : 0
    const topShare = s.spike > 0 ? ((top / s.spike) * 100).toFixed(0) + '%' : '—'
    console.log(`  ▸ ${name} (n=${s.n})`)
    console.log(`      종가+8%: ${pct(s.spike, s.n)} (lift ×${lift.toFixed(1)}) · 고가터치: ${pct(s.big, s.n)} · −5%↓: ${pct(s.drop, s.n)} · 적중종목 ${symN}종·최다점유 ${topShare}`)
  }
}
