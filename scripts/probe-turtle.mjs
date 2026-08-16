// 🐢 터틀 트레이딩 검증 — 영상(차트 한 장, 2026-08) 규칙을 그대로 정식화해 우리 표본에서 잰다
//   규칙: 진입 = 20일 최고가 돌파 종가마감 / 청산 = 10일 최저가 이탈 종가마감 / 손절 = 진입가 − 2×ATR(20)
//         필터 = 200일선 위에서만 롱 / 리스크 = 거래당 2%
//   주장: "승률은 낮지만 손익비(1:7)로 이긴다"  ← 이걸 대조군과 함께 검증하는 게 목적
//
//   ⛔ 룩어헤드 금지: 봉 i 의 20일 최고가는 [i-20, i-1] 로 계산한다(i 를 포함하면 close>max(high) 가 원천 불가능)
//   ⛔ baseline 대비 초과분만 본다 — 승률 단독은 국면을 신호 탓으로 돌린다
//   ⛔ 손절 체결가는 min(손절선, 그날 시가) — 갭 하락 실측 반영(2026-08-15 위메이드 6%p 과대평가 건)
//   실행: node scripts/probe-turtle.mjs
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

const ENTRY_N = 20, EXIT_N = 10, ATR_N = 20, ATR_MULT = 2, MA_LONG = 200, MAX_HOLD = 120
const HOR = [5, 10, 20]

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)

// ATR(Wilder) — techSignals.calcATR 과 같은 정의(여기선 tsc 없이 순수 수학으로 재현, 값 일치 확인함)
function atrOf(o, h, l, c, period) {
  const N = c.length, out = new Array(N).fill(null)
  if (N < period + 1) return out
  const tr = new Array(N).fill(0)
  for (let i = 1; i < N; i++) tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))
  let s = 0; for (let i = 1; i <= period; i++) s += tr[i]
  out[period] = s / period
  for (let i = period + 1; i < N; i++) out[i] = (out[i - 1] * (period - 1) + tr[i]) / period
  return out
}

// 결과 버킷 — 진입 엣지(고정 구간) / 트레이드 시뮬(터틀 청산 규칙)
const mk = () => ({ fixed: { 5: [], 10: [], 20: [] }, trades: [], tickers: {}, dates: [] })
const R = {
  'KR 필터없음': mk(), 'KR 200일선위': mk(), 'KR 200일선아래(대조군)': mk(),
  'US 필터없음': mk(), 'US 200일선위': mk(), 'US 200일선아래(대조군)': mk(),
}
const base = { KR: { 5: [], 10: [], 20: [] }, US: { 5: [], 10: [], 20: [] } }

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => ['open','high','low','close'].every(k => typeof x[k] === 'number' && x[k] > 0))
  } catch { return }
  if (q.length < 400) return
  const o = q.map(x => x.open), h = q.map(x => x.high), l = q.map(x => x.low), c = q.map(x => x.close)
  const dt = q.map(x => String(x.date).slice(0, 10))
  const N = c.length
  const atr = atrOf(o, h, l, c, ATR_N)
  const sma = n => c.map((_, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += c[k]; return s / n })
  const ma200 = sma(MA_LONG)

  // baseline — 같은 표본의 전 봉 전방수익률
  for (let i = MA_LONG; i < N; i++)
    for (const H of HOR) if (i + H < N) base[market][H].push((c[i + H] / c[i] - 1) * 100)

  for (let i = MA_LONG; i < N - 1; i++) {
    // 🐢 진입: 종가가 직전 20봉 최고가를 돌파해 마감 — [i-ENTRY_N, i-1] (i 제외 = 룩어헤드 차단)
    let hh = -Infinity
    for (let k = i - ENTRY_N; k <= i - 1; k++) if (h[k] > hh) hh = h[k]
    if (!(c[i] > hh)) continue
    // 직전 봉도 돌파 상태면 같은 추세의 연속 신호 — 첫 돌파만 센다(자기상관 억제)
    let hhPrev = -Infinity
    for (let k = i - 1 - ENTRY_N; k <= i - 2; k++) if (h[k] > hhPrev) hhPrev = h[k]
    if (c[i - 1] > hhPrev) continue
    if (atr[i] == null || ma200[i] == null) continue

    const above = c[i] > ma200[i]
    const buckets = [`${market} 필터없음`, above ? `${market} 200일선위` : `${market} 200일선아래(대조군)`]

    // ① 진입 엣지 — 고정 구간(우리 기존 트랙과 같은 잣대로 비교 가능)
    for (const H of HOR) if (i + H < N) for (const b of buckets) R[b].fixed[H].push((c[i + H] / c[i] - 1) * 100)

    // ② 트레이드 시뮬 — 터틀 규칙대로 청산(10일 최저 이탈) 또는 2×ATR 손절
    const entry = c[i], stop = entry - ATR_MULT * atr[i]
    let exitPx = null, bars = 0, why = 'open'
    for (let k = i + 1; k < N && k <= i + MAX_HOLD; k++) {
      bars = k - i
      if (l[k] <= stop) { exitPx = o[k] > 0 ? Math.min(stop, o[k]) : stop; why = 'stop'; break }   // 갭 반영
      let ll = Infinity
      for (let m = k - EXIT_N; m <= k - 1; m++) if (l[m] < ll) ll = l[m]
      if (c[k] < ll) { exitPx = c[k]; why = 'exit10'; break }
    }
    if (exitPx == null) { if (i + MAX_HOLD < N) { exitPx = c[i + MAX_HOLD]; bars = MAX_HOLD; why = 'cap' } else continue }
    const ret = (exitPx / entry - 1) * 100
    for (const b of buckets) {
      R[b].trades.push({ ret, bars, why, ticker, date: dt[i] })
      R[b].tickers[ticker] = (R[b].tickers[ticker] ?? 0) + 1
      R[b].dates.push(dt[i].slice(0, 7))
    }
  }
}

