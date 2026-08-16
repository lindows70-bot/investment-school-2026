// ☁️ 일목균형표 지지·저항 반등 검증 — 영상(코인 콜로세움) 기법 3·4를 우리 표본(KR/US 일봉)에서 잰다
//   영상 주장(비트코인 15분~1시간 선물): ③기준선 되돌림 후 반등 ④구름 터치 후 반등 이 수익률·MDD 모두 우수.
//   ⚠️ 모집단이 완전히 다르다 — 저쪽은 비트코인 분봉 선물(롱/숏), 우리는 KR/US 주식 일봉 롱온리.
//      그래서 영상의 성적(110%·MDD 29%)은 이전되지 않는다. **기법의 형태만 빌려 우리 표본에서 새로 잰다.**
//
//   대조군 설계(핵심): '구름 위' 자체가 이미 좋은 자리일 수 있다. 터치+반등이 **추가 정보**를 주는지 보려면
//      ① 전 봉 baseline ② 구름 위 전부 ③ 기준선 터치+반등 ④ 구름 터치+반등 을 같이 재야 한다.
//
//   ⛔ 룩어헤드: 오늘의 구름은 **26봉 전에 계산된 선행스팬**이다(그래서 오늘 이미 알 수 있다).
//      spanA/B 를 26봉 시프트해서 쓴다 — 시프트를 안 하면 미래를 보는 것이 된다.
//   실행: node scripts/probe-ichimoku-sr.mjs
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

const HOR = [5, 10, 20]
const SHIFT = 26                     // 선행스팬 투영 폭(일목 표준)
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)

// 기간 중간값(Donchian mid) — 일목의 모든 선이 이 형태다
const midOf = (h, l, n) => h.map((_, i) => {
  if (i + 1 < n) return null
  let hi = -Infinity, lo = Infinity
  for (let k = i - n + 1; k <= i; k++) { if (h[k] > hi) hi = h[k]; if (l[k] < lo) lo = l[k] }
  return (hi + lo) / 2
})

const B = {}   // 버킷
const mk = () => ({ ret: { 5: [], 10: [], 20: [] }, mae: [], tickers: {}, months: {} })
for (const m of ['KR', 'US']) for (const k of ['구름위전체', '기준선터치반등', '구름터치반등', '기준선터치_미반등(대조)'])
  B[`${m}|${k}`] = mk()
const base = { KR: { 5: [], 10: [], 20: [] }, US: { 5: [], 10: [], 20: [] } }

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => ['open','high','low','close'].every(k => typeof x[k] === 'number' && x[k] > 0))
  } catch { return }
  if (q.length < 400) return
  const h = q.map(x => x.high), l = q.map(x => x.low), c = q.map(x => x.close)
  const dt = q.map(x => String(x.date).slice(0, 10))
  const N = c.length

  const tenkan = midOf(h, l, 9)      // 전환선
  const kijun  = midOf(h, l, 26)     // 기준선
  const spanB0 = midOf(h, l, 52)     // 선행스팬2(투영 전)
  const spanA0 = tenkan.map((t, i) => (t == null || kijun[i] == null) ? null : (t + kijun[i]) / 2)

  // 오늘 자리의 구름 = 26봉 **전에** 계산된 선행스팬(룩어헤드 아님)
  const cTop = [], cBot = []
  for (let i = 0; i < N; i++) {
    const a = i >= SHIFT ? spanA0[i - SHIFT] : null, b = i >= SHIFT ? spanB0[i - SHIFT] : null
    cTop.push(a == null || b == null ? null : Math.max(a, b))
    cBot.push(a == null || b == null ? null : Math.min(a, b))
  }

  const push = (key, i) => {
    const bk = B[key]; if (!bk) return
    for (const H of HOR) if (i + H < N) bk.ret[H].push((c[i + H] / c[i] - 1) * 100)
    // 📉 MAE(최대 역행폭) — 영상이 강조한 'MDD'의 단건 대응물. 보유 10봉 중 최저 저가까지의 낙폭
    if (i + 10 < N) {
      let lo = Infinity
      for (let k = i + 1; k <= i + 10; k++) if (l[k] < lo) lo = l[k]
      bk.mae.push((lo / c[i] - 1) * 100)
    }
    bk.tickers[ticker] = (bk.tickers[ticker] ?? 0) + 1
    const ym = dt[i].slice(0, 7); bk.months[ym] = (bk.months[ym] ?? 0) + 1
  }

  for (let i = 80; i + 20 < N; i++) {
    if (cTop[i] == null || kijun[i] == null || kijun[i - 1] == null) continue
    for (const H of HOR) base[market][H].push((c[i + H] / c[i] - 1) * 100)

    const aboveCloud = c[i] > cTop[i]
    if (!aboveCloud) continue
    push(`${market}|구름위전체`, i)

    // ③ 기준선 지지 반등 — 저가는 기준선 아래로 뚫었는데 **종가는 기준선 위**(꼬리가 걸침)
    const kijunTouch = l[i] <= kijun[i] && c[i] > kijun[i]
    // 전날은 기준선 위에 있었어야 '되돌림'이다(아래에서 올라온 돌파와 구분)
    const wasAbove = c[i - 1] > kijun[i - 1]
    if (kijunTouch && wasAbove) push(`${market}|기준선터치반등`, i)
    // 대조군 — 같은 터치인데 **되말지 못하고** 기준선 아래 마감(반등 조건만 뺀 짝)
    if (l[i] <= kijun[i] && c[i] <= kijun[i] && wasAbove) push(`${market}|기준선터치_미반등(대조)`, i)

    // ④ 구름 지지 반등 — 저가가 구름 상단 아래로 닿았는데 종가는 구름 위
    if (l[i] <= cTop[i] && c[i] > cTop[i] && (c[i - 1] > (cTop[i - 1] ?? Infinity))) push(`${market}|구름터치반등`, i)
  }
}

