// 🔬 단테 기법 1차 스크리닝 — "이격도 95 이하 + 112일선 회복"의 실제 성적
//    ⛔ baseline(같은 종목 전 봉 평균 전방수익) 대비 초과분만 본다. 승률 단독은 국면을 신호 탓으로 돌린다.
//    ⛔ 룩어헤드 금지: 봉 i 판정은 close[0..i]만 사용.
import { createRequire } from 'module'
const require = createRequire('C:/Users/lindo/investment-school-portfolio/package.json')
const YF = require('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const TICKERS = [
  // KR 대형·중형
  '005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS',
  // US
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
]
const HOR = [5, 10, 15]

const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }

const rows = []            // {ticker, idx, date, ret:{5,10,15}}
const baseAll = { 5: [], 10: [], 15: [] }
const perTicker = {}

for (const t of TICKERS) {
  let q
  try {
    const r = await yf.chart(t, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0)
  } catch { continue }
  if (q.length < 300) continue
  const c = q.map(x => x.close)

  // baseline — 전 봉 전방수익(신호와 같은 모집단)
  for (const h of HOR) for (let i = 0; i + h < c.length; i++) baseAll[h].push((c[i + h] / c[i] - 1) * 100)

  for (let i = 224; i + Math.max(...HOR) < c.length; i++) {
    const ma20 = sma(c, 20, i), ma112 = sma(c, 112, i), ma224 = sma(c, 224, i)
    if (ma20 == null || ma112 == null || ma224 == null) continue
    const disp = (c[i] / ma20) * 100                     // 20일 이격도
    const ma112Prev = sma(c, 112, i - 1)
    const recovered = c[i] > ma112 && c[i - 1] <= ma112Prev   // 112일선 회복(당일 돌파)
    const reversed = ma224 > ma112                            // 역배열(224 위, 112 아래)
    // 단테 조합: 역배열 + 이격도 95 이하 이력(최근 20봉) + 112 회복
    if (!reversed || !recovered) continue
    let dispHit = false
    for (let k = Math.max(0, i - 20); k <= i; k++) {
      const m = sma(c, 20, k); if (m != null && (c[k] / m) * 100 <= 95) { dispHit = true; break }
    }
    if (!dispHit) continue
    const ret = {}
    for (const h of HOR) ret[h] = (c[i + h] / c[i] - 1) * 100
    // 레짐 — 50일선 방향(20봉 전 대비). autopsy 3단계: 국면을 신호 탓으로 돌리지 않기 위해
    const ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    const regime = ma50 != null && ma50p != null ? (ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat') : 'na'
    const d = q[i].date instanceof Date ? q[i].date : new Date(q[i].date)
    rows.push({ ticker: t, ym: d.toISOString().slice(0, 7), disp: Math.round(disp * 10) / 10, ret, regime })
    perTicker[t] = (perTicker[t] ?? 0) + 1
  }
}

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r1 = n => n == null ? '—' : (Math.round(n * 100) / 100)

console.log('══ 단테 조합(역배열 + 이격도≤95 + 112일선 회복) 1차 스크리닝 ══')
console.log(`   유니버스 ${TICKERS.length}종 · 신호 ${rows.length}건 · 서로 다른 종목 ${Object.keys(perTicker).length}종`)
const top = Object.entries(perTicker).sort((a, b) => b[1] - a[1])[0]
console.log(`   최다 종목: ${top ? `${top[0]} ${top[1]}건 (${Math.round(top[1] / rows.length * 100)}%)` : '—'}`)
const byYear = {}
for (const r of rows) { const y = r.ym.slice(0, 4); byYear[y] = (byYear[y] ?? 0) + 1 }
const yrs = Object.entries(byYear).sort()
const maxYr = yrs.reduce((a, b) => b[1] > a[1] ? b : a, yrs[0] ?? ['-', 0])
console.log(`   연도 분포: ${yrs.map(([y, n]) => `${y}:${n}`).join(' · ')}`)
console.log(`   → 최다 연도 ${maxYr[0]} ${maxYr[1]}건 (${Math.round(maxYr[1] / rows.length * 100)}%) · 서로 다른 월 ${new Set(rows.map(r => r.ym)).size}개`)
const byReg = {}
for (const r of rows) (byReg[r.regime] ??= []).push(r)

console.log('\n   구간  신호평균   baseline   초과(edge)   절사edge   승률    baseline승률')
for (const h of HOR) {
  const sig = rows.map(r => r.ret[h])
  const base = baseAll[h]
  if (!sig.length) { console.log(`   ${h}봉  신호 없음`); continue }
  const edge = avg(sig) - avg(base)
  const tEdge = avg(trim(sig)) - avg(trim(base))
  const win = sig.filter(x => x > 0).length / sig.length * 100
  const bwin = base.filter(x => x > 0).length / base.length * 100
  console.log(`   ${String(h).padStart(2)}봉  ${String(r1(avg(sig))).padStart(7)}%  ${String(r1(avg(base))).padStart(8)}%  ${String(r1(edge)).padStart(9)}%p  ${String(r1(tEdge)).padStart(8)}%p  ${String(r1(win)).padStart(5)}%  ${String(r1(bwin)).padStart(9)}%`)
}
console.log('\n══ 레짐 분리 (50일선 방향) — 10봉 기준 ══')
for (const [k, label] of [['up', '상승'], ['flat', '중립'], ['down', '하락']]) {
  const g = byReg[k] ?? []
  if (!g.length) { console.log(`   ${label}장: 신호 없음`); continue }
  const s = g.map(r => r.ret[10])
  const win = s.filter(x => x > 0).length / s.length * 100
  console.log(`   ${label}장: ${String(g.length).padStart(3)}건 · 평균 ${String(r1(avg(s))).padStart(6)}% · 절사 ${String(r1(avg(trim(s)))).padStart(6)}% · 승률 ${r1(win)}%`)
}
console.log(`   (같은 기간 baseline 10봉 평균 ${r1(avg(baseAll[10]))}% · 승률 ${r1(baseAll[10].filter(x => x > 0).length / baseAll[10].length * 100)}%)`)
console.log('\n   ⚠️ 문서 주장: "승률 통계적으로 80% 이상 수렴"')