console.log('🐢 터틀 트레이딩 검증 — 20일 돌파 진입 / 10일 이탈 청산 / 2×ATR 손절 / 200일선 필터')
console.log(`   유니버스 KR ${KR.length} + US ${US.length} · 5년 일봉 · 룩어헤드 없음 · 연속 돌파 첫 봉만\n`)
for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')

const bl = {}
for (const m of ['KR', 'US']) { bl[m] = {}; for (const H of HOR) bl[m][H] = avg(trim(base[m][H])) }
console.log('── baseline(전 봉 평균 전방수익률, 절사) ──')
for (const m of ['KR', 'US']) console.log(`  ${m}: ` + HOR.map(H => `${H}봉 ${r2(bl[m][H])}%`).join(' · '))

console.log('\n── ① 진입 엣지 — 고정 구간 절사초과(우리 기존 트랙과 같은 잣대) ──')
console.log('  버킷                         표본   5봉초과   10봉초과   20봉초과')
for (const [name, d] of Object.entries(R)) {
  const m = name.slice(0, 2)
  const cells = HOR.map(H => { const a = d.fixed[H]; if (a.length < 30) return '     —'
    return String(r2(avg(trim(a)) - bl[m][H])).padStart(6) })
  console.log(`  ${name.padEnd(26)} ${String(d.fixed[10].length).padStart(5)}  ${cells.join('    ')}`)
}

console.log('\n── ② 트레이드 시뮬 — 터틀 청산 규칙대로 끝까지 (영상의 손익비 주장 검증) ──')
console.log('  버킷                         건수  승률   평균     중위    평균이익  평균손실  손익비  PF    평균보유')
for (const [name, d] of Object.entries(R)) {
  const t = d.trades
  if (t.length < 30) { console.log(`  ${name.padEnd(26)} ${String(t.length).padStart(5)}  (표본 부족)`); continue }
  const rets = t.map(x => x.ret)
  const wins = rets.filter(x => x > 0), loss = rets.filter(x => x <= 0)
  const gw = wins.reduce((s, x) => s + x, 0), gl = -loss.reduce((s, x) => s + x, 0)
  const aw = avg(wins), al = avg(loss)
  console.log(`  ${name.padEnd(26)} ${String(t.length).padStart(5)} ` +
    `${String(Math.round(wins.length / rets.length * 100)).padStart(4)}% ` +
    `${String(r2(avg(rets))).padStart(7)}% ${String(r2(med(rets))).padStart(7)}% ` +
    `${String(r2(aw)).padStart(8)}% ${String(r2(al)).padStart(8)}% ` +
    `${String(r2(al ? Math.abs(aw / al) : null)).padStart(6)} ${String(r2(gl > 0 ? gw / gl : null)).padStart(5)} ` +
    `${String(Math.round(avg(t.map(x => x.bars)))).padStart(6)}봉`)
}

console.log('\n── ③ autopsy 4단 (200일선 위 버킷) ──')
for (const m of ['KR', 'US']) {
  const d = R[`${m} 200일선위`], t = d.trades
  if (t.length < 30) continue
  const tk = Object.entries(d.tickers).sort((a, b) => b[1] - a[1])
  const months = {}; for (const x of d.dates) months[x] = (months[x] ?? 0) + 1
  const topMonth = Object.entries(months).sort((a, b) => b[1] - a[1])[0]
  const rets = t.map(x => x.ret)
  const why = {}; for (const x of t) why[x.why] = (why[x.why] ?? 0) + 1
  console.log(`  [${m}] 종목 분산 ${tk.length}종 ${tk.length >= 10 ? '✅' : '❌ 기각'}` +
    ` · 최다점유 ${tk[0][0]} ${r2(tk[0][1] / t.length * 100)}% ${tk[0][1] / t.length <= 0.3 ? '✅' : '❌ 기각'}`)
  console.log(`       시점 분산 ${Object.keys(months).length}개월 · 최다월 ${topMonth[0]} ${r2(topMonth[1] / t.length * 100)}%` +
    ` · 절사 후 평균 ${r2(avg(trim(rets)))}% (원 ${r2(avg(rets))}%)`)
  console.log(`       청산 사유: ` + Object.entries(why).map(([k, v]) => `${k} ${Math.round(v / t.length * 100)}%`).join(' · '))
}