console.log('☁️ 일목 지지·저항 반등 — 영상 기법 ③기준선 ④구름 을 KR/US 일봉에서 검증')
console.log('   ⚠️ 영상은 비트코인 분봉 선물(롱/숏) · 우리는 주식 일봉 롱온리 — 성적은 이전 불가, 형태만 빌린다')
console.log(`   유니버스 KR ${KR.length} + US ${US.length} · 5년 · 구름은 26봉 시프트(룩어헤드 없음)\n`)
for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')

const bl = {}
for (const m of ['KR', 'US']) { bl[m] = {}; for (const H of HOR) bl[m][H] = avg(trim(base[m][H])) }
console.log('── baseline(전 봉 절사평균) ──')
for (const m of ['KR', 'US']) console.log(`  ${m}: ` + HOR.map(H => `${H}봉 ${r2(bl[m][H])}%`).join(' · '))

console.log('\n  버킷                              표본   5봉초과  10봉초과  20봉초과  승률   중위    MAE중위  종목')
for (const m of ['KR', 'US']) {
  for (const k of ['구름위전체', '기준선터치반등', '구름터치반등', '기준선터치_미반등(대조)']) {
    const bk = B[`${m}|${k}`], n = bk.ret[10].length
    if (n < 30) { console.log(`  ${(m + ' ' + k).padEnd(32)} ${String(n).padStart(5)}  (표본 부족)`); continue }
    const ex = H => r2(avg(trim(bk.ret[H])) - bl[m][H])
    const w = Math.round(bk.ret[10].filter(x => x > 0).length / n * 100)
    console.log(`  ${(m + ' ' + k).padEnd(32)} ${String(n).padStart(5)} ${String(ex(5)).padStart(8)} ${String(ex(10)).padStart(9)} ${String(ex(20)).padStart(9)}` +
      ` ${String(w + '%').padStart(6)} ${String(r2(med(bk.ret[10]))).padStart(7)} ${String(r2(med(bk.mae))).padStart(8)} ${String(Object.keys(bk.tickers).length).padStart(4)}종`)
  }
}

console.log('\n── autopsy (유망 버킷) ──')
for (const key of Object.keys(B)) {
  const bk = B[key], n = bk.ret[10].length
  if (n < 30) continue
  const m = key.split('|')[0]
  if (avg(trim(bk.ret[10])) - bl[m][10] <= 0) continue
  const tk = Object.entries(bk.tickers).sort((a, b) => b[1] - a[1])[0]
  const mo = Object.entries(bk.months).sort((a, b) => b[1] - a[1])[0]
  const nTk = Object.keys(bk.tickers).length
  const t10 = trim(bk.ret[10]), mu = avg(t10)
  const sd = Math.sqrt(t10.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, t10.length - 1))
  console.log(`  ${key} n=${n}`)
  console.log(`    ①종목 ${nTk}종 ${nTk >= 10 ? '✅' : '❌'} · ②최다 ${tk[0]} ${r2(tk[1] / n * 100)}% ${tk[1] / n <= 0.3 ? '✅' : '❌'}` +
    ` · ③시점 ${Object.keys(bk.months).length}개월(최다 ${mo[0]} ${r2(mo[1] / n * 100)}%) · 📏 표준오차 ±${r2(sd / Math.sqrt(t10.length))}%p`)
}
