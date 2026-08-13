// 📊 거래량 다이버전스 4규칙 백테스트 — 영상(WiaBe7_VFz0)의 규칙을 정식화해 실측한다
//   규칙: ①음봉대량+반등무량→하락지속 ②음봉대량+반등대량→바닥 ③양봉대량+눌림무량→상승지속 ④양봉대량+눌림대량→천장
//   정식화(영상 "직전 봉들 대비 상대적으로 읽어라"):
//     대량 = 거래량 ≥ 20일 평균 × 2 AND |등락| ≥ 2% · 무량 = 거래량 ≤ 20일 평균(미만) · 중간지대는 제외
//     반등/눌림 = 대량봉 후 1~3봉 내 첫 반대색 봉. 신호봉 = 그 반대색 봉(종가 진입, 룩어헤드 금지)
//   ⛔ baseline 대비 edge 만 본다 · 절사(상하위 10%) 병기 · autopsy ①②용 종목 분산 출력
//   실행: node scripts/probe-volume-divergence.mjs
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
const HOR = [5, 10]

const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)

const RULES = ['①음봉대량→반등무량(하락지속 주장)', '②음봉대량→반등대량(바닥 주장)', '③양봉대량→눌림무량(상승지속 주장)', '④양봉대량→눌림대량(천장 주장)']
const hits = { KR: [[], [], [], []], US: [[], [], [], []] }
const base = { KR: { 5: [], 10: [] }, US: { 5: [], 10: [] } }
const syms = { KR: [new Map(), new Map(), new Map(), new Map()], US: [new Map(), new Map(), new Map(), new Map()] }

async function run(ticker, market) {
  let q
  try {
    const r = await yf.chart(ticker, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.open === 'number')
  } catch { return }
  if (q.length < 300) return
  const c = q.map(x => x.close), o = q.map(x => x.open), v = q.map(x => x.volume ?? 0)

  for (const h of HOR) for (let i = 30; i + h < c.length; i++) base[market][h].push((c[i + h] / c[i] - 1) * 100)

  for (let i = 25; i + 10 < c.length; i++) {
    // 대량봉 탐색: i-3 ~ i-1 중 가장 최근의 대량봉(진입은 신호봉 i 종가 — 룩어헤드 없음)
    let bj = -1
    for (let j = i - 1; j >= i - 3 && j >= 20; j--) {
      const v20 = sma(v, 20, j - 1)
      if (v20 == null || v20 <= 0) continue
      const ret = (c[j] / c[j - 1] - 1) * 100
      if (v[j] >= v20 * 2 && Math.abs(ret) >= 2) { bj = j; break }
    }
    if (bj < 0) continue
    const burstBear = c[bj] < o[bj]
    // 신호봉 i: 대량봉과 반대색이어야(반등/눌림), 그리고 대량봉 이후 첫 반대색 봉이어야
    const bear_i = c[i] < o[i], bull_i = c[i] > o[i]
    if (burstBear && !bull_i) continue
    if (!burstBear && !bear_i) continue
    let first = true
    for (let k = bj + 1; k < i; k++) { if (burstBear ? c[k] > o[k] : c[k] < o[k]) { first = false; break } }
    if (!first) continue
    const v20i = sma(v, 20, i - 1)
    if (v20i == null || v20i <= 0) continue
    const loud = v[i] >= v20i * 2, quiet = v[i] <= v20i
    if (!loud && !quiet) continue                       // 중간지대 제외 — 규칙이 말하는 극단만
    const rule = burstBear ? (quiet ? 0 : 1) : (quiet ? 2 : 3)
    const ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    const regime = ma50 == null || ma50p == null ? 'flat' : ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    const ym = (q[i].date instanceof Date ? q[i].date : new Date(q[i].date)).toISOString().slice(0, 7)
    const ret = { regime, ym }; for (const h of HOR) ret[h] = (c[i + h] / c[i] - 1) * 100
    hits[market][rule].push(ret)
    syms[market][rule].set(ticker, (syms[market][rule].get(ticker) ?? 0) + 1)
  }
}

for (const t of KR) await run(t, 'KR')
for (const t of US) await run(t, 'US')

for (const mkt of ['KR', 'US']) {
  console.log(`\n══ ${mkt} — baseline 10봉 평균 ${r2(avg(base[mkt][10]))}% (절사 ${r2(avg(trim(base[mkt][10])))}%) ══`)
  RULES.forEach((name, ri) => {
    const rows = hits[mkt][ri]
    if (rows.length < 5) { console.log(`  ▸ ${name}: 표본 ${rows.length}건 — 판정 불가`); return }
    const s = syms[mkt][ri]
    const top = Math.max(0, ...s.values())
    for (const h of HOR) {
      const a = rows.map(r => r[h])
      const edge = avg(trim(a)) - avg(trim(base[mkt][h]))
      const win = a.filter(x => x > 0).length / a.length * 100
      if (h === 5) console.log(`  ▸ ${name} (n=${rows.length} · ${s.size}종 · 최다 ${Math.round(top / rows.length * 100)}% · ${new Set(rows.map(r => r.ym)).size}개월 분산)`)
      console.log(`      ${h}봉: 절사edge ${edge >= 0 ? '+' : ''}${r2(edge)}%p · 중위 ${r2(med(a))}% · 승률 ${r2(win)}%`)
    }
    for (const rg of ['up', 'down', 'flat']) {
      const sub = rows.filter(r => r.regime === rg)
      if (sub.length < 10) continue
      const a = sub.map(r => r[10])
      const bsub = base[mkt][10]
      console.log(`      └ ${rg} 국면(n=${sub.length}): 10봉 절사edge ${r2(avg(trim(a)) - avg(trim(bsub)))}%p · 승률 ${r2(a.filter(x => x > 0).length / a.length * 100)}%`)
    }
  })
}
